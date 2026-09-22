-- ═══════════════════════════════════════════════════════════════════
-- Les personnes externes : un contact, pas un compte.
--
-- Jusqu'ici, quelqu'un qui vend ou qui dépense sans être membre de la
-- boutique n'existait que sous la forme d'un nom recopié dans
-- `sales.vendeur` ou `expenses.vendeur`. Aucun téléphone, aucun rôle,
-- aucune commission : rien à quoi se raccrocher pour le rappeler.
--
-- Cette table lui donne une fiche. Elle ne donne AUCUN accès : pas de
-- compte, pas de mot de passe, pas de ligne dans `store_members`.
--
-- Le lien `user_id` sert au jour où la personne rejoint vraiment
-- l'équipe : la fiche est alors rattachée à son compte, et tout ce
-- qu'elle a déjà fait reste attaché à son nom.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.personnes_externes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  nom text NOT NULL,
  -- Obligatoire à la saisie, laissé libre en base : les fiches reprises
  -- des anciennes ventes n'ont pas de téléphone, et les refuser aurait
  -- voulu dire perdre le nom.
  telephone text,
  email text,
  -- Un champ libre, pas une liste fermée : « couturière », « chauffeur »,
  -- « revendeuse au marché » sont des métiers qu'on n'a pas prévus.
  role text,
  taux_commission numeric,
  notes text,
  -- Le jour où la personne devient membre. Rien n'est recopié : c'est
  -- un pont, pas un déménagement.
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personnes_externes_commission_borne
    CHECK (taux_commission IS NULL OR (taux_commission >= 0 AND taux_commission <= 100))
);

COMMENT ON TABLE public.personnes_externes IS
  'Vendeurs et intervenants hors equipe. Un contact, jamais un compte : aucune ligne ici ne donne acces a l application.';

COMMENT ON COLUMN public.personnes_externes.user_id IS
  'Le compte de la personne, si elle a rejoint l equipe depuis. Facultatif, et sans effet sur ses droits.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_personnes_externes_boutique_nom
  ON public.personnes_externes (store_id, public.cle_de_liste(nom))
  WHERE actif;

CREATE INDEX IF NOT EXISTS idx_personnes_externes_boutique
  ON public.personnes_externes (store_id, actif);

DROP TRIGGER IF EXISTS trg_personnes_externes_updated_at ON public.personnes_externes;
CREATE TRIGGER trg_personnes_externes_updated_at
  BEFORE UPDATE ON public.personnes_externes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.personnes_externes ENABLE ROW LEVEL SECURITY;

-- Mêmes gardes que l'annuaire des fournisseurs, verrou de boutique
-- compris : `store_allows_write` est dans
-- `peut_ajouter_une_valeur_de_liste` comme dans `can_modify_in_store`.
DROP POLICY IF EXISTS personnes_externes_select ON public.personnes_externes;
CREATE POLICY personnes_externes_select ON public.personnes_externes
  FOR SELECT TO public
  USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS personnes_externes_insert ON public.personnes_externes;
CREATE POLICY personnes_externes_insert ON public.personnes_externes
  FOR INSERT TO public
  WITH CHECK (
    public.peut_ajouter_une_valeur_de_liste(store_id)
    AND (SELECT auth.uid()) = created_by
  );

DROP POLICY IF EXISTS personnes_externes_update ON public.personnes_externes;
CREATE POLICY personnes_externes_update ON public.personnes_externes
  FOR UPDATE TO public
  USING (public.can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS personnes_externes_delete ON public.personnes_externes;
CREATE POLICY personnes_externes_delete ON public.personnes_externes
  FOR DELETE TO public
  USING (public.can_modify_in_store(created_by, store_id));

-- ═══════════ LES NOMS DÉJÀ ÉCRITS DEVIENNENT DES FICHES ═══════════
--
-- Un nom par fiche, sans AUCUNE fusion : « Mamy » et « Mamy
-- Herinatenaina » restent deux fiches distinctes. Rapprocher deux
-- graphies n'est pas une décision de migration — c'est au commerçant de
-- dire si c'est la même personne, et il pourra le faire à l'écran.
--
-- Les membres de l'équipe sont exclus : ils ont déjà un compte.
INSERT INTO public.personnes_externes (store_id, created_by, nom, notes)
SELECT DISTINCT ON (t.store_id, public.cle_de_liste(t.nom))
       t.store_id,
       st.owner_id,
       btrim(t.nom),
       'Fiche creee lors de la reprise des noms saisis dans les ventes et les depenses. Telephone a completer.'
  FROM (
        SELECT store_id, vendeur AS nom FROM public.sales
         WHERE btrim(coalesce(vendeur, '')) <> ''
        UNION ALL
        SELECT store_id, vendeur AS nom FROM public.expenses
         WHERE btrim(coalesce(vendeur, '')) <> ''
       ) t
  JOIN public.stores st ON st.id = t.store_id
 WHERE NOT EXISTS (
         SELECT 1
           FROM public.store_members sm
           JOIN public.profiles p ON p.id = sm.user_id
          WHERE sm.store_id = t.store_id
            AND public.cle_de_liste(coalesce(p.full_name, p.email))
                = public.cle_de_liste(t.nom)
       )
   AND NOT EXISTS (
         SELECT 1 FROM public.profiles p
          WHERE p.id = st.owner_id
            AND public.cle_de_liste(coalesce(p.full_name, p.email))
                = public.cle_de_liste(t.nom)
       )
 ORDER BY t.store_id, public.cle_de_liste(t.nom), btrim(t.nom);

-- ═════════════ « EFFECTUÉ PAR », DANS UNE DÉPENSE ═════════════
--
-- Le champ s'appelait « Vendeur ». Il désigne en réalité qui a fait la
-- dépense — un vendeur, un livreur, le comptable, ou quelqu'un
-- d'extérieur envoyé acheter du carburant.
--
-- La colonne texte `vendeur` reste la vérité affichée et n'est jamais
-- réécrite : les deux identifiants viennent à côté, facultatifs.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS membre_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personne_id uuid REFERENCES public.personnes_externes (id) ON DELETE SET NULL;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_effectue_par_unique;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_effectue_par_unique
  CHECK (membre_id IS NULL OR personne_id IS NULL);

COMMENT ON COLUMN public.expenses.vendeur IS
  'Qui a effectue la depense, en clair. Reste la verite affichee ; membre_id et personne_id ne font que la relier a une fiche.';

CREATE INDEX IF NOT EXISTS idx_expenses_personne ON public.expenses (personne_id);

-- Rattachement des dépenses déjà enregistrées, par nom exact.
--
-- Le journal d'activité est mis en sommeil le temps de la reprise : ces
-- écritures ne sont le geste de personne, et les laisser passer aurait
-- affiché « quelqu'un a modifié cette dépense » à des gens qui n'ont
-- rien touché.
ALTER TABLE public.expenses DISABLE TRIGGER trg_journal_expenses;

UPDATE public.expenses e
   SET personne_id = pe.id
  FROM public.personnes_externes pe
 WHERE e.personne_id IS NULL
   AND e.membre_id IS NULL
   AND pe.store_id = e.store_id
   AND btrim(coalesce(e.vendeur, '')) <> ''
   AND public.cle_de_liste(pe.nom) = public.cle_de_liste(e.vendeur);

UPDATE public.expenses e
   SET membre_id = p.id
  FROM public.store_members sm
  JOIN public.profiles p ON p.id = sm.user_id
 WHERE e.personne_id IS NULL
   AND e.membre_id IS NULL
   AND sm.store_id = e.store_id
   AND btrim(coalesce(e.vendeur, '')) <> ''
   AND public.cle_de_liste(coalesce(p.full_name, p.email)) = public.cle_de_liste(e.vendeur);

-- ═════════════ LE POSTE DE DÉPENSE REJOINT LA LISTE ═════════════
--
-- `expenses.type` était un texte libre, et `expenses.category_id`
-- attendait depuis le début qu'on le remplisse.
INSERT INTO public.categories (store_id, created_by, nom, usage, ordre)
SELECT DISTINCT ON (e.store_id, public.cle_de_liste(e.type))
       e.store_id, st.owner_id, btrim(e.type), 'depense', 1000
  FROM public.expenses e
  JOIN public.stores st ON st.id = e.store_id
 WHERE btrim(coalesce(e.type, '')) <> ''
 ORDER BY e.store_id, public.cle_de_liste(e.type), btrim(e.type)
    ON CONFLICT DO NOTHING;

UPDATE public.expenses e
   SET category_id = c.id
  FROM public.categories c
 WHERE e.category_id IS NULL
   AND c.store_id = e.store_id
   AND c.usage = 'depense'
   AND btrim(coalesce(e.type, '')) <> ''
   AND public.cle_de_liste(c.nom) = public.cle_de_liste(e.type);

ALTER TABLE public.expenses ENABLE TRIGGER trg_journal_expenses;

COMMENT ON COLUMN public.expenses.type IS
  'Poste de depense tel que saisi a l epoque. Conserve comme filet derriere category_id ; l ecran ecrit desormais les deux.';

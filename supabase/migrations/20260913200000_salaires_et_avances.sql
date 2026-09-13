-- Les salaires et les avances sur salaire.
--
-- ── La première table qui DÉCLARE une personne ──
--
-- Jusqu'ici, personne n'existe dans Tantana Suite. Un « vendeur » est une
-- liste de noms RECALCULÉE à chaque affichage : les collaborateurs
-- invités, plus les noms libres trouvés dans les ventes et les dépenses,
-- plus le propriétaire. Quelqu'un qui n'a rien fait n'apparaît nulle part.
--
-- Un salaire ne peut pas se contenter de ça : on embauche un livreur le
-- lundi, on lui doit son mois avant qu'il ait enregistré la moindre
-- ligne. `salaires` est donc la première table qui déclare quelqu'un au
-- lieu de le déduire. Créer une fiche, c'est faire entrer la personne.
--
-- D'où la clé : le NOM (`employe`), comme `sales.vendeur`,
-- `expenses.vendeur` et `remises_vendeur.vendeur`. Un compte (`user_id`)
-- peut s'y rattacher, mais n'est jamais exigé — les vendeurs de la
-- boutique en production n'en ont pas.
--
-- N'IMPORTE QUEL poste : rien ici ne dit « vendeur ». `poste` est un
-- texte libre — livreur, gestionnaire de stock, gardien.
--
-- ── Le piège du livreur, évité de justesse ──
--
-- `store_allows_write()` — le garde d'écriture habituel — s'appuie sur
-- `is_store_member()`, qui exclut explicitement les livreurs
-- (`role IS DISTINCT FROM 'livreur'`). L'employer ici aurait interdit à
-- un livreur de demander une avance, alors que c'est précisément un des
-- cas à couvrir. Les règles ci-dessous vérifient donc la boutique
-- verrouillée (`store_is_locked`) et le salaire déclaré, sans passer par
-- l'appartenance.
--
-- ── Pourquoi une LIGNE par salaire et non une colonne ──
--
-- Le salaire change dans le temps. Une colonne qu'on écrase réécrit le
-- passé : en juillet, juin afficherait le nouveau montant. Une ligne
-- datée laisse juin être juin. Même règle que celle qui protège déjà
-- l'historique des ventes.
--
-- Poser un nouveau salaire ferme automatiquement le précédent la veille :
-- « à partir du 1er octobre, 200 000 » veut dire que l'ancien s'arrête le
-- 30 septembre. Rien à cocher, rien à oublier.
--
-- ── Une seule table pour l'argent ──
--
-- L'avance et le solde de fin de mois ont exactement les mêmes colonnes :
-- un montant, une date, une période, quelqu'un qui verse. Deux tables
-- jumelles divergeraient. Une colonne `type` suffit, et le total payé du
-- mois devient une seule addition.
--
-- `periode` est une COLONNE et non une déduction de la date : une avance
-- prise le 29 septembre pour le salaire d'octobre est le cas le plus
-- courant qui soit.
--
-- ── Approuvée n'est pas versée ──
--
-- Souvent le même instant, pas toujours. Seul `versee` fait sortir
-- l'argent. C'est cette distinction qui garde la caisse honnête.
--
-- Le salaire lui-même ne touche JAMAIS la trésorerie : c'est un
-- engagement, il ne devient de l'argent qu'au moment où il est payé.
-- Compter la charge ET le versement retirerait deux fois le même argent.
--
-- ── Qui écrit quel statut ──
--
-- La contrainte n'est pas la séquence, c'est qui l'écrit. Le propriétaire
-- enregistre une avance déjà versée en un seul geste — sans quoi le
-- module serait inutilisable chez un client dont aucun employé n'a de
-- compte. Un employé ne peut qu'ouvrir une demande, et l'annuler tant
-- qu'elle attend.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Qui a le droit de quoi
-- ═══════════════════════════════════════════════════════════════════

-- Voir les salaires de TOUT LE MONDE. Chacun voit toujours le sien, sans
-- passer par ici (voir les règles de lecture plus bas).
CREATE OR REPLACE FUNCTION public.peut_voir_tous_les_salaires(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM store_members
                  WHERE store_id = p_store_id AND user_id = auth.uid()
                    AND permissions -> 'salaires' ->> 'visible' = 'true'
                    AND permissions -> 'salaires' ->> 'scope' = 'all');
$function$;

-- Fixer un salaire, approuver, verser. Le propriétaire, ou un responsable
-- à qui l'action « pay » a été ouverte.
CREATE OR REPLACE FUNCTION public.peut_gerer_les_salaires(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM store_members
                  WHERE store_id = p_store_id AND user_id = auth.uid()
                    AND permissions -> 'salaires' ->> 'visible' = 'true'
                    AND permissions -> 'salaires' ->> 'scope' = 'all'
                    AND jsonb_exists(permissions -> 'salaires' -> 'actions', 'pay'));
$function$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. La fiche de salaire
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.salaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  -- Le NOM. Se saisit librement : un employé fraîchement embauché
  -- n'apparaît dans aucune vente et dans aucune dépense.
  employe text NOT NULL CHECK (btrim(employe) <> ''),
  -- Le compte, QUAND il y en a un. SET NULL : la fiche de paie survit à
  -- la suppression du compte, comme toutes les écritures de la boutique.
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  -- Texte libre. Le module ne connaît aucune liste de métiers.
  poste text,
  montant numeric NOT NULL CHECK (montant > 0),
  periodicite text NOT NULL DEFAULT 'mois' CHECK (periodicite IN ('mois')),
  debut_le date NOT NULL DEFAULT CURRENT_DATE,
  fin_le date,
  note text,
  cree_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salaires_periode_coherente CHECK (fin_le IS NULL OR fin_le >= debut_le)
);

COMMENT ON TABLE public.salaires IS
  'Le salaire d un employe, date. Une ligne par changement : le passe n est jamais reecrit. Cle sur le NOM, le compte est facultatif.';

CREATE INDEX IF NOT EXISTS idx_salaires_boutique ON public.salaires (store_id, employe);
CREATE INDEX IF NOT EXISTS idx_salaires_compte ON public.salaires (user_id);
CREATE INDEX IF NOT EXISTS idx_salaires_cree_par ON public.salaires (cree_par);

-- Un seul salaire EN COURS par personne. Les périodes closes s'empilent
-- librement derrière : c'est l'historique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_salaires_un_seul_en_cours
  ON public.salaires (store_id, lower(btrim(employe)))
  WHERE fin_le IS NULL;

-- Poser un nouveau salaire ferme le précédent la veille.
CREATE OR REPLACE FUNCTION public.cloturer_le_salaire_precedent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.employe := btrim(NEW.employe);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.salaires
       SET fin_le = NEW.debut_le - 1
     WHERE store_id = NEW.store_id
       AND lower(btrim(employe)) = lower(NEW.employe)
       AND id IS DISTINCT FROM NEW.id
       AND fin_le IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS salaires_cloturer_precedent ON public.salaires;
CREATE TRIGGER salaires_cloturer_precedent BEFORE INSERT OR UPDATE ON public.salaires
  FOR EACH ROW EXECUTE FUNCTION public.cloturer_le_salaire_precedent();

DROP TRIGGER IF EXISTS trg_journal_salaires ON public.salaires;
CREATE TRIGGER trg_journal_salaires
  AFTER INSERT OR UPDATE OR DELETE ON public.salaires
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_activite();

ALTER TABLE public.salaires ENABLE ROW LEVEL SECURITY;

-- Chacun voit le sien. Les lignes sans compte ne sont visibles que des
-- responsables — ce qui est exactement ce qu'on veut.
DROP POLICY IF EXISTS salaires_lecture ON public.salaires;
CREATE POLICY salaires_lecture ON public.salaires FOR SELECT
  USING (peut_voir_tous_les_salaires(store_id) OR user_id = (select auth.uid()));

DROP POLICY IF EXISTS salaires_creation ON public.salaires;
CREATE POLICY salaires_creation ON public.salaires FOR INSERT
  WITH CHECK (NOT store_is_locked(store_id) AND peut_gerer_les_salaires(store_id));

DROP POLICY IF EXISTS salaires_modification ON public.salaires;
CREATE POLICY salaires_modification ON public.salaires FOR UPDATE
  USING (peut_gerer_les_salaires(store_id))
  WITH CHECK (peut_gerer_les_salaires(store_id));

DROP POLICY IF EXISTS salaires_suppression ON public.salaires;
CREATE POLICY salaires_suppression ON public.salaires FOR DELETE
  USING (peut_gerer_les_salaires(store_id));

-- ═══════════════════════════════════════════════════════════════════
-- 3. L'argent versé : avances et soldes
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.paiements_salaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  numero text,
  employe text NOT NULL CHECK (btrim(employe) <> ''),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'avance' CHECK (type IN ('avance', 'solde')),
  montant numeric NOT NULL CHECK (montant > 0),
  -- Le mois IMPUTÉ, ramené au 1er. C'est lui, et lui seul, qui fait la
  -- clôture mensuelle : il n'y a aucune procédure de fin de mois.
  periode date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'approuvee', 'refusee', 'versee', 'annulee')),
  motif text,
  motif_refus text,
  -- Coché : l'employé garde de l'argent qu'il détenait déjà, donc son
  -- solde en poche baisse aussi. Décoché : payé depuis le coffre, seule
  -- la trésorerie bouge.
  depuis_la_caisse_du_vendeur boolean NOT NULL DEFAULT false,
  demande_le timestamptz NOT NULL DEFAULT now(),
  demande_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  decide_le timestamptz,
  decide_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  verse_le date,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.paiements_salaire IS
  'Avances et soldes de salaire. Seul le statut versee fait sortir l argent ; le salaire lui-meme ne touche jamais la tresorerie.';

CREATE INDEX IF NOT EXISTS idx_paiements_salaire_boutique
  ON public.paiements_salaire (store_id, periode DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_salaire_employe
  ON public.paiements_salaire (store_id, employe);
CREATE INDEX IF NOT EXISTS idx_paiements_salaire_compte
  ON public.paiements_salaire (user_id);
CREATE INDEX IF NOT EXISTS idx_paiements_salaire_attente
  ON public.paiements_salaire (store_id) WHERE statut = 'en_attente';
CREATE INDEX IF NOT EXISTS idx_paiements_salaire_demande_par
  ON public.paiements_salaire (demande_par);
CREATE INDEX IF NOT EXISTS idx_paiements_salaire_decide_par
  ON public.paiements_salaire (decide_par);

-- Numéro, période ramenée au 1er, et les dates de décision remplies
-- toutes seules — on ne demande pas à une main de retenir ça.
CREATE OR REPLACE FUNCTION public.tenir_le_paiement_de_salaire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.employe := btrim(NEW.employe);
  NEW.periode := date_trunc('month', NEW.periode::timestamp)::date;

  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
      NEW.numero := CASE WHEN NEW.type = 'solde' THEN 'SLD' ELSE 'AVS' END
        || lpad(next_store_counter(
             NEW.store_id,
             CASE WHEN NEW.type = 'solde' THEN 'solde_salaire' ELSE 'avance_salaire' END
           )::text, 3, '0');
    END IF;
    IF NEW.statut <> 'en_attente' THEN
      NEW.decide_le := coalesce(NEW.decide_le, now());
      NEW.decide_par := coalesce(NEW.decide_par, auth.uid());
    END IF;
    IF NEW.statut = 'versee' THEN
      NEW.verse_le := coalesce(NEW.verse_le, CURRENT_DATE);
    END IF;
  ELSIF NEW.statut IS DISTINCT FROM OLD.statut THEN
    NEW.decide_le := now();
    NEW.decide_par := auth.uid();
    IF NEW.statut = 'versee' THEN
      NEW.verse_le := coalesce(NEW.verse_le, CURRENT_DATE);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Le verrou du circuit. Un employé ne décide pas d'une avance — pas même
-- de la sienne. Il peut seulement retirer une demande encore en attente,
-- sans rien changer d'autre au passage.
CREATE OR REPLACE FUNCTION public.garder_le_circuit_des_avances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF public.peut_gerer_les_salaires(NEW.store_id) THEN
    RETURN NEW;
  END IF;

  IF OLD.statut <> 'en_attente' OR NEW.statut <> 'annulee' THEN
    RAISE EXCEPTION 'Seul un responsable peut decider d une avance.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.montant IS DISTINCT FROM OLD.montant
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.periode IS DISTINCT FROM OLD.periode
     OR NEW.employe IS DISTINCT FROM OLD.employe
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.depuis_la_caisse_du_vendeur IS DISTINCT FROM OLD.depuis_la_caisse_du_vendeur THEN
    RAISE EXCEPTION 'Une demande ne se modifie pas : annulez-la et refaites-en une.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

-- L'ordre compte : « garder » avant « tenir » (alphabétique), donc le
-- refus tombe avant que les dates de décision soient remplies.
DROP TRIGGER IF EXISTS garder_le_circuit ON public.paiements_salaire;
CREATE TRIGGER garder_le_circuit BEFORE UPDATE ON public.paiements_salaire
  FOR EACH ROW EXECUTE FUNCTION public.garder_le_circuit_des_avances();

DROP TRIGGER IF EXISTS tenir_le_paiement ON public.paiements_salaire;
CREATE TRIGGER tenir_le_paiement BEFORE INSERT OR UPDATE ON public.paiements_salaire
  FOR EACH ROW EXECUTE FUNCTION public.tenir_le_paiement_de_salaire();

DROP TRIGGER IF EXISTS trg_journal_paiements_salaire ON public.paiements_salaire;
CREATE TRIGGER trg_journal_paiements_salaire
  AFTER INSERT OR UPDATE OR DELETE ON public.paiements_salaire
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_activite();

ALTER TABLE public.paiements_salaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paiements_salaire_lecture ON public.paiements_salaire;
CREATE POLICY paiements_salaire_lecture ON public.paiements_salaire FOR SELECT
  USING (peut_voir_tous_les_salaires(store_id) OR user_id = (select auth.uid()));

-- Le responsable écrit ce qu'il veut. L'employé ne peut ouvrir qu'une
-- demande d'avance, à son nom, et seulement s'il a un salaire déclaré :
-- sans salaire, il n'y a rien à avancer.
DROP POLICY IF EXISTS paiements_salaire_creation ON public.paiements_salaire;
CREATE POLICY paiements_salaire_creation ON public.paiements_salaire FOR INSERT
  WITH CHECK (
    NOT store_is_locked(store_id)
    AND (
      peut_gerer_les_salaires(store_id)
      OR (
        type = 'avance'
        AND statut = 'en_attente'
        AND user_id = (select auth.uid())
        AND demande_par = (select auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.salaires s
           WHERE s.store_id = paiements_salaire.store_id
             AND s.user_id = (select auth.uid())
             AND s.fin_le IS NULL
        )
      )
    )
  );

-- Le verrou fait le reste du travail : ici on ouvre seulement la porte à
-- l'employé qui retire sa propre demande.
DROP POLICY IF EXISTS paiements_salaire_modification ON public.paiements_salaire;
CREATE POLICY paiements_salaire_modification ON public.paiements_salaire FOR UPDATE
  USING (
    peut_gerer_les_salaires(store_id)
    OR (user_id = (select auth.uid()) AND statut = 'en_attente')
  )
  WITH CHECK (
    peut_gerer_les_salaires(store_id)
    OR (user_id = (select auth.uid()) AND statut = 'annulee')
  );

DROP POLICY IF EXISTS paiements_salaire_suppression ON public.paiements_salaire;
CREATE POLICY paiements_salaire_suppression ON public.paiements_salaire FOR DELETE
  USING (peut_gerer_les_salaires(store_id));

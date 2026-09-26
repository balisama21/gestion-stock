-- Devises multiples, paramètres par boutique, notes de frais.
-- Tout est additif : aucune table existante ne change de forme.

-- ─── 1. Catalogue des devises ───────────────────────────────────────
-- store_id NULL = catalogue commun ; sinon devise ajoutée par une boutique.
CREATE TABLE IF NOT EXISTS public.devises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (code ~ '^[A-Z]{3}$'),
  nom text NOT NULL CHECK (btrim(nom) <> ''),
  symbole text NOT NULL CHECK (btrim(symbole) <> ''),
  decimales smallint NOT NULL DEFAULT 2 CHECK (decimales BETWEEN 0 AND 4),
  region text,
  store_id uuid REFERENCES public.stores (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_devises_commun ON public.devises (code) WHERE store_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_devises_boutique ON public.devises (store_id, code) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devises_created_by ON public.devises (created_by);

INSERT INTO public.devises (code, nom, symbole, decimales, region) VALUES
  ('MGA', 'Ariary malgache', 'Ar', 0, 'Afrique'),
  ('KMF', 'Franc comorien', 'CF', 0, 'Afrique'),
  ('MUR', 'Roupie mauricienne', 'Rs', 2, 'Afrique'),
  ('XOF', 'Franc CFA (BCEAO)', 'CFA', 0, 'Afrique'),
  ('XAF', 'Franc CFA (BEAC)', 'FCFA', 0, 'Afrique'),
  ('ZAR', 'Rand sud-africain', 'R', 2, 'Afrique'),
  ('NGN', 'Naira nigérian', '₦', 2, 'Afrique'),
  ('EGP', 'Livre égyptienne', 'E£', 2, 'Afrique'),
  ('MAD', 'Dirham marocain', 'DH', 2, 'Afrique'),
  ('KES', 'Shilling kényan', 'KSh', 2, 'Afrique'),
  ('EUR', 'Euro', '€', 2, 'Europe'),
  ('GBP', 'Livre sterling', '£', 2, 'Europe'),
  ('CHF', 'Franc suisse', 'CHF', 2, 'Europe'),
  ('USD', 'Dollar américain', '$', 2, 'Amérique du Nord'),
  ('CAD', 'Dollar canadien', '$CA', 2, 'Amérique du Nord'),
  ('BRL', 'Réal brésilien', 'R$', 2, 'Amérique du Sud'),
  ('CNY', 'Yuan chinois', '¥', 2, 'Asie'),
  ('JPY', 'Yen japonais', '¥', 0, 'Asie'),
  ('INR', 'Roupie indienne', '₹', 2, 'Asie'),
  ('AED', 'Dirham des Émirats', 'AED', 2, 'Asie'),
  ('AUD', 'Dollar australien', '$AU', 2, 'Océanie')
ON CONFLICT DO NOTHING;

-- Une boutique ne redéclare pas un code du catalogue commun.
CREATE OR REPLACE FUNCTION public.devise_code_libre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF NEW.store_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM devises WHERE store_id IS NULL AND code = NEW.code) THEN
    RAISE EXCEPTION 'La devise % existe déjà dans la liste commune.', NEW.code USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_devise_code_libre ON public.devises;
CREATE TRIGGER trg_devise_code_libre BEFORE INSERT OR UPDATE OF code ON public.devises
  FOR EACH ROW EXECUTE FUNCTION public.devise_code_libre();

ALTER TABLE public.devises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devises_select ON public.devises;
CREATE POLICY devises_select ON public.devises FOR SELECT TO authenticated
  USING (store_id IS NULL OR public.is_store_member(store_id));

DROP POLICY IF EXISTS devises_insert ON public.devises;
CREATE POLICY devises_insert ON public.devises FOR INSERT TO authenticated
  WITH CHECK (
    store_id IS NOT NULL
    AND public.store_allows_write(store_id)
    AND public.is_store_owner(store_id)
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS devises_update ON public.devises;
CREATE POLICY devises_update ON public.devises FOR UPDATE TO authenticated
  USING (store_id IS NOT NULL AND public.store_allows_write(store_id) AND public.is_store_owner(store_id))
  WITH CHECK (store_id IS NOT NULL AND public.store_allows_write(store_id) AND public.is_store_owner(store_id));

DROP POLICY IF EXISTS devises_delete ON public.devises;
CREATE POLICY devises_delete ON public.devises FOR DELETE TO authenticated
  USING (store_id IS NOT NULL AND public.store_allows_write(store_id) AND public.is_store_owner(store_id));

-- ─── 2. Devises d'une boutique et leur taux ─────────────────────────
-- taux = valeur d'UNE unité de cette devise, exprimée dans la devise principale.
CREATE TABLE IF NOT EXISTS public.devises_boutique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  code text NOT NULL,
  principale boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  mode_taux text NOT NULL DEFAULT 'manuel' CHECK (mode_taux IN ('manuel', 'auto')),
  taux numeric NOT NULL DEFAULT 1 CHECK (taux > 0),
  taux_source text NOT NULL DEFAULT 'manuel' CHECK (taux_source IN ('manuel', 'auto', 'secours', 'principale')),
  taux_maj_le timestamptz NOT NULL DEFAULT now(),
  derniere_erreur text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_devises_boutique_principale
  ON public.devises_boutique (store_id) WHERE principale;

DROP TRIGGER IF EXISTS trg_devises_boutique_updated_at ON public.devises_boutique;
CREATE TRIGGER trg_devises_boutique_updated_at BEFORE UPDATE ON public.devises_boutique
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- La principale vaut toujours 1 et ne change que par definir_devise_principale,
-- qui recalcule les autres taux dans la foulée.
CREATE OR REPLACE FUNCTION public.devise_boutique_coherente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF NOT EXISTS (
    SELECT 1 FROM devises d
     WHERE d.code = NEW.code AND (d.store_id IS NULL OR d.store_id = NEW.store_id)
  ) THEN
    RAISE EXCEPTION 'Devise inconnue : %.', NEW.code USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.principale IS DISTINCT FROM OLD.principale
     AND coalesce(current_setting('tantana.changement_principale', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Changer de devise principale passe par definir_devise_principale.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.principale THEN
    NEW.taux := 1;
    NEW.mode_taux := 'manuel';
    NEW.taux_source := 'principale';
    NEW.actif := true;
    NEW.derniere_erreur := NULL;
  ELSIF TG_OP = 'INSERT' AND NEW.principale IS NOT TRUE
        AND coalesce(current_setting('tantana.changement_principale', true), '') <> 'on'
        AND NOT EXISTS (SELECT 1 FROM devises_boutique WHERE store_id = NEW.store_id AND principale) THEN
    RAISE EXCEPTION 'Choisissez d''abord la devise principale de la boutique.' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.taux IS DISTINCT FROM OLD.taux THEN
    NEW.taux_maj_le := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_devise_boutique_coherente ON public.devises_boutique;
CREATE TRIGGER trg_devise_boutique_coherente BEFORE INSERT OR UPDATE ON public.devises_boutique
  FOR EACH ROW EXECUTE FUNCTION public.devise_boutique_coherente();

ALTER TABLE public.devises_boutique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devises_boutique_select ON public.devises_boutique;
CREATE POLICY devises_boutique_select ON public.devises_boutique FOR SELECT TO authenticated
  USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS devises_boutique_insert ON public.devises_boutique;
CREATE POLICY devises_boutique_insert ON public.devises_boutique FOR INSERT TO authenticated
  WITH CHECK (public.store_allows_write(store_id) AND public.is_store_owner(store_id) AND NOT principale);

DROP POLICY IF EXISTS devises_boutique_update ON public.devises_boutique;
CREATE POLICY devises_boutique_update ON public.devises_boutique FOR UPDATE TO authenticated
  USING (public.store_allows_write(store_id) AND public.is_store_owner(store_id))
  WITH CHECK (public.store_allows_write(store_id) AND public.is_store_owner(store_id));

DROP POLICY IF EXISTS devises_boutique_delete ON public.devises_boutique;
CREATE POLICY devises_boutique_delete ON public.devises_boutique FOR DELETE TO authenticated
  USING (public.store_allows_write(store_id) AND public.is_store_owner(store_id) AND NOT principale);

-- Les boutiques existantes affichent toutes « Ar » : l'ariary devient leur principale.
SELECT set_config('tantana.changement_principale', 'on', true);
INSERT INTO public.devises_boutique (store_id, code, principale)
SELECT s.id,
       CASE s.currency_symbol WHEN '€' THEN 'EUR' WHEN '$' THEN 'USD' ELSE 'MGA' END,
       true
  FROM public.stores s
ON CONFLICT (store_id, code) DO NOTHING;
SELECT set_config('tantana.changement_principale', '', true);

-- ─── 3. Historique des taux (audit) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.historique_taux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  code text NOT NULL,
  ancien_taux numeric,
  nouveau_taux numeric NOT NULL,
  mode_taux text NOT NULL,
  source text NOT NULL,
  change_par uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historique_taux_boutique
  ON public.historique_taux (store_id, code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historique_taux_change_par ON public.historique_taux (change_par);

CREATE OR REPLACE FUNCTION public.historiser_taux()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.taux IS DISTINCT FROM OLD.taux OR NEW.mode_taux IS DISTINCT FROM OLD.mode_taux THEN
    INSERT INTO historique_taux (store_id, code, ancien_taux, nouveau_taux, mode_taux, source, change_par)
    VALUES (
      NEW.store_id, NEW.code,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.taux END,
      NEW.taux, NEW.mode_taux, NEW.taux_source, auth.uid()
    );
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_historiser_taux ON public.devises_boutique;
CREATE TRIGGER trg_historiser_taux AFTER INSERT OR UPDATE ON public.devises_boutique
  FOR EACH ROW EXECUTE FUNCTION public.historiser_taux();

ALTER TABLE public.historique_taux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historique_taux_select ON public.historique_taux;
CREATE POLICY historique_taux_select ON public.historique_taux FOR SELECT TO authenticated
  USING (public.is_store_member(store_id));

-- ─── 4. Taux de référence (API), communs à toutes les boutiques ─────
-- unites_par_usd : combien d'unités de la devise pour 1 USD.
CREATE TABLE IF NOT EXISTS public.taux_reference (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  unites_par_usd numeric NOT NULL CHECK (unites_par_usd > 0),
  source text NOT NULL,
  recupere_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.taux_reference ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS taux_reference_select ON public.taux_reference;
CREATE POLICY taux_reference_select ON public.taux_reference FOR SELECT TO authenticated
  USING (true);

-- Recalcule les taux « auto » depuis la référence. Sans référence récente
-- (API tombée), le dernier taux connu est gardé et marqué « secours ».
CREATE OR REPLACE FUNCTION public.appliquer_taux_automatiques(p_store_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_ref_code numeric;
  v_ref_princ numeric;
  v_age interval;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT db.id, db.store_id, db.code, db.taux, p.code AS principale
      FROM devises_boutique db
      JOIN devises_boutique p ON p.store_id = db.store_id AND p.principale
     WHERE db.mode_taux = 'auto' AND db.actif AND NOT db.principale
       AND (p_store_id IS NULL OR db.store_id = p_store_id)
  LOOP
    SELECT unites_par_usd, now() - recupere_le INTO v_ref_code, v_age
      FROM taux_reference WHERE code = r.code;
    SELECT unites_par_usd INTO v_ref_princ FROM taux_reference WHERE code = r.principale;

    IF v_ref_code IS NULL OR v_ref_princ IS NULL THEN
      UPDATE devises_boutique
         SET taux_source = 'secours',
             derniere_erreur = 'Taux automatique indisponible : dernier taux connu conservé.'
       WHERE id = r.id;
    ELSE
      UPDATE devises_boutique
         SET taux = round(v_ref_princ / v_ref_code, 10),
             taux_source = CASE WHEN v_age > interval '36 hours' THEN 'secours' ELSE 'auto' END,
             taux_maj_le = now(),
             derniere_erreur = CASE WHEN v_age > interval '36 hours'
                                    THEN 'Source de taux non mise à jour depuis plus d''un jour.' END
       WHERE id = r.id;
      v_n := v_n + 1;
    END IF;
    v_ref_code := NULL; v_ref_princ := NULL;
  END LOOP;
  RETURN v_n;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.appliquer_taux_automatiques(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appliquer_taux_automatiques(uuid) TO service_role;

-- Pour le bouton « Actualiser » du propriétaire.
CREATE OR REPLACE FUNCTION public.actualiser_mes_taux(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_store_owner(p_store_id) AND public.store_allows_write(p_store_id)) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  RETURN public.appliquer_taux_automatiques(p_store_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.actualiser_mes_taux(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualiser_mes_taux(uuid) TO authenticated;

-- Change la principale et rebase les autres taux : taux' = taux / taux(nouvelle).
-- Les montants déjà enregistrés ne sont pas convertis.
CREATE OR REPLACE FUNCTION public.definir_devise_principale(p_store_id uuid, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text := upper(btrim(p_code));
  v_base numeric;
  v_symbole text;
BEGIN
  IF NOT (public.is_store_owner(p_store_id) AND public.store_allows_write(p_store_id)) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  SELECT symbole INTO v_symbole FROM devises
   WHERE code = v_code AND (store_id IS NULL OR store_id = p_store_id)
   ORDER BY store_id NULLS FIRST LIMIT 1;
  IF v_symbole IS NULL THEN
    RAISE EXCEPTION 'Devise inconnue : %.', v_code USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('tantana.changement_principale', 'on', true);

  SELECT taux INTO v_base FROM devises_boutique WHERE store_id = p_store_id AND code = v_code;
  IF v_base IS NULL THEN
    v_base := 1;
    INSERT INTO devises_boutique (store_id, code) VALUES (p_store_id, v_code);
  END IF;

  UPDATE devises_boutique SET principale = false, taux_source = 'manuel'
   WHERE store_id = p_store_id AND principale AND code <> v_code;

  UPDATE devises_boutique
     SET taux = round(taux / v_base, 10)
   WHERE store_id = p_store_id AND code <> v_code;

  UPDATE devises_boutique SET principale = true
   WHERE store_id = p_store_id AND code = v_code;

  UPDATE stores SET currency_symbol = v_symbole WHERE id = p_store_id;

  PERFORM set_config('tantana.changement_principale', '', true);
  PERFORM public.appliquer_taux_automatiques(p_store_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.definir_devise_principale(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_devise_principale(uuid, text) TO authenticated;

-- ─── 5. Paramètres clé/valeur par boutique ──────────────────────────
-- Les valeurs par défaut vivent dans le code (src/lib/parametres.ts) :
-- une clé absente vaut son défaut.
CREATE TABLE IF NOT EXISTS public.parametres_boutique (
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  cle text NOT NULL CHECK (cle ~ '^[a-z0-9_]{2,60}$'),
  valeur jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, cle)
);

CREATE INDEX IF NOT EXISTS idx_parametres_boutique_updated_by ON public.parametres_boutique (updated_by);

DROP TRIGGER IF EXISTS trg_parametres_boutique_updated_at ON public.parametres_boutique;
CREATE TRIGGER trg_parametres_boutique_updated_at BEFORE UPDATE ON public.parametres_boutique
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.parametres_boutique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parametres_boutique_select ON public.parametres_boutique;
CREATE POLICY parametres_boutique_select ON public.parametres_boutique FOR SELECT TO authenticated
  USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS parametres_boutique_insert ON public.parametres_boutique;
CREATE POLICY parametres_boutique_insert ON public.parametres_boutique FOR INSERT TO authenticated
  WITH CHECK (public.store_allows_write(store_id) AND public.is_store_owner(store_id));

DROP POLICY IF EXISTS parametres_boutique_update ON public.parametres_boutique;
CREATE POLICY parametres_boutique_update ON public.parametres_boutique FOR UPDATE TO authenticated
  USING (public.store_allows_write(store_id) AND public.is_store_owner(store_id))
  WITH CHECK (public.store_allows_write(store_id) AND public.is_store_owner(store_id));

DROP POLICY IF EXISTS parametres_boutique_delete ON public.parametres_boutique;
CREATE POLICY parametres_boutique_delete ON public.parametres_boutique FOR DELETE TO authenticated
  USING (public.store_allows_write(store_id) AND public.is_store_owner(store_id));

-- ─── 6. Notes de frais ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.peut_gerer_notes_de_frais(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM store_members
                  WHERE store_id = p_store_id AND user_id = auth.uid()
                    AND permissions -> 'notes_frais' ->> 'visible' = 'true'
                    AND permissions -> 'notes_frais' ->> 'scope' = 'all'
                    AND jsonb_exists(permissions -> 'notes_frais' -> 'actions', 'approve'));
$function$;

REVOKE EXECUTE ON FUNCTION public.peut_gerer_notes_de_frais(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_gerer_notes_de_frais(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.notes_de_frais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  numero text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  beneficiaire text NOT NULL CHECK (btrim(beneficiaire) <> ''),
  membre_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  personne_id uuid REFERENCES public.personnes_externes (id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  montant numeric NOT NULL CHECK (montant > 0),
  devise text NOT NULL,
  -- Taux figé à la saisie : un changement de taux ne réécrit pas le passé.
  taux numeric NOT NULL DEFAULT 1 CHECK (taux > 0),
  montant_converti numeric NOT NULL DEFAULT 0 CHECK (montant_converti >= 0),
  justificatif text,
  statut text NOT NULL DEFAULT 'a_valider'
    CHECK (statut IN ('a_valider', 'validee', 'refusee', 'remboursee')),
  decision_par uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decision_le timestamptz,
  motif_refus text,
  depense_id uuid REFERENCES public.expenses (id) ON DELETE SET NULL,
  rembourse_le date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notes_de_frais_une_seule_personne CHECK (membre_id IS NULL OR personne_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_notes_de_frais_boutique ON public.notes_de_frais (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_created_by ON public.notes_de_frais (created_by);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_membre ON public.notes_de_frais (membre_id);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_personne ON public.notes_de_frais (personne_id);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_categorie ON public.notes_de_frais (category_id);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_depense ON public.notes_de_frais (depense_id);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_decision_par ON public.notes_de_frais (decision_par);

DROP TRIGGER IF EXISTS trg_notes_de_frais_updated_at ON public.notes_de_frais;
CREATE TRIGGER trg_notes_de_frais_updated_at BEFORE UPDATE ON public.notes_de_frais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Numéro, conversion au taux du jour, rattachements de la même boutique.
CREATE OR REPLACE FUNCTION public.preparer_note_de_frais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_principale text;
  v_taux numeric;
  v_dec smallint;
  v_store uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.numero IS NULL THEN
    NEW.numero := 'NDF' || lpad(next_store_counter(NEW.store_id, 'note_de_frais')::text, 3, '0');
  END IF;

  IF NEW.category_id IS NOT NULL THEN
    SELECT store_id INTO v_store FROM categories WHERE id = NEW.category_id AND usage = 'depense';
    IF v_store IS DISTINCT FROM NEW.store_id THEN
      RAISE EXCEPTION 'Catégorie de dépense introuvable dans cette boutique.';
    END IF;
  END IF;
  IF NEW.personne_id IS NOT NULL THEN
    SELECT store_id INTO v_store FROM personnes_externes WHERE id = NEW.personne_id;
    IF v_store IS DISTINCT FROM NEW.store_id THEN
      RAISE EXCEPTION 'Personne introuvable dans cette boutique.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.montant IS DISTINCT FROM OLD.montant OR NEW.devise IS DISTINCT FROM OLD.devise THEN
    NEW.devise := upper(btrim(NEW.devise));
    SELECT code INTO v_principale FROM devises_boutique WHERE store_id = NEW.store_id AND principale;
    v_principale := coalesce(v_principale, 'MGA');
    IF NEW.devise = v_principale THEN
      v_taux := 1;
    ELSE
      SELECT taux INTO v_taux FROM devises_boutique
       WHERE store_id = NEW.store_id AND code = NEW.devise AND actif;
      IF v_taux IS NULL THEN
        RAISE EXCEPTION 'La devise % n''est pas activée pour cette boutique.', NEW.devise USING ERRCODE = '22023';
      END IF;
    END IF;
    SELECT decimales INTO v_dec FROM devises
     WHERE code = v_principale AND (store_id IS NULL OR store_id = NEW.store_id)
     ORDER BY store_id NULLS FIRST LIMIT 1;
    NEW.taux := v_taux;
    NEW.montant_converti := round(NEW.montant * v_taux, coalesce(v_dec, 0));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_preparer_note_de_frais ON public.notes_de_frais;
CREATE TRIGGER trg_preparer_note_de_frais BEFORE INSERT OR UPDATE ON public.notes_de_frais
  FOR EACH ROW EXECUTE FUNCTION public.preparer_note_de_frais();

DROP TRIGGER IF EXISTS trg_journal_notes_de_frais ON public.notes_de_frais;
CREATE TRIGGER trg_journal_notes_de_frais AFTER INSERT OR UPDATE OR DELETE ON public.notes_de_frais
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_activite();

ALTER TABLE public.notes_de_frais ENABLE ROW LEVEL SECURITY;

-- Chacun voit les siennes ; le responsable voit tout.
DROP POLICY IF EXISTS notes_de_frais_select ON public.notes_de_frais;
CREATE POLICY notes_de_frais_select ON public.notes_de_frais FOR SELECT TO authenticated
  USING (
    public.is_store_member(store_id)
    AND (created_by = (SELECT auth.uid()) OR public.peut_gerer_notes_de_frais(store_id))
  );

DROP POLICY IF EXISTS notes_de_frais_insert ON public.notes_de_frais;
CREATE POLICY notes_de_frais_insert ON public.notes_de_frais FOR INSERT TO authenticated
  WITH CHECK (
    public.store_allows_write(store_id)
    AND created_by = (SELECT auth.uid())
    AND statut = 'a_valider'
    AND depense_id IS NULL
    AND decision_par IS NULL
  );

-- Le statut ne bouge que par les fonctions de décision et de remboursement.
DROP POLICY IF EXISTS notes_de_frais_update ON public.notes_de_frais;
CREATE POLICY notes_de_frais_update ON public.notes_de_frais FOR UPDATE TO authenticated
  USING (
    public.store_allows_write(store_id)
    AND statut = 'a_valider'
    AND (created_by = (SELECT auth.uid()) OR public.peut_gerer_notes_de_frais(store_id))
  )
  WITH CHECK (
    public.store_allows_write(store_id)
    AND statut = 'a_valider'
    AND depense_id IS NULL
    AND decision_par IS NULL
  );

DROP POLICY IF EXISTS notes_de_frais_delete ON public.notes_de_frais;
CREATE POLICY notes_de_frais_delete ON public.notes_de_frais FOR DELETE TO authenticated
  USING (
    public.store_allows_write(store_id)
    AND statut <> 'remboursee'
    AND (
      (created_by = (SELECT auth.uid()) AND statut IN ('a_valider', 'refusee'))
      OR public.peut_gerer_notes_de_frais(store_id)
    )
  );

CREATE OR REPLACE FUNCTION public.decider_note_de_frais(p_id uuid, p_decision text, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
  v_statut text;
BEGIN
  SELECT store_id, statut INTO v_store, v_statut FROM notes_de_frais WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note de frais introuvable.'; END IF;
  IF NOT (public.peut_gerer_notes_de_frais(v_store) AND public.store_allows_write(v_store)) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('validee', 'refusee', 'a_valider') THEN
    RAISE EXCEPTION 'Décision inconnue.' USING ERRCODE = '22023';
  END IF;
  IF v_statut = 'remboursee' THEN
    RAISE EXCEPTION 'Cette note est déjà remboursée.' USING ERRCODE = '22023';
  END IF;

  UPDATE notes_de_frais
     SET statut = p_decision,
         decision_par = CASE WHEN p_decision = 'a_valider' THEN NULL ELSE auth.uid() END,
         decision_le = CASE WHEN p_decision = 'a_valider' THEN NULL ELSE now() END,
         motif_refus = CASE WHEN p_decision = 'refusee' THEN nullif(btrim(p_motif), '') END
   WHERE id = p_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.decider_note_de_frais(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decider_note_de_frais(uuid, text, text) TO authenticated;

-- Le remboursement sort l'argent de la caisse : il crée la dépense dans
-- la même transaction, pour que trésorerie et note ne divergent jamais.
CREATE OR REPLACE FUNCTION public.rembourser_note_de_frais(p_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n notes_de_frais%ROWTYPE;
  v_depense uuid;
BEGIN
  SELECT * INTO n FROM notes_de_frais WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note de frais introuvable.'; END IF;
  IF NOT (public.peut_gerer_notes_de_frais(n.store_id) AND public.store_allows_write(n.store_id)) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF n.statut <> 'validee' THEN
    RAISE EXCEPTION 'Seule une note validée peut être remboursée.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO expenses (
    store_id, owner_id, date, vendeur, type, montant, note,
    category_id, membre_id, personne_id, justificatif
  ) VALUES (
    n.store_id, auth.uid(), coalesce(p_date, CURRENT_DATE), n.beneficiaire,
    coalesce((SELECT nom FROM categories WHERE id = n.category_id), 'Note de frais'),
    n.montant_converti,
    'Note de frais ' || coalesce(n.numero, '') || ' : ' || n.motif
      || CASE WHEN n.taux <> 1 THEN ' (' || n.montant || ' ' || n.devise || ')' ELSE '' END,
    n.category_id, n.membre_id, n.personne_id, n.justificatif
  )
  RETURNING id INTO v_depense;

  UPDATE notes_de_frais
     SET statut = 'remboursee', depense_id = v_depense, rembourse_le = coalesce(p_date, CURRENT_DATE)
   WHERE id = p_id;

  RETURN v_depense;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rembourser_note_de_frais(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rembourser_note_de_frais(uuid, date) TO authenticated;

-- Supprimer la dépense d'un remboursement remet la note « validée ».
CREATE OR REPLACE FUNCTION public.note_de_frais_depense_supprimee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE notes_de_frais
     SET statut = 'validee', depense_id = NULL, rembourse_le = NULL
   WHERE depense_id = OLD.id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_note_de_frais_depense_supprimee ON public.expenses;
CREATE TRIGGER trg_note_de_frais_depense_supprimee BEFORE DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.note_de_frais_depense_supprimee();

REVOKE EXECUTE ON FUNCTION public.devise_code_libre() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.devise_boutique_coherente() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.historiser_taux() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preparer_note_de_frais() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.note_de_frais_depense_supprimee() FROM PUBLIC, anon, authenticated;

-- ─── 7. Synchronisation quotidienne des taux ────────────────────────
-- Réutilise l'adresse et le jeton du coffre déjà posés pour la préalerte.
CREATE OR REPLACE FUNCTION public.demander_la_synchro_des_taux()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_jeton text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'prealerte_fonction_url';
  SELECT decrypted_secret INTO v_jeton FROM vault.decrypted_secrets WHERE name = 'prealerte_cle_appel';
  IF v_url IS NULL OR v_jeton IS NULL THEN
    RAISE WARNING 'Taux : adresse ou jeton absent du coffre.';
    RETURN false;
  END IF;
  PERFORM net.http_post(
    url := regexp_replace(v_url, '/functions/v1/.*$', '/functions/v1/synchroniser-taux'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_jeton),
    body := jsonb_build_object('source', 'cron')
  );
  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.demander_la_synchro_des_taux() FROM PUBLIC, anon, authenticated, service_role;

-- Deux passages par jour : le second rattrape une panne de l'API le matin.
SELECT cron.schedule('taux-de-change', '15 3,15 * * *', $cron$ SELECT public.demander_la_synchro_des_taux(); $cron$);

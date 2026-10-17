-- Intelligence artificielle : socle prêt à l'emploi, ÉTEINT par défaut.
--
-- Purement additif : cinq tables neuves, des fonctions neuves. Aucune
-- table existante n'est touchée ; tant que l'administrateur n'a pas
-- (1) enregistré la clé côté serveur, (2) choisi un modèle et son tarif,
-- (3) fixé un budget et (4) activé l'IA globalement puis par boutique,
-- aucune requête ne part chez le fournisseur.
--
-- Trois notions à ne pas confondre :
--   - les LIMITES INTERNES (budget global, plafond par boutique, quotas,
--     fréquence) : appliquées ici, côté serveur, avant chaque appel ;
--   - les COÛTS ESTIMÉS : calculés avec les tarifs saisis dans ia_tarifs
--     et les jetons renvoyés par le fournisseur ;
--   - la FACTURATION RÉELLE : celle du tableau de bord du fournisseur,
--     seule à faire foi. Les limites internes ne remplacent pas les
--     plafonds de facturation à régler chez le fournisseur.
--
-- Écritures de consommation : uniquement par la fonction edge « ia »
-- (rôle service_role), jamais depuis le navigateur.
-- Contenus : on ne stocke ni prompt ni document, seulement des compteurs.
--
-- Retour arrière : supabase/retours-arriere/20261016110000_ia_infrastructure.sql

-- ─── Fonctionnalités connues ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_fonctionnalites_connues()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY['import_extraction', 'assistant', 'redaction', 'reapprovisionnement', 'anomalies']::text[];
$$;

-- ─── Réglages de la plateforme (une seule ligne) ─────────────────────
CREATE TABLE IF NOT EXISTS public.ia_reglages_plateforme (
  id                      boolean PRIMARY KEY DEFAULT true CHECK (id),
  ia_active               boolean NOT NULL DEFAULT false,
  fournisseur             text NOT NULL DEFAULT 'openai' CHECK (fournisseur IN ('openai')),
  modele                  text CHECK (modele IS NULL OR modele ~ '^[A-Za-z0-9._:-]{1,80}$'),
  budget_mensuel_usd      numeric(12,4) NOT NULL DEFAULT 0 CHECK (budget_mensuel_usd >= 0),
  seuil_alerte_pct        integer NOT NULL DEFAULT 80 CHECK (seuil_alerte_pct BETWEEN 1 AND 100),
  requetes_par_minute     integer NOT NULL DEFAULT 6 CHECK (requetes_par_minute BETWEEN 1 AND 120),
  max_tokens_sortie       integer NOT NULL DEFAULT 1500 CHECK (max_tokens_sortie BETWEEN 64 AND 16000),
  max_caracteres_entree   integer NOT NULL DEFAULT 60000 CHECK (max_caracteres_entree BETWEEN 1000 AND 400000),
  max_fichier_mo          integer NOT NULL DEFAULT 8 CHECK (max_fichier_mo BETWEEN 1 AND 20),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.ia_reglages_plateforme (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS ia_reglages_plateforme_updated_at ON public.ia_reglages_plateforme;
CREATE TRIGGER ia_reglages_plateforme_updated_at
  BEFORE UPDATE ON public.ia_reglages_plateforme
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Tarifs par modèle (saisis par l'administrateur) ─────────────────
-- Aucun tarif n'est pré-rempli : ils changent, et un tarif inventé
-- fausserait toutes les estimations. Sans tarif, le modèle est refusé.
CREATE TABLE IF NOT EXISTS public.ia_tarifs (
  fournisseur                   text NOT NULL CHECK (fournisseur IN ('openai')),
  modele                        text NOT NULL CHECK (modele ~ '^[A-Za-z0-9._:-]{1,80}$'),
  prix_entree_par_million_usd   numeric(12,6) NOT NULL CHECK (prix_entree_par_million_usd >= 0),
  prix_sortie_par_million_usd   numeric(12,6) NOT NULL CHECK (prix_sortie_par_million_usd >= 0),
  source                        text CHECK (source IS NULL OR char_length(source) <= 200),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fournisseur, modele)
);

DROP TRIGGER IF EXISTS ia_tarifs_updated_at ON public.ia_tarifs;
CREATE TRIGGER ia_tarifs_updated_at
  BEFORE UPDATE ON public.ia_tarifs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Réglages par boutique (le tenant) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.ia_reglages_boutique (
  store_id                  uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  ia_active                 boolean NOT NULL DEFAULT false,
  fonctionnalites           text[] NOT NULL DEFAULT '{}'
                              CHECK (fonctionnalites <@ public.ia_fonctionnalites_connues()),
  plafond_mensuel_usd       numeric(12,4) NOT NULL DEFAULT 0 CHECK (plafond_mensuel_usd >= 0),
  requetes_mensuelles_max   integer CHECK (requetes_mensuelles_max IS NULL OR requetes_mensuelles_max >= 0),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ia_reglages_boutique_updated_at ON public.ia_reglages_boutique;
CREATE TRIGGER ia_reglages_boutique_updated_at
  BEFORE UPDATE ON public.ia_reglages_boutique
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Journal de consommation ─────────────────────────────────────────
-- Une ligne par requête, réservée AVANT l'appel (coût maximal possible)
-- puis finalisée APRÈS (coût estimé d'après les jetons réels).
CREATE TABLE IF NOT EXISTS public.ia_consommation (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  fonctionnalite    text NOT NULL,
  fournisseur       text NOT NULL,
  modele            text,
  tokens_entree     integer CHECK (tokens_entree IS NULL OR tokens_entree >= 0),
  tokens_sortie     integer CHECK (tokens_sortie IS NULL OR tokens_sortie >= 0),
  cout_reserve_usd  numeric(12,6) NOT NULL DEFAULT 0,
  cout_estime_usd   numeric(12,6),
  statut            text NOT NULL CHECK (statut IN ('reserve', 'reussi', 'echec', 'refuse')),
  code_erreur       text CHECK (code_erreur IS NULL OR char_length(code_erreur) <= 80),
  duree_ms          integer,
  cree_le           timestamptz NOT NULL DEFAULT now(),
  termine_le        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ia_consommation_mois ON public.ia_consommation (cree_le);
CREATE INDEX IF NOT EXISTS idx_ia_consommation_boutique ON public.ia_consommation (store_id, cree_le);
CREATE INDEX IF NOT EXISTS idx_ia_consommation_utilisateur ON public.ia_consommation (user_id, cree_le);
CREATE INDEX IF NOT EXISTS idx_ia_consommation_en_cours ON public.ia_consommation (cree_le) WHERE statut = 'reserve';

-- ─── Actions proposées par l'IA ──────────────────────────────────────
-- L'IA ne fait que PROPOSER. Une personne confirme ou rejette ; seule
-- une action confirmée peut ensuite être exécutée, par les fonctions
-- métier habituelles (et leurs propres contrôles de droits).
CREATE TABLE IF NOT EXISTS public.ia_actions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  consommation_id  uuid REFERENCES public.ia_consommation(id) ON DELETE SET NULL,
  fonctionnalite   text NOT NULL,
  type_action      text NOT NULL CHECK (type_action ~ '^[a-z_]{1,60}$'),
  resume           text CHECK (resume IS NULL OR char_length(resume) <= 500),
  charge_utile     jsonb CHECK (charge_utile IS NULL OR pg_column_size(charge_utile) <= 262144),
  statut           text NOT NULL DEFAULT 'proposee'
                     CHECK (statut IN ('proposee', 'confirmee', 'rejetee', 'executee', 'echec')),
  resultat         jsonb CHECK (resultat IS NULL OR pg_column_size(resultat) <= 65536),
  cree_le          timestamptz NOT NULL DEFAULT now(),
  decide_par       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decide_le        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ia_actions_boutique ON public.ia_actions (store_id, cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_ia_actions_utilisateur ON public.ia_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_ia_actions_consommation ON public.ia_actions (consommation_id);

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.ia_reglages_plateforme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_tarifs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_reglages_boutique   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_consommation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_actions             ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ia_reglages_plateforme, public.ia_tarifs, public.ia_reglages_boutique,
              public.ia_consommation, public.ia_actions FROM anon, PUBLIC;
GRANT SELECT, UPDATE ON public.ia_reglages_plateforme TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_tarifs, public.ia_reglages_boutique TO authenticated;
GRANT SELECT ON public.ia_consommation, public.ia_actions TO authenticated;
GRANT ALL ON public.ia_reglages_plateforme, public.ia_tarifs, public.ia_reglages_boutique,
             public.ia_consommation, public.ia_actions TO service_role;

-- Réglages de la plateforme et tarifs : super admin seulement.
DROP POLICY IF EXISTS ia_reglages_plateforme_admin ON public.ia_reglages_plateforme;
CREATE POLICY ia_reglages_plateforme_admin ON public.ia_reglages_plateforme
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS ia_tarifs_admin ON public.ia_tarifs;
CREATE POLICY ia_tarifs_admin ON public.ia_tarifs
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

-- Réglages d'une boutique : écrits par le super admin (c'est lui qui
-- paie), lus aussi par le propriétaire de la boutique.
DROP POLICY IF EXISTS ia_reglages_boutique_lecture ON public.ia_reglages_boutique;
CREATE POLICY ia_reglages_boutique_lecture ON public.ia_reglages_boutique
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()) OR public.is_store_owner(store_id));

DROP POLICY IF EXISTS ia_reglages_boutique_ajout ON public.ia_reglages_boutique;
CREATE POLICY ia_reglages_boutique_ajout ON public.ia_reglages_boutique
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS ia_reglages_boutique_modification ON public.ia_reglages_boutique;
CREATE POLICY ia_reglages_boutique_modification ON public.ia_reglages_boutique
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS ia_reglages_boutique_suppression ON public.ia_reglages_boutique;
CREATE POLICY ia_reglages_boutique_suppression ON public.ia_reglages_boutique
  FOR DELETE TO authenticated
  USING ((SELECT public.is_platform_admin()));

-- Consommation : lecture seule, super admin ou propriétaire de la boutique.
DROP POLICY IF EXISTS ia_consommation_lecture ON public.ia_consommation;
CREATE POLICY ia_consommation_lecture ON public.ia_consommation
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()) OR public.is_store_owner(store_id));

-- Actions : l'auteur, le propriétaire de la boutique, le super admin.
DROP POLICY IF EXISTS ia_actions_lecture ON public.ia_actions;
CREATE POLICY ia_actions_lecture ON public.ia_actions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_store_owner(store_id)
    OR (SELECT public.is_platform_admin())
  );

-- ─── Réservation d'un appel (fonction edge uniquement) ───────────────
-- Tout est vérifié ici, dans une seule transaction, sous verrou de la
-- ligne de réglages de la plateforme : deux requêtes simultanées ne
-- peuvent pas dépasser ensemble un budget que chacune respecterait seule.
--
-- Les refus utiles au suivi sont journalisés (statut « refuse ») ; un
-- refus pour fréquence excessive ne l'est pas, pour qu'un abus ne
-- remplisse pas le journal.
CREATE OR REPLACE FUNCTION public.ia_reserver(
  p_user_id                uuid,
  p_store_id               uuid,
  p_fonctionnalite         text,
  p_tokens_entree_estimes  integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plateforme     public.ia_reglages_plateforme%ROWTYPE;
  v_boutique       public.ia_reglages_boutique%ROWTYPE;
  v_tarif          public.ia_tarifs%ROWTYPE;
  v_debut_mois     timestamptz := date_trunc('month', now());
  v_cout_max       numeric;
  v_global_mois    numeric;
  v_boutique_mois  numeric;
  v_req_mois       integer;
  v_req_minute     integer;
  v_id             uuid;
  v_code           text;
BEGIN
  IF p_user_id IS NULL OR p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'requete_invalide');
  END IF;
  IF p_fonctionnalite IS NULL OR NOT (p_fonctionnalite = ANY (public.ia_fonctionnalites_connues())) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'fonctionnalite_inconnue');
  END IF;

  -- Appartenance réelle à la boutique : propriétaire ou membre (hors livreur).
  IF NOT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = p_user_id
    UNION ALL
    SELECT 1 FROM store_members
     WHERE store_id = p_store_id AND user_id = p_user_id
       AND role IS DISTINCT FROM 'livreur'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'acces_refuse');
  END IF;

  -- Les fonctions qui lisent les chiffres de la boutique (ventes, achats,
  -- stock) sont réservées au propriétaire : les droits fins par module
  -- restent appliqués côté écran, pas dans les données ; l'IA ne doit pas
  -- devenir un moyen de les contourner.
  IF p_fonctionnalite IN ('assistant', 'anomalies', 'reapprovisionnement')
     AND NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'reserve_proprietaire');
  END IF;

  IF public.store_is_locked(p_store_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'boutique_verrouillee');
  END IF;

  -- Les réservations abandonnées (fonction interrompue) comptent à leur
  -- coût maximal : prudence, le fournisseur a pu facturer.
  UPDATE ia_consommation
     SET statut = 'echec', code_erreur = 'expiree',
         cout_estime_usd = cout_reserve_usd, termine_le = now()
   WHERE statut = 'reserve' AND cree_le < now() - interval '15 minutes';

  SELECT * INTO v_plateforme FROM ia_reglages_plateforme WHERE id FOR UPDATE;

  IF NOT FOUND OR NOT v_plateforme.ia_active THEN
    v_code := 'ia_desactivee';
  ELSIF v_plateforme.modele IS NULL THEN
    v_code := 'modele_non_defini';
  END IF;

  IF v_code IS NULL THEN
    SELECT * INTO v_tarif FROM ia_tarifs
     WHERE fournisseur = v_plateforme.fournisseur AND modele = v_plateforme.modele;
    IF NOT FOUND THEN
      v_code := 'tarif_manquant';
    END IF;
  END IF;

  IF v_code IS NULL THEN
    SELECT * INTO v_boutique FROM ia_reglages_boutique WHERE store_id = p_store_id;
    IF NOT FOUND OR NOT v_boutique.ia_active THEN
      v_code := 'ia_desactivee_boutique';
    ELSIF NOT (p_fonctionnalite = ANY (v_boutique.fonctionnalites)) THEN
      v_code := 'fonctionnalite_desactivee';
    END IF;
  END IF;

  IF v_code IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', v_code);
  END IF;

  SELECT count(*) INTO v_req_minute FROM ia_consommation
   WHERE user_id = p_user_id AND cree_le > now() - interval '1 minute'
     AND statut <> 'refuse';
  IF v_req_minute >= v_plateforme.requetes_par_minute THEN
    RETURN jsonb_build_object('ok', false, 'code', 'limite_frequence');
  END IF;

  v_cout_max :=
      (GREATEST(COALESCE(p_tokens_entree_estimes, 0), 0)::numeric * v_tarif.prix_entree_par_million_usd
     + v_plateforme.max_tokens_sortie::numeric * v_tarif.prix_sortie_par_million_usd) / 1000000;

  SELECT COALESCE(sum(COALESCE(cout_estime_usd, cout_reserve_usd)), 0) INTO v_global_mois
    FROM ia_consommation WHERE cree_le >= v_debut_mois;

  SELECT COALESCE(sum(COALESCE(cout_estime_usd, cout_reserve_usd)), 0),
         count(*) FILTER (WHERE statut IN ('reserve', 'reussi'))
    INTO v_boutique_mois, v_req_mois
    FROM ia_consommation WHERE store_id = p_store_id AND cree_le >= v_debut_mois;

  IF v_global_mois + v_cout_max > v_plateforme.budget_mensuel_usd THEN
    v_code := 'budget_global_atteint';
  ELSIF v_boutique_mois + v_cout_max > v_boutique.plafond_mensuel_usd THEN
    v_code := 'plafond_boutique_atteint';
  ELSIF v_boutique.requetes_mensuelles_max IS NOT NULL AND v_req_mois >= v_boutique.requetes_mensuelles_max THEN
    v_code := 'quota_requetes_atteint';
  END IF;

  IF v_code IS NOT NULL THEN
    INSERT INTO ia_consommation (store_id, user_id, fonctionnalite, fournisseur, modele,
                                 cout_reserve_usd, cout_estime_usd, statut, code_erreur, termine_le)
    VALUES (p_store_id, p_user_id, p_fonctionnalite, v_plateforme.fournisseur, v_plateforme.modele,
            0, 0, 'refuse', v_code, now());
    RETURN jsonb_build_object('ok', false, 'code', v_code);
  END IF;

  INSERT INTO ia_consommation (store_id, user_id, fonctionnalite, fournisseur, modele,
                               cout_reserve_usd, statut)
  VALUES (p_store_id, p_user_id, p_fonctionnalite, v_plateforme.fournisseur, v_plateforme.modele,
          v_cout_max, 'reserve')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'consommation_id', v_id,
    'fournisseur', v_plateforme.fournisseur,
    'modele', v_plateforme.modele,
    'max_tokens_sortie', v_plateforme.max_tokens_sortie,
    'max_caracteres_entree', v_plateforme.max_caracteres_entree,
    'max_fichier_mo', v_plateforme.max_fichier_mo
  );
END;
$$;

-- ─── Finalisation d'un appel (fonction edge uniquement) ──────────────
-- Jetons connus → coût estimé d'après le tarif.
-- Jetons inconnus (coupure, erreur 5xx) → coût réservé, par prudence.
-- La fonction edge passe 0/0 quand le fournisseur a refusé la requête
-- avant tout traitement (erreur 4xx) : rien n'a été facturé.
CREATE OR REPLACE FUNCTION public.ia_finaliser(
  p_consommation_id  uuid,
  p_statut           text,
  p_tokens_entree    integer,
  p_tokens_sortie    integer,
  p_code_erreur      text,
  p_duree_ms         integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ligne  public.ia_consommation%ROWTYPE;
  v_tarif  public.ia_tarifs%ROWTYPE;
  v_cout   numeric;
BEGIN
  IF p_statut NOT IN ('reussi', 'echec') THEN
    RAISE EXCEPTION 'Statut de finalisation invalide' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ligne FROM ia_consommation WHERE id = p_consommation_id FOR UPDATE;
  IF NOT FOUND OR v_ligne.statut <> 'reserve' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'deja_finalisee');
  END IF;

  IF p_tokens_entree IS NULL OR p_tokens_sortie IS NULL THEN
    v_cout := v_ligne.cout_reserve_usd;
  ELSE
    SELECT * INTO v_tarif FROM ia_tarifs
     WHERE fournisseur = v_ligne.fournisseur AND modele = v_ligne.modele;
    IF FOUND THEN
      v_cout := (GREATEST(p_tokens_entree, 0)::numeric * v_tarif.prix_entree_par_million_usd
               + GREATEST(p_tokens_sortie, 0)::numeric * v_tarif.prix_sortie_par_million_usd) / 1000000;
    ELSE
      v_cout := v_ligne.cout_reserve_usd;
    END IF;
  END IF;

  UPDATE ia_consommation
     SET statut = p_statut,
         tokens_entree = p_tokens_entree,
         tokens_sortie = p_tokens_sortie,
         cout_estime_usd = v_cout,
         code_erreur = left(p_code_erreur, 80),
         duree_ms = p_duree_ms,
         termine_le = now()
   WHERE id = p_consommation_id;

  RETURN jsonb_build_object('ok', true, 'cout_estime_usd', v_cout);
END;
$$;

-- ─── Proposition d'action (fonction edge uniquement) ─────────────────
CREATE OR REPLACE FUNCTION public.ia_proposer_action(
  p_user_id          uuid,
  p_store_id         uuid,
  p_consommation_id  uuid,
  p_fonctionnalite   text,
  p_type_action      text,
  p_resume           text,
  p_charge_utile     jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO ia_actions (store_id, user_id, consommation_id, fonctionnalite, type_action, resume, charge_utile)
  VALUES (p_store_id, p_user_id, p_consommation_id, p_fonctionnalite, p_type_action,
          left(p_resume, 500), p_charge_utile)
  RETURNING id;
$$;

-- ─── Décision humaine sur une action ─────────────────────────────────
-- proposee → confirmee | rejetee ; confirmee → executee | echec.
-- Seuls l'auteur de la demande et le propriétaire de la boutique décident.
CREATE OR REPLACE FUNCTION public.ia_decider_action(
  p_action_id  uuid,
  p_decision   text,
  p_resultat   jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.ia_actions%ROWTYPE;
BEGIN
  SELECT * INTO v_action FROM ia_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action introuvable' USING ERRCODE = 'P0002';
  END IF;
  -- COALESCE : une action dont l'auteur a disparu (user_id NULL) ne doit
  -- pas laisser passer n'importe qui par un NULL.
  IF NOT (COALESCE(v_action.user_id = auth.uid(), false) OR public.is_store_owner(v_action.store_id)) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF NOT public.boutique_ouverte_a(v_action.store_id) THEN
    RAISE EXCEPTION 'Boutique verrouillée' USING ERRCODE = '42501';
  END IF;
  IF NOT (
       (v_action.statut = 'proposee'  AND p_decision IN ('confirmee', 'rejetee'))
    OR (v_action.statut = 'confirmee' AND p_decision IN ('executee', 'echec'))
  ) THEN
    RAISE EXCEPTION 'Transition interdite : % → %', v_action.statut, p_decision USING ERRCODE = '22023';
  END IF;

  UPDATE ia_actions
     SET statut = p_decision,
         resultat = COALESCE(p_resultat, resultat),
         decide_par = auth.uid(),
         decide_le = now()
   WHERE id = p_action_id;
END;
$$;

-- ─── État de l'IA pour une boutique (tout membre) ────────────────────
-- Les montants ne sont rendus qu'au propriétaire et au super admin ; les
-- autres membres voient seulement la part utilisée.
CREATE OR REPLACE FUNCTION public.ia_etat_boutique(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plateforme  public.ia_reglages_plateforme%ROWTYPE;
  v_boutique    public.ia_reglages_boutique%ROWTYPE;
  v_cout_mois   numeric := 0;
  v_req_mois    integer := 0;
  v_voit_couts  boolean;
  v_tarif_ok    boolean := false;
BEGIN
  IF NOT (public.est_dans_la_boutique(p_store_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  v_voit_couts := public.is_store_owner(p_store_id) OR public.is_platform_admin();

  SELECT * INTO v_plateforme FROM ia_reglages_plateforme WHERE id;
  SELECT * INTO v_boutique FROM ia_reglages_boutique WHERE store_id = p_store_id;

  IF v_plateforme.modele IS NOT NULL THEN
    v_tarif_ok := EXISTS (SELECT 1 FROM ia_tarifs
                           WHERE fournisseur = v_plateforme.fournisseur AND modele = v_plateforme.modele);
  END IF;

  SELECT COALESCE(sum(COALESCE(cout_estime_usd, cout_reserve_usd)), 0),
         count(*) FILTER (WHERE statut IN ('reserve', 'reussi'))
    INTO v_cout_mois, v_req_mois
    FROM ia_consommation
   WHERE store_id = p_store_id AND cree_le >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'plateforme_active', COALESCE(v_plateforme.ia_active, false),
    'modele_defini', v_plateforme.modele IS NOT NULL AND v_tarif_ok,
    'boutique_active', COALESCE(v_boutique.ia_active, false),
    'fonctionnalites', COALESCE(to_jsonb(v_boutique.fonctionnalites), '[]'::jsonb),
    'requetes_mois', v_req_mois,
    'requetes_mensuelles_max', v_boutique.requetes_mensuelles_max,
    'part_utilisee_pct',
      CASE WHEN COALESCE(v_boutique.plafond_mensuel_usd, 0) > 0
           THEN round(least(v_cout_mois / v_boutique.plafond_mensuel_usd * 100, 100), 1)
           ELSE NULL END,
    'cout_mois_usd', CASE WHEN v_voit_couts THEN round(v_cout_mois, 4) ELSE NULL END,
    'plafond_mensuel_usd', CASE WHEN v_voit_couts THEN v_boutique.plafond_mensuel_usd ELSE NULL END
  );
END;
$$;

-- ─── Tableau de bord du super admin ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_tableau_de_bord(p_mois date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debut  timestamptz := date_trunc('month', COALESCE(p_mois::timestamptz, now()));
  v_fin    timestamptz := date_trunc('month', COALESCE(p_mois::timestamptz, now())) + interval '1 month';
  v_res    jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  WITH c AS (
    SELECT * FROM ia_consommation WHERE cree_le >= v_debut AND cree_le < v_fin
  )
  SELECT jsonb_build_object(
    'debut', v_debut,
    'reglages', (SELECT to_jsonb(r) - 'id' FROM ia_reglages_plateforme r WHERE r.id),
    'totaux', (SELECT jsonb_build_object(
                 'requetes', count(*) FILTER (WHERE statut IN ('reussi', 'echec', 'reserve')),
                 'reussies', count(*) FILTER (WHERE statut = 'reussi'),
                 'echecs', count(*) FILTER (WHERE statut = 'echec'),
                 'refus', count(*) FILTER (WHERE statut = 'refuse'),
                 'en_cours', count(*) FILTER (WHERE statut = 'reserve'),
                 'tokens_entree', COALESCE(sum(tokens_entree), 0),
                 'tokens_sortie', COALESCE(sum(tokens_sortie), 0),
                 'cout_estime_usd', round(COALESCE(sum(COALESCE(cout_estime_usd, cout_reserve_usd)), 0), 4)
               ) FROM c),
    'par_boutique', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'cout_estime_usd')::numeric DESC)
        FROM (
          SELECT jsonb_build_object(
                   'store_id', c.store_id,
                   'nom', s.name,
                   'requetes', count(*) FILTER (WHERE c.statut <> 'refuse'),
                   'refus', count(*) FILTER (WHERE c.statut = 'refuse'),
                   'cout_estime_usd', round(COALESCE(sum(COALESCE(c.cout_estime_usd, c.cout_reserve_usd)), 0), 4),
                   'plafond_mensuel_usd', rb.plafond_mensuel_usd
                 ) AS x
            FROM c
            LEFT JOIN stores s ON s.id = c.store_id
            LEFT JOIN ia_reglages_boutique rb ON rb.store_id = c.store_id
           GROUP BY c.store_id, s.name, rb.plafond_mensuel_usd
        ) t), '[]'::jsonb),
    'par_fonctionnalite', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'fonctionnalite', fonctionnalite,
               'requetes', n,
               'cout_estime_usd', cout) ORDER BY cout DESC)
        FROM (SELECT fonctionnalite, count(*) FILTER (WHERE statut <> 'refuse') n,
                     round(COALESCE(sum(COALESCE(cout_estime_usd, cout_reserve_usd)), 0), 4) cout
                FROM c GROUP BY fonctionnalite) t), '[]'::jsonb),
    'erreurs_recentes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'date', cree_le, 'store_id', store_id, 'fonctionnalite', fonctionnalite,
               'statut', statut, 'code', code_erreur) ORDER BY cree_le DESC)
        FROM (SELECT * FROM c WHERE statut IN ('echec', 'refuse')
               ORDER BY cree_le DESC LIMIT 30) e), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- ─── Purge des contenus anciens des actions ──────────────────────────
-- Garde la trace (qui, quoi, quand, statut) mais efface les données
-- extraites au-delà de la durée choisie. À planifier si souhaité.
CREATE OR REPLACE FUNCTION public.ia_purger_contenus(p_jours integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  UPDATE ia_actions
     SET charge_utile = NULL, resultat = NULL
   WHERE cree_le < now() - make_interval(days => GREATEST(p_jours, 1))
     AND (charge_utile IS NOT NULL OR resultat IS NOT NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ─── Droits d'exécution ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.ia_fonctionnalites_connues() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ia_reserver(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ia_finaliser(uuid, text, integer, integer, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ia_proposer_action(uuid, uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ia_decider_action(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ia_etat_boutique(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ia_tableau_de_bord(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ia_purger_contenus(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ia_fonctionnalites_connues() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ia_reserver(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ia_finaliser(uuid, text, integer, integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ia_proposer_action(uuid, uuid, uuid, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ia_decider_action(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_etat_boutique(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_tableau_de_bord(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_purger_contenus(integer) TO authenticated, service_role;

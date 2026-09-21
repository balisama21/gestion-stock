-- ═══════════════════════════════════════════════════════════════════
-- LA PRÉALERTE DE STOCK — L'E-MAIL SE RÈGLE PERSONNE PAR PERSONNE
-- ═══════════════════════════════════════════════════════════════════
--
-- ── Ce qui change, et pourquoi ──
--
-- L'e-mail était un réglage de BOUTIQUE : une case dans les paramètres
-- du propriétaire, et un seul destinataire possible, lui-même. Deux
-- défauts.
--
-- Le premier : un gérant, un responsable d'achats, un comptable ne
-- pouvaient pas recevoir la liste, alors que ce sont souvent eux qui
-- commandent. Le second : le propriétaire décidait pour les autres, ce
-- qui n'a pas de sens pour un message qui arrive dans une boîte
-- personnelle.
--
-- Recevoir ou non un e-mail est une décision de celui qui le reçoit.
-- Chacun s'inscrit donc pour lui-même, et PERSONNE N'EST INSCRIT AU
-- DÉPART : une ligne absente veut dire « pas d'e-mail », comme une
-- ligne absente de `reglages_alertes_stock` veut dire « préalerte
-- éteinte ».
--
-- ── Les canaux déménagent avec l'abonnement ──
--
-- `reglages_alertes_stock.canaux` disait quels canaux la BOUTIQUE
-- employait. La colonne part et sa contrainte la suit, sur la ligne
-- d'abonnement : le jour où WhatsApp existera, c'est chacun qui dira
-- s'il préfère l'e-mail, WhatsApp, ou les deux — et c'est bien la
-- bonne personne pour en décider.
--
-- Aucune donnée perdue : la table ne compte aucune ligne, la
-- fonctionnalité n'ayant été activée par personne à ce jour. Vérifié
-- avant d'écrire cette migration.
--
-- ── Ce qui ne change pas ──
--
-- Le mode, la valeur, la fréquence et l'heure restent des réglages de
-- BOUTIQUE, chez le propriétaire : ils décrivent le stock du magasin,
-- pas la boîte aux lettres de quelqu'un. La notification dans
-- l'application n'a pas d'abonnement non plus — elle s'affiche là où
-- l'on travaille déjà, et chacun la voit en ouvrant sa cloche.

-- ───────────────────────────────────────────────────────────────────
-- 1. Qui veut recevoir la liste
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.abonnements_alertes_stock (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Reprise telle quelle de l'ancienne colonne de boutique, y compris
  -- sa contrainte : « whatsapp » est DÉJÀ autorisé, et l'ajouter ne
  -- demandera pas de migration.
  canaux   text[] NOT NULL DEFAULT ARRAY['email']::text[]
                  CHECK (canaux <@ ARRAY['email', 'whatsapp']::text[]),

  cree_le  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (store_id, user_id)
);

COMMENT ON TABLE public.abonnements_alertes_stock IS
  'Qui recoit le resume de prealerte, et par quel canal. Pas de ligne = pas d e-mail : c est le defaut, pour tout le monde.';

-- Le travail horaire demande « cette boutique a-t-elle un abonné ? ».
CREATE INDEX IF NOT EXISTS abonnements_alertes_stock_boutique
  ON public.abonnements_alertes_stock (store_id);

ALTER TABLE public.abonnements_alertes_stock ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────
-- 2. Chacun ne voit et ne règle QUE le sien
-- ───────────────────────────────────────────────────────────────────
--
-- Pas même le propriétaire : savoir qui a coché de recevoir un e-mail
-- ne regarde personne d'autre, et il n'a aucune décision à prendre
-- là-dessus. C'est le même raisonnement que pour les rappels, dont la
-- politique de lecture est déjà la plus stricte des trois tables
-- d'organisation.
--
-- LE VERROU passe par `store_is_locked` et non par
-- `proprietaire_dune_boutique_ouverte` : ici l'écrivain n'est PAS le
-- propriétaire, c'est le membre lui-même. La garde reconnue par
-- `policies_sans_verrou()` reste satisfaite.

DROP POLICY IF EXISTS "Chacun lit son abonnement aux alertes" ON public.abonnements_alertes_stock;
CREATE POLICY "Chacun lit son abonnement aux alertes"
  ON public.abonnements_alertes_stock FOR SELECT
  USING (user_id = (SELECT auth.uid()) AND public.is_store_member(store_id));

DROP POLICY IF EXISTS "Chacun s abonne aux alertes" ON public.abonnements_alertes_stock;
CREATE POLICY "Chacun s abonne aux alertes"
  ON public.abonnements_alertes_stock FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_store_member(store_id)
    AND NOT public.store_is_locked(store_id)
  );

DROP POLICY IF EXISTS "Chacun modifie son abonnement aux alertes" ON public.abonnements_alertes_stock;
CREATE POLICY "Chacun modifie son abonnement aux alertes"
  ON public.abonnements_alertes_stock FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    AND public.is_store_member(store_id)
    AND NOT public.store_is_locked(store_id)
  )
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_store_member(store_id));

-- Se désabonner supprime la ligne : l'absence EST l'état.
--
-- SANS GARDE DE VERROU, ET C'EST VOULU. Retenir quelqu'un dans une
-- liste de diffusion parce que la boutique n'est plus payée serait un
-- piège — la même raison qui laisse supprimer une boutique qu'on ne
-- paie plus. L'exception est donc déclarée dans
-- `policies_sans_verrou()` plus bas, à côté des autres, plutôt que
-- maquillée par une condition toujours vraie.
DROP POLICY IF EXISTS "Chacun se desabonne des alertes" ON public.abonnements_alertes_stock;
CREATE POLICY "Chacun se desabonne des alertes"
  ON public.abonnements_alertes_stock FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ───────────────────────────────────────────────────────────────────
-- 3. Le contrôle du verrou connaît une exception de plus
-- ───────────────────────────────────────────────────────────────────
--
-- Une seule ligne ajoutée à la liste des exceptions voulues, avec sa
-- raison. Le contrôle doit continuer de rendre ZÉRO ligne — c'est ce
-- qui l'empêche de devenir un contrôle qu'on ignore.

CREATE OR REPLACE FUNCTION public.policies_sans_verrou()
RETURNS TABLE(nom_table text, policy text, commande text)
LANGUAGE sql
STABLE
AS $function$
  SELECT tablename::text, policyname::text, cmd::text
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
    AND coalesce(qual,'') || ' ' || coalesce(with_check,'')
        !~ 'store_allows_write|can_modify_in_store|store_is_locked|boutique_ouverte_a|proprietaire_dune_boutique_ouverte'
    -- Tables de COMPTE, hors du perimetre d une boutique : elles n ont
    -- rien a verrouiller quand une boutique expire.
    AND tablename NOT IN ('profiles','access_codes','password_recovery_requests','activations_de_compte')
    -- Deux exceptions voulues : on doit pouvoir CREER une boutique, et
    -- se debarrasser d une boutique qu on ne paie plus.
    AND NOT (tablename = 'stores' AND cmd IN ('INSERT','DELETE'))
    -- Troisieme : se DESABONNER d une liste de diffusion. Y retenir
    -- quelqu un parce que la boutique n est plus payee serait un piege,
    -- exactement comme l enfermer dans une boutique qu il ne paie plus.
    AND NOT (tablename = 'abonnements_alertes_stock' AND cmd = 'DELETE')
  ORDER BY tablename, cmd, policyname;
$function$;

-- ───────────────────────────────────────────────────────────────────
-- 4. L'ancienne colonne de boutique s'en va
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.reglages_alertes_stock DROP COLUMN IF EXISTS canaux;

-- ───────────────────────────────────────────────────────────────────
-- 5. Le travail horaire sert les boutiques qui ont un abonné
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.demander_les_resumes_par_email()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url    text;
  v_jeton  text;
  v_appli  text;
  v_store  uuid;
  v_appels integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'prealerte_fonction_url';
  SELECT decrypted_secret INTO v_jeton
    FROM vault.decrypted_secrets WHERE name = 'prealerte_cle_appel';
  SELECT decrypted_secret INTO v_appli
    FROM vault.decrypted_secrets WHERE name = 'prealerte_adresse_application';

  IF v_url IS NULL OR v_jeton IS NULL THEN
    RAISE WARNING 'Prealerte : adresse ou jeton absent du coffre, aucun e-mail demande.';
    RETURN 0;
  END IF;

  FOR v_store IN
    SELECT DISTINCT a.store_id
      FROM public.prealertes_a_annoncer a
      JOIN public.reglages_alertes_stock r ON r.store_id = a.store_id
     WHERE a.notifiee_le IS NOT NULL
       AND a.email_le IS NULL
       AND r.prealerte_active
       -- Au moins une personne l'a demandé. Sans abonné, rien ne part.
       AND EXISTS (
         SELECT 1 FROM public.abonnements_alertes_stock b
          WHERE b.store_id = a.store_id AND 'email' = ANY (b.canaux)
       )
  LOOP
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_jeton
                 ),
      body    := jsonb_build_object('store_id', v_store, 'app_url', v_appli)
    );
    v_appels := v_appels + 1;
  END LOOP;

  RETURN v_appels;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.demander_les_resumes_par_email()
  FROM PUBLIC, anon, authenticated, service_role;

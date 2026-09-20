-- LE VERROU SE REFERME PARTOUT, ET UN CONTROLE VEILLE A CE QU IL Y RESTE
--
-- `enforce_store_lock_in_rls` avait pose le verrou en corrigeant les
-- clauses `USING` — lecture, modification, suppression — et avait
-- oublie la plupart des `WITH CHECK`, c est-a-dire les CREATIONS. Sur
-- une boutique expiree on pouvait donc encore ajouter une categorie,
-- une photo de produit, un fournisseur, un prestataire, une prestation,
-- un reglement fournisseur, un champ personnalise, un collaborateur,
-- une invitation, un participant a un evenement — et modifier ou
-- supprimer les salaires.
--
-- Douze tables, un seul motif. Le vocabulaire existait deja
-- (`store_allows_write`, `can_modify_in_store`, `boutique_ouverte_a`) :
-- il manquait son equivalent pour le proprietaire, et l usage.
--
-- POURQUOI UN CONTROLE EN PLUS DES CORRECTIONS. Ce trou s est ouvert
-- une fois par oubli, il se rouvrira de la meme facon a la prochaine
-- table. `policies_sans_verrou()` liste toute policy d ecriture qui ne
-- passe par aucun controle de verrou : elle doit rendre zero ligne.
-- C est le genre de chose qu on verifie en une requete ou jamais.
--
-- Verifie en transaction annulee, role par role : creation refusee sur
-- une boutique fermee pour categorie, fournisseur, collaborateur et
-- champ personnalise ; toujours acceptee sur une boutique ouverte ;
-- et `policies_sans_verrou()` a zero.

-- ── le mot qui manquait : le proprietaire d une boutique OUVERTE ──
CREATE OR REPLACE FUNCTION public.proprietaire_dune_boutique_ouverte(p_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$ SELECT public.is_store_owner(p_store_id) AND NOT public.store_is_locked(p_store_id); $fn$;

COMMENT ON FUNCTION public.proprietaire_dune_boutique_ouverte(uuid) IS
  'is_store_owner + le verrou. Pendant de store_allows_write pour ce qui est reserve au proprietaire.';

-- ── les six creations qui passaient par `is_store_member` ──
DROP POLICY IF EXISTS categories_insert ON public.categories;
CREATE POLICY categories_insert ON public.categories FOR INSERT
  WITH CHECK (public.store_allows_write(store_id) AND (SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS product_images_insert ON public.product_images;
CREATE POLICY product_images_insert ON public.product_images FOR INSERT
  WITH CHECK (public.store_allows_write(store_id) AND (SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS providers_insert ON public.providers;
CREATE POLICY providers_insert ON public.providers FOR INSERT
  WITH CHECK (public.store_allows_write(store_id) AND (SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS provider_services_insert ON public.provider_services;
CREATE POLICY provider_services_insert ON public.provider_services FOR INSERT
  WITH CHECK (public.store_allows_write(store_id) AND (SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT
  WITH CHECK (public.store_allows_write(store_id) AND (SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS supplier_payments_insert ON public.supplier_payments;
CREATE POLICY supplier_payments_insert ON public.supplier_payments FOR INSERT
  WITH CHECK (public.store_allows_write(store_id) AND (SELECT auth.uid()) = recorded_by);

-- ── les champs personnalises, reserves au proprietaire ──
DROP POLICY IF EXISTS custom_field_definitions_insert ON public.custom_field_definitions;
CREATE POLICY custom_field_definitions_insert ON public.custom_field_definitions FOR INSERT
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));
DROP POLICY IF EXISTS custom_field_definitions_update ON public.custom_field_definitions;
CREATE POLICY custom_field_definitions_update ON public.custom_field_definitions FOR UPDATE
  USING (public.proprietaire_dune_boutique_ouverte(store_id))
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));
DROP POLICY IF EXISTS custom_field_definitions_delete ON public.custom_field_definitions;
CREATE POLICY custom_field_definitions_delete ON public.custom_field_definitions FOR DELETE
  USING (public.proprietaire_dune_boutique_ouverte(store_id));

-- ── l equipe : on n agrandit pas une boutique qu on ne paie plus ──
-- `accept_invitation_by_code` est SECURITY DEFINER : un invite deja
-- convie peut toujours rejoindre, c est la RPC qui ecrit.
DROP POLICY IF EXISTS store_members_insert ON public.store_members;
CREATE POLICY store_members_insert ON public.store_members FOR INSERT
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));
DROP POLICY IF EXISTS store_members_update ON public.store_members;
CREATE POLICY store_members_update ON public.store_members FOR UPDATE
  USING (public.proprietaire_dune_boutique_ouverte(store_id))
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));
DROP POLICY IF EXISTS store_members_delete ON public.store_members;
CREATE POLICY store_members_delete ON public.store_members FOR DELETE
  USING (public.proprietaire_dune_boutique_ouverte(store_id));

-- ── les invitations : la policy `ALL` portait AUSSI la lecture ──
-- Meme piege que sur `stores` : la verrouiller en bloc aurait rendu les
-- invitations invisibles a celui qui les a envoyees.
DROP POLICY IF EXISTS "Store owner can manage invitations" ON public.collaborator_invitations;
CREATE POLICY "Le proprietaire lit ses invitations" ON public.collaborator_invitations FOR SELECT
  USING (public.is_store_owner(store_id));
CREATE POLICY "Le proprietaire invite" ON public.collaborator_invitations FOR INSERT
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));
CREATE POLICY "Le proprietaire modifie ses invitations" ON public.collaborator_invitations FOR UPDATE
  USING (public.proprietaire_dune_boutique_ouverte(store_id))
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));
CREATE POLICY "Le proprietaire annule ses invitations" ON public.collaborator_invitations FOR DELETE
  USING (public.proprietaire_dune_boutique_ouverte(store_id));

-- ── les participants d un evenement, par la boutique de l evenement ──
DROP POLICY IF EXISTS participants_ecriture ON public.evenement_participants;
CREATE POLICY participants_ecriture ON public.evenement_participants FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.evenements e
    WHERE e.id = evenement_participants.evenement_id
      AND e.createur_id = (SELECT auth.uid())
      AND public.boutique_ouverte_a(e.store_id)));
DROP POLICY IF EXISTS participants_retrait ON public.evenement_participants;
CREATE POLICY participants_retrait ON public.evenement_participants FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.evenements e
    WHERE e.id = evenement_participants.evenement_id
      AND e.createur_id = (SELECT auth.uid())
      AND public.boutique_ouverte_a(e.store_id)));

-- ── salaires : la creation etait deja verrouillee, pas le reste ──
-- `peut_gerer_les_salaires` reste une question de DROIT, pas d etat de
-- la boutique : le verrou se lit a cote, comme le fait deja
-- `salaires_creation`.
DROP POLICY IF EXISTS salaires_modification ON public.salaires;
CREATE POLICY salaires_modification ON public.salaires FOR UPDATE
  USING ((NOT public.store_is_locked(store_id)) AND public.peut_gerer_les_salaires(store_id))
  WITH CHECK ((NOT public.store_is_locked(store_id)) AND public.peut_gerer_les_salaires(store_id));
DROP POLICY IF EXISTS salaires_suppression ON public.salaires;
CREATE POLICY salaires_suppression ON public.salaires FOR DELETE
  USING ((NOT public.store_is_locked(store_id)) AND public.peut_gerer_les_salaires(store_id));

DROP POLICY IF EXISTS paiements_salaire_modification ON public.paiements_salaire;
CREATE POLICY paiements_salaire_modification ON public.paiements_salaire FOR UPDATE
  USING ((NOT public.store_is_locked(store_id))
         AND (public.peut_gerer_les_salaires(store_id)
              OR (user_id = (SELECT auth.uid()) AND statut = 'en_attente')))
  WITH CHECK ((NOT public.store_is_locked(store_id))
         AND (public.peut_gerer_les_salaires(store_id)
              OR (user_id = (SELECT auth.uid()) AND statut = 'annulee')));
DROP POLICY IF EXISTS paiements_salaire_suppression ON public.paiements_salaire;
CREATE POLICY paiements_salaire_suppression ON public.paiements_salaire FOR DELETE
  USING ((NOT public.store_is_locked(store_id)) AND public.peut_gerer_les_salaires(store_id));

-- ── le controle, pour que ca ne se rouvre pas ──
CREATE OR REPLACE FUNCTION public.policies_sans_verrou()
RETURNS TABLE (nom_table text, policy text, commande text)
LANGUAGE sql STABLE
AS $fn$
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
  ORDER BY tablename, cmd, policyname;
$fn$;

COMMENT ON FUNCTION public.policies_sans_verrou() IS
  'Controle de non-regression : toute policy d ecriture qui ne passe par aucun controle de verrou. Doit rendre zero ligne.';

REVOKE ALL ON FUNCTION public.policies_sans_verrou() FROM public;
REVOKE ALL ON FUNCTION public.policies_sans_verrou() FROM anon;
REVOKE ALL ON FUNCTION public.policies_sans_verrou() FROM authenticated;

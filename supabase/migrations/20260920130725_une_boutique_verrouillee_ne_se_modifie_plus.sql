-- UNE BOUTIQUE VERROUILLEE NE SE MODIFIE PLUS
--
-- La migration `enforce_store_lock_in_rls` avait pose le verrou sur les
-- tables de donnees, par `store_allows_write` et `can_modify_in_store`.
-- La table `stores` elle-meme y avait echappe : la fiche de la boutique
-- — nom, logo, adresse, TVA, pied de recu, capital initial, seuil
-- d alerte — restait modifiable par son proprietaire ET par n importe
-- quel collaborateur pendant que tout le reste etait ferme.
--
-- DEUX POLICIES PERMISSIVES S ADDITIONNENT. Il ne suffisait pas de
-- corriger « Members can update store » : « Store owner can manage
-- store » aurait continue d ouvrir ce que l autre fermait.
--
-- LE PIEGE A EVITER : cette seconde policy est en `ALL`, donc elle
-- porte AUSSI la lecture. Y ajouter le verrou aurait rendu la boutique
-- invisible a son proprietaire — impossible a nommer sur l ecran
-- d activation, et impossible a deverrouiller. Elle est donc eclatee
-- par commande, et seule la modification s arrete au verrou.
--
-- LA SUPPRESSION RESTE OUVERTE. On doit pouvoir se debarrasser d une
-- boutique qu on ne paie plus ; l y enfermer serait un piege.
--
-- LE DEVERROUILLAGE N EST PAS CONCERNE. Les cinq fonctions qui ecrivent
-- dans `stores` — activer_le_compte, copy_store, ensure_owner_store,
-- redeem_access_code, transferer_boutique — sont toutes SECURITY
-- DEFINER et appartiennent a postgres : elles passent outre les RLS.
--
-- COTE INTERFACE, un refus de RLS sur un UPDATE est SILENCIEUX : la
-- ligne devient invisible et PostgREST repond « aucune ligne » plutot
-- qu une raison. `useWorkspace.updateStore` verifie donc le verrou
-- avant de partir, pour dire pourquoi. Ce n est pas la barriere, elle
-- reste ici.
--
-- Verifie en transaction annulee, sur les vraies donnees, en se faisant
-- passer pour chaque role :
--   1 proprietaire lit sa boutique verrouillee ....... 1 ligne
--   2 proprietaire la modifie ........................ 0 ligne
--   3 proprietaire modifie une boutique ouverte ...... 1 ligne
--   4 collaborateur modifie une boutique ouverte ..... 1 ligne
--   5 collaborateur modifie une boutique verrouillee . 0 ligne
--   6 creer une boutique ............................. 1 ligne
--   7 activer le compte ouvre encore tout ............ 0 fermee

DROP POLICY IF EXISTS "Store owner can manage store" ON public.stores;

CREATE POLICY "Le proprietaire lit sa boutique"
  ON public.stores FOR SELECT
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "Le proprietaire cree sa boutique"
  ON public.stores FOR INSERT
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "Le proprietaire supprime sa boutique"
  ON public.stores FOR DELETE
  USING (owner_id = (SELECT auth.uid()));

-- `is_store_member` couvre deja le proprietaire ET les collaborateurs :
-- une seule policy de modification suffit la ou il y en avait deux.
DROP POLICY IF EXISTS "Members can update store" ON public.stores;

CREATE POLICY "La boutique ouverte se modifie"
  ON public.stores FOR UPDATE
  USING (public.is_store_member(id) AND NOT public.store_is_locked(id))
  WITH CHECK (public.is_store_member(id));

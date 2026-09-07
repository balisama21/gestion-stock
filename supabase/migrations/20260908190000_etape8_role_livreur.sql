-- ═══════════════════════════════════════════════════════════════════
-- Étape 8b — le rôle « livreur », et son isolement réel
--
-- LE PROBLÈME
--
-- Jusqu'ici, appartenir à une boutique donnait tout : `is_store_member`
-- ouvrait la lecture des ventes, des prix d'achat, de la trésorerie, des
-- clients. Les permissions par module ne masquent que dans l'écran — la
-- base, elle, laissait passer. Pour un collaborateur salarié, c'est un
-- choix défendable. Pour un livreur, souvent extérieur et payé à la
-- course, il ne l'est pas : il pourrait lire le chiffre d'affaires.
--
-- LE CHOIX : RESSERRER LE POINT DE PASSAGE, PLUTÔT QUE TRENTE RÈGLES
--
-- Trente-deux règles sur vingt-trois tables appellent `is_store_member`.
-- Les reprendre une à une, c'est en oublier une — et celle qu'on oublie
-- est précisément le trou. On resserre donc la fonction elle-même : elle
-- veut dire désormais « membre du PERSONNEL de la boutique », le livreur
-- exclu. Tout se ferme d'un coup, y compris les règles que je n'ai pas
-- pensées et celles qu'on écrira demain.
--
-- Ce qu'un livreur doit malgré tout atteindre — sa boutique, pour en
-- connaître le nom — passe par `est_dans_la_boutique`, qui garde
-- l'ancien sens : « appartient, à quelque titre que ce soit ».
--
-- Aujourd'hui ce resserrement ne change rien : la seule équipe existante
-- compte un membre, de rôle « vendeur ». Il devient protecteur au moment
-- où un livreur est invité.
--
-- LE LIVREUR N'ÉCRIT PAS DIRECTEMENT
--
-- Une règle de ligne ne sait pas restreindre des COLONNES : ouvrir la
-- modification de ses livraisons lui permettrait de changer le montant à
-- encaisser ou de se réassigner la course d'un autre. Sa seule porte est
-- donc `avancer_livraison`, qui vérifie que la course est bien la sienne
-- et n'accepte que les changements qui le regardent.
--
-- LE PIÈGE QUE LA VÉRIFICATION A ATTRAPÉ
--
-- La garde s'écrivait d'abord ainsi :
--
--   IF NOT (v.livreur_id = auth.uid() OR is_store_member(...)) THEN
--
-- Sur une livraison NON assignée, `livreur_id` est NULL : la comparaison
-- rend NULL — ni vrai ni faux —, `NOT (NULL OR faux)` rend NULL, et un
-- `IF` sur NULL ne s'exécute pas. Le refus était donc sauté, et
-- n'importe quel livreur pouvait s'emparer d'une course libre. D'où
-- `IS DISTINCT FROM`, qui ne connaît pas cette zone grise.
--
-- CE QUE LE LIVREUR VOIT DE LA MARCHANDISE
--
-- La colonne `contenu` porte la liste de ce qu'il transporte —
-- désignation et quantité, SANS les prix. Il a besoin de savoir ce qu'il
-- remet et combien encaisser ; ce que la boutique a payé le produit ne
-- le regarde pas. C'est une recopie, comme l'adresse : un bon de
-- livraison dit ce qui a été remis ce jour-là, il ne suit pas les
-- corrections faites au catalogue ensuite.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS contenu jsonb NOT NULL DEFAULT '[]'::jsonb;

-- « Appartient à la boutique, à quelque titre que ce soit. » C'est
-- l'ancien sens de `is_store_member`, conservé pour le peu qui doit
-- rester ouvert au livreur.
CREATE OR REPLACE FUNCTION public.est_dans_la_boutique(p_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM store_members WHERE store_id = p_store_id AND user_id = auth.uid()
  );
$function$;

-- « Fait partie du personnel de la boutique. » Le propriétaire, et les
-- membres dont le rôle n'est pas « livreur ».
CREATE OR REPLACE FUNCTION public.is_store_member(p_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM store_members
     WHERE store_id = p_store_id AND user_id = auth.uid()
       AND role IS DISTINCT FROM 'livreur'
  );
$function$;

-- Le livreur doit pouvoir lire la boutique à laquelle il livre : c'est
-- par là que l'application sait où il travaille et sous quel nom.
DROP POLICY IF EXISTS "Members can view store" ON stores;
CREATE POLICY "Members can view store" ON stores FOR SELECT
  USING (est_dans_la_boutique(id));

DROP POLICY IF EXISTS "Store members can view store" ON stores;
CREATE POLICY "Store members can view store" ON stores FOR SELECT
  USING (est_dans_la_boutique(id));

-- Le personnel voit toutes les livraisons ; le livreur, les siennes.
DROP POLICY IF EXISTS "deliveries_select" ON deliveries;
CREATE POLICY "deliveries_select" ON deliveries FOR SELECT
  USING (is_store_member(store_id) OR livreur_id = auth.uid());

-- La seule porte par laquelle un livreur écrit.
CREATE OR REPLACE FUNCTION public.avancer_livraison(
  p_delivery_id uuid,
  p_statut text,
  p_montant_encaisse numeric DEFAULT NULL,
  p_motif_echec text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v deliveries%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;

  SELECT * INTO v FROM deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Livraison introuvable.'; END IF;

  -- `IS DISTINCT FROM`, et non `<>` : sur une livraison non assignée,
  -- `livreur_id` est NULL, et une comparaison ordinaire rendrait NULL —
  -- ni vrai ni faux —, si bien que le refus ne s'exécutait pas.
  IF v.livreur_id IS DISTINCT FROM auth.uid() AND NOT is_store_member(v.store_id) THEN
    RAISE EXCEPTION 'Cette livraison ne vous est pas confiée.';
  END IF;

  IF p_statut NOT IN ('en_cours', 'livree', 'echouee') THEN
    RAISE EXCEPTION 'Statut inconnu : %.', p_statut;
  END IF;
  IF v.statut IN ('livree', 'annulee') THEN
    RAISE EXCEPTION 'Cette livraison est terminée : son statut ne change plus.';
  END IF;
  IF p_statut = 'echouee' AND COALESCE(btrim(p_motif_echec), '') = '' THEN
    RAISE EXCEPTION 'Dites pourquoi la livraison n''a pas pu être faite.';
  END IF;
  IF COALESCE(p_montant_encaisse, 0) < 0 THEN
    RAISE EXCEPTION 'Le montant encaissé ne peut pas être négatif.';
  END IF;
  IF COALESCE(p_montant_encaisse, 0) > v.montant_a_encaisser THEN
    RAISE EXCEPTION 'Le montant encaissé (%) dépasse ce qui était à encaisser (%).',
      p_montant_encaisse, v.montant_a_encaisser;
  END IF;

  UPDATE deliveries
  SET statut = p_statut,
      montant_encaisse = CASE WHEN p_statut = 'livree'
                              THEN COALESCE(p_montant_encaisse, montant_a_encaisser)
                              ELSE montant_encaisse END,
      motif_echec = CASE WHEN p_statut = 'echouee' THEN p_motif_echec ELSE motif_echec END
  WHERE id = p_delivery_id;

  RETURN (SELECT to_jsonb(d) FROM deliveries d WHERE d.id = p_delivery_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.avancer_livraison(uuid, text, numeric, text) TO authenticated;

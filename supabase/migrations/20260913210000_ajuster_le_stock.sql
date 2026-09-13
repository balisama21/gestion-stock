-- Corriger le stock d'un produit à la main.
--
-- ── Pourquoi ce n'était pas possible ──
--
-- `update_product` prend la désignation, les prix, le fournisseur et le
-- seuil — mais PAS le stock, et ce n'était pas un oubli : le stock n'est
-- pas une propriété du produit, c'est le solde d'un journal. Chaque
-- vente, chaque achat, chaque livraison écrit sa ligne dans
-- `stock_movements` et déplace `stock_actuel` du même pas. Laisser
-- réécrire la colonne directement ferait diverger les deux : le chiffre
-- dirait 12, l'addition des mouvements dirait 9, et plus rien ne
-- permettrait de savoir lequel a tort.
--
-- Il manquait donc simplement la porte : un mouvement d'AJUSTEMENT, qui
-- est un type que le journal connaît déjà — c'est lui qui enregistre le
-- stock initial à la création d'un produit.
--
-- ── Ce que la fonction garantit ──
--
-- Les deux écritures sont dans la même transaction : on ne peut pas
-- obtenir un stock modifié sans sa ligne de journal, ni l'inverse.
--
-- Les refus sont dits en français avant que la contrainte ne parle. La
-- base interdit déjà `stock_actuel >= 0` et `stock_reserve <=
-- stock_actuel` ; sans ces messages, retirer trop d'unités renverrait
-- une violation de contrainte que personne ne peut lire.
--
-- Le stock RÉSERVÉ est le garde le moins évident : trois articles promis
-- à une commande en cours ne peuvent pas être retirés de l'inventaire,
-- même s'ils sont encore physiquement là. Les retirer ferait promettre
-- à un client une marchandise qui n'existe plus.
--
-- ── Qui a le droit ──
--
-- Exactement les mêmes que pour modifier le produit lui-même :
-- `can_modify_in_store`, c'est-à-dire l'auteur de la fiche ou le
-- propriétaire de la boutique, et seulement si la boutique n'est pas
-- verrouillée. Ajuster un stock n'est pas un geste plus anodin que
-- corriger un prix.

CREATE OR REPLACE FUNCTION public.ajuster_stock(
  p_product_id uuid,
  p_delta integer,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_produit products%ROWTYPE;
  v_nouveau integer;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Indiquez une quantite a ajouter ou a retirer.';
  END IF;

  SELECT * INTO v_produit FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;

  IF store_is_locked(v_produit.store_id) THEN
    RAISE EXCEPTION 'Boutique verrouillee : aucune ecriture possible.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT can_modify_in_store(v_produit.owner_id, v_produit.store_id) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de modifier ce produit.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_nouveau := v_produit.stock_actuel + p_delta;

  IF v_nouveau < 0 THEN
    RAISE EXCEPTION 'Stock insuffisant : il reste % unite(s), vous en retirez %.',
      v_produit.stock_actuel, abs(p_delta);
  END IF;

  IF v_nouveau < v_produit.stock_reserve THEN
    RAISE EXCEPTION 'Impossible : % unite(s) sont reservees par des commandes en cours.',
      v_produit.stock_reserve;
  END IF;

  UPDATE products SET stock_actuel = v_nouveau WHERE id = p_product_id;

  INSERT INTO stock_movements (
    store_id, product_id, type_mouvement, stock_actuel_delta,
    stock_reserve_delta, reference_type, reference_id, created_by, note
  ) VALUES (
    v_produit.store_id, p_product_id, 'ajustement', p_delta,
    0, NULL, NULL, auth.uid(),
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      CASE WHEN p_delta > 0 THEN 'Entree de stock' ELSE 'Sortie de stock' END
    )
  );

  RETURN (SELECT to_jsonb(p) FROM products p WHERE p.id = p_product_id);
END;
$function$;

COMMENT ON FUNCTION public.ajuster_stock(uuid, integer, text) IS
  'Corrige le stock d un produit en ecrivant un mouvement d ajustement. Le chiffre et le journal bougent ensemble, ou pas du tout.';

GRANT EXECUTE ON FUNCTION public.ajuster_stock(uuid, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ajuster_stock(uuid, integer, text) FROM anon;

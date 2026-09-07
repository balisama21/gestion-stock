-- ═══════════════════════════════════════════════════════════════════
-- Étape 6c — le panier : plusieurs produits en une seule vente
--
-- POURQUOI PAS UNE COMMANDE
--
-- L'application sait déjà tenir un document à plusieurs lignes :
-- `orders` + `order_items`, avec client, montants et statut de paiement.
-- Mais une commande RÉSERVE le stock (`stock_reserve`) et ne le
-- décrémente qu'à la livraison. C'est le bon cycle pour une commande ;
-- ce n'est pas celui d'un comptoir, où l'article part avec le client au
-- moment où il paie. Faire passer les ventes du comptoir par les
-- commandes les ferait aussi disparaître de l'écran Ventes, des
-- statistiques par vendeur et des rapports, qui lisent tous `sales`.
--
-- CE QU'ON FAIT À LA PLACE
--
-- Une vente reste ce qu'elle est : une ligne par produit. Le panier
-- n'ajoute qu'un lien — `ticket_id` — partagé par les lignes passées
-- ensemble. Rien de ce qui existe ne change : les vingt et une ventes
-- déjà enregistrées gardent un `ticket_id` nul, ce qui se lit très bien
-- comme « vendue seule ».
--
-- LE RÈGLEMENT
--
-- Le client paie une fois pour tout le panier, mais la dette se tient
-- ligne par ligne dans ce modèle. Le montant versé est donc posé sur les
-- lignes dans l'ordre du panier, en soldant chacune avant d'entamer la
-- suivante : une ligne est ainsi soit réglée, soit due, plutôt que
-- toutes partiellement réglées — ce qui serait illisible sur un relevé.
--
-- L'ATOMICITÉ
--
-- La fonction repasse par `create_sale` pour chaque ligne, plutôt que de
-- réécrire sa logique : c'est elle qui verrouille le produit, vérifie le
-- stock DISPONIBLE, écrit le mouvement et enregistre le paiement.
-- Dupliquer tout cela ici, c'est le voir diverger au premier correctif.
-- Comme tout se joue dans une seule transaction, un panier dont la
-- troisième ligne est impossible n'écrit aucune des trois — vérifié
-- avant d'appliquer, sur les données réelles.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE sales ADD COLUMN IF NOT EXISTS ticket_id uuid;

CREATE INDEX IF NOT EXISTS idx_sales_ticket ON sales (store_id, ticket_id)
  WHERE ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_sale_ticket(
  p_store_id uuid,
  p_date date,
  p_vendeur text,
  p_client_credit text,
  p_client_id uuid,
  p_montant_paye_total numeric,
  p_methode text,
  p_lignes jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ligne     jsonb;
  v_index     int := 0;
  v_total     numeric := 0;
  v_reste     numeric;
  v_part      numeric;
  v_ligne_tot numeric;
  v_ticket    uuid;
  v_vente     jsonb;
  v_vente_id  uuid;
  v_cle       text;
  v_ids       uuid[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide.';
  END IF;

  -- Rejouer la même clé ne doit pas créer un second ticket : la première
  -- ligne porte la clé du panier suffixée, on la reconnaît donc.
  SELECT s.ticket_id INTO v_ticket
    FROM sales s WHERE s.idempotency_key = p_idempotency_key || ':1';
  IF v_ticket IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ticket_id', v_ticket,
      'ventes', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
                   FROM sales s WHERE s.ticket_id = v_ticket)
    );
  END IF;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_total := v_total + (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;
  END LOOP;

  IF COALESCE(p_montant_paye_total, 0) < 0 THEN
    RAISE EXCEPTION 'Montant payé invalide.';
  END IF;
  IF COALESCE(p_montant_paye_total, 0) > v_total THEN
    RAISE EXCEPTION 'Paiement refusé : le montant payé (%) dépasse le total du panier (%).',
      p_montant_paye_total, v_total;
  END IF;

  v_ticket := gen_random_uuid();
  v_reste  := COALESCE(p_montant_paye_total, 0);

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_index := v_index + 1;
    v_ligne_tot := (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;

    -- Le règlement se pose ligne par ligne, dans l'ordre du panier, en
    -- soldant chacune avant d'entamer la suivante. Une ligne est ainsi
    -- soit réglée, soit due, plutôt que toutes partiellement réglées.
    v_part  := LEAST(v_reste, v_ligne_tot);
    v_reste := v_reste - v_part;

    v_cle := p_idempotency_key || ':' || v_index;

    -- On repasse par create_sale : c'est elle qui verrouille le produit,
    -- vérifie le stock disponible, écrit le mouvement et enregistre le
    -- paiement. Dupliquer cette logique ici, c'est la voir diverger.
    v_vente := public.create_sale(
      p_store_id, p_date,
      (v_ligne->>'product_id')::uuid,
      (v_ligne->>'quantite')::int,
      (v_ligne->>'prix_vente_unit')::numeric,
      p_vendeur, p_client_credit, p_client_id,
      v_part, p_methode, v_cle
    );

    v_vente_id := (v_vente->>'id')::uuid;
    UPDATE sales SET ticket_id = v_ticket WHERE id = v_vente_id;
    v_ids := array_append(v_ids, v_vente_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ticket_id', v_ticket,
    'ventes', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
                 FROM sales s WHERE s.id = ANY(v_ids))
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_sale_ticket(
  uuid, date, text, text, uuid, numeric, text, jsonb, text) TO authenticated;

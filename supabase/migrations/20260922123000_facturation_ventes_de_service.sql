-- ════════════════════════════════════════════════════════════════════
-- FACTURATION — LA LIGNE DE SERVICE
--
-- « Une facture de service sans produit du catalogue ne touche pas au
-- stock. » Et, deux lignes plus haut : « Les indicateurs du tableau de
-- bord et ceux de la page Facturation doivent donner les mêmes
-- chiffres sur la même période. »
--
-- Les deux ensemble imposent ceci : une prestation facturée est une
-- RECETTE, elle doit donc vivre dans `sales` comme toutes les autres,
-- sinon la page Facturation la compte et le tableau de bord l'ignore.
-- Or `create_sale` refusait `p_product_id IS NULL` — « Produit
-- requis. » — et une prestation n'a pas d'article au catalogue.
--
-- ── UNE BRANCHE GARDÉE, PAS UNE SECONDE FONCTION ───────────────────
--
-- Écrire un `create_service_sale` à côté aurait dédoublé le
-- verrouillage, le contrôle de sur-paiement, l'idempotence et l'appel
-- à `add_payment` — quatre occasions de diverger. La fonction est donc
-- la même, avec un chemin de moins quand il n'y a pas de produit :
-- pas de verrou sur `products`, pas de contrôle de stock, pas de
-- mouvement de stock. Tout le reste est identique au caractère près.
--
-- ── CE QUI NE CHANGE PAS POUR L'EXISTANT ───────────────────────────
--
-- Un appel avec un produit suit exactement le chemin d'avant : les
-- mêmes verrous, les mêmes messages, les mêmes écritures. Le
-- navigateur resté ouvert chez le commerçant ne s'aperçoit de rien, et
-- aucune ligne déjà enregistrée n'est touchée.
--
-- Les deux fonctions sont REMPLACÉES, jamais doublées : leur signature
-- ne bouge pas d'un paramètre. Ajouter un argument en créerait une
-- seconde, et PostgREST refuserait alors de choisir entre les deux.
--
-- La marge d'une prestation vaut son total : il n'y a pas de prix
-- d'achat à retrancher. C'est déjà ce que fait le logiciel d'un
-- produit dont le prix d'achat est nul.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_sale(
  p_store_id uuid, p_date date, p_product_id uuid, p_quantite integer, p_prix_vente_unit numeric,
  p_vendeur text, p_client_credit text, p_client_id uuid, p_montant_paye_initial numeric,
  p_methode text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_prod record;
  v_sale_id uuid;
  v_total numeric;
  v_total_achat_ref numeric;
  v_designation text;
  v_prix_achat numeric := 0;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_prix_vente_unit IS NULL OR p_prix_vente_unit < 0 THEN RAISE EXCEPTION 'Prix de vente invalide.'; END IF;
  IF COALESCE(p_montant_paye_initial, 0) < 0 THEN RAISE EXCEPTION 'Montant payé invalide.'; END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM sales WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_existing);
    END IF;
  END IF;

  IF p_product_id IS NULL THEN
    -- Ligne de service : rien à verrouiller, rien à sortir du stock.
    -- Le libellé arrive juste après, par `create_sale_ticket`, qui est
    -- le seul appelant à en connaître un.
    v_designation := 'Prestation';
  ELSE
    SELECT id, display_name, prix_achat, stock_actuel, stock_disponible INTO v_prod
      FROM products WHERE id = p_product_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
    IF v_prod.stock_disponible <= 0 THEN
      RAISE EXCEPTION 'Ce produit est en rupture de stock disponible (réservé par une ou plusieurs commandes).';
    END IF;
    IF p_quantite > v_prod.stock_disponible THEN
      RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : disponible %, demandé % (stock total %, réservé %).',
        v_prod.display_name, v_prod.stock_disponible, p_quantite, v_prod.stock_actuel,
        v_prod.stock_actuel - v_prod.stock_disponible;
    END IF;
    v_designation := v_prod.display_name;
    v_prix_achat := v_prod.prix_achat;
  END IF;

  v_total := p_quantite * p_prix_vente_unit;
  v_total_achat_ref := p_quantite * v_prix_achat;

  IF COALESCE(p_montant_paye_initial, 0) > v_total THEN
    RAISE EXCEPTION 'Paiement refusé : le montant payé (%) dépasse le total de la vente (%).',
      p_montant_paye_initial, v_total;
  END IF;

  v_sale_id := gen_random_uuid();

  IF p_product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel - p_quantite
     WHERE id = p_product_id AND store_id = p_store_id;
  END IF;

  INSERT INTO sales (
    id, store_id, owner_id, date, product_id, designation, quantite, prix_vente_unit, total_vente,
    prix_achat_unit_ref, total_achat_ref, marge_totale, vendeur, client_credit, client_id,
    montant_paye, solde_du, statut_credit, idempotency_key
  ) VALUES (
    v_sale_id, p_store_id, v_owner, p_date, p_product_id, v_designation, p_quantite, p_prix_vente_unit, v_total,
    v_prix_achat, v_total_achat_ref, v_total - v_total_achat_ref, COALESCE(p_vendeur, ''), p_client_credit, p_client_id,
    0, v_total, 'Impayé', p_idempotency_key
  );

  IF p_product_id IS NOT NULL THEN
    INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
    VALUES (p_store_id, p_product_id, 'vente', -p_quantite, 0, 'sale', v_sale_id, v_owner);
  END IF;

  IF COALESCE(p_montant_paye_initial, 0) > 0 THEN
    PERFORM public.add_payment(
      p_store_id, NULL, v_sale_id, p_montant_paye_initial,
      p_methode, NULL, NULL,
      CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE p_idempotency_key || ':payment' END
    );
  END IF;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_sale_id);
END;
$function$;

-- ── Le libellé d'une prestation ─────────────────────────────────────
--
-- `create_sale` ne prend pas de désignation : elle la lit sur le
-- produit. Une prestation n'en a pas, et « Prestation » tout court ne
-- dira rien au client qui relira sa facture dans six mois.
--
-- Le ticket, lui, a la ligne saisie sous la main. Il pose donc le
-- libellé dans la MÊME transaction, juste après l'insertion : une
-- écriture de texte, sur une ligne sans produit, qui n'expose ni le
-- stock, ni la caisse, ni la marge. Un `product_id` vide arrive par
-- `NULLIF` — le navigateur envoie une chaîne vide, pas un nul.
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
  v_produit   uuid;
  v_libelle   text;
  v_cle       text;
  v_ids       uuid[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide.';
  END IF;

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

    v_part  := LEAST(v_reste, v_ligne_tot);
    v_reste := v_reste - v_part;

    v_cle := p_idempotency_key || ':' || v_index;
    v_produit := NULLIF(v_ligne->>'product_id', '')::uuid;

    v_vente := public.create_sale(
      p_store_id, p_date,
      v_produit,
      (v_ligne->>'quantite')::int,
      (v_ligne->>'prix_vente_unit')::numeric,
      p_vendeur, p_client_credit, p_client_id,
      v_part, p_methode, v_cle
    );

    v_vente_id := (v_vente->>'id')::uuid;
    UPDATE sales SET ticket_id = v_ticket WHERE id = v_vente_id;

    v_libelle := btrim(COALESCE(v_ligne->>'designation', ''));
    IF v_produit IS NULL AND v_libelle <> '' THEN
      UPDATE sales SET designation = v_libelle WHERE id = v_vente_id;
    END IF;

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

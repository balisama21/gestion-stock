-- ════════════════════════════════════════════════════════════════
-- CONDITIONNEMENTS : UN PRODUIT ACHETÉ OU VENDU AU CARTON, AU SAC…
-- ════════════════════════════════════════════════════════════════
--
-- Le stock d'un produit se compte TOUJOURS dans son unité de base
-- (`products.unite` : pièce, gramme, litre…) et en nombre entier, comme
-- avant. Un conditionnement dit combien d'unités de base il contient,
-- produit par produit — jamais une conversion universelle :
--
--   Eau 1,5 L : unité « bouteille », pack = 6, carton = 12
--   Riz       : unité « kg », sac = 50
--
-- Acheter 2 cartons de 12 fait entrer 24 bouteilles ; vendre 1 carton
-- en fait sortir 12 ; vendre 3 bouteilles en fait sortir 3. Le stock,
-- les mouvements, les annulations et les statistiques restent donc en
-- unités de base : rien de ce qui les calcule ne change.
--
-- Ce que ce fichier ajoute, sans rien retirer :
--   1. `products.conditionnements` : la liste, propre à chaque produit ;
--   2. trois colonnes descriptives sur `sales` et `purchases`, pour que
--      l'historique dise « 2 cartons » et pas seulement « 24 » ;
--   3. `create_sale_conditionne` et `add_purchase_conditionne` : le même
--      chemin que `create_sale` / `add_purchase`, mais dont le total est
--      EXACTEMENT nombre × prix du conditionnement. 7 000 le carton de 12
--      ne se divise pas juste (583,333…) : recalculer le total depuis le
--      prix unitaire laisserait une poussière qui refuserait le paiement
--      de 7 000 ou laisserait la vente « partielle » pour toujours ;
--   4. `create_sale_ticket` sait passer une ligne au conditionnement —
--      même signature, une ligne sans conditionnement suit exactement
--      le chemin d'avant ;
--   5. `modifier_achat` et `corriger_prix_vente` arrondissent leur total
--      au centime, pour la même raison quand on corrige une ligne
--      conditionnée. Un total déjà au centime ne bouge pas ;
--   6. une quantité corrigée garde sa description cohérente.

-- ── 1. La liste des conditionnements d'un produit ─────────────────

CREATE OR REPLACE FUNCTION public.conditionnements_valides(p jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_el jsonb;
  v_ids text[] := '{}';
  v_noms text[] := '{}';
  v_id text;
  v_nom text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p) > 20 THEN RETURN false; END IF;

  FOR v_el IN SELECT * FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(v_el) <> 'object' THEN RETURN false; END IF;

    v_id := btrim(COALESCE(v_el->>'id', ''));
    v_nom := lower(btrim(COALESCE(v_el->>'nom', '')));
    IF v_id = '' OR v_nom = '' THEN RETURN false; END IF;
    IF v_id = ANY(v_ids) OR v_nom = ANY(v_noms) THEN RETURN false; END IF;
    v_ids := array_append(v_ids, v_id);
    v_noms := array_append(v_noms, v_nom);

    -- Un entier d'au moins 2 : « 1 carton = 1 pièce » n'est pas un
    -- conditionnement, et le stock se compte en entiers.
    IF jsonb_typeof(v_el->'quantite') <> 'number' THEN RETURN false; END IF;
    IF (v_el->>'quantite')::numeric <> trunc((v_el->>'quantite')::numeric)
       OR (v_el->>'quantite')::numeric < 2
       OR (v_el->>'quantite')::numeric > 1000000 THEN
      RETURN false;
    END IF;

    IF v_el ? 'prix_vente' AND jsonb_typeof(v_el->'prix_vente') NOT IN ('null', 'number') THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(v_el->'prix_vente') = 'number' AND (v_el->>'prix_vente')::numeric < 0 THEN
      RETURN false;
    END IF;
    IF v_el ? 'prix_achat' AND jsonb_typeof(v_el->'prix_achat') NOT IN ('null', 'number') THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(v_el->'prix_achat') = 'number' AND (v_el->>'prix_achat')::numeric < 0 THEN
      RETURN false;
    END IF;
    IF v_el ? 'code_barres' AND jsonb_typeof(v_el->'code_barres') NOT IN ('null', 'string') THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$function$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS conditionnements jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_conditionnements_valides'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_conditionnements_valides
      CHECK (public.conditionnements_valides(conditionnements));
  END IF;
END $$;

COMMENT ON COLUMN public.products.conditionnements IS
  'Conditionnements du produit : [{id, nom, quantite (unités de base, entier >= 2), prix_vente, prix_achat, code_barres}]. Le stock reste compté en unités de base.';

-- ── 2. Ce que l'historique retient ────────────────────────────────

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS conditionnement text,
  ADD COLUMN IF NOT EXISTS conditionnement_nombre integer,
  ADD COLUMN IF NOT EXISTS conditionnement_facteur integer;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS conditionnement text,
  ADD COLUMN IF NOT EXISTS conditionnement_nombre integer,
  ADD COLUMN IF NOT EXISTS conditionnement_facteur integer;

COMMENT ON COLUMN public.sales.conditionnement IS
  'Descriptif : vendu en « carton », etc. La quantité, elle, est toujours en unités de base.';
COMMENT ON COLUMN public.purchases.conditionnement IS
  'Descriptif : acheté en « carton », etc. La quantité, elle, est toujours en unités de base.';

-- Une quantité corrigée en unités de base : la description suit si elle
-- tombe juste (36 = 3 cartons), sinon elle s'efface plutôt que de mentir.
CREATE OR REPLACE FUNCTION public.conditionnement_suit_la_quantite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.conditionnement IS NOT NULL
     AND NEW.quantite IS DISTINCT FROM OLD.quantite THEN
    IF COALESCE(NEW.conditionnement_facteur, 0) > 1
       AND NEW.quantite % NEW.conditionnement_facteur = 0 THEN
      NEW.conditionnement_nombre := NEW.quantite / NEW.conditionnement_facteur;
    ELSE
      NEW.conditionnement := NULL;
      NEW.conditionnement_nombre := NULL;
      NEW.conditionnement_facteur := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sales_conditionnement_suit ON public.sales;
CREATE TRIGGER sales_conditionnement_suit
  BEFORE UPDATE OF quantite ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.conditionnement_suit_la_quantite();

DROP TRIGGER IF EXISTS purchases_conditionnement_suit ON public.purchases;
CREATE TRIGGER purchases_conditionnement_suit
  BEFORE UPDATE OF quantite ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.conditionnement_suit_la_quantite();

REVOKE EXECUTE ON FUNCTION public.conditionnement_suit_la_quantite() FROM PUBLIC, anon, authenticated;

-- ── 3a. Vendre au conditionnement ─────────────────────────────────
--
-- Le pendant de `create_sale`, mêmes contrôles et mêmes écritures. Le
-- facteur est lu sur la fiche du produit, jamais pris de l'écran.

CREATE OR REPLACE FUNCTION public.create_sale_conditionne(
  p_store_id uuid,
  p_date date,
  p_product_id uuid,
  p_conditionnement_id text,
  p_nombre integer,
  p_prix_conditionnement numeric,
  p_vendeur text,
  p_client_credit text,
  p_client_id uuid,
  p_montant_paye_initial numeric,
  p_methode text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_prod record;
  v_cond jsonb;
  v_nom text;
  v_facteur integer;
  v_qte integer;
  v_sale_id uuid;
  v_total numeric;
  v_total_achat_ref numeric;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF store_is_locked(p_store_id) THEN
    RAISE EXCEPTION 'Boutique verrouillée : aucune écriture possible.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_product_id IS NULL THEN RAISE EXCEPTION 'Produit manquant.'; END IF;
  IF p_nombre IS NULL OR p_nombre <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_prix_conditionnement IS NULL OR p_prix_conditionnement < 0 THEN
    RAISE EXCEPTION 'Prix de vente invalide.';
  END IF;
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

  SELECT id, display_name, prix_achat, stock_actuel, stock_disponible, conditionnements, unite
    INTO v_prod
    FROM products WHERE id = p_product_id AND store_id = p_store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;

  SELECT c INTO v_cond FROM jsonb_array_elements(v_prod.conditionnements) c
   WHERE c->>'id' = p_conditionnement_id;
  IF v_cond IS NULL THEN
    RAISE EXCEPTION 'Ce conditionnement n''existe plus sur « % ». Rouvrez la vente.', v_prod.display_name;
  END IF;
  v_nom := v_cond->>'nom';
  v_facteur := (v_cond->>'quantite')::integer;
  v_qte := p_nombre * v_facteur;

  IF v_prod.stock_disponible <= 0 THEN
    RAISE EXCEPTION 'Ce produit est en rupture de stock disponible (réservé par une ou plusieurs commandes).';
  END IF;
  IF v_qte > v_prod.stock_disponible THEN
    RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : % % de % demandent %, il en reste %.',
      v_prod.display_name, p_nombre, v_nom, v_facteur, v_qte, v_prod.stock_disponible;
  END IF;

  v_total := p_nombre * p_prix_conditionnement;
  v_total_achat_ref := v_qte * v_prod.prix_achat;

  IF COALESCE(p_montant_paye_initial, 0) > v_total THEN
    RAISE EXCEPTION 'Paiement refusé : le montant payé (%) dépasse le total de la vente (%).',
      p_montant_paye_initial, v_total;
  END IF;

  v_sale_id := gen_random_uuid();

  UPDATE products SET stock_actuel = stock_actuel - v_qte
   WHERE id = p_product_id AND store_id = p_store_id;

  INSERT INTO sales (
    id, store_id, owner_id, date, product_id, designation, quantite, prix_vente_unit, total_vente,
    prix_achat_unit_ref, total_achat_ref, marge_totale, vendeur, client_credit, client_id,
    montant_paye, solde_du, statut_credit, idempotency_key,
    conditionnement, conditionnement_nombre, conditionnement_facteur
  ) VALUES (
    v_sale_id, p_store_id, v_owner, p_date, p_product_id, v_prod.display_name, v_qte,
    p_prix_conditionnement / v_facteur, v_total,
    v_prod.prix_achat, v_total_achat_ref, v_total - v_total_achat_ref, COALESCE(p_vendeur, ''),
    p_client_credit, p_client_id,
    0, v_total, 'Impayé', p_idempotency_key,
    v_nom, p_nombre, v_facteur
  );

  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta,
                               stock_reserve_delta, reference_type, reference_id, created_by, note)
  VALUES (p_store_id, p_product_id, 'vente', -v_qte, 0, 'sale', v_sale_id, v_owner,
          p_nombre || ' × ' || v_nom || ' de ' || v_facteur);

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

-- Appelée par `create_sale_ticket` seulement (qui tourne en définisseur).
REVOKE EXECUTE ON FUNCTION public.create_sale_conditionne(
  uuid, date, uuid, text, integer, numeric, text, text, uuid, numeric, text, text
) FROM PUBLIC, anon, authenticated;

-- ── 4. Le panier sait passer une ligne au conditionnement ─────────
--
-- Même signature, même déroulé. Une ligne qui porte `conditionnement_id`
-- (avec `nombre` et `prix_conditionnement`) passe par la fonction
-- ci-dessus ; toute autre ligne suit le chemin d'avant, inchangé.

CREATE OR REPLACE FUNCTION public.create_sale_ticket(p_store_id uuid, p_date date, p_vendeur text, p_client_credit text, p_client_id uuid, p_montant_paye_total numeric, p_methode text, p_lignes jsonb, p_idempotency_key text)
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
  v_cond      text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF store_is_locked(p_store_id) THEN
    RAISE EXCEPTION 'Boutique verrouillée : aucune écriture possible.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
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
    IF NULLIF(v_ligne->>'conditionnement_id', '') IS NOT NULL THEN
      v_total := v_total + (v_ligne->>'nombre')::int * (v_ligne->>'prix_conditionnement')::numeric;
    ELSE
      v_total := v_total + (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;
    END IF;
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
    v_cond := NULLIF(v_ligne->>'conditionnement_id', '');
    IF v_cond IS NOT NULL THEN
      v_ligne_tot := (v_ligne->>'nombre')::int * (v_ligne->>'prix_conditionnement')::numeric;
    ELSE
      v_ligne_tot := (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;
    END IF;

    v_part  := LEAST(v_reste, v_ligne_tot);
    v_reste := v_reste - v_part;

    v_cle := p_idempotency_key || ':' || v_index;
    v_produit := NULLIF(v_ligne->>'product_id', '')::uuid;

    IF v_cond IS NOT NULL THEN
      v_vente := public.create_sale_conditionne(
        p_store_id, p_date,
        v_produit,
        v_cond,
        (v_ligne->>'nombre')::int,
        (v_ligne->>'prix_conditionnement')::numeric,
        p_vendeur, p_client_credit, p_client_id,
        v_part, p_methode, v_cle
      );
    ELSE
      v_vente := public.create_sale(
        p_store_id, p_date,
        v_produit,
        (v_ligne->>'quantite')::int,
        (v_ligne->>'prix_vente_unit')::numeric,
        p_vendeur, p_client_credit, p_client_id,
        v_part, p_methode, v_cle
      );
    END IF;

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

-- ── 3b. Acheter au conditionnement ────────────────────────────────
--
-- Le pendant de `add_purchase` pour un produit qui existe déjà : le
-- produit à créer passe d'abord par `create_product`, puis par ici.

CREATE OR REPLACE FUNCTION public.add_purchase_conditionne(
  p_store_id uuid,
  p_date date,
  p_product_id uuid,
  p_conditionnement_id text,
  p_nombre integer,
  p_prix_conditionnement numeric,
  p_fournisseur text,
  p_idempotency_key text,
  p_montant_paye numeric DEFAULT NULL::numeric,
  p_date_echeance date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_prod record;
  v_cond jsonb;
  v_nom text;
  v_facteur integer;
  v_qte integer;
  v_purchase_id uuid;
  v_total numeric;
  v_paye numeric;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF store_is_locked(p_store_id) THEN
    RAISE EXCEPTION 'Boutique verrouillée : aucune écriture possible.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_product_id IS NULL THEN RAISE EXCEPTION 'Produit manquant.'; END IF;
  IF p_nombre IS NULL OR p_nombre <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_prix_conditionnement IS NULL OR p_prix_conditionnement < 0 THEN
    RAISE EXCEPTION 'Le prix d''achat ne peut pas être négatif.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM purchases WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_existing);
    END IF;
  END IF;

  SELECT id, display_name, conditionnements INTO v_prod
    FROM products WHERE id = p_product_id AND store_id = p_store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;

  SELECT c INTO v_cond FROM jsonb_array_elements(v_prod.conditionnements) c
   WHERE c->>'id' = p_conditionnement_id;
  IF v_cond IS NULL THEN
    RAISE EXCEPTION 'Ce conditionnement n''existe plus sur « % ». Rouvrez l''achat.', v_prod.display_name;
  END IF;
  v_nom := v_cond->>'nom';
  v_facteur := (v_cond->>'quantite')::integer;
  v_qte := p_nombre * v_facteur;

  v_total := p_nombre * p_prix_conditionnement;
  v_paye := COALESCE(p_montant_paye, v_total);
  IF v_paye < 0 OR v_paye > v_total THEN
    RAISE EXCEPTION 'Le montant réglé doit être compris entre 0 et le total de l''achat.';
  END IF;

  UPDATE products SET stock_actuel = stock_actuel + v_qte WHERE id = p_product_id;

  v_purchase_id := gen_random_uuid();

  INSERT INTO purchases (id, store_id, owner_id, date, product_id, designation, quantite,
                         prix_achat_unit, total_achat, fournisseur, impact_tresorerie,
                         idempotency_key, date_echeance,
                         conditionnement, conditionnement_nombre, conditionnement_facteur)
  VALUES (v_purchase_id, p_store_id, v_owner, p_date, p_product_id, v_prod.display_name, v_qte,
          p_prix_conditionnement / v_facteur, v_total, COALESCE(p_fournisseur, ''), -v_paye,
          p_idempotency_key, p_date_echeance,
          v_nom, p_nombre, v_facteur);

  IF v_paye > 0 AND v_paye < v_total THEN
    INSERT INTO supplier_payments (purchase_id, store_id, recorded_by, montant, date, methode, note)
    VALUES (v_purchase_id, p_store_id, v_owner, v_paye, p_date, 'especes',
            'Acompte versé à l''achat.');
  END IF;

  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta,
                               stock_reserve_delta, reference_type, reference_id, created_by, note)
  VALUES (p_store_id, p_product_id, 'achat', v_qte, 0, 'purchase', v_purchase_id, v_owner,
          p_nombre || ' × ' || v_nom || ' de ' || v_facteur);

  RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_purchase_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_purchase_conditionne(
  uuid, date, uuid, text, integer, numeric, text, text, numeric, date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_purchase_conditionne(
  uuid, date, uuid, text, integer, numeric, text, text, numeric, date
) TO authenticated;

-- ── 5. Corrections arrondies au centime ───────────────────────────
--
-- Seule la ligne du total change. Pour un prix et une quantité au
-- centime, le résultat est identique à avant.

CREATE OR REPLACE FUNCTION public.modifier_achat(p_purchase_id uuid, p_date date, p_quantite integer, p_prix_achat_unit numeric, p_fournisseur text, p_montant_regle numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_achat   purchases%ROWTYPE;
  v_prod    record;
  v_total   numeric;
  v_delta   integer;
  v_nouveau integer;
  v_nb_reg  integer;
  v_reg     supplier_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_achat FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable (deja supprime ?).';
  END IF;

  IF store_is_locked(v_achat.store_id) THEN
    RAISE EXCEPTION 'Boutique verrouillee : aucune ecriture possible.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT can_modify_in_store(v_achat.owner_id, v_achat.store_id) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de modifier cet achat.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'La quantite doit etre superieure a zero.';
  END IF;
  IF p_prix_achat_unit IS NULL OR p_prix_achat_unit < 0 THEN
    RAISE EXCEPTION 'Le prix d''achat ne peut pas etre negatif.';
  END IF;

  v_total := round(p_quantite * p_prix_achat_unit, 2);

  v_delta := p_quantite - v_achat.quantite;
  IF v_achat.product_id IS NOT NULL AND v_delta <> 0 THEN
    SELECT id, display_name, stock_actuel, stock_reserve INTO v_prod
      FROM products WHERE id = v_achat.product_id FOR UPDATE;
    IF FOUND THEN
      v_nouveau := v_prod.stock_actuel + v_delta;
      IF v_nouveau < 0 THEN
        RAISE EXCEPTION
          'Impossible : il ne reste que % unite(s) de "%" en stock, la correction en retirerait %.',
          v_prod.stock_actuel, v_prod.display_name, abs(v_delta);
      END IF;
      IF v_nouveau < v_prod.stock_reserve THEN
        RAISE EXCEPTION
          'Impossible : % unite(s) de "%" sont reservees pour des commandes en cours.',
          v_prod.stock_reserve, v_prod.display_name;
      END IF;

      UPDATE products SET stock_actuel = v_nouveau WHERE id = v_achat.product_id;

      INSERT INTO stock_movements (
        store_id, product_id, type_mouvement, stock_actuel_delta,
        stock_reserve_delta, reference_type, reference_id, created_by, note
      ) VALUES (
        v_achat.store_id, v_achat.product_id, 'achat_modification', v_delta,
        0, 'purchase', p_purchase_id, auth.uid(),
        'Correction de l achat ' || coalesce(v_achat.numero, '')
      );
    END IF;
  END IF;

  SELECT count(*) INTO v_nb_reg FROM supplier_payments WHERE purchase_id = p_purchase_id;

  IF p_montant_regle IS NULL THEN
    IF v_achat.montant_paye > v_total THEN
      RAISE EXCEPTION
        'Le reglement deja enregistre (%) depasserait le nouveau total (%). Corrigez aussi le montant regle.',
        v_achat.montant_paye, v_total;
    END IF;
  ELSE
    IF p_montant_regle < 0 THEN
      RAISE EXCEPTION 'Le montant regle ne peut pas etre negatif.';
    END IF;
    IF p_montant_regle > v_total THEN
      RAISE EXCEPTION 'On ne regle pas plus que le montant de l''achat (% pour un total de %).',
        p_montant_regle, v_total;
    END IF;
    IF v_nb_reg > 1 THEN
      RAISE EXCEPTION
        'Cet achat porte % reglements : corrigez-les un par un avant d''en changer le montant.',
        v_nb_reg;
    END IF;

    SELECT * INTO v_reg FROM supplier_payments WHERE purchase_id = p_purchase_id LIMIT 1;
    DELETE FROM supplier_payments WHERE purchase_id = p_purchase_id;
  END IF;

  UPDATE purchases SET
    date             = coalesce(p_date, v_achat.date),
    quantite         = p_quantite,
    prix_achat_unit  = p_prix_achat_unit,
    total_achat      = v_total,
    impact_tresorerie = -v_total,
    fournisseur      = coalesce(nullif(btrim(p_fournisseur), ''), v_achat.fournisseur)
  WHERE id = p_purchase_id;

  IF p_montant_regle IS NOT NULL AND p_montant_regle > 0 THEN
    INSERT INTO supplier_payments (
      purchase_id, store_id, recorded_by, montant, date, methode, reference, note
    ) VALUES (
      p_purchase_id, v_achat.store_id, auth.uid(), p_montant_regle,
      coalesce(v_reg.date, coalesce(p_date, v_achat.date)),
      coalesce(v_reg.methode, 'especes'),
      v_reg.reference,
      v_reg.note
    );
  END IF;

  RETURN (SELECT to_jsonb(p) FROM purchases p WHERE p.id = p_purchase_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.corriger_prix_vente(p_sale_id uuid, p_nouveau_prix numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale record;
  v_paye numeric;
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.'; END IF;
  IF NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF p_nouveau_prix IS NULL OR p_nouveau_prix < 0 THEN
    RAISE EXCEPTION 'Prix invalide.';
  END IF;

  v_total := round(v_sale.quantite * p_nouveau_prix, 2);
  SELECT COALESCE(SUM(montant), 0) INTO v_paye FROM payments WHERE sale_id = p_sale_id;

  IF v_paye + COALESCE(v_sale.montant_avoire, 0) > v_total THEN
    RAISE EXCEPTION 'Prix refusé : les paiements (%) et les avoirs (%) déjà enregistrés dépasseraient le nouveau total (%).',
      v_paye, COALESCE(v_sale.montant_avoire, 0), v_total;
  END IF;
  IF COALESCE(v_sale.commission, 0) > v_total THEN
    RAISE EXCEPTION 'Prix refusé : la commission retenue (%) dépasserait le nouveau total (%).',
      v_sale.commission, v_total;
  END IF;

  UPDATE sales SET
    prix_vente_unit = p_nouveau_prix,
    total_vente = v_total,
    marge_totale = v_total - total_achat_ref,
    updated_at = NOW()
  WHERE id = p_sale_id;

  PERFORM recalculer_solde_vente(p_sale_id);

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
END;
$function$;

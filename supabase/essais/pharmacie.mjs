// BANC D'ESSAI — migration 20261120195724_pharmacie
//
// Rejoue la migration de la pharmacie dans un Postgres embarqué (PGlite),
// sur une réplique minimale des tables qu'elle touche, sans jamais toucher
// à la production. `add_purchase`, `create_sale`, `create_sale_ticket`,
// `delete_sale`, `delete_purchase`, `ajuster_stock` et `add_payment` sont
// repris tels qu'ils sont en production (lus le 20 novembre 2026).
//
// Lancer depuis la racine du dépôt :
//   node supabase/essais/pharmacie.mjs supabase/migrations/20261120195724_pharmacie.sql
// (PGlite est présent dans node_modules ; sinon : npm i --no-save @electric-sql/pglite)

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const [, , fichierMigration, fichierRetour] = process.argv;

const MOI = "00000000-0000-0000-0000-000000000001";
const INTRUS = "00000000-0000-0000-0000-000000000009";
const BOUTIQUE = "10000000-0000-0000-0000-000000000001";
const AUTRE_BOUTIQUE = "10000000-0000-0000-0000-000000000002";
const AMOX = "20000000-0000-0000-0000-000000000001";
const DOLI = "20000000-0000-0000-0000-000000000002";
const SAVON = "20000000-0000-0000-0000-000000000003";
const PATIENT = "30000000-0000-0000-0000-000000000001";
const ARO = "30000000-0000-0000-0000-000000000002";

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.session (uid uuid);
INSERT INTO auth.session VALUES ('${MOI}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT uid FROM auth.session LIMIT 1 $$;

CREATE TABLE profiles (id uuid PRIMARY KEY);
INSERT INTO profiles VALUES ('${MOI}'), ('${INTRUS}');
CREATE TABLE stores (id uuid PRIMARY KEY, owner_id uuid, verrouillee boolean DEFAULT false);
INSERT INTO stores VALUES ('${BOUTIQUE}', '${MOI}', false), ('${AUTRE_BOUTIQUE}', '${INTRUS}', false);
CREATE TABLE store_members (store_id uuid, user_id uuid, role text);

CREATE FUNCTION store_is_locked(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT verrouillee FROM stores WHERE id = p $$;
CREATE FUNCTION is_store_owner(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT owner_id = auth.uid() FROM stores WHERE id = p $$;
CREATE FUNCTION is_store_member(p_store_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM store_members WHERE store_id = p_store_id AND user_id = auth.uid()
       AND role IS DISTINCT FROM 'livreur');
$$;
CREATE FUNCTION store_allows_write(p_store_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.is_store_member(p_store_id) AND NOT public.store_is_locked(p_store_id);
$$;
CREATE FUNCTION can_modify_in_store(p_owner_id uuid, p_store_id uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT ((p_owner_id = auth.uid()) OR is_store_owner(p_store_id)) AND NOT store_is_locked(p_store_id) $$;

CREATE TABLE clients (id uuid PRIMARY KEY, store_id uuid, nom text);
INSERT INTO clients VALUES ('${PATIENT}', '${BOUTIQUE}', 'Rabe'), ('${ARO}', '${BOUTIQUE}', 'ARO');

CREATE TABLE products (
  id uuid PRIMARY KEY, store_id uuid, owner_id uuid, designation text, variant_suffix text DEFAULT '',
  display_name text, prix_achat numeric DEFAULT 0, prix_vente_defaut numeric DEFAULT 0,
  fournisseur text DEFAULT '', stock_initial int DEFAULT 0, stock_actuel int DEFAULT 0,
  stock_reserve int DEFAULT 0, seuil_alerte int DEFAULT 0,
  stock_disponible int GENERATED ALWAYS AS (stock_actuel - stock_reserve) STORED);
INSERT INTO products (id, store_id, owner_id, designation, display_name, prix_achat, prix_vente_defaut) VALUES
  ('${AMOX}', '${BOUTIQUE}', '${MOI}', 'Amoxil', 'Amoxil 500 mg', 1000, 2500),
  ('${DOLI}', '${BOUTIQUE}', '${MOI}', 'Doliprane', 'Doliprane 500 mg', 800, 1500),
  ('${SAVON}', '${BOUTIQUE}', '${MOI}', 'Savon', 'Savon', 500, 900);

CREATE TABLE purchases (
  id uuid PRIMARY KEY, store_id uuid, owner_id uuid, date date, product_id uuid, designation text,
  quantite int, prix_achat_unit numeric, total_achat numeric, fournisseur text,
  impact_tresorerie numeric, idempotency_key text UNIQUE, date_echeance date, supplier_id uuid);
CREATE TABLE supplier_payments (purchase_id uuid, store_id uuid, recorded_by uuid, montant numeric,
  date date, methode text, note text);

CREATE TABLE sales (
  id uuid PRIMARY KEY, store_id uuid, owner_id uuid, date date, product_id uuid, designation text,
  quantite int, prix_vente_unit numeric, total_vente numeric, prix_achat_unit_ref numeric,
  total_achat_ref numeric, marge_totale numeric, vendeur text, client_credit text, client_id uuid,
  montant_paye numeric DEFAULT 0, montant_rembourse numeric DEFAULT 0, solde_du numeric,
  statut_credit text, idempotency_key text UNIQUE, ticket_id uuid);
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, sale_id uuid,
  store_id uuid, recorded_by uuid, montant numeric, methode text, reference text, note text,
  idempotency_key text);
-- En production, un déclencheur recalcule le solde de la vente.
CREATE FUNCTION recalculer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sales SET montant_paye = (SELECT COALESCE(SUM(montant),0) FROM payments WHERE sale_id = NEW.sale_id),
                   solde_du = total_vente - (SELECT COALESCE(SUM(montant),0) FROM payments WHERE sale_id = NEW.sale_id)
   WHERE id = NEW.sale_id;
  RETURN NEW;
END $$;
CREATE TRIGGER recalculer AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION recalculer();

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL, product_id uuid,
  type_mouvement text NOT NULL, stock_actuel_delta int NOT NULL, stock_reserve_delta int NOT NULL DEFAULT 0,
  reference_type text, reference_id uuid, idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  note text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
`;

// ── Les fonctions de production, telles quelles ────────────────────
const PRODUCTION = `
CREATE OR REPLACE FUNCTION public.add_payment(p_store_id uuid, p_order_id uuid, p_sale_id uuid, p_montant numeric, p_methode text, p_reference text, p_note text, p_idempotency_key text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user uuid := auth.uid(); v_existing uuid; v_total numeric; v_paye numeric; v_target_store uuid; v_refunded numeric := 0; v_payment_id uuid;
BEGIN
  IF v_user IS NULL OR NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RAISE EXCEPTION 'Le montant du paiement doit être positif.'; END IF;
  SELECT store_id, total_vente, montant_paye, montant_rembourse INTO v_target_store, v_total, v_paye, v_refunded
    FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF p_montant > GREATEST(v_total - v_paye, 0) THEN RAISE EXCEPTION 'Paiement refusé.'; END IF;
  INSERT INTO payments (order_id, sale_id, store_id, recorded_by, montant, methode, reference, note, idempotency_key)
  VALUES (p_order_id, p_sale_id, p_store_id, v_user, p_montant, COALESCE(NULLIF(p_methode, ''), 'especes'), p_reference, p_note, p_idempotency_key)
  RETURNING id INTO v_payment_id;
  RETURN (SELECT to_jsonb(p) FROM payments p WHERE p.id = v_payment_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.add_purchase(p_store_id uuid, p_date date, p_product_id uuid, p_new_designation text, p_new_variant_suffix text, p_new_display_name text, p_new_prix_vente_defaut numeric, p_new_seuil_alerte integer, p_quantite integer, p_prix_achat_unit numeric, p_fournisseur text, p_idempotency_key text, p_montant_paye numeric DEFAULT NULL::numeric, p_date_echeance date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_owner uuid := auth.uid(); v_existing uuid; v_product_id uuid; v_display_name text; v_purchase_id uuid; v_total numeric; v_paye numeric;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF store_is_locked(p_store_id) THEN RAISE EXCEPTION 'Boutique verrouillée : aucune écriture possible.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM purchases WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_existing); END IF;
  END IF;
  v_total := p_quantite * p_prix_achat_unit;
  v_paye := COALESCE(p_montant_paye, v_total);
  IF v_paye < 0 OR v_paye > v_total THEN RAISE EXCEPTION 'Le montant réglé doit être compris entre 0 et le total de l''achat.'; END IF;
  IF p_product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel + p_quantite
      WHERE id = p_product_id AND store_id = p_store_id
      RETURNING id, display_name INTO v_product_id, v_display_name;
    IF v_product_id IS NULL THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
  ELSE
    RAISE EXCEPTION 'Réplique : création de produit non reprise.';
  END IF;
  v_purchase_id := gen_random_uuid();
  INSERT INTO purchases (id, store_id, owner_id, date, product_id, designation, quantite,
                         prix_achat_unit, total_achat, fournisseur, impact_tresorerie, idempotency_key, date_echeance)
  VALUES (v_purchase_id, p_store_id, v_owner, p_date, v_product_id, v_display_name, p_quantite,
          p_prix_achat_unit, v_total, p_fournisseur, -v_paye, p_idempotency_key, p_date_echeance);
  IF v_paye > 0 AND v_paye < v_total THEN
    INSERT INTO supplier_payments (purchase_id, store_id, recorded_by, montant, date, methode, note)
    VALUES (v_purchase_id, p_store_id, v_owner, v_paye, p_date, 'especes', 'Acompte versé à l''achat.');
  END IF;
  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
  VALUES (p_store_id, v_product_id, 'achat', p_quantite, 0, 'purchase', v_purchase_id, v_owner);
  RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_purchase_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.add_purchase_conditionne(p_store_id uuid, p_date date, p_product_id uuid, p_conditionnement_id text, p_nombre integer, p_prix_conditionnement numeric, p_fournisseur text, p_idempotency_key text, p_montant_paye numeric, p_date_echeance date)
 RETURNS jsonb LANGUAGE plpgsql AS $function$
BEGIN
  -- Réplique : une boîte de 10, achetée au prix du carton.
  RETURN public.add_purchase(p_store_id, p_date, p_product_id, NULL, NULL, NULL, NULL, NULL,
    p_nombre * 10, p_prix_conditionnement / 10, p_fournisseur, p_idempotency_key, p_montant_paye, p_date_echeance);
END; $function$;

CREATE OR REPLACE FUNCTION public.create_sale(p_store_id uuid, p_date date, p_product_id uuid, p_quantite integer, p_prix_vente_unit numeric, p_vendeur text, p_client_credit text, p_client_id uuid, p_montant_paye_initial numeric, p_methode text, p_idempotency_key text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_owner uuid := auth.uid(); v_existing uuid; v_prod record; v_sale_id uuid; v_total numeric; v_total_achat_ref numeric; v_designation text; v_prix_achat numeric := 0;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF store_is_locked(p_store_id) THEN RAISE EXCEPTION 'Boutique verrouillée : aucune écriture possible.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_prix_vente_unit IS NULL OR p_prix_vente_unit < 0 THEN RAISE EXCEPTION 'Prix de vente invalide.'; END IF;
  IF COALESCE(p_montant_paye_initial, 0) < 0 THEN RAISE EXCEPTION 'Montant payé invalide.'; END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients WHERE id = p_client_id AND store_id = p_store_id) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM sales WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_existing); END IF;
  END IF;
  IF p_product_id IS NULL THEN
    v_designation := 'Prestation';
  ELSE
    SELECT id, display_name, prix_achat, stock_actuel, stock_disponible INTO v_prod
      FROM products WHERE id = p_product_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
    IF v_prod.stock_disponible <= 0 THEN RAISE EXCEPTION 'Ce produit est en rupture de stock disponible.'; END IF;
    IF p_quantite > v_prod.stock_disponible THEN RAISE EXCEPTION 'Stock disponible insuffisant pour "%".', v_prod.display_name; END IF;
    v_designation := v_prod.display_name;
    v_prix_achat := v_prod.prix_achat;
  END IF;
  v_total := p_quantite * p_prix_vente_unit;
  v_total_achat_ref := p_quantite * v_prix_achat;
  IF COALESCE(p_montant_paye_initial, 0) > v_total THEN RAISE EXCEPTION 'Paiement refusé.'; END IF;
  v_sale_id := gen_random_uuid();
  IF p_product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel - p_quantite WHERE id = p_product_id AND store_id = p_store_id;
  END IF;
  INSERT INTO sales (id, store_id, owner_id, date, product_id, designation, quantite, prix_vente_unit, total_vente,
    prix_achat_unit_ref, total_achat_ref, marge_totale, vendeur, client_credit, client_id, montant_paye, solde_du, statut_credit, idempotency_key)
  VALUES (v_sale_id, p_store_id, v_owner, p_date, p_product_id, v_designation, p_quantite, p_prix_vente_unit, v_total,
    v_prix_achat, v_total_achat_ref, v_total - v_total_achat_ref, COALESCE(p_vendeur, ''), p_client_credit, p_client_id,
    0, v_total, 'Impayé', p_idempotency_key);
  IF p_product_id IS NOT NULL THEN
    INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
    VALUES (p_store_id, p_product_id, 'vente', -p_quantite, 0, 'sale', v_sale_id, v_owner);
  END IF;
  IF COALESCE(p_montant_paye_initial, 0) > 0 THEN
    PERFORM public.add_payment(p_store_id, NULL, v_sale_id, p_montant_paye_initial, p_methode, NULL, NULL,
      CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE p_idempotency_key || ':payment' END);
  END IF;
  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_sale_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.create_sale_ticket(p_store_id uuid, p_date date, p_vendeur text, p_client_credit text, p_client_id uuid, p_montant_paye_total numeric, p_methode text, p_lignes jsonb, p_idempotency_key text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_ligne jsonb; v_index int := 0; v_total numeric := 0; v_reste numeric; v_part numeric; v_ligne_tot numeric;
  v_ticket uuid; v_vente jsonb; v_vente_id uuid; v_produit uuid; v_ids uuid[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_total := v_total + (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;
  END LOOP;
  IF COALESCE(p_montant_paye_total, 0) > v_total THEN RAISE EXCEPTION 'Paiement refusé.'; END IF;
  v_ticket := gen_random_uuid();
  v_reste  := COALESCE(p_montant_paye_total, 0);
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_index := v_index + 1;
    v_ligne_tot := (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;
    v_part  := LEAST(v_reste, v_ligne_tot);
    v_reste := v_reste - v_part;
    v_produit := NULLIF(v_ligne->>'product_id', '')::uuid;
    v_vente := public.create_sale(p_store_id, p_date, v_produit, (v_ligne->>'quantite')::int,
      (v_ligne->>'prix_vente_unit')::numeric, p_vendeur, p_client_credit, p_client_id, v_part, p_methode,
      p_idempotency_key || ':' || v_index);
    v_vente_id := (v_vente->>'id')::uuid;
    UPDATE sales SET ticket_id = v_ticket WHERE id = v_vente_id;
    v_ids := array_append(v_ids, v_vente_id);
  END LOOP;
  RETURN jsonb_build_object('ticket_id', v_ticket,
    'ventes', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM sales s WHERE s.id = ANY(v_ids)));
END; $function$;

CREATE OR REPLACE FUNCTION public.delete_sale(p_sale_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_sale record;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable (déjà supprimée ?).'; END IF;
  IF NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF EXISTS (SELECT 1 FROM payments WHERE sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'Suppression impossible : cette vente a un historique de paiement.';
  END IF;
  IF v_sale.product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel + v_sale.quantite WHERE id = v_sale.product_id;
    INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
    VALUES (v_sale.store_id, v_sale.product_id, 'vente_suppression', v_sale.quantite, 0, 'sale', p_sale_id, auth.uid());
  END IF;
  DELETE FROM sales WHERE id = p_sale_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.delete_purchase(p_purchase_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_purchase record; v_prod record;
BEGIN
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Achat introuvable (déjà supprimé ?).'; END IF;
  IF NOT can_modify_in_store(v_purchase.owner_id, v_purchase.store_id) THEN RAISE EXCEPTION 'Interdit.'; END IF;
  IF v_purchase.product_id IS NOT NULL THEN
    SELECT id, display_name, stock_actuel, stock_reserve INTO v_prod FROM products WHERE id = v_purchase.product_id FOR UPDATE;
    IF FOUND THEN
      IF v_prod.stock_actuel - v_purchase.quantite < 0 THEN RAISE EXCEPTION 'Stock insuffisant.'; END IF;
      UPDATE products SET stock_actuel = stock_actuel - v_purchase.quantite WHERE id = v_purchase.product_id;
      INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
      VALUES (v_purchase.store_id, v_purchase.product_id, 'achat_suppression', -v_purchase.quantite, 0, 'purchase', p_purchase_id, auth.uid());
    END IF;
  END IF;
  DELETE FROM purchases WHERE id = p_purchase_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.ajuster_stock(p_product_id uuid, p_delta integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_produit products%ROWTYPE; v_nouveau integer;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN RAISE EXCEPTION 'Indiquez une quantite a ajouter ou a retirer.'; END IF;
  SELECT * INTO v_produit FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable.'; END IF;
  IF store_is_locked(v_produit.store_id) THEN RAISE EXCEPTION 'Boutique verrouillee.'; END IF;
  IF NOT can_modify_in_store(v_produit.owner_id, v_produit.store_id) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de modifier ce produit.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_nouveau := v_produit.stock_actuel + p_delta;
  IF v_nouveau < 0 THEN RAISE EXCEPTION 'Stock insuffisant : il reste % unite(s), vous en retirez %.', v_produit.stock_actuel, abs(p_delta); END IF;
  UPDATE products SET stock_actuel = v_nouveau WHERE id = p_product_id;
  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by, note)
  VALUES (v_produit.store_id, p_product_id, 'ajustement', p_delta, 0, NULL, NULL, auth.uid(),
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), CASE WHEN p_delta > 0 THEN 'Entree de stock' ELSE 'Sortie de stock' END));
  RETURN (SELECT to_jsonb(p) FROM products p WHERE p.id = p_product_id);
END; $function$;
`;

const db = new PGlite();
await db.exec(SCHEMA);
await db.exec(PRODUCTION);
await db.exec(readFileSync(fichierMigration, "utf8"));

let ok = 0;
let ko = 0;
const verifier = (nom, condition, detail = "") => {
  if (condition) ok++;
  else ko++;
  console.log(`${condition ? "✓" : "✗"} ${nom}${detail ? ` — ${detail}` : ""}`);
};
const refuse = async (nom, sql, motif) => {
  try {
    await db.query(sql);
    verifier(nom, false, "accepté à tort");
  } catch (e) {
    verifier(nom, !motif || String(e.message).includes(motif), e.message);
  }
};
const val = async (sql) => (await db.query(sql)).rows[0];
const lots = async (produit) =>
  (
    await db.query(
      `SELECT numero_lot, quantite FROM pharma_lots WHERE product_id = '${produit}' ORDER BY numero_lot`,
    )
  ).rows
    .map((r) => `${r.numero_lot}:${r.quantite}`)
    .join(" ");
const stock = async (produit) =>
  (await val(`SELECT stock_actuel FROM products WHERE id = '${produit}'`)).stock_actuel;
const aujourdhui = new Date().toISOString().slice(0, 10);
const plus = (jours) => new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10);

console.log("\n— Réception");
await db.query(
  `SELECT pharma_recevoir('${BOUTIQUE}', '${aujourdhui}', 'Grossiste A', $1::jsonb, NULL, NULL, 'rec1')`,
  [
    JSON.stringify([
      {
        product_id: AMOX,
        quantite: 10,
        prix_achat_unit: 1000,
        numero_lot: "TARD",
        date_peremption: plus(400),
      },
      {
        product_id: AMOX,
        quantite: 5,
        prix_achat_unit: 1100,
        numero_lot: "TOT",
        date_peremption: plus(60),
      },
    ]),
  ],
);
verifier("le stock monte de la livraison", (await stock(AMOX)) === 15);
verifier(
  "un lot par ligne, avec sa quantité",
  (await lots(AMOX)) === "TARD:10 TOT:5",
  await lots(AMOX),
);
verifier(
  "deux achats ordinaires, payés",
  (await val(`SELECT count(*)::int n, sum(impact_tresorerie)::int t FROM purchases`)).t === -15500,
);
await db.query(
  `SELECT pharma_recevoir('${BOUTIQUE}', '${aujourdhui}', 'Grossiste A', $1::jsonb, NULL, NULL, 'rec1')`,
  [
    JSON.stringify([
      {
        product_id: AMOX,
        quantite: 10,
        prix_achat_unit: 1000,
        numero_lot: "TARD",
        date_peremption: plus(400),
      },
    ]),
  ],
);
verifier("une réception rejouée n'entre pas deux fois", (await stock(AMOX)) === 15);
await db.query(
  `SELECT pharma_recevoir('${BOUTIQUE}', '${aujourdhui}', 'Grossiste B', $1::jsonb, 3000, '${plus(30)}', 'rec2')`,
  [
    JSON.stringify([
      {
        product_id: DOLI,
        conditionnement_id: "boite",
        nombre: 2,
        prix_conditionnement: 7000,
        numero_lot: "D1",
        date_peremption: plus(200),
      },
    ]),
  ],
);
verifier(
  "une réception au carton entre en unités de base",
  (await stock(DOLI)) === 20 && (await lots(DOLI)) === "D1:20",
);
verifier(
  "le règlement partiel laisse une dette fournisseur",
  (await val(`SELECT impact_tresorerie::int t FROM purchases WHERE idempotency_key = 'rec2:1'`))
    .t === -3000,
);
await refuse(
  "réception refusée si le règlement dépasse le total",
  `SELECT pharma_recevoir('${BOUTIQUE}', '${aujourdhui}', 'X', '[{"product_id":"${AMOX}","quantite":1,"prix_achat_unit":100}]'::jsonb, 500, NULL, 'rec3')`,
  "compris entre 0",
);

console.log("\n— Vente : le premier qui périme sort le premier");
const ticket =
  await val(`SELECT create_sale_ticket('${BOUTIQUE}', '${aujourdhui}', 'Lova', NULL, NULL, 0, 'especes',
  '[{"product_id":"${AMOX}","quantite":7,"prix_vente_unit":2500}]'::jsonb, 'v1') AS t`);
const vente1 = ticket.t.ventes[0].id;
verifier(
  "le lot qui périme tôt part avant l'autre",
  (await lots(AMOX)) === "TARD:8 TOT:0",
  await lots(AMOX),
);
verifier(
  "la vente est tracée lot par lot",
  (
    await val(
      `SELECT count(*)::int n FROM pharma_lot_mouvements WHERE reference_id = '${vente1}' AND motif = 'vente'`,
    )
  ).n === 2,
);

console.log("\n— Vente annulée");
await db.query(`SELECT delete_sale('${vente1}')`);
verifier(
  "les boîtes reviennent dans leurs lots",
  (await lots(AMOX)) === "TARD:10 TOT:5",
  await lots(AMOX),
);
verifier("le stock revient", (await stock(AMOX)) === 15);

console.log("\n— Lot périmé");
await db.query(
  `SELECT pharma_corriger_lot((SELECT id FROM pharma_lots WHERE numero_lot = 'TOT'), 'TOT', '${plus(-3)}')`,
);
await db.query(`SELECT create_sale_ticket('${BOUTIQUE}', '${aujourdhui}', 'Lova', NULL, NULL, 2500, 'especes',
  '[{"product_id":"${AMOX}","quantite":1,"prix_vente_unit":2500}]'::jsonb, 'v2')`);
verifier("une vente évite le lot périmé", (await lots(AMOX)) === "TARD:9 TOT:5", await lots(AMOX));
await db.query(
  `SELECT pharma_retirer_lot((SELECT id FROM pharma_lots WHERE numero_lot = 'TOT'), 5, 'perime', 'destruction')`,
);
verifier(
  "le retrait vide CE lot, pas un autre",
  (await lots(AMOX)) === "TARD:9 TOT:0",
  await lots(AMOX),
);
verifier("le retrait baisse le stock", (await stock(AMOX)) === 9);
verifier(
  "le retrait est un ajustement visible dans l'historique",
  (
    await val(
      `SELECT note FROM stock_movements WHERE type_mouvement = 'ajustement' ORDER BY created_at DESC LIMIT 1`,
    )
  ).note === "Périmé · lot TOT · destruction",
);
await refuse(
  "on ne retire pas plus que le lot",
  `SELECT pharma_retirer_lot((SELECT id FROM pharma_lots WHERE numero_lot = 'TARD'), 50, 'casse', NULL)`,
  "unité(s) en rayon",
);
await refuse(
  "une raison inconnue est refusée",
  `SELECT pharma_retirer_lot((SELECT id FROM pharma_lots WHERE numero_lot = 'TARD'), 1, 'vol', NULL)`,
  "Raison",
);

console.log("\n— Stock sans date");
await db.query(`SELECT ajuster_stock('${AMOX}', 4, 'Inventaire')`);
verifier(
  "une entrée d'inventaire reste sans date",
  (await lots(AMOX)) === "TARD:9 TOT:0" && (await stock(AMOX)) === 13,
);
await db.query(`SELECT pharma_dater_stock('${AMOX}', 'VIEUX', '${plus(90)}', 3)`);
verifier(
  "dater crée un lot sans changer le stock",
  (await lots(AMOX)) === "TARD:9 TOT:0 VIEUX:3" && (await stock(AMOX)) === 13,
);
await refuse(
  "on ne date pas plus que le stock sans date",
  `SELECT pharma_dater_stock('${AMOX}', 'X', NULL, 2)`,
  "Il ne reste que 1",
);
await db.query(`SELECT ajuster_stock('${AMOX}', -2, 'Inventaire')`);
verifier(
  "un inventaire en baisse corrige le premier lot",
  (await lots(AMOX)) === "TARD:9 TOT:0 VIEUX:1",
  await lots(AMOX),
);

console.log("\n— Achat supprimé");
const achatDoli = (await val(`SELECT id FROM purchases WHERE idempotency_key = 'rec2:1'`)).id;
await db.query(`SELECT delete_purchase('${achatDoli}')`);
verifier(
  "supprimer la livraison vide son lot",
  (await lots(DOLI)) === "D1:0" && (await stock(DOLI)) === 0,
);

console.log("\n— Produit sans lot (toute autre boutique)");
await db.query(`UPDATE products SET stock_actuel = 10 WHERE id = '${SAVON}'`);
await db.query(`SELECT create_sale_ticket('${BOUTIQUE}', '${aujourdhui}', 'Lova', NULL, NULL, 900, 'especes',
  '[{"product_id":"${SAVON}","quantite":1,"prix_vente_unit":900}]'::jsonb, 'v3')`);
verifier(
  "une vente ordinaire ne crée aucun lot",
  (await val(`SELECT count(*)::int n FROM pharma_lots WHERE product_id = '${SAVON}'`)).n === 0 &&
    (await stock(SAVON)) === 9,
);

console.log("\n— Ordonnancier");
await db.query(
  `INSERT INTO pharma_ordonnances (store_id, patient_nom) VALUES ('${BOUTIQUE}', 'Rabe'), ('${BOUTIQUE}', 'Vola')`,
);
const numeros = (await db.query(`SELECT numero FROM pharma_ordonnances ORDER BY numero`)).rows
  .map((r) => r.numero)
  .join(",");
verifier("les ordonnances se numérotent dans l'ordre", numeros === "1,2", numeros);
await refuse(
  "un numéro du registre ne se change pas",
  `UPDATE pharma_ordonnances SET numero = 5 WHERE numero = 1`,
  "garde sa boutique et son numéro",
);
await db.query(
  `INSERT INTO pharma_ordonnances (store_id, patient_nom) VALUES ('${AUTRE_BOUTIQUE}', 'X')`,
);
verifier(
  "chaque boutique a son propre registre",
  (await val(`SELECT numero FROM pharma_ordonnances WHERE store_id = '${AUTRE_BOUTIQUE}'`))
    .numero === 1,
);

console.log("\n— Droits");
await db.query(`UPDATE auth.session SET uid = '${INTRUS}'`);
await refuse(
  "un étranger ne reçoit pas dans la boutique",
  `SELECT pharma_recevoir('${BOUTIQUE}', '${aujourdhui}', 'X', '[{"product_id":"${AMOX}","quantite":1,"prix_achat_unit":1}]'::jsonb, NULL, NULL, 'x1')`,
  "Non autorisé",
);
await refuse(
  "un étranger ne date pas le stock",
  `SELECT pharma_dater_stock('${AMOX}', 'X', NULL, 1)`,
  "Non autorisé",
);
await refuse(
  "un étranger ne retire pas un lot",
  `SELECT pharma_retirer_lot((SELECT id FROM pharma_lots WHERE numero_lot = 'TARD'), 1, 'casse', NULL)`,
  "droit",
);
await db.query(`UPDATE auth.session SET uid = '${MOI}'`);

if (fichierRetour) {
  console.log("\n— Retour arrière");
  await db.exec(readFileSync(fichierRetour, "utf8"));
  const restantes = (
    await val(
      `SELECT count(*)::int n FROM information_schema.tables WHERE table_name LIKE 'pharma_%'`,
    )
  ).n;
  verifier("le retour arrière retire toutes les tables", restantes === 0);
  await db.query(`SELECT ajuster_stock('${AMOX}', -1, 'après retour')`);
  verifier("le stock fonctionne encore sans la pharmacie", (await stock(AMOX)) === 10);
}

console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
process.exit(ko > 0 ? 1 : 0);

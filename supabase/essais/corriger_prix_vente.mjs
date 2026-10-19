// BANC D'ESSAI — migration 20261019083335_corriger_prix_vente
//
// Rejoue la migration et son retour arrière dans un Postgres embarqué
// (PGlite), sur une réplique minimale des tables concernées, sans jamais
// toucher à la production. `recalculer_solde_vente` et `can_modify_in_store`
// sont repris tels qu'ils sont en production (lus le 19 octobre).
//
// Lancer (PGlite installé à part, hors du projet) :
//   mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite@0.2.17
//   node supabase/essais/corriger_prix_vente.mjs /tmp/pg \
//     supabase/migrations/20261019083335_corriger_prix_vente.sql \
//     supabase/retours-arriere/20261019083335_corriger_prix_vente.sql

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [, , dossierPg, fichierMigration, fichierRetour] = process.argv;
const { PGlite } = await import(
  pathToFileURL(path.join(dossierPg, "node_modules/@electric-sql/pglite/dist/index.js")).href
);

const MOI = "00000000-0000-0000-0000-000000000001";
const AUTRE = "00000000-0000-0000-0000-000000000002";
const BOUTIQUE = "10000000-0000-0000-0000-000000000001";

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.session (uid uuid);
INSERT INTO auth.session VALUES ('${MOI}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT uid FROM auth.session LIMIT 1 $$;
CREATE TABLE stores (id uuid PRIMARY KEY, owner_id uuid, verrouillee boolean DEFAULT false);
INSERT INTO stores VALUES ('${BOUTIQUE}', '${MOI}', false);
CREATE FUNCTION store_is_locked(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT verrouillee FROM stores WHERE id = p $$;
CREATE FUNCTION is_store_owner(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT owner_id = auth.uid() FROM stores WHERE id = p $$;
CREATE FUNCTION can_modify_in_store(p_owner_id uuid, p_store_id uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT ((p_owner_id = auth.uid()) OR is_store_owner(p_store_id)) AND NOT store_is_locked(p_store_id) $$;
CREATE TABLE sales (
  id uuid PRIMARY KEY, store_id uuid, owner_id uuid, quantite int CHECK (quantite > 0),
  prix_vente_unit numeric, total_vente numeric, total_achat_ref numeric, marge_totale numeric,
  commission numeric DEFAULT 0, montant_paye numeric DEFAULT 0, montant_avoire numeric DEFAULT 0,
  solde_du numeric DEFAULT 0, statut_credit text, updated_at timestamptz,
  CONSTRAINT sales_montant_avoire_borne CHECK (montant_avoire >= 0 AND montant_avoire <= total_vente));
CREATE TABLE payments (id serial, sale_id uuid, montant numeric);
CREATE FUNCTION recalculer_solde_vente(p_sale_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_total numeric; v_avoire numeric; v_paye numeric; v_net numeric;
BEGIN
  SELECT total_vente, montant_avoire INTO v_total, v_avoire FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(montant), 0) INTO v_paye FROM payments WHERE sale_id = p_sale_id;
  v_net := v_total - v_avoire;
  UPDATE sales SET montant_paye = v_paye, solde_du = GREATEST(v_net - v_paye, 0),
    statut_credit = CASE WHEN v_avoire > 0 AND v_net <= 0 THEN 'Payé' WHEN v_paye <= 0 THEN 'Impayé'
      WHEN v_paye >= v_net THEN 'Payé' ELSE 'Partiel' END, updated_at = NOW()
  WHERE id = p_sale_id;
END $$;
`;

const vente = (id, owner, qte, prix, achat, paye = 0, avoire = 0, commission = 0) => `
  INSERT INTO sales (id, store_id, owner_id, quantite, prix_vente_unit, total_vente, total_achat_ref, marge_totale, commission, montant_avoire)
  VALUES ('${id}', '${BOUTIQUE}', '${owner}', ${qte}, ${prix}, ${qte * prix}, ${achat}, ${qte * prix - achat}, ${commission}, ${avoire});
  ${paye > 0 ? `INSERT INTO payments (sale_id, montant) VALUES ('${id}', ${paye});` : ""}
  SELECT recalculer_solde_vente('${id}');`;

const db = new PGlite();
await db.exec(SCHEMA);
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
    verifier(nom, String(e.message).includes(motif), e.message);
  }
};
const ligne = async (id) => (await db.query(`SELECT * FROM sales WHERE id = '${id}'`)).rows[0];

const V1 = "20000000-0000-0000-0000-000000000001";
const V2 = "20000000-0000-0000-0000-000000000002";
const V3 = "20000000-0000-0000-0000-000000000003";
await db.exec(vente(V1, MOI, 3, 1500, 3000, 1000)); // total 4 500, payé 1 000
await db.exec(vente(V2, AUTRE, 2, 1000, 1000)); // vente d'un collaborateur
await db.exec(vente(V3, MOI, 2, 2000, 2000, 0, 0, 1500)); // commission 1 500

// 1. Correction normale : prix, total, marge, solde, statut.
await db.query(`SELECT corriger_prix_vente('${V1}', 1200)`);
let v = await ligne(V1);
verifier("prix corrigé", Number(v.prix_vente_unit) === 1200);
verifier("total = quantité × prix", Number(v.total_vente) === 3600);
verifier("marge = total − coût", Number(v.marge_totale) === 600);
verifier("solde = total − payé", Number(v.solde_du) === 2600);
verifier("statut « Partiel »", v.statut_credit === "Partiel");

// 2. Refus.
await refuse("total sous le déjà payé", `SELECT corriger_prix_vente('${V1}', 300)`, "Prix refusé");
await refuse("prix négatif", `SELECT corriger_prix_vente('${V1}', -1)`, "Prix invalide");
await refuse("commission au-dessus du total", `SELECT corriger_prix_vente('${V3}', 500)`, "commission");
v = await ligne(V1);
verifier("un refus ne change rien", Number(v.total_vente) === 3600);

// 3. Le propriétaire peut corriger la vente d'un collaborateur ; un tiers non.
await db.query(`SELECT corriger_prix_vente('${V2}', 1100)`);
verifier("propriétaire : vente d'un collaborateur corrigée", Number((await ligne(V2)).total_vente) === 2200);
await db.exec(`UPDATE auth.session SET uid = '30000000-0000-0000-0000-000000000009'`);
await refuse("un tiers ne peut pas corriger", `SELECT corriger_prix_vente('${V1}', 1500)`, "Non autorisé");
await db.exec(`UPDATE auth.session SET uid = '${MOI}'`);

// 4. Boutique verrouillée : refus.
await db.exec(`UPDATE stores SET verrouillee = true`);
await refuse("boutique verrouillée", `SELECT corriger_prix_vente('${V1}', 1500)`, "Non autorisé");
await db.exec(`UPDATE stores SET verrouillee = false`);

// 5. Sans session : refus.
await db.exec(`DELETE FROM auth.session`);
await refuse("sans session", `SELECT corriger_prix_vente('${V1}', 1500)`, "Non authentifié");
await db.exec(`INSERT INTO auth.session VALUES ('${MOI}')`);

// 6. Droits : authenticated oui, anon non.
const droit = async (role) =>
  (
    await db.query(
      `SELECT has_function_privilege('${role}', 'corriger_prix_vente(uuid, numeric)', 'EXECUTE') AS d`,
    )
  ).rows[0].d;
verifier("authenticated peut l'appeler", (await droit("authenticated")) === true);
verifier("anon ne peut pas l'appeler", (await droit("anon")) === false);

// 7. Retour arrière : la fonction disparaît, les données restent.
await db.exec(readFileSync(fichierRetour, "utf8"));
const existe = (
  await db.query(`SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'corriger_prix_vente'`)
).rows[0].n;
verifier("retour arrière : fonction retirée", existe === 0);
verifier("retour arrière : la vente corrigée reste", Number((await ligne(V1)).total_vente) === 3600);

console.log(`\n${ok} contrôles verts, ${ko} rouges.`);
process.exit(ko === 0 ? 0 : 1);

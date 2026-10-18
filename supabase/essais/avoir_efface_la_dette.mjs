// BANC D'ESSAI — migration 20261018055411_avoir_efface_la_dette
//
// Rejoue la migration et son retour arrière dans un Postgres embarqué
// (PGlite), sur une réplique minimale des tables concernées, sans jamais
// toucher à la base de production. Scénarios : avoir partiel, avoir total
// sur facture impayée, répartition sur un ticket de plusieurs lignes,
// garde-fous d'encaissement et de modification, droits de la fonction
// interne, retour arrière, refus si des avoirs existent déjà.
//
// Lancer (PGlite installé à part, hors du projet) :
//   mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite@0.2.17
//   node supabase/essais/avoir_efface_la_dette.mjs /tmp/pg \
//     supabase/migrations/20261018055411_avoir_efface_la_dette.sql \
//     supabase/retours-arriere/20261018055411_avoir_efface_la_dette.sql
//
// Résultat au 18 octobre 2026 : 16 contrôles, tous verts.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [, , dossierPg, fichierMigration, fichierRetour] = process.argv;
const { PGlite } = await import(
  pathToFileURL(path.join(dossierPg, "node_modules/@electric-sql/pglite/dist/index.js")).href
);

const migration = readFileSync(fichierMigration, "utf8");
const retour = readFileSync(fichierRetour, "utf8");

// Les quatre fonctions d'origine = le début du retour arrière, sans
// l'UPDATE (la colonne n'existe pas encore) ni les DROP de fin.
const fonctionsOrigine = retour
  .slice(retour.indexOf("CREATE OR REPLACE FUNCTION public.update_order_payment_status"))
  .split("-- ── Ce que la migration avait ajouté")[0];

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TYPE payment_status AS ENUM ('impaye','partiel','paye');
CREATE TABLE clients (id uuid PRIMARY KEY, store_id uuid);
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, stock_actuel int, stock_disponible int);
CREATE TABLE stock_movements (id serial, store_id uuid, product_id uuid, type_mouvement text, stock_actuel_delta int, stock_reserve_delta int, reference_type text, reference_id uuid, created_by uuid);
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid, owner_id uuid, ticket_id uuid,
  product_id uuid, quantite int DEFAULT 1, prix_achat_unit_ref numeric DEFAULT 0,
  total_vente numeric DEFAULT 0, total_achat_ref numeric DEFAULT 0, marge_totale numeric DEFAULT 0,
  montant_paye numeric DEFAULT 0, solde_du numeric DEFAULT 0, statut_credit text DEFAULT 'Payé',
  client_credit text, client_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz);
CREATE TABLE orders (id uuid PRIMARY KEY, montant_total numeric, montant_paye numeric, statut_paiement payment_status, updated_at timestamptz);
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid, order_id uuid, montant numeric);
CREATE TABLE avoirs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid, ticket_id uuid, facture_numero text, client_id uuid, client_nom text, motif text, montant numeric, created_by uuid, date date DEFAULT current_date);
CREATE TABLE avoir_items (id serial, avoir_id uuid, store_id uuid, product_id uuid, designation text, quantite numeric, prix_unitaire numeric, total numeric, ordre int);
CREATE FUNCTION store_allows_write(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION can_modify_in_store(uuid, uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
`;

const DECLENCHEURS = `
CREATE TRIGGER payments_check_balance BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION check_payment_does_not_exceed_balance();
CREATE TRIGGER payments_update_order AFTER INSERT OR DELETE OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_order_payment_status();
`;

const S = "11111111-1111-1111-1111-111111111111";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) echecs++;
};
const doitEchouer = async (db, sql, motif, msg) => {
  try {
    await db.exec(sql);
    ok(false, `${msg} (aucune erreur levée)`);
  } catch (e) {
    ok(String(e.message).includes(motif), `${msg} — « ${String(e.message).slice(0, 90)} »`);
  }
};

async function nouvelleBase() {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(fonctionsOrigine);
  await db.exec(DECLENCHEURS);
  return db;
}
const vente = async (db, id, ticket, total, cree = "2026-10-01T10:00:00Z") =>
  db.exec(`INSERT INTO sales (id, store_id, ticket_id, total_vente, solde_du, statut_credit, created_at)
           VALUES ('${id}', '${S}', ${ticket ? `'${ticket}'` : "NULL"}, ${total}, ${total}, 'Impayé', '${cree}')`);
const payer = (db, id, m) =>
  db.exec(`INSERT INTO payments (sale_id, montant) VALUES ('${id}', ${m})`);
const avoir = (db, ticket, m) =>
  db.exec(
    `SELECT creer_avoir('${S}', '${ticket}', 'F', NULL, 'Client', 'motif', ${m}, '[]'::jsonb)`,
  );
const ligne = async (db, id) =>
  (
    await db.query(
      `SELECT total_vente::float t, montant_paye::float p, montant_avoire::float a, solde_du::float d, statut_credit s FROM sales WHERE id='${id}'`,
    )
  ).rows[0];

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "aaaaaaaa-0000-0000-0000-000000000002";
const C = "aaaaaaaa-0000-0000-0000-000000000003";
const D = "aaaaaaaa-0000-0000-0000-000000000004";
const T2 = "bbbbbbbb-0000-0000-0000-000000000002";

// ── 1. La migration s'applique et ne change rien aux ventes existantes ──
console.log("1. Application");
const db = await nouvelleBase();
await vente(db, A, null, 100000);
await payer(db, A, 30000);
const avant = (await db.query(`SELECT solde_du::float d FROM sales WHERE id='${A}'`)).rows[0];
await db.exec(migration);
const apres = await ligne(db, A);
ok(
  avant.d === 70000 && apres.d === 70000 && apres.a === 0,
  "vente existante intacte (70 000 dus, avoiré 0)",
);

// ── 2. Avoir partiel sur une facture payée en partie ──
console.log("2. Avoir partiel");
await avoir(db, A, 50000);
let l = await ligne(db, A);
ok(
  l.a === 50000 && l.d === 20000 && l.s === "Partiel",
  `100 000 payés 30 000, avoir 50 000 → dû ${l.d}, ${l.s}`,
);
await doitEchouer(
  db,
  `INSERT INTO payments (sale_id, montant) VALUES ('${A}', 30000)`,
  "dépasse le reste",
  "encaisser au-delà de ce qui reste dû est refusé",
);
await payer(db, A, 20000);
l = await ligne(db, A);
ok(l.d === 0 && l.s === "Payé", "les 20 000 restants soldent la facture");

// ── 3. Facture impayée, avoir total ──
console.log("3. Avoir total sur facture impayée");
await vente(db, B, null, 80000);
await avoir(db, B, 80000);
l = await ligne(db, B);
ok(l.a === 80000 && l.d === 0 && l.s === "Payé", `dû ${l.d}, statut ${l.s}`);
await doitEchouer(
  db,
  `SELECT creer_avoir('${S}', '${B}', 'F', NULL, '', '', 1, '[]'::jsonb)`,
  "déjà été avoirée",
  "un second avoir au-delà du total est refusé",
);

// ── 4. Ticket de deux lignes : la dette d'abord ──
console.log("4. Répartition sur un ticket");
await vente(db, C, T2, 50000, "2026-10-01T10:00:00Z");
await vente(db, D, T2, 50000, "2026-10-01T10:00:01Z");
await payer(db, C, 50000);
await payer(db, D, 20000);
await avoir(db, T2, 60000);
const c = await ligne(db, C),
  d = await ligne(db, D);
ok(
  d.a === 30000 && c.a === 30000,
  `avoir 60 000 : 30 000 sur la ligne due, puis 30 000 sur la ligne payée (C ${c.a}, D ${d.a})`,
);
ok(c.d === 0 && d.d === 0, "plus rien n'est dû sur le ticket");

// ── 5. Modifier une vente ──
console.log("5. update_sale_quantity");
await doitEchouer(
  db,
  `SELECT update_sale_quantity('${A}', 1, 60000, NULL, NULL)`,
  "dépasseraient le nouveau total",
  "le total ne descend pas sous payé + avoiré (50 000 + 50 000)",
);
await vente(db, "aaaaaaaa-0000-0000-0000-000000000005", null, 40000);
await db.exec(
  `SELECT update_sale_quantity('aaaaaaaa-0000-0000-0000-000000000005', 2, 80000, NULL, NULL)`,
);
l = await ligne(db, "aaaaaaaa-0000-0000-0000-000000000005");
ok(
  l.t === 80000 && l.d === 80000 && l.s === "Impayé",
  "sans avoir, la modification se comporte comme avant",
);

// ── 6. Droits de la fonction interne ──
console.log("6. Droits");
const droits = (
  await db.query(
    `SELECT has_function_privilege('authenticated', 'recalculer_solde_vente(uuid)', 'EXECUTE') a, has_function_privilege('anon', 'recalculer_solde_vente(uuid)', 'EXECUTE') b`,
  )
).rows[0];
ok(
  !droits.a && !droits.b,
  "recalculer_solde_vente n'est appelable ni par authenticated ni par anon",
);

// ── 7. Retour arrière ──
console.log("7. Retour arrière");
await db.exec(retour);
const col = (
  await db.query(
    `SELECT count(*)::int n FROM information_schema.columns WHERE table_name='sales' AND column_name='montant_avoire'`,
  )
).rows[0].n;
ok(col === 0, "la colonne montant_avoire a disparu");
l = (await db.query(`SELECT solde_du::float d, statut_credit s FROM sales WHERE id='${B}'`))
  .rows[0];
ok(
  l.d === 80000 && l.s === "Impayé",
  `la vente avoirée retrouve l'ancienne règle (dû ${l.d}, ${l.s})`,
);
await payer(db, B, 10000);
l = (await db.query(`SELECT solde_du::float d FROM sales WHERE id='${B}'`)).rows[0];
ok(l.d === 70000, "les anciens déclencheurs fonctionnent de nouveau");

// ── 8. Garde-fou : des avoirs existent déjà ──
console.log("8. Garde-fou");
const db2 = await nouvelleBase();
await vente(db2, A, null, 100000);
await db2.exec(`SELECT creer_avoir('${S}', '${A}', 'F', NULL, '', '', 10000, '[]'::jsonb)`);
await doitEchouer(
  db2,
  migration,
  "Des avoirs liés à une facture existent",
  "la migration refuse de s'appliquer",
);

console.log(echecs === 0 ? "\nTOUT EST VERT" : `\n${echecs} ÉCHEC(S)`);
process.exit(echecs === 0 ? 0 : 1);

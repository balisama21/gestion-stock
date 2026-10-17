const fs = require("fs");
const { COLS, CONS } = require("./schema");
const { TABLES } = require("./descriptions");
const rel = [];
for (const [t, s] of Object.entries(CONS)) {
  for (const c of s.split(" ; ")) {
    const m = c.match(/^FK (.+?)>(\S+)( CASCADE| SETNULL)?$/);
    if (!m) continue;
    const parent = m[2];
    if (parent.startsWith("auth.")) continue;
    const cols = m[1].split(/,\s*/).filter((x) => x !== "store_id");
    if (parent === "stores" && cols.length === 0) continue; // store_id : omis (toutes les tables)
    for (const col of cols.length ? cols : ["store_id"]) rel.push([parent, t, col]);
  }
}
const metier = (t) => ["M", "L"].includes(TABLES[t][0]) || ["stores", "profiles", "store_members", "categories"].includes(t);
const lignes = rel.filter(([p, e]) => metier(p) && metier(e)).map(([p, e, c]) => `    ${p} ||--o{ ${e} : "${c}"`);
const ent = Object.keys(COLS).filter(metier).sort().map((t) => {
  const cols = COLS[t].filter((c) => c.nom === "id" || c.nom.endsWith("_id") || ["nom", "designation", "numero", "statut", "montant", "total_vente", "total_achat", "montant_total", "stock_actuel", "stock_reserve"].includes(c.nom));
  return `    ${t} {\n${cols.map((c) => `        ${c.type.replace(/[^a-z0-9_]/gi, "_")} ${c.nom}${c.nom === "id" ? " PK" : c.nom.endsWith("_id") ? " FK" : ""}`).join("\n")}\n    }`;
});
const md = `# Tantana Suite — Schéma relationnel (complément technique)

Relevé en lecture seule sur la base de production le 12 octobre 2026 (schéma \`public\`), complété le
17 octobre 2026 des tables créées le 16 octobre (IA, journal des imports) d'après les migrations du dépôt.
Ce fichier complète la partie 7 du manuel d'utilisation. Il se lit avec un visualiseur Mermaid
(GitHub, VS Code, mermaid.live).

Conventions :
- Toutes les tables de la boutique portent \`store_id\` → \`stores\` ; ce lien est omis du diagramme pour la lisibilité.
- Seules les tables métier et de liaison sont représentées ; les tables techniques et de plateforme figurent dans le manuel (§ 7.5 et 7.6).
- Libellé d'une relation = colonne de la table enfant qui porte la clé étrangère.

\`\`\`mermaid
erDiagram
${lignes.join("\n")}
${ent.join("\n")}
\`\`\`

## Liste des clés étrangères (toutes tables, hors \`store_id\` et comptes d'authentification)

| Table enfant | Colonne | Table parente |
|---|---|---|
${rel.filter(([, , c]) => c !== "store_id").sort((a, b) => a[1].localeCompare(b[1])).map(([p, e, c]) => `| ${e} | ${c} | ${p} |`).join("\n")}
`;
fs.writeFileSync(process.argv[2], md);
console.log("OK", lignes.length, "relations");

/** BANC VIVANT — FICHIER TEMPORAIRE, supprimé en fin de mission. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DocumentPreview, type FormatDocument } from "./DocumentPreview";
import { documentDeVente } from "./lib/buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, V024, V025, V026 } from "./lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT as R, type ModeleDocument } from "./lib/reglages";
import type { Sale } from "../../types";

const base = { produits: PRODUITS, boutique: BOUTIQUE, reglages: R };

const panier = (n: number): Sale[] =>
  Array.from({ length: n }, (_, i) => {
    const modele = [V024, V025, V026][i % 3];
    return {
      ...modele,
      id: `l-${i}`,
      ticketId: "t",
      montantPaye: i === 0 ? 100000 : 0,
      soldeDu: i === 0 ? 200000 : modele.totalVente,
      saisieLe: "2026-09-19T06:41:00.000Z",
    };
  });

const CAS = [
  {
    titre: "1 ligne, payée",
    doc: documentDeVente({
      ...base,
      ventes: [{ ...V026, saisieLe: "2026-09-19T06:41:00.000Z" }],
      paiements: [PAIEMENT],
    }),
  },
  {
    titre: "3 lignes, client complet, TVA",
    doc: documentDeVente({
      ...base,
      ventes: panier(3),
      client: CLIENT,
      paiements: [PAIEMENT],
      reglages: { ...R, options: { ...R.options, tva: true } },
    }),
  },
  {
    titre: "25 lignes — la pagination",
    doc: documentDeVente({ ...base, ventes: panier(25), paiements: [PAIEMENT] }),
  },
];

const MODELES: ModeleDocument[] = ["classique", "bandeau", "epure", "compact"];
const FORMATS: FormatDocument[] = ["a4", "t80", "t58"];

function Banc() {
  const [modele, setModele] = useState<ModeleDocument>("classique");
  const [format, setFormat] = useState<FormatDocument>("a4");
  const [cas, setCas] = useState(0);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {MODELES.map((m) => (
          <button
            key={m}
            onClick={() => setModele(m)}
            style={{ fontWeight: m === modele ? 700 : 400 }}
          >
            {m}
          </button>
        ))}
        <span style={{ width: 20 }} />
        {FORMATS.map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            style={{ fontWeight: f === format ? 700 : 400 }}
          >
            {f}
          </button>
        ))}
        <span style={{ width: 20 }} />
        {CAS.map((c, i) => (
          <button
            key={c.titre}
            onClick={() => setCas(i)}
            style={{ fontWeight: i === cas ? 700 : 400 }}
          >
            {c.titre}
          </button>
        ))}
      </div>
      <DocumentPreview document={CAS[cas].doc} reglages={R} modele={modele} format={format} />
    </div>
  );
}

createRoot(document.getElementById("banc")!).render(<Banc />);

import React from "react";
import type { CleColonne } from "../lib/buildDocument";
import { celluleDeLigne } from "../parts/cellules";
import { useEquivalentsDuDocument } from "../lib/equivalents";
import {
  BlocAdresse,
  CoordonneesPaiement,
  Marque,
  Mentions,
  MontantEnLettres,
  Reperes,
  Signature,
  TamponPaiement,
  Totaux,
} from "../parts/blocs";
import { Ressort, TeteSuite, type ProprietesModele } from "../parts/squelette";

/**
 * MODÈLE 4 — COMPACT
 *
 * Dense, numéroté, à faible hauteur de ligne : celui des factures à
 * beaucoup d'articles. C'est le seul dont le tableau lui est propre,
 * parce que c'est justement le tableau qui fait sa raison d'être.
 *
 * ── LE NUMÉRO DE LIGNE N'EST PAS DÉCORATIF ─────────────────────────
 *
 * Sur une facture de trente articles, « la ligne 17 » est la seule
 * façon de se comprendre au téléphone. Il compte à partir de un sur
 * le document entier, et non par page : c'est le rang de l'article
 * dans la commande, pas sa place sur la feuille.
 *
 * ── CE QU'IL SERRE, ET CE QU'IL NE SERRE PAS ───────────────────────
 *
 * Les hauteurs de ligne, les marges et les corps de texte se
 * resserrent. La lisibilité des CHIFFRES, elle, ne se négocie pas :
 * les montants gardent leur chasse fixe et leurs chiffres tabulaires,
 * sans quoi une colonne de trente nombres devient illisible — ce qui
 * ruinerait précisément ce pour quoi on a choisi ce modèle.
 */
/** Les abréviations du Compact : la densité est sa raison d'être. */
const COURT: Partial<Record<CleColonne, string>> = {
  quantite: "Qté",
  prixUnitaire: "P.U.",
};

const FORME: Record<CleColonne, { largeur?: string; align?: "center" | "right" }> = {
  designation: {},
  quantite: { largeur: "22mm", align: "center" },
  unite: { largeur: "18mm", align: "center" },
  prixUnitaire: { largeur: "26mm", align: "right" },
  total: { largeur: "28mm", align: "right" },
};

const CLASSE: Record<CleColonne, string> = {
  designation: "",
  quantite: "doc-qte",
  unite: "doc-qte",
  prixUnitaire: "doc-montant",
  total: "doc-montant",
};

export const Compact: React.FC<ProprietesModele> = ({
  document: d,
  lignes,
  premiere,
  derniere,
  pagination,
}) => {
  const avecUnite = d.colonnes.some((c) => c.cle === "unite");
  const equivalents = useEquivalentsDuDocument();
  // Le rang de chaque ligne dans le document entier, et non sur la page.
  const premierRang = d.lignes.findIndex((l) => l.id === lignes[0]?.id);
  const rangDe = (i: number) => (premierRang >= 0 ? premierRang + i : i) + 1;

  return (
    <div className="doc-pad doc-grow">
      {premiere ? (
        <div data-doc="tete" className="groupe-tete">
          <header className="tete">
            <div className="min0">
              <Marque emetteur={d.emetteur} />
              {(d.emetteur.lignes.length > 0 || d.emetteur.nif) && (
                <div className="coordonnees doc-muted">
                  {[...d.emetteur.lignes, d.emetteur.nif ? `NIF ${d.emetteur.nif}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </div>
            <div className="repere">
              <div className="doc-titre">{d.titre}</div>
              {d.tampon && (
                <div style={{ marginTop: "2mm" }}>
                  <TamponPaiement tampon={d.tampon} />
                </div>
              )}
            </div>
          </header>

          <div className="doc-blocs">
            <BlocAdresse bloc={d.destinataire} />
            <div style={{ textAlign: "right" }}>
              <Reperes meta={d.meta} pagination={pagination} />
            </div>
          </div>
        </div>
      ) : (
        <TeteSuite document={d} pagination={pagination} />
      )}

      <div data-doc="tableau">
        <table>
          <thead>
            <tr style={{ whiteSpace: "nowrap" }}>
              <th style={{ width: "10mm" }}>#</th>
              {d.colonnes.map((c) => (
                <th
                  key={c.cle}
                  style={{ textAlign: FORME[c.cle].align, width: FORME[c.cle].largeur }}
                >
                  {/* Les abréviations du Compact sont à lui : elles
                      s'effacent dès que la boutique a choisi son mot. */}
                  {c.personnalise ? c.libelle : (COURT[c.cle] ?? c.libelle)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.id}>
                <td className="doc-num doc-muted">{rangDe(i)}</td>
                {d.colonnes.map((c) => (
                  <td key={c.cle} className={CLASSE[c.cle] || undefined}>
                    {c.cle === "designation" ? (
                      <>
                        {l.designation}
                        {l.detail && <span className="doc-muted"> · {l.detail}</span>}
                      </>
                    ) : (
                      celluleDeLigne(c.cle, l, d.devise, avecUnite, equivalents)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {derniere ? (
        <div className="doc-cloture" data-doc="cloture">
          <div className="bas doc-insecable">
            <div>
              <MontantEnLettres texte={d.montantEnLettres} type={d.type} />
              <Mentions texte={d.mentions} />
              <CoordonneesPaiement lignes={d.coordonneesPaiement} />
            </div>
            <Totaux totaux={d.totaux} devise={d.devise} />
          </div>

          <Signature signatures={d.signatures} />
          <Ressort />

          <footer className="pied doc-insecable doc-muted">
            <span>{d.motDeFin}</span>
            <span>
              {d.piedDePage}
              {pagination ? ` · ${pagination}` : ""}
            </span>
          </footer>
        </div>
      ) : (
        <Ressort />
      )}
    </div>
  );
};

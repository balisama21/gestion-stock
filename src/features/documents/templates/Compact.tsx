import React from "react";
import { montant, quantite } from "../lib/format";
import {
  BlocAdresse,
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
export const Compact: React.FC<ProprietesModele> = ({
  document: d,
  lignes,
  premiere,
  derniere,
  pagination,
}) => {
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
              <th>Désignation</th>
              <th style={{ textAlign: "center", width: "22mm" }}>Qté</th>
              <th style={{ textAlign: "right", width: "26mm" }}>P.U.</th>
              <th style={{ textAlign: "right", width: "28mm" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.id}>
                <td className="doc-num doc-muted">{rangDe(i)}</td>
                <td>
                  {l.designation}
                  {l.detail && <span className="doc-muted"> · {l.detail}</span>}
                </td>
                <td className="doc-qte">{quantite(l.quantite, l.unite)}</td>
                <td className="doc-montant">{montant(l.prixUnitaire, d.devise)}</td>
                <td className="doc-montant">
                  <b>{montant(l.total, d.devise)}</b>
                </td>
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

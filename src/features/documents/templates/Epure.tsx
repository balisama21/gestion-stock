import React from "react";
import {
  BlocAdresse,
  CoordonneesEmetteur,
  CoordonneesPaiement,
  Marque,
  Mentions,
  MontantEnLettres,
  Reperes,
  Signature,
  TableauLignes,
  Totaux,
} from "../parts/blocs";
import { Ressort, TeteSuite, type ProprietesModele } from "../parts/squelette";

/**
 * MODÈLE 3 — ÉPURÉ
 *
 * Des empattements, aucun aplat, des filets fins, et les totaux
 * alignés à droite sans encadré. C'est le modèle des métiers où la
 * couleur ferait tache — un notaire, un cabinet, un artisan d'art.
 *
 * ── CE QU'IL RETIRE, ET POURQUOI ───────────────────────────────────
 *
 * Pas de tampon. Un tampon « PAYÉ » de travers dans un document
 * sobre est un corps étranger ; l'information reste, portée par la
 * ligne « Reste à payer » des totaux. C'est le seul modèle où un
 * élément du document disparaît pour une raison de style, et il faut
 * le savoir : une boutique qui tient au tampon ne choisira pas
 * celui-ci.
 *
 * La couleur du document ne sert qu'à un filet sous le total. Le
 * reste est noir sur blanc.
 */
export const Epure: React.FC<ProprietesModele> = ({
  document: d,
  lignes,
  premiere,
  derniere,
  pagination,
}) => (
  <div className="doc-pad doc-grow">
    {premiere ? (
      <div data-doc="tete" className="groupe-tete">
        <header className="tete">
          <div className="min0">
            <Marque emetteur={d.emetteur} />
            <CoordonneesEmetteur emetteur={d.emetteur} />
          </div>
          <div className="repere">
            <div className="doc-titre">{d.titre}</div>
          </div>
        </header>

        <div className="doc-blocs">
          <BlocAdresse bloc={d.destinataire} />
          <div className="doc-blocs-droite">
            <Reperes meta={d.meta} pagination={pagination} />
          </div>
        </div>
      </div>
    ) : (
      <TeteSuite document={d} pagination={pagination} />
    )}

    <div data-doc="tableau">
      <TableauLignes lignes={lignes} colonnes={d.colonnes} devise={d.devise} />
    </div>

    {derniere ? (
      <div className="doc-cloture" data-doc="cloture">
        {/* La même disposition que les trois autres modèles : ce qui
            s'écrit à gauche, les totaux à droite, puis les signatures.
            Les conditions vivaient seules au pied de la feuille, loin
            du montant qu'elles encadrent. Pas d'intitulé « Conditions »
            pour autant : le texte dit déjà ce qu'il est. */}
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

        <footer className="pied doc-insecable">
          {[d.motDeFin, d.piedDePage, pagination].filter(Boolean).join(" · ")}
        </footer>
      </div>
    ) : (
      <Ressort />
    )}
  </div>
);

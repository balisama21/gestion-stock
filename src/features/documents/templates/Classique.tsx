import React from "react";
import { montant } from "../lib/format";
import {
  BlocAdresse,
  CoordonneesPaiement,
  Marque,
  Mentions,
  MontantEnLettres,
  Reperes,
  Signature,
  TableauLignes,
  TamponPaiement,
  Totaux,
} from "../parts/blocs";
import { Ressort, TeteSuite, type ProprietesModele } from "../parts/squelette";

/**
 * MODÈLE 1 — CLASSIQUE
 *
 * Le modèle par défaut, et celui qui ressemble le plus à ce qu'un
 * commerçant attend d'une facture : identité à gauche, nature du
 * document à droite, tableau à en-tête plein, total détaché dans un
 * encadré de couleur.
 *
 * ── CE COMPOSANT NE DÉCIDE DE RIEN ─────────────────────────────────
 *
 * Il ne lit ni la base, ni les réglages : tout ce qu'il affiche lui
 * arrive dans `document`, déjà tranché par `buildDocument`. Un bloc
 * absent est un bloc que la fonction a mis à `null`. C'est ce qui
 * permet d'avoir quatre modèles sans vérifier quatre fois que le
 * reste dû est le bon.
 *
 * ── UNE DIFFÉRENCE AVEC LA MAQUETTE, ASSUMÉE ───────────────────────
 *
 * La maquette répète le vendeur en pied de page, alors qu'il figure
 * déjà dans les repères en haut à droite. Sur un vrai document, cette
 * seconde mention ne dit rien de plus et occupe la place du pied.
 * Elle est retirée ; le pied porte l'identité de la boutique et le
 * numéro, c'est-à-dire ce qu'on cherche quand on retrouve une feuille
 * détachée de son dossier.
 */
export const Classique: React.FC<ProprietesModele> = ({
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
          <Marque emetteur={d.emetteur} />
          <div className="repere">
            <div className="doc-titre">{d.titre}</div>
            <div style={{ marginTop: "2mm" }}>
              <Reperes meta={d.meta} pagination={pagination} />
            </div>
            {d.tampon && (
              <div style={{ marginTop: "3mm" }}>
                <TamponPaiement tampon={d.tampon} />
              </div>
            )}
          </div>
        </header>

        <div className="doc-blocs">
          <BlocAdresse bloc={d.emetteur} />
          <BlocAdresse bloc={d.destinataire} />
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
        {/* Le montant en lettres et les mentions à gauche, les totaux
            à droite. Le tout reste insécable : un total seul en haut
            d'une page fait douter du document entier. */}
        <div className="bas doc-insecable">
          <div>
            <MontantEnLettres texte={d.montantEnLettres} type={d.type} />
            {d.mentions && (
              <div style={{ marginTop: "4mm" }}>
                <Mentions texte={d.mentions} />
              </div>
            )}
            <CoordonneesPaiement lignes={d.coordonneesPaiement} />
          </div>
          <div>
            <Totaux totaux={d.totaux} devise={d.devise} sansTotal />
            <div className="encadre">
              <span>{d.totaux.libelleTotal}</span>
              <span className="doc-num">{montant(d.totaux.total, d.devise)}</span>
            </div>
          </div>
        </div>

        <Signature signatures={d.signatures} />

        {/* Pousse le pied de page en bas de la feuille, quelle que
            soit la longueur du tableau. C'est ce qui donne à une
            facture d'une ligne la même allure qu'à une facture de
            quinze. */}
        <Ressort />

        {d.motDeFin && <div className="merci">{d.motDeFin}</div>}

        <footer className="pied doc-insecable">
          <div>{d.piedDePage}</div>
          <div style={{ textAlign: "right" }} className="doc-muted">
            {d.numero}
            {pagination ? ` · ${pagination}` : ""}
          </div>
        </footer>
      </div>
    ) : (
      <Ressort />
    )}
  </div>
);

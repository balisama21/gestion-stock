import React from "react";
import { montant } from "../lib/format";
import {
  BlocAdresse,
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
 * MODÈLE 2 — BANDEAU
 *
 * Un bandeau de couleur pleine largeur en haut, des lignes alternées,
 * et une barre de contact en pied de page. C'est le modèle le plus
 * affirmé des quatre : il donne à la facture l'allure d'un document
 * de marque plutôt que d'une pièce comptable.
 *
 * ── DEUX PARTICULARITÉS QUI TIENNENT À SA FORME ────────────────────
 *
 * Le bandeau sort des marges de la feuille : il colle aux bords. Il
 * vit donc HORS du bloc rembourré, d'où la structure un peu
 * différente des trois autres — le `doc-pad` ne commence qu'après lui.
 *
 * Et l'émetteur n'apparaît pas deux fois. Son nom, son adresse et son
 * téléphone sont déjà dans le bandeau ; la grille du dessous ne porte
 * donc que le destinataire et les repères, là où le Classique montre
 * les deux parties côte à côte.
 */
export const Bandeau: React.FC<ProprietesModele> = ({
  document: d,
  lignes,
  premiere,
  derniere,
  pagination,
}) => (
  /*
   * Le bandeau DÉBORDE par des marges négatives, plutôt que de vivre
   * hors du bloc rembourré. La différence n'est pas cosmétique : les
   * quatre modèles ont ainsi la même ossature — un bloc rembourré,
   * trois groupes — et la mesure qui décide du découpage en pages
   * n'a qu'une seule forme à connaître.
   */
  <div className="doc-pad doc-grow">
    {premiere ? (
      <div data-doc="tete" className="groupe-tete">
        <div className="band">
          <div className="min0">
            <Marque emetteur={d.emetteur} inverse />
            {(d.emetteur.lignes.length > 0 || d.emetteur.nif) && (
              <div className="coordonnees">
                {[...d.emetteur.lignes, d.emetteur.nif ? `NIF/STAT ${d.emetteur.nif}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
          <div className="repere">
            <div className="doc-titre">{d.titre}</div>
            {d.numero && <div className="doc-num ref">N° {d.numero}</div>}
          </div>
        </div>

        <div className="doc-blocs">
          <BlocAdresse bloc={d.destinataire} />
          <div style={{ textAlign: "right" }}>
            <Reperes meta={d.meta} pagination={pagination} />
            {d.tampon && (
              <div style={{ marginTop: "3mm" }}>
                <TamponPaiement tampon={d.tampon} />
              </div>
            )}
          </div>
        </div>
      </div>
    ) : (
      <TeteSuite document={d} pagination={pagination} />
    )}

    <div data-doc="tableau">
      <TableauLignes lignes={lignes} devise={d.devise} />
    </div>

    {derniere ? (
      <div className="doc-cloture" data-doc="cloture">
        <div className="bas doc-insecable">
          <div>
            <MontantEnLettres texte={d.montantEnLettres} type={d.type} />
            {d.mentions && (
              <div style={{ marginTop: "4mm" }}>
                <Mentions texte={d.mentions} />
              </div>
            )}
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
        <Ressort />

        {/* La barre de pied reprend la couleur du bandeau : les deux
              se répondent d'un bout à l'autre de la feuille. Elle sort
              des marges elle aussi, d'où les marges négatives. */}
        <footer className="barre-pied doc-insecable">
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

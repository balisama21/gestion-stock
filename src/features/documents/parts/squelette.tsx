import React from "react";
import type { Document, LigneDocument } from "../lib/buildDocument";

/**
 * LE SQUELETTE QUE LES QUATRE MODÈLES PARTAGENT
 *
 * Chaque modèle est libre de sa mise en page, mais tous rendent les
 * mêmes trois groupes, marqués par un attribut que la mesure sait
 * retrouver :
 *
 *   data-doc="tete"      l'en-tête — complet sur la première page,
 *                        allégé sur les suivantes
 *   data-doc="tableau"   les lignes de cette page-ci
 *   data-doc="cloture"   totaux, mentions, signature, pied
 *                        — sur la dernière page seulement
 *
 * C'est ce qui permet de mesurer et de paginer une fois pour les
 * quatre, au lieu d'écrire quatre découpages qu'il faudrait corriger
 * quatre fois.
 */

export interface ProprietesModele {
  document: Document;
  /** Les lignes à poser sur CETTE feuille, et elles seules. */
  lignes: LigneDocument[];
  /** Première feuille : en-tête complet, adresses, tampon. */
  premiere: boolean;
  /** Dernière feuille : c'est elle qui porte les totaux et la signature. */
  derniere: boolean;
  /** « Page 2/3 », ou `null` quand le document tient sur une page. */
  pagination: string | null;
}

/**
 * L'en-tête des pages qui suivent la première.
 *
 * ── SA HAUTEUR EST FIXE, ET C'EST VOULU ────────────────────────────
 *
 * 18 mm, posés en CSS. Le découpage en pages a besoin de connaître
 * cette hauteur AVANT de rendre les pages suivantes — qui n'existent
 * pas encore au moment où l'on mesure. Une hauteur fixe supprime
 * cette poule et cet œuf : pas de seconde passe de mesure, pas de
 * clignotement à l'écran.
 *
 * Il ne redit pas l'adresse ni le NIF. Une page de suite n'est pas
 * une seconde facture : elle a juste besoin de dire à quel document
 * elle appartient, pour qu'une feuille égarée retrouve son dossier.
 */
export const TeteSuite: React.FC<{ document: Document; pagination: string | null }> = ({
  document: d,
  pagination,
}) => (
  <header className="doc-tete-suite" data-doc="tete">
    <span className="nom">{d.emetteur.nom}</span>
    <span className="doc-num ref">
      {d.titre} {d.numero}
      {pagination ? ` · ${pagination}` : ""}
    </span>
  </header>
);

/**
 * Le ressort qui pousse le pied de page en bas de la feuille.
 *
 * Marqué pour que la mesure puisse le retrancher : sans cela, la
 * clôture d'une facture d'une ligne semblerait haute de vingt
 * centimètres, et le découpage croirait qu'elle ne tient nulle part.
 */
export const Ressort: React.FC = () => <div className="doc-grow" data-doc="ressort" />;

import React from "react";
import type { CleColonne, LigneDocument } from "../lib/buildDocument";
import { montantOuTiret, nombre, quantite } from "../lib/format";
import { convertir, type DeviseAffichee } from "../../../lib/contexteDevises";

/** Le montant, puis ses équivalents en petit dessous. */
function avecEquivalents(texte: string, valeur: number | null, equivalents: DeviseAffichee[]) {
  if (valeur === null || !equivalents.length) return texte;
  return (
    <>
      {texte}
      {equivalents.map((d) => (
        <span key={d.code} className="doc-equiv">
          {convertir(valeur, d)}
        </span>
      ))}
    </>
  );
}

/**
 * LE CONTENU D'UNE CELLULE, COLONNE PAR COLONNE
 *
 * À part des composants : les quatre modèles s'en servent, et le
 * Compact dessine son propre tableau avec. Les garder dans `blocs.tsx`
 * y cassait le rechargement à chaud, qui veut des fichiers ne
 * n'exportant que des composants.
 */

/**
 * Les largeurs et l'alignement d'une colonne, par nature.
 *
 * La désignation prend ce qui reste : c'est la seule qui s'étire, et
 * c'est ce qui permet d'en ajouter ou d'en retirer sans que le
 * tableau se déforme.
 */
export const COLONNE: Record<CleColonne, { largeur?: string; align?: "center" | "right" }> = {
  designation: {},
  quantite: { largeur: "28mm", align: "center" },
  unite: { largeur: "22mm", align: "center" },
  prixUnitaire: { largeur: "30mm", align: "right" },
  total: { largeur: "32mm", align: "right" },
};

/** Ce qu'une cellule montre, colonne par colonne. */
export function celluleDeLigne(
  cle: CleColonne,
  l: LigneDocument,
  devise: string,
  avecUnite: boolean,
  equivalents: DeviseAffichee[] = [],
): React.ReactNode {
  switch (cle) {
    case "designation":
      return (
        <>
          <b>{l.designation}</b>
          {l.detail && (
            <>
              <br />
              <span className="doc-detail">{l.detail}</span>
            </>
          )}
        </>
      );
    case "quantite":
      // L'unité reste collée à la quantité tant qu'elle n'a pas sa
      // propre colonne : « 3 pièces ». Avec la colonne, « 3 » suffit.
      return avecUnite ? nombre(l.quantite) : quantite(l.quantite, l.unite);
    case "unite":
      return l.unite ?? "";
    /* Un tiret, jamais « 0 Ar », quand le prix est inconnu : sur un bon
       de commande, zéro se lit « gratuit » chez le fournisseur. */
    case "prixUnitaire":
      return avecEquivalents(montantOuTiret(l.prixUnitaire, devise), l.prixUnitaire, equivalents);
    case "total":
      return <b>{avecEquivalents(montantOuTiret(l.total, devise), l.total, equivalents)}</b>;
  }
}

export const CLASSE: Record<CleColonne, string> = {
  designation: "",
  quantite: "doc-qte",
  unite: "doc-qte",
  prixUnitaire: "doc-montant",
  total: "doc-montant",
};

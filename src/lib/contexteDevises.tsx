import React, { createContext, useContext } from "react";

/** Une devise dans laquelle on veut VOIR les montants, avec son taux du moment. */
export interface DeviseAffichee {
  code: string;
  symbole: string;
  decimales: number;
  /** Valeur d'une unité de cette devise, dans la devise principale. */
  taux: number;
}

export interface ValeurContexteDevises {
  /** Les équivalents affichés à l'écran (caisse, produits, achats). */
  affichees: DeviseAffichee[];
  /** Les équivalents imprimés sur un type de document. */
  pourDocument: (type: string) => DeviseAffichee[];
}

const Contexte = createContext<ValeurContexteDevises | null>(null);

export const FournisseurDevises = Contexte.Provider;

export function useDevisesAffichees(): DeviseAffichee[] {
  return useContext(Contexte)?.affichees ?? [];
}

export function useDevisesDuDocument(type: string): DeviseAffichee[] {
  return useContext(Contexte)?.pourDocument(type) ?? [];
}

/** « 2,00 € » : un montant de la devise principale, converti. */
export function convertir(montant: number, d: DeviseAffichee): string {
  const valeur = d.taux > 0 ? montant / d.taux : 0;
  const txt = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: d.decimales,
    maximumFractionDigits: d.decimales,
  })
    .format(valeur)
    .replace(/\u202f/g, "\u00a0");
  return `${txt}\u00a0${d.symbole}`;
}

/** « 2,00 € · 983 CF », ou chaîne vide quand il n'y a rien à montrer. */
export function texteEquivalents(montant: number, liste: DeviseAffichee[]): string {
  if (!liste.length || !Number.isFinite(montant) || montant === 0) return "";
  return liste.map((d) => convertir(montant, d)).join(" · ");
}

/** Petite ligne grise sous un montant : ses équivalents dans les devises choisies. */
export const Equivalents: React.FC<{ montant: number; className?: string }> = ({
  montant,
  className = "",
}) => {
  const texte = texteEquivalents(montant, useDevisesAffichees());
  if (!texte) return null;
  return (
    <span className={`block font-mono text-xs tabular-nums text-muted-foreground ${className}`}>
      ≈ {texte}
    </span>
  );
};

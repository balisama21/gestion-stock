import { createContext, useContext } from "react";
import type { ReglagesDocuments } from "./lib/reglages";

/**
 * Les réglages des documents tels qu'ils sont aujourd'hui, et de quoi les
 * enregistrer depuis n'importe quel écran qui affiche un document.
 * Fourni une fois par l'application ; absent, personne ne modifie rien.
 */
export interface ReglagesModifiables {
  /** Propriétaire, administrateur, manager : la même règle qu'en base. */
  peutRegler: boolean;
  storeId?: string;
  reglages: ReglagesDocuments;
  /** Rend le message d'erreur, ou `null`. */
  enregistrer: (reglages: ReglagesDocuments) => Promise<string | null>;
}

export const ContexteReglagesDocuments = createContext<ReglagesModifiables | null>(null);

export const useReglagesModifiables = () => useContext(ContexteReglagesDocuments);

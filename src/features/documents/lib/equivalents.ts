import { createContext, useContext } from "react";
import type { DeviseAffichee } from "../../../lib/contexteDevises";
import type { ConversionImposee } from "../../../lib/affichageDevise";

/** Les devises dont l'équivalent s'imprime sur le document en cours. Vide par défaut. */
export const ContexteEquivalents = createContext<DeviseAffichee[]>([]);

export const useEquivalentsDuDocument = () => useContext(ContexteEquivalents);

/**
 * Les équivalents sous le TOTAL, quand ils diffèrent de ceux des lignes :
 * une proforma en euros rappelle son montant en ariary une fois, sous le
 * total, et non sous chaque prix. Absent : les mêmes que les lignes.
 */
export const ContexteEquivalentsDuTotal = createContext<DeviseAffichee[] | undefined>(undefined);

export const useEquivalentsDuTotal = () => {
  const total = useContext(ContexteEquivalentsDuTotal);
  const lignes = useContext(ContexteEquivalents);
  return total ?? lignes;
};

/**
 * La devise imposée au document en cours (une proforma en euros).
 * `undefined` : celle de l'écran, comme partout ailleurs.
 */
export const ContexteConversion = createContext<ConversionImposee>(undefined);

export const useConversionDuDocument = () => useContext(ContexteConversion);

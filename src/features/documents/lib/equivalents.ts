import { createContext, useContext } from "react";
import type { DeviseAffichee } from "../../../lib/contexteDevises";

/** Les devises dont l'équivalent s'imprime sur le document en cours. Vide par défaut. */
export const ContexteEquivalents = createContext<DeviseAffichee[]>([]);

export const useEquivalentsDuDocument = () => useContext(ContexteEquivalents);

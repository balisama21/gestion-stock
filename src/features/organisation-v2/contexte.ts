import { createContext, useContext } from "react";
import type { Tache } from "../../lib/taches";
import type { Rappel, DelaisRappel } from "../../lib/rappels";
import type { Evenement, LigneAgenda } from "../../lib/evenements";
import type { LigneJournal } from "../../hooks/useJournalActivite";
import type { DroitsOrganisation } from "./hooks/useOrganisationPermissions";
import type { useActionsTaches, Dire } from "./hooks/useTaches";
import type { useActionsEvenements } from "./hooks/useEvenements";
import type { useActionsRappels } from "./hooks/useRappels";
import type { Membre } from "./lib/personnes";
import type { Sources } from "./lib/elements";

export type OngletOrg = "apercu" | "taches" | "agenda" | "rappels";
export type Portee = "equipe" | "moi";

/** Ce que le panneau latéral montre. */
export type Panneau =
  | { kind: "tache"; id: string }
  | { kind: "actions"; id: string }
  | { kind: "evenement"; id: string }
  | { kind: "rappel"; id: string }
  | { kind: "echeances"; ids?: string[] }
  | { kind: "params" }
  | { kind: "nouveau"; quoi: "tache" | "evenement" | "rappel"; jour?: string };

export interface ContexteOrganisation {
  moiId: string | null;
  membres: Membre[];
  droits: DroitsOrganisation;
  aujourdhui: string;
  maintenant: Date;
  nom: (id: string | null) => string;

  portee: Portee;
  setPortee: (p: Portee) => void;

  /** Toutes les lignes que la base a laissé lire. */
  taches: Tache[];
  /** Les mêmes, réduites au filtre « Ce qui m'est assigné » s'il est choisi. */
  tachesPortee: Tache[];
  evenements: Evenement[];
  rappels: Rappel[];
  rappelsPortee: Rappel[];
  echeances: LigneAgenda[];
  /** Les sources prêtes pour `elementsEntre`, filtre de portée appliqué. */
  sources: Sources;

  chargement: { taches: boolean; evenements: boolean; rappels: boolean };
  erreurs: { taches: string | null; evenements: string | null; rappels: string | null };

  actionsTaches: ReturnType<typeof useActionsTaches>;
  actionsEvenements: ReturnType<typeof useActionsEvenements>;
  actionsRappels: ReturnType<typeof useActionsRappels>;

  activite: { lignes: LigneJournal[]; erreur: string | null; charge: boolean };
  delaisRappel: DelaisRappel;

  ouvrir: (p: Panneau) => void;
  fermer: () => void;
  allerA: (o: OngletOrg) => void;
  naviguer: (vue: string) => void;
  dire: Dire;
}

export const Contexte = createContext<ContexteOrganisation | null>(null);

export const useOrg = (): ContexteOrganisation => {
  const c = useContext(Contexte);
  if (!c) throw new Error("useOrg hors de OrganisationV2Page");
  return c;
};

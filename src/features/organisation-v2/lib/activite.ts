import type { LigneJournal } from "../../../hooks/useJournalActivite";
import { dateCourte } from "./dates";

/**
 * Ce qu'une ligne du journal d'activité raconte d'une tâche.
 *
 * Le déclencheur `journaliser_activite` écrit, pour une modification,
 * `changements = { colonne: { avant, apres } }`. On n'en lit que les
 * colonnes qui parlent à quelqu'un : le statut, l'échéance, la personne
 * assignée. Le reste devient « a modifié ».
 */
type Changements = Record<string, { avant?: unknown; apres?: unknown }>;

const changementsDe = (l: LigneJournal): Changements =>
  l.changements && typeof l.changements === "object" && !Array.isArray(l.changements)
    ? (l.changements as unknown as Changements)
    : {};

export interface Recit {
  /** « a créé », « a terminé »… — sans sujet, la ligne le met devant. */
  verbe: string;
  /** Ce qui suit le titre : « au 22 sept. », « à Lanto »… */
  suite?: string;
}

export const recitDe = (l: LigneJournal, nom: (id: string | null) => string): Recit => {
  if (l.action === "creation") return { verbe: "a créé" };
  if (l.action === "suppression") return { verbe: "a supprimé" };
  const c = changementsDe(l);
  if (c.statut) {
    const apres = c.statut.apres;
    if (apres === "termine") return { verbe: "a terminé" };
    if (apres === "en_cours") return { verbe: "a commencé" };
    if (apres === "a_faire") return { verbe: "a rouvert" };
  }
  if (c.assignee_id) {
    const vers = typeof c.assignee_id.apres === "string" ? c.assignee_id.apres : null;
    return { verbe: "a assigné", suite: `à ${nom(vers)}` };
  }
  if (c.echeance) {
    const vers = typeof c.echeance.apres === "string" ? c.echeance.apres : null;
    return vers
      ? { verbe: "a reporté", suite: `au ${dateCourte(vers)}` }
      : { verbe: "a retiré l'échéance de" };
  }
  return { verbe: "a modifié" };
};

/** « Terminée par Lanto » : la même chose, dite du point de vue de la tâche. */
export const historiqueDe = (l: LigneJournal, nom: (id: string | null) => string): string => {
  const qui = nom(l.acteur_id);
  const r = recitDe(l, nom);
  const participe: Record<string, string> = {
    "a créé": "Créée",
    "a supprimé": "Supprimée",
    "a terminé": "Terminée",
    "a commencé": "Démarrée",
    "a rouvert": "Rouverte",
    "a assigné": "Assignée",
    "a reporté": "Reportée",
    "a retiré l'échéance de": "Échéance retirée",
    "a modifié": "Modifiée",
  };
  return `${participe[r.verbe] ?? "Modifiée"}${r.suite ? ` ${r.suite}` : ""} par ${qui}`;
};

import type { Database } from "./database.types";
import { dateDuJour } from "./dates";

export type Tache = Database["public"]["Tables"]["taches"]["Row"];
export type StatutTache = "a_faire" | "en_cours" | "termine";
export type PrioriteTache = "basse" | "moyenne" | "haute" | "urgente";

/**
 * Les tâches : ce que l'équipe doit faire, et où ça en est.
 *
 * Ce fichier ne contient que du calcul — aucune requête, aucun affichage.
 * C'est ce qui permet de vérifier « en retard » ou l'ordre d'une liste
 * sans ouvrir un navigateur ni toucher à la base.
 */

export const STATUTS: { valeur: StatutTache; libelle: string }[] = [
  { valeur: "a_faire", libelle: "À faire" },
  { valeur: "en_cours", libelle: "En cours" },
  { valeur: "termine", libelle: "Terminé" },
];

export const PRIORITES: { valeur: PrioriteTache; libelle: string }[] = [
  { valeur: "basse", libelle: "Basse" },
  { valeur: "moyenne", libelle: "Moyenne" },
  { valeur: "haute", libelle: "Haute" },
  { valeur: "urgente", libelle: "Urgente" },
];

export const libelleStatut = (s: string) => STATUTS.find((x) => x.valeur === s)?.libelle ?? s;
export const libellePriorite = (p: string) => PRIORITES.find((x) => x.valeur === p)?.libelle ?? p;

/**
 * La couleur ne parle que quand elle dit quelque chose.
 *
 * Une priorité moyenne, qui est le cas courant, n'a pas à se signaler :
 * si les trois quarts des lignes portent une pastille, plus aucune ne se
 * remarque. Seules l'urgence et le retard en méritent une.
 */
export const CLASSE_PRIORITE: Record<PrioriteTache, string> = {
  basse: "app-badge-neutral",
  moyenne: "app-badge-neutral",
  haute: "app-badge-warning",
  urgente: "app-badge-danger",
};

export const CLASSE_STATUT: Record<StatutTache, string> = {
  a_faire: "app-badge-neutral",
  en_cours: "app-badge-info",
  termine: "app-badge-success",
};

/**
 * En retard : l'échéance est passée et la tâche n'est pas faite.
 *
 * Ce n'est volontairement pas une colonne de la base. Une tâche due
 * hier devient en retard à minuit sans que personne n'ait rien écrit —
 * la stocker obligerait à repasser chaque nuit sur toute la base pour
 * que la valeur reste vraie. Calculée à la lecture, elle est exacte à
 * la seconde et ne coûte rien.
 *
 * Le jour se prend par `dateDuJour`, jamais par `toISOString` : à
 * Antananarivo, qui est à UTC+3, la seconde méthode renvoie la veille
 * pendant les trois premières heures de la journée.
 */
export const estEnRetard = (t: Tache, aujourdhui = dateDuJour()): boolean =>
  t.statut !== "termine" && !!t.echeance && t.echeance < aujourdhui;

export const estPourAujourdhui = (t: Tache, aujourdhui = dateDuJour()): boolean =>
  t.statut !== "termine" && t.echeance === aujourdhui;

/** Le prochain état quand on avance d'un cran. */
export const statutSuivant = (s: string): StatutTache =>
  s === "a_faire" ? "en_cours" : s === "en_cours" ? "termine" : "a_faire";

const RANG_PRIORITE: Record<string, number> = { urgente: 0, haute: 1, moyenne: 2, basse: 3 };

/**
 * L'ordre de lecture d'une liste de tâches.
 *
 * Ce qui est fait descend en bas — sans disparaître, car voir ce qu'on a
 * terminé fait partie du travail. Au-dessus, le retard passe devant tout
 * le reste, puis l'échéance la plus proche, puis la priorité. Une tâche
 * sans échéance vient après celles qui en ont une : elle n'attend
 * personne.
 */
export const trierTaches = (taches: Tache[], aujourdhui = dateDuJour()): Tache[] =>
  [...taches].sort((a, b) => {
    if ((a.statut === "termine") !== (b.statut === "termine")) {
      return a.statut === "termine" ? 1 : -1;
    }
    const ra = estEnRetard(a, aujourdhui) ? 0 : 1;
    const rb = estEnRetard(b, aujourdhui) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    if (a.echeance !== b.echeance) {
      if (!a.echeance) return 1;
      if (!b.echeance) return -1;
      return a.echeance < b.echeance ? -1 : 1;
    }
    const pa = RANG_PRIORITE[a.priorite] ?? 9;
    const pb = RANG_PRIORITE[b.priorite] ?? 9;
    if (pa !== pb) return pa - pb;
    return (a.numero ?? "") < (b.numero ?? "") ? -1 : 1;
  });

export interface ResumeTaches {
  aFaire: number;
  enCours: number;
  terminees: number;
  enRetard: number;
  pourAujourdhui: number;
}

export const resumer = (taches: Tache[], aujourdhui = dateDuJour()): ResumeTaches => ({
  aFaire: taches.filter((t) => t.statut === "a_faire").length,
  enCours: taches.filter((t) => t.statut === "en_cours").length,
  terminees: taches.filter((t) => t.statut === "termine").length,
  enRetard: taches.filter((t) => estEnRetard(t, aujourdhui)).length,
  pourAujourdhui: taches.filter((t) => estPourAujourdhui(t, aujourdhui)).length,
});

/**
 * Dans combien de temps, dit comme on le dirait.
 *
 * « Il y a 3 jours » plutôt qu'une date pour ce qui traîne, parce que
 * c'est le retard qui compte et non le jour exact ; la date en clair
 * au-delà d'une semaine, parce qu'à ce terme « dans 12 jours » ne dit
 * plus rien à personne.
 */
export const libelleEcheance = (echeance: string | null, aujourdhui = dateDuJour()): string => {
  if (!echeance) return "Sans échéance";
  const [aa, am, aj] = aujourdhui.split("-").map(Number);
  const [ea, em, ej] = echeance.split("-").map(Number);
  const jours = Math.round((Date.UTC(ea, em - 1, ej) - Date.UTC(aa, am - 1, aj)) / 86400000);
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return "Demain";
  if (jours === -1) return "Hier";
  if (jours < 0) return `Il y a ${-jours} jours`;
  if (jours <= 7) return `Dans ${jours} jours`;
  return `${String(ej).padStart(2, "0")}/${String(em).padStart(2, "0")}/${ea}`;
};

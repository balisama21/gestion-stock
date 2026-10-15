import type { Tache } from "../../../lib/taches";
import { jourDe } from "../../../lib/evenements";
import { ecartJours } from "./dates";

/** Terminée dans les sept derniers jours : la statistique « cette semaine ». */
export const termineeCetteSemaine = (t: Tache, aujourdhui: string): boolean =>
  t.statut === "termine" && !!t.termine_le && ecartJours(jourDe(t.termine_le), aujourdhui) <= 7;

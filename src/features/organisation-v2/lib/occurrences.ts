import type { Rappel } from "../../../lib/rappels";
import { heureDe, jourDe } from "../../../lib/evenements";
import { ajouterJours, heureCourte, versDate } from "./dates";

/**
 * LES JOURS OÙ UN RAPPEL SONNE, SUR UNE PÉRIODE
 *
 * Calcul pur, à la lecture : « tous les lundis » reste UNE ligne en base
 * (voir l'en-tête de `lib/rappels.ts`). Les règles suivent exactement
 * celles de `prochaineOccurrence` dans ce même fichier :
 *
 * - `quotidien`     chaque jour, à `heure` ;
 * - `hebdomadaire`  le jour dont `getDay()` vaut `jour_semaine`
 *                   (0 = dimanche, comme en base) ;
 * - `mensuel`       le jour `jour_mois` ; un mois qui n'a pas ce jour
 *                   (le 31 en avril) est sauté, rien n'est inventé ;
 * - `aucune`        le jour de `declenche_le`, à son heure locale.
 *
 * Un rappel désactivé ne sonne jamais.
 */
export interface Occurrence {
  jour: string;
  heure: string | null;
}

/** Au-delà, on ne lit plus un agenda : garde-fou contre une boucle sans fin. */
const MAX_JOURS = 400;

export const occurrencesEntre = (r: Rappel, debut: string, fin: string): Occurrence[] => {
  if (!r.actif || debut > fin) return [];

  if (r.recurrence === "aucune") {
    if (!r.declenche_le) return [];
    const jour = jourDe(r.declenche_le);
    return jour >= debut && jour <= fin ? [{ jour, heure: heureDe(r.declenche_le) }] : [];
  }

  const heure = heureCourte(r.heure);
  if (!heure) return [];

  const sortie: Occurrence[] = [];
  let jour = debut;
  for (let i = 0; i < MAX_JOURS && jour <= fin; i++, jour = ajouterJours(jour, 1)) {
    const d = versDate(jour);
    const sonne =
      r.recurrence === "quotidien" ||
      (r.recurrence === "hebdomadaire" &&
        r.jour_semaine !== null &&
        d.getDay() === r.jour_semaine) ||
      (r.recurrence === "mensuel" && r.jour_mois !== null && d.getDate() === r.jour_mois);
    if (sonne) sortie.push({ jour, heure });
  }
  return sortie;
};

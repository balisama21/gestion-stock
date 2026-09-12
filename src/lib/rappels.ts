import type { Database } from "./database.types";
import type { Evenement } from "./evenements";
import { jourLocal } from "./evenements";

export type Rappel = Database["public"]["Tables"]["rappels"]["Row"];
export type Recurrence = "aucune" | "quotidien" | "hebdomadaire" | "mensuel";

/**
 * Les rappels : quand faut-il redire quelque chose, et jusqu'à quand.
 *
 * Du calcul de dates, rien d'autre — ni requête, ni affichage. C'est ce
 * qui permet de vérifier qu'un « tous les lundis » tombe bien le lundi
 * sans ouvrir un navigateur.
 *
 * ── Pourquoi aucune occurrence n'est enregistrée ──
 *
 * « Tous les lundis » est UNE ligne en base, pas cinquante-deux. Les
 * matérialiser demanderait un travail de fond pour les créer à l'avance,
 * poserait la question de jusqu'où aller, et celle des occurrences
 * passées qu'on aurait fabriquées puis qu'il faudrait nettoyer. Ici, on
 * calcule à la lecture : la règle est la donnée.
 *
 * ── Ce qui vaut « échu » ──
 *
 * Un rappel paraît de son heure jusqu'à la fin de la journée, puis
 * s'efface. Sans cette borne, un rappel raté resterait à l'écran
 * indéfiniment et finirait par ne plus rien vouloir dire ; avec une
 * borne trop courte, on le manquerait en étant occupé ailleurs. La fin
 * du jour est la limite que tout le monde comprend sans qu'on
 * l'explique.
 */

export const RECURRENCES: { valeur: Recurrence; libelle: string }[] = [
  { valeur: "aucune", libelle: "Une seule fois" },
  { valeur: "quotidien", libelle: "Tous les jours" },
  { valeur: "hebdomadaire", libelle: "Toutes les semaines" },
  { valeur: "mensuel", libelle: "Tous les mois" },
];

export const JOURS_SEMAINE = [
  { valeur: 1, libelle: "lundi" },
  { valeur: 2, libelle: "mardi" },
  { valeur: 3, libelle: "mercredi" },
  { valeur: 4, libelle: "jeudi" },
  { valeur: 5, libelle: "vendredi" },
  { valeur: 6, libelle: "samedi" },
  { valeur: 0, libelle: "dimanche" },
];

export const libelleRecurrence = (r: string) =>
  RECURRENCES.find((x) => x.valeur === r)?.libelle ?? r;

/**
 * Le délai par défaut avant un rendez-vous.
 *
 * La veille à 18 h pour ce qui vient demain ou plus tard : c'est l'heure
 * où l'on range sa journée et où l'on regarde la suivante. Une heure
 * avant pour ce qui tombe aujourd'hui : prévenir la veille d'un
 * rendez-vous déjà passé ne sert à rien.
 *
 * Ces deux nombres seront réglables dans les Paramètres ; ils vivent ici
 * pour que le jour venu il n'y ait qu'un endroit à changer.
 */
export const VEILLE_HEURE = 18;
export const MEME_JOUR_MINUTES = 60;

const finDuJour = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const aLHeure = (jour: Date, heure: string): Date => {
  const [h, m] = heure.split(":").map(Number);
  return new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), h, m || 0, 0, 0);
};

/**
 * Le moment où il faut prévenir, avant un événement.
 *
 * Rendu séparément du reste parce que c'est la seule règle que
 * l'utilisateur verra écrite en toutes lettres dans les réglages.
 */
export const momentDuRappel = (debutIso: string, maintenant = new Date()): Date => {
  const debut = new Date(debutIso);
  // « Le jour même » se juge par rapport à AUJOURD'HUI, pas par rapport à
  // l'événement — c'est tout le sens de la règle.
  //
  // Une première version prenait le plus tôt des deux moments, ce qui
  // paraissait raisonnable et ne l'était pas : la veille à 18 h précède
  // toujours l'heure qui précède un rendez-vous du lendemain, si bien
  // que la branche « une heure avant » n'était jamais choisie. La règle
  // existait dans le code sans jamais s'appliquer. L'essai à blanc l'a
  // montré en affichant les deux moments côte à côte.
  if (jourLocal(debut) === jourLocal(maintenant)) {
    return new Date(debut.getTime() - MEME_JOUR_MINUTES * 60000);
  }
  return new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() - 1, VEILLE_HEURE, 0, 0);
};

/** Un événement mérite-t-il d'être annoncé maintenant ? */
export const evenementARappeler = (e: Evenement, maintenant = new Date()): boolean => {
  const debut = new Date(e.debut);
  if (debut < maintenant) return false;
  return momentDuRappel(e.debut, maintenant) <= maintenant;
};

/**
 * La dernière occurrence d'un rappel récurrent, au plus tard maintenant.
 *
 * Rend `null` quand la règle n'a pas encore produit d'occurrence — un
 * « tous les lundis » consulté un mercredi rend le lundi qui vient de
 * passer, pas le suivant.
 */
export const derniereOccurrence = (r: Rappel, maintenant = new Date()): Date | null => {
  if (!r.actif) return null;

  if (r.recurrence === "aucune") {
    if (!r.declenche_le) return null;
    const quand = new Date(r.declenche_le);
    return quand <= maintenant ? quand : null;
  }

  if (!r.heure) return null;

  if (r.recurrence === "quotidien") {
    const aujourdhui = aLHeure(maintenant, r.heure);
    if (aujourdhui <= maintenant) return aujourdhui;
    const hier = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate() - 1,
    );
    return aLHeure(hier, r.heure);
  }

  if (r.recurrence === "hebdomadaire") {
    if (r.jour_semaine === null) return null;
    // Combien de jours depuis le dernier jour voulu, aujourd'hui compris.
    const recul = (maintenant.getDay() - r.jour_semaine + 7) % 7;
    const jour = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate() - recul,
    );
    const quand = aLHeure(jour, r.heure);
    if (quand <= maintenant) return quand;
    // C'est le bon jour mais l'heure n'est pas venue : l'occurrence
    // valable est celle de la semaine précédente.
    const semainePassee = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() - 7);
    return aLHeure(semainePassee, r.heure);
  }

  if (r.recurrence === "mensuel") {
    if (r.jour_mois === null) return null;
    const ceMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), r.jour_mois);
    // Un 31 dans un mois de trente jours glisse au mois suivant : on
    // n'annonce rien plutôt que d'inventer une date.
    if (ceMois.getMonth() !== maintenant.getMonth()) return null;
    const quand = aLHeure(ceMois, r.heure);
    if (quand <= maintenant) return quand;
    const moisPasse = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, r.jour_mois);
    if (moisPasse.getDate() !== r.jour_mois) return null;
    return aLHeure(moisPasse, r.heure);
  }

  return null;
};

/**
 * Le rappel est-il à l'écran en ce moment ?
 *
 * De son heure jusqu'à la fin de ce jour-là. Voir l'en-tête du fichier
 * pour le choix de cette borne.
 */
export const estEchu = (r: Rappel, maintenant = new Date()): boolean => {
  const quand = derniereOccurrence(r, maintenant);
  if (!quand) return false;
  return maintenant <= finDuJour(quand);
};

/** « Tous les lundis à 08:00 », « Le 13/09/2026 à 14:30 ». */
export const libelleQuand = (r: Rappel): string => {
  if (r.recurrence === "aucune") {
    if (!r.declenche_le) return "Sans date";
    const d = new Date(r.declenche_le);
    return `Le ${jourLocal(d).split("-").reverse().join("/")} à ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const heure = r.heure?.slice(0, 5) ?? "";
  if (r.recurrence === "quotidien") return `Tous les jours à ${heure}`;
  if (r.recurrence === "hebdomadaire") {
    const j = JOURS_SEMAINE.find((x) => x.valeur === r.jour_semaine)?.libelle ?? "";
    return `Tous les ${j}s à ${heure}`;
  }
  return `Le ${r.jour_mois} de chaque mois à ${heure}`;
};

/** La prochaine fois qu'il sonnera, pour l'afficher dans la liste. */
export const prochaineOccurrence = (r: Rappel, maintenant = new Date()): Date | null => {
  if (!r.actif) return null;

  if (r.recurrence === "aucune") {
    if (!r.declenche_le) return null;
    const quand = new Date(r.declenche_le);
    return quand > maintenant ? quand : null;
  }
  if (!r.heure) return null;

  if (r.recurrence === "quotidien") {
    const aujourdhui = aLHeure(maintenant, r.heure);
    if (aujourdhui > maintenant) return aujourdhui;
    const demain = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate() + 1,
    );
    return aLHeure(demain, r.heure);
  }

  if (r.recurrence === "hebdomadaire") {
    if (r.jour_semaine === null) return null;
    const avance = (r.jour_semaine - maintenant.getDay() + 7) % 7;
    const jour = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate() + avance,
    );
    const quand = aLHeure(jour, r.heure);
    if (quand > maintenant) return quand;
    const semaineSuivante = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() + 7);
    return aLHeure(semaineSuivante, r.heure);
  }

  if (r.recurrence === "mensuel") {
    if (r.jour_mois === null) return null;
    for (let i = 0; i < 13; i++) {
      const essai: Date = new Date(
        maintenant.getFullYear(),
        maintenant.getMonth() + i,
        r.jour_mois,
      );
      // Le mois n'a pas ce jour-là : on passe au suivant.
      if (essai.getDate() !== r.jour_mois) continue;
      const quand = aLHeure(essai, r.heure);
      if (quand > maintenant) return quand;
    }
    return null;
  }

  return null;
};

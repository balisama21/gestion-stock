import { useCallback, useEffect, useMemo, useState } from "react";
import { dateDuJour } from "../../../lib/dates";
import { dateLocale, intervalleCourt, jourEtMois } from "../lib/format";

/**
 * LA PÉRIODE REGARDÉE, ET CELLE À LAQUELLE ON LA COMPARE
 *
 * POURQUOI CE FICHIER PLUTÔT QUE `src/lib/periodes.ts`. Le sélecteur de
 * l'application connaît quatre choix — jour, semaine, mois, tout — et
 * quinze écrans s'en servent. La maquette en demande quatre autres :
 * les trois premiers, plus un intervalle libre, et pas de « tout ».
 * Élargir le fichier commun pour un seul écran, c'est faire porter à
 * quatorze écrans le risque d'une régression qui ne les concerne pas.
 * Ce fichier-ci ne sert qu'au tableau de bord v2, et `periodes.ts` n'est
 * pas touché.
 *
 * TOUT EST EN HEURE LOCALE. Les bornes sont des jours du calendrier au
 * format « AAAA-MM-JJ », comparables telles quelles aux colonnes `date`
 * de la base. Aucun appel à `toISOString`, et jamais
 * `new Date("AAAA-MM-JJ")` — voir `src/lib/dates.ts` pour ce que cette
 * forme coûte à Antananarivo.
 */

export type ClePeriode = "today" | "week" | "month" | "custom";

export interface Intervalle {
  /** Premier jour compris, « AAAA-MM-JJ ». */
  debut: string;
  /** Dernier jour compris, « AAAA-MM-JJ ». */
  fin: string;
}

export interface Periode {
  cle: ClePeriode;
  /** « Ce mois », pour le bouton. */
  nom: string;
  intervalle: Intervalle;
  /** « 1 – 16 sept. », sous le nom. */
  libelle: string;
  /**
   * La période à laquelle on compare. Jamais nulle : chacun des quatre
   * choix a un avant qui lui ressemble.
   */
  precedent: Intervalle;
  /** « du 1 au 16 août » — se glisse après « que » ou « comme ». */
  libellePrecedent: string;
  /** « ce mois-ci » — se glisse après « 344 800 Ar de ventes ». */
  phrase: string;
}

/* ─── arithmétique de calendrier, en jours locaux ─── */

const enDate = dateLocale;

const enJour = (d: Date): string => dateDuJour(d);

/** Le jour qui vient `n` jours après celui-ci. `n` peut être négatif. */
export function decalerJours(jour: string, n: number): string {
  const d = enDate(jour);
  return enJour(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/**
 * Le même quantième, `n` mois plus tôt — le 31 mars devient le 28 ou le
 * 29 février, pas le 3 mars.
 *
 * `new Date(2026, 2, 31)` reculé d'un mois donne le 3 mars, parce que
 * février n'a pas de 31. On plafonne donc explicitement au dernier jour
 * du mois d'arrivée.
 */
export function decalerMois(jour: string, n: number): string {
  const d = enDate(jour);
  const cible = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  return enJour(new Date(cible.getFullYear(), cible.getMonth(), Math.min(d.getDate(), dernier)));
}

/** Le premier jour du mois auquel appartient ce jour. */
export const debutDeMois = (jour: string): string => `${jour.slice(0, 7)}-01`;

/** Combien de jours l'intervalle compte, bornes comprises. */
export function nombreDeJours(i: Intervalle): number {
  const d = enDate(i.debut);
  const f = enDate(i.fin);
  return Math.round((f.getTime() - d.getTime()) / 86400000) + 1;
}

/** Le jour tombe-t-il dedans ? Comparaison de chaînes, aucun fuseau. */
export const dansIntervalle = (jour: string, i: Intervalle): boolean =>
  jour >= i.debut && jour <= i.fin;

/* ─── la mémoire du choix ─── */

/** Le même préfixe que la maquette, pour ne pas polluer l'espace global. */
const CLE = (suffixe: string) => `tantana.dash.${suffixe}`;

function lire<T>(suffixe: string, defaut: T): T {
  try {
    const brut = window.localStorage.getItem(CLE(suffixe));
    return brut === null ? defaut : (JSON.parse(brut) as T);
  } catch {
    return defaut;
  }
}

function ecrire(suffixe: string, valeur: unknown): void {
  try {
    window.localStorage.setItem(CLE(suffixe), JSON.stringify(valeur));
  } catch {
    /* Navigation privée, stockage plein : le tableau de bord marche
       quand même, il oublie seulement le choix d'une fois sur l'autre. */
  }
}

/* ─── la construction d'une période ─── */

const est = (v: unknown): v is ClePeriode =>
  v === "today" || v === "week" || v === "month" || v === "custom";

/** « du 1 au 16 août », ou « le 4 août » quand les deux bornes se rejoignent. */
function libelleDe(i: Intervalle): string {
  const d = enDate(i.debut);
  const f = enDate(i.fin);
  if (i.debut === i.fin) return `le ${jourEtMois(d)}`;
  const memeMois = d.getFullYear() === f.getFullYear() && d.getMonth() === f.getMonth();
  return memeMois
    ? `du ${d.getDate()} au ${jourEtMois(f)}`
    : `du ${jourEtMois(d)} au ${jourEtMois(f)}`;
}

export function construirePeriode(
  cle: ClePeriode,
  libre: Intervalle,
  aujourdhui = dateDuJour(),
): Periode {
  if (cle === "today") {
    const i = { debut: aujourdhui, fin: aujourdhui };
    const veille = decalerJours(aujourdhui, -1);
    return {
      cle,
      nom: "Aujourd'hui",
      intervalle: i,
      libelle: intervalleCourt(i.debut, i.fin),
      precedent: { debut: veille, fin: veille },
      libellePrecedent: "hier",
      phrase: "aujourd'hui",
    };
  }

  if (cle === "week") {
    const i = { debut: decalerJours(aujourdhui, -6), fin: aujourdhui };
    return {
      cle,
      nom: "7 derniers jours",
      intervalle: i,
      libelle: intervalleCourt(i.debut, i.fin),
      precedent: { debut: decalerJours(i.debut, -7), fin: decalerJours(i.fin, -7) },
      libellePrecedent: "les 7 jours précédents",
      phrase: "sur les 7 derniers jours",
    };
  }

  if (cle === "month") {
    // Du 1er à aujourd'hui, et non le mois entier : comparer un mois
    // commencé à un mois complet ferait chuter tous les chiffres le 1er.
    const i = { debut: debutDeMois(aujourdhui), fin: aujourdhui };
    const precedent = { debut: decalerMois(i.debut, -1), fin: decalerMois(i.fin, -1) };
    return {
      cle,
      nom: "Ce mois",
      intervalle: i,
      libelle: intervalleCourt(i.debut, i.fin),
      precedent,
      libellePrecedent: libelleDe(precedent),
      phrase: "ce mois-ci",
    };
  }

  // Intervalle libre. Les bornes sont remises dans l'ordre plutôt que
  // refusées : une saisie inversée décrit la même période.
  const i = libre.debut <= libre.fin ? libre : { debut: libre.fin, fin: libre.debut };
  const precedent = { debut: decalerMois(i.debut, -1), fin: decalerMois(i.fin, -1) };
  return {
    cle,
    nom: "Période",
    intervalle: i,
    libelle: intervalleCourt(i.debut, i.fin),
    precedent,
    libellePrecedent: libelleDe(precedent),
    phrase: "sur la période",
  };
}

export interface PeriodeChoisie {
  periode: Periode;
  /** Un des trois choix rapides. */
  choisir: (cle: Exclude<ClePeriode, "custom">) => void;
  /** Un intervalle libre, tel que saisi dans les deux champs de date. */
  choisirIntervalle: (debut: string, fin: string) => void;
  /** Les trois choix rapides, déjà datés, pour les afficher dans le menu. */
  apercus: { cle: Exclude<ClePeriode, "custom">; nom: string; libelle: string }[];
  /** Ce que portent les deux champs de date du formulaire. */
  intervalleLibre: Intervalle;
}

/**
 * Le choix de période, mémorisé d'une visite à l'autre.
 *
 * COMME POUR LE DRAPEAU, LA MÉMOIRE ARRIVE APRÈS LE PREMIER RENDU. Le
 * serveur n'a pas de `localStorage` : lire le choix pendant le rendu
 * ferait diverger les deux arbres et React jetterait tout l'affichage.
 * On part donc du mois en cours — ce que le serveur peut savoir — et le
 * choix mémorisé s'applique à la première image.
 */
export function useDashboardPeriod(aujourdhui = dateDuJour()): PeriodeChoisie {
  const [cle, setCle] = useState<ClePeriode>("month");
  const [libre, setLibre] = useState<Intervalle>({
    debut: debutDeMois(aujourdhui),
    fin: aujourdhui,
  });

  useEffect(() => {
    const memoire = lire<unknown>("period", "month");
    const debut = lire<unknown>("from", null);
    const fin = lire<unknown>("to", null);
    if (typeof debut === "string" && typeof fin === "string") {
      setLibre({ debut, fin });
    }
    if (est(memoire)) setCle(memoire);
  }, []);

  const choisir = useCallback((c: Exclude<ClePeriode, "custom">) => {
    setCle(c);
    ecrire("period", c);
  }, []);

  const choisirIntervalle = useCallback((debut: string, fin: string) => {
    setLibre({ debut, fin });
    setCle("custom");
    ecrire("period", "custom");
    ecrire("from", debut);
    ecrire("to", fin);
  }, []);

  const periode = useMemo(
    () => construirePeriode(cle, libre, aujourdhui),
    [cle, libre, aujourdhui],
  );

  const apercus = useMemo(
    () =>
      (["today", "week", "month"] as const).map((c) => {
        const p = construirePeriode(c, libre, aujourdhui);
        return { cle: c, nom: p.nom, libelle: p.libelle };
      }),
    [libre, aujourdhui],
  );

  return { periode, choisir, choisirIntervalle, apercus, intervalleLibre: libre };
}

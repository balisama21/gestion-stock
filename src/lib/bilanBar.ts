import type { Expense, Sale } from "../types";

/**
 * LE BILAN D'UN BAR-KARAOKÉ
 *
 * Un bar se pilote à la soirée : combien rapporte une soirée moyenne,
 * quelles soirées de la semaine font la recette, ce qui se vend et ce
 * que ça laisse une fois les boissons payées et les frais réglés.
 *
 * Résultat = marge des ventes − dépenses, comme dans le bilan standard.
 */

export type Echelle = "soir" | "semaine" | "mois";

export interface Periode {
  /** Premier jour, AAAA-MM-JJ, inclus. */
  debut: string;
  /** Dernier jour, AAAA-MM-JJ, inclus. */
  fin: string;
  libelle: string;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
export const JOURS_SEMAINE = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

const versDate = (jour: string) => new Date(`${jour}T00:00:00Z`);
const versJour = (d: Date) => d.toISOString().slice(0, 10);
const decaler = (jour: string, jours: number) => {
  const d = versDate(jour);
  d.setUTCDate(d.getUTCDate() + jours);
  return versJour(d);
};
const court = (jour: string) => {
  const [, m, j] = jour.split("-");
  return `${j}/${m}`;
};

/** 0 = lundi … 6 = dimanche. */
export const rangDansLaSemaine = (jour: string) => (versDate(jour).getUTCDay() + 6) % 7;

/**
 * La période affichée : `recul` = 0 pour la période en cours, 1 pour la
 * précédente, etc. Une semaine va du lundi au dimanche.
 */
export function periodeDe(echelle: Echelle, recul: number, aujourdhui: string): Periode {
  if (echelle === "soir") {
    const jour = decaler(aujourdhui, -recul);
    const [a, m, j] = jour.split("-");
    const libelle =
      recul === 0
        ? "Aujourd'hui"
        : recul === 1
          ? "Hier"
          : `${JOURS_SEMAINE[rangDansLaSemaine(jour)]} ${Number(j)} ${MOIS[Number(m) - 1]} ${a}`;
    return { debut: jour, fin: jour, libelle };
  }
  if (echelle === "semaine") {
    const lundi = decaler(aujourdhui, -rangDansLaSemaine(aujourdhui) - 7 * recul);
    const dimanche = decaler(lundi, 6);
    const libelle =
      recul === 0
        ? "Cette semaine"
        : recul === 1
          ? "La semaine dernière"
          : `Du ${court(lundi)} au ${court(dimanche)}`;
    return { debut: lundi, fin: dimanche, libelle };
  }
  const d = versDate(aujourdhui);
  const premier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - recul, 1));
  const dernier = new Date(Date.UTC(premier.getUTCFullYear(), premier.getUTCMonth() + 1, 0));
  const nom = MOIS[premier.getUTCMonth()];
  return {
    debut: versJour(premier),
    fin: versJour(dernier),
    libelle: `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${premier.getUTCFullYear()}`,
  };
}

export const dansLaPeriode = (jour: string, p: Periode) => jour >= p.debut && jour <= p.fin;

/** Tous les jours de la période, du premier au dernier. */
export function joursDe(p: Periode): string[] {
  const jours: string[] = [];
  for (let j = p.debut; j <= p.fin; j = decaler(j, 1)) jours.push(j);
  return jours;
}

export interface BilanBar {
  ca: number;
  /** Le prix d'achat de ce qui a été vendu. */
  cout: number;
  marge: number;
  depenses: number;
  resultat: number;
  /** Les droits de table encaissés (lignes sans produit). */
  droitsDeTable: number;
  additions: number;
  /** Les soirées où quelque chose a été vendu. */
  soirees: number;
  moyenneParSoiree: number;
  meilleureSoiree: { jour: string; ca: number } | null;
  /** Chaque jour de la période, même vide. */
  parSoir: { jour: string; ca: number }[];
  /** Du lundi au dimanche : recette moyenne des soirées ouvertes. */
  parJourSemaine: { jour: string; moyenne: number; soirees: number }[];
  topArticles: { nom: string; quantite: number; ca: number; marge: number }[];
  parRubrique: { nom: string; ca: number }[];
  depensesParPoste: { nom: string; montant: number }[];
}

export function bilanBar(args: {
  ventes: Sale[];
  depenses: Expense[];
  periode: Periode;
  rubriqueDe: Map<string, string>;
  posteDe: Map<string, string>;
}): BilanBar {
  const { periode, rubriqueDe, posteDe } = args;
  const ventes = args.ventes.filter(
    (v) => v.origine !== "commande" && dansLaPeriode(v.date, periode),
  );
  const depenses = args.depenses.filter((d) => dansLaPeriode(d.date, periode));

  const ca = ventes.reduce((n, v) => n + v.totalVente, 0);
  const marge = ventes.reduce((n, v) => n + v.margeTotale, 0);
  const totalDepenses = depenses.reduce((n, d) => n + d.montant, 0);

  const parJour = new Map<string, number>();
  const articles = new Map<string, { nom: string; quantite: number; ca: number; marge: number }>();
  const rubriques = new Map<string, number>();
  let droitsDeTable = 0;
  for (const v of ventes) {
    parJour.set(v.date, (parJour.get(v.date) ?? 0) + v.totalVente);
    if (!v.productId) {
      droitsDeTable += v.totalVente;
      continue;
    }
    const a = articles.get(v.productId) ?? { nom: v.designation, quantite: 0, ca: 0, marge: 0 };
    a.quantite += v.quantite;
    a.ca += v.totalVente;
    a.marge += v.margeTotale;
    articles.set(v.productId, a);
    const r = rubriqueDe.get(v.productId) ?? "Sans rubrique";
    rubriques.set(r, (rubriques.get(r) ?? 0) + v.totalVente);
  }
  if (droitsDeTable > 0) rubriques.set("Droits de table", droitsDeTable);

  const ouvertes = [...parJour.entries()].filter(([, montant]) => montant > 0);
  const meilleure = ouvertes.reduce<{ jour: string; ca: number } | null>(
    (m, [jour, montant]) => (!m || montant > m.ca ? { jour, ca: montant } : m),
    null,
  );

  const semaine = JOURS_SEMAINE.map((jour) => ({ jour, total: 0, soirees: 0 }));
  for (const [jour, montant] of ouvertes) {
    const s = semaine[rangDansLaSemaine(jour)];
    s.total += montant;
    s.soirees += 1;
  }

  const postes = new Map<string, number>();
  for (const d of depenses) {
    const nom = d.categoryId ? (posteDe.get(d.categoryId) ?? "Autre") : "Non classées";
    postes.set(nom, (postes.get(nom) ?? 0) + d.montant);
  }

  return {
    ca,
    cout: ca - marge,
    marge,
    depenses: totalDepenses,
    resultat: marge - totalDepenses,
    droitsDeTable,
    additions: new Set(ventes.map((v) => v.ticketId ?? v.id)).size,
    soirees: ouvertes.length,
    moyenneParSoiree: ouvertes.length ? ca / ouvertes.length : 0,
    meilleureSoiree: meilleure,
    parSoir: joursDe(periode).map((jour) => ({ jour, ca: parJour.get(jour) ?? 0 })),
    parJourSemaine: semaine.map((s) => ({
      jour: s.jour,
      moyenne: s.soirees ? s.total / s.soirees : 0,
      soirees: s.soirees,
    })),
    topArticles: [...articles.values()].sort((a, b) => b.ca - a.ca).slice(0, 10),
    parRubrique: [...rubriques.entries()]
      .map(([nom, montant]) => ({ nom, ca: montant }))
      .sort((a, b) => b.ca - a.ca),
    depensesParPoste: [...postes.entries()]
      .map(([nom, montant]) => ({ nom, montant }))
      .sort((a, b) => b.montant - a.montant),
  };
}

import { formatCurrency } from "../../../utils/formulas";

/**
 * MISE EN FORME DES NOMBRES ET DES DATES DU TABLEAU DE BORD
 *
 * Les montants passent par `formatCurrency`, celui de toute
 * l'application : c'est lui qui sépare les milliers par une espace
 * insécable ordinaire plutôt que par l'espace fine de la locale
 * française, laquelle ne survit pas à tous les encodages. Réécrire ce
 * formatage ici donnerait deux façons d'afficher le même montant selon
 * l'écran — et la maquette demande exactement ce que `formatCurrency`
 * produit déjà : « 344 800 Ar ».
 *
 * TOUTES LES DATES SONT LOCALES. Voir `src/lib/dates.ts` : à
 * Antananarivo, qui vit trois heures en avance, passer par le temps
 * universel date les saisies de nuit de la veille. Aucune fonction
 * d'ici n'appelle `toISOString`, et `new Date("AAAA-MM-JJ")` est
 * proscrit — cette forme-là vaut minuit UTC, donc la veille au soir sur
 * place.
 */

/** « 344 800 Ar ». Le format de toute l'application. */
export const montant = (n: number): string => formatCurrency(n);

/**
 * Le même montant coupé en deux : les chiffres, puis l'unité.
 *
 * La maquette écrit le nombre en gros et « Ar » en petit à côté. Reste
 * à savoir où couper, et c'est plus subtil qu'il n'y paraît :
 * `formatCurrency` sépare les MILLIERS par une espace INSÉCABLE, et
 * colle l'unité derrière une espace ORDINAIRE. C'est donc la dernière
 * espace ordinaire qui marque la coupure.
 *
 * Chercher la dernière insécable, comme on le fait spontanément,
 * coupe au milieu du nombre : « 409 200 Ar » s'affiche alors « 409 »
 * en quarante-quatre pixels suivi de « 200 Ar » en dix-huit. Le défaut
 * est passé inaperçu trois phases durant, parce qu'un montant à trois
 * chiffres — « 5 200 Ar » — a l'air presque normal ainsi.
 */
export function montantEnDeux(valeur: number | string): {
  chiffres: string;
  unite: string;
} {
  const texte = typeof valeur === "number" ? montant(valeur) : valeur;
  const coupe = texte.lastIndexOf(" ");
  return coupe > 0
    ? { chiffres: texte.slice(0, coupe), unite: texte.slice(coupe + 1) }
    : { chiffres: texte, unite: "" };
}

/** « 344 800 », sans l'unité — pour les colonnes qui la portent déjà. */
export function nombre(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(Math.round(n))
    .replace(/\u202f/g, "\u00a0");
}

/**
 * Un montant signé, « +12 000 Ar » ou « −12 000 Ar ».
 *
 * Le signe est le vrai moins typographique (U+2212), pas le trait
 * d'union : à côté d'un chiffre, le trait d'union est plus court et
 * plus haut, et se lit comme une césure.
 */
export function montantSigne(n: number): string {
  if (n === 0) return montant(0);
  return (n > 0 ? "+" : "−") + montant(Math.abs(n));
}

/**
 * « 1 jour », « 5 jours », « 0 jour ».
 *
 * Les « jour(s) » entre parenthèses sont une facilité d'écriture qui se
 * voit : elles disent au lecteur qu'un programme n'a pas su choisir.
 * En français, le singulier vaut jusqu'à un inclus, pluriel au-delà —
 * et zéro reste au singulier.
 */
export function pluriel(n: number, singulier: string, plur?: string): string {
  const mot = Math.abs(n) > 1 ? (plur ?? `${singulier}s`) : singulier;
  return `${nombre(n)} ${mot}`;
}

/** « 12 % », espace insécable comprise. */
export function pourcent(n: number): string {
  return `${Math.round(n)}\u00a0%`;
}

/**
 * Un jour du calendrier, tel que la base le stocke, rendu en Date
 * LOCALE. `new Date("2026-09-16")` vaudrait minuit UTC, soit le
 * 15 septembre à 21 h à Antananarivo, et toutes les dates affichées
 * reculeraient d'un jour.
 */
export function dateLocale(jour: string): Date {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, j ?? 1);
}

const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** « Mercredi 16 septembre 2026 ». */
export function dateLongue(d: Date): string {
  return cap(
    d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );
}

/** « Mer. 16 sept. » — l'en-tête compact du téléphone. */
export function dateCourte(d: Date): string {
  return cap(d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }));
}

/** « 16 sept. » */
export function jourEtMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** « 16/09 » */
export function jourMoisChiffres(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** « 18:42 » */
export function heure(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * L'intervalle dit en une ligne : « 1 – 16 sept. », « 16 sept. »,
 * « 28 août – 16 sept. ».
 *
 * Le mois ne se répète pas quand les deux bornes le partagent, ni
 * l'année quand elle est celle en cours. Écrire « 1 septembre 2026 –
 * 16 septembre 2026 » dans un bouton de trente-six pixels de haut, ce
 * n'est pas être précis, c'est être illisible.
 */
export function intervalleCourt(debut: string, fin: string): string {
  const d = dateLocale(debut);
  const f = dateLocale(fin);
  if (debut === fin) return jourEtMois(d);

  const memeAnnee = d.getFullYear() === f.getFullYear();
  const memeMois = memeAnnee && d.getMonth() === f.getMonth();
  const anneeCourante = f.getFullYear() === new Date().getFullYear();

  const gauche = memeMois
    ? String(d.getDate())
    : memeAnnee || anneeCourante
      ? jourEtMois(d)
      : `${jourEtMois(d)} ${d.getFullYear()}`;

  const droite = anneeCourante ? jourEtMois(f) : `${jourEtMois(f)} ${f.getFullYear()}`;

  return `${gauche} – ${droite}`;
}

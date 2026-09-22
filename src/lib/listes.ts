import type { Database } from "./database.types";
import type { Personnalisation } from "./personnalisation";

export type ValeurDeListe = Database["public"]["Tables"]["categories"]["Row"];

/**
 * Les listes qu'une boutique tient elle-même.
 *
 * Elles partagent une table, `categories`, et se distinguent par sa
 * colonne `usage`. Ajouter une liste au logiciel, c'est ajouter une
 * entrée ici et une valeur au CHECK de la base — pas une table de plus,
 * pas un écran de plus.
 */
export type UsageDeListe = "produit" | "depense" | "type_fournisseur";

export interface DescriptionDeListe {
  usage: UsageDeListe;
  titre: string;
  /** Ce que la liste range, dit du point de vue du commerçant. */
  description: string;
  /** Deux ou trois valeurs, pour que le champ vide ne soit pas muet. */
  exemple: string;
  /** Vrai si cette liste accepte des sous-valeurs (deux niveaux). */
  deuxNiveaux?: boolean;
  /** Vrai si chaque valeur peut porter un taux de marge par défaut. */
  porteUnTaux?: boolean;
}

export const LISTES: DescriptionDeListe[] = [
  {
    usage: "produit",
    titre: "Catégories de produits",
    description: "Les familles qui rangent votre catalogue.",
    exemple: "Alimentation, Emballages, Services…",
    deuxNiveaux: true,
    porteUnTaux: true,
  },
  {
    usage: "depense",
    titre: "Postes de dépenses",
    description: "Ce à quoi sert l'argent qui sort.",
    exemple: "Loyer, Transport, Taxes et impôts…",
    deuxNiveaux: true,
  },
  {
    usage: "type_fournisseur",
    titre: "Types de fournisseur",
    description: "Ce qu'est un fournisseur pour vous.",
    exemple: "Grossiste, Fabricant, Particulier…",
  },
];

export const descriptionDeListe = (usage: UsageDeListe): DescriptionDeListe =>
  LISTES.find((l) => l.usage === usage) ?? LISTES[0];

/* ─────────────────────────────────────────────────────────────
 * La clé de comparaison
 * ───────────────────────────────────────────────────────────── */

/**
 * Le même texte, ramené à ce qui compte pour le comparer.
 *
 * Jumelle exacte de `cle_de_liste(text)` en base, qui porte l'index
 * unique d'anti-doublon. Les deux doivent rendre la même chose, sans
 * quoi l'écran proposerait de créer une valeur que la base refuserait.
 *
 * `normalize("NFD")` sépare la lettre de son accent, et la plage
 * Unicode retirée ensuite est exactement celle des signes diacritiques
 * combinants — c'est ce qui rend « Électricité » et « electricite »
 * identiques sans table de correspondance à tenir.
 */
export const cleDeListe = (texte: string): string =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

/** Vrai si le texte cherché se retrouve dans la valeur, accents mis à part. */
export const correspond = (valeur: string, recherche: string): boolean =>
  cleDeListe(valeur).includes(cleDeListe(recherche));

/**
 * La valeur déjà présente qui porte ce nom, à la casse et aux accents près.
 *
 * C'est l'anti-doublon : taper « grossiste » quand « Grossiste » existe
 * ne doit pas proposer d'en créer un second, mais désigner l'existant.
 */
export const valeurEquivalente = <T extends { nom: string }>(
  valeurs: T[],
  nom: string,
): T | undefined => {
  const cle = cleDeListe(nom);
  if (!cle) return undefined;
  return valeurs.find((v) => cleDeListe(v.nom) === cle);
};

/* ─────────────────────────────────────────────────────────────
 * Trier et filtrer
 * ───────────────────────────────────────────────────────────── */

export const trierValeurs = <T extends { ordre: number; nom: string }>(valeurs: T[]): T[] =>
  [...valeurs].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));

/**
 * Les valeurs d'une liste, dans l'ordre choisi par la boutique.
 *
 * `valeurRetenue` force une valeur archivée à rester dans la liste : un
 * ancien enregistrement doit pouvoir s'ouvrir et se refermer sans que
 * son poste de dépense disparaisse sous les yeux de qui le relit.
 */
export const valeursDeLaListe = (
  toutes: ValeurDeListe[],
  usage: UsageDeListe,
  valeurRetenue?: string | null,
): ValeurDeListe[] =>
  trierValeurs(
    toutes.filter((v) => (v.usage ?? "produit") === usage && (v.actif || v.id === valeurRetenue)),
  );

/* ─────────────────────────────────────────────────────────────
 * Les réglages de la boutique
 * ───────────────────────────────────────────────────────────── */

export type QuiPeutAjouter = "tous" | "responsables";

export interface ReglagesListes {
  /** Qui peut créer une valeur depuis un formulaire, sans passer par les réglages. */
  ajoutDepuisFormulaire: QuiPeutAjouter;
}

/**
 * Lu avec un défaut permissif, et c'est voulu.
 *
 * Clé absente = « tout le monde », c'est-à-dire exactement ce que fait
 * le logiciel aujourd'hui. Une boutique qui ne règle rien ne voit aucun
 * changement ; c'est la règle générale du cahier des charges.
 */
export const lireReglagesListes = (p: Personnalisation): ReglagesListes => {
  const brut = (p as { listes?: { ajoutDepuisFormulaire?: unknown } }).listes;
  const choix = brut?.ajoutDepuisFormulaire;
  return {
    ajoutDepuisFormulaire: choix === "responsables" ? "responsables" : "tous",
  };
};

/**
 * Le nom que la boutique donne au champ « Effectué par » d'une dépense.
 *
 * Il s'appelait « Vendeur », et ne désignait déjà plus un vendeur : c'est
 * qui a sorti l'argent, vendeur, livreur, comptable ou commissionnaire.
 * Un client dit « Exécutant » ; le mot se règle donc par boutique.
 */
export const LIBELLE_EFFECTUE_PAR = "Effectué par";

export const libelleEffectuePar = (p: Personnalisation): string => {
  const brut = (p as { libelles?: { effectuePar?: unknown } }).libelles?.effectuePar;
  return typeof brut === "string" && brut.trim() ? brut.trim() : LIBELLE_EFFECTUE_PAR;
};

/* ─────────────────────────────────────────────────────────────
 * Import CSV
 * ───────────────────────────────────────────────────────────── */

/**
 * Les noms lus dans un fichier collé ou déposé.
 *
 * Volontairement simple : une valeur par ligne, ou la première colonne
 * si la ligne en contient plusieurs. Les listes qu'on importe sont des
 * listes de noms ; exiger un en-tête et un format de colonnes aurait
 * fait échouer le premier essai de tout le monde.
 *
 * Les doublons internes au fichier sont retirés ici, avant même de
 * regarder ce que la boutique possède déjà.
 */
export const lireNomsCsv = (contenu: string): string[] => lireLignesCsv(contenu).map((l) => l.nom);

/**
 * Les lignes d'un fichier, nom et second champ.
 *
 * Le second champ sert à l'annuaire des fournisseurs : un nom, un
 * téléphone. Il reste facultatif — un fichier d'une seule colonne
 * s'importe aussi bien, et c'est le cas le plus courant.
 */
export const lireLignesCsv = (contenu: string): { nom: string; second: string | null }[] => {
  const vus = new Set<string>();
  const lignes: { nom: string; second: string | null }[] = [];
  for (const ligne of contenu.split(/\r?\n/)) {
    const colonnes = ligne.split(/[;,\t]/);
    const nom = (colonnes[0] ?? "").replace(/^"(.*)"$/, "$1").trim();
    if (!nom) continue;
    const cle = cleDeListe(nom);
    if (vus.has(cle)) continue;
    vus.add(cle);
    const second = (colonnes[1] ?? "").replace(/^"(.*)"$/, "$1").trim();
    lignes.push({ nom, second: second || null });
  }
  return lignes;
};

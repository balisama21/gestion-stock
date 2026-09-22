import type { Database } from "./database.types";
import type { Personnalisation } from "./personnalisation";

export type ValeurDeListe = Database["public"]["Tables"]["categories"]["Row"];

/** Les listes partagent la table `categories` ; `usage` dit laquelle. */
export type UsageDeListe = "produit" | "depense" | "type_fournisseur";

export interface DescriptionDeListe {
  usage: UsageDeListe;
  titre: string;
  description: string;
  exemple: string;
  deuxNiveaux?: boolean;
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

/**
 * Jumelle exacte de `cle_de_liste(text)` en base, qui porte l'index
 * unique d'anti-doublon. Si les deux divergeaient, l'écran proposerait
 * de créer une valeur que la base refuserait.
 */
export const cleDeListe = (texte: string): string =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

export const correspond = (valeur: string, recherche: string): boolean =>
  cleDeListe(valeur).includes(cleDeListe(recherche));

/** L'anti-doublon : « grossiste » retrouve « Grossiste ». */
export const valeurEquivalente = <T extends { nom: string }>(
  valeurs: T[],
  nom: string,
): T | undefined => {
  const cle = cleDeListe(nom);
  if (!cle) return undefined;
  return valeurs.find((v) => cleDeListe(v.nom) === cle);
};

export const trierValeurs = <T extends { ordre: number; nom: string }>(valeurs: T[]): T[] =>
  [...valeurs].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));

/**
 * `valeurRetenue` force une valeur archivée à rester dans la liste :
 * sans elle, rouvrir un vieil enregistrement lui ferait perdre son
 * poste au premier enregistrement.
 */
export const valeursDeLaListe = (
  toutes: ValeurDeListe[],
  usage: UsageDeListe,
  valeurRetenue?: string | null,
): ValeurDeListe[] =>
  trierValeurs(
    toutes.filter((v) => (v.usage ?? "produit") === usage && (v.actif || v.id === valeurRetenue)),
  );

export type QuiPeutAjouter = "tous" | "responsables";

export interface ReglagesListes {
  ajoutDepuisFormulaire: QuiPeutAjouter;
}

/** Défaut permissif : une boutique qui ne règle rien se comporte comme avant. */
export const lireReglagesListes = (p: Personnalisation): ReglagesListes => {
  const brut = (p as { listes?: { ajoutDepuisFormulaire?: unknown } }).listes;
  return {
    ajoutDepuisFormulaire: brut?.ajoutDepuisFormulaire === "responsables" ? "responsables" : "tous",
  };
};

export const LIBELLE_EFFECTUE_PAR = "Effectué par";

/** Le nom que la boutique donne au champ ; un client dit « Exécutant ». */
export const libelleEffectuePar = (p: Personnalisation): string => {
  const brut = (p as { libelles?: { effectuePar?: unknown } }).libelles?.effectuePar;
  return typeof brut === "string" && brut.trim() ? brut.trim() : LIBELLE_EFFECTUE_PAR;
};

export const lireNomsCsv = (contenu: string): string[] => lireLignesCsv(contenu).map((l) => l.nom);

/**
 * Un nom par ligne, deuxième colonne facultative (le téléphone d'un
 * fournisseur). Les doublons internes au fichier sont retirés ici.
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

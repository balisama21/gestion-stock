import type { Echeance } from "./format";
import type { ModeleDocument } from "./reglages";

/**
 * NIVEAU 2 — CE QUI CHANGE D'UN TYPE DE DOCUMENT À L'AUTRE
 *
 * Une facture, un devis et un reçu ne disent pas la même chose : leur
 * titre diffère, leur numérotation aussi, et le texte de conditions
 * qu'on imprime en bas n'a rien de commun. Jusqu'ici ces différences
 * étaient écrites dans le code — le titre dans une table, le préfixe
 * dans une autre, les conditions dans trois constantes. Elles sont
 * maintenant des RÉGLAGES, dont les valeurs par défaut sont exactement
 * ce que le code disait.
 *
 * ── UNE CLÉ ABSENTE VEUT DIRE « COMME LA BOUTIQUE » ────────────────
 *
 * Un type n'apparaît dans l'enregistrement QUE si la boutique l'a
 * personnalisé. Tant qu'elle ne l'a pas fait, il n'y a rien à lire, et
 * le document sort comme avant. C'est ce qui permet d'ajouter un
 * réglage plus tard sans toucher aux boutiques déjà configurées.
 *
 * Une fois le type personnalisé, un champ VIDE veut dire vide — pas
 * « hérité ». Sans quoi on ne pourrait jamais retirer un mot de fin,
 * et l'écran mentirait sur ce qu'il va imprimer.
 *
 * ── CE QUI N'EST PAS ENCORE RÉGLABLE, ET POURQUOI ──────────────────
 *
 * LE PROCHAIN NUMÉRO. Le cahier le demande au niveau 2. Il vit dans
 * `store_counters`, côté serveur, et le modifier demande une fonction
 * que la base n'expose pas — donc du SQL, donc une validation. Un
 * champ qui n'écrirait nulle part serait pire que pas de champ. Voir
 * `docs/documents-v3/sql-propose.sql`.
 */

export type TypeDocumentV3 =
  | "facture"
  | "proforma"
  | "devis"
  | "recu"
  | "commande"
  | "achat"
  | "facture_achat"
  | "commission"
  | "ticket";

/** Ce qu'une boutique peut changer sur un type. Absent = comme la boutique. */
export interface ReglagesType {
  titre?: string;
  /** « FAC- », ou « FAC-{AAAA}- ». Voir `numeroDuDocument`. */
  prefixe?: string;
  modele?: ModeleDocument;
  couleur?: string;
  /** Facture seulement. */
  echeance?: Echeance;
  /** Devis et proforma seulement, en jours. */
  validiteJours?: number;
  motDeFin?: string;
  conditions?: string;
  piedDePage?: string;
  /**
   * Comment la commission apparaît, quand la pièce en porte une.
   *
   * `true` — deux lignes : la prestation, puis la commission.
   * `false` — rien : elle reste comprise dans le prix des lignes.
   *
   * Dans les deux cas le total est le même, au centime près : la
   * commission est une PART de ce que le client paie, pas un
   * supplément. Voir la migration `documents_v3_commission_de_service`.
   */
  commissionSeparee?: boolean;
}

/** Les types, tels qu'ils sont enregistrés : seuls les personnalisés y sont. */
export type ReglagesParType = Partial<Record<TypeDocumentV3, ReglagesType>>;

/**
 * Ce que le logiciel prévoit pour chaque type.
 *
 * Ces valeurs sont le relevé de ce que le code imprimait avant la
 * refonte, à la lettre près : c'est le préréglage « Par défaut », et
 * c'est ce qui garantit qu'une boutique qui ne touche à rien retrouve
 * ses documents d'hier.
 */
export interface DefautsType {
  /** Le nom qui s'imprime en tête. */
  titre: string;
  /** Ce qui habille le numéro de la base. Vide quand la pièce n'en a pas. */
  prefixe: string;
  /** Le texte légal du bas de page. */
  conditions: string;
  /** Devis et proforma : combien de temps l'offre tient. */
  validiteJours?: number;
  /** La commission se détaille, sauf avis contraire de la boutique. */
  commissionSeparee?: boolean;
  /**
   * Le mot de fin, quand le type en impose un AUTRE que celui de la
   * boutique. Absent, c'est celui de la boutique qui passe.
   *
   * Le bon de commande fournisseur s'en sert pour n'en avoir aucun :
   * « Merci de votre confiance » s'adresse à un client, et « sans
   * reprise après la vente » ne veut rien dire adressé à un
   * fournisseur. Ce choix était écrit dans le composant ; il est ici,
   * où la boutique peut le renverser.
   */
  motDeFin?: string;
  /** Le nom du type dans les réglages. */
  libelle: string;
}

const CONDITIONS_VENTE =
  "Paiement à réception sauf accord écrit. Tout retard de paiement entraîne des pénalités " +
  "au taux légal en vigueur. Marchandises vendues restant notre propriété jusqu'au paiement complet.";

const CONDITIONS_DEVIS =
  "Offre valable jusqu'à la date indiquée. La commande est ferme dès acceptation écrite " +
  "et versement de l'acompte convenu.";

const CONDITIONS_COMMANDE =
  "Commande ferme dès signature. Livraison sous réserve de disponibilité. Le solde est " +
  "réglé au plus tard à la livraison.";

const CONDITIONS_ACHAT = "Prix indicatifs, d'après le dernier achat connu.";

export const DEFAUTS_TYPE: Record<TypeDocumentV3, DefautsType> = {
  facture: {
    libelle: "Facture",
    titre: "FACTURE",
    prefixe: "FAC-",
    conditions: CONDITIONS_VENTE,
  },
  proforma: {
    libelle: "Facture proforma",
    titre: "FACTURE PROFORMA",
    prefixe: "PRO-",
    conditions: CONDITIONS_DEVIS,
    validiteJours: 30,
  },
  devis: {
    libelle: "Devis",
    titre: "DEVIS",
    prefixe: "DEV-",
    conditions: CONDITIONS_DEVIS,
    validiteJours: 30,
  },
  recu: {
    libelle: "Reçu",
    titre: "REÇU",
    prefixe: "REC-",
    conditions: CONDITIONS_VENTE,
  },
  commande: {
    libelle: "Bon de commande client",
    titre: "BON DE COMMANDE",
    prefixe: "CMD-",
    conditions: CONDITIONS_COMMANDE,
  },
  achat: {
    libelle: "Bon de commande fournisseur",
    titre: "Bon de commande",
    motDeFin: "",
    // Ce document ne porte aucun numéro aujourd'hui : il n'a donc pas
    // de préfixe à habiller. Le champ reste vide tant qu'il n'en a pas.
    prefixe: "",
    conditions: CONDITIONS_ACHAT,
  },
  facture_achat: {
    libelle: "Facture d'achat fournisseur",
    titre: "FACTURE D'ACHAT",
    motDeFin: "",
    prefixe: "FA-",
    conditions: "",
  },
  commission: {
    libelle: "Facture avec commission",
    titre: "FACTURE",
    prefixe: "FAC-",
    conditions: CONDITIONS_VENTE,
    commissionSeparee: true,
  },
  ticket: {
    libelle: "Ticket de caisse",
    titre: "",
    prefixe: "REC-",
    conditions: "",
  },
};

/**
 * Les types qui existent réellement aujourd'hui, dans l'ordre des
 * réglages. Le ticket de caisse n'y est pas : il a sa propre section,
 * avec la largeur du rouleau et le code-barres.
 */
export const TYPES_DISPONIBLES: TypeDocumentV3[] = [
  "facture",
  "commission",
  "proforma",
  "devis",
  "recu",
  "commande",
  "achat",
  "facture_achat",
];

/** Tous les types déclarés, y compris ceux qui n'ont pas encore d'écran. */
export const TYPES_DOCUMENT = Object.keys(DEFAUTS_TYPE) as TypeDocumentV3[];

/* ─────────────────────────────────────────────────────────────
 * Lecture de la colonne JSON
 * ───────────────────────────────────────────────────────────── */

const texte = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const entier = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined;

const MODELES: ModeleDocument[] = ["classique", "bandeau", "epure", "compact"];
const ECHEANCES: Echeance[] = ["a_reception", "sous_15_jours", "sous_30_jours", "comptant"];
const COULEUR_VALIDE = /^#[0-9a-fA-F]{6}$/;

/**
 * Ne garde que ce qui a un sens, et n'invente aucune clé.
 *
 * Une clé qu'on ne reconnaît pas est laissée de côté plutôt que
 * ramenée à une valeur par défaut : la différence compte, puisque
 * l'absence VEUT DIRE quelque chose — « comme la boutique ».
 */
function lireUnType(brut: unknown): ReglagesType | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const r = brut as Record<string, unknown>;
  const couleur = texte(r.couleur);
  const modele = texte(r.modele);
  const echeance = texte(r.echeance);

  const t: ReglagesType = {
    titre: texte(r.titre),
    prefixe: texte(r.prefixe),
    modele:
      modele && (MODELES as string[]).includes(modele) ? (modele as ModeleDocument) : undefined,
    couleur: couleur && COULEUR_VALIDE.test(couleur) ? couleur : undefined,
    echeance:
      echeance && (ECHEANCES as string[]).includes(echeance) ? (echeance as Echeance) : undefined,
    validiteJours: entier(r.validiteJours),
    commissionSeparee: typeof r.commissionSeparee === "boolean" ? r.commissionSeparee : undefined,
    motDeFin: texte(r.motDeFin),
    conditions: texte(r.conditions),
    piedDePage: texte(r.piedDePage),
  };

  // Les clés absentes ne sont pas écrites : `{titre: undefined}` et
  // `{}` ne se comparent pas de la même façon, et cet objet est
  // comparé à chaque frappe pour savoir s'il reste à enregistrer.
  const propre: ReglagesType = {};
  for (const [cle, valeur] of Object.entries(t)) {
    if (valeur !== undefined) (propre as Record<string, unknown>)[cle] = valeur;
  }
  return propre;
}

export function lireTypes(brut: unknown): ReglagesParType {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const r = brut as Record<string, unknown>;
  const sortie: ReglagesParType = {};
  for (const type of TYPES_DOCUMENT) {
    if (!(type in r)) continue;
    const lu = lireUnType(r[type]);
    if (lu) sortie[type] = lu;
  }
  return sortie;
}

/* ─────────────────────────────────────────────────────────────
 * Le numéro imprimé
 * ───────────────────────────────────────────────────────────── */

/**
 * L'année dans le préfixe, prise sur la DATE DU DOCUMENT.
 *
 * Et non sur aujourd'hui : une facture de décembre réimprimée en
 * janvier doit rendre le numéro qu'elle portait, sinon le client
 * appelle avec une référence que personne ne retrouve.
 */
export function appliquerVariables(prefixe: string, date: string | null | undefined): string {
  const iso = (date ?? "").slice(0, 10);
  const annee = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso.slice(0, 4)
    : String(new Date().getFullYear());
  return prefixe.replace(/\{AAAA\}/g, annee).replace(/\{AA\}/g, annee.slice(2));
}

/**
 * Le numéro tel qu'il s'imprime : le préfixe habille celui de la base.
 *
 * Un numéro absent ne produit pas un préfixe tout seul : on renvoie
 * une chaîne vide, et le document masque la ligne.
 */
export function numeroDuDocument(
  numero: string | null | undefined,
  prefixe: string,
  date?: string | null,
): string {
  const n = (numero ?? "").trim();
  if (!n) return "";
  return `${appliquerVariables(prefixe, date)}${n}`;
}

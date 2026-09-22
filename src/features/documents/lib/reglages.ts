import type { Echeance } from "./format";
import { IDENTITE_PAR_DEFAUT, lireIdentite, type IdentiteBoutique } from "./identite";
import { lireMisesEnPage, type MisesEnPage } from "./miseEnPage";
import { lireTypes, TYPES_DOCUMENT, type ReglagesParType } from "./typesDocument";

/**
 * CE QUE LA BOUTIQUE A DÉCIDÉ POUR SES DOCUMENTS
 *
 * Ces réglages appartiennent à la BOUTIQUE et non à la personne : un
 * vendeur ne choisit pas son modèle de facture à chaque vente, sans
 * quoi deux clients du même magasin recevraient deux papiers
 * différents le même jour.
 *
 * Ils vivent dans `stores.personnalisation`, sous la clé `documents`.
 * Pas de nouvelle colonne : la colonne existe, elle est en jsonb, et
 * deux sections des Paramètres s'en servent déjà de cette façon.
 *
 * ── UNE CLÉ ABSENTE VEUT DIRE « COMME PRÉVU PAR LE LOGICIEL » ──────
 *
 * C'est ce qui permet d'ajouter une option plus tard sans toucher aux
 * boutiques déjà configurées, et c'est pourquoi la lecture fusionne
 * toujours avec les valeurs par défaut au lieu de faire confiance à
 * ce qu'elle trouve.
 *
 * ── CE QUI N'Y EST PAS, ET POURQUOI ────────────────────────────────
 *
 * LA REMISE. La maquette propose une option « Remise ». Aucune
 * colonne de la base ne porte de remise, ni sur `sales`, ni sur
 * `orders` : la ligne ne s'afficherait donc jamais, et un interrupteur
 * sans effet est pire que pas d'interrupteur — il fait croire que la
 * fonction existe. L'option est retirée tant qu'une remise n'est pas
 * une vraie donnée de la vente. Le jour où elle le sera, elle changera
 * aussi le total et la marge : ce sera un chantier, pas une case.
 */

export type ModeleDocument = "classique" | "bandeau" | "epure" | "compact";
export type ChoixLogo = "auto" | "initiales" | "aucun";
export type LargeurTicket = 80 | 58;

export interface OptionsDocuments {
  /** La ligne de TVA. Sans effet si le taux de la boutique est à zéro. */
  tva: boolean;
  /** Le NIF/STAT de la boutique. Obligatoire pour facturer une entreprise. */
  nif: boolean;
  /** « Arrêtée la présente facture à la somme de… » */
  montantEnLettres: boolean;
  /** Le tampon « Payé » ou « Reste à payer ». */
  tamponPaiement: boolean;
  /** L'emplacement du cachet et de la signature. */
  signature: boolean;
  /** Les conditions de règlement, en bas de page. */
  conditions: boolean;
}

export interface ReglagesTicket {
  largeur: LargeurTicket;
  /** « 3 × 1 500 » plutôt que « 3 pièces ». */
  detailLignes: boolean;
  codeBarres: boolean;
  /** Vide = le message de `stores.receipt_footer`. */
  message: string;
}

export interface ReglagesDocuments {
  /**
   * NIVEAU 1 — l'identité commune, reprise par tous les documents.
   *
   * Elle ne recopie pas les colonnes de `stores` : voir `identite.ts`.
   * Vide par défaut, donc sans effet sur le rendu actuel.
   */
  identite: IdentiteBoutique;
  /**
   * NIVEAU 2 — ce que la boutique a changé sur UN type de document.
   *
   * Un type absent n'a pas été personnalisé : il suit la boutique et
   * les défauts du logiciel. Voir `typesDocument.ts` et `resolveur.ts`.
   */
  types: ReglagesParType;
  /**
   * NIVEAU 3 — la mise en page d'un type : ce qui s'affiche, sous
   * quel nom, dans quel ordre. Voir `miseEnPage.ts`.
   */
  pages: MisesEnPage;
  /**
   * L'INTERRUPTEUR DE LA BOUTIQUE.
   *
   * `null` — la boutique suit ce que le déploiement a décidé.
   * `true` — les nouveaux documents, quoi qu'en dise le déploiement.
   * `false` — les anciens, quoi qu'en dise le déploiement.
   *
   * C'est le seul moyen de revenir aux anciennes factures SANS
   * redéployer : il vit en base, se règle depuis Paramètres →
   * Documents, donc depuis un téléphone. Voir `drapeau.ts` pour
   * l'ordre dans lequel les interrupteurs se lisent.
   */
  actif: boolean | null;
  modele: ModeleDocument;
  couleur: string;
  logo: ChoixLogo;
  options: OptionsDocuments;
  /** Habille `sales.numero` : « FAC-» + « V026 ». Voir `numeroteDocument`. */
  prefixeFacture: string;
  echeance: Echeance;
  motDeFin: string;
  /** Vide = adresse et téléphone de la boutique. */
  piedDePage: string;
  ticket: ReglagesTicket;
}

export const REGLAGES_DOCUMENTS_PAR_DEFAUT: ReglagesDocuments = {
  // Par défaut la boutique ne tranche pas : c'est le déploiement qui
  // décide, et elle garde le pouvoir de dire non.
  actif: null,
  identite: IDENTITE_PAR_DEFAUT,
  types: {},
  pages: {},
  modele: "classique",
  couleur: "#0E7C5A",
  logo: "auto",
  options: {
    tva: false,
    nif: true,
    montantEnLettres: true,
    tamponPaiement: true,
    signature: true,
    conditions: true,
  },
  prefixeFacture: "FAC-",
  echeance: "sous_15_jours",
  motDeFin: "Merci de votre confiance.",
  piedDePage: "",
  ticket: {
    largeur: 80,
    detailLignes: true,
    codeBarres: true,
    message: "",
  },
};

/**
 * Les préfixes des quatre autres documents.
 *
 * @deprecated Ils sont devenus des réglages par type — voir
 * `DEFAUTS_TYPE` dans `typesDocument.ts`, qui porte ces mêmes valeurs
 * comme défauts du logiciel. Cette table n'est plus lue par les
 * documents ; elle reste exportée le temps qu'aucun appel extérieur
 * ne la cherche.
 */
export const PREFIXES: Record<string, string> = {
  devis: "DEV-",
  recu: "REC-",
  commande: "CMD-",
  achat: "BCF-",
};

const MODELES: ModeleDocument[] = ["classique", "bandeau", "epure", "compact"];
const LOGOS: ChoixLogo[] = ["auto", "initiales", "aucun"];
const ECHEANCES: Echeance[] = ["a_reception", "sous_15_jours", "sous_30_jours", "comptant"];

/** Une couleur de document doit être une couleur, pas du texte libre. */
const COULEUR_VALIDE = /^#[0-9a-fA-F]{6}$/;

const texte = (v: unknown, defaut: string): string => (typeof v === "string" ? v : defaut);
const oui = (v: unknown, defaut: boolean): boolean => (typeof v === "boolean" ? v : defaut);

function dans<T extends string>(v: unknown, permis: T[], defaut: T): T {
  return typeof v === "string" && (permis as string[]).includes(v) ? (v as T) : defaut;
}

/**
 * Ce que la colonne JSON contient, ramené à une forme sûre.
 *
 * Tout ce qui n'est pas reconnu retombe sur la valeur par défaut.
 * Cette colonne est modifiable par le propriétaire de la boutique :
 * une valeur inattendue n'est pas une hypothèse d'école, c'est un
 * réglage d'une version antérieure, ou un champ renommé.
 */
export function lireReglagesDocuments(brut: unknown): ReglagesDocuments {
  const d = REGLAGES_DOCUMENTS_PAR_DEFAUT;
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return d;

  const r = brut as Record<string, unknown>;
  const o = (r.options ?? {}) as Record<string, unknown>;
  const t = (r.ticket ?? {}) as Record<string, unknown>;
  const couleur = texte(r.couleur, d.couleur);

  return {
    // Trois états, et non deux : `undefined` n'est pas `false`.
    actif: typeof r.actif === "boolean" ? r.actif : null,
    identite: lireIdentite(r.identite),
    types: lireTypes(r.types),
    pages: lireMisesEnPage(r.pages, TYPES_DOCUMENT),
    modele: dans(r.modele, MODELES, d.modele),
    couleur: COULEUR_VALIDE.test(couleur) ? couleur : d.couleur,
    logo: dans(r.logo, LOGOS, d.logo),
    options: {
      tva: oui(o.tva, d.options.tva),
      nif: oui(o.nif, d.options.nif),
      montantEnLettres: oui(o.montantEnLettres, d.options.montantEnLettres),
      tamponPaiement: oui(o.tamponPaiement, d.options.tamponPaiement),
      signature: oui(o.signature, d.options.signature),
      conditions: oui(o.conditions, d.options.conditions),
    },
    prefixeFacture: texte(r.prefixeFacture, d.prefixeFacture),
    echeance: dans(r.echeance, ECHEANCES, d.echeance),
    motDeFin: texte(r.motDeFin, d.motDeFin),
    piedDePage: texte(r.piedDePage, d.piedDePage),
    ticket: {
      largeur: t.largeur === 58 ? 58 : 80,
      detailLignes: oui(t.detailLignes, d.ticket.detailLignes),
      codeBarres: oui(t.codeBarres, d.ticket.codeBarres),
      message: texte(t.message, d.ticket.message),
    },
  };
}

/**
 * Le numéro imprimé sur le document.
 *
 * Le préfixe HABILLE le numéro de la base, il ne le remplace pas :
 * « FAC-V026 » et non « FAC-2026-0011 ». C'est essentiel — le numéro
 * imprimé doit rester celui qu'on retrouve dans la liste des ventes,
 * sinon le client appelle avec une référence que personne ne sait
 * chercher.
 *
 * Un numéro absent ne produit pas « FAC- » tout seul : on renvoie une
 * chaîne vide et le document masque la ligne.
 */
export function numeroteDocument(numero: string | null | undefined, prefixe: string): string {
  const n = (numero ?? "").trim();
  if (!n) return "";
  return `${prefixe}${n}`;
}

/* ─────────────────────────────────────────────────────────────
 * La couleur du document
 * ───────────────────────────────────────────────────────────── */

/**
 * Éclaircit (`part` positive) ou assombrit (`part` négative) une
 * couleur, en fraction du chemin restant vers le blanc ou vers le noir.
 *
 * Le calcul se fait en sRGB, sans correction perceptuelle : c'est
 * exactement ce que fait la maquette, et le résultat est ce que vous
 * avez validé à l'écran. Un modèle plus juste donnerait d'autres
 * teintes que celles que vous avez vues.
 */
export function nuance(hex: string, part: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canaux = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const vers = (v: number) =>
    part > 0 ? Math.round(v + (255 - v) * part) : Math.round(v * (1 + part));
  return `#${canaux.map((v) => vers(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Les trois variables CSS que la feuille attend, dérivées d'une seule. */
export function variablesDeCouleur(couleur: string): Record<string, string> {
  const base = COULEUR_VALIDE.test(couleur) ? couleur : REGLAGES_DOCUMENTS_PAR_DEFAUT.couleur;
  return {
    "--doc": base,
    "--doc-soft": nuance(base, 0.88),
    "--doc-ink": nuance(base, -0.18),
  };
}

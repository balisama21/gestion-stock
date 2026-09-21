import type { LocaleSetting, Product, Sale, StoreSettings } from "../../../types";
import type { Database } from "../../../lib/database.types";
import { getSaleLabel } from "../../../utils/formulas";
import {
  dateCourte,
  dateEcheance,
  heure as lireHeure,
  initiales,
  LIBELLE_ECHEANCE,
} from "./format";
import { deviseEnToutesLettres, montantEnLettres } from "./montantEnLettres";
import { numeroteDocument, PREFIXES, type ReglagesDocuments } from "./reglages";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Paiement = Database["public"]["Tables"]["payments"]["Row"];

/**
 * DE LA BASE AU PAPIER
 *
 * Ce module est le seul endroit où l'on décide de ce qu'un document
 * montre. Les modèles, eux, ne décident de rien : ils mettent en page
 * ce qu'on leur donne. C'est ce qui permet d'en avoir quatre sans
 * avoir à vérifier quatre fois que le reste dû est le bon.
 *
 * ── DEUX RÈGLES, ET ELLES NE SOUFFRENT PAS D'EXCEPTION ─────────────
 *
 * **Le document affiche, il ne calcule pas de prix.** Les totaux
 * sortent de la base tels qu'ils y sont écrits. Le seul calcul permis
 * est une ADDITION de lignes déjà enregistrées, parce que c'est
 * exactement ce que fait la page Ventes pour le même ticket. Une
 * facture qui annoncerait un total différent de l'écran d'où elle
 * sort ruinerait la confiance dans les deux.
 *
 * **Une donnée absente disparaît.** Pas de « N/A », pas d'adresse
 * inventée. Les documents actuels affichent « Lot IVG 124,
 * Antananarivo 101 » et « +261 34 12 345 67 » quand la boutique n'a
 * rien saisi : une facture part alors chez un client avec l'adresse
 * de personne. Ici, une ligne vide est une ligne qui n'existe pas.
 */

export type TypeDocument = "facture" | "recu" | "devis" | "commande" | "achat";

/** Un couple « libellé : valeur » de l'en-tête (N°, Date, Échéance…). */
export interface LigneMeta {
  libelle: string;
  valeur: string;
}

/** L'émetteur ou le destinataire, réduits à ce qui est renseigné. */
export interface BlocTiers {
  titre: string;
  nom: string;
  /** Adresse, téléphone, e-mail… Les valeurs vides n'y sont pas. */
  lignes: string[];
  /** Numéro fiscal, montré à part parce qu'il se compose en chasse fixe. */
  nif: string | null;
}

export interface EnTeteBoutique extends BlocTiers {
  /** `null` si la boutique n'a pas de logo, ou si le réglage l'écarte. */
  logoUrl: string | null;
  /** Les initiales, quand elles remplacent le logo. `null` = pas de pastille. */
  initiales: string | null;
  sousTitre: string | null;
}

export interface LigneDocument {
  id: string;
  designation: string;
  /** « réf. P024 », ou `null` quand le produit n'a pas de référence. */
  detail: string | null;
  quantite: number;
  unite: string | null;
  prixUnitaire: number;
  total: number;
}

export interface TotauxDocument {
  /**
   * Le total hors taxe, présent seulement quand la TVA est affichée.
   * Il est DÉDUIT du total et non l'inverse — voir `totauxDeVente`.
   */
  horsTaxe: number | null;
  tva: { taux: number; montant: number } | null;
  /** Le total tel qu'il est en base. Jamais recalculé. */
  total: number;
  /** `null` quand le document ne parle pas de paiement (devis, achat). */
  paye: number | null;
  reste: number | null;
  /** « Espèces », « Mobile Money »… ou `null` si aucun règlement connu. */
  modePaiement: string | null;
  libelleTotal: string;
  libellePaye: string;
}

export interface Tampon {
  texte: string;
  /** `ok` quand tout est réglé, `du` quand il reste quelque chose. */
  ton: "ok" | "du";
}

export interface Signatures {
  gauche: string;
  droite: string;
}

/** Ce qu'un modèle reçoit. Il n'a le droit de rien y ajouter. */
export interface Document {
  type: TypeDocument;
  /** « FACTURE », « REÇU »… tel qu'il s'imprime. */
  titre: string;
  /** « FAC-V026 ». Vide quand la pièce n'a pas de numéro. */
  numero: string;
  meta: LigneMeta[];
  emetteur: EnTeteBoutique;
  destinataire: BlocTiers;
  lignes: LigneDocument[];
  totaux: TotauxDocument;
  tampon: Tampon | null;
  montantEnLettres: string | null;
  mentions: string | null;
  signatures: Signatures | null;
  motDeFin: string | null;
  piedDePage: string | null;
  devise: string;
  /** « Facture_FAC-V026 » — sans caractère qu'un système refuserait. */
  nomDeFichier: string;

  /* ── Ce que seul le ticket de caisse utilise ──────────────────── */

  /**
   * L'heure de l'encaissement, « 09:41 », ou `null`.
   *
   * Une facture porte un jour, un ticket porte un instant : c'est ce
   * qui permet de retrouver une vente contestée dans le journal de la
   * caisse.
   */
  heure: string | null;
  /** Le mot de la fin du ticket, réglé à part de celui des feuilles. */
  messageTicket: string | null;
  /**
   * Ce que le code-barres encode : le numéro BRUT de la base, sans le
   * préfixe d'affichage. Une douchette doit rendre « V026 », qui se
   * cherche dans la liste des ventes ; « REC-V026 » ne s'y trouve pas.
   */
  codeBarres: string | null;
}

/* ─────────────────────────────────────────────────────────────
 * Petites aides
 * ───────────────────────────────────────────────────────────── */

/** Une chaîne utile, ou rien. Une chaîne d'espaces ne compte pas. */
const util = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

/** Les morceaux non vides, séparés par un point médian. */
const joindre = (...parts: (string | null | undefined)[]): string | null =>
  util(parts.map(util).filter(Boolean).join(" · "));

const LIBELLE_METHODE: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  virement: "Virement",
};

/**
 * Le mode de règlement, en français.
 *
 * La base stocke un code (`mobile_money`). Un code inconnu est
 * présenté tel quel, tirets bas remplacés : mieux vaut « Cheque » que
 * rien du tout, si quelqu'un ajoute un moyen de paiement demain.
 */
export function libelleMethode(code: string | null | undefined): string | null {
  const c = util(code);
  if (!c) return null;
  return LIBELLE_METHODE[c] ?? c.replace(/_/g, " ").replace(/^./, (l) => l.toUpperCase());
}

/* ─────────────────────────────────────────────────────────────
 * L'en-tête de la boutique
 * ───────────────────────────────────────────────────────────── */

export function enTeteBoutique(
  boutique: StoreSettings | undefined,
  reglages: ReglagesDocuments,
): EnTeteBoutique {
  const nom = util(boutique?.storeName) ?? "";
  const logo = util(boutique?.logoUrl);

  // « auto » veut dire : le logo s'il existe, les initiales sinon.
  const montreLogo = reglages.logo === "auto" && logo !== null;
  const montreInitiales = reglages.logo === "initiales" || (reglages.logo === "auto" && !logo);

  return {
    titre: "Émetteur",
    nom,
    sousTitre: util(boutique?.subtitle),
    logoUrl: montreLogo ? logo : null,
    initiales: montreInitiales ? initiales(nom) || null : null,
    lignes: [util(boutique?.address), joindre(boutique?.phone, boutique?.email)].filter(
      (l): l is string => l !== null,
    ),
    nif: reglages.options.nif ? util(boutique?.nifStat) : null,
  };
}

/**
 * Le client d'une vente.
 *
 * Deux sources, et la première est celle qu'on n'imprimait pas
 * jusqu'ici : la FICHE client, qui porte l'entreprise, l'adresse, la
 * ville et le téléphone. À défaut, le nom libre saisi au comptoir. À
 * défaut de tout, « Client comptoir » — et le bloc se réduit à cette
 * ligne, sans cadre vide en dessous.
 */
export function destinataireDeVente(
  client: Client | null | undefined,
  nomLibre: string | null | undefined,
  titre = "Facturé à",
): BlocTiers {
  if (client) {
    const identite = util([client.prenom, client.nom].filter(Boolean).join(" "));
    const entreprise = util(client.entreprise);
    return {
      titre,
      // Une entreprise se facture à son nom ; la personne devient une
      // ligne de contact en dessous.
      nom: entreprise ?? identite ?? "Client comptoir",
      lignes: [
        entreprise && identite ? identite : null,
        util(client.adresse),
        util(client.ville),
        util(client.telephone),
      ].filter((l): l is string => l !== null),
      nif: null,
    };
  }

  return {
    titre,
    nom: util(nomLibre) ?? "Client comptoir",
    lignes: [],
    nif: null,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Les lignes et les totaux
 * ───────────────────────────────────────────────────────────── */

/**
 * Les lignes d'un ticket.
 *
 * La désignation vient de la VENTE et non du produit : `getSaleLabel`
 * lit le nom figé au moment de l'encaissement. Un produit renommé
 * depuis ne doit pas réécrire une facture déjà remise — le client a
 * chez lui un papier qui dit autre chose.
 *
 * La référence et l'unité, elles, viennent du catalogue : ce sont des
 * informations de rangement, pas des engagements.
 */
export function lignesDeVente(ventes: Sale[], produits: Product[]): LigneDocument[] {
  const parId = new Map(produits.map((p) => [p.id, p]));
  return ventes.map((v) => {
    const p = parId.get(v.productId);
    const reference = util(p?.numero);
    return {
      id: v.id,
      designation: util(getSaleLabel(v, produits)) ?? "Article",
      detail: reference ? `réf. ${reference}` : null,
      quantite: v.quantite,
      unite: util(p?.unite),
      prixUnitaire: v.prixVenteUnit,
      total: v.totalVente,
    };
  });
}

/**
 * Les totaux d'un ticket.
 *
 * ── LA TVA EST COMPRISE, ELLE NE S'AJOUTE PAS ──────────────────────
 *
 * C'est le seul endroit où je m'écarte de la maquette, et
 * délibérément. La maquette calcule `total = base + TVA` sur des
 * données fictives. Appliqué aux vraies ventes, ce calcul ferait
 * sortir une facture à 360 000 Ar pour une vente enregistrée à
 * 300 000 — un montant que le client n'a jamais payé, qui ne
 * correspond à rien en caisse, et qui contredirait la page Ventes.
 *
 * Les prix d'une boutique malgache sont des prix payés, toutes taxes
 * comprises. La TVA est donc EXTRAITE du total au lieu de s'y
 * ajouter : le total ne bouge pas d'un ariary, et la ligne de TVA dit
 * quelle part de ce total est de la taxe. L'addition reste juste —
 * `horsTaxe + tva === total`, exactement — parce que le hors-taxe est
 * obtenu par soustraction et non par une seconde division.
 */
export function totauxDeVente(
  ventes: Sale[],
  paiements: Paiement[],
  boutique: StoreSettings | undefined,
  reglages: ReglagesDocuments,
  type: "facture" | "recu" = "facture",
): TotauxDocument {
  // Une addition de lignes déjà enregistrées : c'est le même calcul
  // que celui de la page Ventes, à la ligne près.
  const total = ventes.reduce((n, v) => n + v.totalVente, 0);
  const paye = ventes.reduce((n, v) => n + v.montantPaye, 0);
  const reste = ventes.reduce((n, v) => n + v.soldeDu, 0);

  const taux = boutique?.tvaRate ?? 0;
  const avecTva = reglages.options.tva && taux > 0;
  const montantTva = avecTva ? Math.round(total - total / (1 + taux / 100)) : 0;

  // Le dernier règlement connu donne le moyen de paiement. Les
  // paiements arrivent déjà triés du plus récent au plus ancien.
  const mode = libelleMethode(paiements[0]?.methode);

  return {
    horsTaxe: avecTva ? total - montantTva : null,
    tva: avecTva ? { taux, montant: montantTva } : null,
    total,
    paye,
    reste,
    modePaiement: mode,
    /*
     * « Total à payer » n'est vrai que s'il reste quelque chose à
     * payer. Sur une vente soldée, la mention contredit le tampon
     * « PAYÉ » posé juste au-dessus, et sur un REÇU — un document qui
     * constate de l'argent reçu — elle est franchement fausse. Le
     * libellé suit donc l'état réel de la pièce.
     */
    libelleTotal: type === "recu" ? "Total réglé" : reste > 0 ? "Total à payer" : "Total",
    libellePaye: type === "recu" ? "Réglé" : "Déjà payé",
  };
}

/* ─────────────────────────────────────────────────────────────
 * Le document complet
 * ───────────────────────────────────────────────────────────── */

const TITRES: Record<TypeDocument, string> = {
  facture: "FACTURE",
  recu: "REÇU",
  devis: "DEVIS",
  commande: "BON DE COMMANDE",
  achat: "BON DE COMMANDE",
};

const MENTIONS_VENTE =
  "Paiement à réception sauf accord écrit. Tout retard de paiement entraîne des pénalités " +
  "au taux légal en vigueur. Marchandises vendues restant notre propriété jusqu'au paiement complet.";

/** Un nom de fichier qu'aucun système ne refusera. */
function nomDeFichier(...parties: string[]): string {
  return parties
    .join("_")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

export interface SourceVente {
  /** « facture » par défaut ; « recu » quand on veut le constat d'un paiement. */
  type?: "facture" | "recu";
  /** Toutes les lignes du même ticket. Une seule pour une vente isolée. */
  ventes: Sale[];
  produits: Product[];
  /** La fiche liée à la vente, quand il y en a une. */
  client?: Client | null;
  /** Les règlements de ces ventes, du plus récent au plus ancien. */
  paiements?: Paiement[];
  boutique?: StoreSettings;
  reglages: ReglagesDocuments;
  locale?: LocaleSetting;
}

/**
 * Une vente, mise en forme pour le papier.
 *
 * Le type par défaut est « facture » et non « reçu », même quand la
 * vente est soldée : beaucoup de clients veulent une facture d'un
 * achat payé comptant, et le contraire ne serait pas rattrapable
 * depuis l'écran. Le choix se fait à l'appel.
 */
export function documentDeVente(source: SourceVente): Document {
  const { ventes, produits, client, paiements = [], boutique, reglages } = source;
  const type = source.type ?? "facture";
  const locale = source.locale ?? "FR";

  const premiere = ventes[0];
  const dateVente = premiere?.date ?? null;
  const devise = util(boutique?.currencySymbol) ?? "Ar";

  const totaux = totauxDeVente(ventes, paiements, boutique, reglages, type);
  const numero = numeroteDocument(
    premiere?.numero,
    type === "recu" ? PREFIXES.recu : reglages.prefixeFacture,
  );

  /*
   * L'échéance : la DATE quand il y en a une à attendre, le libellé
   * seul sinon.
   *
   * « Sous 15 jours » demande au lecteur de compter, et il comptera
   * depuis le jour où il lit, pas depuis celui de la vente. Un
   * document dit une date. « À réception » et « Payée comptant »,
   * eux, n'en désignent aucune : le libellé est alors la réponse
   * complète.
   *
   * Un reçu n'a pas d'échéance du tout : il constate un paiement.
   */
  const echeanceIso = type === "facture" ? dateEcheance(dateVente, reglages.echeance) : null;
  const echeance: LigneMeta | null =
    type !== "facture"
      ? null
      : echeanceIso && reglages.echeance !== "a_reception"
        ? { libelle: "Échéance", valeur: dateCourte(echeanceIso, locale) }
        : { libelle: "Règlement", valeur: LIBELLE_ECHEANCE[reglages.echeance] };

  const meta: LigneMeta[] = [
    numero ? { libelle: "N°", valeur: numero } : null,
    dateVente ? { libelle: "Date", valeur: dateCourte(dateVente, locale) } : null,
    echeance,
    util(premiere?.vendeur) ? { libelle: "Vendeur", valeur: premiere.vendeur } : null,
  ].filter((l): l is LigneMeta => l !== null);

  const tampon: Tampon | null = !reglages.options.tamponPaiement
    ? null
    : (totaux.reste ?? 0) > 0
      ? { texte: "Reste à payer", ton: "du" }
      : { texte: "Payé", ton: "ok" };

  const enLettres = reglages.options.montantEnLettres
    ? montantEnLettres(totaux.total, deviseEnToutesLettres(devise))
    : null;

  const nomBoutique = util(boutique?.storeName);

  return {
    type,
    titre: TITRES[type],
    numero,
    meta,
    emetteur: enTeteBoutique(boutique, reglages),
    destinataire: destinataireDeVente(
      client,
      premiere?.clientCredit,
      type === "recu" ? "Reçu de" : "Facturé à",
    ),
    lignes: lignesDeVente(ventes, produits),
    totaux,
    tampon,
    montantEnLettres: enLettres,
    mentions: reglages.options.conditions ? MENTIONS_VENTE : null,
    signatures: reglages.options.signature
      ? {
          gauche: "Signature du client",
          droite: nomBoutique ? `Pour ${nomBoutique} · cachet et signature` : "Cachet et signature",
        }
      : null,
    motDeFin: util(reglages.motDeFin),
    // Un pied vide reprend l'identité de la boutique : c'est ce qu'on
    // veut y lire, et le régler soi-même reste possible.
    piedDePage:
      util(reglages.piedDePage) ?? joindre(nomBoutique, boutique?.address, boutique?.phone),
    devise,
    heure: lireHeure(premiere?.saisieLe) || null,
    // Le message du ticket a son propre réglage ; à défaut, celui que
    // la boutique a déjà écrit dans ses paramètres de reçu.
    messageTicket: util(reglages.ticket.message) ?? util(boutique?.receiptFooter),
    codeBarres: util(premiere?.numero),
    nomDeFichier: nomDeFichier(
      type === "recu" ? "Recu" : "Facture",
      numero || (premiere?.numero ?? "document"),
    ),
  };
}

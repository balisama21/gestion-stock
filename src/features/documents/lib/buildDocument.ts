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
import {
  ligneDesIdentifiants,
  ligneEnLigne,
  lignesDePaiement,
  lignesDesContacts,
} from "./identite";
import { deviseEnToutesLettres, montantEnLettres } from "./montantEnLettres";
import type { ReglagesDocuments } from "./reglages";
import type { PageResolue } from "./miseEnPage";
import { resoudreMiseEnPage, resoudreType } from "./resolveur";
import { numeroDuDocument, type TypeDocumentV3 } from "./typesDocument";

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

/**
 * Les documents que le moteur sait mettre en page.
 *
 * « proforma » y figure alors qu'il se construit comme un devis :
 * c'est ce qui permet au montant en lettres de dire « la présente
 * facture » et non « la présente offre », et au modèle de suivre les
 * réglages de la proforma plutôt que ceux du devis.
 */
export type TypeDocument =
  "facture" | "proforma" | "recu" | "devis" | "commande" | "achat" | "facture_achat" | "commission";

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

/** Les colonnes que le tableau porte vraiment, dans l'ordre choisi. */
export type CleColonne = "designation" | "quantite" | "unite" | "prixUnitaire" | "total";

export interface ColonneDocument {
  cle: CleColonne;
  libelle: string;
  /**
   * La boutique a donné son propre mot.
   *
   * Un modèle qui abrège — le Compact écrit « Qté » et « P.U. » —
   * garde son abréviation tant que personne n'a rien demandé, et
   * s'efface devant le mot choisi sinon.
   */
  personnalise: boolean;
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
  libelleHorsTaxe: string;
  /** « TVA », auquel le taux est accolé à l'affichage. */
  libelleTva: string;
  libelleReste: string;
  /**
   * La part que la boutique garde, DÉTAILLÉE.
   *
   * `null` quand il n'y en a pas, ou quand la boutique préfère la
   * laisser comprise dans le prix des lignes. Jamais une addition :
   * `prestation + commission === total`, exactement.
   */
  commission: {
    libellePrestation: string;
    /** `null` quand la mise en page ne montre que la commission. */
    prestation: number | null;
    libelle: string;
    montant: number;
  } | null;
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
  /** Les colonnes du tableau, réglées par la boutique. */
  colonnes: ColonneDocument[];
  totaux: TotauxDocument;
  tampon: Tampon | null;
  montantEnLettres: string | null;
  mentions: string | null;
  signatures: Signatures | null;
  motDeFin: string | null;
  /**
   * Où le client peut payer — Mobile Money, virement.
   *
   * `null` sur un document qui constate un paiement déjà fait : un
   * reçu qui indiquerait où payer ferait douter d'une dette éteinte.
   */
  coordonneesPaiement: string[] | null;
  piedDePage: string | null;
  /** « Page 1 / 2 ». Faux, les feuilles ne se numérotent pas. */
  paginer: boolean;
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
  page: PageResolue,
): EnTeteBoutique {
  const nom = util(boutique?.storeName) ?? "";
  const logo = util(boutique?.logoUrl);

  // « auto » veut dire : le logo s'il existe, les initiales sinon.
  const avecLogo = page.visible("entete.logo");
  const montreLogo = avecLogo && reglages.logo === "auto" && logo !== null;
  const montreInitiales =
    avecLogo && (reglages.logo === "initiales" || (reglages.logo === "auto" && !logo));

  /*
   * Chaque ligne de l'en-tête est un élément que la boutique peut
   * masquer, renommer ou déplacer. On les compose ici par leur clé,
   * puis `page.ordre` décide de celles qui sortent et de leur rang.
   * Une clé qui n'a rien à dire ne rend rien : c'est ce qui fait
   * qu'un élément masqué ne laisse pas de ligne vide derrière lui.
   */
  const lignes: Record<string, string[]> = {
    "entete.adresse": [util(boutique?.address)].filter((l): l is string => l !== null),
    "entete.telEmail": [joindre(boutique?.phone, boutique?.email)].filter(
      (l): l is string => l !== null,
    ),
    "entete.contacts": lignesDesContacts(reglages.identite),
    "entete.enLigne": [ligneEnLigne(reglages.identite)].filter((l): l is string => l !== null),
    "entete.identifiants": [ligneDesIdentifiants(reglages.identite)].filter(
      (l): l is string => l !== null,
    ),
  };

  return {
    titre: "Émetteur",
    nom: page.visible("entete.nom") ? nom : "",
    sousTitre: page.visible("entete.activite") ? util(boutique?.subtitle) : null,
    logoUrl: montreLogo ? logo : null,
    initiales: montreInitiales ? initiales(nom) || null : null,
    lignes: page.ordre("entete").flatMap((cle) => lignes[cle] ?? []),
    nif: page.visible("entete.nifStat") ? util(boutique?.nifStat) : null,
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
  page?: PageResolue,
): BlocTiers {
  const montre = (cle: string) => (page ? page.visible(cle) : true);
  const intitule = !montre("tiers.titre") ? "" : page ? page.libelle("tiers.titre", titre) : titre;

  if (client) {
    const identite = util([client.prenom, client.nom].filter(Boolean).join(" "));
    const entreprise = util(client.entreprise);
    const lignes: Record<string, string | null> = {
      // Une entreprise se facture à son nom ; la personne devient une
      // ligne de contact en dessous.
      "tiers.contact": entreprise && identite ? identite : null,
      "tiers.adresse": util(client.adresse),
      "tiers.ville": util(client.ville),
      "tiers.telephone": util(client.telephone),
    };
    const nom = entreprise ?? identite ?? "Client comptoir";
    return {
      titre: intitule,
      nom: montre("tiers.nom") ? nom : "",
      lignes: (page ? page.ordre("tiers") : Object.keys(lignes))
        .map((cle) => lignes[cle] ?? null)
        .filter((l): l is string => l !== null),
      nif: null,
    };
  }

  return {
    titre: intitule,
    nom: montre("tiers.nom") ? (util(nomLibre) ?? "Client comptoir") : "",
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
export function lignesDeVente(
  ventes: Sale[],
  produits: Product[],
  page?: PageResolue,
): LigneDocument[] {
  const avecReference = page ? page.visible("tableau.reference") : true;
  const parId = new Map(produits.map((p) => [p.id, p]));
  return ventes.map((v) => {
    const p = parId.get(v.productId);
    const reference = util(p?.numero);
    return {
      id: v.id,
      designation: util(getSaleLabel(v, produits)) ?? "Article",
      detail: avecReference && reference ? `réf. ${reference}` : null,
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
  page?: PageResolue,
  detailleLaCommission = false,
): TotauxDocument {
  const montre = (cle: string, defaut: boolean) => (page ? page.visible(cle) : defaut);
  const mot = (cle: string, defaut: string) => (page ? page.libelle(cle, defaut) : defaut);
  // Une addition de lignes déjà enregistrées : c'est le même calcul
  // que celui de la page Ventes, à la ligne près.
  const total = ventes.reduce((n, v) => n + v.totalVente, 0);
  const paye = ventes.reduce((n, v) => n + v.montantPaye, 0);
  const reste = ventes.reduce((n, v) => n + v.soldeDu, 0);
  // La commission est une part du total, jamais un supplément : on
  // l'additionne comme le reste, et le total ne bouge pas.
  const commission = ventes.reduce((n, v) => n + (v.commission ?? 0), 0);

  const taux = boutique?.tvaRate ?? 0;
  const montreHt = taux > 0 && montre("totaux.horsTaxe", reglages.options.tva);
  const montreTva = taux > 0 && montre("totaux.tva", reglages.options.tva);
  const montantTva = montreHt || montreTva ? Math.round(total - total / (1 + taux / 100)) : 0;

  // Le dernier règlement connu donne le moyen de paiement. Les
  // paiements arrivent déjà triés du plus récent au plus ancien.
  const mode = libelleMethode(paiements[0]?.methode);

  return {
    horsTaxe: montreHt ? total - montantTva : null,
    tva: montreTva ? { taux, montant: montantTva } : null,
    total,
    paye: montre("totaux.paye", true) ? paye : null,
    reste: montre("totaux.reste", true) ? reste : null,
    modePaiement: mode,
    /*
     * « Total à payer » n'est vrai que s'il reste quelque chose à
     * payer. Sur une vente soldée, la mention contredit le tampon
     * « PAYÉ » posé juste au-dessus, et sur un REÇU — un document qui
     * constate de l'argent reçu — elle est franchement fausse. Le
     * libellé suit donc l'état réel de la pièce.
     */
    libelleTotal: mot(
      "totaux.total",
      type === "recu" ? "Total réglé" : reste > 0 ? "Total à payer" : "Total",
    ),
    libellePaye: mot("totaux.paye", type === "recu" ? "Réglé" : "Déjà payé"),
    libelleHorsTaxe: mot("totaux.horsTaxe", "Total hors taxe"),
    libelleTva: mot("totaux.tva", "TVA"),
    libelleReste: mot("totaux.reste", "Reste à payer"),
    /*
     * Deux réglages, et ils ne font pas double emploi. Celui du TYPE
     * décide si l'on détaille ; celui de la MISE EN PAGE décide quelles
     * lignes du détail s'affichent — une boutique peut ne vouloir
     * montrer que sa commission, sans la part reversée.
     */
    commission:
      commission > 0 && detailleLaCommission && montre("totaux.commission", true)
        ? {
            libellePrestation: mot("totaux.prestation", "Prestation"),
            prestation: montre("totaux.prestation", true) ? total - commission : null,
            libelle: mot("totaux.commission", "Commission"),
            montant: commission,
          }
        : null,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Les colonnes du tableau
 * ───────────────────────────────────────────────────────────── */

const LIBELLES_COLONNE: Record<CleColonne, string> = {
  designation: "Désignation",
  quantite: "Quantité",
  unite: "Unité",
  prixUnitaire: "Prix unitaire",
  total: "Total",
};

const CELLULE_VIDE: Record<CleColonne, (l: LigneDocument) => boolean> = {
  designation: () => false,
  quantite: () => false,
  unite: (l) => l.unite === null,
  prixUnitaire: () => false,
  total: () => false,
};

/**
 * Les colonnes que ce document-ci porte vraiment.
 *
 * ── UNE COLONNE VIDE PARTOUT DISPARAÎT ─────────────────────────────
 *
 * Une boutique peut vouloir une colonne d'unités et ne pas remplir
 * l'unité de tous ses produits. Sur un document où aucune ligne n'en
 * porte, la colonne ne dirait rien et volerait la largeur de la
 * désignation. Elle est retirée de CE document, sans rien changer au
 * réglage : le suivant l'aura si ses lignes la remplissent.
 */
export function colonnesDuDocument(page: PageResolue, lignes: LigneDocument[]): ColonneDocument[] {
  const possibles = new Set<string>(Object.keys(LIBELLES_COLONNE));
  return page
    .ordre("tableau")
    .filter((cle) => possibles.has(cle.replace("tableau.", "")))
    .map((cle) => {
      const c = cle.replace("tableau.", "") as CleColonne;
      const libelle = page.libelle(cle, LIBELLES_COLONNE[c]);
      return { cle: c, libelle, personnalise: libelle !== LIBELLES_COLONNE[c] };
    })
    .filter((c) => lignes.length === 0 || !lignes.every((l) => CELLULE_VIDE[c.cle](l)));
}

/* ─────────────────────────────────────────────────────────────
 * Le document complet
 * ───────────────────────────────────────────────────────────── */

/**
 * CE QUI ÉTAIT ÉCRIT ICI EN DUR EST DEVENU UN RÉGLAGE.
 *
 * Le titre de chaque document, son préfixe de numérotation et son
 * texte de conditions vivaient dans trois constantes de ce fichier.
 * Ils sont maintenant dans `typesDocument.ts`, comme valeurs par
 * défaut d'un réglage que la boutique peut changer — avec exactement
 * les mêmes mots, pour que rien ne bouge tant qu'elle n'y touche pas.
 */

/**
 * Les coordonnées de paiement, quand le document a une raison de les
 * porter. Vides, elles ne laissent ni bloc ni titre derrière elles.
 */
function coordonneesDePaiement(reglages: ReglagesDocuments, montre: boolean): string[] | null {
  if (!montre) return null;
  const lignes = lignesDePaiement(reglages.identite);
  return lignes.length > 0 ? lignes : null;
}

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

  /*
   * UNE FACTURE AVEC COMMISSION EST UNE FACTURE.
   *
   * Elle ne devient un type à part que lorsque le ticket porte
   * vraiment une commission : une boutique qui n'en saisit jamais ne
   * voit pas ce type exister, et ses factures sortent comme avant. Le
   * reçu, lui, constate un paiement et ne détaille rien.
   */
  const commissionDuTicket = ventes.reduce((n, v) => n + (v.commission ?? 0), 0);
  const typeReglages: TypeDocumentV3 =
    type === "facture" && commissionDuTicket > 0 ? "commission" : type;

  const regle = resoudreType(reglages, typeReglages);
  const page = resoudreMiseEnPage(reglages, typeReglages);
  const totaux = totauxDeVente(
    ventes,
    paiements,
    boutique,
    reglages,
    type,
    page,
    typeReglages === "commission" && regle.commissionSeparee,
  );
  const numero = numeroDuDocument(premiere?.numero, regle.prefixe, dateVente);

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
  const echeanceIso = type === "facture" ? dateEcheance(dateVente, regle.echeance) : null;
  const echeance: LigneMeta | null =
    type !== "facture"
      ? null
      : echeanceIso && regle.echeance !== "a_reception"
        ? {
            libelle: page.libelle("infos.echeance", "Échéance"),
            valeur: dateCourte(echeanceIso, locale),
          }
        : {
            libelle: page.libelle("infos.echeance", "Règlement"),
            valeur: LIBELLE_ECHEANCE[regle.echeance],
          };

  const repere: Record<string, LigneMeta | null> = {
    "infos.numero": numero ? { libelle: page.libelle("infos.numero", "N°"), valeur: numero } : null,
    "infos.date": dateVente
      ? { libelle: page.libelle("infos.date", "Date"), valeur: dateCourte(dateVente, locale) }
      : null,
    "infos.echeance": echeance,
    "infos.vendeur": util(premiere?.vendeur)
      ? { libelle: page.libelle("infos.vendeur", "Vendeur"), valeur: premiere.vendeur }
      : null,
  };
  const meta: LigneMeta[] = page
    .ordre("infos")
    .map((cle) => repere[cle] ?? null)
    .filter((l): l is LigneMeta => l !== null);

  const tampon: Tampon | null = !page.visible("infos.tampon")
    ? null
    : (totaux.reste ?? 0) > 0
      ? { texte: "Reste à payer", ton: "du" }
      : { texte: "Payé", ton: "ok" };

  const enLettres = page.visible("totaux.montantEnLettres")
    ? montantEnLettres(totaux.total, deviseEnToutesLettres(devise))
    : null;
  const lignes = lignesDeVente(ventes, produits, page);

  const nomBoutique = util(boutique?.storeName);

  return {
    type: typeReglages === "commission" ? "commission" : type,
    titre: regle.titre,
    numero,
    meta,
    emetteur: enTeteBoutique(boutique, reglages, page),
    destinataire: destinataireDeVente(
      client,
      premiere?.clientCredit,
      type === "recu" ? "Reçu de" : "Facturé à",
      page,
    ),
    lignes,
    colonnes: colonnesDuDocument(page, lignes),
    totaux,
    tampon,
    montantEnLettres: enLettres,
    mentions: page.visible("bas.conditions") ? util(regle.conditions) : null,
    signatures: page.visible("bas.signature")
      ? {
          gauche: "Signature du client",
          droite: nomBoutique ? `Pour ${nomBoutique} · cachet et signature` : "Cachet et signature",
        }
      : null,
    motDeFin: page.visible("bas.motDeFin") ? util(regle.motDeFin) : null,
    // Un reçu constate un paiement reçu : il n'indique pas où payer.
    coordonneesPaiement: coordonneesDePaiement(
      reglages,
      type !== "recu" && page.visible("bas.paiement"),
    ),
    // Un pied vide reprend l'identité de la boutique : c'est ce qu'on
    // veut y lire, et le régler soi-même reste possible.
    piedDePage: !page.visible("bas.piedDePage")
      ? null
      : (util(regle.piedDePage) ?? joindre(nomBoutique, boutique?.address, boutique?.phone)),
    paginer: page.visible("bas.pagination"),
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

/* ═══════════════════════════════════════════════════════════════════
   LE DEVIS ET LE BON DE COMMANDE CLIENT

   Les mêmes règles que la vente, et les mêmes fonctions de mise en
   forme. Ce qui change tient en trois choses : le titre, ce que la
   ligne de date annonce, et ce que le document réclame — un devis ne
   réclame rien, une commande réclame un solde.
   ═══════════════════════════════════════════════════════════════════ */

type Devis = Database["public"]["Tables"]["quotes"]["Row"];
type LigneDevis = Database["public"]["Tables"]["quote_items"]["Row"];
type Commande = Database["public"]["Tables"]["orders"]["Row"];
type LigneCommande = Database["public"]["Tables"]["order_items"]["Row"];

const MENTIONS_DEVIS =
  "Offre valable jusqu'à la date indiquée. La commande est ferme dès acceptation écrite " +
  "et versement de l'acompte convenu.";

const MENTIONS_COMMANDE =
  "Commande ferme dès signature. Livraison sous réserve de disponibilité. Le solde est " +
  "réglé au plus tard à la livraison.";

export interface SourceDevis {
  devis: Devis;
  lignes: LigneDevis[];
  /** La fiche client, quand le devis y est rattaché. */
  client?: Client | null;
  boutique?: StoreSettings;
  reglages: ReglagesDocuments;
  locale?: LocaleSetting;
}

/**
 * Un devis, mis en forme pour le papier.
 *
 * ── IL NE PARLE PAS D'ARGENT DÉJÀ VERSÉ ────────────────────────────
 *
 * `paye` et `reste` sont à `null`, et ce n'est pas un oubli : un
 * devis est une proposition, pas une créance. Afficher « déjà payé :
 * 0 » sur une offre laisserait croire qu'elle est due.
 */
export function documentDeDevis(source: SourceDevis): Document {
  const { devis, lignes, client, boutique, reglages } = source;
  const locale = source.locale ?? "FR";
  const devise = util(boutique?.currencySymbol) ?? "Ar";

  // Le total vient de la base ; à défaut, la somme des lignes déjà
  // enregistrées — le même calcul que l'écran Devis.
  const total =
    devis.total ?? lignes.reduce((n, l) => n + (l.total ?? l.quantite * l.prix_unitaire), 0);

  /*
   * Une proforma EST un devis : mêmes lignes, même écran, même
   * conversion en vente. Seuls son titre, son préfixe, ses conditions
   * et sa mise en page diffèrent — c'est-à-dire exactement ce que les
   * niveaux 2 et 3 savent faire. Rien d'autre à changer ici.
   */
  const type: TypeDocumentV3 = devis.type === "proforma" ? "proforma" : "devis";
  const regle = resoudreType(reglages, type);
  const page = resoudreMiseEnPage(reglages, type);
  const numero = numeroDuDocument(devis.numero, regle.prefixe, devis.date);
  const nomBoutique = util(boutique?.storeName);

  const repere: Record<string, LigneMeta | null> = {
    "infos.numero": numero ? { libelle: page.libelle("infos.numero", "N°"), valeur: numero } : null,
    "infos.date": devis.date
      ? { libelle: page.libelle("infos.date", "Date"), valeur: dateCourte(devis.date, locale) }
      : null,
    "infos.validite": devis.valide_jusqu_au
      ? {
          libelle: page.libelle("infos.validite", "Valable jusqu'au"),
          valeur: dateCourte(devis.valide_jusqu_au, locale),
        }
      : null,
  };
  const meta: LigneMeta[] = page
    .ordre("infos")
    .map((cle) => repere[cle] ?? null)
    .filter((l): l is LigneMeta => l !== null);

  const lignesDevis: LigneDocument[] = lignes.map((l) => ({
    id: l.id,
    designation: util(l.designation) ?? "Article",
    detail: null,
    quantite: l.quantite,
    unite: null,
    prixUnitaire: l.prix_unitaire,
    total: l.total ?? l.quantite * l.prix_unitaire,
  }));

  return {
    type,
    titre: regle.titre,
    numero,
    meta,
    emetteur: enTeteBoutique(boutique, reglages, page),
    destinataire: destinataireDeVente(
      client,
      devis.client_nom,
      type === "proforma" ? "Facturé à" : "Devis pour",
      page,
    ),
    lignes: lignesDevis,
    colonnes: colonnesDuDocument(page, lignesDevis),
    totaux: {
      horsTaxe: null,
      tva: null,
      total,
      paye: null,
      reste: null,
      modePaiement: null,
      /*
       * « Montant proposé » dit bien ce qu'est un devis. Une proforma,
       * elle, annonce un prix ferme : on la présente à une banque ou à
       * une douane, et « proposé » y affaiblirait le document.
       */
      libelleTotal: page.libelle("totaux.total", type === "proforma" ? "Total" : "Montant proposé"),
      libellePaye: "",
      libelleHorsTaxe: page.libelle("totaux.horsTaxe", "Total hors taxe"),
      libelleTva: page.libelle("totaux.tva", "TVA"),
      libelleReste: page.libelle("totaux.reste", "Reste à payer"),
      // Un devis, un bon de commande et une facture reçue ne portent
      // pas de commission : rien à détailler.
      commission: null,
    },
    // Pas de tampon : il n'y a rien à constater sur une proposition.
    tampon: null,
    montantEnLettres: page.visible("totaux.montantEnLettres")
      ? montantEnLettres(total, deviseEnToutesLettres(devise))
      : null,
    mentions: page.visible("bas.conditions") ? util(regle.conditions) : null,
    signatures: page.visible("bas.signature")
      ? {
          gauche: "Bon pour accord · signature du client",
          droite: nomBoutique ? `Pour ${nomBoutique}` : "Cachet et signature",
        }
      : null,
    motDeFin: page.visible("bas.motDeFin") ? util(regle.motDeFin) : null,
    coordonneesPaiement: coordonneesDePaiement(reglages, page.visible("bas.paiement")),
    piedDePage: !page.visible("bas.piedDePage")
      ? null
      : (util(regle.piedDePage) ?? joindre(nomBoutique, boutique?.address, boutique?.phone)),
    paginer: page.visible("bas.pagination"),
    devise,
    heure: null,
    messageTicket: null,
    codeBarres: util(devis.numero),
    nomDeFichier: nomDeFichier(
      type === "proforma" ? "Proforma" : "Devis",
      numero || (devis.numero ?? "document"),
    ),
  };
}

export interface SourceCommande {
  commande: Commande;
  lignes: LigneCommande[];
  client?: Client | null;
  boutique?: StoreSettings;
  reglages: ReglagesDocuments;
  locale?: LocaleSetting;
}

/**
 * Un bon de commande client, mis en forme pour le papier.
 *
 * ── LES MONTANTS SORTENT DE LA BASE, TOUS LES TROIS ────────────────
 *
 * `montant_total`, `montant_paye` et `reste_a_payer` sont lus tels
 * quels. On ne recalcule pas le reste par soustraction : la base tient
 * ces trois nombres à jour ensemble, et un document qui referait le
 * calcul finirait un jour par contredire l'écran Commandes.
 */
export function documentDeCommande(source: SourceCommande): Document {
  const { commande, lignes, client, boutique, reglages } = source;
  const locale = source.locale ?? "FR";
  const devise = util(boutique?.currencySymbol) ?? "Ar";

  const total = commande.montant_total ?? 0;
  const paye = commande.montant_paye ?? 0;
  const reste = commande.reste_a_payer ?? 0;

  const regle = resoudreType(reglages, "commande");
  const page = resoudreMiseEnPage(reglages, "commande");
  const numero = numeroDuDocument(commande.numero, regle.prefixe, commande.created_at);
  const nomBoutique = util(boutique?.storeName);

  const repere: Record<string, LigneMeta | null> = {
    "infos.numero": numero ? { libelle: page.libelle("infos.numero", "N°"), valeur: numero } : null,
    "infos.date": commande.created_at
      ? {
          libelle: page.libelle("infos.date", "Date"),
          valeur: dateCourte(commande.created_at.slice(0, 10), locale),
        }
      : null,
    "infos.livraison": commande.date_livraison
      ? {
          libelle: page.libelle("infos.livraison", "Livraison prévue"),
          valeur: dateCourte(commande.date_livraison, locale),
        }
      : null,
  };
  const meta: LigneMeta[] = page
    .ordre("infos")
    .map((cle) => repere[cle] ?? null)
    .filter((l): l is LigneMeta => l !== null);

  const lignesCommande: LigneDocument[] = lignes.map((l) => ({
    id: l.id,
    designation: util(l.designation) ?? "Article",
    detail: null,
    quantite: l.quantite,
    unite: null,
    prixUnitaire: l.prix_vente_unit,
    total: l.total_vente,
  }));

  return {
    type: "commande",
    titre: regle.titre,
    numero,
    meta,
    emetteur: enTeteBoutique(boutique, reglages, page),
    destinataire: destinataireDeVente(client, null, "Commande de", page),
    lignes: lignesCommande,
    colonnes: colonnesDuDocument(page, lignesCommande),
    totaux: {
      horsTaxe: null,
      tva: null,
      total,
      paye: page.visible("totaux.paye") ? paye : null,
      reste: page.visible("totaux.reste") ? reste : null,
      modePaiement: null,
      libelleTotal: page.libelle(
        "totaux.total",
        reste > 0 ? "Total de la commande" : "Total réglé",
      ),
      // Sur une commande, ce qui est versé est un ACOMPTE : le mot
      // dit qu'il reste quelque chose, là où « déjà payé » laisse
      // penser que l'affaire est close.
      libellePaye: page.libelle("totaux.paye", "Acompte versé"),
      libelleHorsTaxe: page.libelle("totaux.horsTaxe", "Total hors taxe"),
      libelleTva: page.libelle("totaux.tva", "TVA"),
      libelleReste: page.libelle("totaux.reste", "Reste à payer"),
      // Un devis, un bon de commande et une facture reçue ne portent
      // pas de commission : rien à détailler.
      commission: null,
    },
    tampon: !page.visible("infos.tampon")
      ? null
      : reste > 0
        ? { texte: "Acompte versé", ton: "du" }
        : { texte: "Payé", ton: "ok" },
    montantEnLettres: page.visible("totaux.montantEnLettres")
      ? montantEnLettres(total, deviseEnToutesLettres(devise))
      : null,
    mentions: page.visible("bas.conditions") ? util(regle.conditions) : null,
    signatures: page.visible("bas.signature")
      ? {
          gauche: "Bon pour accord · signature du client",
          droite: nomBoutique ? `Pour ${nomBoutique}` : "Cachet et signature",
        }
      : null,
    motDeFin: page.visible("bas.motDeFin") ? util(regle.motDeFin) : null,
    coordonneesPaiement: coordonneesDePaiement(reglages, page.visible("bas.paiement")),
    piedDePage: !page.visible("bas.piedDePage")
      ? null
      : (util(regle.piedDePage) ?? joindre(nomBoutique, boutique?.address, boutique?.phone)),
    paginer: page.visible("bas.pagination"),
    devise,
    heure: null,
    messageTicket: null,
    codeBarres: util(commande.numero),
    nomDeFichier: nomDeFichier("Commande", numero || (commande.numero ?? "document")),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   LA FACTURE D'ACHAT FOURNISSEUR

   ── CE QUE CE PAPIER EST, ET CE QU'IL N'EST PAS ────────────────────

   Ce n'est pas la facture du fournisseur : c'est NOTRE relevé de
   celle qu'on a reçue. La distinction n'est pas un détail de forme.
   Imprimer un document à l'en-tête d'un tiers, avec son identité et
   son numéro, reviendrait à fabriquer une pièce en son nom ; le
   logiciel n'a pas à faire cela, même pour rendre service.

   L'en-tête reste donc celui de la boutique — c'est elle qui tient le
   registre —, le fournisseur occupe le bloc d'en face, et le numéro
   que portait le papier reçu est affiché comme tel, à côté du nôtre.
   Ce qu'on imprime est une fiche de classement, et elle le dit.

   ── ELLE NE TOUCHE À RIEN ──────────────────────────────────────────

   Ni trésorerie, ni stock, ni achats. Une ligne d'achat est un
   mouvement ; une facture reçue est une pièce. Voir la migration
   `documents_v3_facture_achat_tables`.
   ═══════════════════════════════════════════════════════════════════ */

type FactureAchat = Database["public"]["Tables"]["supplier_invoices"]["Row"];
type LigneFactureAchat = Database["public"]["Tables"]["supplier_invoice_items"]["Row"];
type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];

export interface SourceFactureAchat {
  facture: FactureAchat;
  lignes: LigneFactureAchat[];
  /** La fiche du fournisseur, quand la facture y est rattachée. */
  fournisseur?: Fournisseur | null;
  boutique?: StoreSettings;
  reglages: ReglagesDocuments;
  locale?: LocaleSetting;
}

/** Le fournisseur, réduit à ce qui est renseigné sur sa fiche. */
function blocFournisseur(
  fournisseur: Fournisseur | null | undefined,
  nomLibre: string,
  page: PageResolue,
): BlocTiers {
  const intitule = page.visible("tiers.titre") ? page.libelle("tiers.titre", "Fournisseur") : "";
  const nom = util(fournisseur?.entreprise) ?? util(fournisseur?.nom) ?? util(nomLibre) ?? "";
  const lignes: Record<string, string | null> = {
    "tiers.contact": fournisseur?.entreprise ? util(fournisseur.nom) : null,
    "tiers.adresse": util(fournisseur?.adresse),
    "tiers.ville": util(fournisseur?.ville),
    "tiers.telephone": util(fournisseur?.telephone),
  };
  return {
    titre: intitule,
    nom: page.visible("tiers.nom") ? nom : "",
    lignes: page
      .ordre("tiers")
      .map((cle) => lignes[cle] ?? null)
      .filter((l): l is string => l !== null),
    nif: util(fournisseur?.numero_fiscal),
  };
}

export function documentDeFactureAchat(source: SourceFactureAchat): Document {
  const { facture, lignes, fournisseur, boutique, reglages } = source;
  const locale = source.locale ?? "FR";
  const devise = util(boutique?.currencySymbol) ?? "Ar";

  const regle = resoudreType(reglages, "facture_achat");
  const page = resoudreMiseEnPage(reglages, "facture_achat");
  const numero = numeroDuDocument(facture.numero, regle.prefixe, facture.date);
  const nomBoutique = util(boutique?.storeName);

  // Les trois montants viennent de la base, tels qu'ils y sont
  // écrits : le total est celui du papier reçu, pas une addition.
  const total = facture.total ?? 0;
  const paye = facture.montant_paye ?? 0;
  const reste = Math.max(0, total - paye);

  const repere: Record<string, LigneMeta | null> = {
    "infos.numero": numero ? { libelle: page.libelle("infos.numero", "N°"), valeur: numero } : null,
    "infos.numeroFournisseur": util(facture.numero_fournisseur)
      ? {
          libelle: page.libelle("infos.numeroFournisseur", "N° fournisseur"),
          valeur: facture.numero_fournisseur as string,
        }
      : null,
    "infos.date": facture.date
      ? { libelle: page.libelle("infos.date", "Date"), valeur: dateCourte(facture.date, locale) }
      : null,
    "infos.echeance": facture.date_echeance
      ? {
          libelle: page.libelle("infos.echeance", "Échéance"),
          valeur: dateCourte(facture.date_echeance, locale),
        }
      : null,
  };

  const lignesDoc: LigneDocument[] = lignes.map((l) => ({
    id: l.id,
    designation: util(l.designation) ?? "Article",
    detail: null,
    quantite: l.quantite,
    unite: util(l.unite),
    prixUnitaire: l.prix_unitaire,
    total: l.total ?? l.quantite * l.prix_unitaire,
  }));

  return {
    type: "facture_achat",
    titre: regle.titre,
    numero,
    meta: page
      .ordre("infos")
      .map((cle) => repere[cle] ?? null)
      .filter((l): l is LigneMeta => l !== null),
    emetteur: enTeteBoutique(boutique, reglages, page),
    destinataire: blocFournisseur(fournisseur, facture.fournisseur, page),
    lignes: lignesDoc,
    colonnes: colonnesDuDocument(page, lignesDoc),
    totaux: {
      horsTaxe: null,
      tva: null,
      total,
      paye: page.visible("totaux.paye") ? paye : null,
      reste: page.visible("totaux.reste") ? reste : null,
      modePaiement: null,
      libelleTotal: page.libelle("totaux.total", "Total de la facture"),
      libellePaye: page.libelle("totaux.paye", "Déjà réglé"),
      libelleHorsTaxe: page.libelle("totaux.horsTaxe", "Total hors taxe"),
      libelleTva: page.libelle("totaux.tva", "TVA"),
      libelleReste: page.libelle("totaux.reste", "Reste à régler"),
      commission: null,
    },
    tampon: !page.visible("infos.tampon")
      ? null
      : reste > 0
        ? { texte: "Reste à régler", ton: "du" }
        : { texte: "Réglée", ton: "ok" },
    montantEnLettres: page.visible("totaux.montantEnLettres")
      ? montantEnLettres(total, deviseEnToutesLettres(devise))
      : null,
    mentions: page.visible("bas.conditions") ? util(regle.conditions) : null,
    // Pas de place pour signer : personne ne signe le relevé qu'il
    // fait de la facture d'un autre.
    signatures: null,
    motDeFin: page.visible("bas.motDeFin") ? util(regle.motDeFin) : null,
    // On n'indique pas où NOUS payer sur une facture que nous devons.
    coordonneesPaiement: null,
    piedDePage: !page.visible("bas.piedDePage")
      ? null
      : (util(regle.piedDePage) ?? joindre(nomBoutique, boutique?.address, boutique?.phone)),
    paginer: page.visible("bas.pagination"),
    devise,
    heure: null,
    messageTicket: null,
    codeBarres: util(facture.numero),
    nomDeFichier: nomDeFichier("Facture_achat", numero || (facture.numero ?? "document")),
  };
}

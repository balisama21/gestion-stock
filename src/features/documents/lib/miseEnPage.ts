import type { OptionsDocuments } from "./reglages";
import type { TypeDocumentV3 } from "./typesDocument";

/**
 * NIVEAU 3 — CE QUI S'AFFICHE, SOUS QUEL NOM, DANS QUEL ORDRE
 *
 * Le document est découpé en zones, chaque zone en éléments. Pour
 * chaque élément, trois réglages : afficher ou masquer, un libellé
 * propre, et un rang dans sa zone.
 *
 * ── LE CATALOGUE NE CONTIENT QUE CE QUI PEUT S'AFFICHER ────────────
 *
 * C'est la règle la plus importante de ce fichier, et elle écarte une
 * partie de ce que le cahier des charges énumère. Une remise par
 * ligne, une TVA par ligne, une miniature de produit, un objet, une
 * référence client, un lieu de livraison : aucune de ces données
 * n'existe en base aujourd'hui. Un interrupteur qui ne montrerait
 * jamais rien est pire que pas d'interrupteur — il fait croire que la
 * fonction existe, et on la cherche. Ces éléments entreront au
 * catalogue le jour où la donnée entrera dans la base ; le format de
 * ce fichier les accueillera sans migration, puisqu'une clé absente
 * veut dire « comme prévu ».
 *
 * ── CE QUI EST VERROUILLÉ ──────────────────────────────────────────
 *
 * Sur une facture, le numéro, la date, l'identité de l'émetteur et le
 * total ne se masquent pas : c'est ce qui en fait une facture. La
 * désignation d'une ligne et le total ne se masquent nulle part — une
 * ligne sans nom et un document sans total ne sont plus des documents.
 *
 * ── UN ÉLÉMENT MASQUÉ NE LAISSE RIEN ───────────────────────────────
 *
 * Pas de ligne vide, pas d'intitulé orphelin, pas de colonne vide.
 * C'est déjà la règle des modèles — ils n'affichent pas ce qui vaut
 * `null` — et la mise en page s'y branche en mettant à `null`, non en
 * ajoutant des cas particuliers.
 */

export type Zone = "entete" | "infos" | "tiers" | "tableau" | "totaux" | "bas";

export const ZONES: { cle: Zone; nom: string; note: string }[] = [
  { cle: "entete", nom: "En-tête", note: "Votre identité, en haut du document." },
  { cle: "infos", nom: "Informations du document", note: "Numéro, date, échéance, vendeur." },
  { cle: "tiers", nom: "Client", note: "À qui le document s'adresse." },
  { cle: "tableau", nom: "Tableau des lignes", note: "Les colonnes et leur contenu." },
  { cle: "totaux", nom: "Totaux", note: "Ce qui est dû, et ce qui a été réglé." },
  { cle: "bas", nom: "Bas du document", note: "Conditions, signature, pied de page." },
];

export interface ElementCatalogue {
  cle: string;
  zone: Zone;
  /** Son nom dans l'éditeur. */
  nom: string;
  /** Le mot imprimé sur le document, quand il en porte un. */
  libelleParDefaut?: string;
  note?: string;
  /** Visible par défaut, ou « comme le dit cette option de boutique ». */
  defaut: boolean | keyof OptionsDocuments;
  /** Impossible à masquer : partout, ou sur ces types-là. */
  verrouille?: "tous" | TypeDocumentV3[];
  /** Ce type de document n'a pas cet élément du tout. */
  absentDe?: TypeDocumentV3[];
}

export const CATALOGUE: ElementCatalogue[] = [
  /* ── En-tête ──────────────────────────────────────────────────── */
  { cle: "entete.logo", zone: "entete", nom: "Logo ou initiales", defaut: true },
  {
    cle: "entete.nom",
    zone: "entete",
    nom: "Nom de la boutique",
    defaut: true,
    verrouille: ["facture"],
  },
  { cle: "entete.activite", zone: "entete", nom: "Activité (sous-titre)", defaut: true },
  { cle: "entete.adresse", zone: "entete", nom: "Adresse", defaut: true },
  {
    cle: "entete.telEmail",
    zone: "entete",
    nom: "Téléphone et e-mail",
    note: "Ils partagent une ligne, comme aujourd'hui.",
    defaut: true,
  },
  { cle: "entete.contacts", zone: "entete", nom: "Contacts", defaut: true },
  { cle: "entete.enLigne", zone: "entete", nom: "Site web et réseaux", defaut: true },
  { cle: "entete.identifiants", zone: "entete", nom: "Autres identifiants", defaut: true },
  { cle: "entete.nifStat", zone: "entete", nom: "NIF et STAT", defaut: "nif" },

  /* ── Informations du document ─────────────────────────────────── */
  {
    cle: "infos.numero",
    zone: "infos",
    nom: "Numéro",
    libelleParDefaut: "N°",
    defaut: true,
    verrouille: ["facture"],
  },
  {
    cle: "infos.date",
    zone: "infos",
    nom: "Date",
    libelleParDefaut: "Date",
    defaut: true,
    verrouille: ["facture"],
  },
  {
    cle: "infos.echeance",
    zone: "infos",
    nom: "Échéance",
    libelleParDefaut: "Échéance",
    note: "Le libellé devient « Règlement » quand il n'y a pas de date à annoncer.",
    defaut: true,
    absentDe: ["recu", "devis", "commande", "achat", "ticket"],
  },
  {
    cle: "infos.validite",
    zone: "infos",
    nom: "Valable jusqu'au",
    libelleParDefaut: "Valable jusqu'au",
    defaut: true,
    absentDe: ["facture", "recu", "commande", "achat"],
  },
  {
    cle: "infos.livraison",
    zone: "infos",
    nom: "Livraison prévue",
    libelleParDefaut: "Livraison prévue",
    defaut: true,
    absentDe: ["facture", "recu", "devis", "achat"],
  },
  {
    cle: "infos.numeroFournisseur",
    zone: "infos",
    nom: "Numéro du fournisseur",
    libelleParDefaut: "N° fournisseur",
    note: "Le numéro que porte le papier reçu. C'est celui qu'on cherche quand le fournisseur appelle.",
    defaut: true,
    absentDe: ["facture", "proforma", "devis", "recu", "commande", "achat", "commission", "ticket"],
  },
  {
    cle: "infos.vendeur",
    zone: "infos",
    nom: "Vendeur",
    libelleParDefaut: "Vendeur",
    defaut: true,
    absentDe: ["devis", "commande", "achat", "facture_achat"],
  },
  {
    cle: "infos.tampon",
    zone: "infos",
    nom: "Tampon « Payé »",
    defaut: "tamponPaiement",
    absentDe: ["devis"],
  },

  /* ── Client ───────────────────────────────────────────────────── */
  {
    cle: "tiers.titre",
    zone: "tiers",
    nom: "Intitulé du bloc",
    libelleParDefaut: "",
    defaut: true,
  },
  { cle: "tiers.nom", zone: "tiers", nom: "Nom ou entreprise", defaut: true },
  {
    cle: "tiers.contact",
    zone: "tiers",
    nom: "Personne à contacter",
    note: "Le nom de la personne, quand le document est adressé à une entreprise.",
    defaut: true,
  },
  { cle: "tiers.adresse", zone: "tiers", nom: "Adresse", defaut: true },
  { cle: "tiers.ville", zone: "tiers", nom: "Ville", defaut: true },
  { cle: "tiers.telephone", zone: "tiers", nom: "Téléphone", defaut: true },

  /* ── Tableau ──────────────────────────────────────────────────── */
  {
    cle: "tableau.designation",
    zone: "tableau",
    nom: "Désignation",
    libelleParDefaut: "Désignation",
    defaut: true,
    verrouille: "tous",
  },
  {
    cle: "tableau.reference",
    zone: "tableau",
    nom: "Référence du produit",
    note: "« réf. P024 », sous la désignation. Elle disparaît d'elle-même sur une ligne qui n'en a pas.",
    defaut: true,
  },
  {
    cle: "tableau.quantite",
    zone: "tableau",
    nom: "Quantité",
    libelleParDefaut: "Quantité",
    defaut: true,
  },
  {
    cle: "tableau.unite",
    zone: "tableau",
    nom: "Unité, en colonne à part",
    note: "Sans elle, l'unité reste collée à la quantité — « 3 pièces ». Avec elle, la case ne porte que l'unité réellement saisie : un produit qui n'en a pas laisse sa case vide, et la colonne disparaît du document si aucune ligne n'en porte.",
    defaut: false,
  },
  {
    cle: "tableau.prixUnitaire",
    zone: "tableau",
    nom: "Prix unitaire",
    libelleParDefaut: "Prix unitaire",
    defaut: true,
  },
  {
    cle: "tableau.total",
    zone: "tableau",
    nom: "Total de la ligne",
    libelleParDefaut: "Total",
    defaut: true,
  },

  /* ── Totaux ───────────────────────────────────────────────────── */
  {
    cle: "totaux.horsTaxe",
    zone: "totaux",
    nom: "Total hors taxe",
    libelleParDefaut: "Total hors taxe",
    defaut: "tva",
  },
  { cle: "totaux.tva", zone: "totaux", nom: "TVA", defaut: "tva" },
  {
    cle: "totaux.prestation",
    zone: "totaux",
    nom: "Part de la prestation",
    libelleParDefaut: "Prestation",
    note: "Le total moins la commission. Il ne s'affiche que si la boutique a choisi de détailler la commission, dans les réglages de ce document.",
    defaut: true,
    absentDe: [
      "facture",
      "proforma",
      "devis",
      "recu",
      "commande",
      "achat",
      "facture_achat",
      "ticket",
    ],
  },
  {
    cle: "totaux.commission",
    zone: "totaux",
    nom: "Commission de la boutique",
    libelleParDefaut: "Commission",
    note: "La part que vous gardez. Elle est comprise dans le total : la détailler ne le change pas.",
    defaut: true,
    absentDe: [
      "facture",
      "proforma",
      "devis",
      "recu",
      "commande",
      "achat",
      "facture_achat",
      "ticket",
    ],
  },
  {
    cle: "totaux.total",
    zone: "totaux",
    nom: "Total",
    defaut: true,
    verrouille: "tous",
    note: "Un document sans total n'est pas un document.",
  },
  {
    cle: "totaux.montantEnLettres",
    zone: "totaux",
    nom: "Montant en lettres",
    defaut: "montantEnLettres",
  },
  { cle: "totaux.paye", zone: "totaux", nom: "Déjà payé", defaut: true },
  {
    cle: "totaux.reste",
    zone: "totaux",
    nom: "Reste à payer",
    libelleParDefaut: "Reste à payer",
    defaut: true,
  },

  /* ── Bas du document ──────────────────────────────────────────── */
  { cle: "bas.conditions", zone: "bas", nom: "Conditions", defaut: "conditions" },
  { cle: "bas.paiement", zone: "bas", nom: "Coordonnées de paiement", defaut: true },
  { cle: "bas.signature", zone: "bas", nom: "Cachet et signature", defaut: "signature" },
  { cle: "bas.motDeFin", zone: "bas", nom: "Mot de fin", defaut: true },
  { cle: "bas.piedDePage", zone: "bas", nom: "Pied de page", defaut: true },
  {
    cle: "bas.pagination",
    zone: "bas",
    nom: "Numérotation des pages",
    note: "« Page 1 / 2 », sur les documents qui tiennent sur plusieurs feuilles.",
    defaut: true,
  },
];

const PAR_CLE = new Map(CATALOGUE.map((e) => [e.cle, e]));

/** Les éléments d'une zone qui existent pour ce type de document. */
export function elementsDe(zone: Zone, type: TypeDocumentV3): ElementCatalogue[] {
  return CATALOGUE.filter((e) => e.zone === zone && !(e.absentDe ?? []).includes(type));
}

export function estVerrouille(element: ElementCatalogue, type: TypeDocumentV3): boolean {
  if (element.verrouille === "tous") return true;
  return (element.verrouille ?? []).includes(type);
}

/* ─────────────────────────────────────────────────────────────
 * Ce que la boutique a changé
 * ───────────────────────────────────────────────────────────── */

export interface ReglageElement {
  visible?: boolean;
  /** Le mot imprimé, quand la boutique en veut un autre. */
  libelle?: string;
  /** Le rang dans la zone. Absent, c'est celui du catalogue. */
  ordre?: number;
}

/** Par clé d'élément. Une clé absente n'a pas été touchée. */
export type MiseEnPage = Record<string, ReglageElement>;

/** Par type de document. Un type absent n'a pas été personnalisé. */
export type MisesEnPage = Partial<Record<TypeDocumentV3, MiseEnPage>>;

export function lireMiseEnPage(brut: unknown): MiseEnPage {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const r = brut as Record<string, unknown>;
  const sortie: MiseEnPage = {};
  for (const [cle, valeur] of Object.entries(r)) {
    if (!PAR_CLE.has(cle)) continue;
    if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) continue;
    const v = valeur as Record<string, unknown>;
    const element: ReglageElement = {};
    if (typeof v.visible === "boolean") element.visible = v.visible;
    if (typeof v.libelle === "string") element.libelle = v.libelle;
    if (typeof v.ordre === "number" && Number.isFinite(v.ordre))
      element.ordre = Math.round(v.ordre);
    if (Object.keys(element).length > 0) sortie[cle] = element;
  }
  return sortie;
}

export function lireMisesEnPage(brut: unknown, types: readonly TypeDocumentV3[]): MisesEnPage {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const r = brut as Record<string, unknown>;
  const sortie: MisesEnPage = {};
  for (const type of types) {
    if (!(type in r)) continue;
    sortie[type] = lireMiseEnPage(r[type]);
  }
  return sortie;
}

/* ─────────────────────────────────────────────────────────────
 * Les préréglages
 * ───────────────────────────────────────────────────────────── */

export type Prereglage = "defaut" | "minimal" | "complet";

/**
 * « Minimal » ne garde que ce qu'il faut pour que la pièce vaille :
 * qui émet, pour qui, quoi, combien. « Complet » allume tout ce que la
 * boutique a renseigné. « Par défaut » est l'état d'origine — aucune
 * clé, donc rien d'écrit.
 */
const MINIMAL_MASQUE = new Set([
  "entete.activite",
  "entete.contacts",
  "entete.enLigne",
  "entete.identifiants",
  "infos.vendeur",
  "infos.tampon",
  "tableau.reference",
  "totaux.montantEnLettres",
  "bas.conditions",
  "bas.paiement",
  "bas.signature",
  "bas.motDeFin",
]);

export function prereglage(nom: Prereglage, type: TypeDocumentV3): MiseEnPage {
  if (nom === "defaut") return {};
  const page: MiseEnPage = {};
  for (const element of CATALOGUE) {
    if ((element.absentDe ?? []).includes(type)) continue;
    if (estVerrouille(element, type)) continue;
    if (nom === "minimal") {
      if (MINIMAL_MASQUE.has(element.cle)) page[element.cle] = { visible: false };
    } else if (element.cle !== "tableau.unite") {
      // L'unité en colonne à part n'est pas « plus complet » : c'est une
      // autre façon de présenter la même donnée, déjà collée à la
      // quantité. L'allumer d'office créerait un doublon.
      page[element.cle] = { visible: true };
    }
  }
  return page;
}

/* ─────────────────────────────────────────────────────────────
 * La résolution
 * ───────────────────────────────────────────────────────────── */

export interface ElementResolu {
  cle: string;
  zone: Zone;
  nom: string;
  visible: boolean;
  /** Le mot à montrer dans l'éditeur : celui choisi, ou celui prévu. */
  libelle: string;
  /**
   * Le mot que la BOUTIQUE a choisi, et rien d'autre.
   *
   * La distinction n'est pas une subtilité : l'échéance s'intitule
   * « Échéance » quand une date est annoncée et « Règlement » quand
   * il n'y en a pas. Le document passe donc son propre défaut, qui
   * dépend du cas, et seul un mot vraiment choisi doit l'écraser.
   */
  libelleChoisi?: string;
  verrouille: boolean;
  note?: string;
  /** La boutique a-t-elle changé quelque chose sur cet élément ? */
  touche: boolean;
}

/**
 * Ce qu'un document affiche, une fois tous les niveaux empilés.
 *
 * L'ordre des éléments d'une zone est celui du catalogue, sauf pour
 * ceux à qui la boutique a donné un rang. Le tri est STABLE : deux
 * éléments de même rang restent dans l'ordre du catalogue, et non
 * dans celui, imprévisible, où le moteur les aurait croisés.
 */
export function resoudrePage(
  page: MiseEnPage,
  options: OptionsDocuments,
  type: TypeDocumentV3,
): ElementResolu[] {
  const resolus = CATALOGUE.filter((e) => !(e.absentDe ?? []).includes(type)).map((e, rang) => {
    const reglage = page[e.cle];
    const verrouille = estVerrouille(e, type);
    const defaut = typeof e.defaut === "boolean" ? e.defaut : options[e.defaut];
    return {
      element: e,
      rang: reglage?.ordre ?? rang,
      catalogue: rang,
      resolu: {
        cle: e.cle,
        zone: e.zone,
        nom: e.nom,
        visible: verrouille ? true : (reglage?.visible ?? defaut),
        libelle: reglage?.libelle ?? e.libelleParDefaut ?? "",
        libelleChoisi: reglage?.libelle,
        verrouille,
        note: e.note,
        touche: reglage !== undefined,
      } satisfies ElementResolu,
    };
  });

  return resolus.sort((a, b) => a.rang - b.rang || a.catalogue - b.catalogue).map((x) => x.resolu);
}

/** L'objet que `buildDocument` interroge. Il ne décide de rien d'autre. */
export interface PageResolue {
  visible(cle: string): boolean;
  libelle(cle: string, defaut: string): string;
  /** Les clés visibles d'une zone, dans l'ordre choisi. */
  ordre(zone: Zone): string[];
  elements: ElementResolu[];
}

export function pageResolue(elements: ElementResolu[]): PageResolue {
  const parCle = new Map(elements.map((e) => [e.cle, e]));
  return {
    elements,
    visible: (cle) => parCle.get(cle)?.visible ?? true,
    libelle: (cle, defaut) => parCle.get(cle)?.libelleChoisi || defaut,
    ordre: (zone) => elements.filter((e) => e.zone === zone && e.visible).map((e) => e.cle),
  };
}

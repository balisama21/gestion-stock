/**
 * L'UNITÉ D'UN PRODUIT, DITE SIMPLEMENT
 *
 * On demande une seule chose : « comment le comptez-vous ? » — à la
 * pièce, au kg, au litre, au paquet, au carton…
 *
 *   - Une pièce, un kg, un litre se vendent seuls : rien de plus à dire.
 *   - Un paquet, un carton, un sac CONTIENNENT quelque chose. On demande
 *     alors combien (« 12 pièces »), et le produit se range ainsi :
 *     le stock se compte en pièces, et le paquet devient son
 *     conditionnement (`products.conditionnements`, voir
 *     `conditionnements.ts`). Laissé vide, le paquet se vend entier et
 *     redevient une unité comme une autre.
 *
 * Les prix suivent la même idée : le prix d'achat se saisit pour ce
 * qu'on a choisi (le paquet), et le prix de vente au niveau que l'on
 * préfère — du paquet OU de la pièce. Un seul nombre est retenu, la
 * RÉFÉRENCE ; l'autre en est toujours déduit, jamais stocké à côté. Il
 * n'y a donc pas deux champs qui se recalculent l'un l'autre, et pas de
 * boucle possible.
 */

import {
  libelleUnite,
  nouvelIdentifiant,
  erreurConditionnements,
  type Conditionnement,
} from "./conditionnements";

/** Ce qui contient d'autres unités : le formulaire demande combien. */
export const CONTENANTS = [
  "paquet",
  "carton",
  "sac",
  "boîte",
  "pack",
  "lot",
  "douzaine",
  "caisse",
  "bidon",
  "fardeau",
  "plateau",
  "cageot",
  "palette",
];

/** Ceux dont le contenu va de soi. Proposé, jamais imposé. */
const CONTENU_HABITUEL: Record<string, number> = { douzaine: 12, plateau: 30 };

/** Les noms féminins : « une boîte », « la pièce ». */
const FEMININS = new Set([
  "boite",
  "douzaine",
  "caisse",
  "palette",
  "piece",
  "bouteille",
  "paire",
  "unite",
  "tonne",
  "barre",
  "plaquette",
]);

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Le premier mot compte : « sac de 50 kg » est un sac. */
const premierMot = (unite: string) => sansAccents(unite).split(/\s+/)[0] ?? "";

const CONTENANTS_LUS = new Set(CONTENANTS.map(sansAccents));

export const estUnContenant = (unite: string | null | undefined): boolean =>
  CONTENANTS_LUS.has(premierMot(unite ?? ""));

/** « un paquet », « une boîte ». */
export const unOuUne = (mot: string) =>
  `${FEMININS.has(premierMot(mot)) ? "une" : "un"} ${mot.trim()}`;

/** « du paquet », « de la boîte ». */
export const duOuDeLa = (mot: string) =>
  `${FEMININS.has(premierMot(mot)) ? "de la" : "du"} ${mot.trim()}`;

/** « le paquet », « la pièce ». */
export const leOuLa = (mot: string) =>
  `${FEMININS.has(premierMot(mot)) ? "la" : "le"} ${mot.trim()}`;

export interface SaisieUnite {
  /** Ce que l'on a choisi : pièce, kg, paquet, carton… */
  unite: string;
  /** Pour un contenant : combien il contient. Vide : il se vend entier. */
  contenu: string;
  /** Ce qu'il contient : des pièces, des kg… */
  uniteInterne: string;
  /** L'identifiant du conditionnement, gardé d'une modification à l'autre. */
  idLot: string;
  /** L'étiquette du paquet, distincte de celle de la pièce. */
  codeBarresLot: string;
  /**
   * Les autres conditionnements d'un produit qui en avait plusieurs :
   * le formulaire n'en montre qu'un, mais n'efface pas les autres.
   */
  autres: Conditionnement[];
}

/** Le prix de vente saisi : celui du contenant, ou celui de l'unité. */
export type ReferenceVente = "lot" | "unite";

export interface PrixSaisis {
  /** Le prix d'achat de l'unité CHOISIE : celui du paquet, s'il en est un. */
  achat: number;
  /** Le prix de vente, au niveau de `reference`. */
  vente: number;
  reference: ReferenceVente;
}

export const PRIX_VIDES: PrixSaisis = { achat: 0, vente: 0, reference: "lot" };

export const saisieUniteVide = (): SaisieUnite => ({
  unite: "pièce",
  contenu: "",
  uniteInterne: "pièce",
  idLot: nouvelIdentifiant(),
  codeBarresLot: "",
  autres: [],
});

export const auCentime = (n: number) => Math.round(n * 100) / 100;

/** Combien d'unités le contenant renferme ; `null` quand il se vend entier. */
export const contenuDe = (s: SaisieUnite): number | null => {
  if (!estUnContenant(s.unite)) return null;
  const n = Number(s.contenu.trim().replace(",", "."));
  return s.contenu.trim() !== "" && Number.isInteger(n) && n >= 2 ? n : null;
};

/** L'unité dans laquelle le stock se comptera. */
export const uniteDuStock = (s: SaisieUnite): string =>
  contenuDe(s) ? s.uniteInterne.trim() || "pièce" : s.unite.trim();

/**
 * Changer d'unité. Une douzaine en contient 12 sans qu'on le demande ;
 * un contenant ne peut pas se contenir lui-même.
 */
export const choisirUnite = (s: SaisieUnite, unite: string): SaisieUnite => {
  const suite = { ...s, unite };
  const habituel = CONTENU_HABITUEL[premierMot(unite)];
  if (habituel && s.contenu.trim() === "") suite.contenu = String(habituel);
  if (sansAccents(suite.uniteInterne) === sansAccents(unite)) suite.uniteInterne = "pièce";
  return suite;
};

/** Ce qui empêcherait d'enregistrer, dit dans les mots du formulaire. */
export const erreurUnite = (s: SaisieUnite): string | null => {
  if (!estUnContenant(s.unite) || s.contenu.trim() === "") return null;
  const interne = s.uniteInterne.trim() || "pièce";
  if (contenuDe(s) === null) {
    return `${unOuUne(s.unite).replace(/^u/, "U")} doit contenir au moins 2 ${libelleUnite(interne, 2)}, en nombre entier — ou laissez vide s'il se vend toujours entier.`;
  }
  if (sansAccents(interne) === sansAccents(s.unite)) {
    return `${unOuUne(s.unite).replace(/^u/, "U")} ne peut pas contenir des ${libelleUnite(interne, 2)}.`;
  }
  return null;
};

/** Les prix aux deux niveaux. L'un est saisi, l'autre en est déduit. */
export const prixDetailles = (s: SaisieUnite, p: PrixSaisis) => {
  const n = contenuDe(s);
  if (!n) {
    return {
      contenu: null,
      achatUnite: p.achat,
      achatLot: null,
      venteUnite: p.vente,
      venteLot: null,
    };
  }
  return {
    contenu: n,
    achatLot: p.achat,
    achatUnite: auCentime(p.achat / n),
    venteLot: p.reference === "lot" ? p.vente : auCentime(p.vente * n),
    venteUnite: p.reference === "lot" ? auCentime(p.vente / n) : p.vente,
  };
};

/**
 * Passer d'une référence à l'autre : le prix affiché est converti, il
 * ne change pas de sens. 15 000 le paquet de 12 devient 1 250 la pièce.
 */
export const changerReference = (
  s: SaisieUnite,
  p: PrixSaisis,
  reference: ReferenceVente,
): PrixSaisis => {
  if (reference === p.reference) return p;
  const d = prixDetailles(s, p);
  if (d.contenu === null) return { ...p, reference };
  return { ...p, reference, vente: reference === "lot" ? d.venteLot! : d.venteUnite };
};

/**
 * Ce que la fiche produit enregistre.
 *
 * Contenant rempli : le stock se compte dans l'unité contenue, et le
 * paquet devient le premier conditionnement — son prix d'achat tel que
 * saisi, son prix de vente seulement s'il est la référence (sinon il
 * suit celui de la pièce, `prixVenteDe`).
 */
export const versFiche = (
  s: SaisieUnite,
  p: PrixSaisis,
): {
  unite: string;
  prixAchat: number;
  prixVenteDefaut: number;
  conditionnements: Conditionnement[];
} => {
  const d = prixDetailles(s, p);
  if (d.contenu === null) {
    return {
      unite: s.unite.trim(),
      prixAchat: p.achat,
      prixVenteDefaut: p.vente,
      conditionnements: s.autres,
    };
  }
  const lot: Conditionnement = {
    id: s.idLot,
    nom: s.unite.trim(),
    quantite: d.contenu,
    prixAchat: p.achat,
    prixVente: p.reference === "lot" ? p.vente : null,
    codeBarres: s.codeBarresLot.trim() || null,
  };
  return {
    unite: uniteDuStock(s),
    prixAchat: d.achatUnite,
    prixVenteDefaut: d.venteUnite,
    conditionnements: [lot, ...s.autres],
  };
};

/** `erreurUnite`, puis les règles de la base sur la liste obtenue. */
export const erreurDeLaFiche = (s: SaisieUnite, p: PrixSaisis): string | null => {
  const e = erreurUnite(s);
  if (e) return e;
  const f = versFiche(s, p);
  return erreurConditionnements(f.conditionnements, f.unite || null);
};

/**
 * Relire une fiche pour la modifier.
 *
 * Le premier conditionnement redevient l'unité choisie : « Cahier, au
 * carton de 2 paquets ». Son prix de vente n'est repris comme
 * référence que s'il s'accorde avec celui de l'unité ; sinon c'est le
 * prix de l'unité qui fait foi — c'est lui que la caisse applique au
 * détail, et les deux ne peuvent plus diverger.
 */
export const depuisFiche = (produit: {
  unite: string | null;
  prixAchat: number;
  prixVenteDefaut: number;
  conditionnements: Conditionnement[];
}): { saisie: SaisieUnite; prix: PrixSaisis } => {
  const [lot, ...autres] = produit.conditionnements;
  if (!lot) {
    return {
      saisie: { ...saisieUniteVide(), unite: produit.unite ?? "" },
      prix: { achat: produit.prixAchat, vente: produit.prixVenteDefaut, reference: "lot" },
    };
  }
  const n = lot.quantite;
  const accorde = (prixLot: number | null, prixUnite: number) =>
    prixLot !== null && Math.abs(prixLot / n - prixUnite) < 0.01;
  const venteDuLot = accorde(lot.prixVente, produit.prixVenteDefaut);
  return {
    saisie: {
      unite: lot.nom,
      contenu: String(n),
      uniteInterne: produit.unite?.trim() || "pièce",
      idLot: lot.id,
      codeBarresLot: lot.codeBarres ?? "",
      autres,
    },
    prix: {
      achat: accorde(lot.prixAchat, produit.prixAchat)
        ? lot.prixAchat!
        : auCentime(produit.prixAchat * n),
      vente: venteDuLot ? lot.prixVente! : produit.prixVenteDefaut,
      reference: venteDuLot ? "lot" : "unite",
    },
  };
};

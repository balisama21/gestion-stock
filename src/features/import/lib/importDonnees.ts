/**
 * IMPORT DE DONNÉES — la partie déterministe, sans IA.
 *
 * Un fichier (CSV, Excel, tableau Word) devient des lignes ; chaque
 * colonne est rapprochée d'un champ de l'application (devinée, puis
 * corrigeable à la main) ; chaque ligne est vérifiée, et les doublons —
 * dans le fichier comme avec l'existant — sont signalés avant qu'on
 * écrive quoi que ce soit.
 *
 * Les lignes extraites par l'IA (PDF, images) passent EXACTEMENT par la
 * même validation : le modèle n'a pas d'autre porte d'entrée que celle
 * d'un fichier tapé à la main.
 *
 * Tout ici est pur : aucune lecture de fichier, aucun appel réseau.
 */
import { cleDeListe } from "../../../lib/listes";

export type CibleImport = "produits" | "clients" | "fournisseurs" | "achats";
/** Ce que la détection peut reconnaître, y compris ce qu'on n'importe pas. */
export type NatureDonnees = CibleImport | "ventes";
export type TypeChamp = "texte" | "nombre" | "entier" | "email" | "telephone" | "date";

export interface ChampImport {
  cle: string;
  libelle: string;
  type: TypeChamp;
  obligatoire?: boolean;
  /** Nombre strictement positif (quantité d'un achat). */
  positif?: boolean;
  /** En-têtes reconnus, déjà normalisés par `normaliserEntete`. */
  synonymes: string[];
}

export const SCHEMAS_IMPORT: Record<CibleImport, ChampImport[]> = {
  produits: [
    {
      cle: "designation",
      libelle: "Désignation",
      type: "texte",
      obligatoire: true,
      synonymes: [
        "designation",
        "produit",
        "nom",
        "nom du produit",
        "article",
        "libelle",
        "intitule",
        "name",
        "product",
        "item",
      ],
    },
    {
      cle: "variante",
      libelle: "Variante",
      type: "texte",
      synonymes: [
        "variante",
        "variant",
        "taille",
        "couleur",
        "modele",
        "format",
        "conditionnement",
      ],
    },
    {
      cle: "prix_achat",
      libelle: "Prix d'achat",
      type: "nombre",
      synonymes: [
        "prix achat",
        "prix d achat",
        "pa",
        "cout",
        "cout unitaire",
        "prix de revient",
        "purchase price",
        "cost",
      ],
    },
    {
      cle: "prix_vente",
      libelle: "Prix de vente",
      type: "nombre",
      synonymes: [
        "prix vente",
        "prix de vente",
        "pv",
        "prix",
        "tarif",
        "prix unitaire",
        "pu",
        "price",
        "sale price",
      ],
    },
    {
      cle: "stock_initial",
      libelle: "Stock initial",
      type: "entier",
      synonymes: [
        "stock",
        "stock initial",
        "quantite",
        "qte",
        "qty",
        "quantity",
        "en stock",
        "stock actuel",
      ],
    },
    {
      cle: "seuil_alerte",
      libelle: "Seuil d'alerte",
      type: "entier",
      synonymes: [
        "seuil",
        "seuil alerte",
        "seuil d alerte",
        "alerte",
        "stock minimum",
        "stock min",
        "minimum",
      ],
    },
    {
      cle: "fournisseur",
      libelle: "Fournisseur",
      type: "texte",
      synonymes: ["fournisseur", "supplier", "vendor", "fabricant", "marque"],
    },
  ],
  clients: [
    {
      cle: "nom",
      libelle: "Nom",
      type: "texte",
      obligatoire: true,
      synonymes: ["nom", "nom du client", "client", "name", "last name", "raison sociale"],
    },
    {
      cle: "prenom",
      libelle: "Prénom",
      type: "texte",
      synonymes: ["prenom", "first name", "prenoms"],
    },
    {
      cle: "entreprise",
      libelle: "Entreprise",
      type: "texte",
      synonymes: ["entreprise", "societe", "company", "organisation"],
    },
    {
      cle: "telephone",
      libelle: "Téléphone",
      type: "telephone",
      synonymes: [
        "telephone",
        "tel",
        "tel portable",
        "mobile",
        "portable",
        "phone",
        "contact",
        "numero",
      ],
    },
    {
      cle: "email",
      libelle: "E-mail",
      type: "email",
      synonymes: ["email", "e mail", "mail", "courriel", "adresse email", "adresse mail"],
    },
    {
      cle: "adresse",
      libelle: "Adresse",
      type: "texte",
      synonymes: ["adresse", "address", "rue", "quartier", "lot"],
    },
    {
      cle: "ville",
      libelle: "Ville",
      type: "texte",
      synonymes: ["ville", "city", "localite", "commune"],
    },
    {
      cle: "note",
      libelle: "Note",
      type: "texte",
      synonymes: ["note", "notes", "remarque", "commentaire", "observation"],
    },
  ],
  // Rempli plus bas : réutilise les synonymes des produits.
  achats: [],
  fournisseurs: [
    {
      cle: "nom",
      libelle: "Nom",
      type: "texte",
      obligatoire: true,
      synonymes: ["nom", "fournisseur", "nom du fournisseur", "name", "supplier", "raison sociale"],
    },
    {
      cle: "entreprise",
      libelle: "Entreprise",
      type: "texte",
      synonymes: ["entreprise", "societe", "company"],
    },
    {
      cle: "telephone",
      libelle: "Téléphone",
      type: "telephone",
      synonymes: ["telephone", "tel", "mobile", "portable", "phone", "contact", "numero"],
    },
    {
      cle: "email",
      libelle: "E-mail",
      type: "email",
      synonymes: ["email", "e mail", "mail", "courriel"],
    },
    {
      cle: "adresse",
      libelle: "Adresse",
      type: "texte",
      synonymes: ["adresse", "address", "rue", "quartier"],
    },
    { cle: "ville", libelle: "Ville", type: "texte", synonymes: ["ville", "city", "localite"] },
    {
      cle: "note",
      libelle: "Note",
      type: "texte",
      synonymes: ["note", "notes", "remarque", "commentaire"],
    },
  ],
};

const SYNONYMES_DATE = [
  "date",
  "jour",
  "date achat",
  "date d achat",
  "date de l achat",
  "date facture",
  "date vente",
  "date de vente",
  "le",
];
const SYNONYMES_DESIGNATION = SCHEMAS_IMPORT.produits[0].synonymes;
const SYNONYMES_QUANTITE = ["quantite", "qte", "qty", "quantity", "nombre", "nb", "unites"];

/**
 * Achats : chaque ligne devient un vrai achat (RPC add_purchase) — le stock
 * augmente et, sans montant payé, l'achat est réglé comptant. L'écran le
 * dit et demande une confirmation explicite.
 */
SCHEMAS_IMPORT.achats = [
  { cle: "date", libelle: "Date", type: "date", obligatoire: true, synonymes: SYNONYMES_DATE },
  {
    cle: "designation",
    libelle: "Produit",
    type: "texte",
    obligatoire: true,
    synonymes: SYNONYMES_DESIGNATION,
  },
  {
    cle: "variante",
    libelle: "Variante",
    type: "texte",
    synonymes: SCHEMAS_IMPORT.produits[1].synonymes,
  },
  {
    cle: "quantite",
    libelle: "Quantité",
    type: "entier",
    obligatoire: true,
    positif: true,
    synonymes: SYNONYMES_QUANTITE,
  },
  {
    cle: "prix_achat",
    libelle: "Prix d'achat unitaire",
    type: "nombre",
    obligatoire: true,
    synonymes: [
      "prix achat",
      "prix d achat",
      "pa",
      "cout",
      "cout unitaire",
      "prix de revient",
      "prix unitaire",
      "pu",
      "prix",
      "purchase price",
      "cost",
    ],
  },
  {
    cle: "fournisseur",
    libelle: "Fournisseur",
    type: "texte",
    synonymes: ["fournisseur", "supplier", "vendor", "chez"],
  },
  {
    cle: "montant_paye",
    libelle: "Montant payé",
    type: "nombre",
    synonymes: ["montant paye", "paye", "regle", "montant regle", "verse", "acompte", "paid"],
  },
  {
    cle: "prix_vente",
    libelle: "Prix de vente (nouveau produit)",
    type: "nombre",
    synonymes: ["prix vente", "prix de vente", "pv"],
  },
];

/**
 * Ventes : reconnues pour ne PAS être importées au mauvais endroit. Les
 * enregistrer après coup ferait sortir du stock et entrer de l'argent
 * aujourd'hui pour des opérations passées : on ne le fait pas.
 */
const SCHEMA_VENTES: ChampImport[] = [
  { cle: "date", libelle: "Date", type: "date", obligatoire: true, synonymes: SYNONYMES_DATE },
  {
    cle: "designation",
    libelle: "Produit",
    type: "texte",
    obligatoire: true,
    synonymes: SYNONYMES_DESIGNATION,
  },
  {
    cle: "quantite",
    libelle: "Quantité",
    type: "entier",
    obligatoire: true,
    synonymes: SYNONYMES_QUANTITE,
  },
  {
    cle: "prix_vente",
    libelle: "Prix",
    type: "nombre",
    synonymes: ["prix vente", "prix de vente", "pv", "prix", "prix unitaire", "pu"],
  },
  {
    cle: "total",
    libelle: "Total",
    type: "nombre",
    synonymes: ["total", "montant", "total vente", "chiffre d affaires", "ca"],
  },
  {
    cle: "client",
    libelle: "Client",
    type: "texte",
    synonymes: ["client", "acheteur", "customer"],
  },
  {
    cle: "vendeur",
    libelle: "Vendeur",
    type: "texte",
    synonymes: ["vendeur", "caissier", "seller"],
  },
];

export const LIBELLES_CIBLE: Record<CibleImport, string> = {
  produits: "produits",
  clients: "clients",
  fournisseurs: "fournisseurs",
  achats: "achats",
};

/** Le module de l'application où chaque type de données est enregistré. */
export const MODULES_CIBLE: Record<CibleImport, { libelle: string; onglet: string }> = {
  produits: { libelle: "Produits et stock", onglet: "produits" },
  clients: { libelle: "Clients", onglet: "clients" },
  fournisseurs: { libelle: "Fournisseurs", onglet: "fournisseurs" },
  achats: { libelle: "Achats (et stock)", onglet: "achats" },
};

/** Plafond de lignes d'un import : au-delà, on découpe le fichier. */
export const MAX_LIGNES_IMPORT = 5000;
const LONGUEUR_MAX_TEXTE = 300;

export type Cellule = string | number | boolean | null | undefined;

export interface Tableau {
  entetes: string[];
  lignes: Cellule[][];
}

// ─── Lecture d'un CSV ────────────────────────────────────────────────

/** Le séparateur le plus fréquent de la première ligne, hors guillemets. */
export function detecterSeparateur(premiereLigne: string): string {
  const candidats = [";", ",", "\t", "|"];
  let meilleur = ",";
  let max = 0;
  for (const c of candidats) {
    let n = 0;
    let entreGuillemets = false;
    for (const ch of premiereLigne) {
      if (ch === '"') entreGuillemets = !entreGuillemets;
      else if (ch === c && !entreGuillemets) n++;
    }
    if (n > max) {
      max = n;
      meilleur = c;
    }
  }
  return meilleur;
}

/** CSV conforme RFC 4180 : guillemets, guillemets doublés, retours à la ligne cités. */
export function analyserCsv(texte: string): string[][] {
  const contenu = texte.replace(/^\uFEFF/, "");
  const premiere = contenu.split(/\r?\n/, 1)[0] ?? "";
  const sep = detecterSeparateur(premiere);
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let entreGuillemets = false;
  for (let i = 0; i < contenu.length; i++) {
    const ch = contenu[i];
    if (entreGuillemets) {
      if (ch === '"') {
        if (contenu[i + 1] === '"') {
          cellule += '"';
          i++;
        } else entreGuillemets = false;
      } else cellule += ch;
    } else if (ch === '"' && cellule === "") {
      entreGuillemets = true;
    } else if (ch === sep) {
      ligne.push(cellule);
      cellule = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && contenu[i + 1] === "\n") i++;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = "";
    } else cellule += ch;
  }
  if (cellule !== "" || ligne.length > 0) {
    ligne.push(cellule);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((c) => c.trim() !== ""));
}

/**
 * La ligne d'en-têtes est la première qui porte au moins deux cellules
 * remplies (un titre seul en haut de feuille est fréquent) ; si le
 * fichier n'a qu'une colonne, la première ligne non vide.
 */
export function enTableau(brut: Cellule[][]): Tableau {
  const nonVides = brut.filter((l) => l.some((c) => String(c ?? "").trim() !== ""));
  if (nonVides.length === 0) return { entetes: [], lignes: [] };
  let idx = nonVides.findIndex((l) => l.filter((c) => String(c ?? "").trim() !== "").length >= 2);
  if (idx < 0) idx = 0;
  const largeur = Math.max(...nonVides.slice(idx).map((l) => l.length));
  const entetes = Array.from({ length: largeur }, (_, i) => {
    const v = String(nonVides[idx][i] ?? "").trim();
    return v || `Colonne ${i + 1}`;
  });
  return { entetes, lignes: nonVides.slice(idx + 1) };
}

// ─── Correspondance des colonnes ─────────────────────────────────────

export function normaliserEntete(texte: string): string {
  return cleDeListe(String(texte))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type Correspondance = Record<string, number | null>;

/**
 * Rapproche chaque champ d'une colonne : égalité exacte avec un synonyme
 * d'abord, puis inclusion. Une colonne ne sert qu'une fois. Ce n'est
 * qu'une proposition : l'écran laisse tout corriger.
 */
export function devinerCorrespondance(entetes: string[], cible: CibleImport): Correspondance {
  return correspondre(entetes, SCHEMAS_IMPORT[cible]);
}

function correspondre(entetes: string[], schema: ChampImport[]): Correspondance {
  const normes = entetes.map(normaliserEntete);
  const scores: { champ: string; col: number; score: number }[] = [];
  schema.forEach((champ, rang) => {
    normes.forEach((n, col) => {
      if (!n) return;
      let score = 0;
      for (const s of champ.synonymes) {
        if (n === s) score = Math.max(score, 100);
        else if (n.split(" ").includes(s) || (s.includes(" ") && n.includes(s)))
          score = Math.max(score, 50 + s.length);
      }
      // À score égal, l'ordre du schéma départage (désignation avant variante).
      if (score > 0) scores.push({ champ: champ.cle, col, score: score - rang * 0.01 });
    });
  });
  scores.sort((a, b) => b.score - a.score);
  const resultat: Correspondance = Object.fromEntries(schema.map((c) => [c.cle, null]));
  const prises = new Set<number>();
  for (const s of scores) {
    if (resultat[s.champ] !== null || prises.has(s.col)) continue;
    resultat[s.champ] = s.col;
    prises.add(s.col);
  }
  return resultat;
}

// ─── Lecture des valeurs ─────────────────────────────────────────────

/**
 * « 1 234,50 », « 1.234,50 », « 1,234.50 », « 12 000 Ar », « 3,5 » → nombre.
 * Rend `null` pour une cellule vide, `NaN` pour une valeur illisible.
 */
export function lireNombre(v: Cellule): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "boolean") return NaN;
  let t = String(v)
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/(ar|mga|kmf|fc|eur|usd|€|\$|fcfa|cfa)$/i, "")
    .replace(/^(ar|mga|kmf|fc|eur|usd|€|\$)/i, "");
  if (t === "") return null;
  const virgule = t.lastIndexOf(",");
  const point = t.lastIndexOf(".");
  if (virgule >= 0 && point >= 0) {
    // Le dernier séparateur est la décimale, l'autre sépare les milliers.
    t = virgule > point ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgule >= 0) {
    const parties = t.split(",");
    // « 1,234,567 » ou « 12,000 » (trois chiffres après) : milliers.
    t =
      parties.length > 2 ||
      (parties.length === 2 &&
        parties[1].length === 3 &&
        parties[0].length <= 3 &&
        !/^0/.test(parties[0]))
        ? parties.join("")
        : t.replace(",", ".");
  } else if (point >= 0) {
    const parties = t.split(".");
    if (parties.length > 2) t = parties.join("");
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

// eslint-disable-next-line no-control-regex -- c'est précisément ce qu'on retire
const CARACTERES_DE_CONTROLE = /[\u0000-\u001f\u007f]/g;

export function lireTexte(v: Cellule): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(CARACTERES_DE_CONTROLE, " ").replace(/\s+/g, " ").trim();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function lireTelephone(v: Cellule): string {
  // Excel transforme « 0341234567 » en 341234567 : on garde ce qu'on a,
  // sans réinventer un zéro qui n'est peut-être pas dû.
  const t = typeof v === "number" ? String(Math.trunc(v)) : lireTexte(v);
  return t.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

/**
 * Une date lue d'une cellule, au format ISO « AAAA-MM-JJ ».
 * Excel (numéro de série), « 15/10/2026 », « 15-10-26 », « 2026-10-15 ».
 * Rend `null` pour une cellule vide, `"invalide"` sinon.
 */
export function lireDate(v: Cellule, aujourdhui = new Date()): string | null | "invalide" {
  if (v === null || v === undefined || v === "") return null;
  let a: number, m: number, j: number;
  if (typeof v === "number") {
    // Numéro de série Excel : jours depuis le 30/12/1899.
    if (v < 20000 || v > 80000) return "invalide";
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    [a, m, j] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  } else {
    const t = lireTexte(v);
    let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
    if (r) [a, m, j] = [+r[1], +r[2], +r[3]];
    else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(t))) {
      [j, m, a] = [+r[1], +r[2], +r[3]];
      if (a < 100) a += 2000;
    } else return "invalide";
  }
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) {
    return "invalide";
  }
  if (a < 2000 || d.getTime() > aujourdhui.getTime() + 86_400_000) return "invalide";
  return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

// ─── Validation et doublons ──────────────────────────────────────────

export type StatutLigne = "ok" | "erreur" | "doublon_fichier" | "doublon_existant";

export interface LigneImport {
  /** Numéro de la ligne dans le fichier (en-tête = 1), pour le rapport. */
  numero: number;
  valeurs: Record<string, string | number | null>;
  erreurs: string[];
  statut: StatutLigne;
  cle: string;
  /** L'enregistrement déjà en base que cette ligne recoupe (doublon_existant). */
  existantId?: string | null;
}

/** La clé d'anti-doublon d'une ligne, alignée sur les index uniques de la base. */
export function cleDoublon(cible: CibleImport, v: Record<string, string | number | null>): string {
  const t = (k: string) => cleDeListe(String(v[k] ?? ""));
  switch (cible) {
    case "produits":
      return `${t("designation")}|${t("variante")}`;
    case "fournisseurs":
      return t("nom");
    case "clients": {
      const email = t("email");
      if (email) return `@${email}`;
      const tel = String(v.telephone ?? "").replace(/\D/g, "");
      if (tel.length >= 6) return `#${tel.slice(-9)}`;
      return `${t("nom")}|${t("prenom")}`;
    }
    case "achats": {
      // Le même achat : même jour, même article, même quantité, même prix.
      const nom = cleDeListe([v.designation, v.variante].filter(Boolean).join(" "));
      return `${v.date ?? ""}|${nom}|${v.quantite ?? ""}|${Number(v.prix_achat ?? 0)}`;
    }
  }
}

/**
 * Clés de l'existant → identifiant de l'enregistrement, à passer à
 * `preparerLignes`. Un enregistrement sans `id` (tests) vaut `null`.
 */
export function clesExistantes(
  cible: CibleImport,
  existants: Record<string, string | number | null | undefined>[],
): Map<string, string | null> {
  const cles = new Map<string, string | null>();
  for (const e of existants) {
    const v = Object.fromEntries(Object.entries(e).map(([k, x]) => [k, x ?? null]));
    const id = typeof v.id === "string" ? v.id : null;
    cles.set(cleDoublon(cible, v), id);
    // Un client déjà connu par son e-mail l'est aussi par son téléphone.
    if (cible === "clients") {
      if (v.email) cles.set(cleDoublon(cible, { ...v, telephone: null }), id);
      if (v.telephone) cles.set(cleDoublon(cible, { ...v, email: null }), id);
    }
  }
  for (const vide of ["", "|", "||0|0", "|||0"]) cles.delete(vide);
  return cles;
}

/** Une ligne en valeurs typées + ses erreurs, d'après le schéma. */
export function validerValeurs(
  cible: CibleImport,
  brutes: Record<string, Cellule>,
): { valeurs: Record<string, string | number | null>; erreurs: string[] } {
  const valeurs: Record<string, string | number | null> = {};
  const erreurs: string[] = [];
  for (const champ of SCHEMAS_IMPORT[cible]) {
    const brut = brutes[champ.cle];
    const avant = erreurs.length;
    switch (champ.type) {
      case "nombre":
      case "entier": {
        const n = lireNombre(brut);
        if (n === null) valeurs[champ.cle] = null;
        else if (Number.isNaN(n)) {
          valeurs[champ.cle] = null;
          erreurs.push(
            `${champ.libelle} : « ${lireTexte(brut).slice(0, 30)} » n'est pas un nombre`,
          );
        } else if (n < 0) {
          valeurs[champ.cle] = null;
          erreurs.push(`${champ.libelle} : valeur négative`);
        } else if (champ.type === "entier" && !Number.isInteger(n)) {
          valeurs[champ.cle] = null;
          erreurs.push(`${champ.libelle} : nombre entier attendu`);
        } else if (n > 1e12) {
          valeurs[champ.cle] = null;
          erreurs.push(`${champ.libelle} : valeur trop grande`);
        } else if (champ.positif && n === 0) {
          valeurs[champ.cle] = null;
          erreurs.push(`${champ.libelle} : doit être supérieur à zéro`);
        } else valeurs[champ.cle] = n;
        break;
      }
      case "date": {
        const d = lireDate(brut);
        if (d === "invalide") {
          valeurs[champ.cle] = null;
          erreurs.push(
            `${champ.libelle} : « ${lireTexte(brut).slice(0, 20)} » n'est pas une date valable`,
          );
        } else valeurs[champ.cle] = d;
        break;
      }
      case "email": {
        const t = lireTexte(brut).toLowerCase();
        if (t && !EMAIL.test(t)) erreurs.push(`${champ.libelle} : adresse invalide`);
        valeurs[champ.cle] = t && EMAIL.test(t) ? t : null;
        break;
      }
      case "telephone": {
        const t = lireTelephone(brut);
        valeurs[champ.cle] = t || null;
        break;
      }
      default: {
        const t = lireTexte(brut);
        if (t.length > LONGUEUR_MAX_TEXTE) erreurs.push(`${champ.libelle} : texte trop long`);
        valeurs[champ.cle] = t ? t.slice(0, LONGUEUR_MAX_TEXTE) : null;
      }
    }
    // « obligatoire » seulement si la valeur manque, pas si elle est fausse.
    if (
      champ.obligatoire &&
      erreurs.length === avant &&
      (valeurs[champ.cle] === null || valeurs[champ.cle] === "")
    ) {
      erreurs.push(`${champ.libelle} obligatoire`);
    }
  }
  if (
    cible === "achats" &&
    typeof valeurs.montant_paye === "number" &&
    typeof valeurs.quantite === "number" &&
    typeof valeurs.prix_achat === "number" &&
    valeurs.montant_paye > valeurs.quantite * valeurs.prix_achat + 1e-6
  ) {
    erreurs.push("Montant payé supérieur au total de l'achat");
  }
  return { valeurs, erreurs };
}

type Existantes = Map<string, string | null> | Set<string>;

/**
 * Lignes du tableau → lignes vérifiées. `premiereLigne` est le numéro, dans
 * le fichier, de la première ligne de données (pour le rapport d'erreurs).
 */
export function preparerLignes(
  tableau: Tableau,
  correspondance: Correspondance,
  cible: CibleImport,
  existantes: Existantes,
  premiereLigne = 2,
): LigneImport[] {
  const vues = new Set<string>();
  return tableau.lignes.slice(0, MAX_LIGNES_IMPORT).map((ligne, i) => {
    const brutes: Record<string, Cellule> = {};
    for (const champ of SCHEMAS_IMPORT[cible]) {
      const col = correspondance[champ.cle];
      brutes[champ.cle] = col === null || col === undefined ? null : ligne[col];
    }
    return classer(cible, brutes, premiereLigne + i, vues, existantes);
  });
}

/** Même contrôle pour des lignes déjà nommées par champ (extraction IA). */
export function preparerLignesNommees(
  lignes: Record<string, Cellule>[],
  cible: CibleImport,
  existantes: Existantes,
): LigneImport[] {
  const vues = new Set<string>();
  return lignes
    .slice(0, MAX_LIGNES_IMPORT)
    .map((brutes, i) => classer(cible, brutes, i + 1, vues, existantes));
}

function classer(
  cible: CibleImport,
  brutes: Record<string, Cellule>,
  numero: number,
  vues: Set<string>,
  existantes: Existantes,
): LigneImport {
  const { valeurs, erreurs } = validerValeurs(cible, brutes);
  const cle = cleDoublon(cible, valeurs);
  const ligne: LigneImport = { numero, valeurs, erreurs, statut: "ok", cle };
  if (erreurs.length > 0) ligne.statut = "erreur";
  else if (vues.has(cle)) ligne.statut = "doublon_fichier";
  else if (existantes.has(cle)) {
    ligne.statut = "doublon_existant";
    ligne.existantId = existantes instanceof Map ? (existantes.get(cle) ?? null) : null;
  }
  if (ligne.statut === "ok" || ligne.statut === "doublon_existant") vues.add(cle);
  return ligne;
}

export function bilanPreparation(lignes: LigneImport[]) {
  return {
    total: lignes.length,
    aImporter: lignes.filter((l) => l.statut === "ok").length,
    erreurs: lignes.filter((l) => l.statut === "erreur").length,
    doublonsFichier: lignes.filter((l) => l.statut === "doublon_fichier").length,
    doublonsExistants: lignes.filter((l) => l.statut === "doublon_existant").length,
  };
}

/**
 * Empreinte stable d'un import (FNV-1a sur le contenu retenu) : sert de
 * base aux clés d'idempotence. Relancer le même import après une coupure
 * ne recrée pas les produits déjà passés.
 */
export function empreinte(lignes: LigneImport[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const texte = JSON.stringify(lignes.map((l) => [l.numero, l.valeurs]));
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

// ─── Détection du type de données ────────────────────────────────────

export interface Detection {
  /** Le type retenu, ou `null` quand il faut demander à l'utilisateur. */
  nature: NatureDonnees | null;
  /** Vrai quand plusieurs destinations restent plausibles : on demande. */
  ambigu: boolean;
  /** Les candidats plausibles, du plus probable au moins probable. */
  candidats: { nature: NatureDonnees; score: number }[];
  raison: string;
}

const SCHEMAS_DETECTION: Record<NatureDonnees, ChampImport[]> = {
  ...SCHEMAS_IMPORT,
  ventes: SCHEMA_VENTES,
};

/** Mots du nom de la feuille ou du fichier qui orientent la détection. */
const INDICES_NOM: Record<NatureDonnees, string[]> = {
  produits: [
    "produit",
    "produits",
    "article",
    "articles",
    "stock",
    "stocks",
    "inventaire",
    "catalogue",
    "inventory",
    "products",
    "items",
  ],
  clients: ["client", "clients", "customer", "customers", "clientele"],
  fournisseurs: ["fournisseur", "fournisseurs", "supplier", "suppliers", "vendors"],
  achats: [
    "achat",
    "achats",
    "purchase",
    "purchases",
    "approvisionnement",
    "approvisionnements",
    "reception",
    "receptions",
    "entrees",
  ],
  ventes: ["vente", "ventes", "sales", "ticket", "tickets", "caisse"],
};

/** En-têtes qui ne trompent pas sur la nature d'un tiers ou d'une opération. */
const INDICES_ENTETES: Partial<Record<NatureDonnees, string[]>> = {
  clients: ["prenom", "client", "nom du client"],
  fournisseurs: [
    "nom du fournisseur",
    "conditions de paiement",
    "delai de livraison",
    "produits fournis",
    "nif",
  ],
  achats: ["fournisseur", "prix d achat", "prix achat", "cout", "montant paye"],
  ventes: ["client", "vendeur", "caissier", "total vente", "prix de vente"],
};

const MOTS_PRIX_OU_STOCK = [
  "prix",
  "pv",
  "pa",
  "pu",
  "cout",
  "stock",
  "quantite",
  "qte",
  "qty",
  "montant",
  "total",
  "tarif",
];

/**
 * Devine ce que contient un tableau : produits, clients, fournisseurs,
 * achats — ou ventes, reconnues pour être refusées. Ne tranche que s'il
 * n'y a pas de doute raisonnable ; sinon, `nature: null` et l'écran demande.
 */
export function detecterNature(entetes: string[], indices: string[] = []): Detection {
  const normes = entetes.map(normaliserEntete).filter(Boolean);
  const mots = new Set(indices.flatMap((i) => normaliserEntete(i).split(" ")).filter(Boolean));
  const aDate = normes.some((n) => SYNONYMES_DATE.includes(n) || n.startsWith("date"));
  const aPrixOuStock = normes.some((n) =>
    MOTS_PRIX_OU_STOCK.some((s) => n === s || n.split(" ").includes(s)),
  );

  const candidats: { nature: NatureDonnees; score: number }[] = [];
  for (const nature of Object.keys(SCHEMAS_DETECTION) as NatureDonnees[]) {
    const schema = SCHEMAS_DETECTION[nature];
    const corr = correspondre(entetes, schema);
    if (schema.some((c) => c.obligatoire && corr[c.cle] === null)) continue;
    let score = schema.reduce((t, c) => t + (corr[c.cle] === null ? 0 : c.obligatoire ? 3 : 1), 0);

    // Règles qui séparent des formes voisines.
    if (nature === "produits") {
      if (corr.prix_achat === null && corr.prix_vente === null && corr.stock_initial === null) {
        continue;
      }
      if (aDate) score *= 0.3;
    }
    if (nature === "ventes" && corr.prix_vente === null && corr.total === null) continue;
    if ((nature === "clients" || nature === "fournisseurs") && aPrixOuStock) score *= 0.3;

    for (const s of INDICES_ENTETES[nature] ?? []) if (normes.includes(s)) score += 2;
    if (INDICES_NOM[nature].some((m) => mots.has(m))) score += 4;
    candidats.push({ nature, score: Math.round(score * 10) / 10 });
  }
  candidats.sort((a, b) => b.score - a.score);

  if (candidats.length === 0) {
    return {
      nature: null,
      ambigu: false,
      candidats,
      raison: "Type non reconnu : aucune colonne obligatoire (désignation, nom…) n'a été trouvée.",
    };
  }
  const [premier, second] = candidats;
  if (second && second.score >= premier.score * 0.85) {
    return {
      nature: null,
      ambigu: true,
      candidats,
      raison: "Plusieurs destinations sont possibles : précisez ce que contient ce tableau.",
    };
  }
  return {
    nature: premier.nature,
    ambigu: false,
    candidats,
    raison: "Détecté d'après les en-têtes.",
  };
}

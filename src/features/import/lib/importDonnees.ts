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

export type CibleImport = "produits" | "clients" | "fournisseurs";
export type TypeChamp = "texte" | "nombre" | "entier" | "email" | "telephone";

export interface ChampImport {
  cle: string;
  libelle: string;
  type: TypeChamp;
  obligatoire?: boolean;
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

export const LIBELLES_CIBLE: Record<CibleImport, string> = {
  produits: "produits",
  clients: "clients",
  fournisseurs: "fournisseurs",
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
  const normes = entetes.map(normaliserEntete);
  const schema = SCHEMAS_IMPORT[cible];
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

// ─── Validation et doublons ──────────────────────────────────────────

export type StatutLigne = "ok" | "erreur" | "doublon_fichier" | "doublon_existant";

export interface LigneImport {
  /** Numéro de la ligne dans le fichier (en-tête = 1), pour le rapport. */
  numero: number;
  valeurs: Record<string, string | number | null>;
  erreurs: string[];
  statut: StatutLigne;
  cle: string;
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
  }
}

/** Clés de l'existant, à passer à `preparerLignes`. */
export function clesExistantes(
  cible: CibleImport,
  existants: Record<string, string | number | null | undefined>[],
): Set<string> {
  const cles = new Set<string>();
  for (const e of existants) {
    const v = Object.fromEntries(Object.entries(e).map(([k, x]) => [k, x ?? null]));
    cles.add(cleDoublon(cible, v));
    // Un client déjà connu par son e-mail l'est aussi par son téléphone.
    if (cible === "clients") {
      if (v.email) cles.add(cleDoublon(cible, { ...v, telephone: null }));
      if (v.telephone) cles.add(cleDoublon(cible, { ...v, email: null }));
    }
  }
  cles.delete("");
  cles.delete("|");
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
        } else valeurs[champ.cle] = n;
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
    if (champ.obligatoire && (valeurs[champ.cle] === null || valeurs[champ.cle] === "")) {
      erreurs.push(`${champ.libelle} obligatoire`);
    }
  }
  return { valeurs, erreurs };
}

/**
 * Lignes du tableau → lignes vérifiées. `premiereLigne` est le numéro, dans
 * le fichier, de la première ligne de données (pour le rapport d'erreurs).
 */
export function preparerLignes(
  tableau: Tableau,
  correspondance: Correspondance,
  cible: CibleImport,
  existantes: Set<string>,
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
  existantes: Set<string>,
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
  existantes: Set<string>,
): LigneImport {
  const { valeurs, erreurs } = validerValeurs(cible, brutes);
  const cle = cleDoublon(cible, valeurs);
  let statut: StatutLigne = "ok";
  if (erreurs.length > 0) statut = "erreur";
  else if (existantes.has(cle)) statut = "doublon_existant";
  else if (vues.has(cle)) statut = "doublon_fichier";
  if (statut === "ok") vues.add(cle);
  return { numero, valeurs, erreurs, statut, cle };
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

/**
 * LE MONTANT ÉCRIT EN TOUTES LETTRES
 *
 * Une facture porte son total deux fois : en chiffres, et en lettres.
 * Ce n'est pas une coquetterie. Un « 1 » devient un « 7 » d'un trait de
 * stylo, un zéro s'ajoute sans qu'on le voie ; « trois cent trente et
 * un mille huit cents » ne se retouche pas. C'est la mention qui fait
 * foi en cas de désaccord.
 *
 * ── CE QUI REND LE FRANÇAIS PÉNIBLE ────────────────────────────────
 *
 * Trois règles d'accord, et chacune a son piège.
 *
 * « cent » et « vingt » prennent un s quand ils sont MULTIPLIÉS et
 * qu'aucun autre mot de nombre ne les suit. D'où « deux cents » mais
 * « deux cent un », « quatre-vingts » mais « quatre-vingt-un ».
 *
 * Le piège : « mille » est un mot de nombre, « million » et
 * « milliard » sont des NOMS. Donc « deux cent mille » sans s — cent
 * est suivi d'un mot de nombre — mais « deux cents millions » avec s.
 * C'est pour cela que le code ci-dessous transporte un drapeau
 * `final` de tranche en tranche plutôt que de regarder seulement la
 * dernière.
 *
 * « mille » est invariable, et ne se fait jamais précéder de « un » :
 * mille, et non « un mille ».
 *
 * Soixante-dix et quatre-vingt-dix se disent en additionnant : 71 est
 * « soixante et onze » (avec « et »), 91 est « quatre-vingt-onze »
 * (sans). Il n'y a pas de logique à retenir, seulement l'usage.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ───────────────────────────────────
 *
 * Il ne connaît pas les centimes. L'ariary n'en a pas dans l'usage
 * courant, et toute l'application compte en entiers. Un montant à
 * virgule est arrondi, ce qui est le comportement de `formatCurrency`
 * — les deux mentions du document disent donc la même chose.
 */

/** Zéro à dix-neuf, qui ne se déduisent de rien. */
const UNITES = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];

/**
 * Les dizaines. Soixante-dix et quatre-vingt-dix n'ont pas de nom
 * propre : ils s'écrivent « soixante » et « quatre-vingt » suivis
 * d'un nombre de dix à dix-neuf. D'où les répétitions aux rangs 7 et 9.
 */
const DIZAINES = [
  "",
  "",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "soixante",
  "quatre-vingt",
  "quatre-vingt",
];

/**
 * Les tranches de mille, de la plus grande à la plus petite.
 *
 * `nom` distingue les vrais noms — million, milliard, billion, qui
 * s'accordent et laissent le « cent » qui les précède s'accorder
 * aussi — de « mille », qui est un mot de nombre invariable.
 */
const TRANCHES = [
  { valeur: 1e12, mot: "billion", nom: true },
  { valeur: 1e9, mot: "milliard", nom: true },
  { valeur: 1e6, mot: "million", nom: true },
  { valeur: 1e3, mot: "mille", nom: false },
] as const;

/**
 * De zéro à quatre-vingt-dix-neuf.
 *
 * `final` dit si ce groupe termine le nombre : c'est lui qui décide
 * du s de « quatre-vingts ».
 */
function sousCent(n: number, final: boolean): string {
  if (n < 20) return UNITES[n];

  const d = Math.floor(n / 10);
  const u = n % 10;

  // Soixante-dix et quatre-vingt-dix : on additionne.
  if (d === 7 || d === 9) {
    // Seul soixante et onze prend le « et ». Quatre-vingt-onze, non.
    if (d === 7 && u === 1) return "soixante et onze";
    return `${DIZAINES[d]}-${UNITES[10 + u]}`;
  }

  // Quatre-vingts : le s ne vient que si rien ne suit.
  if (u === 0) return DIZAINES[d] + (d === 8 && final ? "s" : "");

  // Vingt et un, trente et un… mais quatre-vingt-un, sans « et ».
  if (u === 1 && d !== 8) return `${DIZAINES[d]} et un`;

  return `${DIZAINES[d]}-${UNITES[u]}`;
}

/** De zéro à neuf cent quatre-vingt-dix-neuf. */
function sousMille(n: number, final: boolean): string {
  const c = Math.floor(n / 100);
  const r = n % 100;

  if (c === 0) return sousCent(r, final);

  // « cent » et non « un cent ».
  const tete = (c > 1 ? `${UNITES[c]} ` : "") + "cent";

  // Le s de « deux cents » : multiplié, et rien derrière.
  if (r === 0) return tete + (c > 1 && final ? "s" : "");

  return `${tete} ${sousCent(r, final)}`;
}

/**
 * Un entier positif, en toutes lettres.
 *
 * Le nombre est découpé en tranches de mille, de la plus grande à la
 * plus petite. Une tranche est « finale » si aucun mot de NOMBRE ne
 * la suit — ce qui n'est pas la même chose qu'être la dernière : dans
 * « deux cent mille », la tranche 200 est suivie de « mille », donc
 * pas finale ; dans « deux cents millions », elle est suivie d'un nom,
 * donc finale, et prend son s.
 */
function entierEnLettres(n: number): string {
  if (n === 0) return "zéro";

  const morceaux: string[] = [];
  let reste = n;

  for (const tranche of TRANCHES) {
    const combien = Math.floor(reste / tranche.valeur);
    if (combien === 0) continue;
    reste %= tranche.valeur;

    if (tranche.nom) {
      // « million » est un nom : le groupe qui le précède s'accorde,
      // et le nom lui-même prend un s au pluriel.
      const tete = sousMille(combien, true);
      morceaux.push(`${tete} ${tranche.mot}${combien > 1 ? "s" : ""}`);
    } else {
      // « mille » est invariable, et ne se précède jamais de « un ».
      const tete = combien === 1 ? "" : `${sousMille(combien, false)} `;
      morceaux.push(`${tete}mille`);
    }
  }

  // Ce qui reste sous mille ferme le nombre : c'est la seule tranche
  // qui puisse être suivie de rien du tout.
  if (reste > 0) morceaux.push(sousMille(reste, true));

  return morceaux.join(" ");
}

/**
 * Le nombre en toutes lettres, sans unité.
 *
 * Arrondi à l'entier, comme l'affichage en chiffres. Au-delà de mille
 * billions on renonce : aucun montant de boutique n'y arrive, et
 * inventer un vocabulaire pour un cas qui ne se présente pas
 * ajouterait du code que rien ne vérifierait jamais.
 */
export function nombreEnLettres(valeur: number): string | null {
  if (!Number.isFinite(valeur)) return null;

  const arrondi = Math.round(valeur);
  const absolu = Math.abs(arrondi);
  if (absolu >= 1e15) return null;

  const mots = entierEnLettres(absolu);
  return arrondi < 0 ? `moins ${mots}` : mots;
}

/**
 * Le montant en toutes lettres, suivi de sa devise.
 *
 * La devise vient de la boutique (`stores.currency_symbol`), en
 * minuscules et au singulier : « ariary » est invariable, et le sigle
 * « Ar » ne s'écrit pas dans une phrase.
 *
 * Renvoie `null` quand le montant n'est pas représentable — le
 * document masque alors la mention plutôt que d'écrire une phrase
 * tronquée.
 */
export function montantEnLettres(valeur: number, devise = "ariary"): string | null {
  const mots = nombreEnLettres(valeur);
  if (mots === null) return null;

  const unite = devise.trim();
  return unite ? `${mots} ${unite}` : mots;
}

/**
 * Le nom écrit de la devise, à partir du symbole de la boutique.
 *
 * « Ar » est un sigle : personne n'écrit « trois cents Ar » dans une
 * mention légale. Les devises qu'on ne connaît pas sont reprises
 * telles quelles, en minuscules — mieux vaut un mot inhabituel qu'un
 * mot inventé.
 */
export function deviseEnToutesLettres(symbole: string | null | undefined): string {
  const s = (symbole ?? "").trim();
  if (!s) return "ariary";

  const connus: Record<string, string> = {
    ar: "ariary",
    mga: "ariary",
    "€": "euros",
    eur: "euros",
    $: "dollars",
    usd: "dollars",
    fcfa: "francs CFA",
    xof: "francs CFA",
  };

  return connus[s.toLowerCase()] ?? s.toLowerCase();
}

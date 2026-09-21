/**
 * UN CODE-BARRES QU'UNE DOUCHETTE SAIT LIRE
 *
 * ── POURQUOI PAS CELUI DE LA MAQUETTE ──────────────────────────────
 *
 * La maquette dessine le code-barres avec un dégradé CSS répétitif.
 * C'est joli, et c'est un décor : les barres ne codent rien, aucun
 * lecteur n'en tirera un numéro de vente. Sur un ticket, un
 * code-barres qui ne se lit pas est pire qu'un code-barres absent —
 * il fait perdre du temps à la caisse.
 *
 * ── POURQUOI PAS UNE BIBLIOTHÈQUE ──────────────────────────────────
 *
 * `jsbarcode` fait quarante kilooctets pour un besoin de soixante
 * lignes. Le Code 128 est une norme figée depuis 1981 : la table des
 * motifs ne changera pas, et l'écrire ici évite une dépendance de
 * plus à suivre.
 *
 * ── CODE 128, VARIANTE B ───────────────────────────────────────────
 *
 * Elle code tout l'ASCII imprimable, donc « V026 », « FAC-V026 » et
 * tout numéro que la base saura produire. La variante C serait plus
 * dense sur des chiffres seuls, mais les numéros de vente commencent
 * par une lettre : elle ne servirait à rien ici.
 *
 * Un symbole se lit : marque de départ, les caractères, une clé de
 * contrôle, la marque d'arrêt, puis une barre de fin. Chaque motif
 * vaut six chiffres qui donnent les largeurs successives des barres
 * et des blancs, en modules.
 */

/**
 * Les 107 motifs de la norme. Index 0 à 102 : les caractères.
 * 103, 104, 105 : les trois marques de départ. 106 : l'arrêt.
 */
const MOTIFS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

/** La marque de départ de la variante B, et celle d'arrêt. */
const DEPART_B = 104;
const ARRET = 106;

/**
 * Les largeurs de barres et de blancs d'un texte, en modules.
 *
 * Rend `null` si le texte contient un caractère que la variante B ne
 * sait pas coder — un accent, par exemple. Mieux vaut pas de
 * code-barres qu'un code-barres faux : un numéro mal lu à la caisse
 * renvoie vers la mauvaise vente.
 */
export function modulesCode128(texte: string): number[] | null {
  const valeurs: number[] = [];
  for (const c of texte) {
    const code = c.codePointAt(0) ?? 0;
    // La variante B couvre l'espace (32) au tilde (126).
    if (code < 32 || code > 126) return null;
    valeurs.push(code - 32);
  }
  if (valeurs.length === 0) return null;

  /*
   * La clé de contrôle : la marque de départ, plus chaque valeur
   * multipliée par son rang à partir de un, le tout modulo 103.
   * C'est elle qui permet au lecteur de refuser une lecture douteuse
   * plutôt que de rendre un numéro inventé.
   */
  let somme = DEPART_B;
  valeurs.forEach((v, i) => {
    somme += v * (i + 1);
  });
  const cle = somme % 103;

  const suite = [DEPART_B, ...valeurs, cle, ARRET];
  const largeurs: number[] = [];
  for (const index of suite) {
    for (const chiffre of MOTIFS[index]) largeurs.push(Number(chiffre));
  }
  // La barre de fin, imposée par la norme : deux modules.
  largeurs.push(2);
  return largeurs;
}

export interface CodeBarres {
  /** Les rectangles noirs, en modules depuis la gauche. */
  barres: { x: number; largeur: number }[];
  /** La largeur totale du symbole, en modules. */
  largeur: number;
}

/**
 * Le dessin d'un code-barres, prêt à poser dans un `<svg>`.
 *
 * On ne rend que les barres NOIRES : les blancs sont le fond. Les
 * largeurs sont en modules, à charge de l'affichage de choisir
 * combien de millimètres vaut un module — c'est ce qui permet au même
 * calcul de servir sur un rouleau de 58 et sur un de 80 mm.
 */
export function dessinerCode128(texte: string): CodeBarres | null {
  const largeurs = modulesCode128(texte);
  if (!largeurs) return null;

  const barres: { x: number; largeur: number }[] = [];
  let x = 0;
  largeurs.forEach((l, i) => {
    // Une largeur sur deux est une barre : la suite commence par une
    // barre, d'où les rangs pairs.
    if (i % 2 === 0) barres.push({ x, largeur: l });
    x += l;
  });

  return { barres, largeur: x };
}

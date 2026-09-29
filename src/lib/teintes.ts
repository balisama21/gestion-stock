/**
 * LA COULEUR D'UNE VIGNETTE D'IDENTITÉ
 *
 * Un vendeur, un client, un produit sans photo : chacun porte son
 * initiale sur une pastille colorée. La couleur vient du NOM, jamais
 * du hasard.
 *
 * POURQUOI PAS AU HASARD. La même personne, le même article doit garder
 * sa teinte d'un chargement à l'autre, et de la liste au détail. Une
 * couleur tirée au sort à chaque rendu se lit comme une information et
 * n'en est pas une : l'œil croit qu'elle veut dire quelque chose, et
 * il apprend à ne plus s'y fier.
 *
 * POURQUOI ONZE. Il y en avait six, ce qui suffisait pour une poignée
 * de vendeurs mais pas pour un catalogue : sur huit produits, trois
 * tombaient déjà sur le même rouge. Onze écarte les collisions sans
 * transformer la colonne en nuancier.
 *
 * ONZE ET NON DOUZE, parce que onze est PREMIER. La teinte se choisit
 * par un modulo sur la somme des caractères ; avec un nombre composé,
 * les noms dont la somme partage un facteur avec lui se répartissent
 * mal et certaines teintes ne sortent presque jamais. Un premier
 * n'a pas ce défaut.
 *
 * TOUTES PORTENT DU BLANC LISIBLE. Chacune a été mesurée : le rapport
 * de contraste du blanc sur chacune va de 5,00 à 7,94 pour un seuil de
 * 4,5. L'ambre d'origine (`#B06F12`) ne donnait que 4,09 et a été
 * assombri en `#9A6110`, qui monte à 5,13 sans changer d'allure.
 *
 * ELLES RESTENT SOURDES, pour ne pas concurrencer le vert de la marque,
 * qui demeure la seule couleur d'action. La première EST ce vert.
 *
 * CE N'EST PAS UNE COULEUR DE STATUT. Rouge, orange, bleu et violet
 * restent réservés aux badges de statut partout ailleurs dans
 * l'application. Ici la couleur sert à RECONNAÎTRE, pas à qualifier :
 * elle ne dit rien de l'état de la ligne, et personne ne doit y lire un
 * avertissement.
 */
const TEINTES = [
  "#0E7C5A", // le vert de la marque
  "#3A72A6", // bleu
  "#9A6110", // ambre
  "#8A5A9E", // prune
  "#6B4A2E", // brun
  "#C0473A", // brique
  "#0F6E74", // sarcelle
  "#4C5BA6", // indigo
  "#5F6B24", // olive
  "#A8456B", // rose sombre
  "#4A5568", // ardoise
];

/**
 * La teinte d'un nom. Stable, et la même partout.
 *
 * La somme des codes de caractères, repliée modulo un nombre premier
 * avant le modulo final : sans ce premier repli, deux noms de même
 * longueur aux lettres voisines tomberaient trop souvent sur la même
 * couleur.
 */
export function teinteDe(nom: string): string {
  let somme = 0;
  for (let i = 0; i < nom.length; i++) somme = (somme + nom.charCodeAt(i)) % 997;
  return TEINTES[somme % TEINTES.length];
}

/**
 * Les couleurs des avatars de personnes : clients, vendeurs, équipe.
 * Plus franches que `TEINTES`, pour qu'on reconnaisse quelqu'un d'un
 * coup d'œil, et toutes lisibles en blanc (contraste de 4,4 à 7).
 */
const TEINTES_AVATAR = [
  "#5B5BD6", // bleu-violet
  "#2F6FDB", // bleu
  "#C23B70", // rose
  "#0B7F57", // vert
  "#B5530F", // orange
  "#8B4FC9", // violet
  "#0B7C8A", // sarcelle
  "#7A4E3A", // brun
  "#C8473B", // brique
  "#4F5E7A", // ardoise
  "#3E7B2E", // olive
];

/** Un nom ramené à sa forme stable : sans accents, casse ni espaces parasites. */
export const cleDeNom = (nom: string): string =>
  nom.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

/** Un condensé FNV-1a : deux noms voisins tombent rarement sur la même case. */
export function condense(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** La couleur d'avatar d'une personne, la même sur tous les écrans. */
export function teinteAvatar(nom: string): string {
  return TEINTES_AVATAR[condense(cleDeNom(nom)) % TEINTES_AVATAR.length];
}

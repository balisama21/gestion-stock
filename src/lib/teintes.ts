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

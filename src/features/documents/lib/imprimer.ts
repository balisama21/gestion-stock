/**
 * Lance l'impression d'un document v2.
 *
 * `print.css` déclare `@page { size: A4; margin: 0 }` : une feuille
 * n'a donc rien à injecter, ses marges vivant dans le bloc lui-même.
 *
 * UN ROULEAU, SI. Sa hauteur est indéterminée — c'est le pilote qui
 * coupe au bout du contenu —, et sa largeur n'est pas celle d'une
 * A4. La règle est posée le temps de l'appel puis retirée : une
 * `@page` laissée en place ferait sortir la facture suivante sur
 * 80 mm de large.
 *
 * L'application garde sa propre fonction `imprimerDocument`
 * (`src/lib/documentExport.ts`), qui pose des marges de page : elle
 * sert aux documents de la v1, dont les marges ne sont pas dans le
 * bloc. Les deux coexistent tant que le drapeau existe.
 *
 * Fichier à part et non dans `DocumentPreview` : un module qui
 * exporte à la fois un composant et une fonction casse le
 * rechargement à chaud de React.
 */
export function imprimerFeuille(largeurRouleauMm?: number): void {
  if (!largeurRouleauMm) {
    window.print();
    return;
  }

  const style = document.createElement("style");
  style.textContent = `@media print { @page { size: ${largeurRouleauMm}mm auto; margin: 0 } }`;
  document.head.appendChild(style);
  try {
    window.print();
  } finally {
    style.remove();
  }
}

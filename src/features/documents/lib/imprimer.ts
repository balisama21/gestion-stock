/**
 * Lance l'impression d'une feuille.
 *
 * `print.css` déclare déjà `@page { size: A4; margin: 0 }` : il n'y a
 * rien à injecter pour un document A4, dont les marges vivent DANS la
 * feuille. Le ticket, lui, devra poser sa propre taille de page ;
 * c'est le rôle du paramètre, laissé pour la phase du ticket.
 *
 * L'application garde sa propre fonction `imprimerDocument`
 * (`src/lib/documentExport.ts`), qui pose des marges de page : elle
 * sert aux documents de la v1, dont les marges ne sont pas dans le
 * bloc. Les deux doivent coexister tant que le drapeau existe.
 *
 * Fichier à part et non dans `DocumentPreview` : un module qui
 * exporte à la fois un composant et une fonction casse le
 * rechargement à chaud de React.
 */
export function imprimerFeuille(): void {
  window.print();
}

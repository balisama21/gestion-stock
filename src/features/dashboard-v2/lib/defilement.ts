/**
 * ALLER À UNE CARTE, ET LA MONTRER
 *
 * Une puce d'attention dit « 3 produits à recommander » ; le clic doit
 * conduire à la carte qui les liste. Le défilement seul ne suffit pas :
 * arrivé en bas, l'œil doit retrouver laquelle des quinze cartes a
 * répondu. Le clignotement d'une seconde le dit sans écrire un mot.
 */
export function allerALaCarte(id: string): void {
  const carte = document.getElementById(id);
  if (!carte) return;
  const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  carte.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "center" });
  carte.classList.remove("flash");
  // Forcer un calcul de style entre le retrait et la pose : sans cela le
  // navigateur ne voit aucun changement et ne rejoue pas l'animation.
  void carte.offsetWidth;
  carte.classList.add("flash");
}

import { useEffect } from "react";

/**
 * Publie la position de défilement dans une variable CSS.
 *
 * Tout le mouvement lié au défilement s'exprime ensuite en CSS, à partir
 * de `--defilement` : les transformations sont alors calculées par le
 * compositeur, sans repasser par React à chaque pixel parcouru.
 *
 * L'écoute est passive et l'écriture repoussée à la frame suivante. Sans
 * cette double précaution, un défilement au doigt sur un téléphone
 * d'entrée de gamme fait rendre la page des dizaines de fois par seconde
 * et l'animation devient saccadée — précisément l'inverse de l'effet
 * recherché.
 *
 * Aucune écoute n'est posée si les animations sont refusées.
 */
export function useDefilement(): void {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let enAttente = false;
    const publier = () => {
      document.documentElement.style.setProperty("--defilement", String(window.scrollY));
      enAttente = false;
    };
    const surDefilement = () => {
      if (enAttente) return;
      enAttente = true;
      requestAnimationFrame(publier);
    };

    publier();
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      window.removeEventListener("scroll", surDefilement);
      document.documentElement.style.removeProperty("--defilement");
    };
  }, []);
}

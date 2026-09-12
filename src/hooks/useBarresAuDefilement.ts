import { useEffect, useRef, useState } from "react";

/**
 * Les barres de navigation s'effacent quand on descend, reviennent dès
 * qu'on remonte.
 *
 * C'est le geste qu'on connaît des applications sociales : sur un écran
 * de téléphone, la barre du haut et celle du bas mangent ensemble près
 * de 130 pixels, soit un cinquième de la hauteur utile. Tant qu'on lit
 * une liste, elles ne servent à rien ; dès qu'on cherche à aller
 * ailleurs, on remonte — et c'est précisément ce geste qui les rappelle.
 *
 * Trois précautions, qui font la différence entre un effet agréable et
 * une barre qui clignote :
 *
 * — un seuil. Le doigt ne défile jamais en ligne droite ; sans seuil, le
 *   moindre tremblement ferait battre les barres. On cumule donc les
 *   déplacements de même sens et on n'agit qu'au-delà. Le seuil de
 *   retour est volontairement plus petit que celui de départ : cacher
 *   demande une intention, revenir doit être immédiat.
 * — le sommet de page. Au-dessus de la zone haute, les barres restent,
 *   quoi qu'il arrive. Une page qu'on vient d'ouvrir montre toujours sa
 *   navigation.
 * — les pages courtes. Si le document dépasse à peine l'écran, masquer
 *   ne libère rien et fait disparaître la navigation sans contrepartie.
 *   On s'abstient.
 *
 * Le calcul se fait dans une frame d'animation et l'écoute est passive :
 * la lecture de `scrollY` ne bloque jamais le défilement lui-même.
 */

/** Descente cumulée, en pixels, avant de masquer. */
const SEUIL_DEPART = 12;
/** Remontée cumulée, en pixels, avant de faire revenir. */
const SEUIL_RETOUR = 4;
/** Sous cette hauteur de page, les barres ne bougent pas. */
const ZONE_HAUTE = 72;
/** Une page qui ne dépasse pas l'écran de cette marge ne masque rien. */
const HAUTEUR_MINIMALE = 240;

export function useBarresAuDefilement(actif: boolean = true): boolean {
  const [masquees, setMasquees] = useState(false);
  const dernierY = useRef(0);
  const cumul = useRef(0);
  const enAttente = useRef(false);

  useEffect(() => {
    if (!actif) {
      setMasquees(false);
      return;
    }

    dernierY.current = window.scrollY;
    cumul.current = 0;

    const mesurer = () => {
      enAttente.current = false;
      const y = window.scrollY;
      const delta = y - dernierY.current;
      dernierY.current = y;
      if (delta === 0) return;

      const course = document.documentElement.scrollHeight - window.innerHeight;

      // Rebond élastique iOS : au-delà des bornes, on ne décide rien.
      if (y >= course) return;

      if (course < HAUTEUR_MINIMALE || y <= ZONE_HAUTE) {
        cumul.current = 0;
        setMasquees(false);
        return;
      }

      // Un changement de sens repart de zéro : sans cela, une longue
      // descente laisserait un crédit qui retarderait la remontée.
      if (Math.sign(delta) !== Math.sign(cumul.current)) cumul.current = 0;
      cumul.current += delta;

      if (cumul.current > SEUIL_DEPART) setMasquees(true);
      else if (cumul.current < -SEUIL_RETOUR) setMasquees(false);
    };

    const auDefilement = () => {
      if (enAttente.current) return;
      enAttente.current = true;
      window.requestAnimationFrame(mesurer);
    };

    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => window.removeEventListener("scroll", auDefilement);
  }, [actif]);

  return masquees;
}

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
 *
 * ── POURQUOI CES TROIS PRÉCAUTIONS NE SUFFISAIENT PAS ──
 *
 * Elles vivaient toutes DANS le gestionnaire de défilement. Sur une page
 * trop courte pour défiler, ce gestionnaire ne s'exécute jamais : les
 * barres restaient donc masquées telles qu'on les avait laissées sur la
 * page précédente, et plus rien ne pouvait les rappeler — il n'y avait
 * même pas de quoi remonter. La navigation disparaissait pour de bon.
 *
 * Deux corrections, qui couvrent les deux façons dont la page change
 * sous les barres :
 *
 * — ON CHANGE D'ÉCRAN. La `cle` remet les barres en place. C'est ce que
 *   promettait déjà « une page qu'on vient d'ouvrir montre toujours sa
 *   navigation », sauf que rien ne l'appliquait : l'en-tête reste monté
 *   d'un onglet à l'autre, donc l'état aussi, et l'application ne
 *   remonte pas en haut de page en changeant d'onglet.
 * — LE CONTENU CHANGE DE HAUTEUR SANS QU'ON DÉFILE : des données qui
 *   arrivent, un filtre qui ramène la liste à deux lignes. Un
 *   `ResizeObserver` reprend alors la mesure.
 *
 * La vérification de hauteur est par ailleurs passée DEVANT la garde du
 * rebond élastique. Ce n'était pas la cause — mesuré, le cas ne passait
 * pas par là —, mais `y >= course` est vrai dès que la page ne défile
 * pas, et il ne faut pas qu'une garde puisse un jour sauter la règle
 * des pages courtes.
 */

/** Descente cumulée, en pixels, avant de masquer. */
const SEUIL_DEPART = 12;
/** Remontée cumulée, en pixels, avant de faire revenir. */
const SEUIL_RETOUR = 4;
/** Sous cette hauteur de page, les barres ne bougent pas. */
const ZONE_HAUTE = 72;
/** Une page qui ne dépasse pas l'écran de cette marge ne masque rien. */
const HAUTEUR_MINIMALE = 240;

export function useBarresAuDefilement(actif: boolean = true, cle?: string | number): boolean {
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
    // On arrive sur un écran : sa navigation est visible, toujours.
    setMasquees(false);

    /** Ce qu'il reste à parcourir sous l'écran. */
    const course = () => document.documentElement.scrollHeight - window.innerHeight;

    /**
     * Une page trop courte ne masque rien — et défait ce qu'une page
     * plus longue avait masqué avant elle. Rend `true` quand elle a
     * tranché, pour que l'appelant s'arrête là.
     */
    const pageTropCourte = () => {
      if (course() >= HAUTEUR_MINIMALE) return false;
      cumul.current = 0;
      setMasquees(false);
      return true;
    };

    const mesurer = () => {
      enAttente.current = false;
      if (pageTropCourte()) return;

      const y = window.scrollY;
      const delta = y - dernierY.current;
      dernierY.current = y;
      if (delta === 0) return;

      // Rebond élastique iOS : au-delà des bornes, on ne décide rien.
      if (y >= course()) return;

      if (y <= ZONE_HAUTE) {
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

    // Le corps du document grandit et rétrécit avec son contenu : c'est
    // lui qu'on surveille, et non l'élément racine, dont la hauteur
    // reste celle de l'écran tant que rien ne déborde.
    const observateur = new ResizeObserver(() => pageTropCourte());
    observateur.observe(document.body);

    return () => {
      window.removeEventListener("scroll", auDefilement);
      observateur.disconnect();
    };
  }, [actif, cle]);

  return masquees;
}

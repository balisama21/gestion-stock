import { useEffect, type RefObject } from "react";

/**
 * FERMER UN PANNEAU QUAND ON CLIQUE AILLEURS
 *
 * Le procédé habituel dans ce projet était un voile invisible tendu sur
 * tout l'écran, qui se chargeait du clic. Il a deux défauts, et le
 * panneau de notifications les avait tous les deux.
 *
 * IL NE COUVRE QUE CE QUI EST EN DESSOUS DE LUI. Le voile était posé en
 * `z-40`. La barre latérale et la barre du bas sont en `z-50` : elles
 * passaient par-dessus, et cliquer dessus ne fermait rien. Sur
 * ordinateur, c'est toute la navigation de gauche ; sur téléphone,
 * c'est la barre du bas. Autrement dit, la moitié des endroits où l'on
 * clique naturellement pour « passer à autre chose ».
 *
 * IL AVALE LE CLIC. Même là où il fonctionnait, il fallait cliquer deux
 * fois : une fois pour fermer, une fois pour faire ce qu'on voulait.
 *
 * Cette écoute-ci n'a ni l'un ni l'autre défaut. Elle ne dépend d'aucun
 * empilement, et elle laisse le clic arriver à destination : on ferme
 * le panneau ET on ouvre l'écran visé, du même geste. C'est le
 * comportement des panneaux de notification qu'on connaît.
 *
 * POURQUOI `pointerdown` ET NON `click`. `pointerdown` part dès que le
 * doigt touche, avant que le `click` ne se forme. Le panneau est donc
 * déjà refermé quand l'élément visé reçoit son clic — sans quoi on
 * verrait le panneau disparaître après coup, avec un temps de retard
 * visible. Il couvre aussi la souris, le tactile et le stylet d'un seul
 * écouteur.
 *
 * POURQUOI EN PHASE DE CAPTURE. Un élément qui arrête la propagation de
 * son propre `pointerdown` — cela arrive dans les listes qu'on fait
 * glisser — empêcherait sinon la fermeture. En capture, on est prévenu
 * avant lui.
 *
 * LA ZONE EST LE PARENT COMMUN DU BOUTON ET DU PANNEAU. C'est important :
 * si le bouton d'ouverture restait « à l'extérieur », cliquer dessus
 * pour refermer déclencherait deux choses à la fois — cette écoute qui
 * ferme, puis le bouton qui rouvre — et le panneau ne se fermerait
 * jamais.
 */
export function useClicExterieur(
  zone: RefObject<HTMLElement | null>,
  actif: boolean,
  fermer: () => void,
): void {
  useEffect(() => {
    if (!actif) return;

    const surPointeur = (e: PointerEvent) => {
      const cible = e.target;
      if (cible instanceof Node && zone.current?.contains(cible)) return;
      fermer();
    };

    // Échap ferme aussi : c'est ce qu'attend une personne au clavier, et
    // cela évite de devoir viser une zone vide pour sortir.
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };

    document.addEventListener("pointerdown", surPointeur, true);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("pointerdown", surPointeur, true);
      document.removeEventListener("keydown", surTouche);
    };
  }, [zone, actif, fermer]);
}

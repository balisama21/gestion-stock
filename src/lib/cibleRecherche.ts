import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ActiveTab } from "../types";

/**
 * ALLER DE LA NOTIFICATION À LA LIGNE DONT ELLE PARLE
 *
 * Cliquer sur « Vente 4 500 Ar » ouvrait l'écran Ventes, et vous
 * laissait devant la liste entière. Il fallait retrouver à la main la
 * ligne que la notification venait pourtant de décrire. Une
 * notification qui ne mène qu'à la bonne page fait faire deux fois le
 * même chemin.
 *
 * COMMENT ON Y VA. Chaque notification porte désormais une référence —
 * « V025 », « ACH013 », « P023 » — et le clic ouvre l'écran avec sa
 * recherche déjà remplie dessus. La liste n'affiche plus qu'une ligne :
 * celle dont on parlait.
 *
 * POURQUOI LA RECHERCHE, ET PAS UNE FICHE QUI S'OUVRE. Les quinze
 * écrans ne se ressemblent pas : certains ont un panneau de détail,
 * d'autres une sélection, d'autres rien du tout. Écrire une mise au
 * point dans chacun, sur une application dont un commerçant se sert
 * tous les jours, c'est quinze occasions de casser quelque chose. La
 * recherche existe déjà partout, et elle cherche déjà sur le numéro
 * court — vérifié sur Ventes, Achats, Dépenses et Produits. Une ligne
 * par écran suffit, et le comportement est le même partout.
 *
 * POURQUOI UN CONTEXTE ET NON DES PROPRIÉTÉS. L'information ne sert
 * qu'au moment du clic, mais elle devrait traverser une coquille de
 * deux mille lignes pour atteindre chaque écran. Le contexte laisse
 * chacun s'abonner en une ligne, et ceux qui ne s'abonnent pas ne
 * changent pas d'un caractère.
 *
 * POURQUOI L'ÉTAT EST TENU PLUS HAUT QUE LA COQUILLE. Le rendu de
 * `AppInner` tient dans un seul arbre : y glisser une balise de plus
 * décalerait six cents lignes d'indentation, et noierait une correction
 * de dix lignes dans un diff illisible. Posé autour d'`AppInner`, le
 * fournisseur n'enveloppe qu'une ligne.
 */

export interface CibleRecherche {
  /** L'écran visé. Un écran ne réagit qu'à ce qui le concerne. */
  onglet: ActiveTab;
  /** Ce qu'on tape dans sa recherche : « V025 », « Huile »… */
  texte: string;
  /**
   * Un filtre à poser en arrivant, quand la notification parle d'un
   * ENSEMBLE plutôt que d'une ligne.
   *
   * « 4 produits approchent de leur seuil » n'a pas de référence à
   * viser : ce qu'il faut ouvrir, c'est la liste de ces quatre-là. Une
   * recherche ne sait pas le faire, un filtre oui.
   *
   * Chaque écran décide de ce que la valeur veut dire chez lui ; ceux
   * qui ne s'y abonnent pas l'ignorent.
   */
  filtre?: string;
  /**
   * Change à chaque clic, même vers la même ligne.
   *
   * Sans elle, revenir deux fois sur la même notification ne referait
   * rien la seconde fois si la recherche a été effacée entre-temps : la
   * valeur serait identique, et l'effet ne se redéclencherait pas.
   */
  cle: number;
}

export interface ValeurCibleRecherche {
  cible: CibleRecherche | null;
  viser: (onglet: ActiveTab, texte: string, filtre?: string) => void;
}

export const contexteCibleRecherche = createContext<ValeurCibleRecherche>({
  cible: null,
  viser: () => {},
});

/**
 * Pour celui qui tient l'état — la racine de l'application.
 *
 *     const cibleRecherche = useEtatCibleRecherche();
 *     <contexteCibleRecherche.Provider value={cibleRecherche}>
 */
export function useEtatCibleRecherche(): ValeurCibleRecherche {
  const [cible, setCible] = useState<CibleRecherche | null>(null);

  const viser = useCallback((onglet: ActiveTab, texte: string, filtre?: string) => {
    setCible((avant) => ({ onglet, texte, filtre, cle: (avant?.cle ?? 0) + 1 }));
  }, []);

  return useMemo(() => ({ cible, viser }), [cible, viser]);
}

/**
 * Le geste, pour celui qui le déclenche : la cloche.
 *
 * Il ne change PAS d'écran — c'est la coquille qui sait le faire. Les
 * deux se combinent là où `setActiveTab` est à portée.
 */
export function useViserLigne(): (onglet: ActiveTab, texte: string, filtre?: string) => void {
  return useContext(contexteCibleRecherche).viser;
}

/**
 * L'abonnement, pour celui qui reçoit : un écran.
 *
 *     useRechercheInitiale("ventes", setSearchQuery);
 *
 * Ne fait rien tant que personne ne vise cet écran. L'effet ne dépend
 * que de la clé : la fonction passée peut donc être recréée à chaque
 * rendu sans relancer quoi que ce soit.
 */
export function useRechercheInitiale(onglet: ActiveTab, appliquer: (texte: string) => void): void {
  const { cible } = useContext(contexteCibleRecherche);
  const pourMoi = cible?.onglet === onglet;
  const texte = pourMoi ? cible.texte : null;
  const cle = pourMoi ? cible.cle : null;

  useEffect(() => {
    if (texte === null) return;
    appliquer(texte);
    // `appliquer` est volontairement hors des dépendances : c'est un
    // setter d'état, stable en pratique, et l'y mettre relancerait la
    // recherche à chaque rendu de la vue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte, cle]);
}

/**
 * Le même abonnement, pour un FILTRE plutôt qu'une recherche.
 *
 *     useFiltreInitial("produits", setStockFilter);
 *
 * Ne fait rien tant que personne ne vise cet écran AVEC un filtre : une
 * notification qui pointe une ligne précise n'en porte pas, et laisse
 * donc le filtre de l'écran tel que l'utilisateur l'avait réglé.
 */
export function useFiltreInitial(onglet: ActiveTab, appliquer: (filtre: string) => void): void {
  const { cible } = useContext(contexteCibleRecherche);
  const pourMoi = cible?.onglet === onglet && cible.filtre !== undefined;
  const filtre = pourMoi ? (cible.filtre ?? null) : null;
  const cle = pourMoi ? cible.cle : null;

  useEffect(() => {
    if (filtre === null) return;
    appliquer(filtre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre, cle]);
}

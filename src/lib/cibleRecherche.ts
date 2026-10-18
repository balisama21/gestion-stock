import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/**
 * Le « filtre » qui demande à un écran d'ouvrir son formulaire de
 * création — « Ajouter un fournisseur » depuis le tableau de bord ouvre
 * le formulaire, pas seulement la liste.
 */
export const FILTRE_CREATION = "nouveau";

export interface CibleRecherche {
  /** L'écran visé. Un écran ne réagit qu'à ce qui le concerne. */
  onglet: ActiveTab;
  /**
   * Ce qu'on tape dans sa recherche : « V025 », « Huile »… Vide quand on
   * ouvre une fiche par son identifiant : la recherche est alors VIDÉE,
   * pour ne pas laisser un filtre d'une visite précédente sous la fiche.
   */
  texte: string;
  /**
   * Un filtre à poser en arrivant, quand la notification parle d'un
   * ENSEMBLE plutôt que d'une ligne (« 4 produits sous le seuil »).
   * Chaque écran décide de ce que la valeur veut dire chez lui.
   */
  filtre?: string;
  /**
   * L'identifiant de l'enregistrement dont parle la notification. L'écran
   * ouvre directement sa fiche ; s'il ne la trouve plus (supprimée, ou
   * hors de portée), il le dit au lieu d'afficher une liste vide.
   */
  id?: string;
  /** Change à chaque clic, même vers la même ligne. */
  cle: number;
}

export interface ValeurCibleRecherche {
  cible: CibleRecherche | null;
  viser: (onglet: ActiveTab, texte: string, filtre?: string, id?: string) => void;
  /**
   * Ce qui a déjà été appliqué, par écran et par nature (recherche,
   * filtre, fiche). Une visée ne s'applique QU'UNE FOIS : sans cela,
   * revenir sur l'écran Ventes par le menu, une heure plus tard,
   * remettait « V023 » dans sa recherche, et la liste paraissait vide.
   */
  appliquees: Map<string, number>;
}

export const contexteCibleRecherche = createContext<ValeurCibleRecherche>({
  cible: null,
  viser: () => {},
  appliquees: new Map(),
});

/**
 * Pour celui qui tient l'état — la racine de l'application.
 *
 *     const cibleRecherche = useEtatCibleRecherche();
 *     <contexteCibleRecherche.Provider value={cibleRecherche}>
 */
export function useEtatCibleRecherche(): ValeurCibleRecherche {
  const [cible, setCible] = useState<CibleRecherche | null>(null);
  const appliquees = useRef(new Map<string, number>()).current;

  const viser = useCallback((onglet: ActiveTab, texte: string, filtre?: string, id?: string) => {
    setCible((avant) => ({ onglet, texte, filtre, id, cle: (avant?.cle ?? 0) + 1 }));
  }, []);

  return useMemo(() => ({ cible, viser, appliquees }), [cible, viser, appliquees]);
}

/**
 * Le geste, pour celui qui le déclenche : la cloche.
 *
 * Il ne change PAS d'écran — c'est la coquille qui sait le faire. Les
 * deux se combinent là où `setActiveTab` est à portée.
 */
export function useViserLigne(): ValeurCibleRecherche["viser"] {
  return useContext(contexteCibleRecherche).viser;
}

/**
 * Le cœur commun : appelle `appliquer` une seule fois par visée, pour un
 * écran et une nature donnés. `valeur` vaut `undefined` quand la visée
 * ne porte rien de cette nature.
 */
function useAppliquerUneFois<T>(
  onglet: ActiveTab,
  nature: string,
  lire: (c: CibleRecherche) => T | undefined,
  appliquer: (v: T) => void,
): void {
  const { cible, appliquees } = useContext(contexteCibleRecherche);
  const pourMoi = cible?.onglet === onglet ? cible : null;
  const valeur = pourMoi ? lire(pourMoi) : undefined;
  const cle = pourMoi && valeur !== undefined ? pourMoi.cle : null;

  useEffect(() => {
    if (cle === null || valeur === undefined) return;
    const k = `${onglet}:${nature}`;
    if (appliquees.get(k) === cle) return;
    appliquees.set(k, cle);
    appliquer(valeur);
    // `appliquer` est volontairement hors des dépendances : c'est un
    // setter d'état ou une fonction recréée à chaque rendu, et l'y mettre
    // relancerait l'effet sans raison. La clé suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
}

/**
 * L'abonnement, pour celui qui reçoit : un écran.
 *
 *     useRechercheInitiale("ventes", setSearchQuery);
 */
export function useRechercheInitiale(onglet: ActiveTab, appliquer: (texte: string) => void): void {
  useAppliquerUneFois(onglet, "recherche", (c) => c.texte, appliquer);
}

/**
 * Le même abonnement, pour un FILTRE plutôt qu'une recherche. Une
 * notification qui pointe une ligne précise n'en porte pas, et laisse
 * donc le filtre de l'écran tel que l'utilisateur l'avait réglé.
 */
export function useFiltreInitial(onglet: ActiveTab, appliquer: (filtre: string) => void): void {
  useAppliquerUneFois(onglet, "filtre", (c) => c.filtre, appliquer);
}

/**
 * La fiche à ouvrir, pour un écran qui sait en ouvrir une.
 *
 *     useFicheInitiale("clients", (id) => {
 *       const c = clients.find((x) => x.id === id);
 *       c ? setSelection(c) : setIntrouvable(true);
 *     });
 */
export function useFicheInitiale(onglet: ActiveTab, ouvrir: (id: string) => void): void {
  useAppliquerUneFois(onglet, "fiche", (c) => c.id, ouvrir);
}

/**
 * La même chose pour un écran bâti sur `DataList` : rend de quoi passer à
 * sa propriété `ouvrir`. `resoudre` traduit l'identifiant en ligne de
 * liste, ou rend `null` si l'enregistrement n'existe plus.
 */
export function useOuvertureFiche<I>(
  onglet: ActiveTab,
  resoudre: (id: string) => I | null,
): { cle: number; item: I | null } | null {
  const [ouverture, setOuverture] = useState<{ cle: number; item: I | null } | null>(null);
  useFicheInitiale(onglet, (id) =>
    setOuverture((avant) => ({ cle: (avant?.cle ?? 0) + 1, item: resoudre(id) })),
  );
  return ouverture;
}

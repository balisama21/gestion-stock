import { useCallback, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { moduleMasque, usePersonnalisation } from "../../../lib/personnalisation";
import {
  getModuleScope,
  isFieldVisible,
  isModuleVisible,
  isWidgetVisible,
  type DataScope,
} from "../../../lib/permissions";
import { CARTES, TUILES, type CleCarte, type CleTuile, type BesoinDonnees } from "../registry";
import { VUES, VUE_PAR_CLE, vueDuRole, type CleVue } from "../roles";

/**
 * QUI VOIT QUOI
 *
 * Trois sources, appliquées dans cet ordre (voir `registry.ts`) :
 * la boutique a-t-elle gardé le module, la personne a-t-elle le droit
 * de le voir, la vue choisie le retient-elle.
 *
 * LE PROPRIÉTAIRE PASSE LES DEUX PREMIERS FILTRES SANS LES LIRE.
 * `memberPermissionsDetailed` vaut `null` pour lui — il n'a pas de
 * ligne dans `store_members`, il possède la boutique. Un `null`
 * traité comme un objet vide lui masquerait tout son tableau de bord.
 *
 * CE QUI EST FILTRÉ ICI EST L'AFFICHAGE, PAS LA DONNÉE. Les règles de
 * lecture de la base ont déjà fait leur tri en amont : un collaborateur
 * en portée « mes données » ne reçoit que ses propres lignes. Ce hook
 * décide ce qu'on montre de ce qui est déjà arrivé, il ne remplace
 * aucune sécurité.
 */

export interface DroitsDashboard {
  estProprietaire: boolean;
  /** La vue affichée. */
  vue: CleVue;
  changerDeVue: (v: CleVue) => void;
  /** Les vues qu'on peut choisir. Un membre n'a que la sienne. */
  vuesDisponibles: CleVue[];
  /** La carte franchit-elle les trois filtres ? */
  carteVisible: (cle: CleCarte) => boolean;
  tuileVisible: (cle: CleTuile) => boolean;
  /** Les cartes retenues, déjà dans l'ordre de la vue. */
  cartes: CleCarte[];
  tuiles: CleTuile[];
  /** Ce qu'il faut lire pour ces cartes-là, et rien de plus. */
  besoins: Set<BesoinDonnees>;
  /** « mes données » ou « toutes » pour un module donné. */
  portee: (module: string) => DataScope;
  /** Un montant qu'on n'a pas le droit de voir s'affiche « ••• Ar ». */
  champVisible: (module: string, champ: string) => boolean;
}

/** Ce qui remplace un montant interdit. */
export const MONTANT_MASQUE = "••• Ar";

export function useDashboardPermissions(): DroitsDashboard {
  const workspace = useWorkspace();
  const perso = usePersonnalisation();

  const estProprietaire = workspace.isOwner;
  const perms = workspace.memberPermissionsDetailed;

  const [vueChoisie, setVueChoisie] = useState<CleVue | null>(null);
  const vueParDefaut = vueDuRole(workspace.memberRole, estProprietaire);
  const vue = vueChoisie ?? vueParDefaut;

  /** Le propriétaire peut regarder l'écran tel que le verra son équipe. */
  const vuesDisponibles = useMemo<CleVue[]>(
    () => (estProprietaire ? VUES.map((v) => v.cle) : [vueParDefaut]),
    [estProprietaire, vueParDefaut],
  );

  const moduleAutorise = useCallback(
    (module: string, widget?: string) => {
      // 1. La boutique a-t-elle gardé ce module ?
      if (moduleMasque(perso, module)) return false;
      // 2. Cette personne a-t-elle le droit de le voir ?
      if (estProprietaire || !perms) return true;
      if (!isModuleVisible(perms, module)) return false;
      if (widget && !isWidgetVisible(perms, widget)) return false;
      return true;
    },
    [perso, estProprietaire, perms],
  );

  const champVisible = useCallback(
    (module: string, champ: string) => {
      if (estProprietaire || !perms) return true;
      return isFieldVisible(perms, module, champ);
    },
    [estProprietaire, perms],
  );

  const carteVisible = useCallback(
    (cle: CleCarte) => {
      const def = CARTES.find((c) => c.cle === cle);
      if (!def) return false;
      if (!moduleAutorise(def.module, def.widget)) return false;
      if (def.champRequis && !champVisible(def.champRequis.module, def.champRequis.champ)) {
        return false;
      }
      return true;
    },
    [moduleAutorise, champVisible],
  );

  const tuileVisible = useCallback(
    (cle: CleTuile) => {
      const def = TUILES.find((t) => t.cle === cle);
      return def ? moduleAutorise(def.module, def.widget) : false;
    },
    [moduleAutorise],
  );

  // 3. La vue trie et ordonne ce qui a franchi les deux premiers filtres.
  const cartes = useMemo<CleCarte[]>(() => {
    const v = VUE_PAR_CLE.get(vue);
    const ordre = v?.cartes ?? CARTES.map((c) => c.cle);
    return ordre.filter(carteVisible);
  }, [vue, carteVisible]);

  const tuiles = useMemo<CleTuile[]>(() => {
    const v = VUE_PAR_CLE.get(vue);
    const ordre = v?.tuiles ?? TUILES.map((t) => t.cle);
    return ordre.filter(tuileVisible);
  }, [vue, tuileVisible]);

  /**
   * Ce qu'il faut aller lire.
   *
   * Un vendeur dont la vue ne contient ni « Entrées & sorties de stock »
   * ni « Stock du jour » ne déclenche jamais la lecture des mouvements :
   * une requête de moins à chaque ouverture, sur une connexion mobile.
   */
  const besoins = useMemo(() => {
    const s = new Set<BesoinDonnees>();
    for (const cle of cartes) CARTES.find((c) => c.cle === cle)?.donnees.forEach((d) => s.add(d));
    for (const cle of tuiles) TUILES.find((t) => t.cle === cle)?.donnees.forEach((d) => s.add(d));
    return s;
  }, [cartes, tuiles]);

  const portee = useCallback(
    (module: string): DataScope => {
      if (estProprietaire || !perms) return "all";
      return getModuleScope(perms, module);
    },
    [estProprietaire, perms],
  );

  const changerDeVue = useCallback(
    (v: CleVue) => setVueChoisie(vuesDisponibles.includes(v) ? v : null),
    [vuesDisponibles],
  );

  return {
    estProprietaire,
    vue,
    changerDeVue,
    vuesDisponibles,
    carteVisible,
    tuileVisible,
    cartes,
    tuiles,
    besoins,
    portee,
    champVisible,
  };
}

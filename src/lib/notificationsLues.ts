import { useCallback, useEffect, useState } from "react";

/**
 * Ce qui a déjà été vu dans la cloche.
 *
 * Cette mémoire vivait dans un `useState` : elle disparaissait au moindre
 * rechargement, et la pastille rouge revenait toute seule sur des
 * notifications déjà lues. Elle tient maintenant dans le navigateur, par
 * boutique — deux boutiques sur le même appareil ne partagent pas leur
 * compte de non-lus.
 *
 * On enregistre des identifiants, et non une date de dernière ouverture.
 * Une date paraît plus simple, mais une vente enregistrée hier et saisie
 * ce matin passerait pour déjà lue : les écritures portent la date de
 * l'opération, pas celle de la frappe. Un identifiant ne se trompe pas.
 *
 * La liste est élaguée à chaque écriture : seuls survivent les
 * identifiants encore présents dans les notifications du moment. Sans
 * cela, elle grossirait indéfiniment au fil des mois pour des lignes que
 * plus personne n'affiche.
 */
const cle = (storeId: string | null) => `tantana.notifs-lues.${storeId ?? "sans-boutique"}`;

export function useNotificationsLues(storeId: string | null) {
  const [lues, setLues] = useState<Set<string>>(new Set());

  // Relecture au changement de boutique. `localStorage` n'existe pas au
  // rendu serveur, et peut lever dans un navigateur qui refuse le
  // stockage : l'échec doit rester silencieux, une pastille inexacte
  // vaut mieux qu'un écran blanc.
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(cle(storeId));
      setLues(new Set(brut ? (JSON.parse(brut) as string[]) : []));
    } catch {
      setLues(new Set());
    }
  }, [storeId]);

  const marquerLues = useCallback(
    (ids: string[]) => {
      const suivant = new Set(ids);
      setLues(suivant);
      try {
        window.localStorage.setItem(cle(storeId), JSON.stringify([...suivant]));
      } catch {
        /* Stockage refusé : la session garde l'état, le prochain
           démarrage repartira de zéro. */
      }
    },
    [storeId],
  );

  return { lues, marquerLues };
}

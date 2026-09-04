import { useCallback, useEffect, useState } from "react";

/**
 * Préférences d'affichage des alertes.
 *
 * Volontairement stockées dans le navigateur et non en base : la table
 * `profiles` n'a pas de colonne pour cela, et créer une migration Supabase
 * pour un réglage purement visuel ne se justifie pas. Conséquence assumée
 * et indiquée à l'utilisateur dans les réglages : ces choix ne suivent pas
 * d'un appareil à l'autre.
 */

export interface NotificationPrefs {
  /** Cloche de l'en-tête : produits sous leur seuil d'alerte. */
  stockAlerts: boolean;
  /** Bandeau éphémère quand un vendeur enregistre une vente ou une dépense. */
  activityAlerts: boolean;
  /** Bandeaux de trésorerie négative / sous le seuil sur le tableau de bord. */
  treasuryAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  stockAlerts: true,
  activityAlerts: true,
  treasuryAlerts: true,
};

const STORAGE_KEY = "balsama-notifications";

/** Événement interne : permet à plusieurs composants de rester synchronisés. */
const CHANGE_EVENT = "balsama-notifications-change";

export function readNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw);
    // Fusion avec les valeurs par défaut : une préférence ajoutée dans une
    // version ultérieure ne doit pas arriver à `undefined` chez quelqu'un
    // qui a déjà enregistré ses choix.
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function writeNotificationPrefs(prefs: NotificationPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Navigation privée ou stockage désactivé : les réglages restent ceux
    // de la session en cours, sans planter l'application.
  }
}

/**
 * Lit les préférences et se met à jour quand elles changent — que ce soit
 * depuis cet onglet ou depuis un autre onglet du même navigateur.
 */
export function useNotificationPrefs(): [NotificationPrefs, (patch: Partial<NotificationPrefs>) => void] {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    setPrefs(readNotificationPrefs());

    const sync = () => setPrefs(readNotificationPrefs());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<NotificationPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeNotificationPrefs(next);
      return next;
    });
  }, []);

  return [prefs, update];
}

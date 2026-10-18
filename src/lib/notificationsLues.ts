import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/**
 * CE QUE CHACUN A FAIT DE SES NOTIFICATIONS
 *
 * Deux états, comme sur un réseau social :
 *
 * — « vu » : la cloche a été ouverte pendant que la notification était
 *   là. Elle ne compte plus dans la pastille rouge — ouvrir la cloche
 *   remet le compteur à zéro — mais reste en gras dans la liste tant
 *   qu'on ne l'a pas ouverte ;
 * — « lu » : on a cliqué dessus, ou « Tout marquer lu ».
 *
 * Avant, seul « lu » existait, et seulement par « Tout marquer lu » :
 * la pastille restait à « 9+ » tant qu'on n'avait pas trouvé ce bouton,
 * et ouvrir une notification ne la marquait pas.
 *
 * OÙ C'EST GARDÉ. En base (`notifications_lues`), pour suivre la
 * personne d'un appareil à l'autre, et dans le navigateur, pour que la
 * pastille soit juste dès le premier rendu, avant la réponse du
 * serveur. La base fait foi ; le navigateur ne fait que l'anticiper.
 * Si la table n'existe pas encore (migration non appliquée) ou refuse,
 * on continue avec le navigateur seul — une pastille un peu moins
 * fidèle vaut mieux qu'une cloche cassée.
 *
 * POURQUOI DES IDENTIFIANTS ET NON UNE DATE. Une vente saisie ce matin
 * à la date d'hier passerait pour déjà vue derrière une date de
 * dernière ouverture : les écritures portent la date de l'opération,
 * pas celle de la frappe. Un identifiant ne se trompe pas.
 */
export type EtatNotification = "vu" | "lu";

const cle = (storeId: string | null, userId: string | null) =>
  `tantana.notifs-lues.${storeId ?? "sans-boutique"}${userId ? `.${userId}` : ""}`;
/** L'ancienne clé, sans personne : relue une fois pour ne rien perdre. */
const ancienneCle = (storeId: string | null) => `tantana.notifs-lues.${storeId ?? "sans-boutique"}`;

/** Le navigateur n'est qu'une anticipation : on n'y garde que le récent. */
const MAX_LOCAL = 1500;

function lireLocal(storeId: string | null, userId: string | null): Map<string, EtatNotification> {
  const etats = new Map<string, EtatNotification>();
  try {
    for (const k of [ancienneCle(storeId), cle(storeId, userId)]) {
      const brut = window.localStorage.getItem(k);
      if (!brut) continue;
      const v = JSON.parse(brut) as unknown;
      // Ancien format : une liste d'identifiants, tous lus.
      if (Array.isArray(v)) for (const id of v) etats.set(String(id), "lu");
      else if (v && typeof v === "object")
        for (const [id, e] of Object.entries(v as Record<string, unknown>))
          if (e === "vu" || e === "lu") etats.set(id, e);
    }
  } catch {
    /* Stockage refusé ou illisible : on repart de zéro. */
  }
  return etats;
}

function ecrireLocal(
  storeId: string | null,
  userId: string | null,
  etats: Map<string, EtatNotification>,
) {
  try {
    const entrees = [...etats.entries()].slice(-MAX_LOCAL);
    window.localStorage.setItem(cle(storeId, userId), JSON.stringify(Object.fromEntries(entrees)));
  } catch {
    /* Stockage refusé : la session garde l'état. */
  }
}

/** Fusion : « lu » l'emporte toujours sur « vu ». */
export function fusionnerEtats(
  a: ReadonlyMap<string, EtatNotification>,
  b: ReadonlyMap<string, EtatNotification>,
): Map<string, EtatNotification> {
  const r = new Map(a);
  for (const [id, e] of b) if (r.get(id) !== "lu") r.set(id, e);
  return r;
}

/** Ce qui doit compter dans la pastille : rien de vu, rien de lu, rien de soi. */
export function compterNonVues(
  notifications: readonly { id: string; deMoi?: boolean }[],
  etats: ReadonlyMap<string, EtatNotification>,
): number {
  return notifications.filter((n) => !n.deMoi && !etats.has(n.id)).length;
}

/** Ce qui reste en gras dans la liste : tout ce qui n'a pas été ouvert. */
export function estNonLue(
  n: { id: string; deMoi?: boolean },
  etats: ReadonlyMap<string, EtatNotification>,
): boolean {
  return !n.deMoi && etats.get(n.id) !== "lu";
}

/**
 * Écrit des états en base. « vu » n'écrase jamais un « lu » : les lignes
 * déjà présentes sont ignorées. « lu » remplace ce qui était là.
 */
async function envoyer(
  dispo: { current: boolean },
  store: string,
  user: string,
  ids: string[],
  etat: EtatNotification,
): Promise<void> {
  if (!dispo.current || ids.length === 0) return;
  const maintenant = new Date().toISOString();
  const lignes = ids.map((notification_id) => ({
    user_id: user,
    store_id: store,
    notification_id,
    etat,
    maj_le: maintenant,
  }));
  const { error } = await supabase.from("notifications_lues" as never).upsert(lignes as never, {
    onConflict: "user_id,store_id,notification_id",
    ignoreDuplicates: etat === "vu",
  });
  if (error) dispo.current = false;
}

export function useNotificationsLues(storeId: string | null, userId: string | null) {
  const [etats, setEtats] = useState<Map<string, EtatNotification>>(new Map());
  /** Faux dès que la base refuse : on cesse de l'interroger pour la session. */
  const baseDisponible = useRef(true);
  const courant = useRef(etats);
  courant.current = etats;

  // 1. Le navigateur, tout de suite. 2. La base, qui fait foi.
  useEffect(() => {
    let annule = false;
    const local = lireLocal(storeId, userId);
    courant.current = local;
    setEtats(local);
    baseDisponible.current = true;
    if (!storeId || !userId) return;

    (async () => {
      const { data, error } = await supabase
        .from("notifications_lues" as never)
        .select("notification_id, etat")
        .eq("store_id", storeId)
        .eq("user_id", userId)
        // Le plus récent d'abord : ce sont les notifications affichées.
        .order("maj_le", { ascending: false })
        .limit(5000);
      if (annule) return;
      if (error) {
        baseDisponible.current = false;
        return;
      }
      const enBase = new Map<string, EtatNotification>();
      for (const l of (data ?? []) as { notification_id: string; etat: EtatNotification }[])
        enBase.set(l.notification_id, l.etat);
      // Fusion avec l'état COURANT, pas avec la lecture locale du départ :
      // la cloche a pu être ouverte pendant que la base répondait.
      const ici = courant.current;
      const fusion = fusionnerEtats(enBase, ici);
      courant.current = fusion;
      setEtats(fusion);
      ecrireLocal(storeId, userId, fusion);

      // Ce que le navigateur savait et que la base ignore encore (avant la
      // création de la table, ou hors ligne) y remonte une fois.
      const lusARemonter = [...ici.entries()]
        .filter(([id, e]) => e === "lu" && enBase.get(id) !== "lu")
        .map(([id]) => id);
      const vusARemonter = [...ici.entries()]
        .filter(([id, e]) => e === "vu" && !enBase.has(id))
        .map(([id]) => id);
      await envoyer(baseDisponible, storeId, userId, lusARemonter, "lu");
      await envoyer(baseDisponible, storeId, userId, vusARemonter, "vu");
    })();

    return () => {
      annule = true;
    };
  }, [storeId, userId]);

  const poser = useCallback(
    (ids: string[], etat: EtatNotification) => {
      const avant = courant.current;
      const nouveaux = ids.filter((id) =>
        etat === "lu" ? avant.get(id) !== "lu" : !avant.has(id),
      );
      if (nouveaux.length === 0) return;
      const suivant = new Map(avant);
      for (const id of nouveaux) suivant.set(id, etat);
      courant.current = suivant;
      setEtats(suivant);
      ecrireLocal(storeId, userId, suivant);
      if (storeId && userId) void envoyer(baseDisponible, storeId, userId, nouveaux, etat);
    },
    [storeId, userId],
  );

  /** La cloche s'ouvre : la pastille retombe à zéro. */
  const marquerVues = useCallback((ids: string[]) => poser(ids, "vu"), [poser]);
  /** Une notification ouverte, ou « Tout marquer lu ». */
  const marquerLues = useCallback((ids: string[]) => poser(ids, "lu"), [poser]);

  return { etats, marquerVues, marquerLues };
}

import { supabase } from "./supabase";

const ownerKey = "tantana-rappels-push-compte";
export function rappelsPushActifs() {
  return (
    "Notification" in window &&
    Notification.permission === "granted" &&
    Boolean(localStorage.getItem(ownerKey))
  );
}

export async function desactiverRappelsPush() {
  if (!localStorage.getItem(ownerKey)) return;
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) await subscription.unsubscribe();
  localStorage.removeItem(ownerKey);
}

export async function activerRappelsPush() {
  if (!("Notification" in window) || !("PushManager" in window) || !navigator.serviceWorker)
    throw new Error(
      "Ce navigateur ne prend pas en charge les rappels. Sur iPhone, ajoutez Tantana à l’écran d’accueil, puis ouvrez l’application.",
    );
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Autorisez les notifications de Tantana dans les réglages de votre navigateur.",
    );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Reconnectez-vous pour activer vos rappels.");
  if (localStorage.getItem(ownerKey) !== session.user.id) await desactiverRappelsPush();
  const { data, error } = await supabase.functions.invoke("rappels-push", {
    body: { action: "key" },
  });
  if (error || !data?.publicKey)
    throw new Error("Le service de rappels est indisponible. Réessayez dans un instant.");
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(data.publicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    }));
  const result = await supabase.functions.invoke("rappels-push", {
    body: {
      action: "subscribe",
      subscription: subscription.toJSON(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  if (result.error) {
    await subscription.unsubscribe();
    localStorage.removeItem(ownerKey);
    throw new Error("L’appareil n’a pas pu être enregistré. Réessayez.");
  }
  localStorage.setItem(ownerKey, session.user.id);
}

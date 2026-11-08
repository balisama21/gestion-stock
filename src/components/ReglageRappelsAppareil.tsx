import { useEffect, useState } from "react";
import { activerRappelsPush, desactiverRappelsPush, rappelsPushActifs } from "../lib/rappelsPush";

export function ReglageRappelsAppareil() {
  const [etat, setEtat] = useState("off");
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const init = () => {
      setNative(Boolean(window.tantanaRappels));
      if (window.tantanaRappels) window.tantanaRappels({ action: "status" });
      else setEtat(rappelsPushActifs() ? "ready" : "off");
    };
    const status = (e: Event) => setEtat((e as CustomEvent<string>).detail);
    window.addEventListener("tantana-rappels-etat", status);
    window.addEventListener("tantana-rappels-pret", init);
    init();
    return () => {
      window.removeEventListener("tantana-rappels-etat", status);
      window.removeEventListener("tantana-rappels-pret", init);
    };
  }, []);
  async function regler() {
    setMessage("");
    if (window.tantanaRappels) {
      window.tantanaRappels({ action: etat === "ready" ? "disable" : "enable" });
      return;
    }
    setBusy(true);
    try {
      if (etat === "ready") await desactiverRappelsPush();
      else await activerRappelsPush();
      setEtat(rappelsPushActifs() ? "ready" : "off");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="px-4 py-3">
      <strong>Rappels sur cet appareil</strong>
      <p className="text-sm">
        {native
          ? "Recevez vos rappels synchronisés même lorsque Tantana est fermée."
          : "Recevez vos rappels même après avoir fermé l’onglet Tantana."}
      </p>
      <button type="button" className="underline" disabled={busy} onClick={regler}>
        {etat === "ready"
          ? "Désactiver les rappels"
          : etat === "alarms"
            ? "Autoriser les alarmes à l’heure exacte"
            : etat === "notifications"
              ? "Autoriser les notifications Android"
              : "Activer les rappels"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { prochaineOccurrence, type Rappel } from "../lib/rappels";

declare global {
  interface Window {
    tantanaRappels?: (message: Record<string, unknown>) => void;
  }
}

export function useHorlogeRappels(
  rappels: Rappel[],
  userId?: string,
  storeId?: string,
  charges = false,
) {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    if (!userId || !storeId || !charges) return;
    const personnels = rappels.filter(
      (r) => r.actif && r.destinataire_id === userId && r.store_id === storeId,
    );
    const sync = () =>
      window.tantanaRappels?.({
        action: "sync",
        rows: personnels.map((r) => ({
          id: r.id,
          title: r.titre,
          recurrence: r.recurrence,
          time: r.declenche_le ? Date.parse(r.declenche_le) : 0,
          hour: Number(r.heure?.slice(0, 2) ?? 0),
          minute: Number(r.heure?.slice(3, 5) ?? 0),
          weekday: r.jour_semaine,
          monthday: r.jour_mois,
        })),
      });
    sync();
    window.addEventListener("tantana-rappels-pret", sync);
    return () => window.removeEventListener("tantana-rappels-pret", sync);
  }, [rappels, userId, storeId, charges]);

  useEffect(() => {
    let timer: number;
    const tick = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setMaintenant(now);
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      let next = midnight.getTime();
      for (const r of rappels) {
        if (!r.actif || r.destinataire_id !== userId || r.store_id !== storeId) continue;
        const occurrence = prochaineOccurrence(r, now);
        if (occurrence) next = Math.min(next, occurrence.getTime());
      }
      timer = window.setTimeout(tick, Math.max(1, next - Date.now()));
    };
    tick();
    window.addEventListener("focus", tick);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", tick);
    };
  }, [rappels, storeId, userId]);
  return maintenant;
}

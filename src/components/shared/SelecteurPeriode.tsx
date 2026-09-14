import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import {
  PERIODES,
  calculerPeriode,
  libelleIntervalle,
  type ClePeriode,
  type Periode,
} from "../../lib/periodes";

interface SelecteurPeriodeProps {
  periode: Periode;
  onChange: (cle: ClePeriode) => void;
}

/**
 * La période que l'écran regarde, et jusqu'où elle va.
 *
 * ── Pourquoi la date sous le nom ──
 *
 * Quatre puces disaient « Aujourd'hui · 7 jours · Ce mois · Tout » sans
 * dire ce que chacune recouvre. « Ce mois », le 14 septembre, s'arrête
 * aujourd'hui et non au 30 : on lisait donc un total de quatorze jours
 * en croyant lire un mois. Le bouton porte maintenant les deux — le nom
 * de la période, et l'intervalle réel en dessous.
 *
 * Le menu fait de même sur chaque ligne : on voit ce que l'on choisit
 * avant de choisir, plutôt qu'après.
 *
 * ── Le fond transparent au premier plan ──
 *
 * Le voile en `fixed inset-0` n'est pas décoratif : c'est lui qui
 * referme le menu au clic à côté. Même procédé que le panneau des
 * notifications, et même raison — un écouteur global sur le document se
 * déclenche aussi sur le clic qui vient d'ouvrir le menu.
 */
export const SelecteurPeriode: React.FC<SelecteurPeriodeProps> = ({ periode, onChange }) => {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);

  // Échap referme et rend le focus au bouton : sans cela, le clavier
  // repartirait du début de la page à chaque fermeture.
  useEffect(() => {
    if (!ouvert) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOuvert(false);
      bouton.current?.focus();
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [ouvert]);

  return (
    <div className="relative w-full sm:w-auto">
      <button
        ref={bouton}
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={`Période affichée : ${periode.libelle}. Changer de période.`}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50 sm:w-auto ${
          ouvert ? "border-primary/40" : "border-border"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {periode.libelle}
          </span>
          <span className="block truncate text-sm font-medium text-foreground">
            {libelleIntervalle(periode)}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            ouvert ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOuvert(false)} />
          <div
            role="listbox"
            aria-label="Période"
            className="absolute right-0 z-50 mt-2 w-full min-w-[15rem] overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-in fade-in slide-in-from-top-1 sm:w-auto"
          >
            {PERIODES.map((p) => {
              const actif = p.cle === periode.cle;
              return (
                <button
                  key={p.cle}
                  type="button"
                  role="option"
                  aria-selected={actif}
                  onClick={() => {
                    onChange(p.cle);
                    setOuvert(false);
                    bouton.current?.focus();
                  }}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted ${
                    actif ? "bg-success-soft" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm ${
                        actif ? "font-medium t-success" : "text-foreground"
                      }`}
                    >
                      {p.libelle}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {libelleIntervalle(calculerPeriode(p.cle))}
                    </span>
                  </span>
                  {actif && <Check className="h-4 w-4 shrink-0 t-success" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

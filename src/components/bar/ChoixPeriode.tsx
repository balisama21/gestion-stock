import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Echelle, Periode } from "../../lib/bilanBar";

const ECHELLES: [Echelle, string][] = [
  ["soir", "Soir"],
  ["semaine", "Semaine"],
  ["mois", "Mois"],
];

/** Soir, semaine ou mois, et les flèches pour remonter le temps. */
export const ChoixPeriode: React.FC<{
  /** « Soir » au bar, « Jour » ailleurs. */
  libelleJour?: string;
  echelle: Echelle;
  recul: number;
  periode: Periode;
  onEchelle: (e: Echelle) => void;
  onRecul: (r: number) => void;
}> = ({ libelleJour, echelle, recul, periode, onEchelle, onRecul }) => (
  <div className="space-y-2">
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
      {ECHELLES.map(([cle, libelle]) => (
        <button
          key={cle}
          type="button"
          role="tab"
          aria-selected={echelle === cle}
          onClick={() => {
            onEchelle(cle);
            onRecul(0);
          }}
          className={`rounded-lg py-1.5 text-sm font-medium ${
            echelle === cle ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {cle === "soir" && libelleJour ? libelleJour : libelle}
        </button>
      ))}
    </div>
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => onRecul(recul + 1)}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        aria-label="Période précédente"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <p className="font-semibold">{periode.libelle}</p>
      <button
        type="button"
        onClick={() => onRecul(recul - 1)}
        disabled={recul === 0}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Période suivante"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  </div>
);

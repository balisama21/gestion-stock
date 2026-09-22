import React, { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Modal } from "../shared/Modal";
import type { ClePeriode, Periode } from "../../features/dashboard-v2/hooks/useDashboardPeriod";

/**
 * Le choix de période, calculé exactement comme celui du tableau de
 * bord.
 *
 * Il en reprend le HOOK — `construirePeriode` — et pas seulement les
 * libellés : c'est la condition pour que les deux écrans donnent les
 * mêmes chiffres sur la même période, ce que le cahier exige. Seule
 * l'apparence diffère, parce qu'elle suit ici celle des pages Ventes et
 * Achats plutôt que la barre d'outils du tableau de bord.
 */
export const SelecteurPeriodeFacturation: React.FC<{
  periode: Periode;
  apercus: { cle: Exclude<ClePeriode, "custom">; nom: string; libelle: string }[];
  intervalleLibre: { debut: string; fin: string };
  aujourdhui: string;
  onChoisir: (cle: Exclude<ClePeriode, "custom">) => void;
  onChoisirIntervalle: (debut: string, fin: string) => void;
}> = ({ periode, apercus, intervalleLibre, aujourdhui, onChoisir, onChoisirIntervalle }) => {
  const [ouvert, setOuvert] = useState(false);
  const [du, setDu] = useState(intervalleLibre.debut);
  const [au, setAu] = useState(intervalleLibre.fin);
  const [erreur, setErreur] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {apercus.map((a) => (
          <button
            key={a.cle}
            type="button"
            onClick={() => onChoisir(a.cle)}
            aria-pressed={periode.cle === a.cle}
            className={`app-chip ${periode.cle === a.cle ? "app-chip-active" : ""}`}
          >
            {a.nom}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-pressed={periode.cle === "custom"}
          className={`app-chip ${periode.cle === "custom" ? "app-chip-active" : ""}`}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {periode.cle === "custom" ? periode.libelle : "Personnalisé"}
        </button>
      </div>

      {ouvert && (
        <Modal
          open
          onClose={() => setOuvert(false)}
          size="sm"
          icon={<CalendarRange className="h-4 w-4" />}
          title="Choisir une période"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!du || !au || du > au) {
                setErreur(true);
                return;
              }
              setErreur(false);
              onChoisirIntervalle(du, au);
              setOuvert(false);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fact-du" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Du
                </label>
                <input
                  id="fact-du"
                  type="date"
                  value={du}
                  max={aujourdhui}
                  onChange={(e) => setDu(e.target.value)}
                  className="app-field"
                />
              </div>
              <div>
                <label htmlFor="fact-au" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Au
                </label>
                <input
                  id="fact-au"
                  type="date"
                  value={au}
                  max={aujourdhui}
                  onChange={(e) => setAu(e.target.value)}
                  className="app-field"
                />
              </div>
            </div>
            {erreur && (
              <p className="text-xs t-danger">La date de début doit être avant la date de fin.</p>
            )}
            <button type="submit" className="app-btn-primary w-full">
              Appliquer la période
            </button>
          </form>
        </Modal>
      )}
    </>
  );
};

import React from "react";
import { Card, CardHeader } from "../components/Card";
import { montant, pluriel } from "../lib/format";
import type { ChiffresPaiements } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * 12. PAIEMENTS
 *
 * Trois états de l'argent des ventes : rentré, attendu, en retard.
 *
 * LA DÉCOUPE À TRENTE JOURS EST NOUVELLE — la page Paiements à recevoir
 * ne fait pas la différence entre une créance de six jours et une de
 * quarante-trois. C'est pourtant toute la différence : l'une suit son
 * cours, l'autre demande un appel.
 *
 * LE SEUL MONTANT COLORÉ est celui du retard, en orange. Le reste à
 * recevoir ne se colore pas : le titre du bloc dit déjà que cet argent
 * n'est pas rentré, et le rouge ne ferait que le répéter — règle posée
 * pour toute l'application.
 */
export const CartePaiements: React.FC<{
  paiements: ChiffresPaiements;
  periode: Periode;
  visible: boolean;
  onEncaisse?: () => void;
  onRecevoir?: () => void;
  onRetard?: () => void;
}> = ({ paiements, periode, visible, onEncaisse, onRecevoir, onRetard }) => {
  const { encaisse, aRecevoir, aRecevoirClients, enRetard, enRetardClients, parSemaine } =
    paiements;
  const total = encaisse + aRecevoir + enRetard;
  const part = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const sous = (v: number) => (visible ? montant(v) : "••• Ar");

  const hautSemaine = Math.max(...parSemaine.map((s) => s.montant), 1);

  const ligne = (
    couleur: string,
    titre: string,
    detail: string,
    valeur: number,
    retard: boolean,
    onClick?: () => void,
  ) => {
    const Ligne = onClick ? "button" : "div";
    return (
      <Ligne
        key={titre}
        {...(onClick ? { type: "button" as const, onClick } : {})}
        className={`lrow${retard ? " late" : ""}`}
      >
        <i style={{ background: couleur }} />
        <span>
          {titre}
          <small>{detail}</small>
        </span>
        <b className="num">{sous(valeur)}</b>
      </Ligne>
    );
  };

  return (
    <Card span={4} id="carte-paiements">
      <CardHeader
        title="Paiements"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20M6 15h4" />
          </svg>
        }
      />

      <div className="kpi-row">
        <span className="v num" style={{ fontSize: 24 }}>
          {sous(encaisse)}
        </span>
        <span className="c">encaissés · {periode.libelle}</span>
      </div>

      <div
        className="stack"
        aria-label={`Encaissé ${Math.round(part(encaisse))} %, à recevoir ${Math.round(part(aRecevoir))} %, en retard ${Math.round(part(enRetard))} %`}
      >
        <i style={{ width: `${part(encaisse)}%`, background: "var(--accent)" }} />
        <i style={{ width: `${part(aRecevoir)}%`, background: "var(--info)" }} />
        <i style={{ width: `${part(enRetard)}%`, background: "var(--warn)" }} />
      </div>

      <div className="lignes">
        {ligne(
          "var(--accent)",
          "Encaissé",
          `Règlements reçus · ${periode.libelle}`,
          encaisse,
          false,
          onEncaisse,
        )}
        {ligne(
          "var(--info)",
          "À recevoir",
          `${pluriel(aRecevoirClients, "client")} · moins de 30 jours`,
          aRecevoir,
          false,
          onRecevoir,
        )}
        {ligne(
          "var(--warn)",
          "En retard",
          `${pluriel(enRetardClients, "client")} · plus de 30 jours`,
          enRetard,
          true,
          onRetard,
        )}
      </div>

      {parSemaine.length > 1 && (
        <div>
          <div className="sous-titre" style={{ marginBottom: 6 }}>
            Encaissements par semaine
          </div>
          <div
            className="semaines"
            style={{ gridTemplateColumns: `repeat(${parSemaine.length}, 1fr)` }}
          >
            {parSemaine.map((s) => (
              <div key={s.libelle} title={`${s.libelle} · ${montant(s.montant)}`}>
                <i style={{ height: `${(s.montant / hautSemaine) * 100}%` }} />
                <small>{s.libelle}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

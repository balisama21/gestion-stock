import React from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatVide } from "../components/States";
import { dateLocale, jourMoisChiffres, montant, nombre } from "../lib/format";
import type { ChiffresFournisseurs } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * 19. FOURNISSEURS À PAYER
 *
 * Les achats dont il reste quelque chose à régler, l'échéance la plus
 * pressante en tête.
 *
 * LE ROUGE EST RÉSERVÉ À CE QUI EST DÉPASSÉ. Une échéance à venir est
 * une échéance normale : la peindre en rouge par avance apprend à ne
 * plus regarder la couleur.
 *
 * LA CARTE DISPARAÎT SANS LE DROIT DE VOIR LES PRIX D'ACHAT — c'est
 * décidé dans `registry.ts` par `champRequis`. Une carte de points de
 * suspension occupe la place sans rien apprendre.
 */
export const CarteFournisseurs: React.FC<{
  fournisseurs: ChiffresFournisseurs;
  periode: Periode;
  onOuvrir?: () => void;
}> = ({ fournisseurs, periode, onOuvrir }) => {
  const { aPayer, totalDu, echeancesDepassees, payeSurLaPeriode } = fournisseurs;
  const lignes = aPayer.slice(0, 3);

  return (
    <Card span={6} id="carte-fournisseurs">
      <CardHeader
        title="Fournisseurs à payer"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21V8l9-5 9 5v13" />
            <path d="M9 21v-7h6v7" />
          </svg>
        }
        action={
          onOuvrir && (
            <button className="link" type="button" onClick={onOuvrir}>
              Tout voir
            </button>
          )
        }
      />

      <div className="kpi-row">
        <span className="v num" style={{ fontSize: 24 }}>
          {montant(totalDu)}
        </span>
        {echeancesDepassees > 0 && (
          <span className="trend" style={{ color: "var(--crit)", background: "var(--crit-soft)" }}>
            {nombre(echeancesDepassees)} échéance{echeancesDepassees > 1 ? "s" : ""} dépassée
            {echeancesDepassees > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {lignes.length === 0 ? (
        <EtatVide titre="Rien à payer" detail="Tous les achats enregistrés sont réglés." />
      ) : (
        <div className="lignes">
          {lignes.map((f, i) => (
            <div className={`lrow${f.retard > 0 ? " late" : ""}`} key={`${f.nom}-${i}`}>
              <i style={{ background: f.retard > 0 ? "var(--crit)" : "var(--info)" }} />
              <span>
                {f.nom} · {f.designation}
                <small>
                  {f.echeance
                    ? f.retard > 0
                      ? `Échéance ${jourMoisChiffres(dateLocale(f.echeance))} · dépassée de ${nombre(f.retard)} jour${f.retard > 1 ? "s" : ""}`
                      : `Échéance ${jourMoisChiffres(dateLocale(f.echeance))}`
                    : "Sans échéance"}
                </small>
              </span>
              <b className="num" style={f.retard > 0 ? { color: "var(--crit)" } : undefined}>
                {montant(f.du)}
              </b>
            </div>
          ))}
        </div>
      )}

      {payeSurLaPeriode > 0 && (
        <div className="lignes">
          <div className="lrow">
            <i style={{ background: "var(--accent)" }} />
            <span>
              Déjà payé · {periode.libelle}
              <small>Règlements versés aux fournisseurs</small>
            </span>
            <b className="num">{montant(payeSurLaPeriode)}</b>
          </div>
        </div>
      )}
    </Card>
  );
};

import React from "react";
import { Lead, Lien, TeteCarte, Vide } from "../components/Tn";
import { illVideArgent } from "../assets/images";
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
    <article className="card" id="carte-fournisseurs">
      <TeteCarte
        lead={<Lead nom="truck" />}
        titre="Fournisseurs à payer"
        action={<Lien onClick={onOuvrir}>Tout voir</Lien>}
      />

      <div className="kpi-row">
        <span className={`v num v-moyen${echeancesDepassees > 0 ? " cle-alerte" : ""}`}>
          {montant(totalDu)}
        </span>
        {echeancesDepassees > 0 && (
          <span className="trend" style={{ color: "var(--red)", background: "var(--redsoft)" }}>
            {nombre(echeancesDepassees)} échéance{echeancesDepassees > 1 ? "s" : ""} dépassée
            {echeancesDepassees > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {lignes.length === 0 ? (
        <Vide
          image={illVideArgent}
          largeur={124}
          titre="Rien à payer"
          detail="Tous les achats enregistrés sont réglés."
        />
      ) : (
        <div className="lignes">
          {lignes.map((f, i) => (
            <div className={`lrow${f.retard > 0 ? " late" : ""}`} key={`${f.nom}-${i}`}>
              <i style={{ background: f.retard > 0 ? "var(--red)" : "var(--blue)" }} />
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
              <b className="num" style={f.retard > 0 ? { color: "var(--red)" } : undefined}>
                {montant(f.du)}
              </b>
            </div>
          ))}
        </div>
      )}

      {payeSurLaPeriode > 0 && (
        <div className="lignes">
          <div className="lrow">
            <i style={{ background: "var(--g)" }} />
            <span>
              Déjà payé · {periode.libelle}
              <small>Règlements versés aux fournisseurs</small>
            </span>
            <b className="num">{montant(payeSurLaPeriode)}</b>
          </div>
        </div>
      )}
    </article>
  );
};

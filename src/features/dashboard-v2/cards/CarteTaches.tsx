import React, { useId, useState } from "react";
import { IconeDuo } from "../../../components/shared/IconeDuo";
import { Lead, Lien } from "../components/Tn";
import { Tag } from "../components/Tag";
import { dateLocale, jourMoisChiffres, montant } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import { illFeuille } from "../assets/images";

/**
 * À FAIRE — les tâches ouvertes, et les devis qui attendent une réponse.
 *
 * Cocher une tâche la termine, par la fonction de l'application ; sans
 * ce droit la case est désactivée plutôt que d'échouer en silence.
 */

export interface TacheAffichee {
  id: string;
  titre: string;
  statut: string;
  echeance: string | null;
}

export const CarteTaches: React.FC<{
  taches: TacheAffichee[];
  devis: { statut: string; total: number }[];
  onTerminer?: (id: string) => unknown;
  onVoirTaches?: () => void;
  onVoirDevis?: () => void;
}> = ({ taches, devis, onTerminer, onVoirTaches, onVoirDevis }) => {
  const aujourdhui = dateDuJour();
  const prefixe = useId();
  const [cochees, setCochees] = useState<Set<string>>(new Set());

  const ouvertes = taches
    .filter((t) => t.statut !== "termine")
    .sort((a, b) => {
      if (!a.echeance) return 1;
      if (!b.echeance) return -1;
      return a.echeance.localeCompare(b.echeance);
    })
    .slice(0, 6);

  const nbOuvertes = taches.filter((t) => t.statut !== "termine").length;
  const nbEnRetard = taches.filter(
    (t) => t.statut !== "termine" && t.echeance && t.echeance < aujourdhui,
  ).length;
  const enAttente = devis.filter((d) => d.statut === "brouillon" || d.statut === "envoye");
  const totalDevis = enAttente.reduce((a, d) => a + d.total, 0);

  const etiquette = (echeance: string | null) => {
    if (!echeance) return null;
    if (echeance < aujourdhui)
      return <Tag ton="crit">échue {jourMoisChiffres(dateLocale(echeance))}</Tag>;
    if (echeance === aujourdhui) return <Tag ton="warn">aujourd&apos;hui</Tag>;
    return <Tag ton="ok">{jourMoisChiffres(dateLocale(echeance))}</Tag>;
  };

  return (
    <article className="card afaire" id="carte-taches">
      {nbOuvertes === 0 && <img className="art-feuille" src={illFeuille} alt="" />}
      <div className="card-h">
        <Lead nom="check" plein />
        <div className="todo-ok">
          <h3 className="grand">À faire</h3>
          {nbOuvertes === 0 ? (
            <>
              <b>Rien à faire</b>
              <span>Aucune tâche urgente pour le moment.</span>
            </>
          ) : (
            <>
              <b>
                {nbOuvertes} tâche{nbOuvertes > 1 ? "s" : ""} ouverte{nbOuvertes > 1 ? "s" : ""}
              </b>
              <span className={nbEnRetard > 0 ? "alerte" : undefined}>
                {nbEnRetard > 0
                  ? `dont ${nbEnRetard} en retard`
                  : "Aucune n'est en retard pour le moment."}
              </span>
            </>
          )}
        </div>
        <Lien onClick={onVoirTaches}>Voir toutes les tâches</Lien>
      </div>

      {ouvertes.length > 0 && (
        <div className="todo">
          {ouvertes.map((t) => {
            const id = `${prefixe}-${t.id}`;
            const cochee = cochees.has(t.id);
            return (
              <div className={`task${cochee ? " done" : ""}`} key={t.id}>
                <input
                  type="checkbox"
                  id={id}
                  checked={cochee}
                  disabled={!onTerminer}
                  onChange={() => {
                    if (!onTerminer) return;
                    setCochees((s) => new Set(s).add(t.id));
                    void onTerminer(t.id);
                  }}
                />
                <label htmlFor={id}>{t.titre}</label>
                {etiquette(t.echeance)}
              </div>
            );
          })}
        </div>
      )}

      {enAttente.length > 0 && (
        <div className="devis">
          <span className="ib">
            <IconeDuo nom="mail" />
          </span>
          <div>
            <b>{enAttente.length} devis en attente</b>
            <em className="num">{montant(totalDevis)}</em>
          </div>
          {onVoirDevis && (
            <button className="btn soft" type="button" onClick={onVoirDevis}>
              Relancer
            </button>
          )}
        </div>
      )}
    </article>
  );
};

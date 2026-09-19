import React, { useId, useState } from "react";
import { Card, CardHeader } from "../components/Card";
import { Tag } from "../components/Tag";
import { EtatVide } from "../components/States";
import { dateLocale, jourMoisChiffres, montant } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";

/**
 * 6. À FAIRE — la liste, et les devis sans réponse
 *
 * COCHER UNE TÂCHE APPELLE LA FONCTION DE L'APPLICATION, celle de
 * `useTaches` — pas une écriture réinventée ici. Quand cette fonction
 * n'est pas fournie (droits manquants), la case est désactivée et le
 * titre reste un lien vers la page Tâches : mieux vaut un geste
 * impossible et visible qu'un geste qui échoue en silence.
 *
 * L'ORDRE EST CELUI DE L'URGENCE : échues d'abord, puis par échéance,
 * et les tâches sans date en dernier — elles n'attendent personne.
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
  /**
   * Termine une tâche. Absent : la case est désactivée.
   *
   * Le retour n'est pas typé : la fonction de l'application rend un
   * `{ error }` dont la carte n'a que faire — le rechargement dira la
   * vérité. L'exiger ici accrocherait cette carte à la forme exacte
   * d'un hook qu'elle n'a pas à connaître.
   */
  onTerminer?: (id: string) => unknown;
  onVoirTaches?: () => void;
  onVoirDevis?: () => void;
}> = ({ taches, devis, onTerminer, onVoirTaches, onVoirDevis }) => {
  const aujourdhui = dateDuJour();
  const prefixe = useId();
  // Coche optimiste : la ligne se barre tout de suite, sans attendre le
  // retour de la base. Le rechargement remettra les choses en place si
  // l'écriture échoue.
  const [cochees, setCochees] = useState<Set<string>>(new Set());

  const ouvertes = taches
    .filter((t) => t.statut !== "termine")
    .sort((a, b) => {
      if (!a.echeance) return 1;
      if (!b.echeance) return -1;
      return a.echeance.localeCompare(b.echeance);
    })
    .slice(0, 6);

  const faites = ouvertes.filter((t) => cochees.has(t.id)).length;
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
    <Card span={4} id="carte-taches">
      <CardHeader
        title="À faire"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6l2 2 3-3M4 14l2 2 3-3M13 7h7M13 15h7" />
          </svg>
        }
        action={
          ouvertes.length > 0 && (
            <span className="progress-line">
              {faites} / {ouvertes.length} fait
            </span>
          )
        }
      />

      {ouvertes.length === 0 ? (
        <EtatVide titre="Rien à faire" detail="Aucune tâche ouverte pour le moment." />
      ) : (
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
          <div className="env" aria-hidden="true" />
          <div>
            <b>
              {enAttente.length} devis {enAttente.length > 1 ? "en attente" : "en attente"}
            </b>
            <small className="num">{montant(totalDevis)}</small>
          </div>
          {onVoirDevis && (
            <button className="btn ghost" type="button" onClick={onVoirDevis}>
              Relancer
            </button>
          )}
        </div>
      )}

      {onVoirTaches && ouvertes.length > 0 && (
        <button
          className="link"
          type="button"
          onClick={onVoirTaches}
          style={{ alignSelf: "flex-start" }}
        >
          Toutes les tâches
        </button>
      )}
    </Card>
  );
};

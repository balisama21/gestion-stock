import React, { useId, useState } from "react";
import { Icone } from "../../../components/shared/Icone";
import { Lead, Lien, TeteCarte } from "../components/Tn";
import { Tag, type Ton } from "../components/Tag";
import { dateLocale, montant } from "../lib/format";
import { decalerJours } from "../hooks/useDashboardPeriod";
import { dateDuJour } from "../../../lib/dates";
import { estEnAttenteDeReponse } from "../../../lib/devis";
import { IllTaches } from "../operations/Illustrations";

/**
 * À FAIRE — les tâches ouvertes, et les devis qui attendent une réponse.
 *
 * Cocher une tâche la termine, par la fonction de l'application ; sans
 * ce droit la case est désactivée plutôt que d'échouer en silence.
 *
 * Chaque ligne porte un statut tiré des vraies colonnes de la tâche —
 * en retard (échéance passée), urgent (priorité urgente), en cours, à
 * venir, terminé — et jamais un statut inventé pour remplir l'écran.
 * Les tâches terminées aujourd'hui restent visibles, cochées, en bas de
 * la liste : on voit ce qui a été fait, pas seulement ce qui reste.
 */

export interface TacheAffichee {
  id: string;
  titre: string;
  statut: string;
  echeance: string | null;
  /** « basse », « moyenne », « haute », « urgente ». */
  priorite?: string | null;
  /** L'instant où la tâche a été terminée. */
  termine_le?: string | null;
}

/** Combien de lignes la carte montre, ouvertes et terminées confondues. */
const LIGNES = 4;

export const CarteTaches: React.FC<{
  taches: TacheAffichee[];
  devis: { statut: string; total: number; valide_jusqu_au?: string | null }[];
  onTerminer?: (id: string) => unknown;
  onVoirTaches?: () => void;
  onVoirDevis?: () => void;
}> = ({ taches, devis, onTerminer, onVoirTaches, onVoirDevis }) => {
  const aujourdhui = dateDuJour();
  const demain = decalerJours(aujourdhui, 1);
  const prefixe = useId();
  const [cochees, setCochees] = useState<Set<string>>(new Set());

  const ouvertesToutes = taches
    .filter((t) => t.statut !== "termine")
    .sort((a, b) => {
      if (!a.echeance) return 1;
      if (!b.echeance) return -1;
      return a.echeance.localeCompare(b.echeance);
    });
  const termineesDuJour = taches.filter(
    (t) =>
      t.statut === "termine" && t.termine_le && dateDuJour(new Date(t.termine_le)) === aujourdhui,
  );
  const ouvertes = ouvertesToutes.slice(0, LIGNES);
  const terminees = termineesDuJour.slice(0, Math.max(0, LIGNES - ouvertes.length));
  const autres = ouvertesToutes.length - ouvertes.length;

  const nbOuvertes = ouvertesToutes.length;
  const nbEnRetard = ouvertesToutes.filter((t) => t.echeance && t.echeance < aujourdhui).length;
  const enAttente = devis.filter((d) => estEnAttenteDeReponse(d));
  const totalDevis = enAttente.reduce((a, d) => a + d.total, 0);

  const statut = (t: TacheAffichee): { ton: Ton; libelle: string } => {
    if (t.statut === "termine" || cochees.has(t.id)) return { ton: "ok", libelle: "Terminé" };
    if (t.echeance && t.echeance < aujourdhui) return { ton: "crit", libelle: "En retard" };
    if (t.priorite === "urgente") return { ton: "crit", libelle: "Urgent" };
    if (t.statut === "en_cours") return { ton: "warn", libelle: "En cours" };
    if (t.echeance && t.echeance > aujourdhui) return { ton: "info", libelle: "À venir" };
    return { ton: "neutre", libelle: "À faire" };
  };

  const echeance = (t: TacheAffichee): string => {
    if (t.statut === "termine") return "Terminée aujourd'hui";
    if (!t.echeance) return "Sans échéance";
    if (t.echeance === aujourdhui) return "Aujourd'hui";
    if (t.echeance === demain) return "Demain";
    const d = dateLocale(t.echeance).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
    return t.echeance < aujourdhui ? `Échue le ${d}` : d;
  };

  const ligne = (t: TacheAffichee) => {
    const id = `${prefixe}-${t.id}`;
    const faite = t.statut === "termine" || cochees.has(t.id);
    const s = statut(t);
    return (
      <div className={`op-tache${faite ? " done" : ""}`} key={t.id}>
        <input
          type="checkbox"
          id={id}
          checked={faite}
          disabled={!onTerminer || faite}
          aria-label={`Terminer « ${t.titre} »`}
          onChange={() => {
            if (!onTerminer) return;
            setCochees((c) => new Set(c).add(t.id));
            void onTerminer(t.id);
          }}
        />
        <label htmlFor={id} className="op-txt">
          <b>{t.titre}</b>
          <span className="op-meta">
            <Tag ton={s.ton}>{s.libelle}</Tag>
            <small>{echeance(t)}</small>
          </span>
        </label>
        {onVoirTaches && (
          <button
            type="button"
            className="op-chev-btn"
            onClick={onVoirTaches}
            aria-label={`Ouvrir les tâches`}
          >
            <Icone nom="chevright" />
          </button>
        )}
      </div>
    );
  };

  return (
    <article className="card afaire op-carte" id="carte-taches">
      <TeteCarte
        lead={<Lead nom="check" plein />}
        grand
        titre="À faire"
        sous={
          nbOuvertes === 0 ? (
            "Aucune tâche ouverte pour le moment."
          ) : (
            <>
              {nbOuvertes} tâche{nbOuvertes > 1 ? "s" : ""} ouverte{nbOuvertes > 1 ? "s" : ""}
              {nbEnRetard > 0 && <span className="alerte"> · dont {nbEnRetard} en retard</span>}
            </>
          )
        }
        action={
          onVoirTaches && (
            <Lien onClick={onVoirTaches} className="fleche">
              Voir toutes les tâches
              <Icone nom="chevright" />
            </Lien>
          )
        }
      />

      <div className="op-corps">
        <div className="op-contenu">
          {ouvertes.length + terminees.length === 0 ? (
            <div className="op-vide">
              <span className="op-vide-ic">
                <Icone nom="check" />
              </span>
              <div>
                <b>Rien à faire</b>
                <span>Aucune tâche urgente pour le moment.</span>
              </div>
            </div>
          ) : (
            <div className="op-liste">
              {ouvertes.map(ligne)}
              {terminees.map(ligne)}
            </div>
          )}
          {autres > 0 && onVoirTaches && (
            <button type="button" className="link bas" onClick={onVoirTaches}>
              + {autres} autre{autres > 1 ? "s" : ""}
            </button>
          )}

          {enAttente.length > 0 && (
            <div className="devis">
              <span className="ib">
                <Icone nom="mail" />
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
        </div>
        <div className="op-ill">
          <IllTaches
            lignes={[...ouvertes, ...terminees].map((t) => ({
              texte: t.titre,
              fait: t.statut === "termine" || cochees.has(t.id),
            }))}
          />
        </div>
      </div>
    </article>
  );
};

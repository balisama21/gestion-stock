import React from "react";
import type { Tache } from "../../../lib/taches";
import { estEnRetard } from "../../../lib/taches";
import { useOrg } from "../contexte";
import { relatif } from "../lib/dates";
import { Avatar } from "./elements";
import { IcCoche, IcPoints } from "./icones";

/**
 * Une ligne de tâche, telle que la liste et la carte « En retard » la
 * montrent. Cocher la case ÉCRIT en base (statut + date de fin, par
 * `changerStatut`) : elle est donc désactivée pour qui n'a pas le droit
 * de modifier une tâche, et pendant que l'écriture est en cours.
 */
export const TacheLigne: React.FC<{ t: Tache }> = ({ t }) => {
  const { aujourdhui, nom, moiId, droits, actionsTaches, ouvrir } = useOrg();
  const fini = t.statut === "termine";
  const retard = estEnRetard(t, aujourdhui);
  const qui = nom(t.assignee_id);
  const prioritaire = t.priorite === "urgente" || t.priorite === "haute";
  const occupe = actionsTaches.occupe === `statut-${t.id}`;

  return (
    <div className={`row${fini ? " done" : ""}`}>
      <button
        className="check"
        type="button"
        role="checkbox"
        aria-checked={fini}
        aria-label={`${fini ? "Rouvrir" : "Terminer"} ${t.titre}`}
        disabled={!droits.modifierTache || occupe}
        onClick={() => (fini ? actionsTaches.rouvrir(t.id) : actionsTaches.terminer(t.id))}
      >
        <IcCoche />
      </button>
      <button className="rtxt" type="button" onClick={() => ouvrir({ kind: "tache", id: t.id })}>
        <span className="title">{t.titre}</span>
        <span className="meta">
          {t.numero && <span className="num">{t.numero}</span>}
          {prioritaire && <span className="tag warn">{t.priorite}</span>}
          <span className="who">
            <Avatar id={t.assignee_id} nom={qui} moiId={moiId} taille="xs" />
            {qui}
          </span>
        </span>
      </button>
      <span className="rside">
        <span className={`when${retard ? " crit" : ""}`}>
          {t.echeance
            ? `${retard ? "En retard · " : ""}${relatif(t.echeance, aujourdhui)}`
            : "sans échéance"}
        </span>
        {(droits.modifierTache || droits.attribuerTache) && !fini && (
          <button
            className="dotsbtn"
            type="button"
            aria-label="Actions"
            onClick={() => ouvrir({ kind: "actions", id: t.id })}
          >
            <IcPoints />
          </button>
        )}
      </span>
    </div>
  );
};

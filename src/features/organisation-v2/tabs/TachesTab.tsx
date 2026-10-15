import React, { useMemo, useState } from "react";
import type { Tache } from "../../../lib/taches";
import { estEnRetard } from "../../../lib/taches";
import { useOrg } from "../contexte";
import { ecartJours, relatif } from "../lib/dates";
import { termineeCetteSemaine } from "../lib/stats";
import { Avatar, EtatVide, Segmente } from "../components/elements";
import { IcRecherche } from "../components/icones";
import { TacheLigne } from "../components/TacheLigne";

type Filtre = "ouvertes" | "retard" | "terminees" | "tout";
type Affichage = "liste" | "colonnes";

export const TachesTab: React.FC = () => {
  const { tachesPortee, aujourdhui, chargement, erreurs, droits, ouvrir, nom, moiId } = useOrg();
  const [filtre, setFiltre] = useState<Filtre>("ouvertes");
  const [affichage, setAffichage] = useState<Affichage>("liste");
  const [recherche, setRecherche] = useState("");

  const ouvertes = tachesPortee.filter((t) => t.statut !== "termine");
  const enRetard = ouvertes.filter((t) => estEnRetard(t, aujourdhui));
  const duJour = ouvertes.filter((t) => t.echeance === aujourdhui);
  const faitesSemaine = tachesPortee.filter((t) => termineeCetteSemaine(t, aujourdhui));

  const liste = useMemo(() => {
    let l = tachesPortee;
    if (filtre === "ouvertes") l = l.filter((t) => t.statut !== "termine");
    else if (filtre === "retard") l = l.filter((t) => estEnRetard(t, aujourdhui));
    else if (filtre === "terminees") l = l.filter((t) => t.statut === "termine");
    const q = recherche.trim().toLowerCase();
    if (q) l = l.filter((t) => `${t.titre} ${t.numero ?? ""}`.toLowerCase().includes(q));
    return l;
  }, [tachesPortee, filtre, recherche, aujourdhui]);

  // Les groupes de la maquette, dans son ordre ; un groupe vide disparaît.
  const groupes: [string, Tache[], boolean][] = (
    [
      ["En retard", liste.filter((t) => estEnRetard(t, aujourdhui)), true],
      [
        "Aujourd'hui",
        liste.filter((t) => t.statut !== "termine" && t.echeance === aujourdhui),
        false,
      ],
      [
        "Cette semaine",
        liste.filter(
          (t) =>
            t.statut !== "termine" &&
            !!t.echeance &&
            t.echeance > aujourdhui &&
            ecartJours(aujourdhui, t.echeance) <= 7,
        ),
        false,
      ],
      [
        "Plus tard",
        liste.filter(
          (t) => t.statut !== "termine" && !!t.echeance && ecartJours(aujourdhui, t.echeance) > 7,
        ),
        false,
      ],
      ["Sans échéance", liste.filter((t) => t.statut !== "termine" && !t.echeance), false],
      ["Terminées", liste.filter((t) => t.statut === "termine"), false],
    ] as [string, Tache[], boolean][]
  ).filter(([, rows]) => rows.length > 0);

  const colonnes: [string, string][] = [
    ["À faire", "a_faire"],
    ["En cours", "en_cours"],
    ["Terminées", "termine"],
  ];

  if (erreurs.taches) {
    return <p className="erreur">Les tâches n'ont pas pu être chargées : {erreurs.taches}</p>;
  }

  const premierChargement = chargement.taches && tachesPortee.length === 0;

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <IcRecherche />
          <input
            type="search"
            placeholder="Chercher une tâche"
            aria-label="Chercher une tâche"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>
        <Segmente
          label="Filtrer les tâches"
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { valeur: "ouvertes", libelle: "À faire" },
            { valeur: "retard", libelle: "En retard" },
            { valeur: "terminees", libelle: "Terminées" },
            { valeur: "tout", libelle: "Tout" },
          ]}
        />
        <Segmente
          label="Affichage"
          valeur={affichage}
          onChange={setAffichage}
          options={[
            { valeur: "liste", libelle: "Liste" },
            { valeur: "colonnes", libelle: "Colonnes" },
          ]}
        />
      </div>

      <div className="stats">
        <div className="stat">
          <b>{premierChargement ? "—" : ouvertes.length}</b>
          <small>tâches ouvertes</small>
        </div>
        <div className="stat warn">
          <b>{premierChargement ? "—" : duJour.length}</b>
          <small>à boucler aujourd'hui</small>
        </div>
        <div className="stat crit">
          <b>{premierChargement ? "—" : enRetard.length}</b>
          <small>échéance dépassée</small>
        </div>
        <div className="stat ok">
          <b>{premierChargement ? "—" : faitesSemaine.length}</b>
          <small>terminée{faitesSemaine.length > 1 ? "s" : ""} cette semaine</small>
        </div>
      </div>

      {affichage === "liste" ? (
        <article className="card">
          <div className="rows">
            {premierChargement ? (
              <p className="none">Chargement des tâches…</p>
            ) : tachesPortee.length === 0 ? (
              <>
                <EtatVide
                  neutre
                  titre="Aucune tâche pour l'instant"
                  detail="Ce que l'équipe doit faire apparaîtra ici."
                />
                {droits.creerTache && (
                  <button
                    className="btn sm ghost"
                    type="button"
                    style={{ alignSelf: "flex-start", marginTop: 10 }}
                    onClick={() => ouvrir({ kind: "nouveau", quoi: "tache" })}
                  >
                    + Nouvelle tâche
                  </button>
                )}
              </>
            ) : groupes.length === 0 ? (
              <p className="none">Aucune tâche pour ce filtre</p>
            ) : (
              groupes.map(([libelle, rows, crit]) => (
                <React.Fragment key={libelle}>
                  <div className={`group-h${crit ? " crit" : ""}`}>
                    <span>{libelle}</span>
                    <span className="num">{rows.length}</span>
                  </div>
                  {rows.map((t) => (
                    <TacheLigne key={t.id} t={t} />
                  ))}
                </React.Fragment>
              ))
            )}
          </div>
        </article>
      ) : (
        <div className="board">
          {colonnes.map(([libelle, statut]) => {
            const rows = liste.filter((t) => t.statut === statut);
            return (
              <div className="col" key={statut}>
                <h3>
                  <span>{libelle}</span>
                  <span className="num">{rows.length}</span>
                </h3>
                {rows.length === 0 ? (
                  <p className="none">—</p>
                ) : (
                  rows.map((t) => {
                    const retard = estEnRetard(t, aujourdhui);
                    const qui = nom(t.assignee_id);
                    return (
                      <button
                        key={t.id}
                        className="mini-card"
                        type="button"
                        onClick={() => ouvrir({ kind: "tache", id: t.id })}
                      >
                        <b>{t.titre}</b>
                        <span className="meta">
                          {t.numero && <span className="num">{t.numero}</span>}
                          <span className="who">
                            <Avatar id={t.assignee_id} nom={qui} moiId={moiId} taille="xs" />
                            {qui}
                          </span>
                          {t.echeance && (
                            <span className={`tag ${retard ? "crit" : "grey"}`}>
                              {retard ? "en retard" : relatif(t.echeance, aujourdhui)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

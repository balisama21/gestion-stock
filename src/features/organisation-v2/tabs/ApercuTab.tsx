import React, { useMemo, useState } from "react";
import { estEnRetard } from "../../../lib/taches";
import { heureDe, jourDe } from "../../../lib/evenements";
import { useOrg } from "../contexte";
import {
  ajouterJours,
  JOURS_COURTS,
  JOURS_LONGS,
  majuscule,
  MOIS_LONGS,
  relatif,
  versDate,
} from "../lib/dates";
import { COULEUR_TYPE, elementsEntre, panneauDe, type ElementOrg } from "../lib/elements";
import { recitDe } from "../lib/activite";
import { termineeCetteSemaine } from "../lib/stats";
import { Avatar, EtatVide } from "../components/elements";
import { IcActivite, IcAgenda, IcAlerte, IcArgent, IcEquipe } from "../components/icones";
import { TacheLigne } from "../components/TacheLigne";

export const ApercuTab: React.FC = () => {
  const o = useOrg();
  const { aujourdhui, tachesPortee, sources, droits, nom, ouvrir, allerA } = o;

  const retards = tachesPortee
    .filter((t) => estEnRetard(t, aujourdhui))
    .sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""));
  const ouvrirElement = (e: ElementOrg) => ouvrir(panneauDe(e.ref));

  const echeancesProches = o.echeances
    .filter((l) => l.jour <= ajouterJours(aujourdhui, 6))
    .sort((a, b) => a.jour.localeCompare(b.jour));
  const voitEcheances =
    droits.voitAgenda &&
    (droits.voitModule("achats") || droits.voitModule("devis") || droits.voitModule("livraisons"));

  // ── les sept prochains jours ──
  const [selection, setJourSemaine] = useState<string | null>(null);
  const septJours = Array.from({ length: 7 }, (_, i) => ajouterJours(aujourdhui, i));
  const semaine = elementsEntre(aujourdhui, septJours[6], sources);
  const jourSemaine = selection && septJours.includes(selection) ? selection : aujourdhui;
  const sourcesVisibles = [
    droits.voitTaches && "taches",
    droits.voitAgenda && "evenements",
    droits.voitRappels && "rappels",
  ].filter((cle): cle is keyof typeof o.chargement => Boolean(cle));
  const planningIncomplet = sourcesVisibles.some((cle) => o.erreurs[cle])
    ? "Certaines données du planning sont indisponibles. Vous pouvez actualiser la page."
    : sourcesVisibles.some((cle) => o.chargement[cle])
      ? "Chargement du planning…"
      : null;
  const listeSemaine = semaine.filter((i) => i.jour === jourSemaine);

  // ── qui porte quoi : toutes les tâches visibles, par personne ──
  const charge = useMemo(() => {
    const parPersonne = new Map<string | null, { retard: number; cours: number; faites: number }>();
    for (const t of o.taches) {
      const c = parPersonne.get(t.assignee_id) ?? { retard: 0, cours: 0, faites: 0 };
      if (t.statut === "termine") {
        if (termineeCetteSemaine(t, aujourdhui)) c.faites++;
      } else if (estEnRetard(t, aujourdhui)) c.retard++;
      else c.cours++;
      parPersonne.set(t.assignee_id, c);
    }
    return [...parPersonne.entries()]
      .filter(([, c]) => c.retard + c.cours + c.faites > 0)
      .sort((a, b) => b[1].retard + b[1].cours - (a[1].retard + a[1].cours));
  }, [o.taches, aujourdhui]);

  // ── activité ──
  const activite = useMemo(() => {
    const lignes =
      o.portee === "moi"
        ? o.activite.lignes.filter((l) => {
            if (l.acteur_id === o.moiId) return true;
            const t = o.taches.find((x) => x.id === l.entite_id);
            return t?.assignee_id === o.moiId;
          })
        : o.activite.lignes;
    return lignes.slice(0, 12);
  }, [o.activite.lignes, o.portee, o.moiId, o.taches]);

  const titreTache = (id: string | null, etiquette: string | null) =>
    o.taches.find((t) => t.id === id)?.titre ?? etiquette ?? "une tâche";

  const jour = versDate(jourSemaine);
  const date = majuscule(
    `${JOURS_LONGS[jour.getDay()]} ${jour.getDate()} ${MOIS_LONGS[jour.getMonth()]}`,
  );

  return (
    <>
      <div className="grid org-overview">
        <article className={voitEcheances ? "card s7" : "card s12"}>
          <div className="ch">
            <div>
              <h2>
                <IcAgenda />
                Planning de la semaine
              </h2>
              <p className="org-date">{date}</p>
            </div>
            {droits.voitAgenda && (
              <button
                className="link"
                type="button"
                onClick={() => {
                  o.setJourAgenda(jourSemaine);
                  allerA("agenda");
                }}
              >
                Ouvrir l’agenda
              </button>
            )}
          </div>
          <div className="week">
            {septJours.map((j) => {
              const d = versDate(j);
              const types = [...new Set(semaine.filter((i) => i.jour === j).map((i) => i.type))];
              return (
                <button
                  key={j}
                  type="button"
                  className={`wday${j === aujourdhui ? " today" : ""}${j === jourSemaine ? " sel" : ""}`}
                  aria-label={relatif(j, aujourdhui)}
                  aria-pressed={j === jourSemaine}
                  onClick={() => setJourSemaine(j)}
                >
                  <span className="dw">{majuscule(JOURS_COURTS[d.getDay()].slice(0, 2))}</span>
                  <span className="dn">{d.getDate()}</span>
                  <span className="pts">
                    {types.map((t) => (
                      <i key={t} style={{ background: COULEUR_TYPE[t] }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="rows">
            {planningIncomplet && (
              <p role="status" className="none">
                {planningIncomplet}
              </p>
            )}
            {listeSemaine.length === 0 && !planningIncomplet ? (
              <p className="none">
                {jourSemaine === aujourdhui ? "Journée libre" : "Rien de prévu ce jour-là"}
              </p>
            ) : (
              listeSemaine.map((i) => (
                <button key={i.cle} className="row" type="button" onClick={() => ouvrirElement(i)}>
                  <span className="pt" style={{ background: COULEUR_TYPE[i.type] }} />
                  <span className="rtxt">
                    <span className="title">{i.titre}</span>
                    <span className="meta">{i.sous}</span>
                  </span>
                  <span className={`when${i.enRetard ? " crit" : ""}`}>
                    {i.heure ?? "Toute la journée"}
                  </span>
                </button>
              ))
            )}
          </div>
        </article>

        {voitEcheances && (
          <article className="card s5 org-business">
            <div className="ch">
              <div>
                <h2>
                  <IcArgent />
                  Échéances de la boutique
                </h2>
                <p className="org-date">En retard ou dans les sept prochains jours</p>
              </div>
            </div>
            {echeancesProches.length === 0 ? (
              <p className="none">Aucune échéance à suivre sur cette période.</p>
            ) : (
              <div className="rows">
                {echeancesProches.slice(0, 4).map((ligne) => (
                  <button
                    key={ligne.id}
                    className="row"
                    type="button"
                    onClick={() => ligne.onglet && o.naviguer(ligne.onglet, ligne.recherche)}
                  >
                    <span
                      className="pt"
                      style={{
                        background: ligne.jour < aujourdhui ? "var(--crit)" : "var(--accent)",
                      }}
                    />
                    <span className="rtxt">
                      <span className="title">{ligne.titre}</span>
                      <span className="meta">{ligne.detail}</span>
                    </span>
                    <span className={ligne.jour < aujourdhui ? "when crit" : "when"}>
                      {relatif(ligne.jour, aujourdhui)}
                    </span>
                  </button>
                ))}
                {echeancesProches.length > 4 && (
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      ouvrir({ kind: "echeances", ids: echeancesProches.map((l) => l.id) })
                    }
                  >
                    Voir les {echeancesProches.length} échéances
                  </button>
                )}
              </div>
            )}
          </article>
        )}

        {droits.voitTaches && (
          <article
            className={droits.voitTouteLEquipe && o.portee === "equipe" ? "card s6" : "card s12"}
          >
            <div className="ch">
              <h2>
                <IcAlerte />
                Tâches en retard
              </h2>
              <button className="link" type="button" onClick={() => allerA("taches")}>
                Tout voir
              </button>
            </div>
            <div className="rows">
              {(o.erreurs.taches || o.chargement.taches) && retards.length === 0 ? (
                <p className="none">
                  {o.erreurs.taches ? "Les tâches sont indisponibles." : "Chargement des tâches…"}
                </p>
              ) : retards.length === 0 ? (
                <EtatVide
                  titre="Aucun retard"
                  detail="Aucune tâche ouverte ne dépasse sa date prévue."
                />
              ) : (
                retards.slice(0, 5).map((t) => <TacheLigne key={t.id} t={t} />)
              )}
            </div>
          </article>
        )}

        {droits.voitTaches && droits.voitTouteLEquipe && o.portee === "equipe" && (
          <article className="card s6">
            <div className="ch">
              <h2>
                <IcEquipe />
                Répartition des tâches
              </h2>
            </div>
            {charge.length === 0 ? (
              <EtatVide
                neutre
                titre="Aucune tâche en cours"
                detail="Les tâches attribuées apparaîtront ici."
              />
            ) : (
              <div className="who-rows">
                {charge.map(([id, c]) => {
                  const qui = nom(id);
                  const total = Math.max(1, c.retard + c.cours + c.faites);
                  return (
                    <div className="who-row" key={id ?? "personne"}>
                      <Avatar id={id} nom={qui} moiId={o.moiId} />
                      <div>
                        <span className="nm">{qui}</span>
                        <div className="bar">
                          <i
                            style={{
                              width: `${(c.retard / total) * 100}%`,
                              background: "var(--crit)",
                            }}
                          />
                          <i
                            style={{
                              width: `${(c.cours / total) * 100}%`,
                              background: "var(--accent)",
                            }}
                          />
                          <i
                            style={{
                              width: `${(c.faites / total) * 100}%`,
                              background: "var(--line)",
                            }}
                          />
                        </div>
                        <small>
                          {c.retard > 0 && (
                            <>
                              <b style={{ color: "var(--crit)" }}>{c.retard} en retard</b> ·{" "}
                            </>
                          )}
                          {c.cours} en cours · {c.faites} terminée{c.faites > 1 ? "s" : ""}
                        </small>
                      </div>
                      <button
                        className="btn sm ghost"
                        type="button"
                        onClick={() => {
                          o.setPortee(id === o.moiId ? "moi" : "equipe");
                          allerA("taches");
                        }}
                      >
                        Voir
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="legend">
              <span>
                <i style={{ background: "var(--crit)" }} />
                En retard
              </span>
              <span>
                <i style={{ background: "var(--accent)" }} />
                En cours
              </span>
              <span>
                <i style={{ background: "var(--line)" }} />
                Terminées cette semaine
              </span>
            </div>
          </article>
        )}

        {droits.voitTaches && (
          <details className="card s12 org-history">
            <summary>
              <h2>
                <IcActivite />
                Activité de l'organisation
              </h2>
            </summary>
            <div className="rows">
              {o.activite.erreur ? (
                <p className="none">L'activité n'a pas pu être chargée.</p>
              ) : !o.activite.charge ? (
                <p className="none">Chargement de l'activité…</p>
              ) : activite.length === 0 ? (
                <p className="none">Aucune activité récente sur les tâches</p>
              ) : (
                activite.map((l, k) => {
                  const jour = jourDe(l.cree_le);
                  const precedent = k > 0 ? jourDe(activite[k - 1].cree_le) : null;
                  const r = recitDe(l, nom);
                  const qui = nom(l.acteur_id);
                  return (
                    <React.Fragment key={l.id}>
                      {jour !== precedent && (
                        <div className="group-h">{majuscule(relatif(jour, aujourdhui))}</div>
                      )}
                      <div className="row">
                        <span style={{ justifySelf: "center" }}>
                          <Avatar id={l.acteur_id} nom={qui} moiId={o.moiId} taille="sm" />
                        </span>
                        <span className="rtxt">
                          <span className="title" style={{ fontWeight: 500 }}>
                            <b>{qui}</b> {r.verbe} « {titreTache(l.entite_id, l.etiquette)} »
                            {r.suite ? ` ${r.suite}` : ""}
                          </span>
                        </span>
                        <span className="when num">{heureDe(l.cree_le)}</span>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </details>
        )}
      </div>
    </>
  );
};

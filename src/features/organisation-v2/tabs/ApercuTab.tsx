import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estEnRetard } from "../../../lib/taches";
import { heureDe, jourDe } from "../../../lib/evenements";
import { useOrg } from "../contexte";
import {
  ajouterJours,
  ecartJours,
  heureMinute,
  JOURS_COURTS,
  JOURS_LONGS,
  majuscule,
  MOIS_LONGS,
  relatif,
  versDate,
} from "../lib/dates";
import {
  CLASSE_TYPE,
  COULEUR_TYPE,
  elementsEntre,
  panneauDe,
  type ElementOrg,
} from "../lib/elements";
import { recitDe } from "../lib/activite";
import { termineeCetteSemaine } from "../lib/stats";
import { Avatar, EtatVide } from "../components/elements";
import {
  IcActivite,
  IcAgenda,
  IcAlerte,
  IcArgent,
  IcEquipe,
  IcHorloge,
  IcTache,
} from "../components/icones";
import { TacheLigne } from "../components/TacheLigne";

/** Les heures du fil de la journée, comme dans la maquette. */
const H0 = 8;
const H1 = 19;

export const ApercuTab: React.FC = () => {
  const o = useOrg();
  const { aujourdhui, maintenant, tachesPortee, sources, droits, nom, ouvrir, allerA } = o;

  const ouvertes = tachesPortee.filter((t) => t.statut !== "termine");
  const retards = ouvertes.filter((t) => estEnRetard(t, aujourdhui));
  const duJour = ouvertes.filter((t) => t.echeance === aujourdhui);
  const ouvrirElement = (e: ElementOrg) => ouvrir(panneauDe(e.ref));

  // ── prochain rendez-vous : un événement qui n'a pas encore commencé ──
  const prochainRdv = useMemo(() => {
    const fin = ajouterJours(aujourdhui, 30);
    return (
      o.evenements
        .filter((e) => {
          const j = jourDe(e.debut);
          if (j < aujourdhui || j > fin) return false;
          return e.journee_entiere ? true : new Date(e.debut) >= maintenant;
        })
        .sort((a, b) => a.debut.localeCompare(b.debut))[0] ?? null
    );
  }, [o.evenements, aujourdhui, maintenant]);
  const rdvDuJour = o.evenements.filter((e) => jourDe(e.debut) === aujourdhui).length;

  // ── échéances à régler : en retard ou dans les sept jours ──
  const echeancesProches = o.echeances
    .filter((l) => ecartJours(aujourdhui, l.jour) <= 7)
    .sort((a, b) => a.jour.localeCompare(b.jour));
  const echeancesEnRetard = echeancesProches.filter((l) => l.jour < aujourdhui).length;
  const voitEcheances =
    droits.voitAgenda &&
    (droits.voitModule("achats") || droits.voitModule("devis") || droits.voitModule("livraisons"));

  const premiereRetard = retards
    .slice()
    .sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""))[0];

  // ── bandeau défilant sur téléphone : les points sous les tuiles ──
  const rail = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState({ n: 0, courant: 0 });
  const peindre = useCallback(() => {
    const r = rail.current;
    if (!r) return;
    const tuiles = Array.from(r.children) as HTMLElement[];
    if (r.scrollWidth - r.clientWidth < 4 || tuiles.length < 2) {
      setPoints({ n: 0, courant: 0 });
      return;
    }
    const pas = tuiles[1].offsetLeft - tuiles[0].offsetLeft || r.clientWidth;
    setPoints({ n: tuiles.length, courant: Math.round(r.scrollLeft / Math.max(1, pas)) });
  }, []);
  useEffect(() => {
    peindre();
    window.addEventListener("resize", peindre);
    return () => window.removeEventListener("resize", peindre);
  }, [peindre]);
  const allerALaTuile = (i: number) => {
    const r = rail.current;
    if (!r) return;
    const tuiles = Array.from(r.children) as HTMLElement[];
    const pas = tuiles.length > 1 ? tuiles[1].offsetLeft - tuiles[0].offsetLeft : r.clientWidth;
    r.scrollTo({ left: i * pas, behavior: "smooth" });
  };

  // ── fil de la journée ──
  const duJourItems = elementsEntre(aujourdhui, aujourdhui, sources);
  const heureMaintenant = maintenant.getHours();

  // ── les sept prochains jours ──
  const [jourSemaine, setJourSemaine] = useState<string | null>(null);
  const septJours = Array.from({ length: 7 }, (_, i) => ajouterJours(aujourdhui, i));
  const semaine = elementsEntre(aujourdhui, septJours[6], sources);
  const listeSemaine = jourSemaine
    ? semaine.filter((i) => i.jour === jourSemaine)
    : semaine.slice(0, 5);

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

  const enteteJour = `${JOURS_LONGS[maintenant.getDay()]} ${maintenant.getDate()} ${MOIS_LONGS[maintenant.getMonth()]} · ${heureMinute(maintenant)}`;

  return (
    <>
      <div className="today">
        <h2>
          Aujourd'hui <span>{enteteJour}</span>
        </h2>
        <div className="rail" ref={rail} onScroll={peindre}>
          {droits.voitTaches && (
            <article className="tile">
              <div className="th">
                <span className="ti">
                  <IcTache />À boucler aujourd'hui
                </span>
                <button
                  className="go"
                  type="button"
                  aria-label="Ouvrir les tâches"
                  onClick={() => allerA("taches")}
                >
                  →
                </button>
              </div>
              <div className="tv num">{duJour.length}</div>
              <p className="tp">
                {duJour.length ? `${duJour[0].titre}.` : "Rien à boucler avant ce soir."}
              </p>
              {duJour.length > 0 && (
                <div className="tfoot">
                  <small>
                    Assignée à <b>{nom(duJour[0].assignee_id)}</b>
                  </small>
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={() => ouvrir({ kind: "tache", id: duJour[0].id })}
                  >
                    Ouvrir
                  </button>
                </div>
              )}
            </article>
          )}

          {droits.voitTaches && (
            <article className="tile">
              <div className="th">
                <span className="ti">
                  <IcAlerte />
                  En retard
                </span>
                <button
                  className="go"
                  type="button"
                  aria-label="Ouvrir les tâches en retard"
                  onClick={() => allerA("taches")}
                >
                  →
                </button>
              </div>
              <div className={`tv num${retards.length ? " crit" : ""}`}>{retards.length}</div>
              <p className="tp">
                {premiereRetard?.echeance
                  ? `${premiereRetard.titre} — échéance dépassée depuis ${ecartJours(premiereRetard.echeance, aujourdhui)} jour${ecartJours(premiereRetard.echeance, aujourdhui) > 1 ? "s" : ""}.`
                  : "Toutes les échéances sont tenues."}
              </p>
              {premiereRetard && (
                <div className="tfoot">
                  <small>
                    Portée par <b>{nom(premiereRetard.assignee_id)}</b>
                  </small>
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => ouvrir({ kind: "tache", id: premiereRetard.id })}
                  >
                    Traiter
                  </button>
                </div>
              )}
            </article>
          )}

          {droits.voitAgenda && (
            <article className="tile">
              <div className="th">
                <span className="ti">
                  <IcAgenda />
                  Prochain rendez-vous
                </span>
                <button
                  className="go"
                  type="button"
                  aria-label="Ouvrir l'agenda"
                  onClick={() => allerA("agenda")}
                >
                  →
                </button>
              </div>
              <div className="tv num">
                {prochainRdv ? (
                  <>
                    {majuscule(JOURS_COURTS[versDate(jourDe(prochainRdv.debut)).getDay()])}
                    <small>
                      {prochainRdv.journee_entiere ? "journée" : heureDe(prochainRdv.debut)}
                    </small>
                  </>
                ) : (
                  "—"
                )}
              </div>
              <p className="tp">
                {prochainRdv
                  ? `${prochainRdv.titre}${prochainRdv.lieu ? `, à ${prochainRdv.lieu}` : ""}.`
                  : "Aucun rendez-vous dans les trente prochains jours."}
              </p>
              <div className="tfoot">
                <small>
                  {rdvDuJour ? (
                    <>
                      <b>{rdvDuJour}</b> aujourd'hui
                    </>
                  ) : (
                    <>
                      Rien de prévu <b>aujourd'hui</b>
                    </>
                  )}
                </small>
                {prochainRdv && (
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={() => ouvrir({ kind: "evenement", id: prochainRdv.id })}
                  >
                    Voir
                  </button>
                )}
              </div>
            </article>
          )}

          {voitEcheances && (
            <article className="tile">
              <div className="th">
                <span className="ti">
                  <IcArgent />
                  Échéances à régler
                </span>
                <button
                  className="go"
                  type="button"
                  aria-label="Voir les échéances"
                  onClick={() => allerA("agenda")}
                >
                  →
                </button>
              </div>
              <div className={`tv num${echeancesEnRetard ? " crit" : ""}`}>
                {echeancesProches.length}
              </div>
              <p className="tp">
                {echeancesProches.length
                  ? `${echeancesProches
                      .slice(0, 2)
                      .map((l) => l.titre)
                      .join(", ")}${echeancesProches.length > 2 ? "…" : "."}`
                  : "Rien à régler dans les sept prochains jours."}
              </p>
              {echeancesProches.length > 0 && (
                <div className="tfoot">
                  <small>
                    {echeancesEnRetard ? (
                      <>
                        <b>{echeancesEnRetard}</b> en retard
                      </>
                    ) : (
                      <>
                        Rien <b>en retard</b>
                      </>
                    )}
                  </small>
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={() =>
                      ouvrir({ kind: "echeances", ids: echeancesProches.map((l) => l.id) })
                    }
                  >
                    Détail
                  </button>
                </div>
              )}
            </article>
          )}
        </div>
        {points.n > 0 && (
          <div className="dots" aria-hidden="true">
            {Array.from({ length: points.n }, (_, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                aria-current={i === points.courant}
                onClick={() => allerALaTuile(i)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid">
        <article className="card s7">
          <div className="ch">
            <h2>
              <IcHorloge />
              Fil de la journée
            </h2>
            {droits.voitAgenda && (
              <button className="link" type="button" onClick={() => allerA("agenda")}>
                Ouvrir l'agenda
              </button>
            )}
          </div>
          {duJourItems.length === 0 ? (
            <EtatVide
              titre="Journée libre"
              detail="Aucun rendez-vous, aucune échéance aujourd'hui."
            />
          ) : (
            <div className="day-line">
              {Array.from({ length: H1 - H0 + 1 }, (_, k) => H0 + k).map((h) => {
                const creneau = duJourItems.filter((i) => {
                  const hh = i.heure ? Number(i.heure.slice(0, 2)) : H0;
                  return Math.min(Math.max(hh, H0), H1) === h;
                });
                if (!creneau.length && h !== heureMaintenant && h % 2) return null;
                return (
                  <div key={h} className={`slot${h === heureMaintenant ? " now" : ""}`}>
                    <div className="h">{String(h).padStart(2, "0")}:00</div>
                    <div className="body">
                      {creneau.map((i) => (
                        <button
                          key={i.cle}
                          type="button"
                          className={`ev ${CLASSE_TYPE[i.type]}`}
                          onClick={() => ouvrirElement(i)}
                        >
                          <span className="bar" />
                          <span className="tx">
                            <b>{i.titre}</b>
                            <small>
                              {i.sous}
                              {i.heure ? ` · ${i.heure}` : ""}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="card s5">
          <div className="ch">
            <h2>
              <IcAgenda />
              Les sept prochains jours
            </h2>
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
                  onClick={() => setJourSemaine(jourSemaine === j ? null : j)}
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
            {listeSemaine.length === 0 ? (
              <p className="none">Rien de prévu {jourSemaine ? "ce jour-là" : "cette semaine"}</p>
            ) : (
              listeSemaine.map((i) => (
                <button key={i.cle} className="row" type="button" onClick={() => ouvrirElement(i)}>
                  <span className="pt" style={{ background: COULEUR_TYPE[i.type] }} />
                  <span className="rtxt">
                    <span className="title">{i.titre}</span>
                    <span className="meta">{i.sous}</span>
                  </span>
                  <span className={`when${i.enRetard ? " crit" : ""}`}>
                    {relatif(i.jour, aujourdhui)}
                    {i.heure ? ` · ${i.heure}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        </article>

        {droits.voitTaches && (
          <article className="card s6">
            <div className="ch">
              <h2>
                <IcAlerte />
                En retard
              </h2>
              <button className="link" type="button" onClick={() => allerA("taches")}>
                Tout voir
              </button>
            </div>
            <div className="rows">
              {retards.length === 0 ? (
                <EtatVide titre="Aucun retard" detail="Toutes les échéances sont tenues." />
              ) : (
                retards.map((t) => <TacheLigne key={t.id} t={t} />)
              )}
            </div>
          </article>
        )}

        {droits.voitTaches && droits.voitTouteLEquipe && (
          <article className="card s6">
            <div className="ch">
              <h2>
                <IcEquipe />
                Qui porte quoi
              </h2>
            </div>
            {charge.length === 0 ? (
              <EtatVide
                neutre
                titre="Aucune tâche en cours"
                detail="Personne n'a rien sur le feu."
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
          <article className="card s12">
            <div className="ch">
              <h2>
                <IcActivite />
                Activité de l'organisation
              </h2>
            </div>
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
          </article>
        )}
      </div>
    </>
  );
};

import React, { useMemo, useState } from "react";
import { useOrg } from "../contexte";
import {
  ajouterJours,
  ajouterMoisAuPremier,
  dateLongue,
  grilleDe,
  JOURS_COURTS,
  lundiDe,
  majuscule,
  MOIS_LONGS,
  versDate,
} from "../lib/dates";
import {
  CLASSE_TYPE,
  COULEUR_TYPE,
  elementsEntre,
  panneauDe,
  TOUS_LES_TYPES,
  type ElementOrg,
  type TypesAffiches,
} from "../lib/elements";
import { EtatVide, Segmente } from "../components/elements";
import { IcPrecedent, IcSuivant } from "../components/icones";

type VueCal = "jour" | "semaine" | "mois";

/** Les heures du calendrier, comme dans la maquette. */
const H0 = 7;
const H1 = 20;

const FILTRES: { cle: keyof TypesAffiches; libelle: string; couleur: string }[] = [
  { cle: "rendez_vous", libelle: "Rendez-vous & réunions", couleur: "var(--accent-soft)" },
  { cle: "tache", libelle: "Échéances de tâches", couleur: "var(--info-soft)" },
  { cle: "rappel", libelle: "Rappels", couleur: "var(--warn-soft)" },
  { cle: "echeance", libelle: "Échéances boutique", couleur: "var(--crit-soft)" },
];

const heureNum = (h: string): number => Number(h.slice(0, 2)) + Number(h.slice(3, 5)) / 60;

export const AgendaTab: React.FC = () => {
  const { sources, aujourdhui, maintenant, jourAgenda, setJourAgenda, droits, ouvrir, erreurs } =
    useOrg();
  const [vue, setVue] = useState<VueCal>("mois");
  const [curseur, setCurseur] = useState(jourAgenda);
  const [types, setTypes] = useState<TypesAffiches>(TOUS_LES_TYPES);

  const sel = jourAgenda;
  const entre = (a: string, b: string) => elementsEntre(a, b, sources, types);
  const ouvrirElement = (e: ElementOrg) => ouvrir(panneauDe(e.ref));

  const reculer = () => {
    if (vue === "mois") return setCurseur(ajouterMoisAuPremier(curseur, -1));
    const c = ajouterJours(curseur, vue === "semaine" ? -7 : -1);
    setCurseur(c);
    setJourAgenda(c);
  };
  const avancer = () => {
    if (vue === "mois") return setCurseur(ajouterMoisAuPremier(curseur, 1));
    const c = ajouterJours(curseur, vue === "semaine" ? 7 : 1);
    setCurseur(c);
    setJourAgenda(c);
  };
  const choisirJour = (j: string) => {
    setJourAgenda(j);
    if (vue === "mois") setCurseur(j);
  };

  // ── titre de la période ──
  const dCurseur = versDate(curseur);
  const lundi = lundiDe(curseur);
  const dimanche = ajouterJours(lundi, 6);
  const titre =
    vue === "mois"
      ? `${MOIS_LONGS[dCurseur.getMonth()]} ${dCurseur.getFullYear()}`
      : vue === "semaine"
        ? `${versDate(lundi).getDate()} – ${versDate(dimanche).getDate()} ${MOIS_LONGS[versDate(dimanche).getMonth()]}`
        : majuscule(dateLongue(sel));

  const duJourChoisi = useMemo(
    () => elementsEntre(sel, sel, sources, types),
    [sel, sources, types],
  );

  let corps: React.ReactNode;
  if (vue === "mois") {
    const cases = grilleDe(curseur);
    const items = entre(cases[0], cases[41]);
    corps = (
      <div className="month">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div className="dw" key={i}>
            {d}
          </div>
        ))}
        {cases.map((j) => {
          const jour = items.filter((x) => x.jour === j);
          const dj = versDate(j);
          const dehors = dj.getMonth() !== dCurseur.getMonth();
          return (
            <button
              key={j}
              type="button"
              className={`mday${dehors ? " out" : ""}${j === aujourdhui ? " today" : ""}${j === sel ? " sel" : ""}`}
              onClick={() => choisirJour(j)}
              aria-label={dateLongue(j)}
            >
              <span className="n">{dj.getDate()}</span>
              {jour.slice(0, 2).map((x) => (
                <span key={x.cle} className={`chipev ${CLASSE_TYPE[x.type]}`}>
                  {x.heure ? `${x.heure} ` : ""}
                  {x.titre}
                </span>
              ))}
              {jour.length > 2 && <span className="chipev more">+{jour.length - 2}</span>}
            </button>
          );
        })}
      </div>
    );
  } else if (vue === "semaine") {
    const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
    const items = entre(jours[0], jours[6]);
    corps = (
      <div className="wgrid">
        <div className="hcol">
          <span style={{ height: 46 }} />
          {Array.from({ length: H1 - H0 }, (_, i) => (
            <span key={i}>{String(H0 + i).padStart(2, "0")}:00</span>
          ))}
        </div>
        {jours.map((j) => {
          const dj = versDate(j);
          return (
            <div key={j} className={`wcol${j === aujourdhui ? " today" : ""}`}>
              <button className="wh" type="button" onClick={() => choisirJour(j)}>
                <small>{JOURS_COURTS[dj.getDay()]}</small>
                <b>{dj.getDate()}</b>
              </button>
              {Array.from({ length: H1 - H0 }, (_, i) => (
                <div className="wslot" key={i} />
              ))}
              {items
                .filter((x) => x.jour === j)
                .map((x) => {
                  const h = x.heure ? heureNum(x.heure) : H0;
                  const borne = Math.min(Math.max(h, H0), H1 - 1);
                  return (
                    <button
                      key={x.cle}
                      type="button"
                      className={`wev ${CLASSE_TYPE[x.type]}`}
                      style={{ top: 46 + (borne - H0) * 40 }}
                      onClick={() => ouvrirElement(x)}
                    >
                      <b>{x.heure ?? ""}</b> {x.titre}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    );
  } else {
    const journee = duJourChoisi.filter((i) => !i.heure);
    const horaires = duJourChoisi.filter((i) => i.heure);
    const heureMaintenant = maintenant.getHours();
    corps = (
      <>
        {journee.length > 0 && (
          <div className="allday">
            {journee.map((i) => (
              <button
                key={i.cle}
                type="button"
                className={`chipev ${CLASSE_TYPE[i.type]}`}
                onClick={() => ouvrirElement(i)}
              >
                {i.titre}
              </button>
            ))}
          </div>
        )}
        <div className="day-line" style={{ marginTop: 10 }}>
          {Array.from({ length: H1 - H0 + 1 }, (_, k) => H0 + k).map((h) => {
            // Ce qui tombe avant 7 h ou après 20 h se range dans la
            // première ou la dernière case, plutôt que de disparaître.
            const creneau = horaires.filter((i) => {
              const hh = Math.min(Math.max(Math.floor(heureNum(i.heure!)), H0), H1);
              return hh === h;
            });
            return (
              <div
                key={h}
                className={`slot${sel === aujourdhui && h === heureMaintenant ? " now" : ""}`}
              >
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
                          {i.sous} · {i.heure}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cal-top">
        <div className="cal-nav">
          <button
            className="navbtn"
            type="button"
            aria-label="Période précédente"
            onClick={reculer}
          >
            <IcPrecedent />
          </button>
          <b>{titre}</b>
          <button className="navbtn" type="button" aria-label="Période suivante" onClick={avancer}>
            <IcSuivant />
          </button>
          <button
            className="pill"
            type="button"
            onClick={() => {
              setCurseur(aujourdhui);
              setJourAgenda(aujourdhui);
            }}
          >
            Aujourd'hui
          </button>
        </div>
        <Segmente
          label="Vue du calendrier"
          valeur={vue}
          onChange={(v) => {
            setVue(v);
            if (v !== "mois") setCurseur(sel);
          }}
          options={[
            { valeur: "jour", libelle: "Jour" },
            { valeur: "semaine", libelle: "Semaine" },
            { valeur: "mois", libelle: "Mois" },
          ]}
        />
      </div>

      <div className="toolbar" role="group" aria-label="Types affichés">
        {FILTRES.map((f) => (
          <button
            key={f.cle}
            className="pill"
            type="button"
            aria-pressed={types[f.cle]}
            onClick={() => setTypes({ ...types, [f.cle]: !types[f.cle] })}
          >
            <i className="sw" style={{ background: f.couleur }} />
            {f.libelle}
          </button>
        ))}
      </div>

      {erreurs.evenements && (
        <p className="erreur">Les événements n'ont pas pu être chargés : {erreurs.evenements}</p>
      )}

      <article className="card">{corps}</article>

      <article className="card">
        <div className="ch">
          <h2>
            {majuscule(dateLongue(sel))}
            {sel === aujourdhui ? " · aujourd'hui" : ""}
          </h2>
          {droits.creerEvenement && (
            <button
              className="btn sm ghost"
              type="button"
              onClick={() => ouvrir({ kind: "nouveau", quoi: "evenement", jour: sel })}
            >
              + Événement
            </button>
          )}
        </div>
        <div className="rows">
          {duJourChoisi.length === 0 ? (
            <EtatVide
              titre="Rien de prévu"
              detail="Aucun rendez-vous, aucune échéance ce jour-là."
            />
          ) : (
            duJourChoisi.map((i) => (
              <button key={i.cle} className="row" type="button" onClick={() => ouvrirElement(i)}>
                <span className="pt" style={{ background: COULEUR_TYPE[i.type] }} />
                <span className="rtxt">
                  <span className="title">{i.titre}</span>
                  <span className="meta">{i.sous}</span>
                </span>
                <span className={`when num${i.enRetard ? " crit" : ""}`}>
                  {i.heure ?? "journée"}
                </span>
              </button>
            ))
          )}
        </div>
      </article>
    </>
  );
};

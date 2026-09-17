import React, { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { dateLocale } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import { agendaDuMois, joursDuMois, prochainsDepuis, type SourcesAgenda } from "../lib/agenda";

/**
 * 3. AGENDA — le calendrier de bureau
 *
 * Quatre sources réunies (voir `lib/agenda.ts`) : événements, échéances
 * de tâches, livraisons prévues et rappels autonomes. Une pastille par
 * élément sous le quantième, trois au plus — au-delà, la rangée de
 * points cesse de se compter d'un coup d'œil et ne dit plus que
 * « beaucoup ».
 *
 * LE CLIC SUR UN JOUR ne navigue pas : il fait glisser la liste du bas
 * à partir de ce jour-là. On regarde la semaine prochaine sans quitter
 * le tableau de bord, et la flèche de l'en-tête reste le seul chemin
 * vers l'agenda complet.
 */

const FLECHE = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

export const CarteAgenda: React.FC<{
  sources: SourcesAgenda;
  onOuvrir?: () => void;
}> = ({ sources, onOuvrir }) => {
  const aujourdhui = dateDuJour();
  const [annee, mois] = useMemo(() => {
    const d = dateLocale(aujourdhui);
    return [d.getFullYear(), d.getMonth()] as const;
  }, [aujourdhui]);

  const [selection, setSelection] = useState<string | null>(null);

  const table = useMemo(
    () => agendaDuMois(sources, annee, mois, aujourdhui),
    [sources, annee, mois, aujourdhui],
  );
  const jours = useMemo(() => joursDuMois(annee, mois), [annee, mois]);

  // Le lundi ouvre la semaine : `getDay()` compte à partir du dimanche,
  // d'où le décalage. Sans lui, tout le mois glisse d'une colonne.
  const premier = dateLocale(jours[0]).getDay();
  const vides = (premier + 6) % 7;

  const prochains = prochainsDepuis(table, selection ?? aujourdhui, 3);
  const nomDuMois = dateLocale(jours[0]).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card span={4} id="carte-agenda" className="agenda">
      <div className="cal-head">
        <div>
          <b>{nomDuMois}</b>
          <br />
          <small>Agenda de la boutique</small>
        </div>
        {onOuvrir && (
          <button className="nav-btn" type="button" onClick={onOuvrir} aria-label="Ouvrir l'agenda">
            {FLECHE}
          </button>
        )}
      </div>

      <div className="cal">
        {JOURS.map((j, i) => (
          <div className="dow" key={i}>
            {j}
          </div>
        ))}
        {Array.from({ length: vides }, (_, i) => (
          <div key={`v${i}`} />
        ))}
        {jours.map((jour) => {
          const items = table.get(jour) ?? [];
          const quantieme = Number(jour.slice(8));
          const classes = [
            "d",
            jour < aujourdhui ? "past" : "",
            jour === aujourdhui ? "today" : "",
            jour === selection ? "sel" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={jour}
              type="button"
              className={classes}
              onClick={() => setSelection(jour)}
              aria-label={`${quantieme} ${nomDuMois}${items.length ? `, ${items.length} élément(s)` : ""}`}
            >
              {quantieme}
              {items.length > 0 && (
                <span className="ev">
                  {items.slice(0, 3).map((it) => (
                    <i key={it.id} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="evlist">
        {prochains.length === 0 ? (
          <div className="evi">
            <div className="dd">
              <b>—</b>
            </div>
            <div>
              <span>Rien de prévu</span>
              <em>Journée libre</em>
            </div>
          </div>
        ) : (
          prochains.map((it) => (
            <div className="evi" key={it.id}>
              <div className="dd">
                <b>{Number(it.jour.slice(8))}</b>
                <small>{dateLocale(it.jour).toLocaleDateString("fr-FR", { month: "short" })}</small>
              </div>
              <div>
                <span>{it.titre}</span>
                <em>{it.precision}</em>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

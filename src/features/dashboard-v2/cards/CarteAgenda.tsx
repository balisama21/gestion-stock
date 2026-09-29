import React, { useMemo, useState } from "react";
import { Icone } from "../../../components/shared/Icone";
import { BoutonRepli } from "../components/BoutonRepli";
import { Lead, TeteCarte } from "../components/Tn";
import { dateLocale, pluriel } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import { agendaDuMois, joursDuMois, prochainsDepuis, type SourcesAgenda } from "../lib/agenda";
import { useRepli } from "../lib/repli";
import { illCalendrier } from "../assets/images";

/**
 * AGENDA — le mois de la boutique
 *
 * Quatre sources réunies (voir `lib/agenda.ts`) : événements, échéances
 * de tâches, livraisons prévues et rappels autonomes. Les flèches
 * changent de mois ; le calendrier du mois se déplie sous le titre, et
 * un jour choisi fait commencer la liste à ce jour-là.
 */

const CLE_REPLI = "tantana.dash.agenda-replie";

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

export const CarteAgenda: React.FC<{
  sources: SourcesAgenda;
  onOuvrir?: () => void;
}> = ({ sources, onOuvrir }) => {
  const aujourdhui = dateDuJour();
  const [decalage, setDecalage] = useState(0);
  const [annee, mois] = useMemo(() => {
    const d = dateLocale(aujourdhui);
    const m = new Date(d.getFullYear(), d.getMonth() + decalage, 1);
    return [m.getFullYear(), m.getMonth()] as const;
  }, [aujourdhui, decalage]);

  const [selection, setSelection] = useState<string | null>(null);
  const { replie, basculer } = useRepli(CLE_REPLI);

  const table = useMemo(
    () => agendaDuMois(sources, annee, mois, aujourdhui),
    [sources, annee, mois, aujourdhui],
  );
  const jours = useMemo(() => joursDuMois(annee, mois), [annee, mois]);

  const premier = dateLocale(jours[0]).getDay();
  const vides = (premier + 6) % 7;

  // Le point de départ de la liste : le jour choisi, sinon aujourd'hui
  // pour le mois courant, sinon le premier du mois affiché.
  const depart =
    selection && selection.slice(0, 7) === jours[0].slice(0, 7)
      ? selection
      : decalage === 0
        ? aujourdhui
        : jours[0];
  const aVenir = [...table.entries()]
    .filter(([jour]) => jour >= depart)
    .reduce((n, [, items]) => n + items.length, 0);
  const prochains = prochainsDepuis(table, depart, 3);

  const nomDuMois = dateLocale(jours[0]).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const titre = nomDuMois.charAt(0).toUpperCase() + nomDuMois.slice(1);

  const changer = (n: number) => {
    setDecalage((d) => d + n);
    setSelection(null);
  };

  return (
    <article className="card agenda" id="carte-agenda">
      <TeteCarte
        lead={<Lead nom="calendar" />}
        grand
        titre={
          <span className="titre-mois">
            {titre}
            <BoutonRepli
              replie={replie}
              onBasculer={basculer}
              quoi="le calendrier"
              className="plier-mini"
            />
          </span>
        }
        sous={
          aVenir > 0
            ? `Agenda de la boutique · ${pluriel(aVenir, "élément")} à venir`
            : "Agenda de la boutique"
        }
        action={
          <div className="nav2">
            <button type="button" aria-label="Mois précédent" onClick={() => changer(-1)}>
              <Icone nom="chevleft" />
            </button>
            <button type="button" aria-label="Mois suivant" onClick={() => changer(1)}>
              <Icone nom="chevright" />
            </button>
          </div>
        }
      />

      {/* Retiré du DOM, et non masqué : ses trente boutons resteraient
          atteignables au clavier dans une carte pourtant repliée. */}
      {!replie && (
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
                aria-label={`${quantieme} ${nomDuMois}${items.length ? `, ${pluriel(items.length, "élément")}` : ""}`}
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
      )}

      <div className="row">
        <div className="evlist">
          {prochains.length === 0 ? (
            <div className="evi">
              <div className="dash">–</div>
              <div>
                <b>Rien de prévu</b>
                <div className="sub">Journée libre</div>
              </div>
            </div>
          ) : (
            prochains.map((it) => (
              <button type="button" className="evi" key={it.id} onClick={onOuvrir}>
                <div className="dash">
                  <b>{Number(it.jour.slice(8))}</b>
                  <small>
                    {dateLocale(it.jour).toLocaleDateString("fr-FR", { month: "short" })}
                  </small>
                </div>
                <div className="txt">
                  <b>{it.titre}</b>
                  <div className="sub">{it.precision}</div>
                </div>
              </button>
            ))
          )}
        </div>
        {prochains.length <= 1 && <img className="art-cal" src={illCalendrier} alt="" />}
      </div>
      {onOuvrir && prochains.length > 1 && (
        <button type="button" className="link bas" onClick={onOuvrir}>
          Tout le mois
        </button>
      )}
    </article>
  );
};

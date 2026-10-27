import React, { useMemo, useState } from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { BoutonRepli } from "../components/BoutonRepli";
import { Lead, TeteCarte } from "../components/Tn";
import { dateLocale, pluriel } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import {
  agendaDuMois,
  joursDuMois,
  prochainsDepuis,
  type ItemAgenda,
  type NatureAgenda,
  type SourcesAgenda,
} from "../lib/agenda";
import { useRepli } from "../lib/repli";
import { IllAgenda } from "../operations/Illustrations";

/**
 * AGENDA — le mois de la boutique
 *
 * Quatre sources réunies (voir `lib/agenda.ts`) : événements, échéances
 * de tâches, livraisons prévues et rappels autonomes. Les flèches
 * changent de mois ; le calendrier du mois se déplie sous le titre, et
 * un jour choisi fait commencer la liste à ce jour-là.
 *
 * À droite, le calendrier de bureau illustré montre le même mois : le
 * jour cerclé, les jours chargés pointés, et le carnet « Aujourd'hui »
 * ce qui est vraiment prévu ce jour.
 */

const CLE_REPLI = "tantana.dash.agenda-replie";

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

const ICONE_NATURE: Record<NatureAgenda, NomIcone> = {
  evenement: "calendar",
  tache: "tasks",
  livraison: "truck",
  rappel: "bell",
};

/** « 09:00 » quand la précision porte une heure, sinon rien. */
const heureDe = (precision: string): string | null => precision.match(/\d{2}:\d{2}/)?.[0] ?? null;

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

  /** Ce qui est prévu aujourd'hui, pour le carnet du dessin. */
  const duJour = useMemo(() => {
    if (aujourdhui.slice(0, 7) === jours[0].slice(0, 7)) {
      return (table.get(aujourdhui) ?? []).map((it) => it.titre);
    }
    // Un autre mois est affiché : le carnet lit quand même aujourd'hui.
    const d = dateLocale(aujourdhui);
    const courant = agendaDuMois(sources, d.getFullYear(), d.getMonth(), aujourdhui);
    return (courant.get(aujourdhui) ?? []).map((it) => it.titre);
  }, [table, jours, aujourdhui, sources]);
  const charges = useMemo(() => new Set(table.keys()), [table]);

  const changer = (n: number) => {
    setDecalage((d) => d + n);
    setSelection(null);
  };

  const quand = (it: ItemAgenda) => {
    if (it.jour === aujourdhui) return "Aujourd'hui";
    return dateLocale(it.jour).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  return (
    <article className="card agenda op-carte" id="carte-agenda">
      <TeteCarte
        lead={<Lead nom="calendar" />}
        grand
        titre={
          <span className="titre-mois">
            {onOuvrir ? (
              <button type="button" className="op-titre-lien" onClick={onOuvrir}>
                Agenda de la boutique
              </button>
            ) : (
              "Agenda de la boutique"
            )}
            <BoutonRepli
              replie={replie}
              onBasculer={basculer}
              quoi="le calendrier"
              className="plier-mini"
            />
          </span>
        }
        action={
          <div className="nav2">
            <button type="button" aria-label="Mois précédent" onClick={() => changer(-1)}>
              <Icone nom="chevleft" />
            </button>
            <span className="mois" aria-live="polite">
              {titre}
            </span>
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

      <div className="op-corps">
        <div className="op-contenu">
          <div className="op-label">
            Prochaines activités
            {aVenir > 0 && <span>{pluriel(aVenir, "élément")} à venir</span>}
          </div>
          {prochains.length === 0 ? (
            <div className="op-vide">
              <span className="op-vide-ic">
                <Icone nom="leaf" />
              </span>
              <div>
                <b>Rien de prévu</b>
                <span>
                  {decalage === 0 && !selection
                    ? "Journée libre : aucune activité planifiée."
                    : "Aucune activité planifiée sur cette période."}
                </span>
              </div>
            </div>
          ) : (
            <div className="op-liste">
              {prochains.map((it) => {
                const heure = heureDe(it.precision);
                const detail = heure
                  ? it.precision.replace(heure, "").replace(/\s*·\s*$/, "")
                  : it.precision;
                return (
                  <button
                    type="button"
                    className="op-ligne"
                    key={it.id}
                    onClick={onOuvrir}
                    disabled={!onOuvrir}
                  >
                    <span className="op-ic">
                      <Icone nom={ICONE_NATURE[it.nature]} />
                    </span>
                    <span className="op-txt">
                      <b>
                        {heure && <em className="num">{heure}</em>}
                        {it.titre}
                      </b>
                      <small>
                        {quand(it)}
                        {detail ? ` · ${detail}` : ""}
                      </small>
                    </span>
                    {onOuvrir && <Icone nom="chevright" className="op-chev" />}
                  </button>
                );
              })}
            </div>
          )}
          {onOuvrir && prochains.length > 1 && (
            <button type="button" className="link bas" onClick={onOuvrir}>
              Tout le mois
            </button>
          )}
        </div>
        <div className="op-ill">
          <IllAgenda
            titreMois={titre}
            jours={jours}
            aujourdhui={aujourdhui}
            charges={charges}
            notes={duJour}
          />
        </div>
      </div>
    </article>
  );
};

import React, { useMemo, useState } from "react";
import { Card, CardHeader } from "../components/Card";
import { dateLocale, montant } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import type { EvenementJournal, GenreJournal } from "../lib/journal";

/**
 * 14. JOURNAL D'ACTIVITÉ
 *
 * Ce qui s'est passé dans la boutique, du plus récent au plus ancien,
 * groupé par jour.
 *
 * IL MONTRE AUSSI LES CRÉATIONS, contrairement à la cloche. Le hook de
 * la cloche (`useJournalActivite`) les écarte volontairement, parce
 * qu'elle les déduit déjà des données chargées et les afficherait deux
 * fois. Ici, c'est le contraire : sans les créations, un journal
 * n'aurait presque rien à dire. La lecture propre à cet écran est dans
 * `useDashboardData` ; le hook de la cloche n'a pas été touché.
 */

const ICONES: Record<GenreJournal, React.ReactNode> = {
  vente: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  reglement: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  ),
  autre: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
};

type Filtre = "tout" | "aujourdhui" | GenreJournal;

const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: "tout", libelle: "Tout" },
  { cle: "aujourdhui", libelle: "Aujourd'hui" },
  { cle: "vente", libelle: "Ventes" },
  { cle: "reglement", libelle: "Paiements" },
  { cle: "stock", libelle: "Stock" },
  { cle: "autre", libelle: "Clients & tâches" },
];

export const CarteJournal: React.FC<{
  journal: EvenementJournal[];
  montantsVisibles: boolean;
  /** Filtre imposé de l'extérieur — la flèche de la tuile « Activité ». */
  filtreInitial?: Filtre;
  onHistorique?: () => void;
}> = ({ journal, montantsVisibles, filtreInitial = "tout", onHistorique }) => {
  const aujourdhui = dateDuJour();
  const [filtre, setFiltre] = useState<Filtre>(filtreInitial);

  const groupes = useMemo(() => {
    const retenues = journal.filter((e) => {
      if (filtre === "tout") return true;
      if (filtre === "aujourdhui") return e.jour === aujourdhui;
      return e.genre === filtre;
    });
    const table = new Map<string, EvenementJournal[]>();
    for (const e of retenues.slice(0, 40)) {
      const liste = table.get(e.jour) ?? [];
      liste.push(e);
      table.set(e.jour, liste);
    }
    return [...table.entries()];
  }, [journal, filtre, aujourdhui]);

  const nomDuJour = (jour: string) => {
    if (jour === aujourdhui) return `Aujourd'hui · ${jour.slice(8)}/${jour.slice(5, 7)}`;
    const d = dateLocale(jour);
    const sem = d.toLocaleDateString("fr-FR", { weekday: "long" });
    return `${sem.charAt(0).toUpperCase()}${sem.slice(1)} ${jour.slice(8)}/${jour.slice(5, 7)}`;
  };

  return (
    <Card span={8} secondary id="carte-journal">
      <CardHeader
        title="Journal d'activité"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 12h4l3-7 4 14 3-7h4" />
          </svg>
        }
        action={
          onHistorique && (
            <button className="link" type="button" onClick={onHistorique}>
              Historique complet
            </button>
          )
        }
      />

      <div className="filters" role="group" aria-label="Filtrer le journal">
        {FILTRES.map((f) => (
          <button
            key={f.cle}
            type="button"
            aria-pressed={filtre === f.cle}
            onClick={() => setFiltre(f.cle)}
          >
            {f.libelle}
          </button>
        ))}
      </div>

      <div className="tl">
        {groupes.length === 0 ? (
          <div className="tlday">Rien pour ce filtre</div>
        ) : (
          groupes.map(([jour, lignes]) => (
            <React.Fragment key={jour}>
              <div className="tlday">{nomDuJour(jour)}</div>
              {lignes.map((e) => (
                <div className="ev-row" key={e.id}>
                  <time>{e.heure}</time>
                  <span className={`ic ${e.genre}`}>{ICONES[e.genre]}</span>
                  <div className="tx">
                    {e.texte}
                    {e.detail && <small>{e.detail}</small>}
                  </div>
                  <span className="am num">
                    {e.montant != null && montantsVisibles ? montant(e.montant) : ""}
                  </span>
                </div>
              ))}
            </React.Fragment>
          ))
        )}
      </div>
    </Card>
  );
};

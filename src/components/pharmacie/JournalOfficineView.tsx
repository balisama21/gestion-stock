import React, { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  History,
  PackagePlus,
  PiggyBank,
  ReceiptText,
  Wallet,
} from "lucide-react";
import type { CapitalApport, Expense, Payment, Purchase, Sale } from "../../types";
import { formatCurrency } from "../../utils/formulas";
import { journalOfficine, parJour, type GenreEcriture } from "../../lib/journalOfficine";
import { Chiffre, EnTete, Panneau, Segments, Vide } from "./ui";

interface Props {
  sales: Sale[];
  payments: Payment[];
  purchases: Purchase[];
  expenses: Expense[];
  apports: CapitalApport[];
  aujourdhui: string;
}

type Periode = "jour" | "semaine" | "mois" | "tout";
type Filtre = "tout" | "entrees" | "receptions" | "depenses";

const decaler = (jour: string, n: number) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const debutDe = (p: Periode, aujourdhui: string): string | null =>
  p === "jour"
    ? aujourdhui
    : p === "semaine"
      ? decaler(aujourdhui, -6)
      : p === "mois"
        ? `${aujourdhui.slice(0, 8)}01`
        : null;

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const jourLisible = (jour: string, aujourdhui: string) => {
  const d = new Date(`${jour}T12:00:00Z`);
  const date = `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
  if (jour === aujourdhui) return `Aujourd'hui · ${date}`;
  if (jour === decaler(aujourdhui, -1)) return `Hier · ${date}`;
  return jour.slice(0, 4) === aujourdhui.slice(0, 4) ? date : `${date} ${jour.slice(0, 4)}`;
};

const heure = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;

const GENRES: Record<GenreEcriture, { icone: React.ReactNode; tuile: string; ton?: string }> = {
  encaissement: {
    icone: <Banknote className="h-4 w-4" />,
    tuile: "bg-secondary text-primary",
  },
  reglement: {
    icone: <Wallet className="h-4 w-4" />,
    tuile: "bg-secondary text-primary",
    ton: "croix",
  },
  reception: {
    icone: <PackagePlus className="h-4 w-4" />,
    tuile: "bg-info-soft t-info",
    ton: "info",
  },
  depense: {
    icone: <ReceiptText className="h-4 w-4" />,
    tuile: "bg-danger-soft t-danger",
    ton: "danger",
  },
  apport: {
    icone: <PiggyBank className="h-4 w-4" />,
    tuile: "bg-warning-soft t-warning",
    ton: "warning",
  },
};

const DANS_LE_FILTRE: Record<Filtre, GenreEcriture[]> = {
  tout: ["encaissement", "reglement", "reception", "depense", "apport"],
  entrees: ["encaissement", "reglement", "apport"],
  receptions: ["reception"],
  depenses: ["depense"],
};

/**
 * L'HISTORIQUE DE L'OFFICINE
 *
 * Le journal de la caisse, jour par jour : l'argent du comptoir client
 * par client, les crédits réglés, les livraisons payées au grossiste,
 * les dépenses. Chaque jour montre ce qui est entré et ce qui est sorti.
 */
export const JournalOfficineView: React.FC<Props> = ({
  sales,
  payments,
  purchases,
  expenses,
  apports,
  aujourdhui,
}) => {
  const [periode, setPeriode] = useState<Periode>("mois");
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [combien, setCombien] = useState(15);

  const tout = useMemo(
    () =>
      journalOfficine({
        ventes: sales,
        paiements: payments,
        achats: purchases,
        depenses: expenses,
        apports,
      }),
    [sales, payments, purchases, expenses, apports],
  );
  const debut = debutDe(periode, aujourdhui);
  const dansLaPeriode = useMemo(() => tout.filter((e) => !debut || e.jour >= debut), [tout, debut]);
  const entrees = dansLaPeriode.filter((e) => e.montant > 0).reduce((n, e) => n + e.montant, 0);
  const sorties = dansLaPeriode.filter((e) => e.montant < 0).reduce((n, e) => n - e.montant, 0);
  const jours = useMemo(
    () => parJour(dansLaPeriode.filter((e) => DANS_LE_FILTRE[filtre].includes(e.genre))),
    [dansLaPeriode, filtre],
  );
  const compte = (f: Filtre) =>
    dansLaPeriode.filter((e) => DANS_LE_FILTRE[f].includes(e.genre)).length;

  return (
    <div className="ph-page">
      <EnTete
        icone={<History className="h-6 w-6" />}
        titre="Historique"
        sousTitre="Le journal de la caisse : chaque entrée et chaque sortie d'argent, jour par jour."
      >
        <Chiffre
          ton="plein"
          valeur={`${entrees - sorties >= 0 ? "+" : ""}${formatCurrency(entrees - sorties)}`}
          libelle="Solde de la période"
        />
        <Chiffre
          valeur={formatCurrency(entrees)}
          libelle="Entrées"
          icone={<ArrowDownLeft className="h-3 w-3" />}
        />
        <Chiffre
          valeur={formatCurrency(sorties)}
          libelle="Sorties"
          icone={<ArrowUpRight className="h-3 w-3" />}
        />
      </EnTete>

      <div className="flex flex-wrap items-center gap-2">
        <Segments
          libelle="Période"
          valeur={periode}
          onChange={(p) => {
            setPeriode(p);
            setCombien(15);
          }}
          options={[
            { cle: "jour", libelle: "Aujourd'hui" },
            { cle: "semaine", libelle: "7 jours" },
            { cle: "mois", libelle: "Ce mois" },
            { cle: "tout", libelle: "Tout" },
          ]}
        />
        <Segments
          libelle="Genre"
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { cle: "tout", libelle: "Tout", compte: compte("tout") },
            { cle: "entrees", libelle: "Entrées", compte: compte("entrees") },
            { cle: "receptions", libelle: "Réceptions", compte: compte("receptions") },
            { cle: "depenses", libelle: "Dépenses", compte: compte("depenses") },
          ]}
        />
      </div>

      {jours.length === 0 ? (
        <Panneau>
          <Vide icone={<History className="h-6 w-6" />}>
            Aucun mouvement d&apos;argent sur cette période.
          </Vide>
        </Panneau>
      ) : (
        <>
          {jours.slice(0, combien).map((j) => (
            <Panneau
              key={j.jour}
              titre={jourLisible(j.jour, aujourdhui)}
              action={
                <span className="flex items-center gap-3 text-xs tabular-nums">
                  {j.entrees > 0 && <span className="t-success">+{formatCurrency(j.entrees)}</span>}
                  {j.sorties > 0 && <span className="t-danger">−{formatCurrency(j.sorties)}</span>}
                </span>
              }
            >
              <ul className="ph-liste">
                {j.ecritures.map((e) => {
                  const g = GENRES[e.genre];
                  return (
                    <li key={e.cle} className="ph-ligne" data-ton={g.ton}>
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${g.tuile}`}
                      >
                        {g.icone}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{e.titre}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[heure(e.quand), e.detail].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-right">
                        <span
                          className={`block text-sm font-extrabold tabular-nums ${
                            e.montant >= 0 ? "t-success" : "t-danger"
                          }`}
                        >
                          {e.montant >= 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(e.montant))}
                        </span>
                        {e.aCredit && (
                          <span className="block text-[11px] font-semibold t-warning">
                            reste à crédit
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panneau>
          ))}
          {jours.length > combien && (
            <button
              type="button"
              onClick={() => setCombien((n) => n + 15)}
              className="app-btn-secondary self-center"
            >
              Voir les jours précédents
            </button>
          )}
        </>
      )}
    </div>
  );
};

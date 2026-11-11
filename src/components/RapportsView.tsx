import React, { useMemo, useState } from "react";
import { Sale, Purchase, Expense, Product, LocaleSetting } from "../types";
import {
  CalendarRange,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Percent,
  Receipt,
  Scale,
  ShoppingCart,
} from "lucide-react";
import { Cascade } from "./shared/Cascade";
import { formatCurrency } from "../utils/formulas";
import { CartePro } from "./shared/CartePro";
import { PageHeader } from "./shared/PageHeader";
import { dateDuJour } from "../lib/dates";
import { chiffreAffairesNet, effetDesAvoirsSurLaMarge, type AvoirDeVente } from "../lib/ventes";

/**
 * Un montant qui peut être une perte. Il s'affichait toujours en vert avec
 * un « + » devant : une marge négative devenait « +-2 000 Ar », en vert.
 */
const Signe: React.FC<{ montant: number }> = ({ montant }) =>
  montant > 0 ? (
    <span className="t-success">+{formatCurrency(montant)}</span>
  ) : montant < 0 ? (
    <span className="t-danger">−{formatCurrency(Math.abs(montant))}</span>
  ) : (
    <>{formatCurrency(0)}</>
  );

const AUCUN_AVOIR: AvoirDeVente[] = [];

interface RapportsViewProps {
  sales: Sale[];
  /** Les avoirs sur ces ventes : le chiffre d'affaires en est net, à leur date. */
  avoirs?: AvoirDeVente[];
  /** Les factures dont l'avoir a remis les articles en stock. */
  facturesRemisesEnStock?: ReadonlySet<string>;
  /** Les postes de dépenses de la boutique, pour les nommer. */
  postes: { id: string; nom: string }[];
  purchases: Purchase[];
  expenses: Expense[];
  products: Product[];
  locale: LocaleSetting;
}

export const RapportsView: React.FC<RapportsViewProps> = ({
  sales,
  avoirs = AUCUN_AVOIR,
  facturesRemisesEnStock,
  purchases,
  expenses,
  postes = [],
}) => {
  // Helper to parse DD/MM/YYYY into JS Date object
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  };

  const today = new Date();

  // Selected date for custom filter
  const [selectedDateInput, setSelectedDateInput] = useState<string>(
    dateDuJour(today), // YYYY-MM-DD
  );

  const customFilterDate = selectedDateInput ? new Date(selectedDateInput) : today;
  const filterDay = customFilterDate.getDate();
  const filterMonth = customFilterDate.getMonth();
  const filterYear = customFilterDate.getFullYear();

  // Helper matching functions
  const isSameDay = (dStr: string, targetDay: number, targetMonth: number, targetYear: number) => {
    const d = parseDate(dStr);
    if (!d) return false;
    return (
      d.getDate() === targetDay && d.getMonth() === targetMonth && d.getFullYear() === targetYear
    );
  };

  const isSameMonth = (dStr: string, targetMonth: number, targetYear: number) => {
    const d = parseDate(dStr);
    if (!d) return false;
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  };

  const isSameYear = (dStr: string, targetYear: number) => {
    const d = parseDate(dStr);
    if (!d) return false;
    return d.getFullYear() === targetYear;
  };

  // 1. CALCULATIONS FOR TODAY (or selected filter date)
  const salesToday = sales.filter((s) => isSameDay(s.date, filterDay, filterMonth, filterYear));
  const purchasesToday = purchases.filter((p) =>
    isSameDay(p.date, filterDay, filterMonth, filterYear),
  );
  const expensesToday = expenses.filter((e) =>
    isSameDay(e.date, filterDay, filterMonth, filterYear),
  );

  const caToday = chiffreAffairesNet(
    salesToday,
    avoirs.filter((a) => isSameDay(a.date, filterDay, filterMonth, filterYear)),
  );
  const achatsToday = purchasesToday.reduce((acc, p) => acc + p.totalAchat, 0);
  const depensesToday = expensesToday.reduce((acc, e) => acc + e.montant, 0);
  // Marges nettes des avoirs, chacun à sa date (`effetDesAvoirsSurLaMarge`).
  const effetAvoirs = (garder: (date: string) => boolean) =>
    effetDesAvoirsSurLaMarge(
      avoirs.filter((a) => garder(a.date)),
      sales,
      facturesRemisesEnStock,
    );
  const margeToday =
    salesToday.reduce((acc, s) => acc + s.margeTotale, 0) -
    effetAvoirs((d) => isSameDay(d, filterDay, filterMonth, filterYear));

  // 2. CALCULATIONS FOR THIS MONTH
  const salesMonth = sales.filter((s) => isSameMonth(s.date, filterMonth, filterYear));
  const purchasesMonth = purchases.filter((p) => isSameMonth(p.date, filterMonth, filterYear));
  const expensesMonth = expenses.filter((e) => isSameMonth(e.date, filterMonth, filterYear));

  const caMonth = chiffreAffairesNet(
    salesMonth,
    avoirs.filter((a) => isSameMonth(a.date, filterMonth, filterYear)),
  );
  const achatsMonth = purchasesMonth.reduce((acc, p) => acc + p.totalAchat, 0);
  const depensesMonth = expensesMonth.reduce((acc, e) => acc + e.montant, 0);
  const margeMonth =
    salesMonth.reduce((acc, s) => acc + s.margeTotale, 0) -
    effetAvoirs((d) => isSameMonth(d, filterMonth, filterYear));

  // 3. CALCULATIONS FOR THIS YEAR
  /**
   * Où est parti l'argent, sur l'année affichée.
   *
   * Le bilan dit COMBIEN sort ; il ne disait pas à quoi. Maintenant que
   * la boutique nomme ses propres postes, la question a une réponse —
   * et c'est souvent celle qu'on cherche quand on trouve les dépenses
   * élevées.
   *
   * Les dépenses sans poste sont regroupées sous « Non classées »
   * plutôt que passées sous silence : la somme des lignes doit faire le
   * total, sinon le lecteur refait l'addition et ne tombe pas juste.
   */
  const parPoste = useMemo(() => {
    const nomDe = new Map(postes.map((p) => [p.id, p.nom]));
    const totaux = new Map<string, number>();
    for (const d of expenses.filter((e) => isSameYear(e.date, filterYear))) {
      const cle = d.categoryId ? (nomDe.get(d.categoryId) ?? "Poste supprimé") : "Non classées";
      totaux.set(cle, (totaux.get(cle) ?? 0) + d.montant);
    }
    return [...totaux.entries()]
      .map(([nom, montant]) => ({ nom, montant }) as { nom: string; montant: number })
      .sort((a, b) => b.montant - a.montant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, postes, filterYear]);

  const totalParPoste = parPoste.reduce((n: number, p: { montant: number }) => n + p.montant, 0);

  const salesYear = sales.filter((s) => isSameYear(s.date, filterYear));
  const purchasesYear = purchases.filter((p) => isSameYear(p.date, filterYear));
  const expensesYear = expenses.filter((e) => isSameYear(e.date, filterYear));

  const caYear = chiffreAffairesNet(
    salesYear,
    avoirs.filter((a) => isSameYear(a.date, filterYear)),
  );
  const achatsYear = purchasesYear.reduce((acc, p) => acc + p.totalAchat, 0);
  const depensesYear = expensesYear.reduce((acc, e) => acc + e.montant, 0);
  const margeYear =
    salesYear.reduce((acc, s) => acc + s.margeTotale, 0) -
    effetAvoirs((d) => isSameYear(d, filterYear));

  // Month names in French
  const monthNames = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  // Monthly Breakdown for current year (Jan to Dec)
  const monthlyStats = monthNames.map((mName, mIdx) => {
    const mSales = sales.filter((s) => isSameMonth(s.date, mIdx, filterYear));
    const mPurchases = purchases.filter((p) => isSameMonth(p.date, mIdx, filterYear));
    const mExpenses = expenses.filter((e) => isSameMonth(e.date, mIdx, filterYear));

    const ca = chiffreAffairesNet(
      mSales,
      avoirs.filter((a) => isSameMonth(a.date, mIdx, filterYear)),
    );
    const achats = mPurchases.reduce((acc, p) => acc + p.totalAchat, 0);
    const depenses = mExpenses.reduce((acc, e) => acc + e.montant, 0);
    const marge =
      mSales.reduce((acc, s) => acc + s.margeTotale, 0) -
      effetAvoirs((d) => isSameMonth(d, mIdx, filterYear));

    return { month: mName, index: mIdx, ca, achats, depenses, marge, countSales: mSales.length };
  });

  // Les douze mois sont tous dessinés, même vides : c'est l'année entière
  // qu'on vient lire, et un mois creux est une information (voir MoisParMois).

  /**
   * Les trois horizons, en colonnes. Le tableau est transposé par rapport
   * à ce qu'on écrirait spontanément — les postes en lignes, les périodes
   * en colonnes — parce que la question posée à cette page est « combien
   * ce mois par rapport à aujourd'hui », et qu'on compare de l'œil bien
   * mieux le long d'une ligne que d'une colonne à l'autre.
   */
  const periodes = [
    {
      id: "jour",
      titre: "Jour",
      detail: customFilterDate.toLocaleDateString("fr-FR"),
      ca: caToday,
      achats: achatsToday,
      depenses: depensesToday,
      marge: margeToday,
      nbVentes: salesToday.length,
    },
    {
      id: "mois",
      titre: "Mois",
      detail: `${monthNames[filterMonth]} ${filterYear}`,
      ca: caMonth,
      achats: achatsMonth,
      depenses: depensesMonth,
      marge: margeMonth,
      nbVentes: salesMonth.length,
    },
    {
      id: "annee",
      titre: "Année",
      detail: String(filterYear),
      ca: caYear,
      achats: achatsYear,
      depenses: depensesYear,
      marge: margeYear,
      nbVentes: salesYear.length,
    },
  ];

  type Periode = (typeof periodes)[number];

  const lignes: {
    key: string;
    label: string;
    render: (p: Periode) => React.ReactNode;
    strong?: boolean;
  }[] = [
    {
      key: "ca",
      label: "Chiffre d'affaires",
      render: (p) => formatCurrency(p.ca),
      strong: true,
    },
    { key: "achats", label: "Achats de stock", render: (p) => formatCurrency(p.achats) },
    { key: "depenses", label: "Dépenses", render: (p) => formatCurrency(p.depenses) },
    // La « marge nette » n'était que la marge brute des ventes : les
    // dépenses n'en étaient jamais retirées. Les deux se lisent séparément.
    // Les achats de stock ne s'en déduisent pas : la marge tient déjà
    // compte du prix d'achat des articles vendus.
    {
      key: "marge",
      label: "Marge brute des ventes",
      render: (p) => <Signe montant={p.marge} />,
    },
    {
      key: "resultat",
      label: "Résultat (marge − dépenses)",
      render: (p) => <Signe montant={p.marge - p.depenses} />,
      strong: true,
    },
    { key: "ventes", label: "Ventes", render: (p) => String(p.nbVentes) },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<CalendarRange className="h-5 w-5 text-muted-foreground" />}
        module="rapports"
        title="Bilan"
        subtitle="Vos ventes, achats, dépenses et marges sur la période choisie."
        actions={
          <label className="flex w-full items-center gap-2 sm:w-auto">
            <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
              Date de référence
            </span>
            <input
              type="date"
              value={selectedDateInput}
              onChange={(e) => setSelectedDateInput(e.target.value)}
              className="app-field-sm min-w-0 flex-1 sm:w-40 sm:flex-none"
            />
          </label>
        }
      />

      {/* ── Le compte de résultat ──
          Un tableau de trois colonnes ne tenait pas sur un téléphone : les
          montants passaient sur deux lignes et l'on comparait des
          chiffres coupés. On choisit maintenant l'horizon (jour, mois,
          année) — chaque onglet montre déjà son résultat — et l'on lit
          en dessous comment ce résultat se construit, du chiffre
          d'affaires jusqu'au bénéfice. */}
      <CartePro
        illustree
        icone={<Scale />}
        titre="Compte de résultat"
        sousTitre="Comment se forme votre bénéfice"
      >
        <CompteDeResultat periodes={periodes} />
      </CartePro>

      {/* Où part l'argent : un anneau qui montre d'un coup d'œil quel
          poste pèse, et dessous chaque poste avec sa part et son montant. */}
      {parPoste.length > 0 && (
        <CartePro
          icone={<PieChart />}
          titre="Où part l'argent"
          sousTitre="Les dépenses de l'année, poste par poste"
          action={<span className="app-carte-pro-pastille">{filterYear}</span>}
        >
          <OuPartLArgent postes={parPoste} total={totalParPoste} />
        </CartePro>
      )}

      {/* Mois par mois : douze barres pour comparer l'année d'un regard ;
          un appui sur un mois en donne le détail juste en dessous. */}
      <CartePro
        icone={<BarChart3 />}
        titre="Mois par mois"
        sousTitre="Chiffre d'affaires et marge, mois après mois"
        action={<span className="app-carte-pro-pastille">{filterYear}</span>}
      >
        <MoisParMois mois={monthlyStats} moisCourant={filterMonth} annee={filterYear} />
      </CartePro>
    </div>
  );
};

type PeriodeBilan = {
  id: string;
  titre: string;
  detail: string;
  ca: number;
  achats: number;
  depenses: number;
  marge: number;
  nbVentes: number;
};

/**
 * LE COMPTE DE RÉSULTAT D'UNE PÉRIODE.
 *
 *   — trois onglets, un par horizon, qui disent déjà leur résultat ;
 *   — le résultat de l'horizon choisi, en grand, avec sa marge en % ;
 *   — la cascade qui le construit : chiffre d'affaires, moins le coût
 *     des marchandises vendues, égale la marge brute ; moins les
 *     dépenses, égale le résultat.
 *
 * Les achats de stock ne s'en déduisent pas : la marge tient déjà compte
 * du prix d'achat des articles vendus. Ils sont rappelés à part, pour
 * qu'on ne les cherche pas.
 */
const CompteDeResultat: React.FC<{ periodes: PeriodeBilan[] }> = ({ periodes }) => {
  const [choisie, setChoisie] = React.useState("mois");
  const p = periodes.find((x) => x.id === choisie) ?? periodes[0];
  const resultat = p.marge - p.depenses;
  const tauxMarge = p.ca > 0 ? Math.round((p.marge / p.ca) * 100) : null;

  /*
   * CHAQUE CHIFFRE UNE SEULE FOIS.
   *
   * Le résultat de l'horizon choisi s'écrivait trois fois dans la carte :
   * dans son onglet, en grand, et au bas de la cascade ; la marge en %
   * deux fois. Maintenant l'onglet choisi ne répète pas son résultat (les
   * deux autres le gardent : c'est la comparaison), la cascade s'arrête
   * aux dépenses, et le résultat se lit une fois, en grand, à la fin du
   * calcul — là où on l'attend.
   */
  return (
    <div className="app-bilan">
      <div className="app-bilan-onglets" role="tablist" aria-label="Horizon">
        {periodes.map((x) => {
          const r = x.marge - x.depenses;
          const choisi = x.id === p.id;
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={choisi}
              onClick={() => setChoisie(x.id)}
              className="app-bilan-onglet"
            >
              <span className="app-bilan-onglet-titre">{x.titre}</span>
              <span className="app-bilan-onglet-detail">{x.detail}</span>
              {choisi ? (
                <span className="app-bilan-onglet-choisi" aria-hidden="true" />
              ) : (
                <span className={`app-bilan-onglet-valeur ${r < 0 ? "t-danger" : ""}`}>
                  {r < 0 ? "−" : r > 0 ? "+" : ""}
                  {formatCurrency(Math.abs(r))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="app-bilan">
        <Cascade
          format={formatCurrency}
          etapes={[
            {
              cle: "ca",
              libelle: "Chiffre d'affaires",
              detail: `${p.nbVentes} vente${p.nbVentes > 1 ? "s" : ""}, nettes des avoirs`,
              montant: p.ca,
              icone: <TrendingUp />,
            },
            {
              cle: "cout",
              libelle: "Coût des marchandises vendues",
              detail: "Prix d'achat des articles vendus",
              montant: -(p.ca - p.marge),
              icone: <Package />,
            },
            {
              cle: "marge",
              libelle: "Marge brute des ventes",
              detail: tauxMarge !== null ? `${tauxMarge} % du chiffre d'affaires` : undefined,
              total: true,
              icone: <Percent />,
            },
            {
              cle: "depenses",
              libelle: "Dépenses",
              detail: "Frais, retraits, salaires",
              montant: -p.depenses,
              icone: <Receipt />,
            },
          ]}
        />

        <div className={`app-bilan-hero${resultat < 0 ? " est-perte" : ""}`}>
          <span className="app-bilan-hero-libelle">
            <Scale className="h-4 w-4" aria-hidden="true" />
            Résultat (marge − dépenses) · {p.detail}
          </span>
          <span
            className={`app-bilan-hero-valeur ${resultat < 0 ? "t-danger" : resultat > 0 ? "t-success" : ""}`}
          >
            <Signe montant={resultat} />
          </span>
          <span className="app-bilan-hero-phrase">
            {resultat < 0
              ? "Perte sur la période"
              : resultat > 0
                ? "Bénéfice sur la période"
                : "Ni bénéfice ni perte"}
          </span>
        </div>

        <p className="app-bilan-note">
          <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Achats de stock : <b>{formatCurrency(p.achats)}</b> — non déduits, ils deviennent un
            coût quand les produits se vendent.
          </span>
        </p>
      </div>
    </div>
  );
};

/** Les teintes des postes de dépenses, dans l'anneau et la légende. */
const TONS_POSTES = ["rouge", "orange", "violet", "bleu", "vert", "gris"] as const;

/**
 * L'anneau des dépenses : chaque poste est un arc, à sa part du total ;
 * le total est au centre. Dessous, la légende dit, poste par poste, la
 * part et le montant — l'anneau donne la forme, la liste les chiffres.
 */
const OuPartLArgent: React.FC<{ postes: { nom: string; montant: number }[]; total: number }> = ({
  postes,
  total,
}) => {
  const rayon = 52;
  const tour = 2 * Math.PI * rayon;
  let deja = 0;
  return (
    <div className="app-donut-bloc">
      <div className="app-donut">
        <svg viewBox="0 0 140 140" role="img" aria-label="Répartition des dépenses par poste">
          <circle cx="70" cy="70" r={rayon} className="app-donut-fond" />
          {postes.map((p, i) => {
            const part = total > 0 ? p.montant / total : 0;
            const arc = (
              <circle
                key={p.nom}
                cx="70"
                cy="70"
                r={rayon}
                className={`app-donut-arc ton-${TONS_POSTES[i % TONS_POSTES.length]}`}
                strokeDasharray={`${Math.max(0, part * tour - 2)} ${tour}`}
                strokeDashoffset={-deja * tour}
              />
            );
            deja += part;
            return arc;
          })}
        </svg>
        <span className="app-donut-centre">
          <small>Total</small>
          <b>{formatCurrency(total)}</b>
        </span>
      </div>
      <ul className="app-donut-legende">
        {postes.map((p, i) => {
          const part = total > 0 ? Math.round((p.montant / total) * 100) : 0;
          return (
            <li key={p.nom} className={`ton-${TONS_POSTES[i % TONS_POSTES.length]}`}>
              <span className="app-donut-puce" aria-hidden="true" />
              <span className="app-donut-nom">{p.nom}</span>
              <span className="app-donut-part">{part} %</span>
              <span className="app-donut-montant">{formatCurrency(p.montant)}</span>
              <span className="app-donut-jauge" aria-hidden="true">
                <i style={{ width: `${part}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

type StatMois = {
  month: string;
  index: number;
  ca: number;
  achats: number;
  depenses: number;
  marge: number;
  countSales: number;
};

/**
 * Douze barres, une par mois : la hauteur dit le chiffre d'affaires, la
 * part foncée la marge. Un appui choisit un mois ; son détail s'affiche
 * dessous, en quatre tuiles. Au départ, c'est le mois en cours.
 */
const MoisParMois: React.FC<{ mois: StatMois[]; moisCourant: number; annee: number }> = ({
  mois,
  moisCourant,
  annee,
}) => {
  const [choisi, setChoisi] = React.useState(moisCourant);
  const max = Math.max(1, ...mois.map((m) => m.ca));
  const m = mois[choisi] ?? mois[0];
  const precedent = choisi > 0 ? mois[choisi - 1] : null;
  const vide = m.ca === 0 && m.achats === 0 && m.depenses === 0;
  const evolution =
    precedent && precedent.ca > 0 ? Math.round(((m.ca - precedent.ca) / precedent.ca) * 100) : null;

  /*
   * Le détail ne répète pas le compte de résultat : pour le mois en
   * cours, chiffre d'affaires, marge, dépenses et résultat sont déjà
   * dans la carte du dessus. Il dit donc ce qu'elle ne dit pas — le
   * panier moyen, l'évolution sur le mois d'avant, les achats — et le
   * chiffre d'affaires du mois choisi s'écrit au-dessus de sa barre.
   */
  return (
    <div className="app-mois">
      <div className="app-mois-barres" role="tablist" aria-label={`Mois de ${annee}`}>
        {mois.map((x) => (
          <button
            key={x.index}
            type="button"
            role="tab"
            aria-selected={x.index === choisi}
            aria-label={`${x.month} : ${formatCurrency(x.ca)}`}
            onClick={() => setChoisi(x.index)}
            className={`app-mois-colonne${x.index === moisCourant ? " est-courant" : ""}`}
          >
            <span className="app-mois-piste">
              <span className="app-mois-ca" style={{ height: `${(x.ca / max) * 100}%` }}>
                <span
                  className="app-mois-marge"
                  style={{ height: `${x.ca > 0 ? (Math.max(0, x.marge) / x.ca) * 100 : 0}%` }}
                />
                {x.index === choisi && x.ca > 0 && (
                  <span className="app-mois-bulle">{formatCompact(x.ca)}</span>
                )}
              </span>
            </span>
            <span className="app-mois-lettre">{x.month.charAt(0)}</span>
          </button>
        ))}
      </div>

      <div className="app-mois-detail" role="tabpanel">
        <div className="app-mois-detail-tete">
          <b>
            {m.month} {annee}
          </b>
          {vide && <span>Aucune activité</span>}
        </div>
        <div className="app-mois-tuiles">
          <span className="app-mois-tuile">
            <small>Ventes</small>
            <b>{m.countSales}</b>
          </span>
          <span className="app-mois-tuile">
            <small>Panier moyen</small>
            <b>{m.countSales > 0 ? formatCurrency(Math.round(m.ca / m.countSales)) : "—"}</b>
          </span>
          <span
            className={`app-mois-tuile${evolution !== null && evolution < 0 ? " est-perte" : evolution !== null ? " est-resultat" : ""}`}
          >
            <small>vs {precedent ? precedent.month.toLowerCase() : "mois d'avant"}</small>
            <b className={evolution === null ? "" : evolution < 0 ? "t-danger" : "t-success"}>
              {evolution === null
                ? "—"
                : `${evolution > 0 ? "+" : evolution < 0 ? "−" : ""}${Math.abs(evolution)} %`}
            </b>
          </span>
          <span className="app-mois-tuile">
            <small>Achats de stock</small>
            <b>{formatCurrency(m.achats)}</b>
          </span>
        </div>
      </div>
      <p className="app-mois-legende" aria-hidden="true">
        <span className="ca" /> Chiffre d&apos;affaires <span className="marge" /> dont marge
      </p>
    </div>
  );
};

/** « 85,5 k », « 1,2 M » : un montant court, pour la bulle d'une barre. */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${String(Math.round(n / 100_000) / 10).replace(".", ",")} M`;
  if (n >= 1_000) return `${String(Math.round(n / 100) / 10).replace(".", ",")} k`;
  return String(Math.round(n));
}

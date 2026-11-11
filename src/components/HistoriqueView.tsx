import React, { useMemo, useState } from "react";
import { Purchase, Sale, Expense, CapitalApport, LocaleSetting, Product } from "../types";
import {
  History,
  ShoppingCart,
  DollarSign,
  ArrowRightLeft,
  PlusCircle,
  Receipt,
  CalendarDays,
  CalendarMinus,
  CalendarRange,
  Infinity as Toujours,
  ChevronRight,
} from "lucide-react";
import {
  formatCurrency,
  formatDateLocale,
  getPurchaseLabel,
  getSaleLabel,
} from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { StatBar } from "./shared/StatBar";
import { PastilleFiltre } from "./shared/FilterBar";
import { libelleDuJour, Picto } from "./shared/DataList";

import type { Database } from "../lib/database.types";

type MovementType = "ACHAT" | "VENTE" | "DÉPENSE" | "APPORT" | "NOTE";

const labelFor = (type: MovementType) =>
  ({ ACHAT: "Achat", VENTE: "Vente", DÉPENSE: "Dépense", APPORT: "Apport", NOTE: "Note de frais" })[
    type
  ];

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Database["public"]["Tables"]["clients"]["Row"] | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};
type NoteDeFrais = Database["public"]["Tables"]["notes_de_frais"]["Row"];

interface HistoriqueViewProps {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  apports?: CapitalApport[];
  orders?: Order[];
  notesDeFrais?: NoteDeFrais[];
  locale: LocaleSetting;
  products: Product[];
  /**
   * Ouvre l'écran d'où vient une écriture, sur sa fiche : la vente dans
   * les Ventes, l'achat dans les Achats… Absent, les lignes ne sont que
   * des lignes de lecture.
   */
  onOuvrir?: (onglet: string, id: string) => void;
}

interface Ecriture {
  id: string;
  ref: string | null;
  date: string;
  type: MovementType;
  description: string;
  actor: string | null;
  montant: number;
  /** Faux pour une note pas encore remboursée : elle n'a rien sorti de la caisse. */
  decaisse: boolean;
  icon: React.ReactNode;
  /** L'écran qui sait montrer cette écriture, et la fiche à y ouvrir. */
  onglet: string;
}

type Raccourci = "mois" | "mois_dernier" | "annee" | "tout";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function bornes(r: Raccourci): { du: string; au: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (r === "mois")
    return { du: iso(new Date(Date.UTC(y, m, 1))), au: iso(new Date(Date.UTC(y, m + 1, 0))) };
  if (r === "mois_dernier")
    return { du: iso(new Date(Date.UTC(y, m - 1, 1))), au: iso(new Date(Date.UTC(y, m, 0))) };
  if (r === "annee") return { du: `${y}-01-01`, au: `${y}-12-31` };
  return { du: "", au: "" };
}

const RACCOURCIS: { cle: Raccourci; libelle: string }[] = [
  { cle: "mois", libelle: "Ce mois" },
  { cle: "mois_dernier", libelle: "Mois dernier" },
  { cle: "annee", libelle: "Cette année" },
  { cle: "tout", libelle: "Tout" },
];

const TYPES: MovementType[] = ["VENTE", "ACHAT", "DÉPENSE", "NOTE", "APPORT"];

const icone = "w-4 h-4 text-muted-foreground";

/** L'icône et le ton de chaque type d'écriture : la puce du filtre et la ligne. */
const ICONE_TYPE: Record<MovementType, React.ReactNode> = {
  VENTE: <DollarSign />,
  ACHAT: <ShoppingCart />,
  DÉPENSE: <ArrowRightLeft />,
  NOTE: <Receipt />,
  APPORT: <PlusCircle />,
};
const TON_TYPE: Record<MovementType, "vert" | "bleu" | "rouge" | "violet" | "orange"> = {
  VENTE: "vert",
  ACHAT: "bleu",
  DÉPENSE: "rouge",
  NOTE: "violet",
  APPORT: "orange",
};
const ICONE_RACCOURCI: Record<Raccourci, React.ReactNode> = {
  mois: <CalendarDays />,
  mois_dernier: <CalendarMinus />,
  annee: <CalendarRange />,
  tout: <Toujours />,
};

/** Le journal de compte : ventes, achats, dépenses, notes de frais et apports, par jour. */
export const HistoriqueView: React.FC<HistoriqueViewProps> = ({
  purchases,
  sales,
  expenses,
  apports = [],
  orders = [],
  notesDeFrais = [],
  locale,
  products,
  onOuvrir,
}) => {
  const [raccourci, setRaccourci] = useState<Raccourci | null>("tout");
  const [periode, setPeriode] = useState(() => bornes("tout"));
  const [types, setTypes] = useState<Set<MovementType>>(new Set(TYPES));

  const timeline = useMemo<Ecriture[]>(() => {
    const depensesDeNotes = new Set(notesDeFrais.map((n) => n.depense_id).filter(Boolean));
    return [
      ...purchases.map((p) => ({
        id: p.id,
        ref: p.numero,
        date: p.date,
        type: "ACHAT" as const,
        description: `Achat stock : ${getPurchaseLabel(p, products)} (${p.quantite} pcs)`,
        actor: p.fournisseur?.trim() || "Fournisseur non précisé",
        montant: -p.totalAchat,
        decaisse: true,
        icon: <ShoppingCart className={icone} />,
        onglet: "achats",
      })),
      ...sales.map((s) => ({
        id: s.id,
        ref: s.numero,
        date: s.date,
        type: "VENTE" as const,
        description: `Vente : ${getSaleLabel(s, products)} (${s.quantite} pcs à ${formatCurrency(s.prixVenteUnit)})`,
        actor: s.vendeur,
        montant: s.montantPaye,
        decaisse: true,
        icon: <DollarSign className={icone} />,
        onglet: "ventes",
      })),
      // Commandes livrées ET payées : équivalentes à une vente terminée.
      ...orders
        .filter((o) => o.statut_commande === "livre" && o.statut_paiement === "paye")
        .map((o) => {
          const items = o.items ?? [];
          const articles =
            items
              .map((it) =>
                getSaleLabel(
                  { designation: it.designation, prixAchatUnitRef: it.prix_achat_unit },
                  products,
                ),
              )
              .join(", ") || "Articles";
          return {
            id: o.id,
            ref: o.numero,
            date: o.date_livraison || o.created_at.slice(0, 10),
            type: "VENTE" as const,
            description: `Commande livrée : ${articles} (${items.length} article(s))`,
            actor: o.client?.nom || "Client comptoir",
            montant: o.montant_paye,
            decaisse: true,
            icon: <DollarSign className={icone} />,
            onglet: "commandes",
          };
        }),
      ...expenses.map((e) => {
        const note = depensesDeNotes.has(e.id);
        return {
          id: e.id,
          ref: e.numero,
          date: e.date,
          type: note ? ("NOTE" as const) : ("DÉPENSE" as const),
          description: note
            ? `Remboursement : ${e.note || e.type}`
            : `Dépense : ${e.type} (${e.note || "Pas de motif"})`,
          actor: e.vendeur,
          montant: -e.montant,
          decaisse: true,
          icon: note ? <Receipt className={icone} /> : <ArrowRightLeft className={icone} />,
          onglet: "depenses",
        };
      }),
      // Les notes remboursées sont déjà là par leur dépense ; les autres
      // sont montrées pour mémoire, hors solde.
      ...notesDeFrais
        .filter((n) => n.statut === "a_valider" || n.statut === "validee")
        .map((n) => ({
          id: n.id,
          ref: n.numero,
          date: n.date,
          type: "NOTE" as const,
          description: `Note de frais ${n.statut === "validee" ? "validée" : "à valider"} : ${n.motif}`,
          actor: n.beneficiaire,
          montant: -Number(n.montant_converti),
          decaisse: false,
          icon: <Receipt className={icone} />,
          onglet: "notes_frais",
        })),
      ...apports.map((a) => ({
        id: a.id,
        ref: `APP-${a.id.slice(0, 6)}`,
        date: a.date,
        type: "APPORT" as const,
        description: `Apport Capital : ${a.note || a.source}`,
        actor: a.source,
        montant: a.montant,
        decaisse: true,
        icon: <PlusCircle className={icone} />,
        onglet: "capital",
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [purchases, sales, expenses, apports, orders, notesDeFrais, products]);

  const filtree = timeline.filter(
    (e) =>
      types.has(e.type) &&
      (!periode.du || e.date >= periode.du) &&
      (!periode.au || e.date <= periode.au),
  );

  const decaissees = filtree.filter((e) => e.decaisse);
  const entrees = decaissees.filter((e) => e.montant > 0).reduce((t, e) => t + e.montant, 0);
  const sorties = decaissees.filter((e) => e.montant < 0).reduce((t, e) => t - e.montant, 0);
  const enAttente = filtree.filter((e) => !e.decaisse).reduce((t, e) => t - e.montant, 0);

  const groupedByDay = Array.from(
    filtree.reduce((acc, item) => {
      const list = acc.get(item.date);
      if (list) list.push(item);
      else acc.set(item.date, [item]);
      return acc;
    }, new Map<string, Ecriture[]>()),
  );

  const basculerType = (t: MovementType) =>
    setTypes((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n.size === 0 ? new Set(TYPES) : n;
    });

  const signe = (n: number) => `${n >= 0 ? "+" : ""}${formatCurrency(n)}`;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<History className="w-5 h-5 t-success" />}
        module="historique"
        title="Historique"
        subtitle="Le journal de compte : chaque entrée et sortie d'argent, jour par jour."
      />

      {/* ── Les filtres, sans cadre ──
          La période en onglets à icône, comme les filtres rapides des
          autres listes ; dessous, les dates exactes sur une ligne ; puis
          les cinq types d'écritures en puces de couleur, toutes allumées
          au départ — un appui en éteint une, un autre la rallume. On voit
          ce qui est filtré sans ouvrir de menu. */}
      <div className="app-histo-filtres">
        <div className="app-recherche-rapides" role="group" aria-label="Période">
          {RACCOURCIS.map((r) => (
            <PastilleFiltre
              key={r.cle}
              actif={raccourci === r.cle}
              icone={ICONE_RACCOURCI[r.cle]}
              onClick={() => {
                setRaccourci(r.cle);
                setPeriode(bornes(r.cle));
              }}
            >
              {r.libelle}
            </PastilleFiltre>
          ))}
        </div>

        <div className="app-histo-types" role="group" aria-label="Types d'écritures">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={types.has(t)}
              onClick={() => basculerType(t)}
              className={`app-histo-type ton-${TON_TYPE[t]}`}
            >
              {ICONE_TYPE[t]}
              {labelFor(t)}
            </button>
          ))}
        </div>
      </div>

      <StatBar
        className="sm:grid-cols-4 xl:grid-cols-4"
        items={[
          { key: "e", label: "Entrées", value: formatCurrency(entrees), hint: "Sur la période" },
          { key: "s", label: "Sorties", value: formatCurrency(sorties), hint: "Sur la période" },
          { key: "n", label: "Solde", value: signe(entrees - sorties), hint: "Entrées − sorties" },
          ...(enAttente > 0
            ? [
                {
                  key: "a",
                  label: "Notes à rembourser",
                  value: formatCurrency(enAttente),
                  hint: "Pas encore sorti",
                },
              ]
            : []),
        ]}
      />

      {/* Les dates exactes, juste avant le relevé qu'elles bornent, dans
          leur propre carte : on règle la fenêtre, et l'on lit dessous. */}
      <div className={`app-histo-dates${raccourci === null ? " est-libre" : ""}`}>
        <CalendarRange className="app-histo-dates-ico" aria-hidden="true" />
        <label htmlFor="historique-du">Du</label>
        <input
          id="historique-du"
          type="date"
          value={periode.du}
          onChange={(e) => {
            setRaccourci(null);
            setPeriode((p) => ({ ...p, du: e.target.value }));
          }}
        />
        <label htmlFor="historique-au">au</label>
        <input
          id="historique-au"
          type="date"
          value={periode.au}
          onChange={(e) => {
            setRaccourci(null);
            setPeriode((p) => ({ ...p, au: e.target.value }));
          }}
        />
      </div>

      {/* ── Le relevé ──
          Un relevé de compte, sans cadre : chaque jour sous son titre,
          avec le solde de la journée dans une pastille de couleur ; chaque
          écriture avec l'icône de son type, son montant vert quand il
          entre, rouge quand il sort, gris quand il ne touche pas encore la
          caisse. Un appui ouvre l'écriture dans son écran, sur sa fiche. */}
      {filtree.length === 0 ? (
        <p className="app-card px-4 py-10 text-center text-sm text-muted-foreground">
          {timeline.length === 0
            ? "Aucun mouvement enregistré pour le moment."
            : "Aucun mouvement sur cette période avec ces filtres."}
        </p>
      ) : (
        <div className="app-releve">
          {groupedByDay.map(([jour, evenements]) => {
            const net = evenements.filter((e) => e.decaisse).reduce((acc, e) => acc + e.montant, 0);
            return (
              <section key={jour} className="app-releve-jour" aria-label={libelleDuJour(jour)}>
                <header className="app-releve-titre">
                  <span>
                    {libelleDuJour(jour)}
                    <small>{formatDateLocale(jour, locale)}</small>
                  </span>
                  <span
                    className={`app-releve-net ${net > 0 ? "est-entree" : net < 0 ? "est-sortie" : ""}`}
                  >
                    {signe(net)}
                  </span>
                </header>

                {evenements.map((item) => {
                  const contenu = (
                    <>
                      <Picto ton={TON_TYPE[item.type]}>{ICONE_TYPE[item.type]}</Picto>
                      <span className="app-releve-texte">
                        <span className="app-releve-libelle">{item.description}</span>
                        <span className="app-releve-meta">
                          {[
                            labelFor(item.type),
                            item.actor,
                            item.ref,
                            item.decaisse ? null : "hors solde",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span
                        className={`app-releve-montant ${
                          !item.decaisse
                            ? "est-attente"
                            : item.montant >= 0
                              ? "est-entree"
                              : "est-sortie"
                        }`}
                      >
                        {signe(item.montant)}
                      </span>
                      {onOuvrir && (
                        <ChevronRight className="app-releve-chevron" aria-hidden="true" />
                      )}
                    </>
                  );
                  const cle = `${item.type}-${item.id}`;
                  return onOuvrir ? (
                    <button
                      key={cle}
                      type="button"
                      className={`app-releve-ligne ton-${TON_TYPE[item.type]}`}
                      onClick={() => onOuvrir(item.onglet, item.id)}
                      aria-label={`${item.description}, ${signe(item.montant)} : ouvrir`}
                    >
                      {contenu}
                    </button>
                  ) : (
                    <div key={cle} className={`app-releve-ligne ton-${TON_TYPE[item.type]}`}>
                      {contenu}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

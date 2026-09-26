import React, { useMemo, useState } from "react";
import { Purchase, Sale, Expense, CapitalApport, LocaleSetting, Product } from "../types";
import {
  History,
  ShoppingCart,
  DollarSign,
  ArrowRightLeft,
  PlusCircle,
  Receipt,
} from "lucide-react";
import {
  formatCurrency,
  formatDateLocale,
  getPurchaseLabel,
  getSaleLabel,
} from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { StatBar } from "./shared/StatBar";

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
        actor: p.fournisseur || "Fournisseur",
        montant: -p.totalAchat,
        decaisse: true,
        icon: <ShoppingCart className={icone} />,
      })),
      ...sales.map((s) => ({
        id: s.id,
        ref: s.numero,
        date: s.date,
        type: "VENTE" as const,
        description: `Vente : ${getSaleLabel(s, products)} (${s.quantite} pcs à ${s.prixVenteUnit} Ar)`,
        actor: s.vendeur,
        montant: s.montantPaye,
        decaisse: true,
        icon: <DollarSign className={icone} />,
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

      <div className="app-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {RACCOURCIS.map((r) => (
            <button
              key={r.cle}
              type="button"
              aria-pressed={raccourci === r.cle}
              onClick={() => {
                setRaccourci(r.cle);
                setPeriode(bornes(r.cle));
              }}
              className={`app-chip ${raccourci === r.cle ? "app-chip-active" : ""}`}
            >
              {r.libelle}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <label className="text-xs text-muted-foreground">
            Du
            <input
              type="date"
              value={periode.du}
              onChange={(e) => {
                setRaccourci(null);
                setPeriode((p) => ({ ...p, du: e.target.value }));
              }}
              className="app-field-sm mt-1 w-full sm:w-40"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Au
            <input
              type="date"
              value={periode.au}
              onChange={(e) => {
                setRaccourci(null);
                setPeriode((p) => ({ ...p, au: e.target.value }));
              }}
              className="app-field-sm mt-1 w-full sm:w-40"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Types d'écritures">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={types.has(t)}
              onClick={() => basculerType(t)}
              className={`app-chip ${types.has(t) ? "app-chip-active" : ""}`}
            >
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

      <div className="app-card overflow-hidden">
        {filtree.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {timeline.length === 0
              ? "Aucun mouvement enregistré pour le moment."
              : "Aucun mouvement sur cette période avec ces filtres."}
          </p>
        ) : (
          groupedByDay.map(([jour, evenements]) => {
            const net = evenements.filter((e) => e.decaisse).reduce((acc, e) => acc + e.montant, 0);
            return (
              <section key={jour}>
                <header className="flex items-baseline justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {formatDateLocale(jour, locale)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {signe(net)}
                  </span>
                </header>

                <div className="app-list">
                  {evenements.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="app-list-row items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block">{item.description}</span>
                        <span className="app-list-secondary block">
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
                        className={`app-list-amount ${item.decaisse ? "" : "text-muted-foreground"}`}
                      >
                        {signe(item.montant)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};

import React from "react";
import { Purchase, Sale, Expense, CapitalApport, LocaleSetting, Product } from "../types";
import { History, ShoppingCart, DollarSign, ArrowRightLeft, PlusCircle } from "lucide-react";
import { formatCurrency, formatDateLocale, getPurchaseLabel, getSaleLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { MobileCardList } from "./shared/MobileCardList";
import type { Database } from "../lib/database.types";

type MovementType = "ACHAT" | "VENTE" | "DÉPENSE" | "APPORT";

/** Libellés lisibles — les codes en majuscules sont réservés au code. */
const labelFor = (type: MovementType) =>
  ({ ACHAT: "Achat", VENTE: "Vente", DÉPENSE: "Dépense", APPORT: "Apport" })[type];

const badgeClassFor = (type: MovementType) =>
  ({
    VENTE: "app-badge-success",
    ACHAT: "app-badge-danger",
    APPORT: "app-badge-info",
    DÉPENSE: "app-badge-warning",
  })[type];

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Database["public"]["Tables"]["clients"]["Row"] | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};

interface HistoriqueViewProps {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  apports?: CapitalApport[];
  orders?: Order[];
  locale: LocaleSetting;
  products: Product[];
}

export const HistoriqueView: React.FC<HistoriqueViewProps> = ({
  purchases,
  sales,
  expenses,
  apports = [],
  orders = [],
  locale,
  products,
}) => {
  // Combine all events into a single timeline sorted by date desc
  const timeline = [
    ...purchases.map((p) => ({
      id: p.id,
      ref: p.numero,
      date: p.date,
      type: "ACHAT" as const,
      description: `Achat stock : ${getPurchaseLabel(p, products)} (${p.quantite} pcs)`,
      actor: p.fournisseur || "Fournisseur",
      montant: -p.totalAchat,
      icon: <ShoppingCart className="w-4 h-4 t-danger" />,
    })),
    ...sales.map((s) => ({
      id: s.id,
      ref: s.numero,
      date: s.date,
      type: "VENTE" as const,
      description: `Vente : ${getSaleLabel(s, products)} (${s.quantite} pcs à ${s.prixVenteUnit} Ar)`,
      actor: s.vendeur,
      montant: s.montantPaye,
      icon: <DollarSign className="w-4 h-4 t-success" />,
    })),
    // Commandes livrées ET payées : elles sont économiquement équivalentes
    // à une vente terminée, donc on les affiche dans la timeline avec le
    // même style. C'est un ajout purement visuel — aucune donnée
    // comptable existante n'est modifiée ou dupliquée.
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
          icon: <DollarSign className="w-4 h-4 t-success" />,
        };
      }),
    ...expenses.map((e) => ({
      id: e.id,
      ref: e.numero,
      date: e.date,
      type: "DÉPENSE" as const,
      description: `Dépense : ${e.type} (${e.note || "Pas de motif"})`,
      actor: e.vendeur,
      montant: -e.montant,
      icon: <ArrowRightLeft className="w-4 h-4 t-warning" />,
    })),
    ...apports.map((a) => ({
      id: a.id,
      ref: `APP-${a.id.slice(0, 6)}`,
      date: a.date,
      type: "APPORT" as const,
      description: `Apport Capital : ${a.note || a.source}`,
      actor: a.source,
      montant: a.montant,
      icon: <PlusCircle className="w-4 h-4 t-info" />,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<History className="w-5 h-5 t-success" />}
        title="Historique"
        subtitle="Tous vos mouvements d'argent et de stock, du plus récent au plus ancien."
      />

      {/* Liste mobile — remplace le tableau sous 768px */}
      <div className="lg:hidden">
        <MobileCardList
          emptyLabel="Aucun mouvement enregistré pour le moment."
          items={timeline.map((item) => ({
            id: `${item.type}-${item.id}`,
            title: item.description,
            subtitle: `${formatDateLocale(item.date, locale)} · ${item.actor}`,
            amount: `${item.montant >= 0 ? "+" : ""}${formatCurrency(item.montant)}`,
            amountTone: item.montant >= 0 ? ("success" as const) : ("danger" as const),
            badge: (
              <span className={`app-badge ${badgeClassFor(item.type)}`}>{labelFor(item.type)}</span>
            ),
            fields: [
              { label: "Référence", value: item.ref },
              { label: "Date", value: formatDateLocale(item.date, locale) },
              { label: "Type", value: labelFor(item.type) },
              { label: "Concerné", value: item.actor, hideIfEmpty: true },
            ],
          }))}
        />
      </div>

      <div className="app-table-wrap hidden lg:block">
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th className="px-4 py-3.5">Référence</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5">Concerné</th>
                <th className="px-4 py-3.5 text-right">Effet trésorerie</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {timeline.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="hover:bg-muted/40">
                  <td className="px-4 py-3.5 font-mono text-muted-foreground">{item.ref}</td>
                  <td className="px-4 py-3.5 font-mono text-muted-foreground">
                    {formatDateLocale(item.date, locale)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`app-badge ${badgeClassFor(item.type)}`}>
                      {item.icon}
                      {labelFor(item.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{item.description}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{item.actor}</td>
                  <td
                    className={`p-3 text-right font-mono font-bold ${
                      item.montant >= 0 ? "t-success" : "t-danger"
                    }`}
                  >
                    {item.montant >= 0 ? "+" : ""}
                    {formatCurrency(item.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
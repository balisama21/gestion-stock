import React from "react";
import { Purchase, Sale, Expense, CapitalApport, LocaleSetting, Product } from "../types";
import { History, ShoppingCart, DollarSign, ArrowRightLeft, PlusCircle } from "lucide-react";
import { formatCurrency, formatDateLocale, getPurchaseLabel, getSaleLabel } from "../utils/formulas";
import type { Database } from "../lib/database.types";

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
      icon: <ShoppingCart className="w-4 h-4 text-rose-400" />,
    })),
    ...sales.map((s) => ({
      id: s.id,
      ref: s.numero,
      date: s.date,
      type: "VENTE" as const,
      description: `Vente : ${getSaleLabel(s, products)} (${s.quantite} pcs à ${s.prixVenteUnit} Ar)`,
      actor: s.vendeur,
      montant: s.montantPaye,
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
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
          icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
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
      icon: <ArrowRightLeft className="w-4 h-4 text-amber-400" />,
    })),
    ...apports.map((a) => ({
      id: a.id,
      ref: `APP-${a.id.slice(0, 6)}`,
      date: a.date,
      type: "APPORT" as const,
      description: `Apport Capital : ${a.note || a.source}`,
      actor: a.source,
      montant: a.montant,
      icon: <PlusCircle className="w-4 h-4 text-blue-400" />,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" />
            Onglet Historique & Audit Trail
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Journal unifié chronologique de tous les mouvements de stock, ventes et dépenses.
          </p>
        </div>
      </div>

      <div className="app-table-wrap">
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th className="px-4 py-3.5">Réf</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Mouvement</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5">Acteur / Vendeur / Fournisseur</th>
                <th className="px-4 py-3.5 text-right">Impact Trésorerie</th>
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
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.type === "VENTE"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : item.type === "ACHAT"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : item.type === "APPORT"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {item.icon}
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{item.description}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{item.actor}</td>
                  <td
                    className={`p-3 text-right font-mono font-bold ${
                      item.montant >= 0 ? "text-emerald-400" : "text-rose-400"
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
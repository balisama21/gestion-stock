import React from "react";
import { Purchase, Sale, Expense, CapitalApport, LocaleSetting, Product } from "../types";
import { History, ShoppingCart, DollarSign, ArrowRightLeft, PlusCircle } from "lucide-react";
import { formatCurrency, formatDateLocale, getPurchaseLabel, getSaleLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";

import type { Database } from "../lib/database.types";

type MovementType = "ACHAT" | "VENTE" | "DÉPENSE" | "APPORT";

/** Libellés lisibles — les codes en majuscules sont réservés au code. */
const labelFor = (type: MovementType) =>
  ({ ACHAT: "Achat", VENTE: "Vente", DÉPENSE: "Dépense", APPORT: "Apport" })[type];

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

  // Regroupement par journée, en conservant l'ordre décroissant du tri
  // ci-dessus : une Map préserve l'ordre d'insertion des clés.
  const groupedByDay = Array.from(
    timeline.reduce((acc, item) => {
      const list = acc.get(item.date);
      if (list) list.push(item);
      else acc.set(item.date, [item]);
      return acc;
    }, new Map<string, typeof timeline>()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<History className="w-5 h-5 t-success" />}
        title="Historique"
        subtitle="Tous vos mouvements d'argent et de stock, du plus récent au plus ancien."
      />

      {/* Journal chronologique — desktop ET mobile.
          Contrairement aux autres listes, l'Historique n'est pas un
          inventaire d'objets mais une suite d'événements : il est donc
          groupé par jour, avec le type d'action porté par une icône en
          rail à gauche, comme un relevé. */}
      <div className="app-card overflow-hidden">
        {timeline.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun mouvement enregistré pour le moment.
          </p>
        ) : (
          groupedByDay.map(([jour, evenements]) => {
            const net = evenements.reduce((acc, e) => acc + e.montant, 0);
            return (
              <section key={jour}>
                {/* Séparateur de journée, avec le solde net du jour */}
                <header className="flex items-baseline justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {formatDateLocale(jour, locale)}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${net >= 0 ? "t-success" : "t-danger"}`}
                  >
                    {net >= 0 ? "+" : ""}
                    {formatCurrency(net)}
                  </span>
                </header>

                <div className="app-list">
                  {evenements.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="app-list-row items-start gap-3"
                    >
                      {/* Rail d'icônes : le type d'action se lit en
                          balayant la colonne de gauche, sans lire le texte. */}
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                        {item.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block">{item.description}</span>
                        <span className="app-list-secondary block">
                          {[labelFor(item.type), item.actor, item.ref].filter(Boolean).join(" · ")}
                        </span>
                      </span>

                      <span
                        className={`app-list-amount ${item.montant >= 0 ? "t-success" : "t-danger"}`}
                      >
                        {item.montant >= 0 ? "+" : ""}
                        {formatCurrency(item.montant)}
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
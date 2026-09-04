import React, { useMemo, useState } from "react";
import { CreditCard, X, History, ShoppingBag, DollarSign, Search } from "lucide-react";
import { formatCurrency, getSaleLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { Sale, Payment, Product } from "../types";
import type { Database } from "../lib/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Database["public"]["Tables"]["clients"]["Row"] | null;
};

interface PaiementsARecevoirViewProps {
  sales: Sale[];
  orders: Order[];
  payments: Payment[];
  products: Product[];
  onAddPaymentToSale: (
    saleId: string,
    data: { montant: number; methode: string; reference: string | null; note: string | null },
  ) => Promise<{ error: string | null }>;
  onAddPaymentToOrder: (
    orderId: string,
    data: { montant: number; methode: string; reference: string | null; note: string | null },
  ) => Promise<{ error: string | null }>;
}

// Élément unifié : soit une vente, soit une commande, avec un reste à payer > 0.
interface Receivable {
  key: string;
  type: "vente" | "commande";
  id: string;
  label: string;
  clientLabel: string;
  date: string;
  total: number;
  paye: number;
  reste: number;
}

export const PaiementsARecevoirView: React.FC<PaiementsARecevoirViewProps> = ({
  sales,
  orders,
  payments,
  products,
  onAddPaymentToSale,
  onAddPaymentToOrder,
}) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Receivable | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receivables: Receivable[] = useMemo(() => {
    const fromSales: Receivable[] = sales
      .filter((s) => s.soldeDu > 0)
      .map((s) => ({
        key: `vente-${s.id}`,
        type: "vente",
        id: s.id,
        label: getSaleLabel(s, products),
        clientLabel: s.clientCredit || "Client comptoir",
        date: s.date,
        total: s.totalVente,
        paye: s.montantPaye,
        reste: s.soldeDu,
      }));

    const fromOrders: Receivable[] = orders
      .filter(
  (o) =>
    (o.reste_a_payer ?? 0) > 0 &&
    o.statut_commande !== "annule",
)
      .map((o) => ({
        key: `commande-${o.id}`,
        type: "commande",
        id: o.id,
        label: o.numero,
        clientLabel: o.client?.nom || "Client non spécifié",
        date: o.created_at,
        total: o.montant_total,
        paye: o.montant_paye,
        reste: o.reste_a_payer ?? 0,
      }));

    return [...fromSales, ...fromOrders]
      .filter(
        (r) =>
          !search ||
          r.label.toLowerCase().includes(search.toLowerCase()) ||
          r.clientLabel.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, orders, search]);

  const totalARecevoir = useMemo(
    () => receivables.reduce((acc, r) => acc + r.reste, 0),
    [receivables],
  );

  const historyFor = (r: Receivable) =>
    payments
      .filter((p) => (r.type === "vente" ? p.saleId === r.id : p.orderId === r.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const openPaymentModal = (r: Receivable) => {
    setSelected(r);
    setPaymentAmount("");
    setPaymentMethod("especes");
    setPaymentNote("");
    setError(null);
    setShowPaymentModal(true);
  };

  const openHistoryModal = (r: Receivable) => {
    setSelected(r);
    setShowHistoryModal(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || saving) return; // anti double-clic
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Montant invalide.");
      return;
    }
    if (amount > selected.reste) {
      setError(`Montant trop élevé. Reste à payer : ${formatCurrency(selected.reste)}`);
      return;
    }
    setSaving(true);
    setError(null);
    const data = {
      montant: amount,
      methode: paymentMethod,
      reference: null,
      note: paymentNote || null,
    };
    const res =
      selected.type === "vente"
        ? await onAddPaymentToSale(selected.id, data)
        : await onAddPaymentToOrder(selected.id, data);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setShowPaymentModal(false);
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CreditCard className="w-5 h-5 t-danger" />}
        title="Paiements à recevoir"
        subtitle="Ventes et commandes qu'il vous reste à encaisser."
      />

      {/* Bandeau total à recevoir */}
      <div className="app-card flex items-center justify-between overflow-hidden border-l-2 border-l-danger p-4">
        <div>
          <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Total à recevoir
          </div>
          <div className="font-mono text-xl font-semibold tabular-nums t-danger">
            {formatCurrency(totalARecevoir)}
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {receivables.length} élément{receivables.length > 1 ? "s" : ""} en attente
        </div>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client, une vente, une commande..."
          className="app-field pl-9"
        />
      </div>

      {/* Liste */}
      {/* Liste dense — chaque ligne est une créance à solder. Ce qui
          compte est le reste dû, mis en avant à droite, et l'action
          « recevoir » directement accessible sans ouvrir de détail. */}
      <div className="app-card overflow-hidden">
        {receivables.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              Aucun paiement en attente. Tout est à jour.
            </p>
          </div>
        ) : (
          <div className="app-list">
            {receivables.map((r) => (
              <div key={r.key} className="app-list-row flex-wrap justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="app-list-primary block">{r.label}</span>
                  <span className="app-list-secondary block">
                    {[r.type === "vente" ? "Vente" : "Commande", r.clientLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-right">
                    <span className="app-list-amount block t-danger">
                      {formatCurrency(r.reste)}
                    </span>
                    <span className="app-list-secondary block">
                      sur {formatCurrency(r.total)}
                    </span>
                  </span>
                  <button
                    onClick={() => openHistoryModal(r)}
                    className="app-btn-icon h-9 w-9 shrink-0"
                    title="Historique des paiements"
                    aria-label="Historique des paiements"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openPaymentModal(r)}
                    className="app-btn-primary shrink-0 text-xs"
                  >
                    Recevoir
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal paiement */}
      {showPaymentModal && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Recevoir un paiement</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setError(null);
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              {selected.type === "vente" ? "Vente" : "Commande"}{" "}
              <strong className="text-foreground font-mono">{selected.label}</strong> — Reste à
              payer :{" "}
              <strong className="t-danger font-mono">{formatCurrency(selected.reste)}</strong>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 t-danger rounded-xl text-xs">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Montant reçu *
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  max={selected.reste}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mode de paiement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="especes">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="virement">Virement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Note (optionnel)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Référence, note..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : "Confirmer le paiement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal historique */}
      {showHistoryModal && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Historique des paiements</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              {selected.type === "vente" ? "Vente" : "Commande"}{" "}
              <strong className="text-foreground font-mono">{selected.label}</strong>
            </div>
            {historyFor(selected).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun paiement enregistré pour l'instant.
              </p>
            ) : (
              <div className="space-y-2">
                {historyFor(selected).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-muted/40 rounded-xl text-sm"
                  >
                    <div>
                      <div className="font-mono font-bold t-success">
                        {formatCurrency(p.montant)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString("fr-FR")} · {p.methode}
                        {p.note ? ` · ${p.note}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
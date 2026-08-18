import React, { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  Phone,
  Mail,
  ShoppingBag,
  CreditCard,
  AlertCircle,
  ChevronRight,
  X,
  Check,
  User,
  History,
} from "lucide-react";
import { formatCurrency } from "../utils/formulas";
import type { Database } from "../lib/database.types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Client | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};

interface ClientsViewProps {
  clients: Client[];
  orders: Order[];
  onAddClient: (
    data: Omit<Database["public"]["Tables"]["clients"]["Insert"], "store_id" | "created_by">,
  ) => Promise<{ client: Client | null; error: string | null }>;
  onUpdateClient: (
    id: string,
    data: Database["public"]["Tables"]["clients"]["Update"],
  ) => Promise<{ error: string | null }>;
  onDeleteClient: (id: string) => Promise<{ error: string | null }>;
  onNavigateToOrders?: (clientId: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  orders,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
}) => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ nom: "", telephone: "", email: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.nom.toLowerCase().includes(q) ||
        c.telephone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  /** Stats par client */
  const clientStats = useMemo(() => {
    const map: Record<
      string,
      {
        totalCommandes: number;
        totalMontant: number;
        totalPaye: number;
        impayes: number;
        enCours: number;
      }
    > = {};
    clients.forEach((c) => {
      const clientOrders = orders.filter((o) => o.client_id === c.id);
      map[c.id] = {
        totalCommandes: clientOrders.length,
        totalMontant: clientOrders.reduce((s, o) => s + o.montant_total, 0),
        totalPaye: clientOrders.reduce((s, o) => s + o.montant_paye, 0),
        impayes: clientOrders
          .filter((o) => o.statut_paiement !== "paye")
          .reduce((s, o) => s + (o.reste_a_payer ?? 0), 0),
        enCours: clientOrders.filter(
          (o) => o.statut_commande === "en_cours" || o.statut_commande === "en_attente",
        ).length,
      };
    });
    return map;
  }, [clients, orders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim()) {
      setFormError("Le nom est requis.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const { error } = await onAddClient(formData);
    setSaving(false);
    if (error) {
      setFormError(error);
      return;
    }
    setFormData({ nom: "", telephone: "", email: "", note: "" });
    setShowForm(false);
  };

  const clientOrders = selectedClient
    ? orders.filter((o) => o.client_id === selectedClient.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            Clients ({clients.length})
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez vos clients et consultez leur historique d'achats
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau Client
        </button>
      </div>

      {/* Add client form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">Nouveau Client</h3>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {formError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Nom complet *
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData((p) => ({ ...p, nom: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Ex: Jean Rakoto"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData((p) => ({ ...p, telephone: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="+261 XX XXX XX XX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="client@email.com"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Note</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
                rows={2}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                placeholder="Note optionnelle..."
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl border border-border hover:border-foreground/20 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Créer le client"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <div className={`space-y-4 ${selectedClient ? "lg:col-span-1" : "lg:col-span-3"}`}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun client trouvé.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-emerald-400 text-sm hover:underline"
              >
                + Ajouter un client
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((client) => {
                const stats = clientStats[client.id] ?? {
                  totalCommandes: 0,
                  totalMontant: 0,
                  totalPaye: 0,
                  impayes: 0,
                  enCours: 0,
                };
                const isSelected = selectedClient?.id === client.id;
                return (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(isSelected ? null : client)}
                    className={`bg-card border rounded-2xl p-4 cursor-pointer transition-all hover:border-emerald-500/50 ${isSelected ? "border-emerald-500/70 ring-1 ring-emerald-500/30" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground">{client.nom}</h4>
                          {stats.impayes > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
                              ⚠️ Impayé
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          {client.telephone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {client.telephone}
                            </span>
                          )}
                          {client.email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {client.email}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">
                            <ShoppingBag className="w-3 h-3 inline mr-1" />
                            {stats.totalCommandes} cmdes
                          </span>
                          <span className="text-foreground font-mono font-semibold">
                            {formatCurrency(stats.totalMontant)}
                          </span>
                          {stats.impayes > 0 && (
                            <span className="text-red-400 font-mono">
                              - {formatCurrency(stats.impayes)} dû
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isSelected ? "rotate-90" : ""}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Client detail panel */}
        {selectedClient && (
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{selectedClient.nom}</h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    {selectedClient.telephone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {selectedClient.telephone}
                      </span>
                    )}
                    {selectedClient.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {selectedClient.email}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats résumé */}
              {(() => {
                const stats = clientStats[selectedClient.id] ?? {
                  totalCommandes: 0,
                  totalMontant: 0,
                  totalPaye: 0,
                  impayes: 0,
                  enCours: 0,
                };
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Commandes",
                        value: stats.totalCommandes,
                        mono: false,
                        color: "text-foreground",
                      },
                      {
                        label: "CA Total",
                        value: formatCurrency(stats.totalMontant),
                        mono: true,
                        color: "text-foreground",
                      },
                      {
                        label: "Déjà payé",
                        value: formatCurrency(stats.totalPaye),
                        mono: true,
                        color: "text-emerald-400",
                      },
                      {
                        label: "Reste dû",
                        value: formatCurrency(stats.impayes),
                        mono: true,
                        color: stats.impayes > 0 ? "text-red-400" : "text-muted-foreground",
                      },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted rounded-xl p-3 text-center">
                        <div
                          className={`text-base font-bold ${s.mono ? "font-mono" : ""} ${s.color}`}
                        >
                          {s.value}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Order history */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-blue-400" />
                Historique des Commandes ({clientOrders.length})
              </h4>
              {clientOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucune commande pour ce client.
                </p>
              ) : (
                <div className="space-y-3">
                  {clientOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-muted/60 rounded-xl border border-border"
                    >
                      <div>
                        <div className="font-mono font-bold text-xs text-foreground">
                          {order.numero}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(order.created_at).toLocaleDateString("fr-FR")}
                          {" · "}
                          <span
                            className={`font-semibold ${order.statut_commande === "livre" ? "text-emerald-400" : order.statut_commande === "annule" ? "text-red-400" : "text-amber-400"}`}
                          >
                            {order.statut_commande === "en_attente"
                              ? "En attente"
                              : order.statut_commande === "en_cours"
                                ? "En cours"
                                : order.statut_commande === "livre"
                                  ? "Livré"
                                  : "Annulé"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-foreground">
                          {formatCurrency(order.montant_total)}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${order.statut_paiement === "paye" ? "text-emerald-400" : order.statut_paiement === "partiel" ? "text-amber-400" : "text-red-400"}`}
                        >
                          {order.statut_paiement === "paye"
                            ? "✅ Payé"
                            : order.statut_paiement === "partiel"
                              ? `⚠️ Reste ${formatCurrency(order.reste_a_payer ?? 0)}`
                              : `🔴 Impayé`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedClient.note && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Note</p>
                <p className="text-sm text-foreground">{selectedClient.note}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

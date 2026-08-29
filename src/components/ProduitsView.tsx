import React, { useState, useMemo, useRef, useEffect } from "react";
import { Product, LocaleSetting } from "../types";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Layers,
  Filter,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Ban,
} from "lucide-react";
import { formatCurrency, toSubscript, getProductLabel } from "../utils/formulas";

interface ProduitsViewProps {
  products: Product[];
  locale: LocaleSetting;
  onAddProduct: (
    newProduct: Omit<
      Product,
      "id" | "numero" | "displayName" | "variantSuffix" | "stockReserve" | "stockDisponible"
    >,
  ) => Promise<{ error: string | null }>;
  onEditProduct?: (
    id: string,
    data: {
      designation: string;
      prixAchat: number;
      prixVenteDefaut: number;
      fournisseur: string;
      seuilAlerte: number;
    },
  ) => Promise<{ error: string | null }>;
  onDeleteProducts?: (ids: string[]) => Promise<{ error: string | null }>;
  /**
   * Champs visibles pour l'utilisateur courant — `null`/`undefined` = tout
   * visible (propriétaire). Pour un collaborateur restreint, masque
   * concrètement les colonnes sensibles (prix d'achat, fournisseur,
   * valeur totale du stock) plutôt que de cacher tout l'onglet.
   * Clés possibles : nom, prix_vente, prix_achat, stock_disponible,
   * valeur_stock, fournisseur (voir src/lib/permissions.ts).
   */
  visibleFields?: string[] | null;
  /**
   * Actions autorisées — `null`/`undefined` = toutes (propriétaire).
   * Clés possibles : view, create, edit, delete, adjust_stock, inventory.
   */
  allowedActions?: string[] | null;
}

export const ProduitsView: React.FC<ProduitsViewProps> = ({
  products,
  locale,
  onAddProduct,
  onEditProduct,
  onDeleteProducts,
  visibleFields,
  allowedActions,
}) => {
  // null/undefined = tout visible (propriétaire). Sinon, seuls les champs
  // explicitement listés sont montrés.
  const showField = (key: string) => !visibleFields || visibleFields.includes(key);
  const showPrixAchat = showField("prix_achat");
  const showFournisseur = showField("fournisseur");
  const showValeurStock = showField("valeur_stock");

  const canDo = (key: string) => !allowedActions || allowedActions.includes(key);
  const canCreate = canDo("create");
  const canEdit = canDo("edit");
  const canDelete = canDo("delete");

  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"Tous" | "OK" | "Alerte">("Tous");
  const [supplierFilter, setSupplierFilter] = useState<string>("Tous");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State for new product
  const [designation, setDesignation] = useState("");
  const [prixAchat, setPrixAchat] = useState(1000);
  const [prixVenteDefaut, setPrixVenteDefaut] = useState(1500);
  const [fournisseur, setFournisseur] = useState("");
  const [stockInitial, setStockInitial] = useState(20);
  const [seuilAlerte, setSeuilAlerte] = useState(5);

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modale Modifier
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDesignation, setEditDesignation] = useState("");
  const [editPrixAchat, setEditPrixAchat] = useState(0);
  const [editPrixVenteDefaut, setEditPrixVenteDefaut] = useState(0);
  const [editFournisseur, setEditFournisseur] = useState("");
  const [editSeuilAlerte, setEditSeuilAlerte] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  // Modale Confirmer suppression (unique ou multiple)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Unique suppliers
  const uniqueSuppliers = useMemo(() => {
    const list = new Set<string>();
    products.forEach((p) => {
      if (p.fournisseur) list.add(p.fournisseur);
    });
    return Array.from(list);
  }, [products]);

  // Dynamic Filtering
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        getProductLabel(p, products).toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.fournisseur.toLowerCase().includes(searchTerm.toLowerCase());

      const isLow = p.stockActuel <= p.seuilAlerte;
      const matchStock =
        stockFilter === "Tous" ||
        (stockFilter === "OK" && !isLow) ||
        (stockFilter === "Alerte" && isLow);

      const matchSupplier = supplierFilter === "Tous" || p.fournisseur === supplierFilter;

      return matchSearch && matchStock && matchSupplier;
    });
  }, [products, searchTerm, stockFilter, supplierFilter]);

  // Key KPI Computations
  const totalReferences = products.length;
  const totalValeurStock = products.reduce((acc, p) => acc + p.stockActuel * p.prixAchat, 0);
  const totalAlertesStock = products.filter((p) => p.stockActuel <= p.seuilAlerte).length;

  // Produits en rupture visibles dans la vue actuelle (pour le raccourci de sélection)
  const ruptureIdsInView = useMemo(
    () => filteredProducts.filter((p) => p.stockActuel <= 0).map((p) => p.id),
    [filteredProducts],
  );

  // Gestion de l'état "indéterminé" de la case à cocher d'en-tête
  const allVisibleSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));
  const someVisibleSelected = filteredProducts.some((p) => selectedIds.has(p.id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredProducts.forEach((p) => next.delete(p.id));
      } else {
        filteredProducts.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const selectAllRuptures = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ruptureIdsInView.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !designation.trim()) return;

    setSaving(true);
    const result = await onAddProduct({
      designation: designation.trim(),
      prixAchat: Number(prixAchat),
      prixVenteDefaut: Number(prixVenteDefaut),
      fournisseur: fournisseur.trim(),
      stockInitial: Number(stockInitial),
      stockActuel: Number(stockInitial),
      seuilAlerte: Number(seuilAlerte),
    });
    setSaving(false);
    if (result.error) return;

    setDesignation("");
    setIsAddModalOpen(false);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditDesignation(p.designation);
    setEditPrixAchat(p.prixAchat);
    setEditPrixVenteDefaut(p.prixVenteDefaut);
    setEditFournisseur(p.fournisseur);
    setEditSeuilAlerte(p.seuilAlerte);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !onEditProduct || editSaving || !editDesignation.trim()) return;

    setEditSaving(true);
    const result = await onEditProduct(editingProduct.id, {
      designation: editDesignation.trim(),
      prixAchat: Number(editPrixAchat),
      prixVenteDefaut: Number(editPrixVenteDefaut),
      fournisseur: editFournisseur.trim(),
      seuilAlerte: Number(editSeuilAlerte),
    });
    setEditSaving(false);
    if (result.error) return;

    setEditingProduct(null);
  };

  const productsToDelete = useMemo(
    () => products.filter((p) => confirmDeleteIds?.includes(p.id)),
    [products, confirmDeleteIds],
  );
  const stockRemainingCount = productsToDelete.filter((p) => p.stockActuel > 0).length;

  const handleConfirmDelete = async () => {
    if (!confirmDeleteIds || !onDeleteProducts || deleting) return;
    setDeleting(true);
    const result = await onDeleteProducts(confirmDeleteIds);
    setDeleting(false);
    if (result.error) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      confirmDeleteIds.forEach((id) => next.delete(id));
      return next;
    });
    setConfirmDeleteIds(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            Catalogue des Produits & Variantes de Prix
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Génération automatique d'ID (P001, P002) et indices de distinction visuelle (kapa₁₀₀₀ vs
            kapa[Fournisseur B]).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher désignation, ID, fournisseur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-muted border border-muted-foreground/20 rounded-xl pl-9 pr-4 py-1.5 text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
            />
          </div>

          {canCreate && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau Produit
            </button>
          )}
        </div>
      </div>

      {/* Interactive Functional Bar (Replaces static yellow instruction box) */}
      <div className="bg-card border border-border p-4 rounded-2xl space-y-4 shadow-sm text-xs">
        {/* KPI Mini Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20/80 flex items-center justify-between">
            <div>
              <span className="text-muted-foreground font-medium block">Total Références :</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {totalReferences} produits
              </span>
            </div>
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>

          {showValeurStock && (
            <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20/80 flex items-center justify-between">
              <div>
                <span className="text-muted-foreground font-medium block">
                  Valeur Totale du Stock :
                </span>
                <span className="text-base font-bold font-mono text-blue-400">
                  {formatCurrency(totalValeurStock)}
                </span>
              </div>
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
          )}

          <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20/80 flex items-center justify-between">
            <div>
              <span className="text-muted-foreground font-medium block">Alertes Stock Bas :</span>
              <span
                className={`text-base font-bold font-mono ${
                  totalAlertesStock > 0 ? "text-amber-400" : "text-foreground"
                }`}
              >
                {totalAlertesStock} produit{totalAlertesStock > 1 ? "s" : ""}
              </span>
            </div>
            <AlertTriangle
              className={`w-5 h-5 ${totalAlertesStock > 0 ? "text-amber-400" : "text-muted-foreground"}`}
            />
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-semibold">Filtrer par Statut Stock :</span>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-muted-foreground/20">
              <button
                onClick={() => setStockFilter("Tous")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  stockFilter === "Tous"
                    ? "bg-emerald-600 text-white font-semibold shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tous ({products.length})
              </button>
              <button
                onClick={() => setStockFilter("OK")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  stockFilter === "OK"
                    ? "bg-emerald-600 text-white font-semibold shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Stock OK ({products.length - totalAlertesStock})
              </button>
              <button
                onClick={() => setStockFilter("Alerte")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  stockFilter === "Alerte"
                    ? "bg-amber-600 text-white font-semibold shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Alertes ({totalAlertesStock})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ruptureIdsInView.length > 0 && (
              <button
                onClick={selectAllRuptures}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-[11px] font-semibold transition-colors"
                title="Cocher tous les produits en rupture de stock visibles"
              >
                <Ban className="w-3.5 h-3.5" />
                Sélectionner les ruptures ({ruptureIdsInView.length})
              </button>
            )}

            <span className="text-muted-foreground font-semibold">Fournisseur :</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="Tous">Tous les fournisseurs</option>
              {uniqueSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>

            {(stockFilter !== "Tous" || supplierFilter !== "Tous" || searchTerm) && (
              <button
                onClick={() => {
                  setStockFilter("Tous");
                  setSupplierFilter("Tous");
                  setSearchTerm("");
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground bg-muted border border-muted-foreground/20 rounded-xl transition-colors"
                title="Réinitialiser tous les filtres"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="app-table-wrap">
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="w-4 h-4 rounded border-muted-foreground/40 accent-emerald-500 cursor-pointer"
                    title="Tout sélectionner"
                  />
                </th>
                <th className="px-4 py-3.5">ID Produit</th>
                <th className="px-4 py-3.5">Nom Affiché (Désignation + Indice)</th>
                {showPrixAchat && <th className="px-4 py-3.5 text-right">Prix Achat</th>}
                <th className="px-4 py-3.5 text-right">Prix Vente Défaut (E)</th>
                {showFournisseur && <th className="px-4 py-3.5">Fournisseur</th>}
                <th className="px-4 py-3.5 text-right">Stock Actuel</th>
                <th className="px-4 py-3.5 text-right">Seuil Alerte</th>
                <th className="px-4 py-3.5 text-center">Statut</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {filteredProducts.map((p) => {
                const isOut = p.stockActuel <= 0;
                const isLow = !isOut && p.stockActuel <= p.seuilAlerte;
                const isSelected = selectedIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-muted/40 ${isSelected ? "bg-emerald-500/5" : ""}`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(p.id)}
                        className="w-4 h-4 rounded border-muted-foreground/40 accent-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">{p.numero}</td>
                    <td className="px-4 py-3.5 font-mono text-sm font-bold text-foreground flex items-center gap-1.5">
                      {getProductLabel(p, products)}
                    </td>
                    {showPrixAchat && (
                      <td className="px-4 py-3.5 text-right font-mono">
                        {formatCurrency(p.prixAchat)}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-400">
                      {formatCurrency(p.prixVenteDefaut)}
                    </td>
                    {showFournisseur && (
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {p.fournisseur || "Non renseigné"}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                      {p.stockActuel}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">
                      {p.seuilAlerte}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-semibold border border-red-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Rupture
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Stock Bas
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onEditProduct && canEdit && (
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-muted-foreground hover:text-blue-400 bg-muted hover:bg-accent rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteProducts && canDelete && (
                          <button
                            onClick={() => setConfirmDeleteIds([p.id])}
                            className="p-1.5 text-muted-foreground hover:text-red-400 bg-muted hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={7 + (showPrixAchat ? 1 : 0) + (showFournisseur ? 1 : 0)}
                    className="px-4 py-8 text-center text-muted-foreground italic"
                  >
                    Aucun produit ne correspond à ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barre d'action flottante — sélection multiple */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-emerald-500/40 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold text-foreground">
            {selectedIds.size} produit{selectedIds.size > 1 ? "s" : ""} sélectionné
            {selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="h-5 w-px bg-border" />
          <button
            onClick={clearSelection}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Tout désélectionner
          </button>
          {onDeleteProducts && canDelete && (
            <button
              onClick={() => setConfirmDeleteIds(Array.from(selectedIds))}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-md p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              Ajouter un Nouveau Produit / Variante
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Désignation de Base (ex: kapa, savon) :
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="ex: kapa"
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Prix Achat (Ar) :
                  </label>
                  <input
                    type="number"
                    required
                    value={prixAchat}
                    onChange={(e) => setPrixAchat(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Prix Vente Défaut (Ar) :
                  </label>
                  <input
                    type="number"
                    required
                    value={prixVenteDefaut}
                    onChange={(e) => setPrixVenteDefaut(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Fournisseur :
                </label>
                <input
                  type="text"
                  value={fournisseur}
                  onChange={(e) => setFournisseur(e.target.value)}
                  placeholder="ex: Grossiste Antanimena"
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Stock Initial :
                  </label>
                  <input
                    type="number"
                    required
                    value={stockInitial}
                    onChange={(e) => setStockInitial(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Seuil Alerte :
                  </label>
                  <input
                    type="number"
                    required
                    value={seuilAlerte}
                    onChange={(e) => setSeuilAlerte(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-md p-6 shadow-xl text-foreground space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-400" />
                Modifier {getProductLabel(editingProduct, products)}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingProduct.stockActuel > 0 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-[11px] text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Ce produit a encore <strong>{editingProduct.stockActuel}</strong> unité(s) en
                  stock. Tu peux modifier ses informations sans risque — l'historique des
                  ventes/achats déjà enregistrés n'est pas affecté.
                </span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Désignation de Base :
                </label>
                <input
                  type="text"
                  required
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Prix Achat (Ar) :
                  </label>
                  <input
                    type="number"
                    required
                    value={editPrixAchat}
                    onChange={(e) => setEditPrixAchat(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Prix Vente Défaut (Ar) :
                  </label>
                  <input
                    type="number"
                    required
                    value={editPrixVenteDefaut}
                    onChange={(e) => setEditPrixVenteDefaut(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Fournisseur :
                </label>
                <input
                  type="text"
                  value={editFournisseur}
                  onChange={(e) => setEditFournisseur(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Seuil Alerte :
                </label>
                <input
                  type="number"
                  required
                  value={editSeuilAlerte}
                  onChange={(e) => setEditSeuilAlerte(Number(e.target.value))}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-semibold shadow-sm"
                >
                  {editSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal (unique ou multiple) */}
      {confirmDeleteIds && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-red-300">
              <Trash2 className="w-5 h-5" />
              Supprimer {productsToDelete.length} produit{productsToDelete.length > 1 ? "s" : ""} ?
            </h3>

            <div className="max-h-48 overflow-y-auto space-y-1 bg-muted/60 rounded-xl p-3 text-xs">
              {productsToDelete.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-foreground">
                    {getProductLabel(p, products)}
                  </span>
                  {p.stockActuel > 0 && (
                    <span className="text-amber-400 font-mono text-[10px]">
                      {p.stockActuel} en stock
                    </span>
                  )}
                </div>
              ))}
            </div>

            {stockRemainingCount > 0 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-[11px] text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {stockRemainingCount} de ces produits ont encore du stock. Ce stock ne sera plus
                  suivi après suppression. L'historique des ventes et achats déjà enregistrés
                  restera néanmoins intact.
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Cette action est définitive. Les ventes et achats déjà enregistrés pour{" "}
              {productsToDelete.length > 1 ? "ces produits" : "ce produit"} resteront visibles dans
              l'historique, mais ne seront plus liés à une fiche produit.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl font-semibold shadow-sm text-xs"
              >
                {deleting ? "Suppression..." : `Supprimer (${productsToDelete.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
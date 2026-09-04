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
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { MobileCardList } from "./shared/MobileCardList";
import { StatTile } from "./shared/StatTile";

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
      <PageHeader
        icon={<Package className="w-5 h-5 t-success" />}
        title="Produits"
        subtitle="Vos produits, leurs prix et leur stock disponible."
        actions={
          canCreate && (
            <button onClick={() => setIsAddModalOpen(true)} className="app-btn-primary w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Nouveau produit
            </button>
          )
        }
      />

      {/* Indicateurs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Références"
          value={`${totalReferences}`}
          hint={`produit${totalReferences > 1 ? "s" : ""} au catalogue`}
          icon={<Layers className="w-5 h-5" />}
          tone="success"
        />

        {showValeurStock && (
          <StatTile
            label="Valeur du stock"
            value={formatCurrency(totalValeurStock)}
            hint="au prix d'achat"
            icon={<DollarSign className="w-5 h-5" />}
            tone="info"
          />
        )}

        <StatTile
          label="Stock bas"
          value={`${totalAlertesStock}`}
          hint={
            totalAlertesStock > 0
              ? `produit${totalAlertesStock > 1 ? "s" : ""} à réapprovisionner`
              : "tout est approvisionné"
          }
          hintTone={totalAlertesStock > 0 ? "warning" : "neutral"}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={totalAlertesStock > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Recherche et filtres */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher un produit, une référence, un fournisseur…"
        activeFilterCount={
          (stockFilter !== "Tous" ? 1 : 0) + (supplierFilter !== "Tous" ? 1 : 0)
        }
        onReset={() => {
          setStockFilter("Tous");
          setSupplierFilter("Tous");
          setSearchTerm("");
        }}
      >
        <FilterField label="Stock">
          <div className="flex w-full items-center gap-1 rounded-xl border border-border bg-muted p-1 lg:w-auto">
            {(
              [
                { key: "Tous", label: "Tous", count: products.length },
                { key: "OK", label: "OK", count: products.length - totalAlertesStock },
                { key: "Alerte", label: "Alertes", count: totalAlertesStock },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStockFilter(opt.key)}
                className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium transition-colors lg:flex-none ${
                  stockFilter === opt.key
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label} ({opt.count})
              </button>
            ))}
          </div>
        </FilterField>

        <FilterField label="Fournisseur">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="app-field-sm lg:w-auto"
          >
            <option value="Tous">Tous les fournisseurs</option>
            {uniqueSuppliers.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        </FilterField>

        {ruptureIdsInView.length > 0 && canDelete && (
          <button
            type="button"
            onClick={selectAllRuptures}
            className="app-btn-danger w-full text-xs lg:w-auto"
            title="Cocher tous les produits en rupture de stock visibles"
          >
            <Ban className="w-3.5 h-3.5" />
            Sélectionner les ruptures ({ruptureIdsInView.length})
          </button>
        )}
      </FilterBar>

      {/* Liste mobile — remplace le tableau sous 768px */}
      <div className="lg:hidden">
        <MobileCardList
          emptyLabel="Aucun produit ne correspond à ces filtres."
          items={filteredProducts.map((p) => {
            const isOut = p.stockActuel <= 0;
            const isLow = !isOut && p.stockActuel <= p.seuilAlerte;
            return {
              id: p.id,
              leading: onDeleteProducts && canDelete && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                  className="h-5 w-5 cursor-pointer rounded border-muted-foreground/40 accent-emerald-500"
                  aria-label={`Sélectionner ${getProductLabel(p, products)}`}
                />
              ),
              title: getProductLabel(p, products),
              subtitle: p.numero,
              amount: formatCurrency(p.prixVenteDefaut),
              amountTone: "info" as const,
              badge: (
                <span
                  className={`app-badge ${
                    isOut ? "app-badge-danger" : isLow ? "app-badge-warning" : "app-badge-success"
                  }`}
                >
                  {isOut ? "Rupture" : isLow ? `Stock bas · ${p.stockActuel}` : `Stock ${p.stockActuel}`}
                </span>
              ),
              fields: [
                { label: "Stock actuel", value: `${p.stockActuel}` },
                { label: "Seuil d'alerte", value: `${p.seuilAlerte}` },
                ...(showPrixAchat
                  ? [{ label: "Prix d'achat", value: formatCurrency(p.prixAchat) }]
                  : []),
                { label: "Prix de vente", value: formatCurrency(p.prixVenteDefaut) },
                ...(showFournisseur
                  ? [{ label: "Fournisseur", value: p.fournisseur || "Non renseigné" }]
                  : []),
              ],
              actions: (
                <>
                  {onEditProduct && canEdit && (
                    <button onClick={() => openEditModal(p)} className="app-btn-secondary flex-1 text-xs">
                      <Pencil className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                  )}
                  {onDeleteProducts && canDelete && (
                    <button
                      onClick={() => setConfirmDeleteIds([p.id])}
                      className="app-btn-danger flex-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  )}
                </>
              ),
            };
          })}
        />
      </div>

      {/* Table */}
      <div className="app-table-wrap hidden lg:block">
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
                <th className="px-4 py-3.5">Référence</th>
                <th className="px-4 py-3.5">Produit</th>
                {showPrixAchat && <th className="px-4 py-3.5 text-right">Prix d'achat</th>}
                <th className="px-4 py-3.5 text-right">Prix de vente</th>
                {showFournisseur && <th className="px-4 py-3.5">Fournisseur</th>}
                <th className="px-4 py-3.5 text-right">Stock</th>
                <th className="px-4 py-3.5 text-right">Seuil</th>
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
                    <td className="px-4 py-3.5 font-mono font-bold t-success">{p.numero}</td>
                    <td className="px-4 py-3.5 font-mono text-sm font-bold text-foreground flex items-center gap-1.5">
                      {getProductLabel(p, products)}
                    </td>
                    {showPrixAchat && (
                      <td className="px-4 py-3.5 text-right font-mono">
                        {formatCurrency(p.prixAchat)}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-right font-mono font-bold t-info">
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
                        <span className="app-badge app-badge-danger">
                          <AlertTriangle className="w-3 h-3" />
                          Rupture
                        </span>
                      ) : isLow ? (
                        <span className="app-badge app-badge-warning">
                          <AlertTriangle className="w-3 h-3" />
                          Stock bas
                        </span>
                      ) : (
                        <span className="app-badge app-badge-success">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onEditProduct && canEdit && (
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-muted-foreground hover:t-info bg-muted hover:bg-accent rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteProducts && canDelete && (
                          <button
                            onClick={() => setConfirmDeleteIds([p.id])}
                            className="p-1.5 text-muted-foreground hover:t-danger bg-muted hover:bg-red-500/10 rounded-lg transition-colors"
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
        /* bottom-24 sur mobile : au-dessus de la barre de navigation basse,
           qui masquerait sinon les boutons de cette barre de sélection. */
        <div className="fixed inset-x-3 bottom-24 z-40 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-success-border bg-card px-4 py-3 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 md:bottom-6">
          <span className="text-sm font-semibold text-foreground">
            {selectedIds.size} produit{selectedIds.size > 1 ? "s" : ""} sélectionné
            {selectedIds.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={clearSelection}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Tout désélectionner
          </button>
          {onDeleteProducts && canDelete && (
            <button
              onClick={() => setConfirmDeleteIds(Array.from(selectedIds))}
              className="app-btn-danger text-xs"
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
              <Package className="w-5 h-5 t-success" />
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
                <Pencil className="w-5 h-5 t-info" />
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
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-[11px] t-warning">
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
            <h3 className="text-lg font-bold flex items-center gap-2 t-danger">
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
                    <span className="t-warning font-mono text-[10px]">
                      {p.stockActuel} en stock
                    </span>
                  )}
                </div>
              ))}
            </div>

            {stockRemainingCount > 0 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-[11px] t-warning">
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
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
  Ban,
} from "lucide-react";
import { formatCurrency, toSubscript, getProductLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList } from "./shared/DataList";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";

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
      <div className="app-statbar grid-cols-1 sm:grid-cols-3">
        <StatCol
          label="Références"
          value={`${totalReferences}`}
          hint={`produit${totalReferences > 1 ? "s" : ""} au catalogue`}
          icon={<Layers className="w-5 h-5" />}
          tone="success"
        />

        {showValeurStock && (
          <StatCol
            label="Valeur du stock"
            value={formatCurrency(totalValeurStock)}
            hint="au prix d'achat"
            icon={<DollarSign className="w-5 h-5" />}
            tone="info"
          />
        )}

        <StatCol
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

      {/* Liste unique — desktop ET mobile.
          Une fiche produit ne se lit pas comme une transaction : ce qui
          compte ici est le nom, l'état du stock et le prix de vente,
          pas un montant total. Le stock devient donc le badge, et le
          prix le montant de droite. */}
      <div className="app-card overflow-hidden">
        <DataList
          emptyLabel="Aucun produit ne correspond à ces filtres."
          items={filteredProducts.map((p) => {
            const rupture = p.stockActuel <= 0;
            const bas = !rupture && p.stockActuel <= p.seuilAlerte;
            return {
              id: p.id,
              leading:
                onDeleteProducts && canDelete ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 cursor-pointer rounded border-muted-foreground/40 accent-emerald-600"
                    aria-label={`Sélectionner ${getProductLabel(p, products)}`}
                  />
                ) : undefined,
              primary: getProductLabel(p, products),
              meta: [
                p.numero,
                showFournisseur ? p.fournisseur || null : null,
                `seuil ${p.seuilAlerte}`,
              ],
              amount: formatCurrency(p.prixVenteDefaut),
              amountHint: showPrixAchat ? `achat ${formatCurrency(p.prixAchat)}` : undefined,
              badge: (
                <span
                  className={`app-badge ${
                    rupture ? "app-badge-danger" : bas ? "app-badge-warning" : "app-badge-neutral"
                  }`}
                >
                  {rupture ? "Rupture" : `${p.stockActuel} en stock`}
                </span>
              ),
              detailTitle: getProductLabel(p, products),
              detailSubtitle: p.numero,
              details: [
                { label: "Référence", value: p.numero },
                { label: "Stock actuel", value: `${p.stockActuel}` },
                { label: "Stock réservé", value: `${p.stockReserve}`, hideIfEmpty: true },
                { label: "Stock disponible", value: `${p.stockDisponible}` },
                { label: "Seuil d'alerte", value: `${p.seuilAlerte}` },
                ...(showPrixAchat
                  ? [{ label: "Prix d'achat", value: formatCurrency(p.prixAchat) }]
                  : []),
                { label: "Prix de vente", value: formatCurrency(p.prixVenteDefaut) },
                ...(showFournisseur
                  ? [{ label: "Fournisseur", value: p.fournisseur || "-", hideIfEmpty: true }]
                  : []),
              ],
              actions: (
                <>
                  {onEditProduct && canEdit && (
                    <button onClick={() => openEditModal(p)} className="app-btn-secondary">
                      <Pencil className="w-4 h-4" />
                      Modifier
                    </button>
                  )}
                  {onDeleteProducts && canDelete && (
                    <button
                      onClick={() => setConfirmDeleteIds([p.id])}
                      className="app-btn-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  )}
                </>
              ),
            };
          })}
        />
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

      {/* ── Nouveau produit ── */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        size="md"
        icon={<Package className="h-4 w-4" />}
        title="Nouveau produit"
        description="Une variante se crée comme un produit à part entière, avec son propre prix."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" form="product-add-form" className="app-btn-primary">
              Enregistrer
            </button>
          </>
        }
      >
        <form id="product-add-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Désignation *
            </label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="ex : kapa"
              className="app-field"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Prix d'achat (Ar) *
              </label>
              <input
                type="number"
                required
                value={prixAchat}
                onChange={(e) => setPrixAchat(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Prix de vente (Ar) *
              </label>
              <input
                type="number"
                required
                value={prixVenteDefaut}
                onChange={(e) => setPrixVenteDefaut(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Fournisseur</label>
            <input
              type="text"
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="ex : Grossiste Antanimena"
              className="app-field"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Stock initial *
              </label>
              <input
                type="number"
                required
                value={stockInitial}
                onChange={(e) => setStockInitial(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Seuil d'alerte *
              </label>
              <input
                type="number"
                required
                value={seuilAlerte}
                onChange={(e) => setSeuilAlerte(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Modification d'un produit ── */}
      {editingProduct && (
        <Modal
          open
          onClose={() => setEditingProduct(null)}
          size="md"
          icon={<Pencil className="h-4 w-4" />}
          title={getProductLabel(editingProduct, products)}
          description="Modifier la fiche produit."
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="app-btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="product-edit-form"
                disabled={editSaving}
                className="app-btn-primary"
              >
                {editSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </>
          }
        >
          {editingProduct.stockActuel > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-xs t-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Ce produit a encore <strong>{editingProduct.stockActuel}</strong> unité
                {editingProduct.stockActuel > 1 ? "s" : ""} en stock. Vous pouvez modifier ses
                informations sans risque : les ventes et achats déjà enregistrés ne sont pas
                affectés.
              </span>
            </div>
          )}

          <form id="product-edit-form" onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Désignation *
              </label>
              <input
                type="text"
                required
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                className="app-field"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Prix d'achat (Ar) *
                </label>
                <input
                  type="number"
                  required
                  value={editPrixAchat}
                  onChange={(e) => setEditPrixAchat(Number(e.target.value))}
                  className="app-field font-mono"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Prix de vente (Ar) *
                </label>
                <input
                  type="number"
                  required
                  value={editPrixVenteDefaut}
                  onChange={(e) => setEditPrixVenteDefaut(Number(e.target.value))}
                  className="app-field font-mono"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Fournisseur
              </label>
              <input
                type="text"
                value={editFournisseur}
                onChange={(e) => setEditFournisseur(e.target.value)}
                className="app-field"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Seuil d'alerte *
              </label>
              <input
                type="number"
                required
                value={editSeuilAlerte}
                onChange={(e) => setEditSeuilAlerte(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ── Confirmation de suppression (une ou plusieurs fiches) ── */}
      {confirmDeleteIds && (
        <Modal
          open
          onClose={() => setConfirmDeleteIds(null)}
          size="md"
          tone="danger"
          icon={<Trash2 className="h-4 w-4" />}
          title={`Supprimer ${productsToDelete.length} produit${productsToDelete.length > 1 ? "s" : ""} ?`}
          description="Cette action est définitive."
          dismissible={!deleting}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="app-btn-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="app-btn-danger"
              >
                {deleting ? "Suppression..." : `Supprimer (${productsToDelete.length})`}
              </button>
            </>
          }
        >
          <div className="app-list max-h-48 overflow-y-auto rounded-lg border border-border">
            {productsToDelete.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="app-list-primary">{getProductLabel(p, products)}</span>
                {p.stockActuel > 0 && (
                  <span className="app-badge app-badge-warning shrink-0">
                    {p.stockActuel} en stock
                  </span>
                )}
              </div>
            ))}
          </div>

          {stockRemainingCount > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-xs t-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {stockRemainingCount} de ces produits ont encore du stock. Ce stock ne sera plus
                suivi après suppression.
              </span>
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Les ventes et achats déjà enregistrés pour{" "}
            {productsToDelete.length > 1 ? "ces produits" : "ce produit"} resteront visibles dans
            l'historique, mais ne seront plus liés à une fiche produit.
          </p>
        </Modal>
      )}
    </div>
  );
};
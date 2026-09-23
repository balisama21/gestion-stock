import React, { useState, useMemo } from "react";
import { Product, LocaleSetting } from "../types";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Layers,
  Filter,
  CheckCircle2,
  Save,
  DollarSign,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrency, getProductLabel, getProductVariant } from "../utils/formulas";
import { VariantBadge } from "./shared/VariantBadge";
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList } from "./shared/DataList";
import { VignetteProduit, vignettesParProduit } from "./shared/VignetteProduit";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import { DetailsProduit } from "./produits/DetailsProduit";
import { ChampPrixDeVente } from "./produits/ChampPrixDeVente";
import { PRIX_AUTO_DEFAUT, type ReglagesPrixAuto } from "../lib/prixAuto";
import { SelecteurFournisseur } from "./shared/SelecteurFournisseur";
import { DETAILS_VIDES, detailsVersBase, type ValeursDetails } from "../lib/detailsProduit";
import { envoyerFichier, supprimerFichier } from "../lib/stockageFichiers";
import type { Database } from "../lib/database.types";
import { useFiltreInitial, useRechercheInitiale } from "../lib/cibleRecherche";
import { estARecommander, type ReglagesAlertesStock } from "../lib/prealerteStock";

/**
 * LE QUATRIÈME FILTRE N'EXISTE QUE SI LA PRÉALERTE EST ACTIVE.
 *
 * « Alertes » montre ce qui est déjà sous le seuil ; « À recommander »
 * y ajoute ce qui s'en approche, et c'est la liste qu'on envoie au
 * fournisseur. Tant que la boutique n'a pas activé la préalerte, les
 * deux diraient la même chose : le bouton n'apparaît donc pas, et
 * l'écran reste exactement celui d'avant.
 */
const FILTRE_A_RECOMMANDER = "A recommander";
type FiltreStock = "Tous" | "OK" | "Alerte" | typeof FILTRE_A_RECOMMANDER;

interface ProduitsViewProps {
  products: Product[];
  locale: LocaleSetting;
  /**
   * Les réglages de préalerte de la boutique, tenus par `BalsamaApp`.
   *
   * Préalerte éteinte, `niveauDePrealerte` rend zéro et le quatrième
   * filtre disparaît : rien ne change pour qui ne s'en sert pas.
   */
  reglagesAlertes: ReglagesAlertesStock;
  /**
   * Ce qu'il faut pour créer un produit.
   *
   * Une forme explicite, et non un `Omit<Product, …>` : la création
   * passe par une fonction verrouillée côté base parce qu'elle touche
   * au stock et aux prix, et cette fonction n'accepte que ces
   * champs-là. Les informations descriptives s'écrivent juste après,
   * par `onEditProductDetails`, sur l'identifiant renvoyé ici.
   *
   * `id` est donc indispensable : sans lui, le formulaire de création
   * ne pourrait pas enregistrer la fiche qu'il vient de faire remplir.
   */
  onAddProduct: (newProduct: {
    designation: string;
    prixAchat: number;
    prixVenteDefaut: number;
    fournisseur: string;
    stockInitial: number;
    stockActuel: number;
    seuilAlerte: number;
  }) => Promise<{ error: string | null; id?: string | null }>;
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
   * Corriger le stock d'un produit.
   *
   * `delta` est un ÉCART et non un nouveau total : c'est ce qui permet
   * d'écrire le mouvement correspondant dans le journal du stock. Un
   * nouveau total ne dirait pas ce qui s'est passé — il faudrait le
   * déduire, et la déduction serait fausse dès qu'une vente s'intercale.
   *
   * Absent quand l'action « adjust_stock » n'est pas accordée.
   */
  onAjusterStock?: (
    id: string,
    delta: number,
    note?: string | null,
  ) => Promise<{ error: string | null }>;
  /**
   * Les informations descriptives de la fiche produit.
   *
   * Séparées de `onEditProduct` à dessein : celui-ci passe par une
   * fonction verrouillée côté base parce qu'il touche au stock et aux
   * prix. Rien de ce qui suit n'y touche.
   */
  categories?: Database["public"]["Tables"]["categories"]["Row"][];
  /** Absente, le sélecteur ne propose pas d'ajouter. */
  onCreerCategorie?: (nom: string) => Promise<{ id: string | null; error: string | null }>;
  /** Le calcul du prix de vente, réglé par la boutique. Absent = désactivé. */
  prixAuto?: ReglagesPrixAuto;
  fournisseurs?: Database["public"]["Tables"]["suppliers"]["Row"][];
  onAddFournisseur?: (data: { nom: string; telephone?: string | null }) => Promise<{
    supplier: Database["public"]["Tables"]["suppliers"]["Row"] | null;
    error: string | null;
  }>;
  onUpdateFournisseur?: (
    id: string,
    data: { telephone: string },
  ) => Promise<{ error: string | null }>;
  productImages?: Database["public"]["Tables"]["product_images"]["Row"][];
  storeId?: string | null;
  onEditProductDetails?: (id: string, data: any) => Promise<{ error: string | null }>;
  onAddProductImage?: (
    productId: string,
    chemin: string,
    ordre?: number,
  ) => Promise<{ error: string | null }>;
  onDeleteProductImage?: (id: string) => Promise<{ error: string | null }>;
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
  reglagesAlertes,
  onAddProduct,
  onEditProduct,
  onDeleteProducts,
  categories = [],
  onCreerCategorie,
  prixAuto = PRIX_AUTO_DEFAUT,
  fournisseurs = [],
  onAddFournisseur,
  onUpdateFournisseur,
  productImages = [],
  storeId = null,
  onEditProductDetails,
  onAddProductImage,
  onDeleteProductImage,
  onAjusterStock,
  visibleFields,
  allowedActions,
}) => {
  // null/undefined = tout visible (propriétaire). Sinon, seuls les champs
  // explicitement listés sont montrés.
  const showField = (key: string) => !visibleFields || visibleFields.includes(key);
  const showPrixAchat = showField("prix_achat");
  const showFournisseur = showField("fournisseur");
  const showValeurStock = showField("valeur_stock");

  /** Quelle photo represente chaque produit, calculee une fois. */
  const vignettes = useMemo(() => vignettesParProduit(productImages), [productImages]);

  const canDo = (key: string) => !allowedActions || allowedActions.includes(key);
  const canCreate = canDo("create");
  const canEdit = canDo("edit");
  const canDelete = canDo("delete");

  const [searchTerm, setSearchTerm] = useState("");
  // Une notification peut viser une ligne précise : la recherche
  // s'ouvre alors remplie dessus. Voir `src/lib/cibleRecherche.ts`.
  useRechercheInitiale("produits", setSearchTerm);
  const [stockFilter, setStockFilter] = useState<FiltreStock>("Tous");

  // Une notification de préalerte ouvre cet écran DÉJÀ FILTRÉ sur ce
  // qu'il faut commander. Voir `src/lib/cibleRecherche.ts`.
  useFiltreInitial("produits", (f) => setStockFilter(f as FiltreStock));
  const [supplierFilter, setSupplierFilter] = useState<string>("Tous");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State for new product
  const [designation, setDesignation] = useState("");
  const [prixAchat, setPrixAchat] = useState(1000);
  const [prixVenteDefaut, setPrixVenteDefaut] = useState(1500);
  /**
   * Un produit créé ici part en « manuel » : son prix par défaut est un
   * nombre écrit à la main. Toucher un bouton de taux le passe en auto.
   */
  const [modePrix, setModePrix] = useState<"auto" | "manuel">("manuel");
  const [tauxProduit, setTauxProduit] = useState<number | null>(null);
  const [fournisseur, setFournisseur] = useState("");
  const [stockInitial, setStockInitial] = useState(20);
  const [seuilAlerte, setSeuilAlerte] = useState(5);
  // La fiche descriptive, renseignable dès la création : c'est tout
  // l'objet de l'harmonisation. Les photos, elles, restent visibles mais
  // inertes tant que le produit n'existe pas — il n'y a pas encore
  // d'identifiant auquel les rattacher.
  const [addDetails, setAddDetails] = useState<ValeursDetails>(DETAILS_VIDES);
  /**
   * Les photos choisies avant que le produit n'existe.
   *
   * Elles partent juste apres sa creation, quand il y a enfin un
   * identifiant auquel les rattacher. Voir `envoyerLesPhotos`.
   */
  const [addPhotos, setAddPhotos] = useState<File[]>([]);
  const [addErreur, setAddErreur] = useState<string | null>(null);

  /** Le niveau intermédiaire de l'héritage produit > catégorie > boutique. */
  const tauxDeLaCategorie = (categoryId: string): number | null =>
    categoryId ? (categories.find((c) => c.id === categoryId)?.taux_marge ?? null) : null;

  // Modale Modifier
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModePrix, setEditModePrix] = useState<"auto" | "manuel">("manuel");
  const [editTauxProduit, setEditTauxProduit] = useState<number | null>(null);
  const [editDesignation, setEditDesignation] = useState("");
  const [editPrixAchat, setEditPrixAchat] = useState(0);
  const [editPrixVenteDefaut, setEditPrixVenteDefaut] = useState(0);
  const [editFournisseur, setEditFournisseur] = useState("");
  const [editSeuilAlerte, setEditSeuilAlerte] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  /**
   * La correction de stock, pendant qu'on modifie la fiche.
   *
   * Un ÉCART et non un nouveau total : on dit « j'en ajoute 5 » ou « j'en
   * retire 3 ». Saisir le total obligerait à faire la soustraction de
   * tête, et cette soustraction serait fausse si une vente passait
   * pendant la saisie.
   *
   * La quantité repart à vide à chaque ouverture : on ne veut pas qu'un
   * chiffre oublié s'applique au prochain enregistrement.
   */
  const [editStockSens, setEditStockSens] = useState<"ajouter" | "retirer">("ajouter");
  const [editStockQte, setEditStockQte] = useState("");
  const [editStockNote, setEditStockNote] = useState("");
  const [editDetails, setEditDetails] = useState<ValeursDetails>(DETAILS_VIDES);
  const [editErreur, setEditErreur] = useState<string | null>(null);

  // Modale Confirmer suppression (unique ou multiple)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      // « À recommander » englobe les DEUX niveaux : ce qui est déjà
      // sous le seuil et ce qui s'en approche. La règle est écrite une
      // seule fois, dans `prealerteStock`, et le bon de commande la
      // relit — les deux listes doivent être la même.
      const aRecommander = estARecommander(p.stockActuel, p.seuilAlerte, reglagesAlertes);
      const matchStock =
        stockFilter === "Tous" ||
        (stockFilter === "OK" && !isLow) ||
        (stockFilter === "Alerte" && isLow) ||
        (stockFilter === FILTRE_A_RECOMMANDER && aRecommander);

      const matchSupplier = supplierFilter === "Tous" || p.fournisseur === supplierFilter;

      return matchSearch && matchStock && matchSupplier;
    });
  }, [products, searchTerm, stockFilter, supplierFilter, reglagesAlertes]);

  // Key KPI Computations
  const totalReferences = products.length;
  const totalValeurStock = products.reduce((acc, p) => acc + p.stockActuel * p.prixAchat, 0);
  const totalAlertesStock = products.filter((p) => p.stockActuel <= p.seuilAlerte).length;
  // Sous le seuil ET dans la bande : la liste complète à commander.
  const totalARecommander = products.filter((p) =>
    estARecommander(p.stockActuel, p.seuilAlerte, reglagesAlertes),
  ).length;

  /**
   * Envoie les photos gardées pendant la saisie, une fois le produit né.
   *
   * Rend le message du premier échec, ou `null` si tout est passé. Le
   * fichier parti sans sa ligne en base est retiré du stockage : sinon
   * il occuperait de la place sans que rien ne puisse plus le désigner —
   * même prudence que dans la fiche produit.
   */
  const envoyerLesPhotos = async (productId: string, fichiers: File[]): Promise<string | null> => {
    if (!storeId || !onAddProductImage) return null;
    for (let i = 0; i < fichiers.length; i += 1) {
      const { chemin, error } = await envoyerFichier(
        "produits",
        storeId,
        `produits/${productId}`,
        fichiers[i],
      );
      if (error || !chemin) return error ?? "Cette image n'a pas pu être envoyée.";
      const suite = await onAddProductImage(productId, chemin, i);
      if (suite.error) {
        await supprimerFichier("produits", chemin);
        return suite.error;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !designation.trim()) return;

    setSaving(true);
    setAddErreur(null);

    // Deux écritures, dans cet ordre, et pour la même raison qu'à la
    // modification : la première passe par une fonction verrouillée côté
    // base parce qu'elle touche au stock et aux prix ; la seconde n'écrit
    // que des informations descriptives, sur l'identifiant que la
    // première vient de rendre.
    const result = await onAddProduct({
      designation: designation.trim(),
      prixAchat: Number(prixAchat),
      prixVenteDefaut: Number(prixVenteDefaut),
      fournisseur: fournisseur.trim(),
      stockInitial: Number(stockInitial),
      stockActuel: Number(stockInitial),
      seuilAlerte: Number(seuilAlerte),
    });
    if (result.error) {
      setSaving(false);
      setAddErreur(result.error);
      return;
    }

    // Rien n'est envoyé si la fiche n'a pas été touchée : un produit
    // créé au comptoir en trois champs ne doit pas déclencher une
    // écriture de plus pour n'y inscrire que des valeurs par défaut.
    // Mode et taux sont descriptifs : écrits hors du chemin verrouillé.
    const prixARegler = prixAuto.actif && (modePrix === "auto" || tauxProduit !== null);
    const ficheRemplie =
      JSON.stringify(addDetails) !== JSON.stringify(DETAILS_VIDES) || prixARegler;
    if (ficheRemplie && onEditProductDetails && result.id) {
      const details = await onEditProductDetails(result.id, {
        ...detailsVersBase(addDetails),
        ...(prixAuto.actif ? { mode_prix: modePrix, taux_marge: tauxProduit } : {}),
      });
      if (details.error) {
        setSaving(false);
        // Le produit existe : le dire, sinon l'utilisateur croirait
        // avoir tout perdu et le créerait une seconde fois.
        setAddErreur(`${details.error} Le produit, lui, a bien été créé.`);
        return;
      }
    }

    // Les photos en dernier : elles sont le plus lourd et le plus
    // faillible — un réseau qui lâche ne doit pas emporter le produit.
    if (addPhotos.length > 0 && result.id) {
      const echec = await envoyerLesPhotos(result.id, addPhotos);
      if (echec) {
        setSaving(false);
        setAddErreur(`${echec} Le produit, lui, a bien été créé.`);
        return;
      }
    }

    setSaving(false);
    setDesignation("");
    setAddDetails(DETAILS_VIDES);
    setAddPhotos([]);
    setIsAddModalOpen(false);
  };

  /**
   * Fermer la création remet la fiche à blanc.
   *
   * Sans cela, un code-barres saisi puis abandonné se retrouverait sur
   * le produit suivant — et personne ne comprendrait d'où il vient.
   */
  const fermerCreation = () => {
    setIsAddModalOpen(false);
    setAddDetails(DETAILS_VIDES);
    setAddPhotos([]);
    setAddErreur(null);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditDesignation(p.designation);
    setEditPrixAchat(p.prixAchat);
    setEditPrixVenteDefaut(p.prixVenteDefaut);
    setEditFournisseur(p.fournisseur);
    setEditModePrix(p.modePrix === "auto" ? "auto" : "manuel");
    setEditTauxProduit(p.tauxMarge);
    setEditSeuilAlerte(p.seuilAlerte);
    setEditStockSens("ajouter");
    setEditStockQte("");
    setEditStockNote("");
    setEditErreur(null);
    setEditDetails({
      sku: p.sku ?? "",
      code_barres: p.codeBarres ?? "",
      category_id: p.categoryId ?? "",
      supplier_id: p.supplierId ?? "",
      description: p.description ?? "",
      unite: p.unite ?? "",
      tva_rate: p.tvaRate === null ? "" : String(p.tvaRate),
      stock_max: p.stockMax === null ? "" : String(p.stockMax),
      type_produit: p.typeProduit ?? "revendu",
      statut: p.statut ?? "actif",
    });
  };

  /**
   * Où l'on arrive si l'on enregistre maintenant.
   *
   * Nul tant qu'aucune quantité n'est saisie : il n'y a alors rien à
   * annoncer, et afficher « stock après : 12 » quand rien ne change
   * ferait croire qu'on s'apprête à écrire quelque chose.
   */
  const stockApresCorrection = useMemo(() => {
    if (!editingProduct) return null;
    const qte = Math.abs(Math.trunc(Number(editStockQte) || 0));
    if (qte === 0) return null;
    return editingProduct.stockActuel + (editStockSens === "retirer" ? -qte : qte);
  }, [editingProduct, editStockQte, editStockSens]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !onEditProduct || editSaving || !editDesignation.trim()) return;

    setEditSaving(true);
    setEditErreur(null);

    // Deux écritures, dans cet ordre, et pour une raison : la première
    // passe par une fonction verrouillée côté base parce qu'elle touche
    // au stock et aux prix ; la seconde n'écrit que des informations
    // descriptives. Si la première échoue, rien n'a bougé et la seconde
    // n'a pas lieu d'être tentée.
    const result = await onEditProduct(editingProduct.id, {
      designation: editDesignation.trim(),
      prixAchat: Number(editPrixAchat),
      prixVenteDefaut: Number(editPrixVenteDefaut),
      fournisseur: editFournisseur.trim(),
      seuilAlerte: Number(editSeuilAlerte),
    });
    if (result.error) {
      setEditSaving(false);
      setEditErreur(result.error);
      return;
    }

    if (onEditProductDetails) {
      const details = await onEditProductDetails(editingProduct.id, {
        ...detailsVersBase(editDetails),
        ...(prixAuto.actif ? { mode_prix: editModePrix, taux_marge: editTauxProduit } : {}),
      });
      if (details.error) {
        setEditSaving(false);
        // Le premier enregistrement a bien eu lieu : le dire, sinon
        // l'utilisateur croirait avoir tout perdu et recommencerait.
        setEditErreur(`${details.error} Les prix et le seuil, eux, ont bien été enregistrés.`);
        return;
      }
    }

    // La correction de stock en dernier, et seulement si une quantité a
    // été saisie. En dernier parce qu'elle écrit dans le journal du
    // stock : si les prix devaient échouer, mieux vaut que le journal
    // n'ait rien enregistré que l'inverse.
    const qte = Math.abs(Math.trunc(Number(editStockQte) || 0));
    if (qte > 0 && onAjusterStock) {
      const delta = editStockSens === "retirer" ? -qte : qte;
      const stock = await onAjusterStock(editingProduct.id, delta, editStockNote.trim() || null);
      if (stock.error) {
        setEditSaving(false);
        // Le reste est passé : le dire, sinon l'utilisateur croirait
        // avoir tout perdu et recommencerait la fiche entière.
        setEditErreur(`${stock.error} Le reste de la fiche a bien été enregistré.`);
        setEditStockQte("");
        return;
      }
    }

    setEditSaving(false);
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

    setConfirmDeleteIds(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Package className="w-5 h-5 t-success" />}
        module="produits"
        title="Produits"
        subtitle="Vos produits, leurs prix et leur stock disponible."
        actions={
          canCreate && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="app-btn-primary w-full sm:w-auto"
            >
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
        activeFilterCount={(stockFilter !== "Tous" ? 1 : 0) + (supplierFilter !== "Tous" ? 1 : 0)}
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
                { key: "Tous" as const, label: "Tous", count: products.length },
                {
                  key: "OK" as const,
                  label: "OK",
                  count: products.length - totalAlertesStock,
                },
                { key: "Alerte" as const, label: "Alertes", count: totalAlertesStock },
                ...(reglagesAlertes.prealerteActive
                  ? [
                      {
                        key: FILTRE_A_RECOMMANDER,
                        label: "À recommander",
                        count: totalARecommander,
                      },
                    ]
                  : []),
              ] as { key: FiltreStock; label: string; count: number }[]
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
              // La vignette seule, pour reconnaitre la ligne qu'on lit.
              // La case a cocher qui l'accompagnait est partie avec la
              // selection multiple : on supprime un produit depuis sa
              // propre ligne, ce qui laisse voir lequel on supprime.
              leading: (
                <VignetteProduit nom={getProductLabel(p, products)} chemin={vignettes.get(p.id)} />
              ),
              primary: (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{getProductLabel(p, products)}</span>
                  <VariantBadge prix={getProductVariant(p, products)} autorise={showPrixAchat} />
                </span>
              ),
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
                    <button onClick={() => setConfirmDeleteIds([p.id])} className="app-btn-danger">
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

      {/* ── Nouveau produit ── */}
      <Modal
        open={isAddModalOpen}
        onClose={fermerCreation}
        size="md"
        icon={<Package className="h-4 w-4" />}
        title="Nouveau produit"
        description="Une variante se crée comme un produit à part entière, avec son propre prix."
        dismissible={!saving}
        footer={
          <>
            <button
              type="button"
              onClick={fermerCreation}
              disabled={saving}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="product-add-form"
              disabled={saving}
              className="app-btn-primary"
            >
              <Save className="h-4 w-4" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        }
      >
        <form id="product-add-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Désignation</label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="ex : cahier"
              className="app-field"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Prix d'achat (Ar)
              </label>
              <input
                type="number"
                required
                value={prixAchat}
                onChange={(e) => setPrixAchat(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>
            <ChampPrixDeVente
              id="prod-add-prix-vente"
              prixAchat={Number(prixAchat)}
              prixVente={Number(prixVenteDefaut)}
              onPrixVente={setPrixVenteDefaut}
              mode={modePrix}
              onMode={setModePrix}
              tauxProduit={tauxProduit}
              onTauxProduit={setTauxProduit}
              tauxCategorie={tauxDeLaCategorie(addDetails.category_id)}
              reglages={prixAuto}
            />
          </div>

          <SelecteurFournisseur
            fournisseurs={fournisseurs}
            valeur={addDetails.supplier_id || null}
            onChange={(id, nom) => {
              // L'identifiant pour le rattachement, le nom pour la
              // colonne texte que la fonction de création écrit toujours.
              setAddDetails((d) => ({ ...d, supplier_id: id ?? "" }));
              setFournisseur(nom);
            }}
            onCreer={onAddFournisseur}
            onCompleter={onUpdateFournisseur}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Stock initial
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
                Seuil d'alerte
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

          {/* La même fiche qu'à la modification, et volontairement la
              même : renseigner un code-barres ou une catégorie ne doit
              pas demander de créer d'abord le produit puis de rouvrir sa
              fiche. Aucun de ces champs n'est obligatoire — seuls ceux
              marqués d'une astérisque au-dessus le sont. */}
          <DetailsProduit
            valeurs={addDetails}
            onChange={setAddDetails}
            categories={categories}
            onCreerCategorie={onCreerCategorie}
            // Le produit n'existe pas encore, donc aucune image ne lui
            // est rattachee : celles qu'on choisit ici attendent dans
            // `addPhotos` et partent des sa creation.
            images={[]}
            storeId={storeId}
            productId={null}
            photosEnAttente={onAddProductImage ? addPhotos : undefined}
            onPhotosEnAttenteChange={onAddProductImage ? setAddPhotos : undefined}
            onAddImage={onAddProductImage ?? (async () => ({ error: "Envoi indisponible." }))}
            onDeleteImage={
              onDeleteProductImage ?? (async () => ({ error: "Suppression indisponible." }))
            }
          />

          {addErreur && (
            <p className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-2.5 text-sm font-medium t-danger">
              {addErreur}
            </p>
          )}
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
                <Save className="h-4 w-4" />
                {editSaving ? "Enregistrement…" : "Enregistrer"}
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

          {/* ── Corriger le stock ──
              On saisit un ÉCART, pas un nouveau total : « j'en ajoute 5 »
              plutôt que « il y en a 47 ». C'est ce que le journal du
              stock enregistre, et c'est aussi ce qu'on a en tête en
              rangeant un carton ou en constatant une casse.

              Le stock après correction s'affiche sous le champ : on voit
              où l'on arrive avant d'enregistrer, sans faire l'addition. */}
          {onAjusterStock && (
            <div className="mb-4 rounded-xl border border-border p-3">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Corriger le stock</span>
                <span className="text-xs text-muted-foreground">
                  actuellement {editingProduct.stockActuel}
                  {editingProduct.stockReserve > 0 && (
                    <> · dont {editingProduct.stockReserve} réservé</>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editStockSens}
                  onChange={(e) => setEditStockSens(e.target.value as "ajouter" | "retirer")}
                  className="app-field"
                  aria-label="Ajouter ou retirer du stock"
                >
                  <option value="ajouter">Ajouter</option>
                  <option value="retirer">Retirer</option>
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={editStockQte}
                  onChange={(e) => setEditStockQte(e.target.value)}
                  placeholder="Quantité"
                  className="app-field"
                  aria-label="Quantité à ajouter ou retirer"
                />
              </div>

              {stockApresCorrection !== null && (
                <p
                  className={`mt-2 text-xs ${stockApresCorrection < editingProduct.stockReserve ? "t-danger" : "text-muted-foreground"}`}
                >
                  Stock après correction : <strong>{stockApresCorrection}</strong>
                  {stockApresCorrection < 0 && " — impossible, il n'y en a pas tant"}
                  {stockApresCorrection >= 0 &&
                    stockApresCorrection < editingProduct.stockReserve &&
                    ` — impossible, ${editingProduct.stockReserve} sont réservés par des commandes`}
                </p>
              )}

              <input
                type="text"
                value={editStockNote}
                onChange={(e) => setEditStockNote(e.target.value)}
                placeholder="Motif : inventaire, casse, perte… (facultatif)"
                className="app-field mt-2"
                aria-label="Motif de la correction"
              />
            </div>
          )}

          <form id="product-edit-form" onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Désignation
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
                  Prix d'achat (Ar)
                </label>
                <input
                  type="number"
                  required
                  value={editPrixAchat}
                  onChange={(e) => setEditPrixAchat(Number(e.target.value))}
                  className="app-field font-mono"
                />
              </div>
              <ChampPrixDeVente
                id="prod-edit-prix-vente"
                prixAchat={Number(editPrixAchat)}
                prixVente={Number(editPrixVenteDefaut)}
                onPrixVente={setEditPrixVenteDefaut}
                mode={editModePrix}
                onMode={setEditModePrix}
                tauxProduit={editTauxProduit}
                onTauxProduit={setEditTauxProduit}
                tauxCategorie={tauxDeLaCategorie(editDetails.category_id)}
                reglages={prixAuto}
              />
            </div>

            <SelecteurFournisseur
              fournisseurs={fournisseurs}
              valeur={editDetails.supplier_id || null}
              onChange={(id, nom) => {
                setEditDetails((d) => ({ ...d, supplier_id: id ?? "" }));
                setEditFournisseur(nom);
              }}
              onCreer={onAddFournisseur}
              onCompleter={onUpdateFournisseur}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Seuil d'alerte
              </label>
              <input
                type="number"
                required
                value={editSeuilAlerte}
                onChange={(e) => setEditSeuilAlerte(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>

            <DetailsProduit
              valeurs={editDetails}
              onChange={setEditDetails}
              categories={categories}
              onCreerCategorie={onCreerCategorie}
              images={productImages.filter((i) => i.product_id === editingProduct.id)}
              storeId={storeId}
              productId={editingProduct.id}
              onAddImage={onAddProductImage ?? (async () => ({ error: "Envoi indisponible." }))}
              onDeleteImage={
                onDeleteProductImage ?? (async () => ({ error: "Suppression indisponible." }))
              }
            />

            {editErreur && (
              <p
                role="alert"
                className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
              >
                {editErreur}
              </p>
            )}
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

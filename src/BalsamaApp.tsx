import React, { useState, useEffect, useMemo } from "react";
import { Zap, X } from "lucide-react";
import {
  LocaleSetting,
  ActiveTab,
  Product,
  Purchase,
  Sale,
  Expense,
  Seller,
  CapitalSummary,
  CapitalApport,
  StoreSettings,
  Payment,
} from "./types";
import type { OrderStatus } from "./lib/database.types";
import { getProductLabel } from "./utils/formulas";
import { getModuleScope, isFieldVisible, hasModuleAction } from "./lib/permissions";
import { downloadExcelWorkbook } from "./utils/exportExcel";
import { Header } from "./components/Header";
import { DashboardView } from "./components/DashboardView";
import { CapitalView } from "./components/CapitalView";
import { ProduitsView } from "./components/ProduitsView";
import { AchatsView } from "./components/AchatsView";
import { VentesView } from "./components/VentesView";
import { VendeursView } from "./components/VendeursView";
import { DepensesView } from "./components/DepensesView";
import { StatistiquesView } from "./components/StatistiquesView";
import { HistoriqueView } from "./components/HistoriqueView";
import { RapportsView } from "./components/RapportsView";
import { ParametresView } from "./components/ParametresView";
import { CommandesView } from "./components/CommandesView";
import { ClientsView } from "./components/ClientsView";
import { FournisseursView } from "./components/FournisseursView";
import { PaiementsARecevoirView } from "./components/PaiementsARecevoirView";
import { AuthPage } from "./components/AuthPage";
import { CreateStoreOnboarding } from "./components/CreateStoreOnboarding";
import { StoreLockedScreen } from "./components/StoreLockedScreen";
import { MyActivityView } from "./components/MyActivityView";
import { PinLockScreen } from "./components/PinLockScreen";
import { AppLoader } from "./components/shared/AppLoader";
import { APP_NAME, APP_TAGLINE } from "./lib/appConfig";
import { useAuth } from "./hooks/useAuth";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { workspaceContext, useWorkspaceState, useWorkspace } from "./hooks/useWorkspace";
import { useStoreData } from "./hooks/useStoreData";
import { useStoreMembers } from "./hooks/useStoreMembers";
import { useNotificationPrefs } from "./lib/notificationPrefs";

// ─── AppInner : rendered inside both authContext & workspaceContext providers ───
function AppInner() {
  const { user, isFounder, profile } = useAuth();
  const workspace = useWorkspace();
  const storeData = useStoreData(workspace.activeStore?.id ?? null, user?.id ?? null);
  const { members: storeMembers, removeMember: removeStoreMember } = useStoreMembers(
    workspace.activeStore?.id ?? null,
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [locale, setLocale] = useState<LocaleSetting>("FR");
  // Mode clair par défaut : c'est ce que voit un nouvel utilisateur au
  // tout premier chargement. Les utilisateurs existants ne sont pas
  // affectés — le useEffect ci-dessous relit leur choix dans
  // localStorage et le réapplique aussitôt.
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // Sidebar repliée en mode icônes. L'état vit ici, et non dans Header,
  // parce que la largeur de la sidebar conditionne aussi le décalage du
  // <main> : les deux doivent bouger ensemble.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Préférences d'affichage des alertes (Paramètres → Notifications).
  const [notificationPrefs] = useNotificationPrefs();

  useEffect(() => {
    const saved = window.localStorage.getItem("balsama-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
    setSidebarCollapsed(window.localStorage.getItem("balsama-sidebar") === "collapsed");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("balsama-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.backgroundColor = "#020617";
    } else {
      // Doit correspondre au token --background du mode clair
      // (oklch(1 0 0) = blanc) : un gris légèrement différent créait
      // un aplat visible le temps du chargement.
      root.style.backgroundColor = "#ffffff";
    }
    window.localStorage.setItem("balsama-theme", theme);
  }, [theme]);

  // Transform Database types → Local types for legacy components
  const products: Product[] = useMemo(
    () =>
      storeData.products.map((p) => ({
        id: p.id,
        numero: p.numero || `P-${p.id.slice(0, 6)}`,
        designation: p.designation,
        variantSuffix: p.variant_suffix,
        displayName: p.display_name,
        prixAchat: p.prix_achat,
        prixVenteDefaut: p.prix_vente_defaut,
        fournisseur: p.fournisseur,
        stockInitial: p.stock_initial,
        stockActuel: p.stock_actuel,
        stockReserve: p.stock_reserve,
        stockDisponible: p.stock_disponible ?? p.stock_actuel - p.stock_reserve,
        seuilAlerte: p.seuil_alerte,
      })),
    [storeData.products],
  );

  const sales: Sale[] = useMemo(
    () =>
      storeData.sales.map((s) => ({
        id: s.id,
        numero: s.numero || `V-${s.id.slice(0, 6)}`,
        date: s.date,
        productId: s.product_id || "",
        designation: s.designation,
        quantite: s.quantite,
        prixVenteUnit: s.prix_vente_unit,
        totalVente: s.total_vente,
        prixAchatUnitRef: s.prix_achat_unit_ref,
        totalAchatRef: s.total_achat_ref,
        margeTotale: s.marge_totale,
        vendeur: s.vendeur,
        clientCredit: s.client_credit || undefined,
        clientId: s.client_id,
        montantPaye: s.montant_paye,
        montantRembourse: s.montant_rembourse,
        soldeDu: s.solde_du,
        statutCredit: s.statut_credit as any,
      })),
    [storeData.sales],
  );

  const payments: Payment[] = useMemo(
    () =>
      storeData.payments.map((p) => ({
        id: p.id,
        numero: p.numero || `PAY-${p.id.slice(0, 6)}`,
        orderId: p.order_id,
        saleId: p.sale_id,
        montant: p.montant,
        methode: p.methode,
        reference: p.reference,
        note: p.note,
        createdAt: p.created_at,
      })),
    [storeData.payments],
  );

  const purchases: Purchase[] = useMemo(
    () =>
      storeData.purchases.map((p) => ({
        id: p.id,
        numero: p.numero || `ACH-${p.id.slice(0, 6)}`,
        date: p.date,
        productId: p.product_id || "",
        designation: p.designation,
        quantite: p.quantite,
        prixAchatUnit: p.prix_achat_unit,
        totalAchat: p.total_achat,
        fournisseur: p.fournisseur,
        supplierId: p.supplier_id,
        impactTresorerie: p.impact_tresorerie,
      })),
    [storeData.purchases],
  );

  const expenses: Expense[] = useMemo(
    () =>
      storeData.expenses.map((e) => ({
        id: e.id,
        numero: e.numero || `DEP-${e.id.slice(0, 6)}`,
        date: e.date,
        vendeur: e.vendeur,
        type: e.type as any,
        montant: e.montant,
        note: e.note || "",
        impactTresorerieGlobale: e.impact_tresorerie_globale,
      })),
    [storeData.expenses],
  );

  const apports: CapitalApport[] = useMemo(
    () =>
      storeData.apports.map((a) => ({
        id: a.id,
        date: a.date,
        montant: a.montant,
        source: a.source,
        note: a.note || undefined,
      })),
    [storeData.apports],
  );

  const storeSettings: StoreSettings = useMemo(
    () => ({
      storeName: workspace.activeStore?.name || APP_NAME,
      subtitle:
        workspace.activeStore?.subtitle || APP_TAGLINE,
      suppliers: workspace.activeStore?.suppliers || [],
      currencySymbol: workspace.activeStore?.currency_symbol || "Ar",
      enablePinSecurity: workspace.activeStore?.enable_pin_security ?? true,
      tvaRate: workspace.activeStore?.tva_rate || 0,
      // Ces champs existent bien dans la table `stores` mais n'étaient
      // jamais mappés ici : les inputs "Ma Boutique" (adresse, téléphone,
      // e-mail, NIF/STAT, logo) restaient donc toujours vides à l'écran
      // même quand la valeur existait déjà en base.
      address: workspace.activeStore?.address || "",
      phone: workspace.activeStore?.phone || "",
      email: workspace.activeStore?.email || "",
      nifStat: workspace.activeStore?.nif_stat || "",
      logoUrl: workspace.activeStore?.logo_url || undefined,
      receiptFooter: workspace.activeStore?.receipt_footer || "",
    }),
    [workspace.activeStore],
  );

  // Écriture réelle des paramètres de la boutique (onglet "Ma boutique" /
  // "Mon compte" côté ParametresView). Avant ce correctif, onUpdateSettings
  // était une fonction vide : aucun champ ne se sauvegardait jamais.
  const handleUpdateSettings = async (newSettings: Partial<StoreSettings>) => {
    if (!workspace.activeStore) {
      alert("Impossible de mettre à jour la boutique : aucune boutique active.");
      return;
    }

    const updates: Record<string, any> = {};
    if (newSettings.storeName !== undefined) updates.name = newSettings.storeName;
    if (newSettings.subtitle !== undefined) updates.subtitle = newSettings.subtitle;
    if (newSettings.address !== undefined) updates.address = newSettings.address;
    if (newSettings.phone !== undefined) updates.phone = newSettings.phone;
    if (newSettings.email !== undefined) updates.email = newSettings.email;
    if (newSettings.nifStat !== undefined) updates.nif_stat = newSettings.nifStat;
    if (newSettings.logoUrl !== undefined) updates.logo_url = newSettings.logoUrl;
    if (newSettings.receiptFooter !== undefined) updates.receipt_footer = newSettings.receiptFooter;
    if (newSettings.currencySymbol !== undefined) updates.currency_symbol = newSettings.currencySymbol;
    if (newSettings.tvaRate !== undefined) updates.tva_rate = newSettings.tvaRate;
    // La colonne `suppliers` existait déjà et était lue (voir storeSettings
    // plus haut, et AchatsView) mais n'était jamais réécrite : la liste des
    // fournisseurs n'était donc modifiable nulle part.
    if (newSettings.suppliers !== undefined) updates.suppliers = newSettings.suppliers;
    if (newSettings.enablePinSecurity !== undefined)
      updates.enable_pin_security = newSettings.enablePinSecurity;

    if (Object.keys(updates).length === 0) return;

    const res = await workspace.updateStore(workspace.activeStore.id, updates);
    if (res.error) {
      alert("Erreur lors de la mise à jour de la boutique : " + res.error);
    }
  };

  const computedSellers = useMemo(() => {
    const memberNames = storeMembers.map((m) => m.full_name || m.email);
    const legacyNames = Array.from(
      new Set([...sales.map((s) => s.vendeur), ...expenses.map((e) => e.vendeur)]),
    ).filter((n) => !memberNames.includes(n));

    // Le propriétaire (founder) de la boutique doit TOUJOURS pouvoir être
    // sélectionné comme vendeur, même s'il n'a invité personne et n'a
    // encore réalisé aucune vente. Il n'apparaît jamais dans storeMembers
    // (cette table ne contient que les collaborateurs invités), donc on
    // l'ajoute manuellement à la liste ici.
    const ownerName = (profile?.full_name || user?.email || "Propriétaire").trim();
    const namesSet = new Set<string>([...memberNames, ...legacyNames]);
    if (workspace.isOwner && ownerName) {
      namesSet.add(ownerName);
    }
    const allNames = Array.from(namesSet);

    return allNames.map((nom, i) => {
      const sellerSales = sales.filter((v) => v.vendeur === nom);
      const totalSalesMontant = sellerSales.reduce((acc, v) => acc + v.totalVente, 0);
      const sellerExpenses = expenses.filter((e) => e.vendeur === nom);
      const totalDepenses = sellerExpenses.reduce((acc, e) => acc + e.montant, 0);
      const totalEncaisse = sellerSales.reduce((acc, v) => acc + v.montantPaye, 0);
      const member = storeMembers.find((m) => (m.full_name || m.email) === nom);
      const id = member?.id ?? (nom === ownerName && workspace.isOwner ? user?.id : undefined) ?? `V${i}`;
      return {
        id,
        nom,
        statut: "Actif" as const,
        totalVentesMontant: totalSalesMontant,
        totalVentesNombre: sellerSales.length,
        totalDepenses,
        soldeNetEnPoche: totalEncaisse - totalDepenses,
      };
    });
  }, [sales, expenses, storeMembers, profile, user, workspace.isOwner]);

  // "Mon activité" — utilisé uniquement pour la vue restreinte d'un
  // collaborateur sans permission dashboard/capital complète (MyActivityView).
  const myStoreMember = storeMembers.find((m) => m.user_id === user?.id);
  const myName = workspace.isOwner
    ? (profile?.full_name || user?.email || "").trim()
    : myStoreMember?.full_name || myStoreMember?.email || "";
  const mySellerData = computedSellers.find((s) => s.nom === myName) ?? null;

  const hasCapitalAccess =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("capital");
  const hasDashboardPermission =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("dashboard");
  // Le Dashboard complet contient des chiffres financiers globaux
  // (trésorerie, achats, dépenses...) : il faut donc EXPLICITEMENT les
  // permissions "Dashboard" ET "Capital" toutes les deux, sinon vue
  // restreinte à l'activité personnelle. Avant ce correctif, "Dashboard"
  // seul suffisait à tout révéler même sans "Capital" — faille corrigée
  // le 21/08/2026.
  const hasDashboardAccess = hasDashboardPermission && hasCapitalAccess;

  const hasVentesAccess =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("ventes");
  // Si la permission "Ventes" n'est pas accordée, l'onglet reste visible
  // mais ne montre QUE les ventes réalisées par ce collaborateur lui-même
  // (jamais le tableau complet de l'entreprise) — même principe que
  // Dashboard/Capital, généralisable aux autres pages au besoin.
  const mySales = useMemo(
    () => (myName ? sales.filter((s) => s.vendeur === myName) : []),
    [sales, myName],
  );
  const visibleSales = hasVentesAccess ? sales : mySales;

  // ── Clients : portée own/team/all ──
  const hasClientsModule =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("clients");
  const clientsScope = workspace.isOwner
    ? "all"
    : getModuleScope(workspace.memberPermissionsDetailed ?? {}, "clients");
  const visibleClients = useMemo(() => {
    if (!hasClientsModule) return [];
    if (clientsScope === "all") return storeData.clients;
    // "own"/"team" traités identiquement pour l'instant : filtré sur le
    // créateur du client (created_by). Une vraie notion d'équipe
    // nécessiterait un regroupement de vendeurs, hors périmètre ici.
    return storeData.clients.filter((c: any) => c.created_by === user?.id);
  }, [storeData.clients, hasClientsModule, clientsScope, user?.id]);

  // ── Commandes : portée own/team/all ──
  const hasCommandesModule =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("commandes");
  const commandesScope = workspace.isOwner
    ? "all"
    : getModuleScope(workspace.memberPermissionsDetailed ?? {}, "commandes");
  const visibleOrders = useMemo(() => {
    if (!hasCommandesModule) return [];
    if (commandesScope === "all") return storeData.orders;
    return storeData.orders.filter((o: any) => o.owner_id === user?.id);
  }, [storeData.orders, hasCommandesModule, commandesScope, user?.id]);

  // ── Produits : champs sensibles + actions (pas de portée, catalogue partagé) ──
  const produitsVisibleFields = workspace.isOwner
    ? null
    : ["nom", "prix_vente", "prix_achat", "stock_disponible", "valeur_stock", "fournisseur"].filter(
        (f) => isFieldVisible(workspace.memberPermissionsDetailed ?? {}, "produits", f),
      );
  const produitsActions = workspace.isOwner
    ? null
    : ["view", "create", "edit", "delete", "adjust_stock", "inventory"].filter((a) =>
        hasModuleAction(workspace.memberPermissionsDetailed ?? {}, "produits", a),
      );

  // ── Fournisseurs : le module est neuf, seules les actions
  // comptent — il n a pas de portée par utilisateur, un fournisseur
  // appartient à la boutique entière. ──
  const fournisseursActions = workspace.isOwner
    ? null
    : ["view", "create", "edit", "delete"].filter((a) =>
        hasModuleAction(workspace.memberPermissionsDetailed ?? {}, "fournisseurs", a),
      );

  // ── Ventes : champs sensibles (la portée own/all est déjà gérée plus
  // haut via `visibleSales`) ──
  const ventesVisibleFields = workspace.isOwner
    ? null
    : ["montant", "paiement", "solde", "benefice", "marge"].filter((f) =>
        isFieldVisible(workspace.memberPermissionsDetailed ?? {}, "ventes", f),
      );

  // ── Achats : champs sensibles (prix négociés, identité des
  // fournisseurs). Pas de portée : le stock est commun à la boutique. ──
  const achatsVisibleFields = workspace.isOwner
    ? null
    : ["prix_fournisseurs", "fournisseur", "paiements_fournisseurs"].filter((f) =>
        isFieldVisible(workspace.memberPermissionsDetailed ?? {}, "achats", f),
      );

  // ── Dépenses : portée own/all, même principe que Ventes ──
  const hasDepensesModule =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("depenses");
  const depensesScope = workspace.isOwner
    ? "all"
    : getModuleScope(workspace.memberPermissionsDetailed ?? {}, "depenses");
  const visibleExpenses = useMemo(() => {
    if (!hasDepensesModule) return [];
    if (depensesScope === "all") return expenses;
    return myName ? expenses.filter((e) => e.vendeur === myName) : [];
  }, [expenses, hasDepensesModule, depensesScope, myName]);

  // ── Paiements à recevoir : portée own/all, dérivée des ventes/commandes
  // déjà scopées (un paiement est "à soi" s'il concerne SA vente ou SA
  // commande) ──
  const hasPaiementsModule =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("paiements");
  const paiementsScope = workspace.isOwner
    ? "all"
    : getModuleScope(workspace.memberPermissionsDetailed ?? {}, "paiements");
  const visiblePayments = useMemo(() => {
    if (!hasPaiementsModule) return [];
    if (paiementsScope === "all") return payments;
    const mySaleIds = new Set(visibleSales.map((s) => s.id));
    const myOrderIds = new Set(visibleOrders.map((o: any) => o.id));
    return payments.filter(
      (p) => (p.saleId && mySaleIds.has(p.saleId)) || (p.orderId && myOrderIds.has(p.orderId)),
    );
  }, [payments, hasPaiementsModule, paiementsScope, visibleSales, visibleOrders]);

  // ── Historique : portée own/all, filtre chaque flux sous-jacent ──
  const hasHistoriqueModule =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("historique");
  const historiqueScope = workspace.isOwner
    ? "all"
    : getModuleScope(workspace.memberPermissionsDetailed ?? {}, "historique");
  const historiquePurchases = useMemo(() => {
    if (!hasHistoriqueModule) return [];
    if (historiqueScope === "all") return purchases;
    // Le type Purchase (transformé) ne porte pas owner_id — on croise avec
    // les données brutes de storeData, qui elles l'ont, pour obtenir les
    // identifiants des achats appartenant à cet utilisateur.
    const myPurchaseIds = new Set(
      storeData.purchases.filter((p) => p.owner_id === user?.id).map((p) => p.id),
    );
    return purchases.filter((p) => myPurchaseIds.has(p.id));
  }, [purchases, storeData.purchases, hasHistoriqueModule, historiqueScope, user?.id]);
  const historiqueApports = useMemo(() => {
    if (!hasHistoriqueModule) return [];
    // Les apports en capital restent une donnée propriétaire uniquement,
    // même en portée "own" (un collaborateur n'apporte pas de capital).
    return historiqueScope === "all" ? apports : [];
  }, [apports, hasHistoriqueModule, historiqueScope]);

  const computedCapital = useMemo(() => {
    const capitalInitial = workspace.activeStore?.capital_initial || 0;
    const seuilAlerte = workspace.activeStore?.seuil_alerte_tresorerie || 0;
    const apportsTotal = apports.reduce((acc, a) => acc + a.montant, 0);
    const ventesTotalEncaisse = sales.reduce((acc, s) => acc + s.montantPaye, 0);
    const commandesTotalEncaisse = storeData.orders.reduce(
      (acc, o) => acc + (o.montant_paye ?? 0),
      0,
    );
    const achatsTotal = purchases.reduce((acc, p) => acc + p.totalAchat, 0);
    const depensesVendeursTotal = expenses.reduce((acc, e) => acc + e.montant, 0);
    // PHASE 1 : les remboursements (ventes + commandes) sont de l'argent qui
    // ressort réellement de la trésorerie. Ils ne modifient jamais montant_paye
    // (paiement d'origine conservé), donc on les soustrait ici séparément.
    const remboursementsTotal =
      sales.reduce((acc, s) => acc + (s.montantRembourse ?? 0), 0) +
      storeData.orders.reduce((acc, o) => acc + (o.montant_rembourse ?? 0), 0);
    return {
      capitalInitial,
      apportsTotal,
      ventesTotalEncaisse: ventesTotalEncaisse + commandesTotalEncaisse,
      achatsTotal,
      depensesVendeursTotal,
      tresorerieGlobaleActuelle:
        capitalInitial +
        apportsTotal +
        ventesTotalEncaisse +
        commandesTotalEncaisse -
        achatsTotal -
        depensesVendeursTotal -
        remboursementsTotal,
      seuilAlerteTresorerie: seuilAlerte,
    };
  }, [apports, sales, purchases, expenses, workspace.activeStore, storeData.orders]);

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stockActuel <= p.seuilAlerte).length,
    [products],
  );

  const [activityToast, setActivityToast] = useState<{
    id: string;
    vendeur: string;
    type: any;
    message: string;
    timestamp: string;
  } | null>(null);

  const triggerActivityAlert = (vendeur: string, type: any, message: string) => {
    // Réglage « Activité des vendeurs » (Paramètres → Notifications).
    if (!notificationPrefs.activityAlerts) return;

    const toast = {
      id: String(Date.now()),
      vendeur,
      type,
      message,
      timestamp: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    setActivityToast(toast);
    setTimeout(
      () => setActivityToast((current) => (current?.id === toast.id ? null : current)),
      6000,
    );
  };

  // ─── CRUD handlers ───
  const handleAddProduct = async (newP: any) => {
    const res = await storeData.addProduct({
      designation: newP.designation,
      variant_suffix: "",
      display_name: newP.designation,
      prix_achat: newP.prixAchat,
      prix_vente_defaut: newP.prixVenteDefaut,
      fournisseur: newP.fournisseur,
      stock_initial: newP.stockInitial,
      stock_actuel: newP.stockActuel,
      seuil_alerte: newP.seuilAlerte,
    });
    if (res.error) {
      alert("Erreur lors de l'ajout du produit : " + res.error);
      return res;
    }
    triggerActivityAlert(
      "Magasinier",
      "produit",
      `Nouveau produit créé : ${newP.designation}`,
    );
    return res;
  };

  const handleAddPurchase = async (newPurchase: any) => {
    // RÈGLE 4/11 (Phase 1) : le choix "quel produit" (existant ou nouveau) reste
    // une décision métier côté client (correspondance floue sur désignation +
    // prix + fournisseur), mais l'écriture elle-même (création/mise à jour du
    // produit + insertion de l'achat + mouvement de stock) est désormais une
    // seule opération atomique côté base (RPC add_purchase). Si l'achat échoue,
    // aucune modification de stock ni de produit n'est appliquée.
    const matchingProd = products.find(
      (p) =>
        p.designation.toLowerCase() === newPurchase.designation.toLowerCase() &&
        Math.abs(p.prixAchat - newPurchase.prixAchatUnit) < 0.01 &&
        p.fournisseur.toLowerCase() === newPurchase.fournisseur.toLowerCase(),
    );

    const newDisplayName = newPurchase.designation;
    const prodDisplayName = matchingProd ? matchingProd.designation : newDisplayName;
    const totalAchat = newPurchase.quantite * newPurchase.prixAchatUnit;

    const res = await storeData.addPurchase({
      date: newPurchase.date,
      product_id: matchingProd ? matchingProd.id : null,
      new_product: matchingProd
        ? null
        : {
            designation: newPurchase.designation,
            variant_suffix: "",
            display_name: newDisplayName,
            prix_vente_defaut: Math.round(newPurchase.prixAchatUnit * 1.3),
            seuil_alerte: 5,
          },
      quantite: newPurchase.quantite,
      prix_achat_unit: newPurchase.prixAchatUnit,
      fournisseur: newPurchase.fournisseur,
    });

    if (res.error) {
      alert("Erreur lors de l'ajout de l'achat : " + res.error);
    } else {
      triggerActivityAlert(
        "Acheteur",
        "achat",
        `Nouvel achat : ${prodDisplayName} (Total: ${totalAchat} Ar)`,
      );
    }
    return res;
  };

  const handleUpdateOrder = async (
    orderId: string,
    data: { statut_commande?: OrderStatus; [key: string]: any },
  ) => {
    // PHASE 1 : toute la logique de stock (revalidation, transformation de la
    // réservation en sortie réelle à la livraison, restitution en cas
    // d'annulation après livraison, idempotence anti-double-clic) est
    // désormais gérée atomiquement côté base par la fonction set_order_status
    // (verrouillage FOR UPDATE + no-op si le statut est déjà celui demandé).
    // React ne fait plus aucun calcul de stock ici.
    if (!data.statut_commande) return { error: "Statut manquant" };
    const res = await storeData.updateOrder(orderId, { statut_commande: data.statut_commande });
    if (res.error) {
      alert("Erreur lors de la mise à jour de la commande : " + res.error);
    }
    return res;
  };

  const handleAddSale = async (newSale: any) => {
    const prod = products.find((p) => p.id === newSale.productId);
    if (!prod) return { sale: null, error: "Produit introuvable" };

    // PHASE 1 : la vérification du stock, la décrémentation, la création de
    // la vente et l'enregistrement du paiement initial sont désormais une
    // seule opération atomique côté base (RPC create_sale, avec verrouillage
    // FOR UPDATE sur le produit). Impossible de vendre plus que le stock
    // réellement disponible au moment exact de l'écriture, même en cas
    // d'actions concurrentes.
    const res = await storeData.addSale({
      date: newSale.date,
      product_id: prod.id,
      quantite: newSale.quantite,
      prix_vente_unit: newSale.prixVenteUnit,
      vendeur: newSale.vendeur,
      client_credit: newSale.clientCredit || null,
      client_id: newSale.clientId || null,
      montant_paye_initial: newSale.montantPaye > 0 ? newSale.montantPaye : 0,
      methode: "especes",
    });

    if (res.error || !res.sale) {
      alert("Erreur lors de l'ajout de la vente : " + res.error);
      storeData.refresh();
      return res;
    }

    triggerActivityAlert(
      newSale.vendeur,
      "vente",
      `Vente : ${getProductLabel(prod, products)} x${newSale.quantite}`,
    );
    return res;
  };

  const handleEditSale = async (updatedSale: Sale) => {
    // PHASE 1 : le delta de quantité et sa validation (stock suffisant si la
    // quantité augmente) sont désormais appliqués atomiquement côté base par
    // la RPC update_sale_quantity (verrouillage FOR UPDATE sur le produit).
    // montant_paye / solde_du / statut_credit restent exclusivement gérés par
    // la table payments + le trigger SQL (voir addPaymentToSale / refundSale).
    const res = await storeData.updateSale(updatedSale.id, {
      quantite: updatedSale.quantite,
      total_vente: updatedSale.totalVente,
      client_credit: updatedSale.clientCredit || null,
      client_id: updatedSale.clientId || null,
    });
    if (res.error) {
      alert("Erreur lors de la modification de la vente : " + res.error);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    // PHASE 1 : la restitution du stock est appliquée atomiquement côté base
    // par la RPC delete_sale (verrouillage FOR UPDATE sur le produit).
    const res = await storeData.deleteSale(saleId);
    if (res.error) {
      alert("Erreur lors de la suppression de la vente : " + res.error);
    }
  };

  const handleAddExpense = async (newExp: any) => {
    const res = await storeData.addExpense({
      date: newExp.date,
      vendeur: newExp.vendeur,
      type: newExp.type,
      montant: newExp.montant,
      note: newExp.note,
      impact_tresorerie_globale: -newExp.montant,
    });
    if (res.error) {
      alert("Erreur lors de l'ajout de la dépense : " + res.error);
      return;
    }
    triggerActivityAlert(newExp.vendeur, "depense", `Dépense : ${newExp.montant} Ar`);
  };

  const handleEditExpense = async (updatedExpense: Expense) => {
    await storeData.updateExpense(updatedExpense.id, {
      montant: updatedExpense.montant,
      note: updatedExpense.note,
    });
  };

  const handleDeleteExpense = async (expenseId: string) => {
    await storeData.deleteExpense(expenseId);
  };

  const handleAddApport = async (newApport: any) => {
    try {
      const res = await storeData.addApport({
        date: newApport.date,
        montant: newApport.montant,
        source: newApport.source,
        note: newApport.note || null,
      });
      if (res.error) {
        console.error("Erreur ajout apport:", res.error);
        alert("Erreur lors de l'ajout de l'apport : " + res.error);
      }
    } catch (e: any) {
      console.error("Exception ajout apport:", e);
      alert("Erreur inattendue lors de l'ajout de l'apport : " + (e?.message ?? e));
    }
  };

  const handleDeleteApport = async (id: string) => {
    await storeData.deleteApport(id);
  };

  const handleUpdateCapitalInitial = async (amount: number) => {
    if (!workspace.activeStore) {
      alert("Impossible de mettre à jour le capital initial : aucune boutique active.");
      return;
    }
    try {
      const res = await workspace.updateStore(workspace.activeStore.id, {
        capital_initial: amount,
      } as any);
      if (res.error) {
        console.error("Erreur mise à jour capital_initial:", res.error);
        alert("Erreur lors de la mise à jour du capital initial : " + res.error);
      }
    } catch (e: any) {
      console.error("Exception mise à jour capital_initial:", e);
      alert("Erreur inattendue lors de la mise à jour du capital initial : " + (e?.message ?? e));
    }
  };

  const handleUpdateSeuil = async (seuil: number) => {
    if (!workspace.activeStore) {
      alert("Impossible de mettre à jour le seuil d'alerte : aucune boutique active.");
      return;
    }
    try {
      const res = await workspace.updateStore(workspace.activeStore.id, {
        seuil_alerte_tresorerie: seuil,
      } as any);
      if (res.error) {
        console.error("Erreur mise à jour seuil_alerte_tresorerie:", res.error);
        alert("Erreur lors de la mise à jour du seuil d'alerte : " + res.error);
      }
    } catch (e: any) {
      console.error("Exception mise à jour seuil_alerte_tresorerie:", e);
      alert("Erreur inattendue lors de la mise à jour du seuil d'alerte : " + (e?.message ?? e));
    }
  };

  const handleDownloadExcel = () => {
    downloadExcelWorkbook(computedCapital, products, purchases, sales, computedSellers, expenses);
  };

  // ─── Suppression réelle d'un collaborateur (store_members) ───
  const handleDeleteSeller = async (sellerId: string) => {
    const isRealMember = storeMembers.some((m) => m.id === sellerId);
    if (isRealMember) {
      const res = await removeStoreMember(sellerId);
      if (res.error) alert("Erreur lors de la suppression : " + res.error);
    }
  };

  if (workspace.loading) {
    return <AppLoader etape="Ouverture de votre boutique…" />;
  }

  // Nouveau compte sans boutique (ancien blocage par paiement supprimé) :
  // propose de créer sa boutique ou de rejoindre via invitation, plutôt
  // que d'afficher un tableau de bord vide et confus.
  if (!workspace.activeStore) {
    return <CreateStoreOnboarding />;
  }

  // Essai gratuit expiré sans activation (ou verrouillage explicite) :
  // affiche l'écran de blocage au lieu de l'app. Ceci est l'expérience
  // utilisateur — la vraie barrière de sécurité est déjà posée côté
  // Supabase par les RLS (voir can_modify_in_store / store_allows_write),
  // donc même en contournant ce composant, aucune écriture n'est
  // possible tant que la boutique n'est pas réellement activée en base.
  {
    const activeStore = workspace.activeStore;
    const trialExpired =
      activeStore.activation_status === "trial" &&
      new Date(activeStore.trial_ends_at).getTime() < Date.now();
    const isStoreLocked = activeStore.activation_status === "locked" || trialExpired;

    if (isStoreLocked) {
      return (
        <StoreLockedScreen
          storeName={activeStore.name}
          storeId={activeStore.id}
          onActivated={workspace.refreshStores}
        />
      );
    }
  }

  if (storeData.loading) {
    return <AppLoader etape="Chargement de vos données…" />;
  }

  return (
    /* Le décalage à gauche libère la place de la sidebar fixe (voir
       src/components/Sidebar.tsx : 16rem ouverte, 4.5rem repliée). Il est
       posé ici plutôt que sur .app-container, dont il écraserait la
       gouttière interne, et il s'applique du coup à la barre du haut
       comme au contenu. */
    <div
      className={`min-h-screen flex flex-col font-sans bg-background text-foreground selection:bg-emerald-500 selection:text-slate-950 transition-[padding] duration-200 ${
        sidebarCollapsed ? "lg:pl-18" : "lg:pl-64"
      }`}
    >
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tresorerie={computedCapital.tresorerieGlobaleActuelle}
        seuilAlerte={computedCapital.seuilAlerteTresorerie}
        lowStockCount={lowStockCount}
        capital={computedCapital}
        settings={storeSettings}
        theme={theme}
        setTheme={setTheme}
        sales={sales}
        purchases={purchases}
        expenses={expenses}
        apports={apports}
        products={products}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      <main className="app-container flex-1 py-4 md:py-6 pb-24 lg:pb-6">
        {activeTab === "dashboard" && (
          hasDashboardAccess ? (
            <DashboardView
              capital={computedCapital}
              products={products}
              sales={sales}
              purchases={purchases}
              expenses={expenses}
              sellers={computedSellers}
              orders={storeData.orders}
              clients={storeData.clients}
              locale={locale}
              onNavigateTab={setActiveTab}
              showPrixAchat={
                produitsVisibleFields === null || produitsVisibleFields.includes("prix_achat")
              }
            />
          ) : (
            <MyActivityView
              variant="dashboard"
              storeName={workspace.activeStore?.name || "cette boutique"}
              mySellerData={mySellerData}
            />
          )
        )}
        {activeTab === "capital" && (
          hasCapitalAccess ? (
            <CapitalView
              capital={computedCapital}
              apports={apports}
              locale={locale}
              onUpdateCapitalInitial={handleUpdateCapitalInitial}
              onUpdateSeuil={handleUpdateSeuil}
              onAddApport={handleAddApport}
              onDeleteApport={handleDeleteApport}
              onDownloadExcel={handleDownloadExcel}
            />
          ) : (
            <MyActivityView
              variant="capital"
              storeName={workspace.activeStore?.name || "cette boutique"}
              mySellerData={mySellerData}
            />
          )
        )}
        {activeTab === "produits" && (
          <ProduitsView
            products={products}
            locale={locale}
            onAddProduct={handleAddProduct}
            onEditProduct={storeData.updateProduct}
            onDeleteProducts={storeData.deleteProducts}
            visibleFields={produitsVisibleFields}
            allowedActions={produitsActions}
          />
        )}
        {activeTab === "achats" && (
          <AchatsView
            purchases={purchases}
            products={products}
            locale={locale}
            settings={storeSettings}
            onAddPurchase={handleAddPurchase}
            visibleFields={achatsVisibleFields}
          />
        )}
        {activeTab === "ventes" && (
          <VentesView
            sales={visibleSales}
            products={products}
            sellers={computedSellers}
            locale={locale}
            settings={storeSettings}
            onAddSale={handleAddSale}
            onEditSale={hasVentesAccess ? handleEditSale : undefined}
            onDeleteSale={hasVentesAccess ? handleDeleteSale : undefined}
            restrictedToOwnSales={!hasVentesAccess}
            visibleFields={ventesVisibleFields}
          />
        )}
        {activeTab === "vendeurs" && (
         <VendeursView
            sellers={computedSellers}
            sales={sales}
            expenses={expenses}
            purchases={purchases}
            locale={locale}
            settings={storeSettings}
            products={products}
            onAddSeller={(nom) => {
              // Les vendeurs sont ajoutés via invitations dans Paramètres > Équipe
              // Rediriger vers paramètres si le nom est vide ou si on veut inviter
              setActiveTab("settings");
            }}
            onDeleteSeller={handleDeleteSeller}
            onEditSale={handleEditSale}
            onDeleteSale={handleDeleteSale}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}
        {activeTab === "depenses" && (
          <DepensesView
            expenses={visibleExpenses}
            sellers={computedSellers}
            locale={locale}
            settings={storeSettings}
            onAddExpense={handleAddExpense}
            onEditExpense={depensesScope === "all" ? handleEditExpense : undefined}
            onDeleteExpense={depensesScope === "all" ? handleDeleteExpense : undefined}
          />
        )}
        {activeTab === "rapports" && (
          <RapportsView
            sales={visibleSales}
            purchases={purchases}
            expenses={visibleExpenses}
            products={products}
            locale={locale}
          />
        )}
        {activeTab === "statistiques" && (
          <StatistiquesView
            sales={visibleSales}
            products={products}
            sellers={
              workspace.isOwner ||
              getModuleScope(workspace.memberPermissionsDetailed ?? {}, "statistiques") === "all"
                ? computedSellers
                : computedSellers.filter((s) => s.nom === myName)
            }
            expenses={visibleExpenses}
            locale={locale}
          />
        )}
        {activeTab === "historique" && (
          <HistoriqueView
            purchases={historiquePurchases}
            sales={visibleSales}
            expenses={visibleExpenses}
            apports={historiqueApports}
            orders={visibleOrders}
            locale={locale}
            products={products}
          />
        )}
        {activeTab === "commandes" && (
          <CommandesView
            orders={visibleOrders}
            clients={storeData.clients}
            products={storeData.products}
            isOwner={workspace.isOwner}
            onAddOrder={storeData.addOrder}
            onUpdateOrder={handleUpdateOrder}
           onAddPayment={storeData.addPaymentToOrder}
            onRefundOrder={storeData.refundOrder}
            onDeleteOrder={storeData.deleteOrder}
          />
        )}
        {activeTab === "paiements" && (
          <PaiementsARecevoirView
            sales={visibleSales}
            orders={visibleOrders}
            payments={visiblePayments}
            products={products}
            onAddPaymentToSale={storeData.addPaymentToSale}
            onAddPaymentToOrder={storeData.addPaymentToOrder}
          />
        )}
        {activeTab === "clients" && (
          <ClientsView
            clients={visibleClients}
            orders={storeData.orders}
            sales={visibleSales}
            payments={visiblePayments}
            onAddClient={storeData.addClient}
            onUpdateClient={storeData.updateClient}
            onDeleteClient={storeData.deleteClient}
            onNavigateToOrders={() => setActiveTab("commandes")}
          />
        )}
        {activeTab === "fournisseurs" && (
          <FournisseursView
            suppliers={storeData.suppliers}
            purchases={purchases}
            products={products}
            onAddSupplier={storeData.addSupplier}
            onUpdateSupplier={storeData.updateSupplier}
            onDeleteSupplier={storeData.deleteSupplier}
            peutCreer={!fournisseursActions || fournisseursActions.includes("create")}
            peutModifier={!fournisseursActions || fournisseursActions.includes("edit")}
            peutSupprimer={!fournisseursActions || fournisseursActions.includes("delete")}
          />
        )}
        {activeTab === "settings" && (
          <ParametresView
            settings={storeSettings}
            onUpdateSettings={handleUpdateSettings}
            sellers={computedSellers}
            onDeleteSeller={handleDeleteSeller}
            locale={locale}
            setLocale={setLocale}
            capital={computedCapital}
            onDownloadExcel={handleDownloadExcel}
            theme={theme}
            setTheme={setTheme}
            isPlatformAdmin={profile?.is_platform_admin ?? false}
            currentUserId={user?.id ?? undefined}
          />
        )}
      </main>

      {activityToast && (
        <div className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 sm:max-w-md bg-card/95 border-2 border-success-border rounded-2xl p-4 shadow-2xl flex items-start gap-3 backdrop-blur-md">
          <div className="p-2.5 rounded-xl bg-success-soft t-success shrink-0 mt-0.5">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold t-success uppercase tracking-wider text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success animate-ping"></span>
                Alerte Activité
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {activityToast.timestamp}
              </span>
            </div>
            <p className="text-foreground font-medium leading-relaxed">
              <span className="font-bold t-warning bg-warning-soft px-1.5 py-0.5 rounded mr-1">
                {activityToast.vendeur}
              </span>{" "}
              {activityToast.message}
            </p>
          </div>
          <button
            onClick={() => setActivityToast(null)}
            className="p-1 text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WorkspaceLoader : inside authContext, creates workspaceContext ───
function WorkspaceLoader({ children }: { children: React.ReactNode }) {
  const workspaceState = useWorkspaceState();
  return <workspaceContext.Provider value={workspaceState}>{children}</workspaceContext.Provider>;
}

// ─── Root App ───
// Note: authContext is now provided once at the root level (see src/routes/__root.tsx),
// so this component simply consumes it via useAuth() instead of creating its own instance.
export default function App() {
  const { user, profile, loading, isActivated, isPasswordRecovery } = useAuth();
  const [locked, setLocked] = useState(false);
  // Empêche de re-verrouiller plusieurs fois pendant la même session déjà
  // déverrouillée : on ne veut appliquer cette règle qu'UNE SEULE fois,
  // au tout premier chargement (nouvel onglet, retour sur le site après
  // fermeture, F5...), pas à chaque re-render une fois l'app ouverte.
  const pinCheckedOnBootRef = React.useRef(false);

  useEffect(() => {
    if (pinCheckedOnBootRef.current) return;
    if (loading || !user || !profile) return;

    // Un PIN est configuré : quel que soit le temps écoulé, on exige le
    // code PIN dès l'arrivée sur le site (nouvel onglet, réouverture du
    // navigateur, rechargement de page...). L'inactivité pendant que
    // l'app est déjà ouverte est gérée séparément par useSessionTimeout.
    if (profile.pin_hash) {
      setLocked(true);
    }
    pinCheckedOnBootRef.current = true;
  }, [loading, user, profile]);

  // La page ne doit pas défiler derrière la surcouche de verrouillage.
  useEffect(() => {
    if (!locked) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = precedent;
    };
  }, [locked]);

  const timeoutMinutes = profile?.session_timeout_minutes ?? 30;
  useSessionTimeout({
    timeoutMinutes,
    enabled: !!user && !!profile?.pin_hash && timeoutMinutes > 0,
    onTimeout: () => setLocked(true),
  });

  if (loading) {
    return <AppLoader etape="Vérification de votre session…" />;
  }

  // Session de récupération de mot de passe (ouverte depuis un autre onglet,
  // ou lien de réinitialisation redirigé vers "/") → ne jamais montrer le
  // tableau de bord tant que le nouveau mot de passe n'a pas été défini.
  if (isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-foreground font-semibold">Réinitialisation de mot de passe en cours</p>
          <p className="text-sm text-muted-foreground">
            Ouvrez le lien reçu par e-mail dans un seul onglet pour terminer la définition de
            votre nouveau mot de passe.
          </p>
        </div>
      </div>
    );
  }

  // Authentification requise, mais le PAIEMENT n'est plus un prérequis pour
  // entrer dans l'app (ancien système supprimé le 18/08/2026). Un nouveau
  // compte accède directement à l'espace de travail, où il pourra créer sa
  // boutique (qui démarre automatiquement en essai gratuit de 7 jours —
  // voir stores.activation_status/trial_ends_at) ou rejoindre une boutique
  // existante via une invitation.
  if (!user) {
    return <AuthPage />;
  }

  /*
   * Le code PIN se pose PAR-DESSUS l'application, il ne la remplace plus.
   *
   * Auparavant, `if (locked) return <PinLockScreen />` démontait tout
   * l'arbre : au déverrouillage, l'espace de travail et l'intégralité
   * des données — produits, ventes, achats, dépenses, commandes,
   * clients — étaient rechargés depuis zéro, derrière trois écrans de
   * chargement successifs. D'où l'attente à chaque saisie du code.
   *
   * L'application reste maintenant montée derrière la surcouche. Le
   * déverrouillage est immédiat, et le chargement initial se fait pendant
   * que l'utilisateur compose son code plutôt qu'après.
   *
   * Ce n'est pas un affaiblissement : le PIN est un verrou de confort
   * local, pas une barrière d'authentification. La vraie protection est
   * posée côté Supabase par les RLS, et la session était déjà ouverte.
   * La surcouche est opaque et couvre tout l'écran : rien du contenu
   * n'est lisible derrière.
   */
  return (
    <>
      {/* `inert` neutralise tout ce qui est derrière la surcouche :
          sans lui, la tabulation continuerait de parcourir les champs de
          l'application masquée, et un lecteur d'écran les annoncerait.
          Pris en charge nativement par React 19. */}
      <div inert={locked ? true : undefined}>
        <WorkspaceLoader>
          <AppInner />
        </WorkspaceLoader>
      </div>

      {locked && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
          <PinLockScreen onUnlock={() => setLocked(false)} />
        </div>
      )}
    </>
  );
}
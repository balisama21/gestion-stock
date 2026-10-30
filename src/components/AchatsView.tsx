import React, { useState, useMemo, useRef, useEffect } from "react";
import { Purchase, Product, LocaleSetting, StoreSettings } from "../types";
import { useMarque } from "../hooks/useMarque";
import {
  ShoppingCart,
  Save,
  Plus,
  Search,
  Filter,
  DollarSign,
  PackageCheck,
  Truck,
  FileText,
  Image as ImageIcon,
  Printer,
  Eye,
  RefreshCw,
  AlertCircle,
  Tag,
  Download,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import {
  formatCurrency,
  formatDateLocale,
  getProductLabel,
  getPurchaseLabel,
  getPurchaseVariant,
  quantiteEnMots,
} from "../utils/formulas";
import { VariantBadge } from "./shared/VariantBadge";
import { DetailsProduit } from "./produits/DetailsProduit";
import {
  DETAILS_VIDES,
  detailsVersBase,
  nomsDesCategories,
  type ValeursDetails,
} from "../lib/detailsProduit";
import { EditeurConditionnements } from "./produits/EditeurConditionnements";
import { SelecteurUnite } from "./produits/SelecteurUnite";
import { ChampPrixDeVente } from "./produits/ChampPrixDeVente";
import {
  auPluriel,
  erreurConditionnements,
  libelleUnite,
  prixAchatDe,
  prixUnitaireDepuis,
  quantiteDeLigne,
  stockEnConditionnements,
  type Conditionnement,
} from "../lib/conditionnements";
import type { Database } from "../lib/database.types";
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList, type DataListItem } from "./shared/DataList";
import { SelecteurFournisseur } from "./shared/SelecteurFournisseur";
import { SelecteurProduit, versProduitAChoisir } from "./shared/SelecteurProduit";
import { cleDeListe } from "../lib/listes";
import {
  PRIX_AUTO_DEFAUT,
  calculerLaMarge,
  formaterTaux,
  prixDepuisAchat,
  tauxApplicable,
  type ReglagesPrixAuto,
} from "../lib/prixAuto";
import { VignetteProduit, vignettesParProduit } from "./shared/VignetteProduit";
import { DateJour, Deux, Montant, Texte } from "./shared/Cellules";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import { exporterPdf, exporterImage, imprimerDocument, nomDeFichier } from "../lib/documentExport";
import { reprendreApresDeploiement, messageDErreurExport } from "../lib/chunkRecovery";
import { PAPER_FORMATS, getPaperFormat, type PaperFormatId } from "../lib/paperFormats";
import { dateDuJour } from "../lib/dates";
import { envoyerFichier, supprimerFichier } from "../lib/stockageFichiers";
import { useOuvertureFiche, useRechercheInitiale } from "../lib/cibleRecherche";
import { Equivalents } from "../lib/contexteDevises";
import { symboleDeSaisie } from "../lib/affichageDevise";

interface AchatsViewProps {
  /** Bouton d'import (achats, produits, fournisseurs… depuis un fichier). */
  importer?: React.ReactNode;
  /** Ouvrir le classeur des factures reçues des fournisseurs. */
  onOuvrirFacturesRecues?: () => void;
  purchases: Purchase[];
  products: Product[];
  locale: LocaleSetting;
  settings?: StoreSettings;
  onAddPurchase: (purchase: {
    date: string;
    designation: string;
    quantite: number;
    prixAchatUnit: number;
    fournisseur: string;
    /** La fiche de l'annuaire à laquelle rattacher l'achat. */
    supplier_id?: string | null;
    /** Ce qui sort de la caisse maintenant. Omis = réglé en totalité. */
    montantPaye?: number | null;
    dateEcheance?: string | null;
    /**
     * Le produit rechargé, désigné par son identifiant. Présent, l'achat
     * va à CE produit, quel que soit son prix : c'est ce qui empêche un
     * réapprovisionnement à un autre prix de créer un doublon.
     */
    productId?: string | null;
    /** Acheté au carton, au sac… `quantite` est alors en unités de base. */
    conditionnement?: { id: string; nombre: number; prix: number } | null;
    // `productId` est celui du produit touché par l'achat — qu'il vienne
    // d'être créé ou qu'il existait déjà. C'est sur lui que la fiche
    // descriptive s'écrit ensuite.
  }) => Promise<{ error: string | null; productId?: string | null }>;
  /**
   * De quoi remplir la fiche produit depuis un achat.
   *
   * Un achat dont la désignation ne correspond à rien CRÉE un produit :
   * il faut donc pouvoir le décrire ici, sinon il naîtrait sans
   * catégorie ni code-barres et il faudrait aller le compléter ailleurs.
   * C'est exactement la même fiche que dans l'écran Produits.
   */
  categories?: Database["public"]["Tables"]["categories"]["Row"][];
  /** Absente, le sélecteur ne propose pas d'ajouter. */
  onCreerCategorie?: (nom: string) => Promise<{ id: string | null; error: string | null }>;
  /** Le calcul du prix de vente, réglé par la boutique. Absent = désactivé. */
  prixAuto?: ReglagesPrixAuto;
  /**
   * Reporter le prix d'achat sur la fiche du produit. Jamais
   * automatique : cela déplacerait la marge de toutes les ventes à venir.
   */
  onReporterPrixAchat?: (
    id: string,
    data: {
      designation: string;
      prixAchat: number;
      prixVenteDefaut: number;
      fournisseur: string;
      seuilAlerte: number;
    },
  ) => Promise<{ error: string | null }>;
  fournisseurs?: Database["public"]["Tables"]["suppliers"]["Row"][];
  storeId?: string | null;
  /**
   * Un produit à réapprovisionner, venu du tableau de bord.
   *
   * Le formulaire s'ouvre déjà rempli : désignation, prix d'achat et
   * fournisseur repris de la fiche, il ne reste que la quantité. La
   * désignation doit être celle du produit AU MOT PRÈS — c'est sur elle
   * que la base reconnaît un achat comme un réapprovisionnement plutôt
   * que comme la création d'un nouveau produit.
   */
  /**
   * Supprimer un achat enregistré par erreur.
   *
   * La base fait le travail : elle remet le stock comme avant, écrit le
   * mouvement correspondant et efface le règlement attaché. La
   * trésorerie remonte d'elle-même, puisqu'elle est la somme des achats
   * qui restent.
   *
   * Absent quand l'action « supprimer » n'est pas accordée.
   */
  onDeletePurchase?: (id: string) => Promise<{ error: string | null }>;
  /**
   * Corriger un achat déjà enregistré.
   *
   * La DÉSIGNATION n'y figure pas, et ce n'est pas un oubli : changer le
   * produit concerné reviendrait à déplacer du stock d'un article vers
   * un autre et à rejouer la règle de correspondance qui a créé la
   * fiche. C'est une suppression suivie d'un nouvel achat, pas une
   * correction — et l'écran le dit plutôt que de laisser essayer.
   */
  onUpdatePurchase?: (
    id: string,
    data: {
      date: string;
      quantite: number;
      prixAchatUnit: number;
      fournisseur: string;
      supplier_id?: string | null;
      montantRegle?: number | null;
    },
  ) => Promise<{ error: string | null }>;
  /** Absente, le sélecteur ne propose pas d'ajouter. */
  onAddFournisseur?: (data: { nom: string; telephone?: string | null }) => Promise<{
    supplier: Database["public"]["Tables"]["suppliers"]["Row"] | null;
    error: string | null;
  }>;
  onUpdateFournisseur?: (
    id: string,
    data: { telephone: string },
  ) => Promise<{ error: string | null }>;
  reapprovisionner?: { designation: string; prixAchat: number; fournisseur: string } | null;
  /** Appelé une fois le formulaire ouvert, pour ne pas le rouvrir sans fin. */
  onReapprovisionnementOuvert?: () => void;
  onEditProductDetails?: (id: string, data: any) => Promise<{ error: string | null }>;
  /**
   * Créer le produit qu'achète cet achat, avec sa fiche complète.
   *
   * Le produit naît d'abord — prix de vente, seuil, unité, conditionnements
   * —, l'achat le recharge ensuite. Si l'achat échoue, le produit reste et
   * le formulaire bascule dessus : réessayer le recharge, sans doublon.
   */
  onCreerProduit?: (p: {
    designation: string;
    prixAchat: number;
    prixVenteDefaut: number;
    fournisseur: string;
    stockInitial: number;
    stockActuel: number;
    seuilAlerte: number;
  }) => Promise<{ error: string | null; id?: string | null }>;
  /**
   * Rattacher une photo au produit que cet achat vient de creer.
   *
   * Un achat dont la designation ne correspond a rien CREE un produit :
   * la photo choisie ici lui revient donc, exactement comme la fiche
   * descriptive juste au-dessus. Absente, la section Photos retombe sur
   * son ancien message.
   */
  onAddProductImage?: (
    productId: string,
    chemin: string,
    ordre?: number,
  ) => Promise<{ error: string | null }>;
  /** Les photos des produits, pour illustrer les lignes d achat. */
  productImages?: Database["public"]["Tables"]["product_images"]["Row"][];
  /**
   * Champs visibles pour l'utilisateur courant — `null`/`undefined` = tout
   * visible (propriétaire). Permet à un collaborateur de consulter les
   * approvisionnements (quoi, combien, quand) sans voir les prix négociés
   * ni l'identité des fournisseurs.
   * Clés possibles : prix_fournisseurs, fournisseur, paiements_fournisseurs
   * (voir src/lib/permissions.ts).
   */
  visibleFields?: string[] | null;
}

export const AchatsView: React.FC<AchatsViewProps> = ({
  importer,
  onOuvrirFacturesRecues,
  purchases,
  products,
  locale,
  settings,
  onAddPurchase,
  categories = [],
  onCreerCategorie,
  prixAuto = PRIX_AUTO_DEFAUT,
  onReporterPrixAchat,
  fournisseurs = [],
  onAddFournisseur,
  onUpdateFournisseur,
  storeId = null,
  onDeletePurchase,
  onUpdatePurchase,
  reapprovisionner = null,
  onReapprovisionnementOuvert,
  onEditProductDetails,
  onCreerProduit,
  onAddProductImage,
  productImages = [],
  visibleFields,
}) => {
  const marque = useMarque();
  // null/undefined = tout visible (propriétaire). Sinon, seuls les champs
  // explicitement listés sont montrés.
  const showField = (key: string) => !visibleFields || visibleFields.includes(key);
  // `prix_fournisseurs` couvre le prix unitaire ET tous les montants qui
  // en découlent (total achat, impact trésorerie, cumuls) : afficher un
  // total en masquant le prix unitaire ne masquerait rien, puisque
  // total ÷ quantité redonne le prix.
  const showPrix = showField("prix_fournisseurs");
  const showFournisseur = showField("fournisseur");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchaseReceipt, setSelectedPurchaseReceipt] = useState<Purchase | null>(null);
  /** L'achat qu'on s'apprête à supprimer, et ce que la base en dit. */
  const [achatASupprimer, setAchatASupprimer] = useState<Purchase | null>(null);
  /** L'achat qu'on corrige, et la saisie en cours. */
  const [achatAModifier, setAchatAModifier] = useState<Purchase | null>(null);
  const [modDate, setModDate] = useState("");
  const [modQuantite, setModQuantite] = useState("");
  const [modPrix, setModPrix] = useState("");
  const [modFournisseur, setModFournisseur] = useState("");
  const [modSupplierId, setModSupplierId] = useState<string | null>(null);
  const [modRegle, setModRegle] = useState("");
  const [modEnCours, setModEnCours] = useState(false);
  const [modErreur, setModErreur] = useState<string | null>(null);

  /**
   * Ce que la correction va déplacer, calculé pendant la saisie.
   *
   * Un achat touche trois choses à la fois — le stock du produit, le
   * total qui pèse sur la caisse, le règlement versé au fournisseur —
   * et rien ne le dit tant qu'on n'a pas enregistré. Ces trois écarts
   * s'affichent donc sous le formulaire, avant le clic.
   */
  const effetCorrection = useMemo(() => {
    if (!achatAModifier) {
      return { stock: 0, tresorerie: 0, nouveauTotal: 0, resteDu: 0 };
    }
    const q = Math.trunc(Number(modQuantite) || 0);
    const nouveauTotal = q * (Number(modPrix) || 0);
    const regle = Number(modRegle) || 0;
    return {
      stock: q - achatAModifier.quantite,
      // La trésorerie est la somme des achats : elle remonte de ce que
      // le total perd, et inversement.
      tresorerie: achatAModifier.totalAchat - nouveauTotal,
      nouveauTotal,
      resteDu: Math.max(0, nouveauTotal - regle),
      /**
       * On ne règle pas plus que ce qu'on doit.
       *
       * Le cas arrive tout seul : baisser un prix sur un achat réglé
       * comptant laisse un règlement supérieur au nouveau total. La base
       * le refuse ; le dire ici évite de le découvrir en cliquant.
       */
      regleTropHaut: regle > nouveauTotal,
      excedent: Math.max(0, regle - nouveauTotal),
    };
  }, [achatAModifier, modQuantite, modPrix, modRegle]);

  /**
   * Envoie les photos gardées pendant la saisie, une fois le produit né.
   *
   * Rend le message du premier échec, ou `null` si tout est passé. Un
   * fichier parti sans sa ligne en base est retiré du stockage : sinon
   * il occuperait de la place sans que rien ne puisse plus le désigner.
   */
  const envoyerLesPhotosDuProduit = async (
    productId: string,
    fichiers: File[],
  ): Promise<string | null> => {
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

  const ouvrirCorrection = (p: Purchase) => {
    setModDate(p.date);
    setModQuantite(String(p.quantite));
    setModPrix(String(p.prixAchatUnit));
    setModFournisseur(p.fournisseur);
    setModSupplierId(p.supplierId);
    setModRegle(String(p.montantPaye));
    setModErreur(null);
    setAchatAModifier(p);
  };
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** La fiche du produit que cet achat s'apprête à créer, le cas échéant. */
  const [detailsProduit, setDetailsProduit] = useState<ValeursDetails>(DETAILS_VIDES);
  /** Les photos choisies pour le produit que cet achat va creer. */
  const [photosProduit, setPhotosProduit] = useState<File[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  // Une notification peut viser une ligne précise : la recherche
  // s'ouvre alors remplie dessus. Voir `src/lib/cibleRecherche.ts`.
  useRechercheInitiale("achats", setSearchTerm);
  const [supplierFilter, setSupplierFilter] = useState("Tous");

  // Print & Export Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportSupplier, setSelectedReportSupplier] = useState("all");
  const [reportPeriod, setReportPeriod] = useState<"today" | "month" | "all">("today");
  /**
   * Format de papier du journal. Il détermine la disposition — ticket en
   * pleine largeur ou bilan tabulaire —, la largeur exacte de l'aperçu et
   * le format proposé par la boîte d'impression, donc celui du PDF.
   */
  const [paperId, setPaperId] = useState<PaperFormatId>("t80");
  const paper = getPaperFormat(paperId);
  const isTicket = paper.layout === "ticket";

  /** Quelle photo represente chaque produit, calculee une fois. */
  const vignettes = useMemo(() => vignettesParProduit(productImages), [productImages]);

  const todayStr = useMemo(() => dateDuJour(), []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Form State
  const [date, setDate] = useState(dateDuJour());
  /**
   * Recharger un produit du catalogue, ou en créer un.
   *
   * Deux chemins séparés, choisis explicitement. Avant, la base devinait
   * à partir du nom, du prix et du fournisseur : un réapprovisionnement à
   * un autre prix créait en silence un second produit du même nom.
   */
  const [modeProduit, setModeProduit] = useState<"catalogue" | "nouveau">(
    products.length > 0 ? "catalogue" : "nouveau",
  );
  const [designation, setDesignation] = useState("");
  /** Le produit repris du catalogue : l'achat va à lui, et à nul autre. */
  const [produitRecharge, setProduitRecharge] = useState("");
  /** "" = à l'unité de base ; sinon l'identifiant du conditionnement. */
  const [conditionnementId, setConditionnementId] = useState("");
  // Le produit à créer : ce que la fiche « Nouveau produit » demande.
  const [prixVenteNouveau, setPrixVenteNouveau] = useState(0);
  const [modePrixNouveau, setModePrixNouveau] = useState<"auto" | "manuel">(
    prixAuto.actif ? "auto" : "manuel",
  );
  const [tauxNouveau, setTauxNouveau] = useState<number | null>(null);
  const [seuilNouveau, setSeuilNouveau] = useState(0);
  /** Un homonyme existe, et l'on veut quand même un produit distinct. */
  const [varianteVoulue, setVarianteVoulue] = useState(false);
  const produitsAChoisir = useMemo(() => {
    const noms = nomsDesCategories(categories);
    return products.map((p) =>
      versProduitAChoisir(p, products, { prix: showPrix ? "achat" : null, categories: noms }),
    );
  }, [products, categories, showPrix]);
  // Vides au départ : un achat de « 10 × 1 000 » proposé d'office finissait
  // enregistré tel quel quand on ne relisait pas. Le navigateur exige une
  // quantité et un prix d'au moins 1 avant d'envoyer.
  const [quantite, setQuantite] = useState(0);
  const [prixAchatUnit, setPrixAchatUnit] = useState(0);
  const [fournisseur, setFournisseur] = useState("");
  /** La base écrit toujours le NOM ; l'identifiant vient par-dessus. */
  const [supplierId, setSupplierId] = useState<string | null>(null);
  /**
   * Décoché par défaut : jusqu'ici un achat à un prix différent ne
   * touchait jamais au prix de référence du produit.
   */
  const [reporterPrix, setReporterPrix] = useState(false);
  /** Les prix de vente que le dernier achat a fait bouger, à montrer une fois. */
  const [prixReportes, setPrixReportes] = useState<
    { nom: string; avant: number; apres: number }[] | null
  >(null);
  // Comptant par défaut : c'est le cas de loin le plus fréquent, et
  // c'est ce que faisait le logiciel jusqu'ici. Le crédit se choisit.
  const [reglement, setReglement] = useState<"comptant" | "credit">("comptant");
  const [montantRegle, setMontantRegle] = useState(0);
  const [echeance, setEcheance] = useState("");
  const [erreurAchat, setErreurAchat] = useState<string | null>(null);

  /**
   * Le tableau de bord demande un réapprovisionnement.
   *
   * La quantité reste à saisir — c'est la seule chose que le logiciel ne
   * peut pas deviner, et la seule chose qu'on veut vraiment décider. Le
   * champ reçoit le focus juste après, pour qu'il n'y ait plus qu'à
   * taper un nombre.
   */
  useEffect(() => {
    if (!reapprovisionner) return;
    setDesignation(reapprovisionner.designation);
    // Le produit lui-même, retrouvé à son nom : l'achat le rechargera.
    const vise =
      products.find(
        (p) =>
          cleDeListe(p.designation) === cleDeListe(reapprovisionner.designation) &&
          Math.abs(p.prixAchat - reapprovisionner.prixAchat) < 0.01,
      ) ??
      products.find((p) => cleDeListe(p.designation) === cleDeListe(reapprovisionner.designation));
    setModeProduit(vise ? "catalogue" : "nouveau");
    setConditionnementId("");
    setPrixAchatUnit(reapprovisionner.prixAchat);
    setFournisseur(reapprovisionner.fournisseur);
    // Le tableau de bord ne transmet qu'un nom : on retrouve sa fiche.
    setSupplierId(
      fournisseurs.find((f) => cleDeListe(f.nom) === cleDeListe(reapprovisionner.fournisseur))
        ?.id ?? null,
    );
    setDate(dateDuJour());
    setQuantite(0);
    setReglement("comptant");
    setMontantRegle(0);
    setEcheance("");
    setErreurAchat(null);
    setDetailsProduit(DETAILS_VIDES);
    setProduitRecharge(vise?.id ?? "");
    setIsModalOpen(true);
    onReapprovisionnementOuvert?.();
    // `products` change à chaque écriture : seule la demande rouvre le formulaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reapprovisionner, onReapprovisionnementOuvert, fournisseurs]);

  // Ce que la saisie du règlement a d'impossible, dit tout de suite plutôt
  // qu'au moment d'enregistrer : on ne verse pas une somme négative, et on
  // ne verse pas plus que ce que l'on doit.
  const totalSaisi = quantite * prixAchatUnit;
  let messageRegle: string | null = null;
  if (reglement === "credit") {
    if (montantRegle < 0) {
      messageRegle = "Le montant versé ne peut pas être négatif.";
    } else if (montantRegle > totalSaisi) {
      messageRegle = `Ne peut pas dépasser le total de l'achat (${formatCurrency(totalSaisi)}).`;
    }
  }

  /** Le produit rechargé, en mode catalogue. */
  const produitChoisi = useMemo(
    () =>
      modeProduit === "catalogue" ? (products.find((p) => p.id === produitRecharge) ?? null) : null,
    [modeProduit, products, produitRecharge],
  );
  const creeUnProduit = modeProduit === "nouveau";

  /**
   * Les conditionnements proposés : ceux du produit rechargé, ou ceux
   * que l'on déclare pour le nouveau — ceux-là seulement une fois
   * complets, pour ne pas proposer « de 0 ».
   */
  const conditionnementsProposes: Conditionnement[] = useMemo(
    () =>
      creeUnProduit
        ? detailsProduit.conditionnements.filter((c) => c.nom.trim() && c.quantite >= 2)
        : (produitChoisi?.conditionnements ?? []),
    [creeUnProduit, detailsProduit.conditionnements, produitChoisi],
  );
  const uniteAchat = creeUnProduit
    ? detailsProduit.unite.trim() || null
    : (produitChoisi?.unite ?? null);
  const conditionnement = conditionnementsProposes.find((c) => c.id === conditionnementId) ?? null;
  const facteur = conditionnement?.quantite ?? 1;
  /** Ce qui entre réellement en stock, en unités de base. */
  const quantiteBase = Math.max(0, Math.trunc(quantite)) * facteur;
  /** Le prix d'achat d'UNE unité de base, celui de la fiche produit. */
  const prixParUnite = facteur > 1 ? prixUnitaireDepuis(prixAchatUnit, facteur) : prixAchatUnit;

  // Un conditionnement retiré de la fiche ne reste pas choisi.
  useEffect(() => {
    if (conditionnementId && !conditionnement) setConditionnementId("");
  }, [conditionnementId, conditionnement]);

  /** Choisir le conditionnement propose son prix d'achat habituel. */
  const choisirConditionnement = (id: string) => {
    setConditionnementId(id);
    if (!produitChoisi) return;
    const c = produitChoisi.conditionnements.find((x) => x.id === id);
    setPrixAchatUnit(c ? prixAchatDe(c, produitChoisi) : produitChoisi.prixAchat);
  };

  /**
   * Un produit du même nom — ou du même code-barres — existe déjà.
   *
   * On le dit, et l'on propose de le recharger : c'est presque toujours
   * ce que l'on voulait. Créer une variante distincte reste possible,
   * mais se demande.
   */
  const homonymes = useMemo(() => {
    if (!creeUnProduit) return [];
    const cle = cleDeListe(designation);
    const code = detailsProduit.code_barres.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cle !== "" && (cleDeListe(p.designation) === cle || cleDeListe(p.displayName) === cle)) ||
        (code !== "" && (p.codeBarres ?? "").trim().toLowerCase() === code),
    );
  }, [creeUnProduit, designation, detailsProduit.code_barres, products]);

  const rechargerHomonyme = (p: Product) => {
    setModeProduit("catalogue");
    setProduitRecharge(p.id);
    setConditionnementId("");
    setPrixAchatUnit(p.prixAchat);
    if (p.fournisseur) setFournisseur(p.fournisseur);
    if (p.supplierId) setSupplierId(p.supplierId);
    setVarianteVoulue(false);
  };

  /** Pour que la décision se prenne en voyant le prix qui en découle. */
  const ecartDePrix = useMemo(() => {
    if (!produitChoisi) return null;
    const nouvelAchat = Math.round(Number(prixParUnite) * 100) / 100;
    if (!Number.isFinite(nouvelAchat) || nouvelAchat <= 0) return null;
    if (Math.abs(produitChoisi.prixAchat - nouvelAchat) < 0.01) return null;

    const enAuto = prixAuto.actif && produitChoisi.modePrix === "auto";
    const { taux } = tauxApplicable(
      produitChoisi.tauxMarge,
      categories.find((c) => c.id === produitChoisi.categoryId)?.taux_marge ?? null,
      prixAuto.taux,
    );
    return {
      id: produitChoisi.id,
      nom: produitChoisi.displayName,
      ancienAchat: produitChoisi.prixAchat,
      nouvelAchat,
      ancienVente: produitChoisi.prixVenteDefaut,
      nouveauVente: enAuto ? prixDepuisAchat(nouvelAchat, taux, prixAuto.arrondi) : null,
      taux,
    };
  }, [produitChoisi, prixParUnite, prixAuto, categories]);

  // Auto-fill form when selecting an existing product
  const handleSelectExistingProduct = (prodId: string) => {
    setConditionnementId("");
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setDesignation(prod.designation);
      setPrixAchatUnit(prod.prixAchat);
      if (prod.fournisseur) setFournisseur(prod.fournisseur);
      // Le rattachement va avec le nom.
      if (prod.supplierId) setSupplierId(prod.supplierId);
    }
  };

  const remettreAZero = () => {
    setReporterPrix(false);
    setDetailsProduit(DETAILS_VIDES);
    setPhotosProduit([]);
    setDesignation("");
    setProduitRecharge("");
    setConditionnementId("");
    setPrixVenteNouveau(0);
    setModePrixNouveau(prixAuto.actif ? "auto" : "manuel");
    setTauxNouveau(null);
    setSeuilNouveau(0);
    setVarianteVoulue(false);
    setFournisseur("");
    setSupplierId(null);
    setQuantite(0);
    setPrixAchatUnit(0);
    setReglement("comptant");
    setMontantRegle(0);
    setEcheance("");
  };

  /**
   * Le produit est né mais la suite a échoué : on bascule dessus, pour
   * qu'un nouvel essai le recharge au lieu d'en créer un second.
   */
  const basculerSurLeProduitCree = (id: string, message: string) => {
    setModeProduit("catalogue");
    setProduitRecharge(id);
    setVarianteVoulue(false);
    setSaving(false);
    setErreurAchat(message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || quantite <= 0 || prixAchatUnit <= 0) return;

    if (messageRegle) {
      setErreurAchat(messageRegle);
      return;
    }
    if (!creeUnProduit && !produitChoisi) {
      setErreurAchat("Choisissez le produit à recharger, ou passez sur « Nouveau produit ».");
      return;
    }
    if (creeUnProduit) {
      if (!designation.trim()) {
        setErreurAchat("Donnez un nom au nouveau produit.");
        return;
      }
      if (homonymes.length > 0 && !varianteVoulue) {
        setErreurAchat(
          `« ${homonymes[0].displayName} » existe déjà : rechargez-le, ou cochez « créer un produit distinct ».`,
        );
        return;
      }
      const erreurCond = erreurConditionnements(
        detailsProduit.conditionnements,
        detailsProduit.unite,
      );
      if (erreurCond) {
        setErreurAchat(erreurCond);
        return;
      }
      if (!(prixVenteNouveau > 0) && detailsProduit.type_produit !== "service") {
        setErreurAchat("Indiquez son prix de vente : il entre au catalogue avec.");
        return;
      }
      if (!onCreerProduit) {
        setErreurAchat("La création de produit n'est pas disponible ici.");
        return;
      }
    }
    // `null` veut dire « réglé en totalité » : la base s'en charge, et
    // c'est ce que faisaient tous les achats jusqu'ici.
    const regle = reglement === "comptant" ? null : Number(montantRegle);

    setSaving(true);
    setErreurAchat(null);

    // 1. Le nouveau produit d'abord, avec toute sa fiche : un achat au
    //    carton a besoin que le carton existe déjà sur le produit.
    let cible = produitChoisi;
    let idProduit = produitChoisi?.id ?? null;
    if (creeUnProduit) {
      const cree = await onCreerProduit!({
        designation: designation.trim(),
        prixAchat: prixParUnite,
        prixVenteDefaut: Number(prixVenteNouveau) || 0,
        fournisseur: fournisseur.trim(),
        stockInitial: 0,
        stockActuel: 0,
        seuilAlerte: Math.max(0, Math.trunc(Number(seuilNouveau) || 0)),
      });
      if (cree.error || !cree.id) {
        setSaving(false);
        setErreurAchat(cree.error ?? "Le produit n'a pas pu être créé. Rien n'a été enregistré.");
        return;
      }
      idProduit = cree.id;
      cible = null;

      if (onEditProductDetails) {
        const details = await onEditProductDetails(idProduit, {
          ...detailsVersBase(detailsProduit),
          supplier_id: supplierId ?? (detailsProduit.supplier_id.trim() || null),
          ...(prixAuto.actif ? { mode_prix: modePrixNouveau, taux_marge: tauxNouveau } : {}),
        });
        if (details.error) {
          basculerSurLeProduitCree(
            idProduit,
            `${details.error} Le produit a été créé, mais ni sa fiche ni l'achat : complétez-le depuis Produits, puis réessayez — il sera rechargé, pas recréé.`,
          );
          return;
        }
      }
    }

    // 2. L'achat, toujours sur un produit désigné.
    const result = await onAddPurchase({
      date,
      productId: idProduit,
      designation: (cible?.designation ?? designation).trim(),
      quantite: quantiteBase,
      prixAchatUnit: prixParUnite,
      conditionnement: conditionnement
        ? { id: conditionnement.id, nombre: Math.trunc(quantite), prix: Number(prixAchatUnit) }
        : null,
      fournisseur: fournisseur.trim(),
      supplier_id: supplierId,
      montantPaye: regle,
      dateEcheance: reglement === "credit" && echeance ? echeance : null,
    });

    if (result.error) {
      if (creeUnProduit && idProduit) {
        basculerSurLeProduitCree(
          idProduit,
          `${result.error} Le produit « ${designation.trim()} » est créé, mais l'achat n'est pas passé : réessayez, il sera rechargé, pas recréé.`,
        );
        return;
      }
      setSaving(false);
      setErreurAchat(result.error);
      return;
    }

    // Les photos en dernier : les plus lourdes et les plus faillibles.
    // Un réseau qui lâche ne doit pas emporter l'achat avec lui.
    if (creeUnProduit && photosProduit.length > 0 && idProduit && onAddProductImage) {
      const echec = await envoyerLesPhotosDuProduit(idProduit, photosProduit);
      if (echec) {
        setSaving(false);
        setErreurAchat(`${echec} L'achat, lui, a bien été enregistré.`);
        return;
      }
    }

    // En dernier : l'achat est déjà passé, un échec ici ne doit pas
    // donner à croire le contraire.
    if (reporterPrix && ecartDePrix && onReporterPrixAchat && produitChoisi) {
      const report = await onReporterPrixAchat(ecartDePrix.id, {
        designation: produitChoisi.designation,
        prixAchat: ecartDePrix.nouvelAchat,
        prixVenteDefaut: ecartDePrix.nouveauVente ?? ecartDePrix.ancienVente,
        fournisseur: produitChoisi.fournisseur,
        seuilAlerte: produitChoisi.seuilAlerte,
      });
      // Le carton avait son propre prix d'achat : il suit, lui aussi.
      if (!report.error && conditionnement?.prixAchat != null && onEditProductDetails) {
        await onEditProductDetails(produitChoisi.id, {
          conditionnements: produitChoisi.conditionnements.map((c) => ({
            id: c.id,
            nom: c.nom,
            quantite: c.quantite,
            prix_vente: c.prixVente,
            prix_achat: c.id === conditionnement.id ? Number(prixAchatUnit) : c.prixAchat,
            code_barres: c.codeBarres,
          })),
        });
      }
      if (report.error) {
        setSaving(false);
        setErreurAchat(`${report.error} L'achat, lui, a bien été enregistré.`);
        return;
      }
      setPrixReportes(
        ecartDePrix.nouveauVente !== null && ecartDePrix.nouveauVente !== ecartDePrix.ancienVente
          ? [
              {
                nom: ecartDePrix.nom,
                avant: ecartDePrix.ancienVente,
                apres: ecartDePrix.nouveauVente,
              },
            ]
          : [],
      );
    }

    setSaving(false);
    remettreAZero();
    setIsModalOpen(false);
  };

  // Suppliers list
  const suppliersList = useMemo(() => {
    const list = new Set<string>();
    purchases.forEach((p) => {
      if (p.fournisseur) list.add(p.fournisseur);
    });
    return Array.from(list);
  }, [purchases]);

  // Dynamic Filtering
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchSearch =
        p.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        // Recherche par fournisseur uniquement si le champ est autorisé :
        // sinon la barre de recherche permettrait de deviner les noms de
        // fournisseurs masqués en tâtonnant.
        (showFournisseur && p.fournisseur.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchSupplier =
        !showFournisseur || supplierFilter === "Tous" || p.fournisseur === supplierFilter;

      return matchSearch && matchSupplier;
    });
  }, [purchases, searchTerm, supplierFilter, showFournisseur]);

  // Key KPIs
  const totalAchatsMontant = purchases.reduce((acc, p) => acc + p.totalAchat, 0);
  const totalArticlesReappro = purchases.reduce((acc, p) => acc + p.quantite, 0);

  // Filtered Purchases for Report
  // Libellé de la période couverte, écrit une fois pour les deux
  // documents plutôt que répété dans chacun.
  const periodeLabel =
    reportPeriod === "today"
      ? `Journée du ${todayStr}`
      : reportPeriod === "month"
        ? `Mois de ${currentMonthStr}`
        : "Historique complet";

  const reportPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchSupplier =
        selectedReportSupplier === "all" ||
        p.fournisseur.toLowerCase() === selectedReportSupplier.toLowerCase();
      const matchPeriod =
        reportPeriod === "today"
          ? p.date === todayStr
          : reportPeriod === "month"
            ? p.date.startsWith(currentMonthStr)
            : true;
      return matchSupplier && matchPeriod;
    });
  }, [purchases, selectedReportSupplier, reportPeriod, todayStr, currentMonthStr]);

  const reportTotalAmount = useMemo(
    () => reportPurchases.reduce((acc, p) => acc + p.totalAchat, 0),
    [reportPurchases],
  );
  const reportTotalQty = useMemo(
    () => reportPurchases.reduce((acc, p) => acc + p.quantite, 0),
    [reportPurchases],
  );

  /**
   * Le document exporté est une capture de l'élément ci-dessous, pas une
   * seconde mise en page : ce que l'utilisateur voit est exactement ce
   * qu'il télécharge.
   */
  const documentRef = useRef<HTMLDivElement>(null);
  const [exportEnCours, setExportEnCours] = useState<null | "pdf" | "image">(null);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  const exporter = async (type: "pdf" | "image") => {
    const noeud = documentRef.current;
    if (!noeud || exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      const nom = nomDeFichier("Journal_achats", reportPeriod);
      if (type === "pdf") await exporterPdf(noeud, paper, nom);
      else await exporterImage(noeud, nom, "png");
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même, inutile d'afficher
      // une erreur technique que personne ne peut interpréter.
      if (reprendreApresDeploiement(err)) return;
      setExportErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  /** « 2 cartons · 24 pièces », ou « 24 pièces » : la quantité telle qu'achetée. */
  const quantiteAchetee = (p: Purchase) =>
    quantiteDeLigne(
      p.quantite,
      products.find((x) => x.id === p.productId)?.unite,
      p.conditionnement,
    );

  /** Une ligne de la liste ; sert aussi à ouvrir la fiche visée par une notification. */
  const versItemAchat = (p: Purchase): DataListItem => ({
    id: p.id,
    leading: (
      <VignetteProduit
        nom={p.designation}
        chemin={p.productId ? vignettes.get(p.productId) : null}
      />
    ),
    primary: (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{getPurchaseLabel(p, products)}</span>
        <VariantBadge prix={getPurchaseVariant(p, products)} autorise={showPrix} />
      </span>
    ),
    meta: [
      // En toutes lettres dans le rang secondaire, comme sur le
      // tableau de bord et dans les ventes.
      quantiteAchetee(p).principal,
      formatDateLocale(p.date, locale),
      showFournisseur ? p.fournisseur || null : null,
      showPrix
        ? p.conditionnement
          ? `${formatCurrency(p.totalAchat / p.conditionnement.nombre)} / ${p.conditionnement.nom}`
          : `${formatCurrency(p.prixAchatUnit)} / u`
        : null,
    ],
    amount: showPrix ? formatCurrency(p.totalAchat) : undefined,
    // Ce qui est réellement sorti de la caisse, et ce qui reste dû :
    // un achat à crédit n'a encore rien coûté à la trésorerie.
    amountHint: showPrix ? (
      p.soldeDu > 0 ? (
        <span className="t-warning">{formatCurrency(p.soldeDu)} à payer</span>
      ) : (
        <span className="t-danger">−{formatCurrency(p.montantPaye)} en caisse</span>
      )
    ) : undefined,
    sousTitre: [p.numero, quantiteAchetee(p).principal].join(" · "),
    cellules: {
      date: <DateJour iso={p.date} locale={locale} />,
      fournisseur: showFournisseur ? <Texte valeur={p.fournisseur || null} /> : null,
      quantite: (
        <Deux haut={quantiteAchetee(p).principal} bas={quantiteAchetee(p).detail ?? undefined} />
      ),
      pu: showPrix ? (
        p.conditionnement ? (
          <Deux
            haut={`${formatCurrency(p.totalAchat / p.conditionnement.nombre)} / ${p.conditionnement.nom}`}
            bas={`${formatCurrency(p.prixAchatUnit)} / u`}
          />
        ) : (
          <Deux haut={formatCurrency(p.prixAchatUnit)} />
        )
      ) : null,
      total: showPrix ? <Montant valeur={p.totalAchat} /> : null,
      // Ce qui est sorti de la caisse, ou ce qui reste dû au fournisseur.
      reglement: showPrix ? (
        p.soldeDu > 0 ? (
          <Deux haut={formatCurrency(p.soldeDu)} bas="à payer" tonHaut="alerte" />
        ) : (
          <Deux haut={`−${formatCurrency(p.montantPaye)}`} bas="réglé en caisse" tonHaut="danger" />
        )
      ) : null,
    },
    detailTitle: getPurchaseLabel(p, products),
    detailSubtitle: `Achat ${p.numero}`,
    details: [
      { label: "Date", value: formatDateLocale(p.date, locale) },
      { label: "Référence", value: p.numero },
      {
        label: "Quantité",
        value: quantiteAchetee(p).detail
          ? `${quantiteAchetee(p).principal} (${quantiteAchetee(p).detail})`
          : quantiteAchetee(p).principal,
      },
      ...(showPrix
        ? [
            { label: "Prix unitaire", value: formatCurrency(p.prixAchatUnit) },
            { label: "Total", value: formatCurrency(p.totalAchat) },
            {
              label: "Réglé au fournisseur",
              value: formatCurrency(p.montantPaye),
            },
            ...(p.soldeDu > 0
              ? [
                  {
                    label: "Reste à payer",
                    value: <span className="t-warning">{formatCurrency(p.soldeDu)}</span>,
                  },
                ]
              : []),
          ]
        : []),
      ...(showFournisseur
        ? [{ label: "Fournisseur", value: p.fournisseur || "-", hideIfEmpty: true }]
        : []),
    ],
    actions: (
      <>
        <button onClick={() => setSelectedPurchaseReceipt(p)} className="app-btn-secondary">
          <Eye className="w-4 h-4" />
          Voir le bon
        </button>
        {onUpdatePurchase && (
          <button
            onClick={() => ouvrirCorrection(p)}
            className="app-btn-icon h-9 w-9"
            title={`Corriger l'achat ${p.numero}`}
            aria-label={`Corriger l'achat ${p.numero}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onDeletePurchase && (
          <button
            onClick={() => {
              setErreurSuppression(null);
              setAchatASupprimer(p);
            }}
            className="app-btn-icon h-9 w-9"
            title={`Supprimer l'achat ${p.numero}`}
            aria-label={`Supprimer l'achat ${p.numero}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </>
    ),
  });

  const ficheAOuvrir = useOuvertureFiche("achats", (id) => {
    const trouve = purchases.find((x) => x.id === id);
    return trouve ? versItemAchat(trouve) : null;
  });

  return (
    <div className="space-y-6">
      {/* Un prix de vente qui bouge sans qu'on le sache est la façon la
          plus sûre de perdre confiance dans le calcul automatique. */}
      {prixReportes !== null && (
        <div className="app-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {prixReportes.length === 0
                  ? "Prix d'achat mis à jour"
                  : `${prixReportes.length} prix de vente recalculé${prixReportes.length > 1 ? "s" : ""}`}
              </p>
              {prixReportes.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Le prix de vente, lui, n&apos;a pas bougé.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {prixReportes.map((p) => (
                    <li key={p.nom} className="text-sm text-muted-foreground">
                      <span className="text-foreground">{p.nom}</span> : {formatCurrency(p.avant)} →{" "}
                      {formatCurrency(p.apres)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPrixReportes(null)}
              className="app-btn-icon h-8 w-8 shrink-0"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <PageHeader
        icon={<ShoppingCart className="w-5 h-5 t-danger" />}
        module="achats"
        title="Achats"
        subtitle="Enregistrez vos entrées en stock et ce qu'elles vous ont coûté."
        actions={
          <>
            {/* Les factures REÇUES ne sont pas des achats : elles ne
                touchent ni au stock ni à la caisse. Elles ont donc
                leur écran, atteint d'ici parce que c'est ici qu'on
                pense au fournisseur. */}
            {onOuvrirFacturesRecues && (
              <button
                onClick={onOuvrirFacturesRecues}
                className="app-btn-secondary w-full sm:w-auto"
              >
                <FileText className="w-4 h-4" />
                Factures reçues
              </button>
            )}
            {importer}
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="app-btn-secondary w-full sm:w-auto"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button
              onClick={() => {
                // Sans produit choisi ni nom tapé, on part du bon côté :
                // le catalogue s'il existe, sinon la création.
                if (!produitRecharge && !designation.trim()) {
                  setModeProduit(products.length > 0 ? "catalogue" : "nouveau");
                }
                setIsModalOpen(true);
              }}
              className="app-btn-primary w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Nouvel achat
            </button>
          </>
        }
      />

      {/* Indicateurs */}
      <div className="app-statbar grid-cols-1 sm:grid-cols-3">
        {showPrix && (
          <StatCol
            label="Total des achats"
            value={formatCurrency(totalAchatsMontant)}
            hint="tous les achats enregistrés"
            icon={<DollarSign className="w-5 h-5" />}
            tone="danger"
          />
        )}

        <StatCol
          label="Articles reçus"
          value={`${totalArticlesReappro}`}
          hint="unités entrées en stock"
          icon={<PackageCheck className="w-5 h-5" />}
          tone="success"
        />

        {showFournisseur && (
          <StatCol
            label="Fournisseurs"
            value={`${suppliersList.length}`}
            hint={`partenaire${suppliersList.length > 1 ? "s" : ""} actif${suppliersList.length > 1 ? "s" : ""}`}
            icon={<Truck className="w-5 h-5" />}
            tone="info"
          />
        )}
      </div>

      {/* Recherche et filtres */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          showFournisseur
            ? "Rechercher un produit, une référence, un fournisseur…"
            : "Rechercher un produit, une référence…"
        }
        activeFilterCount={supplierFilter !== "Tous" ? 1 : 0}
        onReset={() => {
          setSearchTerm("");
          setSupplierFilter("Tous");
        }}
      >
        {showFournisseur && (
          <FilterField label="Fournisseur">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="app-field-sm lg:w-auto"
            >
              <option value="Tous">Tous les fournisseurs</option>
              {suppliersList.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </FilterField>
        )}
      </FilterBar>

      {/* Liste unique — desktop ET mobile.
          Un achat se lit par « quel produit, chez qui, pour combien » :
          le fournisseur monte donc dans la ligne grise, et l'effet sur
          la trésorerie devient le complément du montant plutôt qu'une
          colonne à part. */}
      <div className="app-card overflow-hidden">
        <DataList
          emptyLabel="Aucun achat ne correspond à ces filtres."
          ouvrir={ficheAOuvrir}
          titrePrincipal="Produit"
          colonnes={[
            { cle: "date", titre: "Date", largeur: "8.5rem" },
            ...(showFournisseur ? [{ cle: "fournisseur", titre: "Fournisseur" }] : []),
            { cle: "quantite", titre: "Quantité", align: "droite" as const, large: true },
            ...(showPrix
              ? [
                  { cle: "pu", titre: "Prix unitaire", align: "droite" as const },
                  { cle: "total", titre: "Total", align: "droite" as const },
                  { cle: "reglement", titre: "Règlement", align: "droite" as const },
                ]
              : []),
          ]}
          items={filteredPurchases.map(versItemAchat)}
        />
      </div>

      {/* ── Corriger un achat ──
          Un achat touche trois choses à la fois : le stock du produit,
          le total qui pèse sur la caisse, et le règlement déjà versé au
          fournisseur. L'écran montre les trois écarts AVANT
          d'enregistrer, plutôt que de laisser découvrir après coup ce
          qui a bougé.

          Le champ « montant réglé » n'est pas un luxe : les achats de
          cette application sont réglés comptant, au centime près. Sans
          lui, baisser un prix — le cas le plus courant d'une faute de
          frappe — laisserait un règlement supérieur au total, et la base
          refuserait la correction. */}
      {achatAModifier && onUpdatePurchase && (
        <Modal
          open
          onClose={() => setAchatAModifier(null)}
          size="md"
          icon={<Pencil className="h-4 w-4" />}
          title="Corriger l'achat"
          description={`N° ${achatAModifier.numero}`}
          dismissible={!modEnCours}
          footer={
            <>
              <button
                onClick={() => setAchatAModifier(null)}
                disabled={modEnCours}
                className="app-btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setModEnCours(true);
                  setModErreur(null);
                  const { error } = await onUpdatePurchase(achatAModifier.id, {
                    date: modDate,
                    quantite: Math.trunc(Number(modQuantite) || 0),
                    prixAchatUnit: Number(modPrix) || 0,
                    fournisseur: modFournisseur.trim(),
                    supplier_id: modSupplierId,
                    montantRegle: Number(modRegle) || 0,
                  });
                  setModEnCours(false);
                  if (error) setModErreur(error);
                  else setAchatAModifier(null);
                }}
                disabled={
                  modEnCours ||
                  Math.trunc(Number(modQuantite) || 0) <= 0 ||
                  effetCorrection.regleTropHaut
                }
                className="app-btn-primary"
              >
                {modEnCours ? "Enregistrement…" : "Enregistrer la correction"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* La désignation se lit, ne se change pas : le produit
                concerné est décidé à l'enregistrement et ne se déplace
                pas après coup. */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Produit</label>
              <input
                value={getPurchaseLabel(achatAModifier, products)}
                readOnly
                disabled
                className="app-field opacity-70"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pour changer de produit, supprimez cet achat et enregistrez-en un nouveau : le stock
                de deux articles différents serait concerné.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="mod-date"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Date
                </label>
                <input
                  id="mod-date"
                  type="date"
                  value={modDate}
                  onChange={(e) => setModDate(e.target.value)}
                  className="app-field"
                />
              </div>
              <div>
                <label
                  htmlFor="mod-qte"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Quantité
                </label>
                <input
                  id="mod-qte"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={modQuantite}
                  onChange={(e) => setModQuantite(e.target.value)}
                  className="app-field"
                />
                {achatAModifier.conditionnement && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Acheté en {achatAModifier.conditionnement.nombre}{" "}
                    {auPluriel(
                      achatAModifier.conditionnement.nom,
                      achatAModifier.conditionnement.nombre,
                    )}{" "}
                    de {achatAModifier.conditionnement.facteur} : la quantité et le prix se
                    corrigent à l&apos;unité.
                  </p>
                )}
              </div>
            </div>

            {showPrix && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="mod-prix"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Prix unitaire
                  </label>
                  <input
                    id="mod-prix"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={modPrix}
                    onChange={(e) => setModPrix(e.target.value)}
                    className="app-field"
                  />
                </div>
                <div>
                  <label
                    htmlFor="mod-regle"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Montant réglé
                  </label>
                  <input
                    id="mod-regle"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={modRegle}
                    onChange={(e) => setModRegle(e.target.value)}
                    className="app-field"
                  />
                  {effetCorrection.regleTropHaut && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs t-warning">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {formatCurrency(effetCorrection.excedent)} de trop : on ne règle pas plus
                        que le montant de l&apos;achat.
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {showFournisseur && (
              <SelecteurFournisseur
                id="mod-fournisseur"
                fournisseurs={fournisseurs}
                valeur={modSupplierId}
                onChange={(id, nom) => {
                  setModSupplierId(id);
                  setModFournisseur(nom);
                }}
                onCreer={onAddFournisseur}
                onCompleter={onUpdateFournisseur}
              />
            )}

            {/* Ce que la correction va déplacer, avant de l'enregistrer. */}
            {(effetCorrection.stock !== 0 || effetCorrection.tresorerie !== 0) && (
              <div className="rounded-xl border border-border p-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ce que la correction déplace
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {effetCorrection.stock !== 0 && (
                    <li>
                      Le stock de « {getPurchaseLabel(achatAModifier, products)} »{" "}
                      {effetCorrection.stock > 0 ? "montera" : "descendra"} de{" "}
                      <strong>{Math.abs(effetCorrection.stock)}</strong> unité
                      {Math.abs(effetCorrection.stock) > 1 ? "s" : ""}.
                    </li>
                  )}
                  {showPrix && effetCorrection.tresorerie !== 0 && (
                    <li>
                      La trésorerie {effetCorrection.tresorerie > 0 ? "remontera" : "baissera"} de{" "}
                      <strong>{formatCurrency(Math.abs(effetCorrection.tresorerie))}</strong>.
                    </li>
                  )}
                  {showPrix && (
                    <li>
                      Nouveau total :{" "}
                      <strong>{formatCurrency(effetCorrection.nouveauTotal)}</strong>
                      {effetCorrection.resteDu > 0 && (
                        <> — reste dû {formatCurrency(effetCorrection.resteDu)}</>
                      )}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {modErreur && (
              <p className="flex items-start gap-1.5 text-sm t-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{modErreur}</span>
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* ── Supprimer un achat ──
          Un achat saisi par erreur n'est pas qu'une ligne dans une
          liste : il a fait monter un stock et descendre une caisse.
          Supprimer doit donc défaire les deux, et la confirmation le
          dit AVANT le clic — chiffres à l'appui — plutôt que de laisser
          découvrir après coup que la trésorerie a bougé.

          La base refuse la suppression si les unités ont déjà été
          vendues ou sont réservées par une commande. Son message dit
          lequel des deux, et il s'affiche ici tel quel : personne ne
          sait mieux qu'elle pourquoi c'est impossible. */}
      {achatASupprimer && onDeletePurchase && (
        <Modal
          open
          onClose={() => setAchatASupprimer(null)}
          size="sm"
          tone="danger"
          icon={<Trash2 className="h-4 w-4" />}
          title="Supprimer cet achat ?"
          description={`N° ${achatASupprimer.numero}`}
          dismissible={!suppressionEnCours}
          footer={
            <>
              <button
                onClick={() => setAchatASupprimer(null)}
                disabled={suppressionEnCours}
                className="app-btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setSuppressionEnCours(true);
                  setErreurSuppression(null);
                  const { error } = await onDeletePurchase(achatASupprimer.id);
                  setSuppressionEnCours(false);
                  if (error) setErreurSuppression(error);
                  else setAchatASupprimer(null);
                }}
                disabled={suppressionEnCours}
                className="app-btn-danger"
              >
                {suppressionEnCours ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              <strong>{getPurchaseLabel(achatASupprimer, products)}</strong> —{" "}
              {quantiteEnMots(
                achatASupprimer.quantite,
                products.find((x) => x.id === achatASupprimer.productId)?.unite,
              )}
              {showPrix && <> — {formatCurrency(achatASupprimer.totalAchat)}</>}
            </p>

            <div className="rounded-xl border border-border p-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ce que la suppression annule
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  Le stock de « {getPurchaseLabel(achatASupprimer, products)} » redescendra de{" "}
                  <strong>{achatASupprimer.quantite}</strong> unité
                  {achatASupprimer.quantite > 1 ? "s" : ""}.
                </li>
                {showPrix && (
                  <li>
                    La trésorerie remontera de{" "}
                    <strong>{formatCurrency(achatASupprimer.totalAchat)}</strong>.
                  </li>
                )}
                {showPrix && achatASupprimer.montantPaye > 0 && (
                  <li>
                    Le règlement de <strong>{formatCurrency(achatASupprimer.montantPaye)}</strong>{" "}
                    enregistré avec cet achat sera supprimé lui aussi.
                  </li>
                )}
              </ul>
            </div>

            {erreurSuppression && (
              <p className="flex items-start gap-1.5 text-sm t-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{erreurSuppression}</span>
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Cette suppression est définitive. Si les unités ont déjà été vendues, la base la
              refusera : le stock ne peut pas descendre en dessous de zéro.
            </p>
          </div>
        </Modal>
      )}

      {/* ── Bon d'approvisionnement ──
          Le bloc porte `printable-receipt` : sans cette accroche, la
          feuille d'impression masque tout et le bouton « Imprimer »
          sortait une page blanche. */}
      {selectedPurchaseReceipt && (
        <Modal
          open
          onClose={() => setSelectedPurchaseReceipt(null)}
          size="md"
          icon={<FileText className="h-4 w-4" />}
          title="Bon d'approvisionnement"
          description={`N° ${selectedPurchaseReceipt.numero}`}
          footer={
            <>
              <button
                onClick={() => setSelectedPurchaseReceipt(null)}
                className="app-btn-secondary"
              >
                Fermer
              </button>
              <button onClick={() => window.print()} className="app-btn-primary">
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </>
          }
        >
          <div className="printable-receipt printable-invoice rounded-xl border border-slate-200 p-4">
            <div className="mb-3 border-b border-slate-200 pb-3 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                {settings?.storeName || marque.nom}
              </p>
              <p className="text-xs text-slate-500">
                Bon d'approvisionnement n° {selectedPurchaseReceipt.numero}
              </p>
            </div>

            <dl className="divide-y divide-border">
              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Date</dt>
                <dd className="text-right font-medium text-slate-900">
                  {formatDateLocale(selectedPurchaseReceipt.date, locale)}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Code produit</dt>
                <dd className="text-right font-mono font-medium text-slate-900">
                  {products.find((prod) => prod.id === selectedPurchaseReceipt.productId)?.numero ||
                    selectedPurchaseReceipt.productId}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Produit</dt>
                <dd className="min-w-0 text-right font-medium text-slate-900">
                  {getPurchaseLabel(selectedPurchaseReceipt, products)}
                </dd>
              </div>

              {showFournisseur && (
                <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-slate-500">Fournisseur</dt>
                  <dd className="min-w-0 text-right font-medium text-slate-900">
                    {selectedPurchaseReceipt.fournisseur || "Grossiste général"}
                  </dd>
                </div>
              )}

              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Quantité</dt>
                <dd className="text-right font-mono font-medium text-slate-900">
                  {selectedPurchaseReceipt.quantite} unité
                  {selectedPurchaseReceipt.quantite > 1 ? "s" : ""}
                </dd>
              </div>

              {showPrix && (
                <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-slate-500">Prix unitaire</dt>
                  <dd className="text-right font-mono font-medium text-slate-900">
                    {formatCurrency(selectedPurchaseReceipt.prixAchatUnit)}
                  </dd>
                </div>
              )}

              {showPrix && (
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-sm font-medium text-slate-900">
                    Total décaissement
                  </dt>
                  <dd className="text-right font-mono text-base font-semibold text-foreground">
                    {formatCurrency(selectedPurchaseReceipt.totalAchat)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </Modal>
      )}

      {/* ── Nouvel achat ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="md"
        icon={<ShoppingCart className="h-4 w-4" />}
        title="Nouvel achat"
        description="Un approvisionnement de stock, avec sa sortie de trésorerie."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" form="purchase-add-form" className="app-btn-primary">
              <Save className="h-4 w-4" />
              Enregistrer l'achat
            </button>
          </>
        }
      >
        <form id="purchase-add-form" onSubmit={handleSubmit} className="space-y-4">
          {/* ── Quel produit ── */}
          <div
            role="radiogroup"
            aria-label="Produit acheté"
            className="flex w-full items-center gap-1 rounded-xl border border-border bg-muted p-1"
          >
            {(
              [
                ["catalogue", "Produit du catalogue"],
                ["nouveau", "Nouveau produit"],
              ] as const
            ).map(([valeur, libelle]) => (
              <button
                key={valeur}
                type="button"
                role="radio"
                aria-checked={modeProduit === valeur}
                onClick={() => {
                  setModeProduit(valeur);
                  setConditionnementId("");
                  setErreurAchat(null);
                }}
                className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  modeProduit === valeur
                    ? "bg-card font-semibold text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {libelle}
              </button>
            ))}
          </div>

          {modeProduit === "catalogue" ? (
            <div>
              <SelecteurProduit
                id="achat-recharge"
                label="Produit à recharger"
                produits={produitsAChoisir}
                valeur={produitRecharge}
                libelleVide="Choisir un produit…"
                onChange={(id) => {
                  setProduitRecharge(id);
                  handleSelectExistingProduct(id);
                }}
              />
              {produitChoisi ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  En stock :{" "}
                  <strong className="font-semibold text-foreground">
                    {quantiteEnMots(produitChoisi.stockActuel, produitChoisi.unite)}
                  </strong>
                  {(() => {
                    const enCartons = stockEnConditionnements(
                      produitChoisi.stockActuel,
                      produitChoisi.unite,
                      produitChoisi.conditionnements,
                    );
                    return enCartons ? ` (${enCartons})` : "";
                  })()}
                  {showPrix && <> · achat {formatCurrency(produitChoisi.prixAchat)}</>} · vente{" "}
                  {formatCurrency(produitChoisi.prixVenteDefaut)}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Introuvable ? Passez sur « Nouveau produit » pour le créer avec sa fiche.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="achat-designation"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Désignation
                </label>
                <input
                  id="achat-designation"
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => {
                    setDesignation(e.target.value);
                    setVarianteVoulue(false);
                  }}
                  placeholder="ex : eau minérale 1,5 L"
                  className="app-field"
                />
              </div>

              {homonymes.length > 0 && (
                <div
                  role="status"
                  className="rounded-xl border border-warning-border bg-warning-soft p-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {homonymes.length > 1
                      ? `${homonymes.length} produits portent déjà ce nom ou ce code-barres`
                      : "Ce produit existe déjà au catalogue"}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {homonymes.slice(0, 4).map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 text-xs text-foreground">
                          <strong className="font-semibold">{h.displayName}</strong>{" "}
                          <span className="text-muted-foreground">
                            · {h.numero} · {quantiteEnMots(h.stockActuel, h.unite)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => rechargerHomonyme(h)}
                          className="app-btn-secondary px-3 py-1.5 text-xs"
                        >
                          Recharger celui-ci
                        </button>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={varianteVoulue}
                      onChange={(e) => setVarianteVoulue(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-foreground">
                      Créer quand même un produit distinct (une variante, avec son propre stock et
                      son propre prix)
                    </span>
                  </label>
                </div>
              )}

              {/* L'unité et les conditionnements AVANT la quantité : on
                  achète « 2 cartons » d'un produit dont on vient de dire
                  qu'un carton en contient 12. */}
              <div className="space-y-4 rounded-xl border border-border p-3">
                <SelecteurUnite
                  id="achat-unite"
                  valeur={detailsProduit.unite}
                  onChange={(unite) => setDetailsProduit((d) => ({ ...d, unite }))}
                />
                <EditeurConditionnements
                  valeur={detailsProduit.conditionnements}
                  onChange={(conditionnements) =>
                    setDetailsProduit((d) => ({ ...d, conditionnements }))
                  }
                  unite={detailsProduit.unite}
                  prixVenteUnite={Number(prixVenteNouveau) || 0}
                  prixAchatUnite={Number(prixParUnite) || 0}
                  montrerPrixAchat={showPrix}
                />
              </div>
            </div>
          )}

          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <label
                htmlFor="achat-date"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Date d'achat
              </label>
              <input
                id="achat-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="app-field font-mono"
              />
            </div>

            {/* ── Acheté à l'unité, ou au carton ── */}
            {conditionnementsProposes.length > 0 && (
              <div>
                <p id="achat-par" className="mb-1.5 block text-sm font-medium text-foreground">
                  Acheté par
                </p>
                <div role="radiogroup" aria-labelledby="achat-par" className="flex flex-wrap gap-2">
                  {[
                    { id: "", libelle: libelleUnite(uniteAchat, 1), note: null as string | null },
                    ...conditionnementsProposes.map((c) => ({
                      id: c.id,
                      libelle: c.nom,
                      note: `${c.quantite} ${libelleUnite(uniteAchat, c.quantite)}`,
                    })),
                  ].map((o) => (
                    <button
                      key={o.id || "unite"}
                      type="button"
                      role="radio"
                      aria-checked={conditionnementId === o.id}
                      onClick={() => choisirConditionnement(o.id)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        conditionnementId === o.id
                          ? "border-success-border bg-success-soft t-success"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {o.libelle.charAt(0).toUpperCase() + o.libelle.slice(1)}
                      {o.note && (
                        <>
                          {" "}
                          <span className="font-normal opacity-80">· {o.note}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="achat-quantite"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {conditionnement
                    ? `Nombre de ${auPluriel(conditionnement.nom, 2)}`
                    : uniteAchat
                      ? `Quantité (${libelleUnite(uniteAchat, 2)})`
                      : "Quantité"}
                </label>
                <input
                  id="achat-quantite"
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="0"
                  value={quantite || ""}
                  onChange={(e) => setQuantite(Number(e.target.value))}
                  className="app-field font-mono"
                />
                {conditionnement && quantite > 0 && (
                  <span className="mt-1 block text-xs font-medium t-success">
                    = {quantiteEnMots(quantiteBase, uniteAchat)} en stock
                  </span>
                )}
              </div>
              <div>
                <label
                  htmlFor="achat-prix"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {conditionnement
                    ? `Prix d'achat par ${conditionnement.nom} (${symboleDeSaisie()})`
                    : `Prix d'achat unitaire (${symboleDeSaisie()})`}
                </label>
                <input
                  id="achat-prix"
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="0"
                  value={prixAchatUnit || ""}
                  onChange={(e) => setPrixAchatUnit(Number(e.target.value))}
                  className="app-field font-mono"
                />
                <Equivalents montant={prixAchatUnit} className="mt-1" saisie />
                {conditionnement && prixAchatUnit > 0 && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Soit {formatCurrency(prixParUnite)} par {libelleUnite(uniteAchat, 1)}
                  </span>
                )}
                {quantite > 1 && totalSaisi > 0 && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Total {formatCurrency(totalSaisi)}
                    <Equivalents montant={totalSaisi} />
                  </span>
                )}
              </div>
            </div>

            {/* Le prix de vente et le seuil du produit qui va naître :
                avant, ils étaient inventés (achat × 1,3 et 5 unités). */}
            {creeUnProduit && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ChampPrixDeVente
                  id="achat-prix-vente"
                  prixAchat={Number(prixParUnite) || 0}
                  prixVente={Number(prixVenteNouveau) || 0}
                  onPrixVente={setPrixVenteNouveau}
                  mode={modePrixNouveau}
                  onMode={setModePrixNouveau}
                  tauxProduit={tauxNouveau}
                  onTauxProduit={setTauxNouveau}
                  tauxCategorie={
                    categories.find((c) => c.id === detailsProduit.category_id)?.taux_marge ?? null
                  }
                  reglages={prixAuto}
                />
                <div>
                  <label
                    htmlFor="achat-seuil"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Seuil d&apos;alerte{uniteAchat ? ` (${libelleUnite(uniteAchat, 2)})` : ""}
                  </label>
                  <input
                    id="achat-seuil"
                    type="number"
                    min="0"
                    step="1"
                    value={seuilNouveau || ""}
                    placeholder="0"
                    onChange={(e) => setSeuilNouveau(Number(e.target.value))}
                    className="app-field font-mono"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    En dessous, le produit passe en alerte de stock.
                  </p>
                </div>
              </div>
            )}

            {ecartDePrix && (
              <div className="rounded-xl border border-border p-3 sm:col-span-2">
                <p className="text-sm font-medium text-foreground">
                  Ce prix d&apos;achat diffère de celui enregistré sur la fiche
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  La fiche de « {ecartDePrix.nom} » porte {formatCurrency(ecartDePrix.ancienAchat)}{" "}
                  {conditionnement ? `par ${libelleUnite(uniteAchat, 1)} ` : ""}; cet achat revient
                  à {formatCurrency(ecartDePrix.nouvelAchat)}. Sans rien faire, le stock est
                  rechargé et la fiche garde son prix.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={reporterPrix}
                    onChange={(e) => setReporterPrix(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="min-w-0 text-sm text-foreground">
                    Mettre la fiche à jour avec ce prix d&apos;achat
                    {ecartDePrix.nouveauVente !== null && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Son prix de vente passerait de {formatCurrency(ecartDePrix.ancienVente)} à{" "}
                        {formatCurrency(ecartDePrix.nouveauVente)} —{" "}
                        {formaterTaux(ecartDePrix.taux)} sur le prix d&apos;achat.
                      </span>
                    )}
                    {ecartDePrix.nouveauVente === null && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Son prix de vente ne bougera pas : il est fixé à la main.
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}

            <SelecteurFournisseur
              fournisseurs={fournisseurs}
              valeur={supplierId}
              onChange={(id, nom) => {
                setSupplierId(id);
                setFournisseur(nom);
              }}
              onCreer={onAddFournisseur}
              onCompleter={onUpdateFournisseur}
            />
          </div>

          {/* Le règlement, en bas du formulaire : on choisit d'abord
              ce qu'on achète, et seulement ensuite comment on le paie. */}
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground" id="ach-reglement">
              Règlement
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ach-reglement">
              {(
                [
                  ["comptant", "Payé comptant"],
                  ["credit", "À crédit"],
                ] as const
              ).map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setReglement(valeur)}
                  aria-pressed={reglement === valeur}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    reglement === valeur
                      ? "border-success-border bg-success-soft t-success"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>

            {reglement === "credit" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ach-regle"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Versé maintenant
                  </label>
                  {/* Pas d'attributs `min`/`max` : ils feraient parler le
                      navigateur à notre place, dans sa langue, et dans une
                      bulle qui empêche le formulaire de partir — donc qui
                      empêche notre propre message de s'afficher. */}
                  <input
                    id="ach-regle"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className="app-field font-mono"
                    value={montantRegle}
                    onChange={(e) => setMontantRegle(Number(e.target.value))}
                    aria-invalid={messageRegle !== null}
                    aria-describedby="ach-regle-aide"
                  />
                  <p
                    id="ach-regle-aide"
                    className={`mt-1 text-[11px] ${
                      messageRegle ? "t-danger" : "text-muted-foreground"
                    }`}
                  >
                    {messageRegle ?? "Laissez zéro si rien n'est versé aujourd'hui."}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="ach-echeance"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Échéance
                  </label>
                  <input
                    id="ach-echeance"
                    type="date"
                    className="app-field"
                    value={echeance}
                    onChange={(e) => setEcheance(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {erreurAchat && (
            <p
              role="alert"
              className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
            >
              {erreurAchat}
            </p>
          )}

          <div className="app-statbar grid-cols-2">
            <StatCol label="Total de l'achat" value={formatCurrency(quantite * prixAchatUnit)} />
            <StatCol
              label={reglement === "comptant" ? "Sort de la caisse" : "Restera dû"}
              value={formatCurrency(
                reglement === "comptant"
                  ? quantite * prixAchatUnit
                  : Math.max(0, quantite * prixAchatUnit - montantRegle),
              )}
            />
          </div>

          {/* ── La suite de la fiche du produit qui va naître ──
              Elle n'apparaît QUE dans ce cas : recharger un produit qui
              existe ne doit pas proposer une fiche vide, qui écraserait
              sa catégorie et son code-barres par du blanc. */}
          {creeUnProduit && (
            <div className="border-t border-border pt-4">
              <p className="mb-1 text-sm font-medium text-foreground">Fiche du nouveau produit</p>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                Référence, code-barres, catégorie, TVA, photos : la même fiche que dans l&apos;écran
                Produits. Tout est facultatif et modifiable ensuite.
              </p>
              <DetailsProduit
                valeurs={detailsProduit}
                onChange={setDetailsProduit}
                categories={categories}
                onCreerCategorie={onCreerCategorie}
                images={[]}
                storeId={storeId}
                productId={null}
                sansUniteNiConditionnements
                montrerPrixAchat={showPrix}
                prix={{ vente: Number(prixVenteNouveau) || 0, achat: Number(prixParUnite) || 0 }}
                photosEnAttente={onAddProductImage ? photosProduit : undefined}
                onPhotosEnAttenteChange={onAddProductImage ? setPhotosProduit : undefined}
                onAddImage={async () => ({ error: "Envoi indisponible." })}
                onDeleteImage={async () => ({ error: "Suppression indisponible." })}
              />
            </div>
          )}
        </form>
      </Modal>

      {/* ── Journal & bilan des achats ──
          Le document imprimable est conservé tel quel. */}
      {isReportModalOpen && (
        <Modal
          open
          onClose={() => setIsReportModalOpen(false)}
          size="3xl"
          icon={<Printer className="h-4 w-4" />}
          title="Journal des achats"
          description={
            showFournisseur && selectedReportSupplier !== "all"
              ? selectedReportSupplier
              : "Approvisionnements de stock"
          }
          bodyClassName="space-y-4"
          headerAside={
            <label className="flex items-center gap-2">
              <span className="sr-only">Format du papier</span>
              <select
                value={paperId}
                onChange={(e) => setPaperId(e.target.value as PaperFormatId)}
                className="app-field-sm w-auto min-w-[9.5rem]"
                title="Format de papier — détermine aussi le format du PDF enregistré"
              >
                {PAPER_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          }
          footer={
            <>
              <button onClick={() => imprimerDocument(paper)} className="app-btn-secondary">
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
              <button
                onClick={() => exporter("image")}
                disabled={exportEnCours !== null}
                className="app-btn-secondary"
                title="Télécharger une image, pratique à envoyer par messagerie"
              >
                <ImageIcon className="h-4 w-4" />
                {exportEnCours === "image" ? "Création..." : "Image"}
              </button>
              <button
                onClick={() => exporter("pdf")}
                disabled={exportEnCours !== null}
                className="app-btn-primary"
                title={`Télécharger le PDF au format ${paper.label}`}
              >
                <Download className="h-4 w-4" />
                {exportEnCours === "pdf" ? "Création..." : "PDF"}
              </button>
            </>
          }
        >
          {/* Portée du document — masquée à l'impression. */}
          <div
            className={`no-print grid grid-cols-1 gap-3 ${showFournisseur ? "sm:grid-cols-2" : ""}`}
          >
            {showFournisseur && (
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Fournisseur
                </label>
                <select
                  value={selectedReportSupplier}
                  onChange={(e) => setSelectedReportSupplier(e.target.value)}
                  className="app-field-sm"
                >
                  <option value="all">Tous les fournisseurs</option>
                  {suppliersList.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Période
              </label>
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as any)}
                className="app-field-sm"
              >
                <option value="today">Aujourd'hui ({todayStr})</option>
                <option value="month">Ce mois-ci ({currentMonthStr})</option>
                <option value="all">Tout l'historique</option>
              </select>
            </div>
          </div>

          {/* ── Documents imprimables ──
                Même grammaire que la facture de vente : identité à
                gauche, référence du document à droite, encart de portée
                sur fond très léger, tableau à filets fins. */}
          {exportErreur && (
            <p className="no-print rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5 text-sm t-danger">
              {exportErreur}
            </p>
          )}

          <div className="receipt-viewport flex items-start justify-start overflow-x-auto rounded-xl border border-border bg-background p-4">
            {isTicket ? (
              /* ── Ticket ── */
              <div
                ref={documentRef}
                className={`printable-receipt mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white p-4 font-mono leading-relaxed text-slate-900 shadow-sm ${paperId === "t58" ? "text-[10px]" : "text-[11px]"}`}
                style={{ maxWidth: paper.previewWidth }}
              >
                <div className="space-y-0.5 text-center">
                  {settings?.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt=""
                      className="mx-auto mb-2 h-12 w-12 rounded object-contain"
                    />
                  )}
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-900">
                    {settings?.storeName || marque.nom}
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    Tél. {settings?.phone || "+261 34 12 345 67"}
                  </p>
                </div>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <p className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-900">
                  Journal des achats
                </p>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <dl className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Période</dt>
                    <dd className="min-w-0 text-right text-slate-900">{periodeLabel}</dd>
                  </div>
                  {showFournisseur && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Fournisseur</dt>
                      <dd className="min-w-0 text-right text-slate-900">
                        {selectedReportSupplier === "all" ? "Tous" : selectedReportSupplier}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Édité le</dt>
                    <dd className="text-slate-900">{new Date().toLocaleDateString("fr-FR")}</dd>
                  </div>
                </dl>

                <div className="my-3 border-t border-dashed border-slate-300" />

                {reportPurchases.length === 0 ? (
                  <p className="py-2 text-center text-[10px] italic text-slate-500">
                    Aucun achat pour cette sélection.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reportPurchases.map((p) => (
                      <div key={p.id}>
                        <p className="font-semibold text-slate-900">
                          {getPurchaseLabel(p, products)}
                        </p>
                        <div className="flex justify-between gap-3 text-[10px] text-slate-600">
                          <span>
                            {quantiteEnMots(
                              p.quantite,
                              products.find((prod) => prod.id === p.productId)?.unite,
                            )}
                            {showPrix ? ` × ${formatCurrency(p.prixAchatUnit)}` : ""}
                          </span>
                          {showPrix && (
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(p.totalAchat)}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400">
                          {[
                            formatDateLocale(p.date, locale),
                            products.find((prod) => prod.id === p.productId)?.numero,
                            showFournisseur ? p.fournisseur || "Grossiste" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="my-3 border-t border-dashed border-slate-300" />

                <div className="space-y-1 text-[10px]">
                  {showPrix && (
                    <div className="flex justify-between gap-3 border-b border-slate-900 pb-1 text-[13px] font-bold text-slate-900">
                      <span>TOTAL</span>
                      <span>{formatCurrency(reportTotalAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 pt-1 text-slate-600">
                    <span>Réapprovisionnement</span>
                    <span className="text-slate-900">{reportTotalQty} unités</span>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Journal A4 ── */
              <div
                ref={documentRef}
                className={`printable-receipt mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white font-sans text-xs text-slate-900 shadow-sm ${paperId === "a5" ? "p-6" : "p-8"}`}
                style={{ maxWidth: paper.previewWidth }}
              >
                <header className="flex flex-wrap items-start justify-between gap-6 pb-6">
                  <div className="min-w-0 space-y-2">
                    {settings?.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt=""
                        className="h-14 w-14 rounded object-contain"
                      />
                    )}
                    <div className="space-y-0.5">
                      <p className="text-base font-bold uppercase tracking-tight text-slate-900">
                        {settings?.storeName || marque.nom}
                      </p>
                      {settings?.address && (
                        <p className="text-[11px] text-slate-500">{settings.address}</p>
                      )}
                      {settings?.phone && (
                        <p className="text-[11px] text-slate-500">Tél. {settings.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1 sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Journal des achats
                    </p>
                    <p className="text-lg font-bold tracking-tight text-slate-900">
                      {periodeLabel}
                    </p>
                    <dl className="space-y-0.5 pt-1 text-[11px] text-slate-500">
                      <div className="flex gap-2 sm:justify-end">
                        <dt>Édité le</dt>
                        <dd className="font-medium text-slate-700">
                          {new Date().toLocaleDateString("fr-FR")}
                        </dd>
                      </div>
                      {showFournisseur && (
                        <div className="flex gap-2 sm:justify-end">
                          <dt>Fournisseur</dt>
                          <dd className="font-medium text-slate-700">
                            {selectedReportSupplier === "all"
                              ? "Tous les fournisseurs"
                              : selectedReportSupplier}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </header>

                <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Réapprovisionnement
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                      {reportTotalQty} unités
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Mouvements
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                      {reportPurchases.length}
                    </p>
                  </div>
                  {showPrix && (
                    <div className="min-w-0 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Total décaissé
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                        {formatCurrency(reportTotalAmount)}
                      </p>
                    </div>
                  )}
                </section>

                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 px-2 font-semibold">Désignation</th>
                      <th className="py-2 px-2 text-center font-semibold">Qté</th>
                      {showPrix && (
                        <th className="py-2 px-2 text-right font-semibold">Prix unit.</th>
                      )}
                      {showPrix && <th className="py-2 pl-2 text-right font-semibold">Total</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reportPurchases.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3 + (showPrix ? 2 : 0)}
                          className="py-6 text-center italic text-slate-500"
                        >
                          Aucun achat enregistré sur cette période.
                        </td>
                      </tr>
                    ) : (
                      reportPurchases.map((p, i) => (
                        <tr
                          key={p.id}
                          className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/70" : ""}`}
                        >
                          <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-500">
                            {formatDateLocale(p.date, locale)}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="font-medium text-slate-900">
                              {getPurchaseLabel(p, products)}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                              {[
                                products.find((prod) => prod.id === p.productId)?.numero,
                                showFournisseur ? p.fournisseur || "Grossiste" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums text-slate-700">
                            {p.quantite}
                          </td>
                          {showPrix && (
                            <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-700">
                              {formatCurrency(p.prixAchatUnit)}
                            </td>
                          )}
                          {showPrix && (
                            <td className="py-2.5 pl-2 text-right font-mono font-medium tabular-nums text-slate-900">
                              {formatCurrency(p.totalAchat)}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {showPrix && reportPurchases.length > 0 && (
                  <div className="flex justify-end">
                    <dl className="w-full max-w-[16rem] space-y-1.5 text-[11px]">
                      <div className="flex justify-between gap-4 text-slate-500">
                        <dt>Mouvements</dt>
                        <dd className="font-mono tabular-nums text-slate-700">
                          {reportPurchases.length}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-t-2 border-slate-900 pt-2">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                          Total décaissé
                        </dt>
                        <dd className="font-mono text-base font-bold tabular-nums text-slate-900">
                          {formatCurrency(reportTotalAmount)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

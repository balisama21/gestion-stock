import * as XLSX from "xlsx";
import { Product, Purchase, Sale, Expense, Seller, CapitalSummary } from "../types";
import { getProductLabel, getPurchaseLabel, getSaleLabel } from "./formulas";
import { CODE_APPS_SCRIPT_V3 } from "../data/appsScriptCode";

export function downloadExcelWorkbook(
  capital: CapitalSummary,
  products: Product[],
  purchases: Purchase[],
  sales: Sale[],
  sellers: Seller[],
  expenses: Expense[],
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Capital
  const wsCapitalData = [
    ["INDICATEUR / COMPTE", "MONTANT (Ar)", "NOTE / FORMULE GOOGLE SHEETS"],
    ["Capital Initial (Caisse)", capital.capitalInitial, "Saisie manuelle"],
    ["Seuil d'Alerte Trésorerie", capital.seuilAlerteTresorerie, "Saisie manuelle"],
    ["Total Apports Externes", { f: "SUM(Apports!C:C)" }, "Formule automatique"],
    ["Total Encaissé (Ventes)", { f: "SUM(Ventes!M:M)" }, "Formule automatique"],
    ["Total Décaissements (Achats)", { f: "SUM(Achats!G:G)" }, "Formule automatique"],
    ["Total Dépenses & Retraits Vendeurs", { f: "SUM(Dépenses!E:E)" }, "Formule automatique"],
    [
      "TRÉSORERIE GLOBALE ACTUELLE",
      { f: "B2+B3+SUM(Apports!C:C)+SUM(Ventes!M:M)-SUM(Achats!G:G)-SUM(Dépenses!E:E)" },
      "Alerte si négative ou < B3",
    ],
  ];
  const wsCapital = XLSX.utils.aoa_to_sheet(wsCapitalData);
  XLSX.utils.book_append_sheet(wb, wsCapital, "Capital");

  // 2. Sheet: Produits
  const produitsHeaders = [
    "ID Produit",
    "Désignation",
    "Variante / Subscript",
    "Nom Complet Affiché",
    "Prix Achat Unit. (Ar)",
    "Prix Vente Défaut (Ar)",
    "Fournisseur Préféré",
    "Stock Initial",
    "Stock Actuel",
    "Seuil Alerte",
  ];
  const produitsRows = products.map((p) => [
    p.id,
    getProductLabel(p, products),
    p.prixAchat,
    p.prixVenteDefaut,
    p.fournisseur,
    p.stockInitial,
    p.stockActuel,
    p.seuilAlerte,
  ]);
  const wsProduits = XLSX.utils.aoa_to_sheet([produitsHeaders, ...produitsRows]);
  XLSX.utils.book_append_sheet(wb, wsProduits, "Produits");

  // 3. Sheet: Achats
  const achatsHeaders = [
    "ID Achat",
    "Date",
    "ID Produit",
    "Désignation",
    "Quantité",
    "Prix Achat Unit. (Ar)",
    "Total Achat (Ar)",
    "Fournisseur",
  ];
  const achatsRows = purchases.map((p, idx) => {
    const rowNum = idx + 2;
    return [
      p.id,
      p.date,
     p.productId,
      getPurchaseLabel(p, products),
      p.quantite,
      p.prixAchatUnit,
      { f: `E${rowNum}*F${rowNum}` },
      p.fournisseur,
    ];
  });
  const wsAchats = XLSX.utils.aoa_to_sheet([achatsHeaders, ...achatsRows]);
  XLSX.utils.book_append_sheet(wb, wsAchats, "Achats");

  // 4. Sheet: Ventes
  const ventesHeaders = [
    "ID Vente",
    "Date",
    "ID Produit",
    "Désignation Produit",
    "Quantité",
    "Prix Vente Unit. Saisi Libre (Ar)",
    "Total Vente (Ar)",
    "Prix Achat Unit. Ref (Ar)",
    "Total Achat Ref (Ar)",
    "Marge Totale (Ar)",
    "Nom Vendeur",
    "Client Crédit",
    "Montant Payé (Ar)",
    "Solde Dû (Ar)",
    "Statut Crédit",
  ];
  const ventesRows = sales.map((s, idx) => {
    const rowNum = idx + 2;
    return [
      s.id,
      s.date,
     s.productId,
      getSaleLabel(s, products),
      s.quantite,
      s.prixVenteUnit,
      { f: `E${rowNum}*F${rowNum}` },
      s.prixAchatUnitRef,
      { f: `E${rowNum}*H${rowNum}` },
      { f: `G${rowNum}-I${rowNum}` },
      s.vendeur,
      s.clientCredit || "",
      s.montantPaye,
      { f: `G${rowNum}-M${rowNum}` },
      s.statutCredit,
    ];
  });
  const wsVentes = XLSX.utils.aoa_to_sheet([ventesHeaders, ...ventesRows]);
  XLSX.utils.book_append_sheet(wb, wsVentes, "Ventes");

  // 5. Sheet: Vendeurs
  const vendeursHeaders = [
    "ID Vendeur",
    "Nom Vendeur",
    "Statut",
    "Total Ventes Realisées (Ar)",
    "Nb Ventes",
    "Total Dépenses & Retraits (Ar)",
    'Solde Net "En Poche" (Ar)',
  ];
  const vendeursRows = sellers.map((s, idx) => {
    const rowNum = idx + 2;
    return [
      s.id,
      s.nom,
      s.statut,
      { f: `SUMIFS(Ventes!G:G, Ventes!K:K, B${rowNum})` },
      { f: `COUNTIFS(Ventes!K:K, B${rowNum})` },
      { f: `SUMIFS(Dépenses!E:E, Dépenses!C:C, B${rowNum})` },
      { f: `D${rowNum}-F${rowNum}` },
    ];
  });
  const wsVendeurs = XLSX.utils.aoa_to_sheet([vendeursHeaders, ...vendeursRows]);
  XLSX.utils.book_append_sheet(wb, wsVendeurs, "Vendeurs");

  // 6. Sheet: Dépenses
  const depensesHeaders = [
    "ID Dépense",
    "Date",
    "Vendeur Concerné",
    "Type de Mouvement",
    "Montant (Ar)",
    "Note / Motif",
    "Impact Trésorerie Globale",
  ];
  const depensesRows = expenses.map((e, idx) => {
    const rowNum = idx + 2;
    return [e.id, e.date, e.vendeur, e.type, e.montant, e.note, { f: `-E${rowNum}` }];
  });
  const wsDepenses = XLSX.utils.aoa_to_sheet([depensesHeaders, ...depensesRows]);
  XLSX.utils.book_append_sheet(wb, wsDepenses, "Dépenses");

  // 7. Sheet: Apports
  const apportsHeaders = ["ID Apport", "Date", "Montant (Ar)", "Origine / Note"];
  const apportsRows = [["APP-001", "2026-01-01", 500000, "Apport initial fonds de caisse"]];
  const wsApports = XLSX.utils.aoa_to_sheet([apportsHeaders, ...apportsRows]);
  XLSX.utils.book_append_sheet(wb, wsApports, "Apports");

  // 8. Sheet: Code_Apps_Script_GS
  const gsInstructions = [
    ["GUIDE D'UTILISATION DU CODE APPS SCRIPT DANS GOOGLE SHEETS"],
    [
      "1. Importez ce fichier Excel (.xlsx) dans votre Google Drive et ouvrez-le avec Google Sheets.",
    ],
    ["2. Allez dans le menu supérieur : Extensions > Apps Script."],
    [
      "3. Copiez tout le code ci-dessous et collez-le dans l'éditeur Google Apps Script (fichier Code.gs).",
    ],
    ["4. Enregistrez (Ctrl+S) et fermez la fenêtre Apps Script."],
    ['5. Rechargez votre feuille Google Sheets : Le menu "📦 Stock & Gestion" apparaîtra !'],
    [""],
    ["CODE APPS SCRIPT COMPLET (Code_Apps_Script_v3.gs) :"],
    [CODE_APPS_SCRIPT_V3],
  ];
  const wsCodeGS = XLSX.utils.aoa_to_sheet(gsInstructions);
  XLSX.utils.book_append_sheet(wb, wsCodeGS, "Code_Apps_Script_GS");

  // Write file and trigger download
  XLSX.writeFile(wb, "Gestions_Stock_Export.xlsx");
}

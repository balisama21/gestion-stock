// Modèle d'import Excel, aligné sur l'assistant d'import (src/features/import).
// Usage : MARQUE=kinvest node modele.js sortie.xlsx
//
// Contraintes tirées du code de l'assistant :
// — chaque feuille est lue ; une feuille sans ligne de données est ignorée ;
// — la ligne d'en-tête est la première ligne qui a au moins deux cellules
//   remplies : une consigne d'une seule cellule au-dessus est donc sautée ;
// — « Lisez-moi » tient dans une seule cellule pour être ignorée elle aussi ;
// — aucune formule : une cellule calculée pourrait faire passer une ligne
//   vide pour une ligne de données.
const ExcelJS = require("exceljs");
const OUT = process.argv[2];
const K = process.env.MARQUE === "kinvest";
const NOM = K ? "Kinvest" : "Tantana Suite";
const N = 500; // lignes préparées par feuille
const VERT = "FF0E7A57";
const ORANGE = "FFFDE2C4";

const wb = new ExcelJS.Workbook();
wb.creator = NOM;
wb.title = `Modèle d'import ${NOM}`;

// ── Lisez-moi : une seule cellule ───────────────────────────────────
const LISEZ_MOI = [
  `MODÈLE D'IMPORT — ${NOM.toUpperCase()}`,
  "",
  "1. À QUOI SERT CE CLASSEUR",
  "Il se remplit puis s'importe TEL QUEL, sans conversion : bouton « Importer » des écrans Produits, Clients, Fournisseurs ou Achats. Un même fichier peut alimenter plusieurs modules : chaque feuille remplie reçoit sa destination. Les feuilles laissées vides et cette feuille-ci sont ignorées.",
  "",
  "2. PROCÉDURE",
  "① Remplissez les feuilles utiles à partir de la ligne 3, sans toucher à la ligne d'en-tête (ligne 2). Les notes sur les en-têtes donnent des exemples.",
  "② Enregistrez le fichier (.xlsx).",
  "③ Dans l'application, cliquez sur « Importer », choisissez le fichier, vérifiez la destination et les colonnes reconnues de chaque feuille.",
  "④ Lisez l'aperçu (nouveaux, déjà présents, rejetés), choisissez les options, puis confirmez. Le bilan s'affiche et reste consultable dans « Imports récents ».",
  "",
  "3. RÈGLES",
  "• Obligatoire : Désignation (Produits), Nom (Clients, Fournisseurs), Date, Produit, Quantité et Prix d'achat unitaire (Achats).",
  "• Doublons du fichier ignorés. Fiches déjà présentes : ignorées ou mises à jour, au choix (une case vide n'efface rien). Relancer le même fichier ne recrée rien.",
  "• Produits : la quantité devient le stock initial. Achats : chaque ligne ajoute au stock et, sans « Montant payé », est réglée comptant (la trésorerie diminue) ; une confirmation est demandée.",
  "• Fournisseurs cités dans Produits ou Achats : créés au passage (option cochée par défaut).",
  "• Les ventes passées ne s'importent pas : elles modifieraient le stock et la caisse d'aujourd'hui.",
  "• Droits : chaque destination demande le droit « créer » du module (le propriétaire a tous les droits).",
  "",
  "4. LISTES (catégories, postes de dépenses, types de fournisseur)",
  "Elles ne passent pas par ce classeur : Paramètres › Listes › « Importer une liste », un fichier texte ou CSV avec une valeur par ligne. Elles se créent aussi directement depuis les champs des formulaires.",
].join("\n");

const lm = wb.addWorksheet("Lisez-moi", { properties: { tabColor: { argb: VERT } } });
lm.getColumn(1).width = 120;
const c1 = lm.getCell("A1");
c1.value = LISEZ_MOI;
c1.alignment = { wrapText: true, vertical: "top" };
c1.font = { size: 10 };
lm.getRow(1).height = 409;

// ── Feuilles de données ─────────────────────────────────────────────
// En-têtes = libellés de l'assistant (reconnus sans correspondance manuelle).
const FEUILLES = [
  {
    nom: "Produits",
    consigne: "PRODUITS ET STOCK — une ligne par produit. Désignation obligatoire. La quantité devient le stock initial.",
    colonnes: [
      ["Désignation", 32, "texte", "Obligatoire. Ex. : Ciment 50 kg"],
      ["Variante", 16, "texte", "Facultatif. Ex. : Gris"],
      ["Prix d'achat", 14, "nombre", "Ex. : 32000"],
      ["Prix de vente", 14, "nombre", "Ex. : 36000"],
      ["Stock initial", 13, "entier", "Quantité déjà en rayon. Ex. : 40"],
      ["Seuil d'alerte", 13, "entier", "En dessous, le produit passe en alerte. Ex. : 5"],
      ["Fournisseur", 26, "texte", "Facultatif. Créé s'il n'existe pas (option)."],
    ],
  },
  {
    nom: "Clients",
    consigne: "CLIENTS — une ligne par client. Nom obligatoire.",
    colonnes: [
      ["Nom", 24, "texte", "Obligatoire. Ex. : Rakoto"],
      ["Prénom", 18, "texte", "Ex. : Jean"],
      ["Entreprise", 24, "texte", "Ex. : Rakoto BTP"],
      ["Téléphone", 18, "tel", "Le 0 initial est conservé. Ex. : 034 00 000 01"],
      ["E-mail", 26, "texte", "Ex. : contact@exemple.mg"],
      ["Adresse", 28, "texte", "Ex. : Lot II A 12"],
      ["Ville", 16, "texte", "Ex. : Antananarivo"],
      ["Note", 30, "texte", "Facultatif."],
    ],
  },
  {
    nom: "Fournisseurs",
    consigne: "FOURNISSEURS — une ligne par fournisseur. Nom obligatoire.",
    colonnes: [
      ["Nom du fournisseur", 28, "texte", "Obligatoire. Ex. : Grossiste Analakely"],
      ["Entreprise", 24, "texte", "Facultatif."],
      ["Téléphone", 18, "tel", "Le 0 initial est conservé. Ex. : 032 00 000 02"],
      ["E-mail", 26, "texte", "Facultatif."],
      ["Adresse", 28, "texte", "Facultatif."],
      ["Ville", 16, "texte", "Ex. : Toamasina"],
      ["Note", 30, "texte", "Conditions, délais…"],
    ],
  },
  {
    nom: "Achats",
    consigne: "ACHATS — une ligne par article acheté. Chaque ligne ajoute au stock ; sans montant payé, elle est réglée comptant.",
    colonnes: [
      ["Date", 13, "date", "Obligatoire. Ex. : 15/10/2026"],
      ["Produit", 30, "texte", "Obligatoire. Créé s'il n'existe pas."],
      ["Variante", 14, "texte", "Facultatif."],
      ["Quantité", 11, "entier", "Obligatoire. Ex. : 20"],
      ["Prix d'achat unitaire", 16, "nombre", "Obligatoire. Ex. : 32000"],
      ["Fournisseur", 26, "texte", "Facultatif."],
      ["Montant payé", 14, "nombre", "Vide = payé comptant. Moins que le total = achat à crédit."],
      ["Prix de vente", 14, "nombre", "Pour un produit créé par cet achat."],
    ],
  },
];

for (const f of FEUILLES) {
  const ws = wb.addWorksheet(f.nom, { views: [{ state: "frozen", ySplit: 2 }] });
  const n = f.colonnes.length;

  // Ligne 1 : consigne, une seule cellule (sautée par l'import).
  ws.mergeCells(1, 1, 1, n);
  const consigne = ws.getCell(1, 1);
  consigne.value = f.consigne;
  consigne.font = { bold: true, color: { argb: VERT } };
  consigne.alignment = { vertical: "middle", wrapText: true };
  ws.getRow(1).height = 30;

  // Ligne 2 : en-têtes, avec l'exemple en note.
  f.colonnes.forEach(([titre, largeur, type, aide], i) => {
    const col = ws.getColumn(i + 1);
    col.width = largeur;
    const c = ws.getCell(2, i + 1);
    c.value = titre;
    c.note = aide;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERT } };
    c.alignment = { vertical: "middle", wrapText: true };

    const lettre = col.letter;
    const zone = `${lettre}3:${lettre}${N + 2}`;
    for (let r = 3; r <= N + 2; r++) {
      const cell = ws.getCell(r, i + 1);
      if (type === "tel" || type === "texte") cell.numFmt = "@";
      if (type === "date") cell.numFmt = "dd/mm/yyyy";
      if (type === "nombre") cell.numFmt = "#,##0";
      if (type === "entier") cell.numFmt = "0";
    }
    if (type === "nombre" || type === "entier") {
      ws.dataValidations.add(zone, {
        type: type === "entier" ? "whole" : "decimal",
        operator: "greaterThanOrEqual",
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Nombre attendu",
        error: "Saisissez un nombre positif, sans unité (ex. : 32000).",
      });
    }
    if (type === "date") {
      ws.dataValidations.add(zone, {
        type: "date",
        operator: "greaterThan",
        formulae: [new Date(2000, 0, 1)],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Date attendue",
        error: "Saisissez une date (ex. : 15/10/2026).",
      });
    }
  });
  ws.getRow(2).height = 32;

  // Doublons de la première colonne surlignés (mise en forme, pas de valeur).
  ws.addConditionalFormatting({
    ref: `A3:A${N + 2}`,
    rules: [
      {
        type: "expression",
        formulae: [`AND(A3<>"",COUNTIF($A$3:$A$${N + 2},A3)>1)`],
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: ORANGE } } },
      },
    ],
  });
}

wb.xlsx.writeFile(OUT).then(() => console.log("OK", OUT));

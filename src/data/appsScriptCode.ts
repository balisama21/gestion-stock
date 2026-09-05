export const CODE_APPS_SCRIPT_V3 = `/**
 * ==============================================================================
 * TANTANA SUITE - SCRIPT APPS SCRIPT v3 REFACTORISÉ
 * Fichier : Code_Apps_Script_v3.gs
 * Compatibilité : France (;) & USA (,), Paramètres Régionaux Universels
 * Auteur : Équipe Tantana Suite
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURATION GLOBALE ET MENU
// ==============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📦 Stock & Gestion')
    .addItem('🔄 Recalculer & Réparer Formules', 'reparerFormulesGlobales')
    .addItem('🔍 Détecter Nouveaux Produits & Variantes', 'detecterNouveauProduitAchat')
    .addItem('🚨 Vérifier Trésorerie & Stocks', 'verifierTresorerieEtAlertes')
    .addSeparator()
    .addItem('💸 Enregistrer une Dépense Vendeur', 'ouvrirFormulaireDepense')
    .addItem('👨‍💼 Mettre à Jour Liste Vendeurs', 'synchroniserListeVendeurs')
    .addSeparator()
    .addItem('📧 Envoyer Rapport Hebdomadaire PDF', 'envoyerRapportEmail')
    .addToUi();
}

/**
 * Trigger automatique lors des modifications manuelles (Prix vente, ID produit, Vendeurs, Dépenses)
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  if (row <= 1) return; // Ignorer les en-têtes

  // A. ONGLET VENTES : PRÉREMPLIR LE PRIX DE VENTE DE DÉFAUT (SI VIDE) MAIS LAISSER SAISIE LIBRE
  if (sheetName === 'Ventes') {
    // Colonne B = ID Produit (ou C = Produit)
    if (col === 2 || col === 3) {
      preRemplirPrixVenteDefaut(sheet, row);
    }
    // Remplir auto la date si colonne A est vide
    if (col === 2 && !sheet.getRange(row, 1).getValue()) {
      sheet.getRange(row, 1).setValue(new Date());
    }
  }

  // B. ONGLET ACHATS : AUTO-GÉNÉRATION ID & RENSEIGNEMENT DATE
  if (sheetName === 'Achats') {
    if (col === 3 && !sheet.getRange(row, 1).getValue()) { // Si désignation saisie
      sheet.getRange(row, 1).setValue(new Date());
      detecterNouveauProduitAchat();
    }
    verifierTresorerieApresAchat();
  }

  // C. ONGLET DÉPENSES : IMPACT TRÉSORERIE & ALERTES
  if (sheetName === 'Dépenses') {
    if (col === 4) { // Montant dépense
      verifierTresorerieApresAchat();
    }
  }
}

// ==============================================================================
// 2. LOGIQUE PRIX DE VENTE SAISI MANUELLEMENT (DEMANDE 2)
// ==============================================================================

/**
 * Préremplit le prix de vente par défaut depuis Produits!E vers Ventes!E
 * si la cellule Ventes!E est vide, tout en laissant le client libre de le modifier !
 */
function preRemplirPrixVenteDefaut(sheetVentes, row) {
  const productId = sheetVentes.getRange(row, 2).getValue();
  const currentPrixVente = sheetVentes.getRange(row, 5).getValue();

  if (!productId) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetProduits = ss.getSheetByName('Produits');
  if (!sheetProduits) return;

  const dataProduits = sheetProduits.getDataRange().getValues();
  let defaultPrice = null;

  for (let i = 1; i < dataProduits.length; i++) {
    if (dataProduits[i][0] === productId) {
      defaultPrice = dataProduits[i][4]; // Colonne E = Prix Vente Défaut
      break;
    }
  }

  // Uniquement si le prix courant est vide ou égal à 0, on préremplit avec le prix par défaut
  if ((currentPrixVente === '' || currentPrixVente === 0) && defaultPrice !== null) {
    sheetVentes.getRange(row, 5).setValue(defaultPrice);
  }
}

// ==============================================================================
// 3. VARIANTES DE PRIX & INDICES DE NOM DE PRODUIT (DEMANDE 5)
// ==============================================================================

/**
 * Transforme les chiffres en caractères sous-scrits Unicode (ex: 1000 -> ₁₀₀₀)
 */
function toUnicodeSubscript(str) {
  const subMap = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };
  return String(str).split('').map(c => subMap[c] || c).join('');
}

/**
 * Détecte si un achat correspond à un nouveau produit ou une variante de prix,
 * attribue un ID unique (P001, P002...) et met à jour les noms d'affichage avec indice.
 */
function detecterNouveauProduitAchat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAchats = ss.getSheetByName('Achats');
  const sheetProduits = ss.getSheetByName('Produits');

  if (!sheetAchats || !sheetProduits) return;

  const dataAchats = sheetAchats.getDataRange().getValues();
  const dataProduits = sheetProduits.getDataRange().getValues();

  // Dictionnaire des produits existants
  let produitsMap = []; // { id, designation, prixAchat, fournisseur, row }
  for (let i = 1; i < dataProduits.length; i++) {
    if (dataProduits[i][0]) {
      produitsMap.push({
        id: dataProduits[i][0],
        designation: String(dataProduits[i][1]).split('₁')[0].split('₂')[0].split('₃')[0].split('₄')[0].split('₅')[0].split('₆')[0].split('₇')[0].split('₈')[0].split('₉')[0].split('₀')[0].split('[')[0].trim(),
        prixAchat: parseFloat(dataProduits[i][2]) || 0,
        fournisseur: String(dataProduits[i][5] || '').trim(),
        row: i + 1
      });
    }
  }

  let nextIdNumber = produitsMap.length + 1;

  for (let i = 1; i < dataAchats.length; i++) {
    const rawDesignation = String(dataAchats[i][2] || '').trim();
    const prixAchat = parseFloat(dataAchats[i][5]) || 0;
    const fournisseur = String(dataAchats[i][7] || '').trim();

    if (!rawDesignation) continue;

    // Chercher si ce produit avec cette désignation exacte existe déjà
    let matchingProduct = produitsMap.find(p =>
      p.designation.toLowerCase() === rawDesignation.toLowerCase() &&
      Math.abs(p.prixAchat - prixAchat) < 0.01 &&
      p.fournisseur.toLowerCase() === fournisseur.toLowerCase()
    );

    if (!matchingProduct) {
      // Création d'un nouveau produit / nouvelle variante
      const newId = 'P' + String(nextIdNumber).padStart(3, '0');
      nextIdNumber++;

      const newRow = sheetProduits.getLastRow() + 1;
      const defaultPrixVente = Math.round(prixAchat * 1.3); // Marge indicative 30%

      sheetProduits.getRange(newRow, 1).setValue(newId);
      sheetProduits.getRange(newRow, 2).setValue(rawDesignation);
      sheetProduits.getRange(newRow, 3).setValue(prixAchat);
      sheetProduits.getRange(newRow, 4).setValue(defaultPrixVente);
      sheetProduits.getRange(newRow, 5).setValue(fournisseur);
      sheetProduits.getRange(newRow, 6).setValue(0); // Stock initial
      sheetProduits.getRange(newRow, 8).setValue(5); // Seuil alerte

      produitsMap.push({
        id: newId,
        designation: rawDesignation,
        prixAchat: prixAchat,
        fournisseur: fournisseur,
        row: newRow
      });

      // Écrire l'ID dans la ligne de l'onglet Achats
      sheetAchats.getRange(i + 1, 2).setValue(newId);
    } else {
      sheetAchats.getRange(i + 1, 2).setValue(matchingProduct.id);
    }
  }

  // Mettre à jour les noms stylés (indices) pour toutes les variantes
  mettreAJourStylingVariantes(sheetProduits);
}

/**
 * Formate les désignations avec indices (kapa₁₀₀₀ vs kapa[Fournisseur B])
 */
function mettreAJourStylingVariantes(sheetProduits) {
  const data = sheetProduits.getDataRange().getValues();
  if (data.length <= 1) return;

  // Regrouper par désignation de base
  let groupes = {};
  for (let i = 1; i < data.length; i++) {
    const id = data[i][0];
    if (!id) continue;

    const fullName = String(data[i][1]);
    const baseName = fullName.split('₁')[0].split('₂')[0].split('₃')[0].split('₄')[0].split('₅')[0].split('₆')[0].split('₇')[0].split('₈')[0].split('₉')[0].split('₀')[0].split('[')[0].trim();
    const prixAchat = data[i][2];
    const fournisseur = String(data[i][4] || '').trim();

    if (!groupes[baseName]) groupes[baseName] = [];
    groupes[baseName].push({ row: i + 1, id, baseName, prixAchat, fournisseur });
  }

  for (let baseName in groupes) {
    const mecs = groupes[baseName];
    // Vérifier si les fournisseurs diffèrent
    const firstFourn = mecs[0].fournisseur;
    const differentsFournisseurs = mecs.some(m => m.fournisseur !== firstFourn && m.fournisseur !== '');

    mecs.forEach(item => {
      let displayName = item.baseName;
      if (differentsFournisseurs && item.fournisseur) {
        displayName += '[' + item.fournisseur + ']';
      } else {
        displayName += toUnicodeSubscript(item.prixAchat);
      }
      sheetProduits.getRange(item.row, 2).setValue(displayName);
    });
  }
}

// ==============================================================================
// 4. GESTION DES VENDEURS ET DÉPENSES CONNECTÉES (DEMANDES 3 ET 4)
// ==============================================================================

/**
 * Synchronise la liste des vendeurs pour les menus déroulants de la feuille Ventes
 */
function synchroniserListeVendeurs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetVendeurs = ss.getSheetByName('Vendeurs');
  const sheetVentes = ss.getSheetByName('Ventes');

  if (!sheetVendeurs || !sheetVentes) return;

  const lastRowVendeurs = Math.max(sheetVendeurs.getLastRow(), 2);
  const rangeVendeurs = sheetVendeurs.getRange('B2:B' + lastRowVendeurs);

  // Appliquer la règle de validation sur la colonne N de Ventes (Vendeur)
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(rangeVendeurs, true)
    .setAllowInvalid(false)
    .build();

  const rangeVentesVendeurs = sheetVentes.getRange('N2:N500');
  rangeVentesVendeurs.setDataValidation(rule);
}

/**
 * Ouvre une boîte de dialogue rapide pour enregistrer une dépense vendeur
 */
function ouvrirFormulaireDepense() {
  const ui = SpreadsheetApp.getUi();
  const responseVendeur = ui.prompt('Dépense Vendeur', 'Nom du vendeur :', ui.ButtonSet.OK_CANCEL);
  if (responseVendeur.getSelectedButton() !== ui.Button.OK) return;

  const responseMontant = ui.prompt('Dépense Vendeur', 'Montant de la dépense (Ar) :', ui.ButtonSet.OK_CANCEL);
  if (responseMontant.getSelectedButton() !== ui.Button.OK) return;

  const responseNote = ui.prompt('Dépense Vendeur', 'Motif / Note :', ui.ButtonSet.OK_CANCEL);

  const vendeur = responseVendeur.getResponseText();
  const montant = parseFloat(responseMontant.getResponseText()) || 0;
  const note = responseNote.getResponseText();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetDepenses = ss.getSheetByName('Dépenses');
  if (!sheetDepenses) {
    sheetDepenses = ss.insertSheet('Dépenses');
    sheetDepenses.appendRow(['Date', 'Vendeur', 'Type de Mouvement', 'Montant', 'Note / Commentaire']);
  }

  sheetDepenses.appendRow([new Date(), vendeur, "Retrait d'argent", montant, note]);
  verifierTresorerieApresAchat();
  ui.alert('✅ Dépense enregistrée avec succès ! La trésorerie globale et le solde du vendeur ont été mis à jour.');
}

// ==============================================================================
// 5. ALERTES DE TRÉSORERIE GLOBALE (DEMANDE 4)
// ==============================================================================

function verifierTresorerieApresAchat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCapital = ss.getSheetByName('Capital');
  if (!sheetCapital) return;

  // Calculer la trésorerie actuelle
  const tresorerie = sheetCapital.getRange('B7').getValue(); // Cellule Trésorerie Actuelle
  const seuilAlerte = sheetCapital.getRange('B8').getValue() || 50000;

  if (tresorerie < 0) {
    SpreadsheetApp.getUi().alert('🚨 ALERTE CRITIQUE DE TRÉSORERIE !\nLa trésorerie globale est NÉGATIVE (' + tresorerie + ' Ar). Veuillez réapprovisionner le capital.');
  } else if (tresorerie < seuilAlerte) {
    SpreadsheetApp.getUi().alert('⚠️ ALERTE SEUIL BAS !\nLa trésorerie actuelle (' + tresorerie + ' Ar) est sous le seuil minimal de sécurité (' + seuilAlerte + ' Ar).');
  }
}

function verifierTresorerieEtAlertes() {
  verifierTresorerieApresAchat();
}

// ==============================================================================
// 6. RÉPARATION DES FORMULES COMPATIBLES FRANCE (;) & USA (,) (DEMANDE 1)
// ==============================================================================

function reparerFormulesGlobales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // A. ONGLET CAPITAL
  const sheetCapital = ss.getSheetByName('Capital');
  if (sheetCapital) {
    sheetCapital.getRange('B4').setFormula('=SUM(Apports!C:C)');
    sheetCapital.getRange('B5').setFormula('=SUM(Ventes!P:P)'); // Total ventes encaissées
    sheetCapital.getRange('B6').setFormula('=SUM(Achats!G:G)');  // Total achats
    sheetCapital.getRange('B7').setFormula('=SUM(Dépenses!D:D)'); // Total dépenses vendeurs
    sheetCapital.getRange('B8').setFormula('=B2+B3+B4+B5-B6-B7'); // Trésorerie Globale Actuelle
  }

  // B. ONGLET VENDEURS
  const sheetVendeurs = ss.getSheetByName('Vendeurs');
  if (sheetVendeurs) {
    const lastRow = Math.max(sheetVendeurs.getLastRow(), 2);
    for (let r = 2; r <= lastRow; r++) {
      sheetVendeurs.getRange(r, 3).setFormula('=SUMIFS(Ventes!F:F; Ventes!N:N; B' + r + ')');
      sheetVendeurs.getRange(r, 4).setFormula('=COUNTIFS(Ventes!N:N; B' + r + ')');
      sheetVendeurs.getRange(r, 5).setFormula('=SUMIFS(Dépenses!D:D; Dépenses!B:B; B' + r + ')');
      sheetVendeurs.getRange(r, 6).setFormula('=C' + r + ' - E' + r + '');
    }
  }

  // C. ONGLET VENTES
  const sheetVentes = ss.getSheetByName('Ventes');
  if (sheetVentes) {
    const lastRowV = Math.max(sheetVentes.getLastRow(), 2);
    for (let r = 2; r <= lastRowV; r++) {
      sheetVentes.getRange(r, 4).setFormula('=IF(B' + r + '<>""; VLOOKUP(B' + r + '; Produits!A:B; 2; FALSE); "")');
      sheetVentes.getRange(r, 6).setFormula('=IF(D' + r + '<>""; D' + r + '*E' + r + '; "")'); // Total Vente = Qté * Prix Saisi
      sheetVentes.getRange(r, 7).setFormula('=IF(B' + r + '<>""; VLOOKUP(B' + r + '; Produits!A:C; 3; FALSE); "")'); // Prix Achat Ref
      sheetVentes.getRange(r, 8).setFormula('=IF(D' + r + '<>""; D' + r + '*G' + r + '; "")'); // Total Achat Ref
      sheetVentes.getRange(r, 9).setFormula('=IF(F' + r + '<>""; F' + r + '-H' + r + '; "")'); // Marge Totale
      sheetVentes.getRange(r, 17).setFormula('=IF(F' + r + '<>""; F' + r + '-P' + r + '; "")'); // Solde Dû Crédit
      sheetVentes.getRange(r, 18).setFormula('=IF(Q' + r + '=0; "Payé"; IF(Q' + r + '=F' + r + '; "Impayé"; "Partiel"))'); // Statut Crédit
    }
  }

  SpreadsheetApp.getUi().alert('✅ Formules réinitialisées avec succès en syntaxe universelle !');
}
`;

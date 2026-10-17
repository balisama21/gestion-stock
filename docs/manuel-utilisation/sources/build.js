const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, LevelFormat, TableOfContents, Header, Footer,
  PageNumber, PageBreak, VerticalAlign,
} = require("docx");
const { COLS, CONS, TRIGGERS } = require("./schema");
const { TABLES, descr } = require("./descriptions");

const OUT = process.argv[2];
const VERT = "0E7A57";
const VERT_CLAIR = "E8F3EE";
const GRIS = "5F6B66";
const CONTENU = 9638; // A4 − marges de 2 cm

// ── Texte avec **gras** ─────────────────────────────────────────────
function runs(texte, opts = {}) {
  const out = [];
  String(texte).split(/(\*\*[^*]+\*\*)/).forEach((m) => {
    if (!m) return;
    if (m.startsWith("**")) out.push(new TextRun({ text: m.slice(2, -2), bold: true, ...opts }));
    else out.push(new TextRun({ text: m, ...opts }));
  });
  return out;
}
const P = (t, o = {}) => new Paragraph({ children: runs(t, o.run), spacing: { after: 120, line: 276 }, ...o.par });

let instance = 0;
function bloc(b) {
  const [k, a, b2, c, d] = b;
  switch (k) {
    case "h1": return [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(a)] })];
    case "h2": return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(a)] })];
    case "h3": return [new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(a)] })];
    case "p": return [P(a)];
    case "pb": return [new Paragraph({ children: [new PageBreak()] })];
    case "ul": return a.map((t) => new Paragraph({ children: runs(t), numbering: { reference: "puces", level: 0 }, spacing: { after: 60, line: 264 } }));
    case "ol": { instance += 1; const i = instance; return a.map((t) => new Paragraph({ children: runs(t), numbering: { reference: "etapes", level: 0, instance: i }, spacing: { after: 60, line: 264 } })); }
    case "t": return [tableau(a, b2, c), new Paragraph({ spacing: { after: 80 }, children: [] })];
    case "note": return [note(a, b2)];
    default: throw new Error("bloc inconnu " + k);
  }
}

function note(type, texte) {
  const titres = { info: "À savoir", warn: "Attention", conf: "À confirmer" };
  const couleurs = { info: ["2B6CB0", "EBF4FB"], warn: ["B7791F", "FDF6E7"], conf: ["8A4BAF", "F4EEF8"] };
  const [bord, fond] = couleurs[type];
  return new Paragraph({
    children: [new TextRun({ text: titres[type] + " — ", bold: true, color: bord }), ...runs(texte)],
    shading: { type: ShadingType.CLEAR, color: "auto", fill: fond },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: bord, space: 8 } },
    indent: { left: 120, right: 120 },
    spacing: { before: 80, after: 160, line: 264 },
  });
}

const bordure = { style: BorderStyle.SINGLE, size: 4, color: "C9D3CE" };
const bordures = { top: bordure, bottom: bordure, left: bordure, right: bordure };

function tableau(entetes, lignes, poids) {
  const p = poids ?? entetes.map(() => 1);
  const somme = p.reduce((x, y) => x + y, 0);
  const largeurs = p.map((x) => Math.floor((x / somme) * CONTENU));
  largeurs[largeurs.length - 1] += CONTENU - largeurs.reduce((x, y) => x + y, 0);
  const cellule = (texte, i, entete) => new TableCell({
    width: { size: largeurs[i], type: WidthType.DXA },
    borders: bordures,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: entete ? { type: ShadingType.CLEAR, color: "auto", fill: VERT } : undefined,
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({ spacing: { after: 0, line: 240 }, children: runs(texte ?? "", { size: 17, color: entete ? "FFFFFF" : undefined, bold: entete ? true : undefined }) })],
  });
  return new Table({
    width: { size: CONTENU, type: WidthType.DXA },
    columnWidths: largeurs,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: entetes.map((e, i) => cellule(e, i, true)) }),
      ...lignes.map((l, r) => new TableRow({ cantSplit: true, children: l.map((v, i) => {
        const c = cellule(v, i, false);
        return c;
      }) })),
    ],
  });
}

// ── Modèle de données ───────────────────────────────────────────────
function humain(def) {
  if (!def) return "";
  return def
    .replace("gen_random_uuid()", "généré automatiquement")
    .replace("auth.uid()", "utilisateur connecté")
    .replace("CURRENT_DATE", "date du jour")
    .replace(/^now\(\)$/, "date et heure courantes")
    .replace(/^''$/, "vide").replace(/^'(.+)'$/, "« $1 »");
}
function contraintesDe(t) {
  const liste = (CONS[t] ?? "").split(" ; ").filter(Boolean);
  const pk = [], fk = {}, uq = [], ck = [];
  for (const c of liste) {
    let m;
    if ((m = c.match(/^PK\((.+)\)$/))) pk.push(...m[1].split(","));
    else if ((m = c.match(/^UQ\((.+)\)$/))) uq.push(m[1]);
    else if ((m = c.match(/^FK (.+?)>(\S+)( CASCADE| SETNULL)?$/))) {
      const cols = m[1].split(/,\s*/);
      cols.forEach((col) => { if (col !== "store_id" || cols.length === 1) fk[col] = { table: m[2], del: (m[3] || "").trim() }; });
      if (cols.length > 1 && cols.includes("store_id") && !fk.store_id) fk.store_id = { table: "stores", del: "CASCADE" };
    } else if (c.startsWith("CK ")) ck.push(c.slice(3));
  }
  return { pk, fk, uq, ck };
}
function tableColonnes(t) {
  const { pk, fk, uq } = contraintesDe(t);
  const lignes = COLS[t].map((c) => {
    const cle = [];
    if (pk.includes(c.nom)) cle.push("PK");
    if (fk[c.nom]) cle.push("FK → " + fk[c.nom].table);
    uq.filter((u) => u.split(",").includes(c.nom)).forEach((u) => cle.push(u.includes(",") ? `Unique (${u.replace(/,/g, ", ")})` : "Unique"));
    const calcule = c.def.startsWith("calculé");
    if (calcule) cle.push("Calculé");
    let oblig = c.nn ? (c.def && !calcule ? "Oui (auto)" : "Oui") : "Non";
    if (calcule) oblig = "Auto";
    let d = descr(t, c.nom);
    if (c.def && !calcule) d += ` — défaut : ${humain(c.def)}`;
    if (calcule) d += ` (${c.def})`;
    return [c.nom, c.type, cle.join(" ; ") || "—", oblig, d];
  });
  return tableau(["Colonne", "Type", "Clé ou contrainte", "Obligatoire ?", "Description"], lignes, [2.1, 1.4, 2, 1.1, 3.9]);
}
function sectionTable(t) {
  const [, role, modules] = TABLES[t];
  const { ck } = contraintesDe(t);
  const out = [
    new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] }),
    P(`**Rôle** : ${role}`),
    P(`**Modules liés** : ${modules}`),
    tableColonnes(t),
    new Paragraph({ spacing: { after: 60 }, children: [] }),
  ];
  if (ck.length) out.push(P(`**Règles d'intégrité** : ${ck.join(" ; ")}.`, { run: { size: 18 } }));
  if (TRIGGERS[t]) out.push(P(`**Traitements automatiques** : ${TRIGGERS[t]}.`, { run: { size: 18 } }));
  return out;
}

function modeleDeDonnees() {
  const parCat = (cat) => Object.keys(TABLES).filter((t) => TABLES[t][0] === cat).sort();
  const blocs = [];
  const add = (...x) => x.forEach((b) => blocs.push(...(Array.isArray(b) ? bloc(b) : [b])));
  add(["h1", "7. Modèle de données (tables de base)"]);
  add(["p", "Cette partie décrit la base de données réelle de l'application (base PostgreSQL hébergée par Supabase, schéma « public »), relevée directement en lecture seule le 12 octobre 2026, puis complétée le 17 octobre 2026 des tables créées le 16 octobre (intelligence artificielle, journal des imports) d'après les migrations du dépôt. Elle comprend " + Object.keys(COLS).length + " tables et 1 vue (prealertes_a_annoncer). Aucune clé secrète, aucun mot de passe ni aucune donnée réelle n'y figure."]);
  add(["h2", "7.1 Principes communs"]);
  add(["ul", [
    "**Identifiants** : la plupart des tables ont une clé primaire « id » de type uuid générée automatiquement.",
    "**Cloisonnement par boutique** : presque toutes les tables portent une colonne **store_id** (clé étrangère vers stores). Des politiques de sécurité au niveau des lignes (RLS) n'autorisent un utilisateur à lire ou écrire que les lignes des boutiques dont il est membre ; certaines tables appliquent en plus la portée de ses permissions (salaires, tâches, rappels…).",
    "**Boutique verrouillée** : lorsqu'une boutique n'est plus active (essai terminé), les politiques de sécurité refusent toute écriture.",
    "**Opérations sensibles par fonctions serveur (RPC)** : ventes, achats, commandes, paiements, ajustements de stock, devis, avoirs passent par des fonctions de la base qui contrôlent les droits, le stock et les montants dans une seule transaction (tout ou rien) et utilisent une clé anti-doublon (idempotency_key).",
    "**Déclencheurs (triggers)** : numérotation des pièces, horodatage, recalcul des montants payés et des statuts, journal d'activité.",
    "**Suppression d'un parent** : CASCADE = les lignes liées sont supprimées ; SETNULL = le lien est vidé mais la ligne est conservée (ex. : une vente reste si le produit est supprimé).",
    "**Obligatoire ?** : « Oui » = à fournir ; « Oui (auto) » = obligatoire mais rempli automatiquement par une valeur par défaut ; « Auto » = colonne calculée par la base ; « Non » = facultatif.",
  ]]);
  add(["h2", "7.2 Schéma relationnel"]);
  add(["p", "Le schéma ci-dessous résume les liens principaux (« → » se lit « appartient à / fait référence à »). Toutes les tables de la boutique sont en outre liées à **stores** par store_id."]);
  add(["t", ["Domaine", "Relations principales"], [
    ["Boutique et équipe", "store_members → stores, profiles ; collaborator_invitations → stores ; profiles → stores (boutique active) ; stores → profiles (propriétaire)"],
    ["Catalogue et stock", "products → categories (catégorie), suppliers (fournisseur) ; product_images → products ; stock_movements → products (+ référence vers purchases / sales / orders) ; prealertes_stock → products ; categories → categories (parent)"],
    ["Achats", "purchases → products, suppliers ; supplier_payments → purchases ; supplier_invoices → suppliers ; supplier_invoice_items → supplier_invoices, products ; suppliers → categories (type de fournisseur)"],
    ["Ventes et encaissements", "sales → products, clients (lignes regroupées par ticket_id) ; payments → sales OU orders ; refunds → sales OU orders"],
    ["Commandes et livraisons", "orders → clients ; order_items → orders, products ; deliveries → orders (facultatif), clients, compte livreur"],
    ["Devis et documents", "quotes → clients (vente_ticket_id = ticket créé à la conversion) ; quote_items → quotes, products ; avoirs → clients (+ ticket annulé) ; avoir_items → avoirs, products ; document_emissions, document_envois → pièce source (entite, entite_id)"],
    ["Argent", "capital_apports → stores ; expenses → categories (poste), providers, profiles (membre), personnes_externes ; notes_de_frais → categories, profiles, personnes_externes, expenses (dépense créée au remboursement) ; remises_vendeur → stores"],
    ["Paie", "salaires → profiles (compte facultatif, clé sur le nom de l'employé) ; paiements_salaire → profiles"],
    ["Organisation", "taches (sans clé étrangère vers les comptes) ; evenements ; evenement_participants → evenements ; rappels → evenements, taches"],
    ["Tiers", "clients, suppliers, providers, provider_services → providers ; personnes_externes → profiles (si la personne a rejoint l'équipe) ; custom_field_definitions (champs des fiches)"],
    ["Devises et réglages", "devises_boutique, historique_taux, parametres_boutique, reglages_alertes_stock, abonnements_alertes_stock → stores ; store_counters → stores"],
    ["Import et IA", "imports_donnees → stores, profiles ; ia_reglages_boutique → stores ; ia_consommation → stores, profiles ; ia_actions → stores, profiles, ia_consommation ; ia_reglages_plateforme, ia_tarifs (plateforme)"],
    ["Plateforme", "access_codes → stores, profiles ; activations_de_compte → profiles ; branding → stores ; custom_domains → stores ; proprietaires_de_marque → branding ; stores → branding (marque)"],
  ], [2, 8.5]]);
  add(["p", "Un schéma au format Mermaid (diagramme entité-relation) est fourni dans le fichier complémentaire **schema-relationnel.md** du même dossier."]);
  add(["h2", "7.3 Tables métier"]);
  parCat("M").forEach((t) => add(...sectionTable(t)));
  add(["h2", "7.4 Tables de liaison et de détail"]);
  parCat("L").forEach((t) => add(...sectionTable(t)));
  add(["h2", "7.5 Tables techniques"]);
  parCat("T").forEach((t) => add(...sectionTable(t)));
  add(["h2", "7.6 Tables de la plateforme (administration, marque blanche)"]);
  add(["p", "Ces tables ne sont pas utilisées dans le travail quotidien de la boutique. Elles servent à l'administration de la plateforme (codes d'activation, marque blanche, habillage du tableau de bord)."]);
  parCat("P").forEach((t) => add(...sectionTable(t)));
  add(["h2", "7.7 Fonctions serveur (RPC) et règles automatiques"]);
  add(["t", ["Fonction", "Utilisée par", "Rôle fonctionnel"], [
    ["create_product / update_product / delete_products", "Produits", "Crée, modifie, supprime des produits ; trace le stock initial"],
    ["add_purchase / modifier_achat / delete_purchase", "Achats", "Enregistre l'achat, augmente le stock, crée le produit si besoin, gère l'acompte ; corrige ou annule en ajustant le stock"],
    ["create_sale_ticket / create_sale", "Ventes, Facturation", "Enregistre un panier : contrôle du stock disponible, sortie de stock, répartition du paiement sur les lignes"],
    ["update_sale_quantity / delete_sale", "Ventes", "Modifie une vente ou la supprime (stock restitué ; refus si paiement existant)"],
    ["create_order_with_items / set_order_status / delete_order", "Commandes", "Crée la commande et réserve le stock ; livraison (sortie de stock) ; annulation (libération et remboursement)"],
    ["add_payment", "Paiements à recevoir, Commandes, Facturation", "Enregistre un encaissement sur une vente ou une commande (contrôle du reste à payer)"],
    ["refund_sale / refund_order", "Facturation (avoirs), Commandes", "Enregistre un remboursement dans la limite de ce qui a été encaissé"],
    ["ajuster_stock", "Produits, Facturation", "Correction de stock tracée (refus si stock négatif ou sous le réservé)"],
    ["create_quote / update_quote / set_quote_status", "Devis", "Gestion des devis et proformas"],
    ["create_supplier_invoice / update_supplier_invoice", "Factures reçues", "Enregistrement des factures fournisseurs"],
    ["creer_avoir", "Facturation", "Création d'un avoir et de ses lignes"],
    ["fixer_commission_de_vente", "Ventes, Facturation", "Fixe la commission de la boutique sur une vente"],
    ["remettre_argent_livraisons / avancer_livraison", "Livraisons, Espace livreur", "Fait avancer une course ; enregistre l'argent rapporté (paiement si la course est liée à une pièce)"],
    ["decider_note_de_frais / rembourser_note_de_frais", "Notes de frais", "Validation / refus ; remboursement avec création de la dépense"],
    ["definir_devise_principale / appliquer_taux_automatiques", "Réglages métier", "Devise de tenue et mise à jour des taux"],
    ["redeem_access_code / activate_store_with_code / activer_le_compte", "Activation", "Activation du compte par code"],
    ["transferer_boutique / copy_store", "Paramètres › Équipe, Espaces de travail", "Transmettre la boutique à un membre ; dupliquer une boutique"],
    ["prochain_numero_de_document / next_store_counter", "Toutes les pièces", "Numérotation séquentielle par boutique"],
  ], [3.2, 2.6, 4.7]]);
  add(["h2", "7.8 Valeurs codées"]);
  add(["t", ["Colonne", "Valeurs possibles"], [
    ["orders.statut_commande", "en_attente (En attente), en_cours (En cours), livre (Livré), annule (Annulé)"],
    ["orders.statut_paiement", "impaye, partiel, paye"],
    ["sales.statut_credit", "Payé, Partiel, Impayé"],
    ["purchases.statut_paiement (calculé)", "paye, partiel, impaye"],
    ["payments.methode / supplier_payments.methode", "especes (Espèces), mobile_money (Mobile Money), virement (Virement)"],
    ["stock_movements.type_mouvement", "achat, achat_modification, achat_suppression, vente, vente_modification, vente_suppression, commande_reservation, commande_liberation, commande_livraison, commande_annulation_apres_livraison, ajustement"],
    ["products.type_produit", "revendu, service, fabrique"],
    ["quotes.type / quotes.statut", "devis, proforma / brouillon, envoye, accepte, refuse"],
    ["deliveries.statut", "a_faire, en_cours, livree, echouee, annulee"],
    ["notes_de_frais.statut", "a_valider, validee, refusee, remboursee"],
    ["paiements_salaire.type / statut", "avance, solde / en_attente, approuvee, refusee, versee, annulee"],
    ["taches.priorite / statut", "basse, moyenne, haute, urgente / a_faire, en_cours, termine"],
    ["evenements.nature / visibilite", "rendez_vous, reunion, evenement, autre / prive, equipe, choisis"],
    ["rappels.recurrence", "aucune, quotidien, hebdomadaire, mensuel"],
    ["categories.usage", "produit, depense, type_fournisseur"],
    ["clients.type_client", "particulier, entreprise, revendeur"],
    ["stores.activation_status", "trial (essai), active, locked (verrouillée)"],
    ["custom_field_definitions.type", "texte, texte_long, nombre, date, booleen, liste"],
  ], [3.3, 7.2]]);
  add(["pb"]);
  return blocs;
}

// ── Import, annexes ─────────────────────────────────────────────────
const IMPORT = [
  ["h1", "8. Import automatique de données"],
  ["h2", "8.1 Ce que l'application permet d'importer"],
  ["p", "Depuis le 16 octobre 2026, un **assistant d'import** commun est proposé par le bouton **Importer** des écrans Produits, Clients, Fournisseurs et Achats. Un même fichier peut alimenter plusieurs modules : chaque feuille Excel (ou chaque tableau Word) reçoit sa propre destination. Rien n'est enregistré avant la confirmation."],
  ["t", ["Contenu reconnu", "Module", "Ce qui est enregistré", "Colonnes obligatoires"], [
    ["Produits (désignation avec un prix ou une quantité)", "Produits et stock", "Une fiche produit par ligne ; la quantité devient le **stock initial** (mouvement « stock initial »)", "Désignation"],
    ["Clients", "Clients", "Une fiche client par ligne", "Nom"],
    ["Fournisseurs", "Fournisseurs", "Une fiche fournisseur par ligne", "Nom"],
    ["Achats (date, produit, quantité, prix d'achat)", "Achats et stock", "Un achat par ligne : entrée en stock, produit créé s'il n'existe pas ; sans « Montant payé », l'achat est réglé comptant et la trésorerie diminue", "Date, Produit, Quantité, Prix d'achat unitaire"],
    ["Ventes passées", "—", "**Refusées** : elles feraient sortir du stock et entrer de l'argent aujourd'hui pour des opérations anciennes", "—"],
  ], [2.6, 1.6, 4.3, 2]],
  ["p", "Les **listes** (catégories de produits, postes de dépenses, types de fournisseur) gardent leur propre import, plus simple : Paramètres › Listes › **Importer une liste** (voir § 8.5)."],
  ["h2", "8.2 Fichiers acceptés et lecture"],
  ["ul", [
    "**Excel** (.xlsx, .xls, .ods), **CSV** (.csv, .txt, .tsv) et **Word** (.docx, ses tableaux) sont lus directement dans le navigateur, sans IA. Taille maximale : 15 Mo ; 5 000 lignes au plus par tableau.",
    "**PDF et images** demandent l'extraction par IA, **éteinte par défaut** : tant que l'administrateur ne l'a pas activée, l'écran invite à convertir le document en Excel ou CSV.",
    "**Une ligne d'en-tête est attendue.** C'est la première ligne qui a au moins deux cellules remplies : un titre seul au-dessus est ignoré. Les en-têtes sont reconnus sans tenir compte des accents ni des majuscules, avec leurs synonymes courants (« Qté », « PU », « Libellé », « Tél »…).",
    "**Destination** : devinée d'après les en-têtes, le nom de la feuille et celui du fichier. Quand deux destinations restent possibles, l'écran demande (« À préciser »). Chaque tableau peut aussi être écarté : « Ne pas importer ce tableau ».",
    "**Colonnes** : rapprochées automatiquement et modifiables une à une (« — Ignorer — » pour en écarter une). Un tableau ne peut pas être importé tant qu'une colonne obligatoire n'est pas choisie.",
    "**Feuilles vides** : une feuille sans ligne de données est ignorée. Les nombres acceptent les espaces et la virgule décimale ; les téléphones gardent leur 0 initial.",
    "**Droits** : chaque destination demande le droit « créer » du module concerné (le propriétaire a tous les droits). Une destination non autorisée est signalée et ne s'importe pas.",
  ]],
  ["h2", "8.3 Aperçu, doublons et options"],
  ["ul", [
    "**Aperçu** de chaque destination avant la confirmation : nouvelles lignes, lignes déjà présentes, doublons, rejets avec leur motif (200 premières lignes affichées, toutes traitées).",
    "**Doublons dans le fichier** : ignorés.",
    "**Déjà en base** : ignorés, ou **mis à jour** au choix ; une case vide du fichier n'efface rien.",
    "**Stock des produits existants** : réaligné sur le fichier seulement si l'option « Aligner le stock… » est cochée, par un ajustement d'inventaire tracé.",
    "**Fournisseurs cités** par des produits ou des achats : créés au passage (option cochée par défaut).",
    "**Achats** : une case « Je confirme que ces achats ont réellement eu lieu… » doit être cochée, car ils modifient le stock et la trésorerie.",
    "**Reprise** : relancer le même fichier ne recrée rien. Un import interrompu s'arrête proprement ; ce qui a été enregistré reste enregistré.",
    "**Bilan** par module : ajoutés, mis à jour, ignorés, rejetés ; rejets téléchargeables. Les imports restent consultables dans **Imports récents** (table imports_donnees, § 7.5).",
    "**Champs personnalisés obligatoires** : non renseignés par l'import ; à compléter ensuite dans chaque fiche si nécessaire.",
  ]],
  ["h2", "8.4 Modèle Excel fourni"],
  ["p", "Le fichier **Modele_import_Tantana_Suite.xlsx** (même dossier que ce manuel) s'importe **tel quel**, sans conversion. Il contient une feuille **Lisez-moi**, ignorée par l'import, et une feuille par destination : **Produits**, **Clients**, **Fournisseurs**, **Achats**. Chaque feuille porte une consigne en ligne 1 et les en-têtes en ligne 2 ; les notes des en-têtes donnent des exemples. Procédure : remplir les feuilles utiles à partir de la ligne 3, enregistrer, puis **Importer** depuis l'un des quatre écrans. Les feuilles laissées vides sont ignorées."],
  ["h2", "8.5 Import d'une liste"],
  ["ul", [
    "**Où** : Paramètres › Listes, après avoir choisi la liste (catégories de produits, postes de dépenses ou types de fournisseur), **Importer une liste** (propriétaire).",
    "**Fichier** : texte ou CSV, **une valeur par ligne, sans ligne d'en-tête** (elle deviendrait une valeur). Seule la première colonne est lue. Encodage UTF-8.",
    "**Doublons** : une valeur équivalente à une valeur existante de la liste (active ou archivée) est ignorée. Les valeurs sont ajoutées au premier niveau.",
    "Les valeurs de liste se créent aussi directement depuis les champs des formulaires (« + Ajouter »), sans quitter la fiche en cours.",
  ]],
  ["h2", "8.6 Données non importables"],
  ["p", "Les ventes, les paiements, les commandes, les devis et les prestataires se saisissent dans leurs écrans (voir § 2 et § 5)."],
  ["pb"],
  ["h1", "9. Annexes"],
  ["h2", "9.1 Glossaire"],
  ["t", ["Terme", "Définition dans Tantana Suite"], [
    ["Boutique / espace de travail", "Ensemble des données d'un commerce. Un compte peut en avoir plusieurs."],
    ["Stock actuel", "Unités physiquement présentes."],
    ["Stock réservé", "Unités promises à des commandes non livrées."],
    ["Stock disponible", "Stock actuel − stock réservé : ce qui peut être vendu."],
    ["Seuil d'alerte", "Niveau à partir duquel le produit est signalé « stock bas »."],
    ["Ticket", "Ensemble des lignes d'une même vente (panier)."],
    ["Vente à crédit", "Vente dont le montant payé est inférieur au total ; le reste apparaît dans Paiements à recevoir."],
    ["Achat à crédit", "Achat non entièrement réglé ; le reste dû apparaît dans la fiche du fournisseur."],
    ["Avoir", "Document qui annule tout ou partie d'une facture."],
    ["Proforma", "Facture provisoire donnant un prix ferme avant la commande."],
    ["Remise (vendeur)", "Argent qu'un vendeur rend à la caisse."],
    ["Net en poche", "Argent qu'un vendeur détient encore pour la boutique."],
    ["Apport", "Argent injecté dans la caisse (associé, prêt, réserve)."],
    ["Portée", "Étendue des données visibles : ses propres données ou toute la boutique."],
    ["Personne hors équipe", "Contact (vendeur occasionnel, chauffeur…) sans compte d'accès."],
  ], [2.6, 7.9]],
  ["h2", "9.2 Points restant à confirmer"],
  ["ol", [
    "Calcul de la trésorerie : le total des achats est déduit même pour la part achetée à crédit, et les versements de salaire n'y figurent pas (§ 2.2).",
    "Commandes : le champ « Statut initial » n'est pas pris en compte à la création (§ 4.4).",
    "Livraisons : absence, dans l'écran, du rattachement d'une course à une commande ou à une vente ; traitement de l'argent rendu pour une course non rattachée (§ 4.9).",
    "Permissions : niveau de contrôle côté base pour chaque module (§ 1.5).",
    "Activation : tarifs, durée et modalités de paiement de l'abonnement (§ 1.4.5).",
    "Import : l'extraction par IA (PDF, images) est éteinte par défaut ; son activation, ses tarifs et ses plafonds relèvent de l'administrateur de la plateforme (§ 8.2).",
  ]],
  ["h2", "9.3 Sources utilisées"],
  ["p", "Ce manuel a été établi à partir du code source de l'application (écrans, formulaires, règles de validation, navigation, permissions) et du schéma de la base de données de production consulté en lecture seule (tables, colonnes, contraintes, déclencheurs, fonctions). Aucune donnée de production n'a été modifiée. Version du code : branche main, 17 octobre 2026. Les écrans en images figurent dans le Guide illustré (PDF) du même dossier."],
];

// ── Assemblage ─────────────────────────────────────────────────────
const contenu = [...require("./c1"), ...require("./c2"), ...require("./c3")];
const corps = [];
contenu.forEach((b) => corps.push(...bloc(b)));
corps.push(...modeleDeDonnees());
IMPORT.forEach((b) => corps.push(...bloc(b)));

const titre = [
  new Paragraph({ spacing: { before: 2600, after: 200 }, children: [new TextRun({ text: "TANTANA SUITE", bold: true, size: 64, color: VERT })] }),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Manuel d'utilisation", size: 44 })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERT, space: 6 } }, spacing: { after: 400 }, children: [new TextRun({ text: "Gestion commerciale, stock, ventes, achats et trésorerie", size: 26, color: GRIS })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Contenu : présentation, ordre de saisie, liste et architecture des écrans, procédures pas à pas, erreurs fréquentes, modèle de données, import automatique.", size: 22 })] }),
  new Paragraph({ spacing: { before: 1800, after: 60 }, children: [new TextRun({ text: "Version 1.1 — 17 octobre 2026", size: 22, color: GRIS })] }),
  new Paragraph({ children: [new TextRun({ text: "Document destiné aux utilisateurs de l'application", size: 22, color: GRIS })] }),
];

const doc = new Document({
  creator: "Tantana Suite",
  title: "Tantana Suite — Manuel d'utilisation",
  description: "Manuel d'utilisation complet de Tantana Suite",
  
  styles: {
    default: { document: { run: { font: "Calibri", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 34, bold: true, color: VERT, font: "Calibri" }, paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 27, bold: true, color: "1F2D27", font: "Calibri" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: VERT, font: "Calibri" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "puces", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }] },
      { reference: "etapes", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] },
    ],
  },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: titre },
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "C9D3CE", space: 4 } }, children: [new TextRun({ text: "Tantana Suite — Manuel d'utilisation", size: 17, color: GRIS })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Page ", size: 17, color: GRIS }), new TextRun({ children: [PageNumber.CURRENT], size: 17, color: GRIS }), new TextRun({ text: " / ", size: 17, color: GRIS }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: GRIS })] })] }) },
      children: [
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Table des matières", bold: true, size: 34, color: VERT })] }),
        new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new TextRun({ text: "Si la table des matières est vide, faites un clic droit dessus puis « Mettre à jour les champs ».", italics: true, size: 18, color: GRIS })] }),
        new Paragraph({ children: [new PageBreak()] }),
        ...corps,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK", OUT, buf.length, "octets");
});

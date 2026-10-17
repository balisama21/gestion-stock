// Génère le livre illustré (HTML paginé A4) à partir des captures.
const fs = require("fs");
const path = require("path");
const K = process.env.MARQUE === "kinvest";
const OUT = K ? path.join(__dirname, "..", "livre-k") : __dirname;
const DIMS = JSON.parse(fs.readFileSync(path.join(OUT, "dims.json"), "utf8").replace(/^﻿/, ""));
const LOGO = K ? '<span class="mono">K</span>' : '<img src="img/logo.svg" alt="" class="logo">';

// ── Outils ──────────────────────────────────────────────────────────
const md = (t) => String(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Capture annotée : pins en pixels de l'image d'origine (avant recadrage). */
function capture(nom, pins = [], opts = {}) {
  const [cx, cy, cw, ch] = DIMS[nom];
  const pts = pins.map(([n, x, y]) => {
    const l = ((x - cx) / cw) * 100, t = ((y - cy) / ch) * 100;
    return `<span class="pin" style="left:${l.toFixed(2)}%;top:${t.toFixed(2)}%">${n}</span>`;
  }).join("");
  const style = opts.w ? `style="width:${opts.w}"` : "";
  return `<figure class="cap ${opts.cls ?? ""}" ${style}><div class="cadre"><img src="img/${nom}.jpg" alt="">${pts}</div>${opts.legende ? `<figcaption>${md(opts.legende)}</figcaption>` : ""}</figure>`;
}
const legende = (items, cols = 2) => `<ol class="leg" style="columns:${cols}">${items.map((t, i) => `<li><span class="num">${i + 1}</span><span>${md(t)}</span></li>`).join("")}</ol>`;
const note = (type, titre, texte) => `<div class="note ${type}"><div class="ico">${{ astuce: "✓", attention: "!", info: "i", confirmer: "?" }[type]}</div><div><b>${titre}</b><br>${md(texte)}</div></div>`;
const etapes = (items) => `<ol class="etapes">${items.map((t, i) => `<li><span class="rond">${i + 1}</span><div>${md(t)}</div></li>`).join("")}</ol>`;
const bandeau = (num, titre, sous, ill) => `<div class="bandeau"><div class="chnum">${num}</div><div class="chtxt"><div class="chap">Chapitre ${num}</div><h1>${titre}</h1><p>${sous}</p></div>${ill ? `<img class="ill" src="img/${ill}" alt="">` : ""}</div>`;
const tableau = (entetes, lignes, cls = "") => `<table class="tab ${cls}"><thead><tr>${entetes.map((e) => `<th>${e}</th>`).join("")}</tr></thead><tbody>${lignes.map((l) => `<tr>${l.map((c) => `<td>${md(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

// ── Schémas SVG (boîtes arrondies + flèches) ───────────────────────
const DEFS = `<defs><marker id="fl" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5f6b66"/></marker><marker id="flv" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0e7a57"/></marker><marker id="flr" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker><filter id="omb" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0b3d2c" flood-opacity="0.14"/></filter></defs>`;
const THEMES = { v: ["#e8f3ee", "#0e7a57", "#0b5c42"], a: ["#fdf3e1", "#e9a23b", "#8a5a12"], r: ["#fbe9e7", "#d9534f", "#8e2a26"], b: ["#e8f0fb", "#3b7dd8", "#1f4f8f"], g: ["#f1f3f2", "#9aa6a1", "#33403a"], p: ["#f3ecf8", "#8a4baf", "#5b2f75"], f: ["#0e7a57", "#0e7a57", "#ffffff"] };
function boite(x, y, w, h, texte, th = "v", sous = "") {
  const [fond, bord, encre] = THEMES[th];
  const lignes = texte.split("|");
  const y0 = y + h / 2 - (lignes.length - 1) * 8 - (sous ? 7 : 0);
  return `<g filter="url(#omb)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(16, h / 2)}" fill="${fond}" stroke="${bord}" stroke-width="1.6"/></g>` +
    lignes.map((l, i) => `<text x="${x + w / 2}" y="${y0 + i * 16 + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="${encre}">${esc(l)}</text>`).join("") +
    (sous ? `<text x="${x + w / 2}" y="${y0 + lignes.length * 16 + 4}" text-anchor="middle" font-size="10.5" fill="${th === "f" ? "#d6efe4" : "#5f6b66"}">${esc(sous)}</text>` : "");
}
const fleche = (d, c = "", lab = "", lx = 0, ly = 0) => `<path d="${d}" fill="none" stroke="${c === "v" ? "#0e7a57" : c === "r" ? "#c0392b" : "#5f6b66"}" stroke-width="2" ${c === "p" ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#${c === "v" ? "flv" : c === "r" ? "flr" : "fl"})"/>` + (lab ? `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="10.5" fill="#33403a" font-style="italic">${esc(lab)}</text>` : "");
const svg = (w, h, contenu) => `<svg class="schema" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${DEFS}${contenu}</svg>`;
const pastille = (x, y, n, c = "#0e7a57") => `<circle cx="${x}" cy="${y}" r="11" fill="${c}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${n}</text>`;

// Cycle de l'activité
const cycle = (() => {
  const cx = 330, cy = 165, R = 120;
  const etapes = [["Acheter", "Achats", "a"], ["Stocker", "Produits", "v"], ["Vendre", "Ventes · Commandes", "b"], ["Encaisser", "Paiements · Facturation", "v"], ["Piloter", "Tableau de bord · Bilan", "p"]];
  let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#cfe3da" stroke-width="18"/>`;
  const pos = etapes.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / etapes.length; return [cx + R * Math.cos(a), cy + R * Math.sin(a), a]; });
  pos.forEach(([x, y, a], i) => {
    const a2 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / etapes.length;
    const m1 = a + 0.36, m2 = a2 - 0.36;
    s += `<path d="M${cx + R * Math.cos(m1)},${cy + R * Math.sin(m1)} A${R},${R} 0 0 1 ${cx + R * Math.cos(m2)},${cy + R * Math.sin(m2)}" fill="none" stroke="#0e7a57" stroke-width="2.4" marker-end="url(#flv)"/>`;
  });
  pos.forEach(([x, y], i) => { s += boite(x - 70, y - 24, 140, 48, etapes[i][0], etapes[i][2], etapes[i][1]); });
  s += `<circle cx="${cx}" cy="${cy}" r="58" fill="#0e7a57"/>${K ? `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="17" font-weight="800" fill="#fff">Kinvest</text>` : `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">Tantana</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="12" fill="#d6efe4">Suite</text>`}`;
  return svg(660, 330, s);
})();

// Ordre de saisie en serpentin
const serpentin = (() => {
  const items = [
    ["Compte", "S'inscrire", "g"], ["Boutique", "Créer ma boutique", "g"], ["Ma boutique", "identité, devise", "v"], ["Capital", "capital initial", "v"],
    ["Listes & équipe", "facultatif", "p"], ["Fournisseurs", "fiches ou import", "a"], ["Produits", "catalogue + stock", "a"], ["Achats", "réassort", "a"],
    ["Clients", "fiches", "b"], ["Ventes", "caisse, panier", "b"], ["Commandes", "réservation", "b"], ["Paiements", "encaisser les restes", "v"],
  ];
  let s = ""; const W = 150, H = 54, gx = 34, gy = 46, x0 = 14, y0 = 14;
  items.forEach(([t, st, th], i) => {
    const row = Math.floor(i / 4), col = row % 2 === 0 ? i % 4 : 3 - (i % 4);
    const x = x0 + col * (W + gx), y = y0 + row * (H + gy);
    s += boite(x, y, W, H, t, th, st) + pastille(x + 6, y + 6, i + 1, "#0b3d2c");
    if (i < items.length - 1) {
      const nrow = Math.floor((i + 1) / 4);
      if (nrow === row) { const dir = row % 2 === 0 ? 1 : -1; const xa = dir > 0 ? x + W + 2 : x - 2; s += fleche(`M${xa},${y + H / 2} L${xa + dir * (gx - 6)},${y + H / 2}`, "v"); }
      else s += fleche(`M${x + W / 2},${y + H + 2} L${x + W / 2},${y + H + gy - 6}`, "v");
    }
  });
  return svg(14 * 2 + 4 * W + 3 * gx, y0 * 2 + 3 * H + 2 * gy, s);
})();

const schemaAchat = svg(660, 230,
  boite(250, 85, 160, 60, "Nouvel achat", "f", "Enregistrer l'achat") +
  boite(20, 10, 180, 56, "Stock + quantité", "v", "Produits") + fleche("M250,100 C220,90 220,60 202,46", "v") +
  boite(20, 160, 180, 56, "Trésorerie −", "r", "Capital (total de l'achat)") + fleche("M250,130 C220,145 220,175 202,186", "r") +
  boite(460, 10, 180, 56, "Règlement fournisseur", "a", "automatique si comptant") + fleche("M410,100 C440,90 440,60 458,46") +
  boite(460, 160, 180, 56, "Reste dû", "a", "si achat à crédit") + fleche("M410,130 C440,145 440,175 458,186", "p") +
  `<text x="330" y="175" text-anchor="middle" font-size="10.5" fill="#5f6b66">+ mouvement de stock « achat »</text>`);

const schemaVente = svg(680, 250,
  boite(10, 20, 130, 56, "Panier", "b", "produits + quantités") + fleche("M142,48 L186,48", "v") +
  boite(190, 20, 140, 56, "Valider la vente", "f", "") + fleche("M332,48 L376,48", "v") +
  boite(380, 20, 130, 56, "Reçu / ticket", "v", "imprimer, PDF") +
  boite(190, 150, 140, 56, "Payé en totalité", "v", "statut Payé") + fleche("M245,78 L245,146", "v") +
  boite(380, 150, 140, 56, "Paiement partiel", "a", "statut Partiel / Impayé") + fleche("M300,78 C330,110 420,110 440,146", "") +
  boite(545, 150, 125, 56, "Paiements|à recevoir", "r", "") + fleche("M522,178 L541,178", "r") +
  fleche("M607,148 C607,90 560,70 514,56", "p", "Recevoir le solde", 610, 100) +
  `<text x="80" y="110" text-anchor="middle" font-size="10.5" fill="#5f6b66">stock disponible</text><text x="80" y="124" text-anchor="middle" font-size="10.5" fill="#5f6b66">vérifié à chaque ligne</text>`);

const schemaCommande = svg(680, 260,
  boite(20, 100, 150, 60, "En attente", "a", "stock réservé") +
  boite(260, 20, 150, 60, "En cours", "b", "préparation") +
  boite(500, 100, 160, 60, "Livré", "v", "stock sorti") +
  boite(260, 190, 150, 60, "Annulé", "r", "réservation libérée") +
  fleche("M172,115 C210,80 220,60 256,52", "", "", 0, 0) +
  fleche("M412,52 C460,60 480,80 498,112", "v", "Marquer livré", 470, 62) +
  fleche("M172,128 L496,128", "v", "Marquer livré", 335, 122) +
  fleche("M95,162 C110,215 200,222 256,220", "r", "Annuler", 150, 238) +
  fleche("M580,162 C570,215 470,222 414,220", "r", "Annuler (stock restitué)", 540, 250) +
  `<text x="95" y="84" text-anchor="middle" font-size="10.5" fill="#5f6b66">à la création</text>`);

const schemaStock = svg(660, 150,
  boite(10, 45, 170, 60, "Stock actuel", "v", "en rayon") + `<text x="200" y="83" font-size="26" font-weight="800" fill="#33403a">−</text>` +
  boite(225, 45, 170, 60, "Stock réservé", "a", "commandes non livrées") + `<text x="413" y="83" font-size="26" font-weight="800" fill="#33403a">=</text>` +
  boite(445, 45, 200, 60, "Stock disponible", "f", "ce qui peut être vendu"));

const schemaTreso = svg(680, 200, (() => {
  const plus = [["Capital initial", 140], ["Apports", 110], ["Encaissements", 150]], moins = [["Achats", 120], ["Dépenses", 120], ["Remboursements", 160]];
  let s = "", x = 10;
  plus.forEach(([t, w]) => { s += boite(x, 20, w, 50, t, "v", "+") ; x += w + 8; });
  x = 10; moins.forEach(([t, w]) => { s += boite(x, 120, w, 50, t, "r", "−"); x += w + 8; });
  s += fleche("M430,45 C470,45 480,85 498,90", "v") + fleche("M434,145 C470,145 480,115 498,108", "r");
  s += boite(502, 70, 168, 58, "Trésorerie", "f", "écran Capital");
  return s;
})());

const schemaDocs = svg(680, 210,
  boite(10, 20, 120, 54, "Devis", "p", "ou proforma") + fleche("M132,47 L170,47", "") +
  boite(174, 20, 120, 54, "Accepté", "v", "") + fleche("M296,47 L334,47", "v", "Convertir", 315, 12) +
  boite(338, 20, 140, 54, "Facture", "f", "= une vente") + fleche("M480,47 L518,47", "") +
  boite(522, 20, 148, 54, "Payée", "v", "paiements enregistrés") +
  boite(338, 135, 140, 54, "Avoir", "r", "annule / rembourse") + fleche("M408,76 L408,131", "r", "Annuler par un avoir", 470, 108) +
  boite(10, 135, 150, 54, "Envoyer", "b", "WhatsApp · e-mail") + fleche("M336,62 C250,110 200,130 162,150", "p"));

const schemaNotes = svg(680, 120,
  boite(10, 30, 130, 54, "Déclarée", "g", "à valider") + fleche("M142,57 L182,57") +
  boite(186, 30, 130, 54, "Validée", "v", "") + fleche("M318,57 L358,57", "v") +
  boite(362, 30, 150, 54, "Remboursée", "f", "dépense créée") +
  boite(540, 30, 130, 54, "Refusée", "r", "motif visible") + fleche("M150,40 C300,0 470,0 560,28", "r"));

const schemaLivraison = svg(680, 120,
  boite(10, 30, 120, 54, "À faire", "g", "") + fleche("M132,57 L168,57", "", "Je pars avec", 150, 20) +
  boite(172, 30, 120, 54, "En cours", "b", "") + fleche("M294,57 L330,57", "v", "Colis remis", 312, 20) +
  boite(334, 30, 120, 54, "Livrée", "v", "argent encaissé") + fleche("M456,57 L492,57", "v") +
  boite(496, 30, 174, 54, "Argent rendu", "f", "remis à la boutique") +
  `<path d="M232,86 C232,110 260,112 280,112" fill="none" stroke="#c0392b" stroke-width="2" marker-end="url(#flr)"/><text x="335" y="115" font-size="11" fill="#8e2a26">Échouée (motif)</text>`);

const schemaJournee = svg(680, 150,
  boite(10, 40, 200, 70, "Le matin", "a", "Tableau de bord · alertes · tâches") + fleche("M212,75 L246,75", "v") +
  boite(250, 40, 200, 70, "Dans la journée", "b", "Ventes · commandes · achats") + fleche("M452,75 L486,75", "v") +
  boite(490, 40, 180, 70, "Le soir", "p", "Remises · Historique · caisse") +
  `<text x="110" y="28" text-anchor="middle" font-size="22">☀</text><text x="350" y="28" text-anchor="middle" font-size="22">◐</text><text x="580" y="28" text-anchor="middle" font-size="22">☾</text>`);
const schemaDette = svg(680, 120,
  boite(10, 30, 140, 56, "Achat à crédit", "a", "acompte éventuel") + fleche("M152,58 L188,58", "") +
  boite(192, 30, 120, 56, "Reste dû", "r", "fiche fournisseur") + fleche("M314,58 L350,58", "v", "Règlement", 332, 20) +
  boite(354, 30, 120, 56, "Partiel", "a", "reste diminue") + fleche("M476,58 L512,58", "v", "Règlement", 494, 20) +
  boite(516, 30, 154, 56, "Réglé", "f", "pastille verte"));
const schemaSalaire = svg(680, 120,
  boite(10, 30, 150, 56, "Demande d'avance", "g", "depuis Ma paie") + fleche("M162,58 L198,58") +
  boite(202, 30, 130, 56, "Approuvée", "v", "par le responsable") + fleche("M334,58 L370,58", "v", "Verser", 352, 20) +
  boite(374, 30, 130, 56, "Versée", "f", "imputée sur le mois") +
  boite(540, 30, 130, 56, "Refusée", "r", "motif visible") + fleche("M150,40 C300,0 470,0 560,28", "r"));
const schemaImport = svg(680, 130,
  boite(10, 35, 140, 60, "Modèle Excel", "v", "une feuille par module") + fleche("M152,65 L190,65", "v", ".xlsx tel quel", 171, 26) +
  boite(194, 35, 140, 60, "Importer", "f", "Produits · Clients…") + fleche("M336,65 L374,65", "v") +
  boite(378, 35, 130, 60, "Aperçu", "a", "destination, colonnes") + fleche("M510,65 L548,65", "v", "Confirmer", 529, 26) +
  boite(552, 35, 118, 60, "Bilan", "a", "ajoutés / mis à jour"));

const schemaDonnees = svg(680, 330,
  boite(270, 10, 140, 46, "stores", "f", "la boutique") +
  boite(20, 100, 130, 46, "suppliers", "a", "fournisseurs") + boite(185, 100, 130, 46, "products", "v", "produits") + boite(360, 100, 130, 46, "clients", "b", "clients") + boite(525, 100, 135, 46, "store_members", "g", "équipe") +
  boite(20, 200, 130, 46, "purchases", "a", "achats") + boite(185, 200, 130, 46, "stock_movements", "g", "mouvements") + boite(360, 200, 130, 46, "sales", "b", "ventes") + boite(525, 200, 135, 46, "orders", "b", "commandes") +
  boite(20, 280, 130, 44, "supplier_payments", "a", "") + boite(360, 280, 130, 44, "payments", "v", "encaissements") + boite(525, 280, 135, 44, "order_items", "b", "lignes") +
  fleche("M85,148 L85,196", "") + fleche("M150,123 L181,123", "") + fleche("M200,148 C150,170 120,185 110,196", "") + fleche("M250,148 L250,196", "") + fleche("M290,148 C340,170 380,180 400,196", "") +
  fleche("M425,148 L425,196", "") + fleche("M470,148 C520,170 560,180 580,196", "") + fleche("M85,248 L85,276", "") + fleche("M425,248 L425,276", "") + fleche("M592,248 L592,276", "") + fleche("M560,248 C520,270 500,280 494,290", "p") +
  `<line x1="340" y1="58" x2="340" y2="80" stroke="#0e7a57" stroke-width="2"/><line x1="85" y1="80" x2="592" y2="80" stroke="#0e7a57" stroke-width="2"/>` + [85, 250, 425, 592].map((x) => `<line x1="${x}" y1="80" x2="${x}" y2="96" stroke="#0e7a57" stroke-width="2" marker-end="url(#flv)"/>`).join(""));

// ── Pages ──────────────────────────────────────────────────────────
const pages = [];
const page = (toc, html, cls = "") => pages.push({ toc, html, cls });

// Couverture
pages.push({ cls: "couverture", html: `
  <div class="rond1"></div><div class="rond2"></div>
  <div class="cv-haut">${LOGO}<span>Tantana Suite</span></div>
  <div class="cv-titre"><div class="sur">Le guide illustré</div><h1>Manuel d'utilisation</h1><p>Stock, ventes, achats, clients, facturation et trésorerie — pas à pas, en images.</p></div>
  <div class="cv-cartes">
    ${capture("dash-haut", [], { cls: "cv1" })}
    ${capture("ventes-nouvelle", [], { cls: "cv2" })}
  </div>
  <div class="cv-bas">Version 1.1 · 17 octobre 2026 · Captures réalisées sur une boutique de démonstration (données fictives)</div>` });

page(null, `<h1 class="titre-p">Sommaire</h1><div id="sommaire"></div>
  <div class="mode">
    <div><span class="pin statique">1</span> Les <b>pastilles numérotées</b> sur les captures renvoient à la légende placée dessous.</div>
    <div><span class="tag-v">Astuce</span> <span class="tag-a">Attention</span> <span class="tag-p">À confirmer</span> Les encadrés de couleur signalent un conseil, un piège ou un point encore à vérifier.</div>
    <div>Les écrans montrés sont les <b>vrais écrans</b> de l'application, remplis avec la boutique fictive « Quincaillerie Démo ».</div>
  </div>`);

// Ch1
page("1. Bienvenue dans Tantana Suite", `${bandeau(1, "Bienvenue dans Tantana Suite", "À quoi sert l'application et comment elle est organisée.", "ill-croissance.png")}
  <p class="intro">Tantana Suite est le cahier de votre boutique, tenu tout seul. Vous enregistrez un achat ou une vente : <b>le stock, la caisse, les créances et le bilan se mettent à jour automatiquement</b>. Tout se fait dans le navigateur, sur ordinateur, tablette ou téléphone.</p>
  <h2>Le cycle de votre activité</h2>
  ${cycle}
  <p class="centre petit">Chaque étape du cycle correspond à un ou plusieurs écrans. Ce livre les suit dans cet ordre.</p>
  <div class="grille3">
    <div class="carte"><img src="img/ill-carton.png" alt=""><h3>Le stock juste</h3><p>Chaque achat ajoute, chaque vente retire, chaque commande réserve.</p></div>
    <div class="carte"><img src="img/ill-portefeuille.png" alt=""><h3>La caisse claire</h3><p>Trésorerie disponible, encaissements, dépenses et restes à payer.</p></div>
    <div class="carte"><img src="img/ill-clients.png" alt=""><h3>L'équipe organisée</h3><p>Rôles, droits, tâches, agenda, rappels et paie.</p></div>
  </div>`);

page("1.1 Se repérer dans un écran", `<h2 class="haut">Se repérer dans un écran</h2>
  <p>Tous les écrans de liste sont construits de la même façon. Une fois celui-ci compris, vous savez lire tous les autres.</p>
  ${capture("produits", [[1, 378, 778], [2, 481, 81], [3, 1814, 81], [4, 464, 243], [5, 475, 443], [6, 1328, 443], [7, 475, 572], [8, 1955, 1172]])}
  ${legende(["**Menu** : six groupes d'écrans (Pilotage, Organisation, Ventes & clients, Stock & achats, Argent, Équipe). Les pastilles rouges signalent ce qui attend.", "**Titre et phrase d'explication** de l'écran.", "**Bouton d'action principal** (créer un élément).", "**Indicateurs** : les chiffres clés de l'écran.", "**Recherche** instantanée.", "**Filtres** rapides (avec leur nombre d'éléments).", "**Ligne de la liste** : cliquez pour ouvrir le détail et les boutons Modifier / Supprimer.", "**Badges d'état** : vert = normal, orange = à surveiller, rouge = problème."])}
  ${note("astuce", "Sur téléphone", "Le menu devient une barre en bas de l'écran : **Accueil, Ventes, Stock, Clients** et le bouton **Plus** pour le reste.")}`);

page("1.2 Le menu", `<h2 class="haut">Le menu, groupe par groupe</h2>
  <div class="menu-page">
    ${capture("sidebar", [], { cls: "etroit" })}
    <div class="groupes">
      <div class="gr g1"><h3>Pilotage</h3><p><b>Tableau de bord</b> · <b>Bilan</b> · <b>Historique</b><br>Suivre l'activité, le résultat et chaque entrée/sortie d'argent.</p></div>
      <div class="gr g2"><h3>Organisation</h3><p><b>Vue d'ensemble</b> · <b>Tâches</b> · <b>Agenda</b> · <b>Rappels</b><br>Une page à onglets : ce que l'équipe doit faire, et quand.</p></div>
      <div class="gr g3"><h3>Ventes & clients</h3><p><b>Ventes</b> · <b>Facturation</b> · <b>Clients</b> · <b>Paiements à recevoir</b> · <b>Devis</b> · <b>Commandes</b> · <b>Livraisons</b><br>Vendre, facturer, encaisser.</p></div>
      <div class="gr g4"><h3>Stock & achats</h3><p><b>Produits</b> · <b>Achats</b> · <b>Fournisseurs</b> · <b>Prestataires</b><br>Le catalogue, le stock et l'approvisionnement.</p></div>
      <div class="gr g5"><h3>Argent</h3><p><b>Capital</b> · <b>Dépenses</b> · <b>Notes de frais</b><br>La trésorerie et les sorties d'argent.</p></div>
      <div class="gr g6"><h3>Équipe</h3><p><b>Vendeurs</b> · <b>Salaires</b><br>L'activité des vendeurs et la paie.</p></div>
      <div class="gr g7"><h3>En haut de l'écran</h3><p>Recherche globale, aide « ? », notifications, <b>Paramètres</b>, changement de boutique.</p></div>
    </div>
  </div>
  ${note("info", "Les écrans se répondent", "Sous le titre de chaque page, une rangée de raccourcis relie les écrans d'un même univers : Ventes ↔ Facturation ↔ Devis ↔ Commandes ↔ Livraisons ; Produits ↔ Achats ↔ Fournisseurs ↔ Prestataires.")}`);

// Ch2
page("2. Premiers pas", `${bandeau(2, "Premiers pas", "Ouvrir l'application, créer son compte et sa boutique.", "ill-feuille.png")}
  ${(K ? capture("accueil", [[1, 1669, 73]], { legende: "La page d'accueil publique de Kinvest. ① Le bouton **Espace équipe** mène au formulaire de connexion." }) : capture("accueil", [[1, 1679, 37]], { legende: "La page d'accueil publique de l'application. ① Le bouton **Se connecter** mène au formulaire de connexion (en bas de page)." }))}
  ${K ? etapes(["Ouvrez l'adresse de Kinvest et cliquez sur **Espace équipe**. Créez votre accès avec **S'inscrire** (nom complet, e-mail, mot de passe de 8 caractères minimum) — ou **Se connecter avec Google**.", "Confirmez votre e-mail si un message vous est envoyé, puis connectez-vous.", "Première connexion : rejoignez votre boutique avec le **lien** ou le **code d'invitation** (INV-XXXX-XXXX) reçu de votre responsable. Seuls les comptes propriétaires Kinvest peuvent **créer une boutique**.", "La boutique est **ouverte en permanence** : pas de période d'essai, pas d'abonnement, pas de code d'activation. Des listes par défaut sont créées automatiquement."]) : etapes(["Ouvrez l'adresse de l'application et choisissez **S'inscrire** : nom complet, e-mail, mot de passe (8 caractères minimum) — ou **Se connecter avec Google**.", "Confirmez votre e-mail si un message vous est envoyé, puis connectez-vous.", "Première connexion : **Créer ma boutique** (nom de la boutique) — ou **J'ai un lien / un code d'invitation** (INV-XXXX-XXXX) si votre employeur vous a invité.", "La boutique démarre en **essai gratuit de 30 jours**. Des listes par défaut sont créées automatiquement."])}`);

page("2.1 Se connecter", `<h2 class="haut">Le formulaire de connexion</h2>
  ${capture("connexion-form", K ? [[1, 1393, 496], [2, 1393, 623], [3, 1375, 684], [4, 1901, 684], [5, 1372, 759], [6, 1372, 919], [7, 1723, 1042]] : [[1, 1393, 483], [2, 1393, 610], [3, 1375, 671], [4, 1901, 671], [5, 1372, 745], [6, 1372, 905], [7, 1723, 1029]])}
  ${legende(["**Adresse e-mail** du compte.", "**Mot de passe** (l'œil permet de l'afficher).", "**Se souvenir de mon adresse** (facultatif).", (K ? "**Mot de passe oublié ?** : vous recevez par e-mail un lien pour choisir un nouveau mot de passe (pensez aux courriers indésirables)." : "**Mot de passe oublié ?** : crée une demande traitée par l'administrateur, qui vous transmet un lien."), "**Se connecter**.", "**Se connecter avec Google** : un compte Google n'a pas de mot de passe.", "**S'inscrire** pour créer un nouveau compte."])}
  <div class="grille2">
    ${K ? note("info", "Pas d'abonnement", "Les boutiques Kinvest sont **ouvertes en permanence** : jamais d'essai, jamais de verrouillage, aucun code d'activation. La rubrique **Abonnement** n'apparaît pas dans les Paramètres.") : note("attention", "Fin de l'essai", "Après 30 jours, la boutique est **verrouillée** (plus aucune écriture). Le propriétaire l'active avec un **code BLSM-XXXX-XXXX** obtenu auprès de l'administrateur (Paramètres › Abonnement). Un code active toutes les boutiques du compte.")}
    ${note("astuce", "Code PIN", "Paramètres › Sécurité : un **code PIN de 4 à 6 chiffres** verrouille la session après 3, 5, 15 ou 30 minutes d'inactivité. « Code PIN oublié ? » le réinitialise avec le mot de passe.")}
  </div>`);

page("2.2 Rôles et droits de l'équipe", `<h2 class="haut">Rôles et droits de l'équipe</h2>
  <p>Le <b>propriétaire</b> voit tout. Il invite ses collaborateurs (Paramètres › Équipe ou Vendeurs › Ajouter un vendeur) en choisissant un <b>rôle</b>, puis peut affiner chaque accès : <b>module visible</b>, <b>portée</b> (ses données ou toute la boutique), <b>actions</b> (créer, modifier, supprimer…) et <b>champs sensibles</b> (prix d'achat, marge…).</p>
  <div class="roles">
    <div class="role r1"><div class="rt">Administrateur</div><p>Accès complet à tous les modules.</p></div>
    <div class="role r2"><div class="rt">Manager</div><p>Ventes, commandes, stock, achats, clients, salaires. Pas les bénéfices du tableau de bord.</p></div>
    <div class="role r3"><div class="rt">Comptable</div><p>Capital, dépenses, notes de frais, facturation, paiements. Ventes en lecture.</p></div>
    <div class="role r4"><div class="rt">Vendeur</div><p>Crée ses ventes, ses clients, ses commandes. Voit le prix de vente et le stock disponible.</p></div>
    <div class="role r5"><div class="rt">Gestionnaire de stock</div><p>Produits, inventaire, achats, fournisseurs, statut des commandes.</p></div>
    <div class="role r6"><div class="rt">Livreur</div><p>Un espace dédié : ses courses, l'argent à rapporter, sa paie.</p></div>
  </div>
  ${svg(680, 120, boite(10, 30, 130, 56, "Rôle", "f", "modèle de départ") + fleche("M142,58 L180,58", "v") + boite(184, 30, 110, 56, "Modules", "v", "visible ?") + fleche("M296,58 L334,58", "v") + boite(338, 30, 110, 56, "Portée", "b", "mes données / tout") + fleche("M450,58 L488,58", "v") + boite(492, 30, 80, 56, "Actions", "a", "") + fleche("M574,58 L600,58", "v") + boite(604, 30, 70, 56, "Champs", "p", "sensibles"))}
  <h3>Exemple : ce que chacun peut faire</h3>
  ${tableau(["Écran", "Administrateur", "Manager", "Comptable", "Vendeur", "Gest. de stock"], [
    ["Ventes", "Tout", "Créer, modifier, annuler", "Lecture", "Créer (les siennes)", "—"],
    ["Produits", "Tout", "Créer, modifier, ajuster", "—", "Lecture (prix de vente, stock)", "Tout sauf valeur du stock"],
    ["Achats", "Tout", "Créer, modifier", "Lecture", "—", "Créer, modifier"],
    ["Capital", "Tout", "Lecture", "Tout", "—", "—"],
    ["Salaires", "Tout", "Tout", "Lecture", "Sa paie", "Sa paie"],
  ], "zebre petitab")}
  ${note("info", "Toujours visibles", "Tableau de bord, Capital et Ventes restent dans le menu de chacun : leur contenu s'adapte (un vendeur ne voit que ses ventes et « Mon solde net en poche »).")}`);

// Ch3
page("3. Dans quel ordre tout saisir", `${bandeau(3, "Dans quel ordre tout saisir", "Le bon ordre garantit un stock et une caisse justes dès le premier jour.", "ill-calendrier.png")}
  ${serpentin}
  <div class="chips centre-f"><span class="chip"><b class="s" style="background:#9aa6a1"> </b>Accès</span><span class="chip"><b class="s p"> </b>Paramétrage</span><span class="chip"><b class="s r"> </b>Stock & achats</span><span class="chip"><b class="s a"> </b>Ventes</span><span class="chip"><b class="s" style="background:#8a4baf"> </b>Facultatif</span></div>
  <div class="grille2 serre">
    <div class="carte plate"><h3 class="vert">Obligatoire</h3><p>Compte → boutique → <b>au moins un produit</b> (par Produits ou par un achat) avant toute vente ou commande d'article du catalogue.</p></div>
    <div class="carte plate"><h3 class="orange">Fortement conseillé</h3><p><b>Capital initial</b> avant la première opération d'argent ; <b>fournisseurs</b> avant les achats ; <b>clients</b> avant les ventes à crédit.</p></div>
  </div>
  ${note("attention", "Ne comptez pas deux fois", "Si vous saisissez un **stock initial** dans la fiche produit, n'enregistrez pas en plus un achat pour les mêmes unités : le stock serait compté deux fois.")}`);

page("3.1 Ce qui se met à jour tout seul", `<h2 class="haut">Ce qui se met à jour tout seul</h2>
  ${tableau(["Vous faites…", "Le stock", "L'argent", "Où le voir"], [
    ["Créer un produit avec stock initial", "= stock initial", "—", "Produits"],
    ["Enregistrer un **achat**", "+ quantité", "Trésorerie −, dette si à crédit", "Achats, Fournisseurs, Capital"],
    ["Valider une **vente**", "− quantité", "Encaissement ; crédit si partiel", "Ventes, Paiements à recevoir"],
    ["Créer une **commande**", "réservé +", "—", "Produits (stock réservé)"],
    ["**Marquer livré**", "actuel − et réservé −", "—", "Commandes, Produits"],
    ["**Annuler** une commande", "réservation libérée", "remboursement automatique", "Commandes, Capital"],
    ["**Recevoir** un paiement", "—", "reste à payer −", "Paiements à recevoir, Clients"],
    ["Régler un fournisseur", "—", "reste dû −", "Fournisseurs"],
    ["Dépense / apport", "—", "trésorerie − / +", "Dépenses, Capital, Historique"],
    ["Corriger le stock", "± quantité (motif)", "—", "Produits"],
  ], "zebre")}
  <h3>Une journée type</h3>${schemaJournee}
  ${note("confirmer", "Point à confirmer", "Dans le calcul actuel de l'écran Capital, le **total** d'un achat est déduit même s'il a été acheté à crédit, et les versements de salaire n'y figurent pas.")}`);

// Ch4 Produits
page("4. Produits et stock", `${bandeau(4, "Produits et stock", "Le catalogue, les prix et le stock disponible.", "ill-carton.png")}
  <div class="duo">
    ${capture("produits-nouveau", [[1, 778, 221], [2, 778, 346], [3, 1094, 346], [4, 778, 531], [5, 778, 691], [6, 1094, 691], [7, 778, 842], [8, 1193, 1393]], { cls: "modal" })}
    <div>
      <h3>Créer un produit</h3>
      <p class="petit">Produits › <b>Nouveau produit</b></p>
      ${legende(["**Désignation** — obligatoire.", "**Prix d'achat** — obligatoire.", "**Prix de vente** — la **marge** s'affiche dessous. Si le prix calculé est activé, il suit le prix d'achat.", "**Fournisseur** habituel (création possible ici).", "**Stock initial** — quantité déjà en rayon.", "**Seuil d'alerte** — en dessous, le produit passe en « Alertes ».", "**Fiche produit** (facultatif) : référence, code-barres, catégorie, type, unité, TVA, photos.", "**Enregistrer**."], 1)}
      ${note("astuce", "Code-barres", "Scannez l'étiquette une fois dans la fiche : le produit sera retrouvé au scan à la caisse.")}
    </div>
  </div>`);

page("4.1 Corriger le stock", `<h2 class="haut">Surveiller et corriger le stock</h2>
  <div class="grille2">
    <div class="carte plate"><h3>Les filtres du stock</h3><p><b>Tous</b> · <b>OK</b> · <b>Alertes</b> (au seuil ou en dessous) · <b>À recommander</b> (si la préalerte est activée dans Paramètres › Alertes de stock).</p><p>Les badges : <span class="badge g">140 en stock</span> <span class="badge o">9 en stock</span> <span class="badge r">Rupture</span></p></div>
    <div class="carte plate"><h3>Réapprovisionnement</h3><p>Si activé, l'onglet <b>Réapprovisionnement</b> liste les produits sous le seuil avec la <b>quantité à commander</b> (= niveau cible − stock actuel), regroupables par fournisseur et imprimables en feuille A4.</p></div>
  </div>
  <h3>Corriger le stock après un inventaire, une casse ou une perte</h3>
  ${etapes(["Produits › cliquez sur le produit › **Modifier**.", "Bloc **Corriger le stock** : choisissez **Ajouter** ou **Retirer**, puis la **quantité**.", "Vérifiez « **Stock après correction** » : il doit correspondre à votre comptage.", "Indiquez un **motif** (inventaire, casse, perte…) puis **Enregistrer**. Un mouvement « ajustement » est tracé."])}
  <h3>Chaque mouvement est tracé</h3><div class="chips"><span class="chip"><b class="s p">+</b>Achat</span><span class="chip"><b class="s m">−</b>Vente</span><span class="chip"><b class="s r">R</b>Réservation (commande)</span><span class="chip"><b class="s m">−</b>Livraison de commande</span><span class="chip"><b class="s a">↺</b>Annulation / libération</span><span class="chip"><b class="s p">±</b>Ajustement (stock initial, correction, avoir)</span><span class="chip"><b class="s a">✎</b>Modification / suppression d'un achat ou d'une vente</span></div>
  ${schemaStock}
  ${note("attention", "Refusé si…", "On ne peut ni descendre sous zéro, ni sous le **stock réservé** par des commandes en cours.")}
  ${note("attention", "Supprimer un produit", "La suppression est définitive : le stock restant n'est plus suivi. Les ventes et achats passés restent visibles, mais ne sont plus liés à une fiche.")}`);

// Ch5 Achats
page("5. Achats et fournisseurs", `${bandeau(5, "Achats et fournisseurs", "Faire entrer la marchandise et suivre ce que vous devez.", "ill-camion.png")}
  ${capture("achats", [[1, 1852, 81], [2, 1409, 81], [3, 1658, 81], [4, 475, 243], [5, 475, 572], [6, 1879, 605]])}
  ${legende(["**Nouvel achat**.", "**Factures reçues** : classer les factures papier des fournisseurs (sans effet sur la caisse ni le stock).", "**Imprimer** le journal des achats (période, papier, image).", "**Indicateurs** : total des achats, articles reçus, fournisseurs.", "**Un achat** : quantité, date, fournisseur, prix unitaire.", "**Effet sur la caisse** de l'achat."], 2)}
  ${schemaAchat}`);

page("5.1 Enregistrer un achat", `<div class="duo">
    ${capture("achats-nouveau", [[1, 778, 359], [2, 778, 508], [3, 778, 634], [4, 778, 759], [5, 778, 913], [6, 778, 1096], [7, 799, 1231], [8, 1129, 1404]], { cls: "modal" })}
    <div>
      <h2>Enregistrer un achat</h2>
      ${legende(["**Recharge rapide** : choisissez le produit existant (recommandé).", "**Date d'achat**.", "**Désignation** : si elle est inconnue, un **nouveau produit** est créé.", "**Quantité** et **prix d'achat unitaire** (le total s'affiche).", "**Fournisseur**.", "**Règlement** : Payé comptant ou **À crédit** (montant versé maintenant + échéance).", "**Récapitulatif** : total et ce qui sort de la caisse ou restera dû.", "**Enregistrer l'achat**."], 1)}
      ${note("astuce", "Prix différent ?", "Si le prix saisi diffère de la fiche, une case propose de **mettre la fiche à jour** (le prix de vente suit s'il est automatique).")}
    </div>
  </div>
  <div class="grille2"><div class="carte plate"><img class="mini" src="img/ill-feuille.png" alt=""><h3>Corriger un achat</h3><p>Ouvrez l'achat › <b>Corriger l'achat</b> : produit, date, quantité, prix unitaire, montant réglé. Un encadré montre ce que la correction déplace (stock, dette).</p></div><div class="carte plate"><img class="mini" src="img/ill-rupture.png" alt=""><h3>Supprimer un achat</h3><p>Retire la quantité du stock. <b>Refusé</b> si les unités ont déjà été vendues ou sont réservées par des commandes.</p></div></div>
  ${note("attention", "Faute de frappe = nouveau produit", "Tapez la désignation à la main uniquement pour un article vraiment nouveau. Sinon, utilisez la recharge rapide.")}`);

page("5.2 Fournisseurs et dettes", `<h2 class="haut">Fournisseurs et dettes</h2>
  ${capture("fournisseurs", [[1, 1588, 81], [2, 1777, 81], [3, 475, 394], [4, 1960, 505]])}
  ${legende(["**Importer** des fournisseurs (Excel, CSV ou Word, voir chapitre 12).", "**Nouveau fournisseur** : seul le nom est obligatoire.", "**Fiche** : téléphone, ville, nombre d'achats et de produits.", "**Reste dû** au fournisseur (achats à crédit)."], 2)}
  <h3>Payer une dette fournisseur</h3>
  ${etapes(["Ouvrez la fiche du fournisseur et repérez l'achat portant un reste dû.", "Cliquez sur **Enregistrer un règlement**.", "Saisissez **Montant versé**, **Date**, **Moyen** (Espèces, Mobile Money, Virement) et une **référence** facultative.", "Validez : la pastille passe à **Partiel** ou **Réglé**. Un règlement supérieur au reste est refusé."])}
  ${schemaDette}`);

// Ch6 Ventes
page("6. Vendre à la caisse", `${bandeau(6, "Vendre à la caisse", "Le panier, le paiement, le reçu.", "ill-trophee.png")}
  ${capture("ventes", [[1, 1620, 78], [2, 1833, 103], [3, 475, 275], [4, 1480, 475], [5, 475, 599], [6, 475, 853], [7, 1960, 1118]])}
  ${legende(["**Chiffre d'affaires** et marge.", "**Nouvelle vente**.", "**Encaissé · Reste à encaisser · Marge**.", "**Filtres** par vendeur et par statut de paiement.", "**Une vente** d'un seul produit.", "**Un ticket** : plusieurs produits vendus ensemble.", "**Statut** : Payé, Partiel ou Impayé (avec le reste)."], 2)}`);

page("6.1 Le panier", `<div class="duo">
    ${capture("ventes-nouvelle", [[1, 729, 189], [2, 1094, 189], [3, 729, 313], [4, 729, 437], [5, 729, 562], [6, 983, 734], [7, 729, 829], [8, 729, 1294], [9, 1094, 1294], [10, 1201, 1544]], { cls: "modal" })}
    <div>
      <h2>Le panier, pas à pas</h2>
      ${legende(["**Date** de la vente.", "**Vendeur** — obligatoire.", "**Code-barres** : scannez ou tapez, puis Entrée.", "**Produit** : la liste montre le prix et le stock disponible.", "**Quantité** et **prix unitaire** (prérempli, modifiable).", "**Ajouter au panier** — à refaire pour chaque article.", "**Panier** : + / − et corbeille par ligne.", "**Client** : client de passage ou fiche client.", "**Montant payé comptant** : s'il est inférieur au total, le reste devient un crédit.", "**Valider la vente** : le reçu s'ouvre aussitôt."], 1)}
    </div>
  </div>
  <div class="grille3"><div class="carte"><img src="img/ill-portefeuille.png" alt=""><h3>Prix libre</h3><p>Le prix est prérempli au prix de référence, mais vous pouvez le changer pour cette vente seulement.</p></div><div class="carte"><img src="img/ill-clients.png" alt=""><h3>Client de passage</h3><p>Pas besoin de fiche pour une vente comptant : notez simplement un nom si vous le souhaitez.</p></div><div class="carte"><img src="img/ill-rupture.png" alt=""><h3>Stock contrôlé</h3><p>Impossible d'ajouter plus que le <b>stock disponible</b> : les unités réservées par des commandes sont protégées.</p></div></div>
  ${note("attention", "La ligne oubliée", "Un produit choisi mais **non ajouté au panier** n'est pas vendu. Vérifiez le compteur « Panier (n) » avant de valider.")}`);

page("6.2 Après la vente", `<h2 class="haut">Ce qui se passe après « Valider la vente »</h2>
  ${schemaVente}
  <div class="docs">
    ${capture("ticket", [], { cls: "ticket", legende: "Le **ticket de caisse** (80 mm), avec code-barres du numéro de vente." })}
    ${capture("facture", [], { cls: "facture", legende: "La même vente en **facture A4** : tampon « Reste à payer », montant en lettres, signatures." })}
  </div>
  ${note("info", "Modifier ou supprimer une vente", "**Modifier** corrige date, vendeur, quantité, prix, client et montant payé. **Supprimer** remet le stock, mais est **refusé** si un paiement existe : passez alors par un avoir (chapitre 9).")}`);

// Ch7 Clients & paiements
page("7. Clients et paiements à recevoir", `${bandeau(7, "Clients et paiements à recevoir", "Savoir qui vous doit quoi, et l'encaisser.", "ill-clients.png")}
  ${capture("clients", [[1, 1833, 81], [2, 454, 232], [3, 454, 313], [4, 475, 391], [5, 1928, 515]])}
  ${legende(["**Nouveau client** : nom obligatoire ; prénom, entreprise, téléphone, e-mail, adresse, type (particulier, entreprise, revendeur).", "**Recherche** par nom, entreprise, téléphone, ville.", "**Filtres** : Tous, Actifs, Inactifs, **Avec impayé**.", "**Fiche** : cliquez pour voir commandes, total acheté, déjà payé, reste dû.", "**Montant dû** par le client."], 2)}
  ${note("astuce", "Le téléphone sert", "Le téléphone et l'e-mail de la fiche permettent d'**envoyer les factures par WhatsApp ou e-mail** depuis Facturation.")}`);

page("7.1 Encaisser un reste à payer", `<h2 class="haut">Encaisser un reste à payer</h2>
  ${capture("paiements", [[1, 477, 246], [2, 454, 394], [3, 475, 499], [4, 1849, 510], [5, 1922, 502]])}
  ${legende(["**Total à recevoir** et nombre de pièces en attente.", "**Recherche** client, vente, commande.", "**Pièce** : vente ou commande, et son client.", "**Historique** des paiements déjà reçus.", "**Recevoir** : montant reçu (au plus le reste), mode (Espèces, Mobile Money, Virement), note."], 2)}
  ${svg(680, 110, boite(10, 25, 150, 56, "Vente à crédit", "a", "reste à payer") + fleche("M162,53 L206,53", "v", "Recevoir", 184, 16) + boite(210, 25, 150, 56, "Paiement", "v", "montant + mode") + fleche("M362,53 L406,53", "v") + boite(410, 25, 120, 56, "Partiel", "a", "reste diminue") + fleche("M532,53 L556,53", "v") + boite(560, 25, 110, 56, "Payé", "f", "sort de la liste"))}`);

// Ch8 Commandes & livraisons
page("8. Commandes et livraisons", `${bandeau(8, "Commandes et livraisons", "Réserver le stock, livrer, encaisser.", "ill-camion.png")}
  ${capture("commandes", [[1, 1780, 81], [2, 458, 232], [3, 1710, 394], [4, 475, 508], [5, 475, 621], [6, 481, 783], [7, 481, 927]])}
  ${legende(["**Nouvelle commande**.", "**Indicateurs** : total, en cours, livrées, CA, encaissé, **impayés**.", "**Filtres** par statut et par paiement.", "**Commande** : numéro, statut, paiement, client.", "**Produits commandés** (cliquez sur la commande pour déplier).", "**Total · Payé · Reste**.", "**Enregistrer paiement · Marquer livré · Annuler**."], 2)}`);

page("8.1 La vie d'une commande", `<h2 class="haut">La vie d'une commande</h2>
  <div class="duo large">
    ${capture("commandes-nouvelle", [[1, 607, 549], [2, 1094, 549], [3, 607, 674], [4, 1377, 808], [5, 1285, 1021]], { cls: "modal2" })}
    <div>${legende(["**Client** de la commande.", "**Statut initial** (voir l'encadré ci-dessous).", "**Livraison prévue**.", "**Ajouter un produit** : catalogue ou ligne libre, quantité, prix.", "**Créer la commande** : le stock est **réservé**."], 1)}</div>
  </div>
  ${schemaCommande}
  ${note("confirmer", "À confirmer", "Le champ « Statut initial » est affiché, mais la commande est toujours créée **En attente**.")}
  ${note("attention", "Pas de double saisie", "Ne saisissez pas en plus une vente pour une commande : c'est « **Marquer livré** » qui sort le stock.")}`);

page("8.2 Livraisons", `<h2 class="haut">Livraisons et espace livreur</h2>
  <p>Écran <b>Livraisons</b> › <b>Nouvelle course</b> : <b>destinataire</b> et <b>adresse</b> obligatoires, téléphone, repères, articles transportés, date prévue, <b>montant à encaisser</b> (zéro si le client a déjà payé), personne à qui la course est confiée.</p>
  ${capture("livraisons", [[1, 1636, 81], [2, 1825, 108], [3, 1890, 283], [4, 475, 397], [5, 1895, 508], [6, 475, 616], [7, 1953, 626]])}
  ${legende(["**À rapporter** : argent encore chez les livreurs.", "**Nouvelle course**.", "**Statut** : Restant à faire, Toutes, Argent chez les livreurs, Argent rendu.", "**Argent chez les livreurs**, livreur par livreur.", "**Argent rendu** : à cocher quand le livreur a remis l'argent.", "**Course** : numéro, date, adresse, livreur.", "**Statut** de la course."], 2)}
  ${schemaLivraison}
  <div class="grille2">
    <div class="carte plate"><img class="mini" src="img/ill-camion.png" alt=""><h3>Côté livreur</h3><p>Le livreur voit ses courses dans son <b>Espace livreur</b> : <b>Je pars avec</b>, puis <b>Colis remis</b> (« Combien avez-vous encaissé ? ») ou <b>Je n'ai pas pu livrer</b> (motif lu par la boutique).</p></div>
    <div class="carte plate"><img class="mini" src="img/ill-portefeuille.png" alt=""><h3>Côté boutique</h3><p>Filtres <b>Restant à faire</b>, <b>Argent chez les livreurs</b>, <b>Argent rendu</b>. Enregistrez l'argent rapporté par le livreur.</p></div>
  </div>
  ${note("attention", "La course ne touche pas au stock", "Les articles d'une course sont une information pour le livreur. Le stock sort par la vente ou par « Marquer livré » sur la commande.")}`);

// Ch9 Facturation
page("9. Facturation et documents", `${bandeau(9, "Facturation et documents", "Factures, reçus, devis, proformas et avoirs au même endroit.", "ill-feuille.png")}
  ${schemaDocs}
  <div class="grille2">
    <div class="carte plate"><h3>Nouveau document</h3><p><b>Facture</b> (catalogue ou prestation) · <b>Reçu</b> (vente réglée comptant) · <b>Facture de service avec commission</b> · <b>Proforma</b> et <b>Devis</b> (écran Devis) · <b>Facture d'achat fournisseur</b> (Factures reçues).</p></div>
    <div class="carte plate"><h3>Statuts d'une facture</h3><p><span class="badge n">Émise</span> <span class="badge b">Envoyée</span> <span class="badge o">Partiellement payée</span> <span class="badge g">Payée</span> <span class="badge r">En retard</span> <span class="badge n">Annulée</span></p></div>
  </div>
  ${tableau(["Action sur un document", "Effet"], [
    ["**Voir, PDF, imprimer**", "Ouvre le document au format choisi."],
    ["**Envoyer**", "Message modifiable par WhatsApp (si un numéro existe), e-mail ou copie."],
    ["**Enregistrer un paiement**", "Montant, mode, référence : le reste à payer diminue."],
    ["**Convertir en facture** (devis)", "Crée la vente correspondante : le stock sort."],
    ["**Annuler par un avoir**", "Montant, motif ; rembourse ce qui a été encaissé et peut remettre les articles en stock (avoir total)."],
  ], "zebre")}`);

// Ch10 Argent
page("10. Capital et trésorerie", `${bandeau(10, "Capital et trésorerie", "Ce qu'il reste en caisse, et pourquoi.", "ill-portefeuille.png")}
  ${capture("capital", [[1, 483, 251], [2, 2011, 257], [3, 475, 451], [4, 475, 1089], [5, 482, 1382], [6, 1804, 81]], { w: "138mm" })}
  ${legende(["**Trésorerie disponible**.", "**État** : Saine, basse (sous le seuil) ou négative.", "**Composition** : ce qui fait monter (+) ou descendre (−) la caisse.", "**Total** : la trésorerie disponible.", "**Réglages** : capital initial et seuil d'alerte — à remplir dès le départ.", "**Ajouter un apport** (associé, prêt, réserve)."], 2)}
  ${schemaTreso}`);

page("10.1 Dépenses, notes de frais, salaires", `<h2 class="haut">Dépenses, notes de frais et salaires</h2>
  <div class="grille3 haute">
    <div class="carte"><img src="img/ill-rupture.png" alt=""><h3>Dépenses</h3><p><b>Nouvelle dépense</b> : date, effectué par, type (Retrait d'argent, Achat de stock ou matériel d'urgence, Autre dépense), montant, poste, motif, photo du reçu. La trésorerie diminue.</p></div>
    <div class="carte"><img src="img/ill-feuille.png" alt=""><h3>Notes de frais</h3><p>Un membre déclare ce qu'il a avancé (bénéficiaire, motif, montant, devise, justificatif). Le responsable valide, refuse ou rembourse.</p></div>
    <div class="carte"><img src="img/ill-calendrier.png" alt=""><h3>Salaires</h3><p><b>Nouvelle fiche</b> (employé, poste, salaire mensuel, à partir du). <b>Verser</b> une avance ou le solde du mois. Les membres demandent une avance depuis <b>Ma paie</b>.</p></div>
  </div>
  <h3>Le circuit d'une note de frais</h3>
  ${schemaNotes}
  <h3>Le circuit d'une avance sur salaire</h3>${schemaSalaire}
  ${note("attention", "Achat de stock ≠ dépense", "Une dépense « Achat de stock » ne fait **pas** entrer de marchandise. Pour réapprovisionner, utilisez l'écran **Achats**.")}
  ${note("attention", "Pas de doublon", "Le remboursement d'une note de frais **crée déjà** la dépense : ne la saisissez pas une seconde fois.")}`);

// Ch11 Tableau de bord
page("11. Le tableau de bord", `${bandeau(11, "Le tableau de bord", "Toute la boutique d'un coup d'œil.", "ill-croissance.png")}
  ${capture("dash-haut", [[1, 452, 117], [2, 452, 289], [3, 433, 425], [4, 780, 425], [5, 1127, 425], [6, 1474, 425], [7, 452, 881]])}
  ${legende(["**Accueil** : date, heure, météo et salutation.", "**Alertes** : tâches en retard, produits à recommander.", "**Ventes du jour** (tendance vs hier).", "**Entrées d'argent**.", "**Sorties d'argent** (achats, dépenses).", "**Stock du jour** : entrées, sorties, bientôt en rupture.", "**Aperçu des ventes** sur la période choisie."], 2)}`);

page("11.1 Opérations et ventes", `<h2 class="haut">Les sections du tableau de bord</h2>
  ${capture("dash-ops", [], { w: "132mm", legende: "**Opérations** : l'agenda de la boutique (échéances, livraisons, rendez-vous), les tâches à faire, le suivi des commandes et les livraisons du jour." })}
  ${capture("dash-ventes", [], { w: "132mm", legende: "**Les ventes** : le fil des dernières ventes, les clients à relancer, les produits les plus vendus et le classement des vendeurs." })}
  ${note("info", "Selon les droits", "Les cartes affichées dépendent du rôle : un vendeur voit ses propres chiffres, un gestionnaire de stock les indicateurs de stock.")}`);

// Ch12 Organisation + import
page("12. Organisation et import", `${bandeau(12, "Organisation et import", "Tâches, agenda, rappels — et l'import de vos données.", "ill-calendrier.png")}
  <div class="grille3">
    <div class="carte plate"><h3>Tâches</h3><p>Ce qu'il y a à faire, échéance, priorité (Basse → Urgente), pour qui. Cocher pour <b>Terminer</b> ; <b>Reporter à demain</b>, <b>Réassigner</b>.</p></div>
    <div class="carte plate"><h3>Agenda</h3><p>Rendez-vous, réunions, événements ; privé, toute l'équipe ou certaines personnes.</p></div>
    <div class="carte plate"><h3>Rappels</h3><p>Une seule fois, tous les jours, toutes les semaines ou tous les mois, à l'heure choisie.</p></div>
  </div>
  <p class="petit">Une seule page à onglets, un bouton <b>Nouveau</b>, un filtre <b>Toute l'équipe / Ce qui m'est assigné</b>.</p>
  <h2>Importer vos données</h2>
  ${schemaImport}
  ${etapes(["Remplissez les feuilles utiles de **Modele_import_Tantana_Suite.xlsx**, dès la ligne 3.", "Enregistrez-le tel quel (.xlsx) — votre propre Excel, CSV ou Word convient aussi.", "**Importer** (Produits, Clients, Fournisseurs ou Achats) › vérifiez destination et colonnes.", "Lisez l'aperçu, puis **Confirmer**. Le bilan reste dans « Imports récents »."])}
  ${note("attention", "Achats et ventes", "Un achat importé ajoute au stock et, sans montant payé, sort de la caisse. Les ventes passées ne s'importent pas.")}
  <h3>Les réglages utiles (Paramètres)</h3>
  <div class="grille3 reglages"><div class="carte plate"><b>Ma boutique</b><br>Logo, coordonnées, NIF/STAT, devise, TVA.</div><div class="carte plate"><b>Documents</b><br>Modèle de facture, couleur, mentions, ticket 80/58 mm.</div><div class="carte plate"><b>Listes</b><br>Catégories, postes de dépenses, types de fournisseur.</div><div class="carte plate"><b>Alertes de stock</b><br>Préalerte et réapprovisionnement.</div><div class="carte plate"><b>Équipe</b><br>Invitations, rôles et accès.</div><div class="carte plate"><b>Sécurité</b><br>Code PIN, mot de passe.</div></div>`);

// Ch13 Bonnes pratiques
page("13. Bonnes pratiques", `${bandeau(13, "Bonnes pratiques", "Les bons réflexes, et les pièges à éviter.", "ill-trophee.png")}
  <div class="faire">
    <div class="col oui"><h3>✓ À faire</h3><ul>
      <li>Saisir le <b>capital initial</b> avant la première vente.</li>
      <li>Choisir le produit <b>existant</b> dans les achats (recharge rapide).</li>
      <li>Vérifier le <b>montant payé</b> : il décide du crédit client.</li>
      <li>Choisir le <b>client</b> pour toute vente à crédit.</li>
      <li><b>Marquer livré</b> chaque commande remise au client.</li>
      <li>Indiquer un <b>motif</b> à chaque correction de stock.</li>
      <li>Inviter chaque collaborateur avec <b>son propre compte</b>.</li>
      <li>Contrôler en fin de journée : Tableau de bord, Historique, Vendeurs.</li>
    </ul></div>
    <div class="col non"><h3>✗ À éviter</h3><ul>
      <li>Supprimer une vente ou un achat pour « corriger » (préférez Modifier ou un avoir).</li>
      <li>Saisir une même opération deux fois (commande + vente, note de frais + dépense).</li>
      <li>Corriger le stock au lieu d'enregistrer un achat.</li>
      <li>Créer des doublons de produits ou de clients (cherchez d'abord).</li>
      <li>Supprimer un produit qui a encore du stock.</li>
      <li>Saisir un stock initial <b>et</b> un achat pour les mêmes unités.</li>
    </ul></div>
  </div>
  <h3>Messages fréquents</h3>
  ${tableau(["Message", "Que faire"], [
    ["« Ajoutez au moins un produit au panier. »", "Cliquez sur **Ajouter au panier** avant de valider."],
    ["« Il ne reste que n unité(s)… »", "Réduisez la quantité, enregistrez un achat ou libérez une commande."],
    ["« Paiement refusé : reste à payer … »", "Saisissez au plus le reste à payer."],
    ["« Suppression impossible : cette vente a un historique de paiement »", "Établissez un **avoir** depuis Facturation."],
    ...(K ? [["« Le montant dépasse le reste à payer »", "Vérifiez le reste dû de la vente ou de la commande."]] : [["« Boutique verrouillée »", "Activez avec un code dans Paramètres › Abonnement."]]),
  ], "zebre")}`);

// Ch14 Données
page("14. Sous le capot : les données", `${bandeau(14, "Sous le capot : les données", "Comment les informations sont reliées entre elles.", "ill-carton.png")}
  ${schemaDonnees}
  <p class="petit centre">Les tables principales de la base (noms techniques) et leurs liens. Toutes appartiennent à une boutique (stores). Le détail complet des 70 tables figure dans le manuel Word, partie 7.</p>
  ${tableau(["Table", "Contient", "Remplie par"], [
    ["products", "Produits, prix, stock actuel / réservé / disponible", "Produits, Achats"],
    ["purchases · supplier_payments", "Achats et règlements fournisseurs", "Achats, Fournisseurs"],
    ["sales · payments · refunds", "Ventes (lignes d'un ticket), encaissements, remboursements", "Ventes, Paiements, Facturation"],
    ["orders · order_items", "Commandes et leurs lignes", "Commandes"],
    ["stock_movements", "Journal de chaque mouvement de stock", "Automatique"],
    ["clients · suppliers · providers", "Les tiers", "Clients, Fournisseurs, Prestataires"],
  ], "zebre")}`);

// Quatrième de couverture
pages.push({ cls: "dos", html: `<div class="rond1"></div><div class="rond2"></div>
  <div class="dos-txt">${LOGO.replace('mono', 'mono grand')}<h2>Tantana Suite</h2><p>Le cahier de votre boutique, tenu tout seul.</p>
  <div class="dos-liste"><span>Stock</span><span>Ventes</span><span>Achats</span><span>Clients</span><span>Facturation</span><span>Trésorerie</span><span>Équipe</span></div>
  <p class="petit">Ce guide accompagne le manuel d'utilisation complet (Word) et le modèle d'import Excel.</p></div>` });

// ── Assemblage ─────────────────────────────────────────────────────
const corps = pages.map((p, i) => `<section class="page ${p.cls ?? ""}" ${p.toc ? `data-toc="${esc(p.toc)}"` : ""}>${p.html}${p.cls === "couverture" || p.cls === "dos" ? "" : `<div class="pied"><span>Tantana Suite · Guide illustré</span><span class="nump">${i + 1}</span></div>`}</section>`).join("\n");
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Tantana Suite — Guide illustré</title><link rel="stylesheet" href="livre.css"></head><body>${corps}
<script>
const pages=[...document.querySelectorAll('.page')];
const s=document.getElementById('sommaire');
let html='';pages.forEach((p,i)=>{const t=p.dataset.toc;if(!t)return;const sous=/^\\d+\\.\\d/.test(t);html+='<div class="ts '+(sous?'sous':'chap')+'"><span class="tt">'+t+'</span><span class="pts"></span><span class="tp">'+(i+1)+'</span></div>';});
s.innerHTML=html;
const deb=pages.filter(p=>{const c=p.cloneNode(false);return p.scrollHeight>p.clientHeight+2;});
deb.forEach(p=>p.classList.add('debord'));
document.body.dataset.debord=deb.map(p=>pages.indexOf(p)+1).join(',');
</script></body></html>`;
let final = html;
if (K) {
  final = final
    .replace(/est le cahier de votre boutique, tenu tout seul/g, "tient pour vous le cahier de l'activité")
    .replace(/Le cahier de votre boutique, tenu tout seul./g, "Stock, ventes, achats, clients et trésorerie au même endroit.")
    .replace(/Tantana_Suite/g, "Kinvest")
    .replace(/Tantana Suite/g, "Kinvest")
    .replace(/Tantana/g, "Kinvest");
}
fs.writeFileSync(path.join(OUT, "index.html"), final);
console.log("pages:", pages.length);

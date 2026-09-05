import type { PaperFormat } from "./paperFormats";

/**
 * Génération du PDF d'un document imprimable.
 *
 * La boîte d'impression du navigateur sait déjà produire un PDF au bon
 * format, et c'est la voie recommandée : elle rend exactement le HTML,
 * sans autre mise en page à tenir à jour. Ce module existe pour le cas
 * qu'elle couvre mal — obtenir le fichier en un seul geste, pour
 * l'envoyer à un client par messagerie, sans passer par un dialogue
 * système.
 *
 * Le prix à payer est assumé : la mise en page y est redessinée en
 * coordonnées, elle ne dérive pas du HTML. Elle est donc volontairement
 * réduite à une grammaire simple — un en-tête, un encart, un tableau,
 * des totaux, un pied — que les deux rendus peuvent tenir sans diverger
 * sur l'essentiel. Le modèle ci-dessous est le contrat entre les deux.
 *
 * jsPDF est chargé à la demande : personne ne télécharge ces 108 Ko sans
 * avoir cliqué sur le bouton.
 */

export interface PdfColonne {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Part de la largeur utile, en pourcentage. Le reste est réparti. */
  part?: number;
}

export interface PdfLigne {
  /** Valeurs par colonne. */
  cells: Record<string, string>;
  /** Précision grise sous la première colonne (référence, note…). */
  hint?: string;
}

export interface PdfDocumentModel {
  /** Nom du fichier proposé, sans extension. */
  fileName: string;
  boutique: {
    nom: string;
    sousTitre?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    nifStat?: string;
  };
  /** Intitulé en petites capitales : « Facture », « Journal des achats ». */
  intitule: string;
  /** Valeur mise en avant sous l'intitulé : n° de facture, période… */
  reference: string;
  /** Paires libellé / valeur, sous la référence. */
  meta: { label: string; value: string }[];
  /** Encart de portée : client et statut, ou indicateurs chiffrés. */
  portee?: { label: string; value: string }[];
  colonnes: PdfColonne[];
  lignes: PdfLigne[];
  /** Message affiché à la place du tableau quand il n'y a rien. */
  vide?: string;
  totaux: { label: string; value: string; fort?: boolean }[];
  pied?: { titre: string; texte: string };
}

/** Gris de la charte, en RVB — jsPDF ne lit pas les couleurs CSS. */
const ENCRE = [15, 23, 42] as const; // slate-900
const GRIS = [100, 116, 139] as const; // slate-500
const GRIS_CLAIR = [148, 163, 184] as const; // slate-400
const FILET = [203, 213, 225] as const; // slate-300
const FILET_FIN = [226, 232, 240] as const; // slate-200
const FOND = [248, 250, 252] as const; // slate-50

/** Dimensions du papier, en millimètres. */
const PAPIERS: Record<string, { largeur: number; hauteur: number | null; marge: number }> = {
  a4: { largeur: 210, hauteur: 297, marge: 12 },
  a5: { largeur: 148, hauteur: 210, marge: 10 },
  letter: { largeur: 216, hauteur: 279, marge: 12 },
  t80: { largeur: 80, hauteur: null, marge: 3 },
  t58: { largeur: 58, hauteur: null, marge: 2 },
};

type Doc = any;

/**
 * Dessine le document et renvoie la hauteur occupée.
 *
 * Appelée une première fois sur un document jetable, à seule fin de
 * mesurer : c'est ce qui permet de donner à un ticket la hauteur exacte
 * de son contenu, puisqu'un rouleau n'en a pas de prédéfinie.
 */
function composer(doc: Doc, m: PdfDocumentModel, p: PaperFormat, dessiner: boolean): number {
  const pap = PAPIERS[p.id] ?? PAPIERS.a4;
  const G = pap.marge;
  const L = pap.largeur - 2 * G; // largeur utile
  const ticket = p.layout === "ticket";
  const hauteurPage = pap.hauteur ? pap.hauteur - pap.marge : Number.POSITIVE_INFINITY;

  let y = G;

  const set = (couleur: readonly number[], taille: number, gras = false) => {
    if (!dessiner) return;
    doc.setTextColor(couleur[0], couleur[1], couleur[2]);
    doc.setFontSize(taille);
    doc.setFont("helvetica", gras ? "bold" : "normal");
  };

  const texte = (t: string, x: number, taille: number, opts: any = {}) => {
    set(opts.couleur ?? ENCRE, taille, opts.gras);
    const largeur = opts.largeur ?? L;
    const lignes: string[] = dessiner
      ? doc.splitTextToSize(t, largeur)
      : t.length > 0
        ? new Array(Math.max(1, Math.ceil((t.length * taille * 0.5) / largeur))).fill("")
        : [""];
    const h = lignes.length * taille * 0.42;
    if (dessiner) doc.text(lignes, x, y + taille * 0.35, { align: opts.align ?? "left" });
    return h;
  };

  const filet = (couleur: readonly number[] = FILET_FIN, epaisseur = 0.2) => {
    if (dessiner) {
      doc.setDrawColor(couleur[0], couleur[1], couleur[2]);
      doc.setLineWidth(epaisseur);
      doc.line(G, y, G + L, y);
    }
    y += 0.1;
  };

  const saut = (h: number) => {
    y += h;
  };

  const pageSuivante = (besoin: number) => {
    if (y + besoin <= hauteurPage) return;
    if (dessiner) doc.addPage();
    y = G;
  };

  // ── En-tête ──
  const largeurGauche = ticket ? L : L * 0.55;
  if (ticket) {
    saut(texte(m.boutique.nom.toUpperCase(), G + L / 2, 10, { gras: true, align: "center" }));
    for (const l of [m.boutique.adresse, m.boutique.telephone, m.boutique.nifStat]) {
      if (l) saut(texte(l, G + L / 2, 7, { couleur: GRIS, align: "center" }) + 0.5);
    }
    saut(2);
    filet(FILET);
    saut(2);
    saut(texte(m.intitule.toUpperCase(), G + L / 2, 8, { gras: true, align: "center" }));
    saut(2);
    filet(FILET);
    saut(2);
  } else {
    const yDepart = y;
    saut(texte(m.boutique.nom.toUpperCase(), G, 12, { gras: true, largeur: largeurGauche }));
    saut(1);
    for (const l of [
      m.boutique.sousTitre,
      m.boutique.adresse,
      [m.boutique.telephone, m.boutique.email].filter(Boolean).join(" · ") || undefined,
      m.boutique.nifStat,
    ]) {
      if (l) saut(texte(l, G, 7.5, { couleur: GRIS, largeur: largeurGauche }) + 0.6);
    }
    const yGauche = y;

    // Bloc de droite, reparti du haut de l'en-tête.
    y = yDepart;
    const xDroite = G + L;
    saut(texte(m.intitule.toUpperCase(), xDroite, 7, { couleur: GRIS_CLAIR, align: "right" }));
    saut(1);
    saut(texte(m.reference, xDroite, 15, { gras: true, align: "right" }));
    saut(1.5);
    for (const item of m.meta) {
      saut(
        texte(`${item.label} : ${item.value}`, xDroite, 7.5, {
          couleur: GRIS,
          align: "right",
        }) + 0.6,
      );
    }
    y = Math.max(yGauche, y);
    saut(4);
    filet(FILET_FIN);
    saut(4);
  }

  // ── Encart de portée ──
  if (m.portee?.length) {
    const hauteurEncart = ticket ? m.portee.length * 4 + 2 : 12;
    if (!ticket && dessiner) {
      doc.setFillColor(FOND[0], FOND[1], FOND[2]);
      doc.setDrawColor(FILET_FIN[0], FILET_FIN[1], FILET_FIN[2]);
      doc.roundedRect(G, y, L, hauteurEncart, 1.5, 1.5, "FD");
    }
    if (ticket) {
      for (const item of m.portee) {
        if (dessiner) {
          set(GRIS, 7);
          doc.text(item.label, G, y + 2.5);
          set(ENCRE, 7);
          doc.text(item.value, G + L, y + 2.5, { align: "right" });
        }
        saut(4);
      }
      saut(1);
      filet(FILET);
      saut(2);
    } else {
      const pas = L / m.portee.length;
      m.portee.forEach((item, i) => {
        if (!dessiner) return;
        const x = G + 3 + i * pas;
        set(GRIS_CLAIR, 6.5, true);
        doc.text(item.label.toUpperCase(), x, y + 4.5);
        set(ENCRE, 9, true);
        doc.text(item.value, x, y + 9);
      });
      saut(hauteurEncart + 6);
    }
  }

  // ── Lignes ──
  if (m.lignes.length === 0) {
    saut(texte(m.vide ?? "Aucune ligne.", G + L / 2, 8, { couleur: GRIS, align: "center" }) + 6);
  } else if (ticket) {
    for (const ligne of m.lignes) {
      pageSuivante(10);
      const premiere = m.colonnes[0];
      saut(texte(ligne.cells[premiere.key] ?? "", G, 8, { gras: true }) + 0.5);
      const reste = m.colonnes.slice(1);
      if (dessiner && reste.length) {
        set(GRIS, 7);
        doc.text(
          reste
            .slice(0, -1)
            .map((c) => ligne.cells[c.key])
            .filter(Boolean)
            .join("  ×  "),
          G,
          y + 2.5,
        );
        set(ENCRE, 7, true);
        doc.text(ligne.cells[reste[reste.length - 1].key] ?? "", G + L, y + 2.5, {
          align: "right",
        });
      }
      saut(4);
      if (ligne.hint) saut(texte(ligne.hint, G, 6.5, { couleur: GRIS_CLAIR }) + 1);
      saut(1.5);
    }
    saut(1);
    filet(FILET);
    saut(2);
  } else {
    // Répartition des colonnes : celles sans part déclarée se partagent
    // ce qui reste.
    const declarees = m.colonnes.reduce((a, c) => a + (c.part ?? 0), 0);
    const libres = m.colonnes.filter((c) => c.part === undefined).length;
    const parts = m.colonnes.map((c) => c.part ?? (100 - declarees) / Math.max(1, libres));
    const x: number[] = [];
    let acc = G;
    for (const part of parts) {
      x.push(acc);
      acc += (part / 100) * L;
    }
    const largeurs = parts.map((p) => (p / 100) * L);

    const enTete = () => {
      if (dessiner) {
        set(GRIS, 6.5, true);
        m.colonnes.forEach((c, i) => {
          const ax = c.align === "right" ? x[i] + largeurs[i] : c.align === "center" ? x[i] + largeurs[i] / 2 : x[i];
          doc.text(c.label.toUpperCase(), ax, y + 3, { align: c.align ?? "left" });
        });
      }
      saut(5);
      filet(FILET, 0.3);
      saut(2);
    };

    enTete();

    m.lignes.forEach((ligne, index) => {
      const hauteurLigne = ligne.hint ? 9 : 6.5;
      if (y + hauteurLigne > hauteurPage) {
        if (dessiner) doc.addPage();
        y = G;
        enTete();
      }
      if (dessiner && index % 2 === 1) {
        doc.setFillColor(FOND[0], FOND[1], FOND[2]);
        doc.rect(G, y - 1, L, hauteurLigne, "F");
      }
      if (dessiner) {
        m.colonnes.forEach((c, i) => {
          set(i === 0 ? ENCRE : GRIS, 7.5, i === m.colonnes.length - 1);
          const ax = c.align === "right" ? x[i] + largeurs[i] : c.align === "center" ? x[i] + largeurs[i] / 2 : x[i];
          const contenu = doc.splitTextToSize(ligne.cells[c.key] ?? "", largeurs[i] - 2)[0] ?? "";
          doc.text(contenu, ax, y + 2.5, { align: c.align ?? "left" });
        });
        if (ligne.hint) {
          set(GRIS_CLAIR, 6.5);
          doc.text(doc.splitTextToSize(ligne.hint, largeurs[0] * 2)[0] ?? "", x[0], y + 6);
        }
      }
      saut(hauteurLigne);
      filet(FILET_FIN, 0.15);
    });
    saut(4);
  }

  // ── Totaux ──
  const largeurTotaux = ticket ? L : Math.min(L, 60);
  const xTotaux = G + L - largeurTotaux;
  for (const t of m.totaux) {
    pageSuivante(8);
    if (t.fort) {
      if (dessiner) {
        doc.setDrawColor(ENCRE[0], ENCRE[1], ENCRE[2]);
        doc.setLineWidth(0.5);
        doc.line(xTotaux, y, G + L, y);
      }
      saut(2.5);
    }
    if (dessiner) {
      set(t.fort ? ENCRE : GRIS, t.fort ? 8 : 7.5, t.fort);
      doc.text(t.fort ? t.label.toUpperCase() : t.label, xTotaux, y + 2.5);
      set(ENCRE, t.fort ? 11 : 7.5, t.fort);
      doc.text(t.value, G + L, y + 2.5, { align: "right" });
    }
    saut(t.fort ? 6 : 4.5);
  }

  // ── Pied ──
  if (m.pied) {
    saut(ticket ? 2 : 6);
    filet(FILET_FIN);
    saut(3);
    saut(texte(m.pied.titre, G, 7, { couleur: GRIS, gras: true }) + 1);
    saut(texte(m.pied.texte, G, 6.8, { couleur: GRIS }));
  }

  return y + G;
}

/**
 * Construit le PDF et déclenche son téléchargement.
 *
 * Pour un rouleau, la hauteur n'est pas connue d'avance : le document
 * est composé une première fois à vide, seulement pour la mesurer, puis
 * recréé à la hauteur exacte de son contenu. Un ticket sort ainsi en une
 * seule page à sa taille réelle, sans blanc de fin.
 */
export async function telechargerPdf(model: PdfDocumentModel, paper: PaperFormat): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pap = PAPIERS[paper.id] ?? PAPIERS.a4;

  let hauteur = pap.hauteur;
  if (hauteur === null) {
    const mesure = new jsPDF({ unit: "mm", format: [pap.largeur, 2000] });
    hauteur = Math.max(60, Math.ceil(composer(mesure, model, paper, false)));
  }

  const doc = new jsPDF({
    unit: "mm",
    format: [pap.largeur, hauteur],
    orientation: "portrait",
  });
  composer(doc, model, paper, true);
  doc.save(`${model.fileName}.pdf`);
}

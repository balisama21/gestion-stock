import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Printer } from "lucide-react";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import type { Document, LigneDocument } from "./lib/buildDocument";
import { exporterFeuillesImage, exporterFeuillesPdf, exporterRouleauPdf } from "./lib/exporter";
import { imprimerFeuille } from "./lib/imprimer";
import {
  mentionDePage,
  repartirLesPages,
  type MesuresDuDocument,
  type Page,
} from "./lib/pagination";
import { variablesDeCouleur, type ModeleDocument, type ReglagesDocuments } from "./lib/reglages";
import { resoudreType } from "./lib/resolveur";
import { Bandeau } from "./templates/Bandeau";
import { Classique } from "./templates/Classique";
import { Compact } from "./templates/Compact";
import { Epure } from "./templates/Epure";
import { Ticket } from "./templates/Ticket";
import type { ProprietesModele } from "./parts/squelette";
import { ContexteEquivalents } from "./lib/equivalents";
import { useDevisesDuDocument } from "../../lib/contexteDevises";
import "./index.css";

/**
 * L'APERÇU D'UN DOCUMENT, ET LES TROIS FAÇONS DE LE SORTIR
 *
 * ── LE DOCUMENT NE SE REPLIE JAMAIS ────────────────────────────────
 *
 * Les documents de la v1 sont en `width: 100%` plafonnés par une
 * `max-width` : sur un téléphone ils se remettent en page à trois
 * cent vingt pixels, et comme le PDF est une PHOTOGRAPHIE du bloc
 * affiché, le fichier sort avec une colonne par syllabe — « PRO /
 * DUI / T » en en-tête. Constaté sur un vrai fichier.
 *
 * Ici la feuille fait 210 mm et le rouleau 80 ou 58, toujours. Ce qui
 * s'adapte à l'écran, c'est une mise à l'échelle par `transform`, qui
 * réduit la taille APPARENTE sans toucher à la mise en page. Vérifié :
 * le PDF produit depuis une fenêtre de 375 px et celui produit depuis
 * 1000 px ne diffèrent pas d'un octet, flux image compris.
 *
 * ── COMMENT LA PAGINATION SE DÉCIDE ────────────────────────────────
 *
 * En deux rendus, et il en faut deux.
 *
 * Le PREMIER pose tout le document sur une feuille unique, hors
 * champ. On y mesure ce qu'aucun calcul ne peut deviner : la hauteur
 * réelle de l'en-tête une fois l'adresse repliée, celle de chaque
 * ligne selon la longueur de sa désignation, celle de la clôture
 * selon les options actives.
 *
 * Le SECOND rend les vraies feuilles, une par page. `useLayoutEffect`
 * enchaîne les deux avant que le navigateur ne peigne : l'utilisateur
 * ne voit jamais la feuille de mesure.
 *
 * Un rouleau, lui, ne se pagine pas : il se coupe au bout du contenu.
 */

/** Millimètres → pixels CSS, à 96 points par pouce. */
const px = (mm: number) => Math.round((mm * 96) / 25.4);

const HAUTEUR_FEUILLE = px(297);

export type FormatDocument = "a4" | "t80" | "t58";

const LARGEUR_MM: Record<FormatDocument, number> = { a4: 210, t80: 80, t58: 58 };

const MODELES: Record<ModeleDocument, React.FC<ProprietesModele>> = {
  classique: Classique,
  bandeau: Bandeau,
  epure: Epure,
  compact: Compact,
};

/**
 * Relève sur une feuille rendue les hauteurs dont le découpage a besoin.
 *
 * Rend `null` tant que la feuille n'est pas mise en page — au premier
 * rendu côté serveur, par exemple, où rien n'a de hauteur.
 */
function relever(feuille: HTMLElement): MesuresDuDocument | null {
  const pad = feuille.querySelector<HTMLElement>(".doc-pad");
  const tete = feuille.querySelector<HTMLElement>('[data-doc="tete"]');
  const thead = feuille.querySelector<HTMLElement>("thead");
  if (!pad || !tete || !thead || tete.offsetHeight === 0) return null;

  const style = getComputedStyle(pad);
  const interligne = parseFloat(style.rowGap) || 0;
  const cloture = feuille.querySelector<HTMLElement>('[data-doc="cloture"]');
  const ressort = feuille.querySelector<HTMLElement>('[data-doc="ressort"]');
  const clotureBrute = cloture?.offsetHeight ?? 0;

  /*
   * LES MARGES SE LISENT, ELLES NE SE DÉDUISENT PAS.
   *
   * Une première version les calculait en retranchant les trois
   * groupes de la hauteur de la feuille. Le raisonnement se tenait,
   * mais `offsetHeight` MENT quand le contenu déborde de son
   * conteneur — ce qui est précisément le cas de la feuille de
   * mesure, qui porte tout le document. Les marges ressortaient
   * négatives, donc nulles, et le découpage croyait disposer de cent
   * six pixels de plus qu'en réalité : la première page d'une facture
   * de vingt-cinq lignes dépassait de deux lignes.
   *
   * Lues sur le bloc rembourré, elles sont justes quel que soit le
   * contenu. Le Bandeau, dont l'en-tête déborde par le haut, y gagne
   * quelques millimètres inutilisés sur sa première page : c'est le
   * bon sens de l'erreur — mieux vaut une page un peu moins remplie
   * qu'une page qui déborde.
   */
  const marges = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  /*
   * Deux pixels de garde. Les filets se comptent en dixièmes de
   * millimètre et les hauteurs de ligne en fractions de pixel : sans
   * cette marge, le modèle Épuré sortait à 1124 pixels pour une page
   * qui en fait 1123, et un pixel de trop suffit à faire imprimer une
   * page blanche de plus.
   */
  const GARDE = 2;

  return {
    hauteurUtile: HAUTEUR_FEUILLE - marges - GARDE,
    tete: tete.offsetHeight,
    // Posée en dur par `.doc-tete-suite` : 18 mm, pour que le
    // découpage la connaisse avant que ces pages n'existent.
    teteSuite: px(18),
    enTeteTableau: thead.offsetHeight,
    lignes: [...feuille.querySelectorAll<HTMLElement>("tbody tr")].map((l) => l.offsetHeight),
    /*
     * La clôture est mesurée SANS son ressort. Ce ressort est ce qui
     * pousse le pied en bas de la feuille : sur une facture d'une
     * ligne il fait vingt centimètres, et la clôture semblerait ne
     * tenir sur aucune page.
     */
    cloture: Math.max(0, clotureBrute - (ressort?.offsetHeight ?? 0)),
    interligne,
  };
}

interface DocumentPreviewProps {
  document: Document;
  reglages: ReglagesDocuments;
  /** Feuille A4 ou rouleau de caisse. Par défaut, la feuille. */
  format?: FormatDocument;
  /** Force un modèle le temps d'une impression, sans toucher au réglage. */
  modele?: ModeleDocument;
  /** Masque les boutons : l'aperçu en direct des réglages n'en a pas. */
  sansActions?: boolean;
  /**
   * Appelé quand les feuilles sont découpées et posées.
   *
   * Sert à l'export groupé, qui monte cet aperçu hors champ, attend que
   * la pagination soit faite, photographie les feuilles, puis passe au
   * document suivant. Sans ce signal, il faudrait deviner combien de
   * temps la mise en page prend — et un document photographié trop tôt
   * sort sur une seule feuille, tout écrasé.
   */
  onPret?: (feuilles: HTMLElement[]) => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document: doc,
  reglages,
  format = "a4",
  modele,
  sansActions,
  onPret,
}) => {
  const rouleau = format !== "a4";
  const largeurMm = LARGEUR_MM[format];
  const largeurCible = px(largeurMm);
  /*
   * Le modèle et la couleur suivent le TYPE du document : une boutique
   * peut vouloir ses devis en épuré et ses factures en classique. À
   * défaut de réglage propre au type, ce sont ceux de la boutique —
   * `resoudreType` s'en charge, et lui seul connaît l'ordre.
   */
  const regle = resoudreType(reglages, doc.type);
  // Le rouleau a son propre réglage : on ne veut pas forcément les mêmes devises qu'en A4.
  const equivalents = useDevisesDuDocument(rouleau ? "ticket" : doc.type);
  const nomModele = modele ?? regle.modele;
  const Modele = MODELES[nomModele] ?? Classique;

  const scene = useRef<HTMLDivElement>(null);
  const feuilles = useRef<(HTMLDivElement | null)[]>([]);
  const [echelle, setEchelle] = useState(1);
  const [hauteur, setHauteur] = useState<number | null>(null);
  /*
   * LE DÉCOUPAGE SE REMET À ZÉRO PENDANT LE RENDU, PAS DANS UN EFFET.
   *
   * Un effet s'exécute APRÈS le rendu. Entre le moment où le document
   * change et celui où l'effet passe, le composant appliquait donc
   * l'ANCIEN découpage au NOUVEAU document : sur une facture de vingt-
   * cinq lignes remplacée par une d'une ligne, il cherchait encore les
   * rangs 1 à 24, qui n'existent plus. `Cannot read properties of
   * undefined (reading 'designation')` — l'aperçu entier disparaissait.
   *
   * Attrapé en Chromium sans interface, en passant d'un document à
   * l'autre. En production, c'est ce qui se serait passé chaque fois
   * qu'on ouvre une seconde vente sans fermer la première.
   *
   * La clé porte l'empreinte du document : tant qu'elles diffèrent, la
   * mesure d'avant ne vaut plus rien.
   */
  const [mesure, setMesure] = useState<{ cle: string; pages: Page[] | null }>({
    cle: "",
    pages: null,
  });
  const [exportEnCours, setExportEnCours] = useState<null | "pdf" | "image">(null);
  const [erreur, setErreur] = useState<string | null>(null);

  /** Tous les rangs de lignes : la répartition d'avant la mesure. */
  const toutesLesLignes = useMemo(() => doc.lignes.map((_, i) => i), [doc.lignes]);

  // Une nouvelle mesure s'impose dès que le contenu, le modèle ou le
  // format change.
  const empreinte = useMemo(
    () =>
      `${format}|${nomModele}|${doc.nomDeFichier}|${doc.lignes.length}|${doc.totaux.total}|${equivalents.map((e) => e.code).join(",")}`,
    [format, nomModele, doc, equivalents],
  );

  if (mesure.cle !== empreinte) setMesure({ cle: empreinte, pages: null });
  const pages = mesure.cle === empreinte ? mesure.pages : null;
  const poserLesPages = useCallback(
    (p: Page[]) => setMesure({ cle: empreinte, pages: p }),
    [empreinte],
  );

  /*
   * Les nœuds réellement à l'écran, et eux seuls.
   *
   * Le tableau de références n'est PAS vidé quand le document change :
   * les callbacks de `ref` s'exécutent avant les effets, et un effet
   * qui le viderait effacerait les nœuds qu'on vient d'y poser — la
   * mesure ne trouvait alors plus rien, et la feuille restait
   * invisible pour toujours. Constaté en Chromium sans interface, où
   * rien ne provoque le second rendu qui masquait le défaut.
   *
   * On tronque donc à la lecture plutôt que d'effacer à l'écriture.
   */
  const noeudsPoses = useCallback(
    () =>
      feuilles.current
        .slice(0, rouleau ? 1 : (pages?.length ?? 1))
        .filter((n): n is HTMLDivElement => n !== null),
    [rouleau, pages],
  );

  /** La place disponible, et l'échelle qui en découle. */
  const mettreALEchelle = useCallback(() => {
    const cadre = scene.current;
    if (!cadre) return;
    const dispo = cadre.clientWidth;
    const e = dispo > 0 ? Math.min(1, dispo / largeurCible) : 1;
    setEchelle(e);
    const noeuds = noeudsPoses();
    const total = noeuds.reduce((n, f) => n + f.offsetHeight, 0);
    // Une transformation ne change pas la place occupée dans le flux :
    // sans cette hauteur, une feuille à 40 % laisserait sous elle le
    // vide de sa taille entière.
    setHauteur(total > 0 ? total * e + Math.max(0, noeuds.length - 1) * 16 * e : null);
  }, [largeurCible, noeudsPoses]);

  useLayoutEffect(() => {
    // Un rouleau ne se pagine pas : il n'y a rien à mesurer.
    if (rouleau || pages !== null) {
      mettreALEchelle();
      return;
    }

    // Passe de mesure : une seule feuille porte tout le document.
    const mesures = feuilles.current[0] ? relever(feuilles.current[0]) : null;
    if (mesures) {
      poserLesPages(repartirLesPages(mesures));
      return;
    }

    /*
     * La mesure n'a rien donné — polices pas encore prêtes, feuille
     * pas encore mise en page. On réessaie à l'image suivante, puis
     * on renonce et on pose tout sur une seule feuille : un document
     * trop long vaut infiniment mieux qu'un écran vide devant
     * quelqu'un qui voulait imprimer une facture.
     */
    const image = requestAnimationFrame(() => {
      const seconde = feuilles.current[0] ? relever(feuilles.current[0]) : null;
      poserLesPages(seconde ? repartirLesPages(seconde) : [toutesLesLignes]);
    });
    return () => cancelAnimationFrame(image);
  }, [rouleau, pages, mettreALEchelle, poserLesPages, toutesLesLignes]);

  /* La pagination est faite : les feuilles existent, et le photographe
     peut passer. Un rouleau n'a rien à découper, il est prêt d'emblée. */
  useEffect(() => {
    if (!onPret) return;
    if (!rouleau && pages === null) return;
    const noeuds = noeudsPoses();
    if (noeuds.length > 0) onPret(noeuds);
  }, [onPret, rouleau, pages, noeudsPoses]);

  useLayoutEffect(() => {
    const cadre = scene.current;
    if (!cadre || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mettreALEchelle);
    obs.observe(cadre);
    return () => obs.disconnect();
  }, [mettreALEchelle]);

  const exporter = async (type: "pdf" | "image") => {
    const noeuds = noeudsPoses();
    if (noeuds.length === 0 || exportEnCours) return;
    setExportEnCours(type);
    setErreur(null);
    try {
      if (type === "image") await exporterFeuillesImage(noeuds, doc.nomDeFichier);
      else if (rouleau) await exporterRouleauPdf(noeuds[0], largeurMm, doc.nomDeFichier);
      else await exporterFeuillesPdf(noeuds, doc.nomDeFichier);
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même.
      if (reprendreApresDeploiement(err)) return;
      setErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  // Tant que la mesure n'a pas eu lieu : une feuille unique, tout dessus.
  const repartition: Page[] = pages ?? [toutesLesLignes];
  const enMesure = !rouleau && pages === null;

  const poser = (rang: number) => (n: HTMLDivElement | null) => {
    feuilles.current[rang] = n;
  };

  return (
    <ContexteEquivalents.Provider value={equivalents}>
      <div className="doc-racine" style={variablesDeCouleur(regle.couleur) as React.CSSProperties}>
        {erreur && (
          <p
            role="alert"
            className="no-print mb-3 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
          >
            {erreur}
          </p>
        )}

        <div className="doc-scene" ref={scene}>
          <div
            className="doc-echelle"
            style={{
              transform: `scale(${echelle})`,
              height: hauteur ?? undefined,
              // La feuille de mesure ne doit jamais être vue : elle
              // porte tout le document sur une page et déborderait.
              visibility: enMesure ? "hidden" : undefined,
            }}
          >
            {/*
             * `printable-receipt` est l'accroche que la feuille de style
             * d'impression de l'application connaît déjà : elle masque le
             * reste de la modale et neutralise les conteneurs qui
             * rogneraient le document. La reprendre évite de réécrire un
             * travail qui a demandé plusieurs corrections.
             */}
            {rouleau ? (
              <div
                className={`doc-ticket printable-receipt${format === "t58" ? " doc-ticket--58" : ""}`}
                ref={poser(0)}
              >
                <Ticket
                  document={doc}
                  reglages={{ ...reglages.ticket, largeur: format === "t58" ? 58 : 80 }}
                  date={doc.meta.find((m) => m.libelle === "Date")?.valeur ?? ""}
                />
              </div>
            ) : (
              repartition.map((indices, rang) => (
                <div
                  className={`doc-feuille printable-receipt m-${nomModele}`}
                  key={rang}
                  ref={poser(rang)}
                >
                  <Modele
                    document={doc}
                    /* Le filet de sécurité, en plus de la remise à zéro
                     ci-dessus : un rang qui ne désigne plus rien est
                     ignoré, jamais passé tel quel au modèle. */
                    lignes={indices
                      .map((i) => doc.lignes[i])
                      .filter((l): l is LigneDocument => l !== undefined)}
                    premiere={rang === 0}
                    derniere={rang === repartition.length - 1}
                    pagination={doc.paginer ? mentionDePage(rang, repartition.length) : null}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {!sansActions && (
          <div className="no-print mt-4 flex flex-wrap items-center justify-end gap-2">
            {!rouleau && repartition.length > 1 && (
              <span className="mr-auto text-xs text-muted-foreground">
                {repartition.length} pages
              </span>
            )}
            {/*
             * « Imprimer » est l'action principale, et ce n'est pas un
             * détail : elle produit du TEXTE réel, sélectionnable et net
             * à toute taille. Le PDF, lui, est une photographie du bloc
             * — fidèle, mais pesante et non sélectionnable. Le bouton
             * qui donne le meilleur résultat doit être celui qu'on
             * atteint sans réfléchir.
             */}
            <button
              type="button"
              onClick={() => imprimerFeuille(rouleau ? largeurMm : undefined)}
              className="app-btn-primary"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
            <button
              type="button"
              onClick={() => exporter("pdf")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
              title="Un PDF fidèle à l'aperçu, à envoyer ou à archiver"
            >
              <Download className="h-4 w-4" />
              {exportEnCours === "pdf" ? "Création…" : "PDF"}
            </button>
            <button
              type="button"
              onClick={() => exporter("image")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
              title="Une image par page, pratique à envoyer par messagerie"
            >
              <ImageIcon className="h-4 w-4" />
              {exportEnCours === "image" ? "Création…" : "Image"}
            </button>
          </div>
        )}
      </div>
    </ContexteEquivalents.Provider>
  );
};

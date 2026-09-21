import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Printer } from "lucide-react";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import type { Document } from "./lib/buildDocument";
import { exporterFeuillesImage, exporterFeuillesPdf } from "./lib/exporter";
import { imprimerFeuille } from "./lib/imprimer";
import {
  mentionDePage,
  repartirLesPages,
  type MesuresDuDocument,
  type Page,
} from "./lib/pagination";
import { variablesDeCouleur, type ModeleDocument, type ReglagesDocuments } from "./lib/reglages";
import { Bandeau } from "./templates/Bandeau";
import { Classique } from "./templates/Classique";
import { Compact } from "./templates/Compact";
import { Epure } from "./templates/Epure";
import type { ProprietesModele } from "./parts/squelette";
import "./index.css";

/**
 * L'APERÇU D'UN DOCUMENT, ET LES TROIS FAÇONS DE LE SORTIR
 *
 * ── LA FEUILLE NE SE REPLIE JAMAIS ─────────────────────────────────
 *
 * Les documents de la v1 sont en `width: 100%` plafonnés par une
 * `max-width` : sur un téléphone ils se remettent en page à trois
 * cent vingt pixels, et comme le PDF est une PHOTOGRAPHIE du bloc
 * affiché, le fichier sort avec une colonne par syllabe — « PRO /
 * DUI / T » en en-tête. Constaté sur un vrai fichier.
 *
 * Ici la feuille fait 210 mm, toujours. Ce qui s'adapte à l'écran,
 * c'est une mise à l'échelle par `transform`, qui réduit la taille
 * APPARENTE sans toucher à la mise en page. Vérifié : le PDF produit
 * depuis une fenêtre de 375 px et celui produit depuis 1000 px ne
 * diffèrent pas d'un octet, flux image compris.
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
 */

/** 210 mm et 297 mm, en pixels CSS à 96 points par pouce. */
const LARGEUR_FEUILLE = Math.round((210 * 96) / 25.4);
const HAUTEUR_FEUILLE = Math.round((297 * 96) / 25.4);

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
   * négatives, donc nulles, et le découpage croyait disposer de
   * cent six pixels de plus qu'en réalité : la première page d'une
   * facture de vingt-cinq lignes dépassait de deux lignes.
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
   * quatrième page blanche.
   */
  const GARDE = 2;

  return {
    hauteurUtile: HAUTEUR_FEUILLE - marges - GARDE,
    tete: tete.offsetHeight,
    // Posée en dur par `.doc-tete-suite` : 18 mm, pour que le
    // découpage la connaisse avant que ces pages n'existent.
    teteSuite: Math.round((18 * 96) / 25.4),
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
  /** Force un modèle le temps d'une impression, sans toucher au réglage. */
  modele?: ModeleDocument;
  /** Masque les boutons : l'aperçu en direct des réglages n'en a pas. */
  sansActions?: boolean;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document: doc,
  reglages,
  modele,
  sansActions,
}) => {
  const Modele = MODELES[modele ?? reglages.modele] ?? Classique;

  const scene = useRef<HTMLDivElement>(null);
  const feuilles = useRef<(HTMLDivElement | null)[]>([]);
  const [echelle, setEchelle] = useState(1);
  const [hauteur, setHauteur] = useState<number | null>(null);
  const [pages, setPages] = useState<Page[] | null>(null);
  const [exportEnCours, setExportEnCours] = useState<null | "pdf" | "image">(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Une nouvelle mesure s'impose dès que le contenu ou le modèle change.
  const empreinte = useMemo(
    () => `${Modele.name}|${doc.nomDeFichier}|${doc.lignes.length}|${doc.totaux.total}`,
    [Modele, doc],
  );

  useLayoutEffect(() => {
    setPages(null);
  }, [empreinte]);

  /** La place disponible, et l'échelle qui en découle. */
  const mettreALEchelle = useCallback(() => {
    const cadre = scene.current;
    if (!cadre) return;
    const dispo = cadre.clientWidth;
    const e = dispo > 0 ? Math.min(1, dispo / LARGEUR_FEUILLE) : 1;
    setEchelle(e);
    const total = feuilles.current
      .filter((f): f is HTMLDivElement => f !== null)
      .reduce((n, f) => n + f.offsetHeight, 0);
    // Une transformation ne change pas la place occupée dans le flux :
    // sans cette hauteur, une feuille à 40 % laisserait sous elle le
    // vide de sa taille entière.
    setHauteur(total > 0 ? total * e + (pages?.length ?? 1) * 16 * e : null);
  }, [pages]);

  useLayoutEffect(() => {
    // Passe de mesure : une seule feuille porte tout le document.
    if (pages === null) {
      const feuille = feuilles.current[0];
      if (feuille) {
        const mesures = relever(feuille);
        if (mesures) setPages(repartirLesPages(mesures));
      }
      return;
    }
    mettreALEchelle();
  }, [pages, mettreALEchelle]);

  useLayoutEffect(() => {
    const cadre = scene.current;
    if (!cadre || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mettreALEchelle);
    obs.observe(cadre);
    return () => obs.disconnect();
  }, [mettreALEchelle]);

  const exporter = async (type: "pdf" | "image") => {
    const noeuds = feuilles.current.filter((f): f is HTMLDivElement => f !== null);
    if (noeuds.length === 0 || exportEnCours) return;
    setExportEnCours(type);
    setErreur(null);
    try {
      if (type === "pdf") await exporterFeuillesPdf(noeuds, doc.nomDeFichier);
      else await exporterFeuillesImage(noeuds, doc.nomDeFichier);
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
  const repartition: Page[] = pages ?? [doc.lignes.map((_, i) => i)];
  const enMesure = pages === null;
  const classeModele = `m-${(modele ?? reglages.modele) as string}`;

  return (
    <div className="doc-racine" style={variablesDeCouleur(reglages.couleur) as React.CSSProperties}>
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
          {repartition.map((indices, rang) => (
            <div
              /*
               * `printable-receipt` est l'accroche que la feuille de
               * style d'impression de l'application connaît déjà :
               * elle masque le reste de la modale et neutralise les
               * conteneurs qui rogneraient le document. La reprendre
               * évite de réécrire un travail qui a demandé plusieurs
               * corrections.
               */
              className={`doc-feuille printable-receipt ${classeModele}`}
              key={rang}
              ref={(n) => {
                feuilles.current[rang] = n;
              }}
            >
              <Modele
                document={doc}
                lignes={indices.map((i) => doc.lignes[i])}
                premiere={rang === 0}
                derniere={rang === repartition.length - 1}
                pagination={mentionDePage(rang, repartition.length)}
              />
            </div>
          ))}
        </div>
      </div>

      {!sansActions && (
        <div className="no-print mt-4 flex flex-wrap items-center justify-end gap-2">
          {repartition.length > 1 && (
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
          <button type="button" onClick={imprimerFeuille} className="app-btn-primary">
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
  );
};

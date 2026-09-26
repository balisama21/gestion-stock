import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import "./index.css";
import "./templates/reappro.css";
import type { StoreSettings } from "../../types";
import { repartirLesPages, mentionDePage, type Page } from "./lib/pagination";
import { exporterFeuillesPdf } from "./lib/exporter";
import { imprimerFeuille } from "./lib/imprimer";
import { dateCourte } from "./lib/format";
import { variablesDeCouleur } from "./lib/reglages";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import { nomDeFichier } from "../../lib/documentExport";
import {
  groupeEnCours,
  rangeesDeLaFeuille,
  recollerLesGroupes,
  type LigneReappro,
  type RangeeFeuille,
} from "../../lib/reapprovisionnement";

/**
 * Feuille de réapprovisionnement A4 : même scène, même pagination
 * mesurée, même impression et même PDF que les autres documents.
 * Mise en page propre : c'est une liste de travail, pas une pièce commerciale.
 */

const px = (mm: number) => Math.round((mm * 96) / 25.4);
const HAUTEUR_FEUILLE = px(297);

interface FeuilleReapproProps {
  lignes: LigneReappro[];
  grouper: boolean;
  /** Colonne fournisseur (hors regroupement), selon les droits de la personne. */
  montrerFournisseur: boolean;
  date: string;
  settings?: StoreSettings;
  couleur: string;
}

const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

function relever(feuille: HTMLElement, grouper: boolean) {
  const pad = feuille.querySelector<HTMLElement>(".doc-pad");
  const tete = feuille.querySelector<HTMLElement>('[data-doc="tete"]');
  const thead = feuille.querySelector<HTMLElement>("thead");
  if (!pad || !tete || !thead || tete.offsetHeight === 0) return null;
  const style = getComputedStyle(pad);
  const marges = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const lignes = [...feuille.querySelectorAll<HTMLElement>("tbody tr")].map((l) => l.offsetHeight);
  const groupe = feuille.querySelector<HTMLElement>("tbody tr.rp-groupe")?.offsetHeight ?? 0;
  return {
    hauteurUtile: HAUTEUR_FEUILLE - marges - 2,
    tete: tete.offsetHeight,
    // En-tête de suite (18 mm) + rappel du fournisseur en cours.
    teteSuite: px(18) + (grouper ? groupe : 0),
    enTeteTableau: thead.offsetHeight,
    lignes,
    cloture: feuille.querySelector<HTMLElement>('[data-doc="cloture"]')?.offsetHeight ?? 0,
    interligne: parseFloat(style.rowGap) || 0,
  };
}

export const FeuilleReappro: React.FC<FeuilleReapproProps> = ({
  lignes,
  grouper,
  montrerFournisseur,
  date,
  settings,
  couleur,
}) => {
  const rangees = useMemo(() => rangeesDeLaFeuille(lignes, grouper), [lignes, grouper]);
  const colonneFournisseur = montrerFournisseur && !grouper;
  const boutique = settings?.storeName?.trim() || "";
  const fichier = nomDeFichier("Reapprovisionnement", boutique || "boutique", date);

  const scene = useRef<HTMLDivElement>(null);
  const feuilles = useRef<(HTMLDivElement | null)[]>([]);
  const [echelle, setEchelle] = useState(1);
  const [hauteur, setHauteur] = useState<number | null>(null);
  const empreinte = `${grouper}|${colonneFournisseur}|${rangees.length}|${lignes.map((l) => `${l.id}:${l.quantite}`).join(",")}`;
  const [mesure, setMesure] = useState<{ cle: string; pages: Page[] | null }>({
    cle: "",
    pages: null,
  });
  if (mesure.cle !== empreinte) setMesure({ cle: empreinte, pages: null });
  const pages = mesure.cle === empreinte ? mesure.pages : null;
  const toutes = useMemo(() => rangees.map((_, i) => i), [rangees]);
  const repartition: Page[] = pages ?? [toutes];
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const noeuds = useCallback(
    () =>
      feuilles.current.slice(0, pages?.length ?? 1).filter((n): n is HTMLDivElement => n !== null),
    [pages],
  );

  const mettreALEchelle = useCallback(() => {
    const cadre = scene.current;
    if (!cadre) return;
    const e = cadre.clientWidth > 0 ? Math.min(1, cadre.clientWidth / px(210)) : 1;
    setEchelle(e);
    const n = noeuds();
    const total = n.reduce((s, f) => s + f.offsetHeight, 0);
    setHauteur(total > 0 ? total * e + Math.max(0, n.length - 1) * 16 * e : null);
  }, [noeuds]);

  useLayoutEffect(() => {
    if (pages !== null) {
      mettreALEchelle();
      return;
    }
    const poser = () => {
      const m = feuilles.current[0] ? relever(feuilles.current[0], grouper) : null;
      if (!m) return false;
      setMesure({ cle: empreinte, pages: recollerLesGroupes(repartirLesPages(m), rangees) });
      return true;
    };
    if (poser()) return;
    const image = requestAnimationFrame(() => {
      if (!poser()) setMesure({ cle: empreinte, pages: [toutes] });
    });
    return () => cancelAnimationFrame(image);
  }, [pages, mettreALEchelle, grouper, empreinte, rangees, toutes]);

  useLayoutEffect(() => {
    const cadre = scene.current;
    if (!cadre || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mettreALEchelle);
    obs.observe(cadre);
    return () => obs.disconnect();
  }, [mettreALEchelle]);

  const exporter = async () => {
    const n = noeuds();
    if (n.length === 0 || exportEnCours) return;
    setExportEnCours(true);
    setErreur(null);
    try {
      await exporterFeuillesPdf(n, fichier);
    } catch (err) {
      if (reprendreApresDeploiement(err)) return;
      setErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(false);
    }
  };

  const nbColonnes = colonneFournisseur ? 8 : 7;
  const titre = "Feuille de réapprovisionnement";

  const rangee = (r: RangeeFeuille, i: number) =>
    r.type === "groupe" ? (
      <tr key={`g${i}`} className="rp-groupe">
        <td colSpan={nbColonnes}>
          {r.fournisseur || "Sans fournisseur"}
          <span className="rp-nb">
            {r.nombre} produit{r.nombre > 1 ? "s" : ""}
          </span>
        </td>
      </tr>
    ) : (
      <tr key={r.ligne.id}>
        <td className="rp-case">
          <span aria-hidden="true" />
        </td>
        <td className="rp-produit">
          <span className="rp-nom">{r.ligne.produit}</span>
          {r.ligne.reference && <span className="rp-ref">réf. {r.ligne.reference}</span>}
        </td>
        <td className="rp-num">{nombre(r.ligne.stock)}</td>
        <td className="rp-num">{nombre(r.ligne.seuil)}</td>
        <td className="rp-num">{nombre(r.ligne.cible)}</td>
        <td className="rp-num rp-qte rp-col-qte">
          {nombre(r.ligne.quantite)}
          {r.ligne.unite && <span className="rp-unite"> {r.ligne.unite}</span>}
        </td>
        {colonneFournisseur && <td className="rp-col-fournisseur">{r.ligne.fournisseur}</td>}
        <td className="rp-notes rp-col-notes" />
      </tr>
    );

  return (
    <div className="doc-racine" style={variablesDeCouleur(couleur) as React.CSSProperties}>
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
            visibility: pages === null ? "hidden" : undefined,
          }}
        >
          {repartition.map((indices, rang) => {
            const pagination = mentionDePage(rang, repartition.length);
            const suite = grouper && indices.length > 0 ? groupeEnCours(rangees, indices[0]) : null;
            const derniere = rang === repartition.length - 1;
            return (
              <div
                key={rang}
                className="doc-feuille printable-receipt m-reappro"
                ref={(n) => {
                  feuilles.current[rang] = n;
                }}
              >
                <div className="doc-pad">
                  {rang === 0 ? (
                    <header className="rp-tete" data-doc="tete">
                      <div className="min0">
                        {boutique && <p className="rp-boutique">{boutique}</p>}
                        <h1 className="rp-titre">{titre}</h1>
                      </div>
                      <dl className="rp-meta">
                        <div>
                          <dt>Date</dt>
                          <dd>{dateCourte(date)}</dd>
                        </div>
                        <div>
                          <dt>Produits</dt>
                          <dd>{lignes.length}</dd>
                        </div>
                        {pagination && (
                          <div>
                            <dt>Page</dt>
                            <dd>{pagination.replace("Page ", "")}</dd>
                          </div>
                        )}
                      </dl>
                    </header>
                  ) : (
                    <header className="doc-tete-suite" data-doc="tete">
                      <span className="nom">{boutique || titre}</span>
                      <span className="ref">
                        {titre}
                        {pagination ? ` · ${pagination}` : ""}
                      </span>
                    </header>
                  )}

                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th className="rp-case" aria-label="Commandé" />
                        <th>Produit</th>
                        <th className="rp-num">Stock</th>
                        <th className="rp-num">Seuil</th>
                        <th className="rp-num">Cible</th>
                        <th className="rp-num rp-col-qte">À commander</th>
                        {colonneFournisseur && <th className="rp-col-fournisseur">Fournisseur</th>}
                        <th className="rp-col-notes">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suite !== null && (
                        <tr className="rp-groupe rp-suite">
                          <td colSpan={nbColonnes}>{(suite || "Sans fournisseur") + " (suite)"}</td>
                        </tr>
                      )}
                      {indices.map((i) => rangees[i] && rangee(rangees[i], i))}
                    </tbody>
                  </table>

                  <div className="doc-grow" data-doc="ressort" />
                  {derniere && (
                    <footer className="rp-cloture doc-insecable" data-doc="cloture">
                      <p className="rp-legende">
                        Cochez chaque ligne commandée. Quantité à commander = niveau cible − stock
                        actuel.
                      </p>
                      <div className="rp-annotations">
                        <span>Notes</span>
                      </div>
                    </footer>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="no-print mt-4 flex flex-wrap items-center justify-end gap-2">
        {repartition.length > 1 && (
          <span className="mr-auto text-xs text-muted-foreground">{repartition.length} pages</span>
        )}
        <button type="button" onClick={() => imprimerFeuille()} className="app-btn-primary">
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
        <button
          type="button"
          onClick={exporter}
          disabled={exportEnCours}
          className="app-btn-secondary"
        >
          <Download className="h-4 w-4" />
          {exportEnCours ? "Création…" : "PDF"}
        </button>
      </div>
    </div>
  );
};

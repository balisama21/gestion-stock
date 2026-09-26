import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Move,
  RotateCcw,
  Save,
} from "lucide-react";
import { SettingsToggle } from "./primitives";
import type { Document } from "../../features/documents/lib/buildDocument";
import { variablesDeCouleur, type ReglagesDocuments } from "../../features/documents/lib/reglages";
import { DocumentPreview } from "../../features/documents/DocumentPreview";
import {
  aimanterDeplacement,
  aimanterRedimension,
  BLOCS,
  blocsResolus,
  ciblesAimant,
  contraindre,
  poserBloc,
  redimensionner,
  reinitialiserDisposition,
  type Alignement,
  type BlocPose,
  type Cibles,
  type CleBloc,
  type Disposition,
  type Guide,
  type Poignee,
} from "../../features/documents/lib/disposition";
import {
  classeDuBloc,
  contenuDuBloc,
  Libre,
  styleDuBloc,
} from "../../features/documents/templates/Libre";
import "../../features/documents/index.css";

/** Pixels CSS par millimètre, à 96 points par pouce. */
const PX_MM = 96 / 25.4;
const LARGEUR_PX = 210 * PX_MM;
const HAUTEUR_PX = 297 * PX_MM;

interface Props {
  disposition: Disposition;
  /** Le document d'aperçu. Sans lui, les blocs s'affichent par leur nom. */
  document: Document | null;
  couleur: string;
  /** Les réglages de la boutique : l'aperçu montre les pages telles qu'elles sortiront. */
  reglages?: ReglagesDocuments;
  enCours: boolean;
  onFermer: (d: Disposition) => void;
  onEnregistrer: (d: Disposition) => void;
}

interface Glisse {
  id: number;
  cle: CleBloc;
  x0: number;
  y0: number;
  depart: BlocPose;
  poignee: Poignee | null;
  cibles: Cibles;
}

const POIGNEES: { cle: Poignee; x: 0 | 1; y: 0 | 1; curseur: string }[] = [
  { cle: "no", x: 0, y: 0, curseur: "nwse-resize" },
  { cle: "ne", x: 1, y: 0, curseur: "nesw-resize" },
  { cle: "so", x: 0, y: 1, curseur: "nesw-resize" },
  { cle: "se", x: 1, y: 1, curseur: "nwse-resize" },
];

const CHAMPS: { cle: "x" | "y" | "l" | "h"; nom: string }[] = [
  { cle: "x", nom: "Gauche" },
  { cle: "y", nom: "Haut" },
  { cle: "l", nom: "Largeur" },
  { cle: "h", nom: "Hauteur" },
];

const ALIGNEMENTS: { cle: Alignement; nom: string; Icone: typeof AlignLeft }[] = [
  { cle: "gauche", nom: "Aligner à gauche", Icone: AlignLeft },
  { cle: "centre", nom: "Centrer", Icone: AlignCenter },
  { cle: "droite", nom: "Aligner à droite", Icone: AlignRight },
];

const boutonIcone =
  "inline-flex h-[34px] w-[34px] items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40";

export const EditeurLibre: React.FC<Props> = ({
  disposition,
  document: doc,
  couleur,
  reglages,
  enCours,
  onFermer,
  onEnregistrer,
}) => {
  const [d, setD] = useState(disposition);
  const [apercu, setApercu] = useState(false);
  const [choisi, setChoisi] = useState<CleBloc | null>(null);
  const [echelle, setEchelle] = useState(1);
  const [debords, setDebords] = useState<string>("");
  const [lignesCachees, setLignesCachees] = useState(0);
  const [guides, setGuides] = useState<Guide[]>([]);
  const scene = useRef<HTMLDivElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const glisse = useRef<Glisse | null>(null);

  const blocs = blocsResolus(d);
  const visibles = BLOCS.map((b) => b.cle).filter((c) => !blocs[c].masque);
  const modifie = JSON.stringify(d) !== JSON.stringify(disposition);

  const poser = useCallback(
    (cle: CleBloc, patch: Partial<BlocPose>) => setD((p) => poserBloc(p, cle, patch)),
    [],
  );
  const deplacer = useCallback(
    (cle: CleBloc, dx: number, dy: number) =>
      setD((p) => {
        const b = blocsResolus(p)[cle];
        return poserBloc(p, cle, { x: b.x + dx, y: b.y + dy });
      }),
    [],
  );

  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    const mesurer = () => setEchelle(Math.min(1, el.clientWidth / LARGEUR_PX) || 1);
    mesurer();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Relève les blocs dont le contenu dépasse le cadre, et les lignes que le tableau ne montre pas.
  useLayoutEffect(() => {
    const racine = feuille.current;
    if (!racine) return;
    const trop: string[] = [];
    let cachees = 0;
    racine.querySelectorAll<HTMLElement>(".doc-libre [data-bloc]").forEach((el) => {
      const cle = el.dataset.bloc!;
      if (cle === "tableau") {
        el.querySelectorAll<HTMLElement>("tbody tr").forEach((tr) => {
          if (tr.offsetTop + tr.offsetHeight > el.clientHeight + 1) cachees++;
        });
      } else if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
        trop.push(cle);
      }
    });
    const cle = trop.join(",");
    if (cle !== debords) setDebords(cle);
    if (cachees !== lignesCachees) setLignesCachees(cachees);
  });

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      if (e.key === "Escape") return setChoisi(null);
      if (!choisi) return;
      const pas = e.shiftKey ? 5 : 1;
      const v = {
        ArrowLeft: [-pas, 0],
        ArrowRight: [pas, 0],
        ArrowUp: [0, -pas],
        ArrowDown: [0, pas],
      }[e.key];
      if (!v) return;
      e.preventDefault();
      deplacer(choisi, v[0], v[1]);
    };
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, [choisi, deplacer]);

  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  const saisir = (e: React.PointerEvent<HTMLElement>, cle: CleBloc, poignee: Poignee | null) => {
    e.stopPropagation();
    // Au doigt, le premier appui sélectionne : sans cela, on ne pourrait plus faire défiler l'écran.
    if (e.pointerType !== "mouse" && choisi !== cle) {
      setChoisi(cle);
      return;
    }
    setChoisi(cle);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointeur déjà relâché : le geste se suit quand même par les événements du cadre.
    }
    glisse.current = {
      id: e.pointerId,
      cle,
      x0: e.clientX,
      y0: e.clientY,
      depart: blocs[cle],
      poignee,
      cibles: ciblesAimant(blocs, cle, d.base),
    };
  };

  const suivre = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = glisse.current;
    if (!g || g.id !== e.pointerId) return;
    const k = echelle * PX_MM;
    const dx = (e.clientX - g.x0) / k;
    const dy = (e.clientY - g.y0) / k;
    // Six pixels à l'écran, quelle que soit l'échelle de la feuille.
    const seuil = e.altKey ? 0 : Math.max(0.8, 6 / k);
    const r = g.poignee
      ? aimanterRedimension(redimensionner(g.depart, g.poignee, dx, dy), g.poignee, g.cibles, seuil)
      : aimanterDeplacement(
          contraindre({ ...g.depart, x: g.depart.x + dx, y: g.depart.y + dy }),
          g.cibles,
          seuil,
        );
    poser(g.cle, { x: r.bloc.x, y: r.bloc.y, l: r.bloc.l, h: r.bloc.h });
    setGuides(r.guides);
  };

  const lacher = () => {
    glisse.current = null;
    setGuides([]);
  };

  const trop = new Set(debords ? debords.split(",") : []);
  const bloc = choisi ? blocs[choisi] : null;
  const catalogue = choisi ? BLOCS.find((b) => b.cle === choisi)! : null;

  const ecran = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Éditeur de disposition"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => onFermer(d)}
          className={boutonIcone}
          aria-label="Revenir aux réglages"
          title="Revenir aux réglages"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <input
          type="text"
          value={d.nom}
          onChange={(e) => setD((p) => ({ ...p, nom: e.target.value }))}
          aria-label="Nom de la disposition"
          className="app-field min-w-0 flex-1 sm:max-w-xs"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {reglages && doc && (
            <button
              type="button"
              onClick={() => setApercu((a) => !a)}
              aria-pressed={apercu}
              className="app-btn-secondary"
              title="Les pages telles qu'elles s'imprimeront, pagination comprise"
            >
              {apercu ? <Move className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              {apercu ? "Retour à la feuille" : "Aperçu"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setD((p) => reinitialiserDisposition(p))}
            className="app-btn-secondary"
            title="Remet chaque bloc à sa place dans le modèle de départ. Les autres réglages ne bougent pas."
          >
            <RotateCcw className="h-4 w-4" />
            Revenir au modèle d&apos;origine
          </button>
          <button
            type="button"
            onClick={() => onEnregistrer(d)}
            disabled={enCours}
            className="app-btn-primary"
          >
            <Save className="h-4 w-4" />
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="min-w-0 flex-1 bg-muted/40 p-3 sm:p-5 lg:overflow-y-auto">
          {apercu && reglages && doc && (
            <DocumentPreview
              document={doc}
              reglages={{
                ...reglages,
                libre: {
                  ...reglages.libre,
                  dispositions: { ...reglages.libre.dispositions, [d.id]: d },
                },
              }}
              dispositionId={d.id}
              sansActions
            />
          )}
          <div
            ref={scene}
            className={`mx-auto w-full${apercu ? " hidden" : ""}`}
            style={{ maxWidth: LARGEUR_PX }}
          >
            <div
              className="relative"
              style={{ width: LARGEUR_PX * echelle, height: HAUTEUR_PX * echelle }}
            >
              <div
                ref={feuille}
                className={`doc-feuille doc-feuille--libre m-${d.base}`}
                style={{
                  ...(variablesDeCouleur(couleur) as React.CSSProperties),
                  transform: `scale(${echelle})`,
                  transformOrigin: "top left",
                  position: "absolute",
                  left: 0,
                  top: 0,
                }}
                onPointerDown={() => setChoisi(null)}
              >
                {doc && (
                  <Libre
                    document={doc}
                    base={d.base}
                    blocs={blocs}
                    lignes={doc.lignes}
                    cles={visibles}
                    pagination={null}
                  />
                )}
                <div className="absolute inset-0" style={{ zIndex: 5 }}>
                  {visibles.map((cle) => {
                    const b = blocs[cle];
                    const vide = !doc || contenuDuBloc(cle, doc, d.base, doc.lignes, null) === null;
                    const actif = choisi === cle;
                    return (
                      <div
                        key={cle}
                        data-cadre={cle}
                        onPointerDown={(e) => saisir(e, cle, null)}
                        onPointerMove={suivre}
                        onPointerUp={lacher}
                        onPointerCancel={lacher}
                        className={`absolute cursor-move select-none ${
                          actif
                            ? "outline outline-2 outline-primary"
                            : trop.has(cle)
                              ? "outline outline-1 outline-warning"
                              : "outline-dashed outline-1 outline-transparent hover:outline-muted-foreground/50"
                        }`}
                        style={{
                          ...styleDuBloc(b, false),
                          zIndex: actif ? 3 : 1,
                          touchAction: actif ? "none" : undefined,
                        }}
                      >
                        {vide && (
                          <span className="flex h-full w-full items-center justify-center overflow-hidden border border-dashed border-border px-1 text-center text-[9pt] text-muted-foreground">
                            {BLOCS.find((x) => x.cle === cle)!.nom}
                          </span>
                        )}
                        {actif && (
                          <span className="absolute -top-[7mm] left-0 whitespace-nowrap rounded bg-primary px-[2mm] py-[0.5mm] text-[8pt] font-medium text-primary-foreground">
                            {catalogue?.nom}
                          </span>
                        )}
                        {actif &&
                          POIGNEES.map((p) => (
                            <span
                              key={p.cle}
                              data-poignee={p.cle}
                              aria-hidden="true"
                              onPointerDown={(e) => saisir(e, cle, p.cle)}
                              className="absolute flex items-center justify-center"
                              style={{
                                // Zone de prise de 28 px à l'écran, carré visible de 10 px.
                                width: 28 / echelle,
                                height: 28 / echelle,
                                left: `calc(${p.x * 100}% - ${14 / echelle}px)`,
                                top: `calc(${p.y * 100}% - ${14 / echelle}px)`,
                                cursor: p.curseur,
                                touchAction: "none",
                              }}
                            >
                              <span
                                className="block border-primary bg-card"
                                style={{
                                  width: 10 / echelle,
                                  height: 10 / echelle,
                                  borderWidth: 2 / echelle,
                                  borderStyle: "solid",
                                }}
                              />
                            </span>
                          ))}
                      </div>
                    );
                  })}
                  {guides.map((g) => (
                    <span
                      key={`${g.axe}${g.pos}`}
                      data-guide={g.axe}
                      className="pointer-events-none absolute bg-primary"
                      style={
                        g.axe === "x"
                          ? { left: `${g.pos}mm`, top: 0, bottom: 0, width: 1 / echelle }
                          : { top: `${g.pos}mm`, left: 0, right: 0, height: 1 / echelle }
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {lignesCachees > 0 && (
            <p className="mx-auto mt-3 max-w-[794px] text-xs text-muted-foreground">
              {lignesCachees} ligne{lignesCachees > 1 ? "s" : ""} du tableau continuera sur la page
              suivante.
            </p>
          )}
        </div>

        <aside className="border-t border-border bg-card lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
          {bloc && choisi && catalogue ? (
            <section className="space-y-4 border-b border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{catalogue.nom}</p>
                <button
                  type="button"
                  onClick={() => setChoisi(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Fermer
                </button>
              </div>
              {trop.has(choisi) && (
                <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning">
                  Le contenu dépasse du cadre. Agrandissez-le pour que rien ne soit coupé.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {CHAMPS.map((c) => (
                  <label key={c.cle} className="text-xs text-muted-foreground">
                    {c.nom} (mm)
                    <input
                      type="number"
                      step={0.5}
                      value={bloc[c.cle]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) poser(choisi, { [c.cle]: v });
                      }}
                      className="app-field mt-1 w-full"
                    />
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex">
                  {ALIGNEMENTS.map(({ cle, nom, Icone }) => (
                    <button
                      key={cle}
                      type="button"
                      aria-label={nom}
                      title={nom}
                      aria-pressed={(bloc.align ?? "gauche") === cle}
                      onClick={() => poser(choisi, { align: cle })}
                      className={`${boutonIcone} ${(bloc.align ?? "gauche") === cle ? "text-primary" : ""}`}
                    >
                      <Icone className="h-4 w-4" />
                    </button>
                  ))}
                </div>
                <div className="flex">
                  {(
                    [
                      ["Vers la gauche", ArrowLeft, -1, 0],
                      ["Vers le haut", ArrowUp, 0, -1],
                      ["Vers le bas", ArrowDown, 0, 1],
                      ["Vers la droite", ArrowRight, 1, 0],
                    ] as const
                  ).map(([nom, Icone, dx, dy]) => (
                    <button
                      key={nom}
                      type="button"
                      aria-label={nom}
                      title={nom}
                      onClick={() => deplacer(choisi, dx, dy)}
                      className={boutonIcone}
                    >
                      <Icone className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-foreground">Répéter sur chaque page</span>
                <SettingsToggle
                  size="sm"
                  checked={bloc.repete === true}
                  onChange={(v) => poser(choisi, { repete: v })}
                  label="Répéter sur chaque page"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-foreground">Texte clair, sur fond de couleur</span>
                <SettingsToggle
                  size="sm"
                  checked={bloc.inverse === true}
                  onChange={(v) => poser(choisi, { inverse: v })}
                  label="Texte clair"
                />
              </div>
            </section>
          ) : (
            <p className="border-b border-border p-4 text-xs leading-relaxed text-muted-foreground">
              Touchez un bloc pour le choisir, puis faites-le glisser ; tirez un coin pour le
              redimensionner. Il s&apos;aimante aux marges, au milieu de la feuille et aux autres
              blocs (Alt pour s&apos;en affranchir). Les flèches du clavier le déplacent d&apos;un
              millimètre, de cinq avec Maj.
            </p>
          )}

          <ul className="divide-y divide-border">
            {BLOCS.map(({ cle, nom, verrouille }) => {
              const masque = blocs[cle].masque === true;
              return (
                <li key={cle} className="flex items-center gap-2 px-4 py-1.5">
                  <button
                    type="button"
                    disabled={masque}
                    onClick={() => setChoisi(cle)}
                    className={`min-w-0 flex-1 truncate py-1.5 text-left text-sm ${
                      choisi === cle
                        ? "font-medium text-primary"
                        : masque
                          ? "text-muted-foreground"
                          : "text-foreground"
                    }`}
                  >
                    {nom}
                  </button>
                  {verrouille ? (
                    <span
                      className={`${boutonIcone} cursor-help`}
                      title="Mention obligatoire : elle se déplace, mais ne se masque pas."
                      aria-label="Mention obligatoire"
                    >
                      <Lock className="h-4 w-4" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={masque ? `Afficher ${nom}` : `Masquer ${nom}`}
                      title={masque ? "Afficher" : "Masquer"}
                      onClick={() => {
                        poser(cle, { masque: !masque });
                        if (!masque && choisi === cle) setChoisi(null);
                      }}
                      className={boutonIcone}
                    >
                      {masque ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {modifie && (
            <p className="p-4 text-xs text-muted-foreground">Modifications non enregistrées.</p>
          )}
        </aside>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(ecran, document.body);
};

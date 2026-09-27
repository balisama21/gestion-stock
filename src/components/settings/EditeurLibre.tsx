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
  Bold,
  Eye,
  EyeOff,
  FileText,
  Italic,
  Lock,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { SettingsToggle } from "./primitives";
import { ChoixCouleur } from "./ChoixCouleur";
import type { Document } from "../../features/documents/lib/buildDocument";
import { variablesDeCouleur, type ReglagesDocuments } from "../../features/documents/lib/reglages";
import { DocumentPreview } from "../../features/documents/DocumentPreview";
import {
  aimanterDeplacement,
  aimanterRedimension,
  BLOCS,
  BORDURES,
  blocsResolus,
  cleCachet,
  clesPosees,
  ciblesAimant,
  contraindre,
  estCleCachet,
  habiller,
  idDuCachet,
  placerCachet,
  poserBloc,
  retirerCachet,
  redimensionner,
  reinitialiserDisposition,
  TAILLE_TEXTE,
  type Alignement,
  type BlocPose,
  type Cibles,
  type ClePosee,
  type Disposition,
  type Guide,
  type Habillage,
  type Poignee,
  type Police,
} from "../../features/documents/lib/disposition";
import {
  contenuDuBloc,
  echelleDuTexte,
  Libre,
  styleDuBloc,
} from "../../features/documents/templates/Libre";
import { imageCachet } from "../../features/documents/lib/traiterCachet";
import { appliquerTextes, textesDuBloc } from "../../features/documents/lib/textesLibres";
import { PPP_MINIMUM, pppEffectif } from "../../features/documents/lib/cachets";
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
  cle: ClePosee;
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

const POLICES: { cle: Police | ""; nom: string; famille?: string }[] = [
  { cle: "", nom: "Celle du modèle" },
  { cle: "sans", nom: "Onest", famille: "var(--doc-sans)" },
  { cle: "serif", nom: "Source Serif", famille: "var(--doc-serif)" },
  { cle: "mono", nom: "JetBrains Mono", famille: "var(--doc-mono)" },
];

const TRAITS: { valeur: number | undefined; nom: string }[] = [
  { valeur: undefined, nom: "Aucune" },
  { valeur: BORDURES[0], nom: "Fine" },
  { valeur: BORDURES[1], nom: "Moyenne" },
  { valeur: BORDURES[2], nom: "Épaisse" },
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
  const [choisi, setChoisi] = useState<ClePosee | null>(null);
  const [echelle, setEchelle] = useState(1);
  const [debords, setDebords] = useState<string>("");
  const [lignesCachees, setLignesCachees] = useState(0);
  const [guides, setGuides] = useState<Guide[]>([]);
  /** Le texte qu'on écrit à même la feuille, et l'allure qu'il y a. */
  const [ecrit, setEcrit] = useState<{
    cle: ClePosee;
    k: string;
    valeur: string;
    defaut: string;
    long?: boolean;
    style: React.CSSProperties;
  } | null>(null);
  const scene = useRef<HTMLDivElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const glisse = useRef<Glisse | null>(null);

  const blocs = blocsResolus(d);
  const visibles = clesPosees(blocs).filter((c) => !blocs[c].masque);
  const cachets = reglages?.cachets ?? [];
  const [images, setImages] = useState<Record<string, string>>({});
  const nomDe = (cle: ClePosee) =>
    estCleCachet(cle)
      ? (cachets.find((c) => c.id === idDuCachet(cle))?.nom ?? "Cachet")
      : (BLOCS.find((b) => b.cle === cle)?.nom ?? cle);

  useEffect(() => {
    let actif = true;
    for (const c of cachets) {
      if (images[c.chemin]) continue;
      void imageCachet(c.chemin).then(
        (url) => actif && url && setImages((m) => ({ ...m, [c.chemin]: url })),
      );
    }
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachets]);
  const modifie = JSON.stringify(d) !== JSON.stringify(disposition);

  const poser = useCallback(
    (cle: ClePosee, patch: Partial<BlocPose>) => setD((p) => poserBloc(p, cle, patch)),
    [],
  );
  const habillerBloc = (cle: ClePosee, patch: Partial<Habillage>) =>
    setD((p) => habiller(p, cle, patch));
  const couleurDoc = d.couleur ?? couleur;
  const deplacer = useCallback(
    (cle: ClePosee, dx: number, dy: number) =>
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
        const k = Number(el.querySelector<HTMLElement>(".doc-libre-echelle")?.style.zoom) || 1;
        el.querySelectorAll<HTMLElement>("tbody tr").forEach((tr) => {
          if ((tr.offsetTop + tr.offsetHeight) * k > el.clientHeight + 1) cachees++;
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

  const saisir = (e: React.PointerEvent<HTMLElement>, cle: ClePosee, poignee: Poignee | null) => {
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
  const nomChoisi = choisi ? nomDe(choisi) : null;
  const docEcrit = doc ? appliquerTextes(doc, blocs) : null;
  const champsTexte = doc && choisi ? textesDuBloc(choisi, doc, d.base) : [];

  /** Un mot rendu à sa valeur des réglages n'est plus gardé : il suivra les réglages. */
  const ecrireTexte = (cle: ClePosee, k: string, valeur: string, defaut: string) =>
    setD((p) => {
      const actuels = { ...blocsResolus(p)[cle]?.textes };
      if (valeur === defaut) delete actuels[k];
      else actuels[k] = valeur;
      return poserBloc(p, cle, { textes: Object.keys(actuels).length ? actuels : undefined });
    });

  /** Double-clic : un seul texte s'écrit sur place, plusieurs s'écrivent dans le panneau. */
  const ecrireSurLaFeuille = (cle: ClePosee) => {
    if (!doc) return;
    const champs = textesDuBloc(cle, doc, d.base);
    setChoisi(cle);
    if (champs.length === 1) {
      const c = champs[0];
      const el = feuille.current?.querySelector<HTMLElement>(`.doc-libre [data-bloc="${cle}"]`);
      const cible = (el?.querySelector<HTMLElement>("h4, h5, .doc-titre, .merci, p, footer, div") ??
        el) as HTMLElement | null;
      const cs = cible ? getComputedStyle(cible) : null;
      const k = echelleDuTexte(blocs[cle]);
      setEcrit({
        cle,
        k: c.cle,
        valeur: blocs[cle]?.textes?.[c.cle] ?? c.valeur,
        defaut: c.valeur,
        long: c.long,
        style: cs
          ? {
              fontFamily: cs.fontFamily,
              fontSize: `${parseFloat(cs.fontSize) * k}px`,
              fontWeight: cs.fontWeight,
              fontStyle: cs.fontStyle,
              letterSpacing: cs.letterSpacing,
              lineHeight: cs.lineHeight.endsWith("px")
                ? `${parseFloat(cs.lineHeight) * k}px`
                : cs.lineHeight,
              textTransform: cs.textTransform as React.CSSProperties["textTransform"],
              textAlign: getComputedStyle(el!).textAlign as React.CSSProperties["textAlign"],
              color: cs.color,
            }
          : {},
      });
    } else if (champs.length > 1) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[data-champ-texte]")?.focus(),
      );
    }
  };

  const validerEcrit = () => {
    if (!ecrit) return;
    ecrireTexte(ecrit.cle, ecrit.k, ecrit.valeur, ecrit.defaut);
    setEcrit(null);
  };
  const choisiCachet = choisi !== null && estCleCachet(choisi);

  const ecran = (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-background"
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
                className={`doc-racine doc-feuille doc-feuille--libre m-${d.base}`}
                style={{
                  ...(variablesDeCouleur(couleurDoc) as React.CSSProperties),
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
                    cachets={{ cachets, images }}
                  />
                )}
                <div className="absolute inset-0" style={{ zIndex: 5 }}>
                  {visibles.map((cle) => {
                    const b = blocs[cle];
                    const vide =
                      !docEcrit ||
                      contenuDuBloc(
                        cle,
                        docEcrit,
                        d.base,
                        docEcrit.lignes,
                        null,
                        { cachets, images },
                        b.textes,
                      ) === null;
                    const actif = choisi === cle;
                    return (
                      <div
                        key={cle}
                        data-cadre={cle}
                        onPointerDown={(e) => saisir(e, cle, null)}
                        onDoubleClick={() => ecrireSurLaFeuille(cle)}
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
                          ...styleDuBloc(b, 1),
                          zIndex: actif ? 3 : 1,
                          touchAction: actif ? "none" : undefined,
                        }}
                      >
                        {vide && (
                          <span className="flex h-full w-full items-center justify-center overflow-hidden border border-dashed border-border px-1 text-center text-[9pt] text-muted-foreground">
                            {nomDe(cle)}
                          </span>
                        )}
                        {ecrit?.cle === cle && (
                          <textarea
                            autoFocus
                            data-ecriture
                            aria-label={`Écrire : ${nomDe(cle)}`}
                            value={ecrit.valeur}
                            onChange={(e) => setEcrit({ ...ecrit, valeur: e.target.value })}
                            ref={(el) => {
                              // La zone suit le texte : une ligne de trop ne doit pas cacher la première.
                              if (!el) return;
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            onBlur={validerEcrit}
                            onPointerDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEcrit(null);
                              } else if (e.key === "Enter" && !ecrit.long && !e.shiftKey) {
                                e.preventDefault();
                                validerEcrit();
                              }
                            }}
                            className="absolute left-0 top-0 z-10 min-h-full w-full resize-none overflow-hidden border-0 bg-white p-0 outline outline-2 outline-primary"
                            style={ecrit.style}
                          />
                        )}
                        {actif && (
                          <span className="absolute -top-[7mm] left-0 whitespace-nowrap rounded bg-primary px-[2mm] py-[0.5mm] text-[8pt] font-medium text-primary-foreground">
                            {nomChoisi}
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
          {bloc && choisi && nomChoisi ? (
            <section className="space-y-4 border-b border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{nomChoisi}</p>
                <button
                  type="button"
                  onClick={() => setChoisi(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Fermer
                </button>
              </div>
              {champsTexte.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Textes</p>
                  {champsTexte.map((c, i) => {
                    const v = bloc.textes?.[c.cle];
                    const Champ = c.long ? "textarea" : "input";
                    return (
                      <label key={c.cle} className="block text-xs text-muted-foreground">
                        <span className="flex items-center justify-between gap-2">
                          {c.nom}
                          {v !== undefined && (
                            <button
                              type="button"
                              onClick={() => ecrireTexte(choisi, c.cle, c.valeur, c.valeur)}
                              className="inline-flex h-[26px] w-[26px] items-center justify-center text-muted-foreground hover:text-foreground"
                              aria-label={`Rétablir ${c.nom}`}
                              title="Reprendre le mot des réglages"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                        <Champ
                          {...(i === 0 ? { "data-champ-texte": "" } : {})}
                          value={v ?? c.valeur}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                          ) => ecrireTexte(choisi, c.cle, e.target.value, c.valeur)}
                          {...(c.long ? { rows: 3 } : { type: "text" })}
                          className="app-field mt-1 w-full"
                        />
                      </label>
                    );
                  })}
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Les chiffres, le client, les lignes et le nom de la boutique viennent de la base
                    : ils ne s&apos;écrivent pas ici.
                  </p>
                </div>
              )}
              {!choisiCachet && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Style</p>
                    {bloc.habillage && (
                      <button
                        type="button"
                        onClick={() => poser(choisi, { habillage: undefined })}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Reprendre l'allure du modèle"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Style du modèle
                      </button>
                    )}
                  </div>
                  <label className="block text-xs text-muted-foreground">
                    Police
                    <select
                      aria-label="Police"
                      value={bloc.habillage?.police ?? ""}
                      onChange={(e) =>
                        habillerBloc(choisi, {
                          police: (e.target.value || undefined) as Police | undefined,
                        })
                      }
                      className="app-field mt-1 w-full"
                    >
                      {POLICES.map((p) => (
                        <option key={p.cle} value={p.cle} style={{ fontFamily: p.famille }}>
                          {p.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center" role="group" aria-label="Taille du texte">
                      <button
                        type="button"
                        aria-label="Texte plus petit"
                        title="Plus petit"
                        disabled={(bloc.habillage?.taille ?? 100) <= TAILLE_TEXTE.min}
                        onClick={() =>
                          habillerBloc(choisi, {
                            taille: (bloc.habillage?.taille ?? 100) - TAILLE_TEXTE.pas,
                          })
                        }
                        className={boutonIcone}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => habillerBloc(choisi, { taille: undefined })}
                        title="Taille du modèle"
                        className="min-w-[3.25rem] text-center text-sm tabular-nums text-foreground"
                      >
                        {bloc.habillage?.taille ?? 100} %
                      </button>
                      <button
                        type="button"
                        aria-label="Texte plus grand"
                        title="Plus grand"
                        disabled={(bloc.habillage?.taille ?? 100) >= TAILLE_TEXTE.max}
                        onClick={() =>
                          habillerBloc(choisi, {
                            taille: (bloc.habillage?.taille ?? 100) + TAILLE_TEXTE.pas,
                          })
                        }
                        className={boutonIcone}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex">
                      <button
                        type="button"
                        aria-label="Gras"
                        title="Gras"
                        aria-pressed={bloc.habillage?.gras === true}
                        onClick={() =>
                          habillerBloc(choisi, { gras: bloc.habillage?.gras ? undefined : true })
                        }
                        className={`${boutonIcone} ${bloc.habillage?.gras ? "text-primary" : ""}`}
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Italique"
                        title="Italique"
                        aria-pressed={bloc.habillage?.italique === true}
                        onClick={() =>
                          habillerBloc(choisi, {
                            italique: bloc.habillage?.italique ? undefined : true,
                          })
                        }
                        className={`${boutonIcone} ${bloc.habillage?.italique ? "text-primary" : ""}`}
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Couleur du texte</p>
                    <ChoixCouleur
                      nom="Couleur du texte"
                      aucun="Celle du modèle"
                      valeur={bloc.habillage?.encre}
                      onChange={(v) => habillerBloc(choisi, { encre: v })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {choisi === "fond" ? "Couleur du bandeau" : "Fond"}
                    </p>
                    <ChoixCouleur
                      nom={choisi === "fond" ? "Couleur du bandeau" : "Fond"}
                      aucun={choisi === "fond" ? "Celle du document" : "Sans fond"}
                      valeur={bloc.habillage?.fond}
                      onChange={(v) => habillerBloc(choisi, { fond: v })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs text-muted-foreground">
                      Bordure
                      <select
                        aria-label="Bordure"
                        value={String(bloc.habillage?.bordure ?? "")}
                        onChange={(e) =>
                          habillerBloc(choisi, {
                            bordure: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="app-field mt-1 w-full"
                      >
                        {TRAITS.map((t) => (
                          <option key={t.nom} value={t.valeur ?? ""}>
                            {t.nom}
                          </option>
                        ))}
                      </select>
                    </label>
                    {bloc.habillage?.bordure && (
                      <ChoixCouleur
                        nom="Couleur de la bordure"
                        aucun="Couleur du document"
                        valeur={bloc.habillage.bordureCouleur}
                        onChange={(v) => habillerBloc(choisi, { bordureCouleur: v })}
                      />
                    )}
                  </div>
                </div>
              )}
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
                <div className={`flex${choisiCachet ? " invisible" : ""}`}>
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
              {choisiCachet &&
                (() => {
                  const c = cachets.find((x) => x.id === idDuCachet(choisi as `cachet:${string}`));
                  const ppp = c ? pppEffectif(c, bloc.l) : PPP_MINIMUM;
                  return ppp < PPP_MINIMUM ? (
                    <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning">
                      À cette taille, l&apos;image n&apos;a que {ppp} points par pouce : elle sera
                      floue à l&apos;impression. Réduisez-la, ou importez une photo plus nette.
                    </p>
                  ) : null;
                })()}
              {choisiCachet ? (
                <button
                  type="button"
                  onClick={() => {
                    setD((p) => retirerCachet(p, idDuCachet(choisi as `cachet:${string}`)));
                    setChoisi(null);
                  }}
                  className="app-btn-secondary w-full"
                >
                  Retirer de la feuille
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-foreground">Texte clair, sur fond de couleur</span>
                  <SettingsToggle
                    size="sm"
                    checked={bloc.inverse === true}
                    onChange={(v) => poser(choisi, { inverse: v })}
                    label="Texte clair"
                  />
                </div>
              )}
            </section>
          ) : (
            <p className="border-b border-border p-4 text-xs leading-relaxed text-muted-foreground">
              Touchez un bloc pour le choisir, puis faites-le glisser ; tirez un coin pour le
              redimensionner. Double-cliquez sur un texte pour l&apos;écrire directement. Il
              s&apos;aimante aux marges, au milieu de la feuille et aux autres blocs (Alt pour
              s&apos;en affranchir). Les flèches du clavier le déplacent d&apos;un millimètre, de
              cinq avec Maj.
            </p>
          )}

          <section className="space-y-2 border-b border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Couleur du document</p>
              {d.couleur && (
                <button
                  type="button"
                  onClick={() => setD(({ couleur: _, ...p }) => p)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  title="Reprendre la couleur des réglages"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Celle des réglages
                </button>
              )}
            </div>
            <ChoixCouleur
              nom="Couleur du document"
              valeur={couleurDoc}
              onChange={(v) => setD((p) => ({ ...p, couleur: v }))}
            />
          </section>

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
          <section className="border-t border-border p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Cachets et signatures</p>
            {cachets.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ajoutez-les dans Paramètres → Documents → Cachets et signatures, puis placez-les
                ici.
              </p>
            ) : (
              <ul className="space-y-2">
                {cachets.map((c) => {
                  const cle = cleCachet(c.id);
                  const place = blocs[cle] !== undefined;
                  return (
                    <li key={c.id} className="flex items-center gap-2">
                      <span
                        className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded"
                        style={{
                          background:
                            "repeating-conic-gradient(#eef1ef 0% 25%, #ffffff 0% 50%) 50% / 10px 10px",
                        }}
                      >
                        {images[c.chemin] && (
                          <img
                            src={images[c.chemin]}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={!place}
                        onClick={() => setChoisi(cle)}
                        className={`min-w-0 flex-1 truncate text-left text-sm ${
                          choisi === cle ? "font-medium text-primary" : "text-foreground"
                        }`}
                      >
                        {c.nom}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (place) {
                            setD((p) => retirerCachet(p, c.id));
                            if (choisi === cle) setChoisi(null);
                          } else {
                            setD((p) => placerCachet(p, c));
                            setChoisi(cle);
                          }
                        }}
                        className="app-btn-secondary"
                      >
                        {place ? "Retirer" : "Placer"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {modifie && (
            <p className="p-4 text-xs text-muted-foreground">Modifications non enregistrées.</p>
          )}
        </aside>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(ecran, document.body);
};

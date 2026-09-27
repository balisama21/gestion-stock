import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Lock,
  Minus,
  Move,
  RotateCcw,
  Save,
  Square,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { SettingsToggle } from "./primitives";
import { useReglagesModifiables } from "../../features/documents/contexteReglages";
import { ChoixCouleur } from "./ChoixCouleur";
import { BarreBloc } from "./BarreBloc";
import type { Document } from "../../features/documents/lib/buildDocument";
import { variablesDeCouleur, type ReglagesDocuments } from "../../features/documents/lib/reglages";
import { DocumentPreview } from "../../features/documents/DocumentPreview";
import {
  aimanterDeplacement,
  aimanterRedimension,
  ajouterElement,
  BLOCS,
  blocsResolus,
  cleCachet,
  clesPosees,
  ciblesAimant,
  contraindre,
  dupliquerElement,
  estCleCachet,
  estCleElement,
  estVerrouille,
  habiller,
  habillageDeDepart,
  idDuCachet,
  imagesPosees,
  placerCachet,
  poserBloc,
  retirerCachet,
  retirerElement,
  redimensionner,
  reinitialiserDisposition,
  type BlocPose,
  type Cibles,
  type ClePosee,
  type Disposition,
  type GenreElement,
  type Guide,
  type Habillage,
  type Poignee,
} from "../../features/documents/lib/disposition";
import {
  contenuDuBloc,
  echelleDuTexte,
  Libre,
  styleDuBloc,
} from "../../features/documents/templates/Libre";
import {
  envoyerCachet,
  imageCachet,
  imageVersPng,
} from "../../features/documents/lib/traiterCachet";
import {
  appliquerTextes,
  textesDuBloc,
  type TexteModifiable,
} from "../../features/documents/lib/textesLibres";
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
  /** La boutique : sans elle, on ne peut pas envoyer d'image. */
  storeId?: string;
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
  /** Le bloc était déjà choisi : un clic sans bouger ouvre l'écriture, comme sur Canva. */
  deja: boolean;
  bouge: boolean;
}

/** Au-delà, le doigt ou la souris déplace ; en deçà, c'est un clic. */
const SEUIL_GESTE_PX = 4;
/** Les blocs qui ne sont QUE leur texte : on l'écrit où que l'on touche. */
const TOUT_TEXTE = new Set<string>(["titre", "motDeFin", "mentions", "pied"]);
const normal = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

/** Le fond réellement peint sous un élément : un texte blanc s'écrit sur son bandeau, pas sur du blanc. */
function fondSous(el: HTMLElement | null): string {
  for (let n = el; n && !n.classList.contains("doc-feuille"); n = n.parentElement) {
    const f = getComputedStyle(n).backgroundColor;
    if (f && f !== "transparent" && !/rgba\(.*,\s*0\)$/.test(f)) return f;
  }
  return "#ffffff";
}

/** La zone d'écriture posée sur le mot, un peu plus large pour qu'il puisse grandir. */
function placeDuMot(e: {
  cadre?: { left: number; top: number; width: number; height: number };
  style: React.CSSProperties;
}): React.CSSProperties {
  if (!e.cadre) return {};
  const { left, top, width, height } = e.cadre;
  const l = Math.max(width + 16, 48);
  const aDroite = e.style.textAlign === "right" || e.style.textAlign === "end";
  return { left: aDroite ? left + width - l : left, top, width: l, minHeight: height };
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

const NOMS_ELEMENTS: Record<GenreElement, string> = {
  texte: "Texte libre",
  trait: "Trait",
  cadre: "Cadre",
  image: "Image",
};

const boutonIcone =
  "inline-flex h-[34px] w-[34px] items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40";

export const EditeurLibre: React.FC<Props> = ({
  disposition,
  document: doc,
  couleur,
  reglages,
  storeId: storeIdPasse,
  enCours,
  onFermer,
  onEnregistrer,
}) => {
  const contexte = useReglagesModifiables();
  const storeId = storeIdPasse ?? contexte?.storeId;
  const [d, setD] = useState(disposition);
  /** Annuler / Rétablir : un pas par geste, les changements rapprochés font un seul pas. */
  const passe = useRef<Disposition[]>([]);
  const futur = useRef<Disposition[]>([]);
  const [, setVersion] = useState(0);
  const suivi = useRef({ avant: disposition, t: 0, ignorer: false });
  const courant = useRef(disposition);
  courant.current = d;
  const [enGeste, setEnGeste] = useState(false);
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
    multiligne?: boolean;
    /** Le mot visé, en pixels dans le cadre du bloc ; absent, tout le bloc. */
    cadre?: { left: number; top: number; width: number; height: number };
    style: React.CSSProperties;
  } | null>(null);
  const scene = useRef<HTMLDivElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const glisse = useRef<Glisse | null>(null);

  const blocs = blocsResolus(d);
  const visibles = clesPosees(blocs).filter((c) => !blocs[c].masque);
  const cachets = reglages?.cachets ?? [];
  const [images, setImages] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState<{ enCours: boolean; erreur: string | null }>({
    enCours: false,
    erreur: null,
  });
  const nomDe = (cle: ClePosee) =>
    estCleCachet(cle)
      ? (cachets.find((c) => c.id === idDuCachet(cle))?.nom ?? "Cachet")
      : estCleElement(cle)
        ? NOMS_ELEMENTS[blocs[cle]?.element?.genre ?? "texte"]
        : (BLOCS.find((b) => b.cle === cle)?.nom ?? cle);
  const elements = Object.keys(blocs).filter(estCleElement);
  const chemins = [...cachets.map((c) => c.chemin), ...imagesPosees(d)].join("|");

  useEffect(() => {
    let actif = true;
    for (const c of chemins ? chemins.split("|") : []) {
      if (images[c]) continue;
      void imageCachet(c).then((url) => actif && url && setImages((m) => ({ ...m, [c]: url })));
    }
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemins]);
  const modifie = JSON.stringify(d) !== JSON.stringify(disposition);

  useEffect(() => {
    const s = suivi.current;
    if (s.avant === d) return;
    const maintenant = Date.now();
    if (s.ignorer) {
      s.ignorer = false;
    } else if (maintenant - s.t > 700) {
      passe.current = [...passe.current.slice(-99), s.avant];
      futur.current = [];
      setVersion((v) => v + 1);
    }
    s.avant = d;
    s.t = maintenant;
  }, [d]);

  const revenir = useCallback((de: typeof passe, vers: typeof passe) => {
    const cible = de.current.at(-1);
    if (!cible) return;
    de.current = de.current.slice(0, -1);
    vers.current = [...vers.current, courant.current];
    suivi.current.ignorer = true;
    suivi.current.t = 0;
    setD(cible);
    setVersion((v) => v + 1);
  }, []);
  const annuler = useCallback(() => revenir(passe, futur), [revenir]);
  const retablir = useCallback(() => revenir(futur, passe), [revenir]);

  /** Retire le bloc : un élément ou un cachet s'en va, un bloc du modèle se masque. */
  const supprimerBloc = useCallback((cle: ClePosee) => {
    if (estVerrouille(cle)) return;
    setD((p) =>
      estCleElement(cle)
        ? retirerElement(p, cle)
        : estCleCachet(cle)
          ? retirerCachet(p, idDuCachet(cle))
          : poserBloc(p, cle, { masque: true }),
    );
    setChoisi(null);
  }, []);

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
      const touche = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (touche === "z" || touche === "y")) {
        e.preventDefault();
        if (touche === "y" || e.shiftKey) retablir();
        else annuler();
        return;
      }
      if (e.key === "Escape") return setChoisi(null);
      if (!choisi) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        supprimerBloc(choisi);
        return;
      }
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
  }, [choisi, deplacer, annuler, retablir, supprimerBloc]);

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
    setEnGeste(true);
    glisse.current = {
      id: e.pointerId,
      cle,
      x0: e.clientX,
      y0: e.clientY,
      depart: blocs[cle],
      poignee,
      cibles: ciblesAimant(blocs, cle, d.base),
      deja: choisi === cle && poignee === null,
      bouge: false,
    };
  };

  const suivre = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = glisse.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.bouge && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < SEUIL_GESTE_PX) return;
    g.bouge = true;
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

  const lacher = (e?: React.PointerEvent<HTMLElement>) => {
    const g = glisse.current;
    glisse.current = null;
    setEnGeste(false);
    setGuides([]);
    if (e && g?.deja && !g.bouge) ouvrirEcriture(g.cle, { x: e.clientX, y: e.clientY }, true);
  };

  const trop = new Set(debords ? debords.split(",") : []);
  const bloc = choisi ? blocs[choisi] : null;
  const nomChoisi = choisi ? nomDe(choisi) : null;
  const docEcrit = doc ? appliquerTextes(doc, blocs) : null;
  /** Les mots qu'on écrit dans ce bloc. Un texte libre n'a pas de mot des réglages. */
  const champsDe = (cle: ClePosee): TexteModifiable[] =>
    estCleElement(cle)
      ? blocs[cle]?.element?.genre === "texte"
        ? [{ cle: "texte", nom: "Texte", valeur: "", long: true }]
        : []
      : doc
        ? textesDuBloc(cle, doc, d.base)
        : [];
  const champsTexte = choisi ? champsDe(choisi) : [];

  const ajouter = (genre: Exclude<GenreElement, "image">) => {
    const { disposition: suite, cle } = ajouterElement(d, { genre });
    setD(suite);
    setChoisi(cle);
    if (genre === "texte") {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[data-champ-texte]")?.focus(),
      );
    }
  };

  const ajouterImage = async (fichier: File) => {
    if (!storeId) return;
    setEnvoi({ enCours: true, erreur: null });
    try {
      const png = await imageVersPng(fichier);
      const r = await envoyerCachet(storeId, png.blob);
      if (!r.chemin) return setEnvoi({ enCours: false, erreur: r.error });
      const chemin = r.chemin;
      const url = await new Promise<string>((ok) => {
        const lecteur = new FileReader();
        lecteur.onload = () => ok(lecteur.result as string);
        lecteur.readAsDataURL(png.blob);
      });
      setImages((m) => ({ ...m, [chemin]: url }));
      const { disposition: suite, cle } = ajouterElement(d, {
        genre: "image",
        image: { chemin, largeur: png.largeur, hauteur: png.hauteur },
      });
      setD(suite);
      setChoisi(cle);
      setEnvoi({ enCours: false, erreur: null });
    } catch (e) {
      setEnvoi({
        enCours: false,
        erreur: e instanceof Error ? e.message : "L'image n'a pas pu être ajoutée.",
      });
    }
  };

  /** Un mot rendu à sa valeur des réglages n'est plus gardé : il suivra les réglages. */
  const ecrireTexte = (cle: ClePosee, k: string, valeur: string, defaut: string) =>
    setD((p) => {
      const actuels = { ...blocsResolus(p)[cle]?.textes };
      if (valeur === defaut) delete actuels[k];
      else actuels[k] = valeur;
      return poserBloc(p, cle, { textes: Object.keys(actuels).length ? actuels : undefined });
    });

  /**
   * Écrire le mot touché, à l'endroit exact où il est. Le mot se reconnaît
   * à son texte ; un bloc qui n'est que du texte s'écrit où que l'on touche.
   * Un clic qui ne vise aucun mot ne fait rien : il reste un clic.
   */
  const ouvrirEcriture = (
    cle: ClePosee,
    point: { x: number; y: number } | null,
    clic: boolean,
  ): boolean => {
    const champs = champsDe(cle);
    if (champs.length === 0) return false;
    const el =
      feuille.current?.querySelector<HTMLElement>(`.doc-libre [data-bloc="${cle}"]`) ?? null;
    const valeurDe = (c: TexteModifiable) => blocs[cle]?.textes?.[c.cle] ?? c.valeur;
    let vise: { c: TexteModifiable; el: HTMLElement } | null = null;
    if (el && point && typeof document.elementsFromPoint === "function") {
      for (const touche of document.elementsFromPoint(point.x, point.y)) {
        if (!(touche instanceof HTMLElement) || !el.contains(touche)) continue;
        for (let n: HTMLElement | null = touche; n; n = n === el ? null : n.parentElement) {
          const premier = [...n.childNodes].find((x) => x.nodeType === 3 && x.textContent?.trim());
          const lus = [normal(n.textContent ?? ""), normal(premier?.textContent ?? "")];
          const c = champs.find((x) => {
            const v = normal(valeurDe(x));
            return v !== "" && lus.includes(v);
          });
          if (c) {
            vise = { c, el: n };
            break;
          }
        }
        if (vise) break;
      }
    }
    const tout = champs.length === 1 && (estCleElement(cle) || TOUT_TEXTE.has(cle));
    if (!vise && !tout) {
      if (!clic) setChoisi(cle);
      return false;
    }
    const c = vise?.c ?? champs[0];
    const cible =
      vise?.el ??
      el?.querySelector<HTMLElement>(
        ".doc-libre-texte, .doc-titre, .merci, .doc-mentions, footer",
      ) ??
      el;
    const cs = cible ? getComputedStyle(cible) : null;
    const k = echelleDuTexte(blocs[cle]);
    let cadre: { left: number; top: number; width: number; height: number } | undefined;
    if (vise && el) {
      const r = vise.el.getBoundingClientRect();
      const rb = el.getBoundingClientRect();
      cadre = {
        left: (r.left - rb.left) / echelle,
        top: (r.top - rb.top) / echelle,
        width: r.width / echelle,
        height: r.height / echelle,
      };
    }
    setChoisi(cle);
    setEcrit({
      cle,
      k: c.cle,
      valeur: valeurDe(c),
      defaut: c.valeur,
      multiligne: c.long || c.multiligne,
      cadre,
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
            textAlign: cs.textAlign as React.CSSProperties["textAlign"],
            color: cs.color,
            background: fondSous(cible),
            ...(vise
              ? {
                  padding: cs.padding
                    .split(" ")
                    .map((v) => `${(parseFloat(v) || 0) * k}px`)
                    .join(" "),
                }
              : {}),
          }
        : {},
    });
    return true;
  };

  const validerEcrit = () => {
    if (!ecrit) return;
    ecrireTexte(ecrit.cle, ecrit.k, ecrit.valeur, ecrit.defaut);
    setEcrit(null);
  };
  const choisiCachet = choisi !== null && estCleCachet(choisi);
  const genre = bloc?.element?.genre;
  /** Ce qui n'a pas de texte : ni police, ni alignement, ni texte clair. */
  const sansTexte = choisiCachet || genre === "trait" || genre === "cadre" || genre === "image";

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
          <div className="flex">
            <button
              type="button"
              onClick={annuler}
              disabled={passe.current.length === 0}
              className={boutonIcone}
              aria-label="Annuler"
              title="Annuler (Ctrl+Z)"
            >
              <Undo2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={retablir}
              disabled={futur.current.length === 0}
              className={boutonIcone}
              aria-label="Rétablir"
              title="Rétablir (Ctrl+Y)"
            >
              <Redo2 className="h-5 w-5" />
            </button>
          </div>
          {reglages && doc && (
            <button
              type="button"
              onClick={() => setApercu((a) => !a)}
              aria-pressed={apercu}
              aria-label={apercu ? "Retour à la feuille" : "Aperçu"}
              className="app-btn-secondary"
              title="Les pages telles qu'elles s'imprimeront, pagination comprise"
            >
              {apercu ? <Move className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              <span className="hidden sm:inline">{apercu ? "Retour à la feuille" : "Aperçu"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setD((p) => reinitialiserDisposition(p))}
            aria-label="Revenir au modèle d'origine"
            className="app-btn-secondary"
            title="Remet chaque bloc à sa place dans le modèle de départ. Les autres réglages ne bougent pas."
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Revenir au modèle d&apos;origine</span>
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
                        b,
                      ) === null;
                    const actif = choisi === cle;
                    return (
                      <div
                        key={cle}
                        data-cadre={cle}
                        onPointerDown={(e) => saisir(e, cle, null)}
                        onDoubleClick={(e) =>
                          ouvrirEcriture(cle, { x: e.clientX, y: e.clientY }, false)
                        }
                        onPointerMove={suivre}
                        onPointerUp={lacher}
                        onPointerCancel={() => lacher()}
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
                              } else if (
                                e.key === "Enter" &&
                                (e.ctrlKey || e.metaKey || (!ecrit.multiligne && !e.shiftKey))
                              ) {
                                e.preventDefault();
                                validerEcrit();
                              }
                            }}
                            className={`absolute z-10 resize-none overflow-hidden border-0 p-0 outline outline-2 outline-primary${
                              ecrit.cadre ? "" : " left-0 top-0 min-h-full w-full"
                            }`}
                            style={{ ...ecrit.style, ...placeDuMot(ecrit) }}
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
              {bloc && choisi && !enGeste && !ecrit && (
                <BarreBloc
                  nom={nomChoisi ?? ""}
                  bloc={bloc}
                  genre={choisiCachet ? "cachet" : (genre ?? null)}
                  verrouille={estVerrouille(choisi)}
                  cadre={{
                    gauche: bloc.x * PX_MM * echelle,
                    haut: bloc.y * PX_MM * echelle,
                    bas: (bloc.y + bloc.h) * PX_MM * echelle,
                  }}
                  largeurScene={LARGEUR_PX * echelle}
                  onHabiller={(patch) => habillerBloc(choisi, patch)}
                  onAligner={(align) => poser(choisi, { align })}
                  onDupliquer={
                    estCleElement(choisi)
                      ? () => {
                          const copie = dupliquerElement(d, choisi);
                          if (!copie) return;
                          setD(copie.disposition);
                          setChoisi(copie.cle);
                        }
                      : undefined
                  }
                  onSupprimer={() => supprimerBloc(choisi)}
                />
              )}
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
                          {v !== undefined && !estCleElement(choisi) && (
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
                  {!estCleElement(choisi) && (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Les chiffres, le client, les lignes et le nom de la boutique viennent de la
                      base : ils ne s&apos;écrivent pas ici.
                    </p>
                  )}
                </div>
              )}
              {bloc.habillage && genre !== "image" && !choisiCachet && (
                <button
                  type="button"
                  onClick={() => poser(choisi, { habillage: habillageDeDepart(genre) })}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  title="Reprendre l'allure du modèle"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Style du modèle
                </button>
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
              <div className="flex items-center justify-end gap-2">
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
              {!estCleElement(choisi) && !choisiCachet && (
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

          <section className="space-y-3 border-b border-border p-4">
            <p className="text-sm font-semibold text-foreground">Ajouter</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => ajouter("texte")} className="app-btn-secondary">
                <Type className="h-4 w-4" />
                Texte
              </button>
              <button type="button" onClick={() => ajouter("trait")} className="app-btn-secondary">
                <Minus className="h-4 w-4" />
                Trait
              </button>
              <button type="button" onClick={() => ajouter("cadre")} className="app-btn-secondary">
                <Square className="h-4 w-4" />
                Cadre
              </button>
              <label
                className={`app-btn-secondary cursor-pointer${
                  !storeId || envoi.enCours ? " pointer-events-none opacity-50" : ""
                }`}
                title={
                  storeId
                    ? "Une image de votre téléphone ou de l'ordinateur, posée telle quelle"
                    : "Ouvrez l'éditeur depuis une boutique pour ajouter une image"
                }
              >
                <ImagePlus className="h-4 w-4" />
                {envoi.enCours ? "Envoi…" : "Image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Ajouter une image"
                  disabled={!storeId || envoi.enCours}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void ajouterImage(f);
                  }}
                />
              </label>
            </div>
            {envoi.erreur && (
              <p role="alert" className="text-xs t-danger">
                {envoi.erreur}
              </p>
            )}
            {elements.length > 0 && (
              <ul className="divide-y divide-border">
                {elements.map((cle) => (
                  <li key={cle} className="flex items-center gap-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => setChoisi(cle)}
                      className={`min-w-0 flex-1 truncate py-1.5 text-left text-sm ${
                        choisi === cle ? "font-medium text-primary" : "text-foreground"
                      }`}
                    >
                      {nomDe(cle)}
                      {blocs[cle].textes?.texte ? ` · ${blocs[cle].textes?.texte}` : ""}
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer ${nomDe(cle)}`}
                      title="Supprimer"
                      onClick={() => {
                        setD((p) => retirerElement(p, cle));
                        if (choisi === cle) setChoisi(null);
                      }}
                      className={boutonIcone}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

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

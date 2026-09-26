import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Camera, Check, Crop, Eraser, ImageUp, Undo2 } from "lucide-react";
import {
  estDejaDetouree,
  recadrerTransparent,
  type Encre,
  type ImagePixels,
} from "../../features/documents/lib/fondCachet";
import {
  detourer,
  envoyerCachet,
  lireImage,
  versCanvas,
  versPng,
} from "../../features/documents/lib/traiterCachet";
import { largeurNetteMm, type Cachet } from "../../features/documents/lib/cachets";

interface Props {
  storeId: string;
  onFermer: () => void;
  onAjoute: (c: Cachet) => Promise<void> | void;
}

type Outil = "recadrer" | "gommer";
interface Cadre {
  x: number;
  y: number;
  l: number;
  h: number;
}

const ENCRES: { cle: Encre; nom: string }[] = [
  { cle: "originale", nom: "D'origine" },
  { cle: "noir", nom: "Noire" },
  { cle: "bleu", nom: "Bleue" },
];

const TOUT: Cadre = { x: 0, y: 0, l: 1, h: 1 };
const DAMIER = "repeating-conic-gradient(#e7ebe9 0% 25%, #ffffff 0% 50%) 50% / 16px 16px";

const boutonIcone =
  "inline-flex h-[34px] w-[34px] items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40";

export const ImportCachet: React.FC<Props> = ({ storeId, onFermer, onAjoute }) => {
  const [source, setSource] = useState<ImagePixels | null>(null);
  const [dejaDetouree, setDejaDetouree] = useState(false);
  const [sensibilite, setSensibilite] = useState(1);
  const [encre, setEncre] = useState<Encre>("originale");
  const [opacite, setOpacite] = useState(1);
  const [nom, setNom] = useState("");
  const [outil, setOutil] = useState<Outil>("recadrer");
  const [pinceau, setPinceau] = useState(24);
  const [cadre, setCadre] = useState<Cadre>(TOUT);
  const [taille, setTaille] = useState<{ l: number; h: number } | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retouches, setRetouches] = useState(0);

  const toile = useRef<HTMLCanvasElement>(null);
  const historique = useRef<ImageData[]>([]);
  const geste = useRef<{
    id: number;
    type: "gomme" | Outil | "no" | "ne" | "so" | "se";
    x0: number;
    y0: number;
    depart: Cadre;
  } | null>(null);
  const photo = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  const afficher = (img: ImagePixels) => {
    const c = toile.current;
    if (!c) return;
    const rendu = versCanvas(img);
    c.width = rendu.width;
    c.height = rendu.height;
    c.getContext("2d")?.drawImage(rendu, 0, 0);
    historique.current = [];
    setRetouches(0);
    setCadre(TOUT);
    setTaille({ l: img.width, h: img.height });
  };

  // Chaque réglage relance le détourage depuis la photo d'origine.
  useEffect(() => {
    if (!source) return;
    let actif = true;
    const t = window.setTimeout(async () => {
      setCalcul(true);
      setErreur(null);
      try {
        if (dejaDetouree) {
          afficher(recadrerTransparent(source));
          setAvertissement(null);
        } else {
          const r = await detourer(source, { sensibilite, encre });
          if (!actif) return;
          afficher(r.image);
          setAvertissement(r.avertissement);
        }
      } catch (e) {
        if (actif) setErreur(e instanceof Error ? e.message : "Le traitement a échoué.");
      } finally {
        if (actif) setCalcul(false);
      }
    }, 200);
    return () => {
      actif = false;
      window.clearTimeout(t);
    };
  }, [source, dejaDetouree, sensibilite, encre]);

  const choisir = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur(null);
    try {
      const img = await lireImage(fichier);
      setDejaDetouree(estDejaDetouree(img));
      setSource(img);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Cette image n'a pas pu être lue.");
    }
  };

  /** Position du pointeur dans l'image, de 0 à 1. */
  const position = (e: React.PointerEvent) => {
    const r = toile.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const gommer = (x: number, y: number) => {
    const c = toile.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    const rayon = (pinceau / 2) * (c.width / r.width);
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x * c.width, y * c.height, rayon, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const saisir = (e: React.PointerEvent<HTMLElement>, type: "no" | "ne" | "so" | "se" | null) => {
    if (!toile.current) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointeur déjà relâché.
    }
    const p = position(e);
    if (type) {
      geste.current = { id: e.pointerId, type, x0: p.x, y0: p.y, depart: cadre };
      return;
    }
    if (outil !== "gommer") return;
    const ctx = toile.current.getContext("2d");
    if (ctx) {
      historique.current = [
        ...historique.current.slice(-9),
        ctx.getImageData(0, 0, toile.current.width, toile.current.height),
      ];
      setRetouches(historique.current.length);
    }
    geste.current = { id: e.pointerId, type: "gomme", x0: p.x, y0: p.y, depart: cadre };
    gommer(p.x, p.y);
  };

  const suivre = (e: React.PointerEvent<HTMLElement>) => {
    const g = geste.current;
    if (!g || g.id !== e.pointerId) return;
    const p = position(e);
    if (g.type === "gomme") {
      // Des points rapprochés, pour un trait continu même quand le doigt va vite.
      const pas = Math.max(1, Math.ceil(Math.hypot(p.x - g.x0, p.y - g.y0) * 200));
      for (let i = 1; i <= pas; i++) {
        gommer(g.x0 + ((p.x - g.x0) * i) / pas, g.y0 + ((p.y - g.y0) * i) / pas);
      }
      g.x0 = p.x;
      g.y0 = p.y;
      return;
    }
    const d = g.depart;
    const min = 0.05;
    let [x0, y0, x1, y1] = [d.x, d.y, d.x + d.l, d.y + d.h];
    const dx = p.x - g.x0;
    const dy = p.y - g.y0;
    if (g.type === "no" || g.type === "so") x0 = Math.min(x1 - min, Math.max(0, x0 + dx));
    else x1 = Math.max(x0 + min, Math.min(1, x1 + dx));
    if (g.type === "no" || g.type === "ne") y0 = Math.min(y1 - min, Math.max(0, y0 + dy));
    else y1 = Math.max(y0 + min, Math.min(1, y1 + dy));
    setCadre({ x: x0, y: y0, l: x1 - x0, h: y1 - y0 });
  };

  const lacher = () => {
    geste.current = null;
  };

  const annuler = useCallback(() => {
    const c = toile.current;
    const precedent = historique.current.pop();
    if (c && precedent) c.getContext("2d")?.putImageData(precedent, 0, 0);
    setRetouches(historique.current.length);
  }, []);

  const valider = async () => {
    const c = toile.current;
    if (!c || !nom.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      const png = await versPng(c, cadre);
      const envoi = await envoyerCachet(storeId, png.blob);
      if (envoi.error || !envoi.chemin) throw new Error(envoi.error ?? "L'envoi a échoué.");
      await onAjoute({
        id: envoi.id,
        nom: nom.trim(),
        chemin: envoi.chemin,
        largeur: png.largeur,
        hauteur: png.hauteur,
        opacite,
        creeLe: new Date().toISOString(),
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.");
      setEnCours(false);
    }
  };

  const largeurFinale = taille ? Math.round(Math.min(1500, taille.l * cadre.l)) : 0;

  const ecran = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Nouveau cachet ou signature"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={onFermer}
          className={boutonIcone}
          aria-label="Revenir aux réglages"
          title="Revenir aux réglages"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          Nouveau cachet ou signature
        </p>
        <button
          type="button"
          onClick={() => void valider()}
          disabled={!source || !nom.trim() || enCours || calcul}
          className="app-btn-primary"
        >
          <Check className="h-4 w-4" />
          {enCours ? "Enregistrement…" : "Valider"}
        </button>
      </header>

      <input
        ref={photo}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void choisir(e.target.files?.[0])}
      />
      <input
        ref={galerie}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void choisir(e.target.files?.[0])}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="min-w-0 flex-1 bg-muted/40 p-3 sm:p-5 lg:overflow-y-auto">
          {!source ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Photographiez le cachet ou la signature sur une feuille blanche, bien à plat et à la
                lumière du jour. Le fond est retiré automatiquement.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => photo.current?.click()}
                  className="app-btn-primary"
                >
                  <Camera className="h-4 w-4" />
                  Prendre une photo
                </button>
                <button
                  type="button"
                  onClick={() => galerie.current?.click()}
                  className="app-btn-secondary"
                >
                  <ImageUp className="h-4 w-4" />
                  Importer une image
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-[14px] py-[14px]">
              <div
                className="relative mx-auto w-fit max-w-full touch-none select-none"
                style={{ background: DAMIER }}
                onPointerMove={suivre}
                onPointerUp={lacher}
                onPointerCancel={lacher}
              >
                <canvas
                  ref={toile}
                  data-toile
                  onPointerDown={(e) => saisir(e, null)}
                  className={`block max-h-[55vh] max-w-full ${outil === "gommer" ? "cursor-crosshair" : ""}`}
                  style={{ opacity: opacite }}
                />
                {outil === "recadrer" && taille && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div
                      className="absolute"
                      style={{
                        left: `${cadre.x * 100}%`,
                        top: `${cadre.y * 100}%`,
                        width: `${cadre.l * 100}%`,
                        height: `${cadre.h * 100}%`,
                        boxShadow: "0 0 0 9999px rgba(15, 20, 18, 0.35)",
                      }}
                    />
                  </div>
                )}
                {outil === "recadrer" && taille && (
                  <div
                    className="pointer-events-none absolute outline outline-2 outline-primary"
                    style={{
                      left: `${cadre.x * 100}%`,
                      top: `${cadre.y * 100}%`,
                      width: `${cadre.l * 100}%`,
                      height: `${cadre.h * 100}%`,
                    }}
                  >
                    {(["no", "ne", "so", "se"] as const).map((p) => (
                      <span
                        key={p}
                        data-poignee={p}
                        onPointerDown={(e) => saisir(e, p)}
                        className="pointer-events-auto absolute flex h-7 w-7 items-center justify-center"
                        style={{
                          left: p === "no" || p === "so" ? -14 : undefined,
                          right: p === "ne" || p === "se" ? -14 : undefined,
                          top: p === "no" || p === "ne" ? -14 : undefined,
                          bottom: p === "so" || p === "se" ? -14 : undefined,
                          cursor: p === "no" || p === "se" ? "nwse-resize" : "nesw-resize",
                        }}
                      >
                        <span className="block h-2.5 w-2.5 border-2 border-primary bg-card" />
                      </span>
                    ))}
                  </div>
                )}
                {calcul && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/60 text-sm text-foreground">
                    Suppression du fond…
                  </div>
                )}
              </div>
              {taille && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {largeurFinale} px de large : net jusqu&apos;à{" "}
                  {largeurNetteMm({ largeur: largeurFinale })} mm à l&apos;impression.
                </p>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 border-t border-border bg-card p-4 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
          {erreur && (
            <p
              role="alert"
              className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-xs t-danger"
            >
              {erreur}
            </p>
          )}
          {avertissement && (
            <div className="space-y-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning">
              <p>{avertissement}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => photo.current?.click()}
                  className="app-btn-secondary"
                >
                  Reprendre la photo
                </button>
                <button
                  type="button"
                  onClick={() => galerie.current?.click()}
                  className="app-btn-secondary"
                >
                  Importer une image déjà découpée
                </button>
              </div>
            </div>
          )}

          <label className="block text-xs text-muted-foreground">
            Nom
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Cachet officiel, signature du gérant…"
              className="app-field mt-1 w-full"
            />
          </label>

          {source && (
            <>
              <label className="flex items-center justify-between gap-3 text-xs text-foreground">
                Image déjà détourée (fond transparent)
                <input
                  type="checkbox"
                  checked={dejaDetouree}
                  onChange={(e) => setDejaDetouree(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
              </label>

              {!dejaDetouree && (
                <>
                  <label className="block text-xs text-muted-foreground">
                    Sensibilité — garde les traits pâles ({Math.round(sensibilite * 100)} %)
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={sensibilite}
                      onChange={(e) => setSensibilite(Number(e.target.value))}
                      className="mt-1 w-full accent-[var(--color-primary)]"
                    />
                  </label>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Encre</p>
                    <div className="flex gap-2">
                      {ENCRES.map((e) => (
                        <button
                          key={e.cle}
                          type="button"
                          aria-pressed={encre === e.cle}
                          onClick={() => setEncre(e.cle)}
                          className={encre === e.cle ? "app-btn-primary" : "app-btn-secondary"}
                        >
                          {e.nom}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <label className="block text-xs text-muted-foreground">
                Opacité ({Math.round(opacite * 100)} %)
                <input
                  type="range"
                  min={0.3}
                  max={1}
                  step={0.05}
                  value={opacite}
                  onChange={(e) => setOpacite(Number(e.target.value))}
                  className="mt-1 w-full accent-[var(--color-primary)]"
                />
              </label>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Retouche</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={outil === "recadrer"}
                    onClick={() => setOutil("recadrer")}
                    className={outil === "recadrer" ? "app-btn-primary" : "app-btn-secondary"}
                  >
                    <Crop className="h-4 w-4" />
                    Recadrer
                  </button>
                  <button
                    type="button"
                    aria-pressed={outil === "gommer"}
                    onClick={() => setOutil("gommer")}
                    className={outil === "gommer" ? "app-btn-primary" : "app-btn-secondary"}
                  >
                    <Eraser className="h-4 w-4" />
                    Gommer
                  </button>
                  <button
                    type="button"
                    onClick={annuler}
                    disabled={retouches === 0}
                    className={boutonIcone}
                    aria-label="Annuler le dernier coup de gomme"
                    title="Annuler le dernier coup de gomme"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </div>
                {outil === "gommer" && (
                  <label className="mt-2 block text-xs text-muted-foreground">
                    Taille de la gomme ({pinceau} px)
                    <input
                      type="range"
                      min={6}
                      max={80}
                      value={pinceau}
                      onChange={(e) => setPinceau(Number(e.target.value))}
                      className="mt-1 w-full accent-[var(--color-primary)]"
                    />
                  </label>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Changer la sensibilité ou l&apos;encre relance le détourage : gommez en dernier.
                </p>
              </div>

              <button
                type="button"
                onClick={() => galerie.current?.click()}
                className="app-btn-secondary w-full"
              >
                <ImageUp className="h-4 w-4" />
                Choisir une autre image
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(ecran, document.body);
};

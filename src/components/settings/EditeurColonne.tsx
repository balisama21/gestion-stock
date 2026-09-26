import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Lock, RotateCcw, Save } from "lucide-react";
import type { Document } from "../../features/documents/lib/buildDocument";
import type { ReglagesTicket } from "../../features/documents/lib/reglages";
import {
  basculerSection,
  colonneResolue,
  deplacerSection,
  reinitialiserDisposition,
  SECTIONS_TICKET,
  type CleTicket,
  type Disposition,
} from "../../features/documents/lib/disposition";
import { Ticket } from "../../features/documents/templates/Ticket";
import "../../features/documents/index.css";

const PX_MM = 96 / 25.4;

interface Props {
  disposition: Disposition;
  document: Document | null;
  ticket: ReglagesTicket;
  enCours: boolean;
  onFermer: (d: Disposition) => void;
  onEnregistrer: (d: Disposition) => void;
}

interface Glisse {
  id: number;
  cle: CleTicket;
  y0: number;
}

const boutonIcone =
  "inline-flex h-[34px] w-[34px] items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40";

const nomSection = (cle: CleTicket) => SECTIONS_TICKET.find((s) => s.cle === cle)!.nom;

/** Le rang où la section tombera si on la lâche à ce centre-ci : celui du milieu le plus proche. */
export function rangDeDepot(
  cadres: Partial<Record<CleTicket, { top: number; h: number }>>,
  ordre: CleTicket[],
  cle: CleTicket,
  centre: number,
): number {
  return ordre
    .filter((c) => c !== cle && cadres[c])
    .filter((c) => cadres[c]!.top + cadres[c]!.h / 2 < centre).length;
}

/** Ticket de caisse : les sections se rangent de haut en bas, sur toute la largeur du rouleau. */
export const EditeurColonne: React.FC<Props> = ({
  disposition,
  document: doc,
  ticket,
  enCours,
  onFermer,
  onEnregistrer,
}) => {
  const [d, setD] = useState(disposition);
  const [choisi, setChoisi] = useState<CleTicket | null>(null);
  const [echelle, setEchelle] = useState(1);
  const [cadres, setCadres] = useState<Partial<Record<CleTicket, { top: number; h: number }>>>({});
  const [decalage, setDecalage] = useState(0);
  const [hauteur, setHauteur] = useState(0);
  const scene = useRef<HTMLDivElement>(null);
  const rouleau = useRef<HTMLDivElement>(null);
  const glisse = useRef<Glisse | null>(null);

  const colonne = colonneResolue(d);
  const visibles = colonne.ordre.filter((c) => !colonne.masques.includes(c));
  const largeurPx = ticket.largeur * PX_MM;

  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    const mesurer = () => setEchelle(Math.min(1.5, el.clientWidth / largeurPx) || 1);
    mesurer();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, [largeurPx]);

  useLayoutEffect(() => {
    const r = rouleau.current;
    if (!r) return;
    const suite: typeof cadres = {};
    r.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => {
      suite[el.dataset.section as CleTicket] = { top: el.offsetTop, h: el.offsetHeight };
    });
    if (JSON.stringify(suite) !== JSON.stringify(cadres)) setCadres(suite);
    if (r.offsetHeight !== hauteur) setHauteur(r.offsetHeight);
  });

  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  const monter = (cle: CleTicket, pas: number) =>
    setD((p) => {
      const ordre = colonneResolue(p).ordre;
      return deplacerSection(p, cle, ordre.indexOf(cle) + pas);
    });

  const saisir = (e: React.PointerEvent<HTMLDivElement>, cle: CleTicket) => {
    e.stopPropagation();
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
    glisse.current = { id: e.pointerId, cle, y0: e.clientY };
  };

  const suivre = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = glisse.current;
    if (!g || g.id !== e.pointerId) return;
    setDecalage((e.clientY - g.y0) / echelle);
  };

  const cadreGlisse = glisse.current ? cadres[glisse.current.cle] : undefined;
  const depot =
    glisse.current && cadreGlisse
      ? rangDeDepot(
          cadres,
          visibles,
          glisse.current.cle,
          cadreGlisse.top + cadreGlisse.h / 2 + decalage,
        )
      : null;
  // L'aimant : la ligne où la section viendra se poser.
  const ligneDepot = (() => {
    if (depot === null || !glisse.current) return null;
    const autres = visibles.filter((c) => c !== glisse.current!.cle && cadres[c]);
    if (autres.length === 0) return null;
    if (depot >= autres.length) {
      const der = cadres[autres[autres.length - 1]]!;
      return der.top + der.h;
    }
    return cadres[autres[depot]]!.top;
  })();

  const lacher = () => {
    const g = glisse.current;
    glisse.current = null;
    if (g && depot !== null) {
      // Le rang se compte parmi les sections visibles ; on le reporte dans l'ordre complet.
      const autres = colonne.ordre.filter((c) => c !== g.cle);
      const avant = visibles.filter((c) => c !== g.cle)[depot];
      const rang = avant ? autres.indexOf(avant) : autres.length;
      setD((p) => deplacerSection(p, g.cle, rang));
    }
    setDecalage(0);
  };

  const ecran = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Éditeur du ticket"
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
          <button
            type="button"
            onClick={() => setD((p) => reinitialiserDisposition(p))}
            className="app-btn-secondary"
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
          <div ref={scene} className="mx-auto w-full" style={{ maxWidth: largeurPx * 1.5 }}>
            {doc ? (
              <div
                className="relative mx-auto"
                style={{
                  width: largeurPx * echelle,
                  height: hauteur * echelle || undefined,
                }}
                onPointerDown={() => setChoisi(null)}
              >
                <div
                  ref={rouleau}
                  className={`doc-ticket${ticket.largeur === 58 ? " doc-ticket--58" : ""}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `scale(${echelle})`,
                    transformOrigin: "top left",
                  }}
                >
                  <Ticket
                    document={doc}
                    reglages={ticket}
                    date={doc.meta.find((m) => m.libelle === "Date")?.valeur ?? ""}
                    colonne={colonne}
                    reperer
                  />
                  <div className="absolute inset-0" style={{ zIndex: 5 }}>
                    {visibles.map((cle) => {
                      const c = cadres[cle];
                      if (!c) return null;
                      const actif = choisi === cle;
                      const bouge = glisse.current?.cle === cle;
                      return (
                        <div
                          key={cle}
                          data-cadre={cle}
                          onPointerDown={(e) => saisir(e, cle)}
                          onPointerMove={suivre}
                          onPointerUp={lacher}
                          onPointerCancel={lacher}
                          className={`absolute left-0 right-0 cursor-ns-resize select-none ${
                            actif
                              ? "bg-primary/5 outline outline-2 outline-primary"
                              : "outline-dashed outline-1 outline-transparent hover:outline-muted-foreground/50"
                          }`}
                          style={{
                            top: c.top,
                            height: c.h,
                            transform: bouge ? `translateY(${decalage}px)` : undefined,
                            touchAction: actif ? "none" : undefined,
                          }}
                        />
                      );
                    })}
                    {ligneDepot !== null && (
                      <span
                        data-guide="y"
                        className="pointer-events-none absolute left-0 right-0 bg-primary"
                        style={{ top: ligneDepot - 1 / echelle, height: 2 / echelle }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                L&apos;aperçu du ticket apparaîtra après une première vente. L&apos;ordre se règle
                déjà dans la liste.
              </p>
            )}
          </div>
        </div>

        <aside className="border-t border-border bg-card lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <p className="border-b border-border p-4 text-xs leading-relaxed text-muted-foreground">
            Faites glisser une section vers le haut ou le bas : elle se pose entre les deux sections
            les plus proches. Les flèches font de même.
          </p>
          <ul className="divide-y divide-border">
            {colonne.ordre.map((cle, rang) => {
              const section = SECTIONS_TICKET.find((s) => s.cle === cle)!;
              const masque = colonne.masques.includes(cle);
              return (
                <li key={cle} className="flex items-center gap-1 px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => setChoisi(cle)}
                    className={`min-w-0 flex-1 truncate py-1.5 text-left text-sm ${
                      choisi === cle
                        ? "font-medium text-primary"
                        : masque
                          ? "text-muted-foreground"
                          : "text-foreground"
                    }`}
                  >
                    {section.nom}
                  </button>
                  <button
                    type="button"
                    disabled={rang === 0}
                    onClick={() => monter(cle, -1)}
                    className={boutonIcone}
                    aria-label={`Monter ${section.nom}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={rang === colonne.ordre.length - 1}
                    onClick={() => monter(cle, 1)}
                    className={boutonIcone}
                    aria-label={`Descendre ${section.nom}`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  {section.verrouille ? (
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
                      onClick={() => setD((p) => basculerSection(p, cle))}
                      className={boutonIcone}
                      aria-label={masque ? `Afficher ${section.nom}` : `Masquer ${section.nom}`}
                    >
                      {masque ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {choisi && (
            <p className="p-4 text-xs text-muted-foreground">Choisi : {nomSection(choisi)}</p>
          )}
        </aside>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(ecran, document.body);
};

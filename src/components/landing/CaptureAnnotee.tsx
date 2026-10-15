import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Une vraie capture de l'application, expliquée par des numéros.
 *
 * Les captures sont prises sur une boutique de démonstration : les noms,
 * téléphones et montants sont inventés. Jamais une capture d'une boutique
 * réelle sur une page publique.
 *
 * ── Deux lectures selon la largeur ──
 *
 * Sur grand écran, les explications se rangent dans deux colonnes, de part
 * et d'autre de la capture, chacune à la hauteur de la pastille numérotée
 * posée sur l'élément qu'elle décrit. Le numéro suffit à les relier : pas
 * de flèche qui barrerait la capture.
 *
 * Sur téléphone, il n'y a pas la place pour des colonnes : les pastilles
 * gardent leur numéro, et les explications passent sous la capture, dans
 * le même ordre.
 */

export interface Repere {
  /** Position de l'élément, en pourcentage de la largeur de la capture. */
  x: number;
  /** Position de l'élément, en pourcentage de la hauteur de la capture. */
  y: number;
  titre: string;
  texte?: string;
  cote: "gauche" | "droite";
}

interface CaptureAnnoteeProps {
  src: string;
  /** Une version allégée pour les petits écrans. */
  srcPetit?: string;
  largeur: number;
  hauteur: number;
  alt: string;
  reperes: Repere[];
  /** Le libellé de la barre de fenêtre, au-dessus de la capture. */
  ecran?: string;
  /** Largeur maximale de la capture sur grand écran (captures étroites). */
  largeurMax?: string;
}

export const CaptureAnnotee: React.FC<CaptureAnnoteeProps> = ({
  src,
  srcPetit,
  largeur,
  hauteur,
  alt,
  reperes,
  ecran,
  largeurMax,
}) => {
  const numerotes = reperes.map((r, i) => ({ ...r, n: i + 1 }));
  const gauche = numerotes.filter((r) => r.cote === "gauche").sort((a, b) => a.y - b.y);
  const droite = numerotes.filter((r) => r.cote === "droite").sort((a, b) => a.y - b.y);

  const conteneur = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLDivElement>(null);
  const etiquettes = useRef(new Map<number, HTMLDivElement>());
  const colonnesRef = useRef<{ gauche: HTMLDivElement | null; droite: HTMLDivElement | null }>({
    gauche: null,
    droite: null,
  });
  const [hauts, setHauts] = useState<Record<number, number>>({});

  const mesurer = useCallback(() => {
    const img = image.current;
    if (!img || !window.matchMedia("(min-width: 1024px)").matches) return;
    const i = img.getBoundingClientRect();
    const nouveauxHauts: Record<number, number> = {};

    // Chaque explication se place à la hauteur de ce qu'elle désigne,
    // puis on écarte celles qui se chevaucheraient, de haut en bas, et on
    // remonte l'ensemble s'il dépasse le bas de la colonne.
    for (const [cote, liste] of [
      ["gauche", gauche],
      ["droite", droite],
    ] as const) {
      const col = colonnesRef.current[cote];
      if (!col || liste.length === 0) continue;
      const c = col.getBoundingClientRect();
      const hauteurs = liste.map((r) => etiquettes.current.get(r.n)?.offsetHeight ?? 60);
      const tops = liste.map((r) => i.top - c.top + (r.y / 100) * i.height - 13);
      for (let k = 0; k < tops.length; k++) {
        tops[k] = Math.max(tops[k], 0);
        if (k > 0) tops[k] = Math.max(tops[k], tops[k - 1] + hauteurs[k - 1] + 18);
      }
      const debord = tops[tops.length - 1] + hauteurs[hauteurs.length - 1] - c.height;
      if (debord > 0)
        for (let k = tops.length - 1; k >= 0; k--) tops[k] = Math.max(0, tops[k] - debord);
      liste.forEach((r, k) => {
        nouveauxHauts[r.n] = tops[k];
      });
    }

    setHauts(nouveauxHauts);
    // gauche et droite sont recalculés à chaque rendu mais ne dépendent que des props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reperes]);

  useLayoutEffect(() => {
    mesurer();
  }, [mesurer]);

  useEffect(() => {
    const boite = conteneur.current;
    if (!boite) return;
    const observateur = new ResizeObserver(() => mesurer());
    observateur.observe(boite);
    return () => observateur.disconnect();
  }, [mesurer]);

  const colonne = (liste: typeof numerotes, cote: "gauche" | "droite") =>
    liste.length > 0 && (
      <div
        ref={(el) => {
          colonnesRef.current[cote] = el;
        }}
        className={`relative hidden flex-col justify-around gap-8 py-6 lg:flex ${
          cote === "gauche" ? "text-right" : "text-left"
        }`}
      >
        {liste.map((r) => (
          <div
            key={r.n}
            ref={(el) => {
              if (el) etiquettes.current.set(r.n, el);
              else etiquettes.current.delete(r.n);
            }}
            className="ca-etiquette"
            style={
              hauts[r.n] !== undefined
                ? { position: "absolute", left: 0, right: 0, top: hauts[r.n] }
                : undefined
            }
          >
            <p
              className={`flex items-center gap-2 text-[0.95rem] font-semibold leading-snug ${
                cote === "gauche" ? "justify-end" : ""
              }`}
              style={{ color: "var(--carbone)" }}
            >
              {cote === "droite" && <span className="ca-num">{r.n}</span>}
              {r.titre}
              {cote === "gauche" && <span className="ca-num">{r.n}</span>}
            </p>
            {r.texte && (
              <p
                className="mt-1 text-[0.85rem] leading-relaxed"
                style={{ color: "var(--carbone-doux)" }}
              >
                {r.texte}
              </p>
            )}
          </div>
        ))}
      </div>
    );

  const colonnes =
    gauche.length && droite.length
      ? "lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,13rem)]"
      : gauche.length
        ? "lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
        : "lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]";

  return (
    <figure className="m-0">
      <style>{`
        .ca-num {
          display: inline-grid; place-items: center; flex: none;
          width: 1.5rem; height: 1.5rem; border-radius: 999px;
          background: var(--primary); color: #fff;
          font-size: .75rem; font-weight: 700;
        }
        /* Posée en haut à droite du point visé, pas dessus : la valeur
           désignée reste lisible. */
        .ca-pastille {
          position: absolute; transform: translate(-10%, -95%);
          display: grid; place-items: center;
          width: 22px; height: 22px; border-radius: 999px;
          background: var(--primary); color: #fff;
          font-size: .75rem; font-weight: 800; line-height: 1;
          box-shadow: 0 0 0 2.5px #fff, 0 4px 10px rgba(28,27,24,.25);
        }
      `}</style>

      <div ref={conteneur} className={`relative grid items-stretch gap-x-8 ${colonnes}`}>
        {colonne(gauche, "gauche")}

        <div className="mx-auto w-full" style={largeurMax ? { maxWidth: largeurMax } : undefined}>
          <div
            className="overflow-hidden rounded-2xl border bg-white"
            style={{
              borderColor: "var(--reglure)",
              boxShadow: "0 24px 60px -24px rgba(28,27,24,.35), 0 2px 6px rgba(28,27,24,.06)",
            }}
          >
            <div
              className="flex items-center gap-1.5 border-b px-3.5 py-2"
              style={{ borderColor: "var(--reglure)", background: "#f6f5f1" }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e46a5c" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e9b64b" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#5fb36f" }} />
              {ecran && (
                <span
                  className="ml-3 truncate text-[0.72rem] font-medium"
                  style={{ color: "var(--carbone-doux)" }}
                >
                  {ecran}
                </span>
              )}
            </div>
            <div ref={image} className="relative">
              <img
                src={src}
                srcSet={srcPetit ? `${srcPetit} 800w, ${src} ${largeur}w` : undefined}
                sizes={
                  largeurMax
                    ? `(min-width: 1024px) ${largeurMax}, 100vw`
                    : "(min-width: 1024px) 60vw, 100vw"
                }
                width={largeur}
                height={hauteur}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
                onLoad={mesurer}
              />
              {numerotes.map((r) => (
                <span key={r.n} className="ca-pastille" style={{ left: `${r.x}%`, top: `${r.y}%` }}>
                  {r.n}
                </span>
              ))}
            </div>
          </div>
        </div>

        {colonne(droite, "droite")}
      </div>

      {/* Téléphone : la même explication, en liste sous la capture. */}
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:hidden">
        {numerotes.map((r) => (
          <li key={r.n} className="flex gap-3">
            <span className="ca-num mt-0.5">{r.n}</span>
            <span>
              <span
                className="block text-[0.95rem] font-semibold leading-snug"
                style={{ color: "var(--carbone)" }}
              >
                {r.titre}
              </span>
              {r.texte && (
                <span
                  className="mt-0.5 block text-[0.85rem] leading-relaxed"
                  style={{ color: "var(--carbone-doux)" }}
                >
                  {r.texte}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
};

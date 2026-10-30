import React, { useEffect, useRef, useState } from "react";
import "./operations.css";

/**
 * LA SECTION « OPÉRATIONS »
 *
 * Les cartes de la section (agenda, à faire, commandes, livraisons),
 * chacune avec son illustration. Elle n'a plus de bannière : c'est
 * « Inspiration du moment », posée juste au-dessus, qui ouvre la fin de
 * la page.
 *
 * Sur ordinateur et tablette, les cartes forment un seul panneau en
 * quatre. Sur téléphone, elles deviennent les pages d'un bloc-notes à
 * spirale, ouvert, deux par deux : agenda | à faire, puis commandes |
 * livraisons (voir `operations.css`). On passe d'une page à l'autre du
 * doigt ou par les onglets dessous :
 * - dans un même double, la vue glisse d'une page à l'autre ;
 * - d'un double à l'autre, on tourne la page : elle se soulève autour de
 *   la spirale, passe de l'autre côté et se rabat, et la page suivante
 *   apparaît dessous.
 *
 * Le titre reste dans le document pour les lecteurs d'écran et pour
 * `aria-labelledby`.
 */

export interface FeuilleOperation {
  cle: string;
  /** Le nom de l'onglet : « Agenda », « À faire »… */
  nom: string;
  carte: React.ReactNode;
}

/** La durée d'une page tournée : elle se soulève, puis se rabat. */
export const DUREE_TOUR = 1000;

/** Le glissement du doigt, en pixels, qui tourne la page. */
const SEUIL = 40;

export const SectionOperations: React.FC<{ feuilles: FeuilleOperation[] }> = ({ feuilles }) => {
  const [choisie, setVue] = useState(0);
  // Une carte retirée (droits changés) ne laisse pas la vue dans le vide.
  const vue = Math.min(choisie, Math.max(0, feuilles.length - 1));
  const [tour, setTour] = useState<"avant" | "arriere" | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const fin = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(fin.current), []);

  const aller = (i: number) => {
    if (tour || i < 0 || i >= feuilles.length || i === vue) return;
    const de = Math.floor(vue / 2);
    const vers = Math.floor(i / 2);
    setVue(i);
    if (de === vers) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setTour(vers > de ? "avant" : "arriere");
    fin.current = window.setTimeout(() => setTour(null), DUREE_TOUR);
  };

  return (
    <section className="blk op-section" id="operations" aria-labelledby="operations-titre">
      <h2 id="operations-titre" className="sr-only">
        Opérations
      </h2>
      <div className="blk-corps">
        <div
          className="op-cadre"
          onPointerDown={(e) => {
            depart.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const d = depart.current;
            depart.current = null;
            if (!d) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > SEUIL && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
              aller(vue + (dx < 0 ? 1 : -1));
            }
          }}
        >
          <div className="op-camera" data-cote={vue % 2 === 0 ? "gauche" : "droite"}>
            <div
              className="g2 op-bande"
              data-double={tour ? undefined : Math.floor(vue / 2)}
              data-sens={tour ?? undefined}
            >
              {feuilles.map((f) => (
                <React.Fragment key={f.cle}>{f.carte}</React.Fragment>
              ))}
            </div>
            <span className="op-spirale" aria-hidden="true" />
          </div>
        </div>
        {feuilles.length > 1 && (
          <nav className="op-onglets" aria-label="Pages des opérations">
            {feuilles.map((f, i) => (
              <button
                type="button"
                key={f.cle}
                aria-current={i === vue ? "true" : undefined}
                onClick={() => aller(i)}
              >
                {f.nom}
              </button>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
};

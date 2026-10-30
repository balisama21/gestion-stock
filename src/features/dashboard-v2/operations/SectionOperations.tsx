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
 * quatre. Sur téléphone, elles deviennent les pages d'un cahier ouvert,
 * deux par deux autour de la reliure, qu'on tourne du doigt (voir
 * `operations.css`) ; les onglets dessous disent laquelle est devant et
 * mènent aux autres.
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

export const SectionOperations: React.FC<{ feuilles: FeuilleOperation[] }> = ({ feuilles }) => {
  const bande = useRef<HTMLDivElement>(null);
  const [devant, setDevant] = useState(0);

  // La feuille devant : celle dont le milieu est le plus près du milieu
  // de la bande. Quatre feuilles à mesurer : on le fait à chaque
  // défilement, et React ignore un état inchangé.
  useEffect(() => {
    const el = bande.current;
    if (!el) return;
    const mesurer = () => {
      const milieu = el.scrollLeft + el.clientWidth / 2;
      let meilleure = 0;
      let ecart = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const f = c as HTMLElement;
        const d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - milieu);
        if (d < ecart) {
          ecart = d;
          meilleure = i;
        }
      });
      setDevant(meilleure);
    };
    el.addEventListener("scroll", mesurer, { passive: true });
    return () => el.removeEventListener("scroll", mesurer);
  }, []);

  const montrer = (i: number) => {
    const el = bande.current;
    const f = el?.children[i] as HTMLElement | undefined;
    if (!el || !f) return;
    const doux = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo?.({
      left: f.offsetLeft - (el.clientWidth - f.offsetWidth) / 2,
      behavior: doux ? "smooth" : "auto",
    });
  };

  return (
    <section className="blk op-section" id="operations" aria-labelledby="operations-titre">
      <h2 id="operations-titre" className="sr-only">
        Opérations
      </h2>
      <div className="blk-corps">
        <div className="g2 op-bande" ref={bande}>
          {feuilles.map((f) => (
            <React.Fragment key={f.cle}>{f.carte}</React.Fragment>
          ))}
        </div>
        {feuilles.length > 1 && (
          <nav className="op-onglets" aria-label="Feuilles des opérations">
            {feuilles.map((f, i) => (
              <button
                type="button"
                key={f.cle}
                aria-current={i === devant ? "true" : undefined}
                onClick={() => montrer(i)}
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

import React from "react";
import "./operations.css";

/**
 * LA SECTION « OPÉRATIONS »
 *
 * Les cartes de la section (agenda, à faire, commandes, livraisons),
 * chacune avec son illustration. Elle n'a plus de bannière : c'est
 * « Inspiration du moment », posée juste au-dessus, qui ouvre la fin de
 * la page.
 *
 * Le titre reste dans le document pour les lecteurs d'écran et pour
 * `aria-labelledby`.
 */

export const SectionOperations: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="blk op-section" id="operations" aria-labelledby="operations-titre">
    <h2 id="operations-titre" className="sr-only">
      Opérations
    </h2>
    <div className="blk-corps">{children}</div>
  </section>
);

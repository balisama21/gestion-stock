import React from "react";
import type { TacheAffichee } from "../cards/CarteTaches";
import { DonneesBanniere, type CommandesBanniere } from "./DonneesBanniere";
import "./operations.css";

/**
 * LA SECTION « OPÉRATIONS »
 *
 * La bannière est l'image de la maquette (`public/illustrations/
 * operations.webp`), posée telle quelle sur la page : ses bords se fondent
 * dans le fond, sans cadre. Par-dessus, `DonneesBanniere` écrit les
 * vraies données (date, calendrier, commandes, tâches) à la place de
 * celles de la maquette. Viennent ensuite les cartes de la section
 * (agenda, à faire, commandes, livraisons), chacune avec son illustration.
 *
 * Le titre reste dans le document pour les lecteurs d'écran et pour
 * `aria-labelledby` ; à l'écran, c'est celui de l'image.
 */

export const SectionOperations: React.FC<{
  /** La date du jour, lue après le premier rendu. `null` : pas encore. */
  jour: Date | null;
  joursCharges: Set<string>;
  commandes: CommandesBanniere;
  taches: TacheAffichee[];
  children: React.ReactNode;
}> = ({ jour, joursCharges, commandes, taches, children }) => (
  <section className="blk op-section" id="operations" aria-labelledby="operations-titre">
    <div className="op-banniere">
      <h2 id="operations-titre" className="sr-only">
        Opérations
      </h2>
      <img
        src="/illustrations/operations.webp"
        alt="Espace de gestion : agenda, confirmations, préparation, livraisons et encaissements de la boutique."
        width={1812}
        height={868}
        decoding="async"
      />
      {jour && (
        <DonneesBanniere
          jour={jour}
          joursCharges={joursCharges}
          commandes={commandes}
          taches={taches}
        />
      )}
    </div>

    <div className="blk-corps">{children}</div>
  </section>
);

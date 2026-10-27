import React from "react";
import { Icone } from "../../../components/shared/Icone";
import { dateDuJour } from "../../../lib/dates";
import { IllBanniere } from "./Illustrations";
import "./operations.css";

/**
 * LA SECTION « OPÉRATIONS »
 *
 * Une bannière vert très clair — le titre, la date du jour, et la vue
 * d'ensemble illustrée —, puis les
 * cartes de la section (agenda, à faire, commandes, livraisons), chacune
 * avec son illustration.
 *
 * La bannière est TOUJOURS l'illustration : les photos des sections
 * (Paramètres → Photos des sections) habillent les autres sections, pas
 * celle-ci, dont la vue d'ensemble suit les données du jour.
 */

export const SectionOperations: React.FC<{
  /** La date du jour, lue après le premier rendu. `null` : pas encore. */
  jour: Date | null;
  commandesAPreparer: number;
  livraisonsEnRoute: boolean;
  children: React.ReactNode;
}> = ({ jour, commandesAPreparer, livraisonsEnRoute, children }) => {
  const dateLongue = jour
    ? (() => {
        const t = jour.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        return t.charAt(0).toUpperCase() + t.slice(1);
      })()
    : " ";
  return (
    <section className="blk op-section" id="operations" aria-labelledby="operations-titre">
      <div className="op-banniere">
        <div className="op-banniere-txt">
          <span className="blk-sur" aria-hidden="true">
            <Icone nom="leaf" />
            Espace de gestion
          </span>
          <h2 id="operations-titre">Opérations</h2>
          <p>Une vue claire sur l&apos;activité de votre boutique.</p>
          <span className="op-date">
            <Icone nom="calendar" />
            <time dateTime={jour ? dateDuJour(jour) : undefined}>{dateLongue}</time>
          </span>
        </div>
        <div className="op-banniere-ill">
          {jour && (
            <IllBanniere
              jour={jour.getDate()}
              mois={jour.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
              commandesAPreparer={commandesAPreparer}
              livraisonsEnRoute={livraisonsEnRoute}
            />
          )}
        </div>
      </div>

      <div className="blk-corps">{children}</div>
    </section>
  );
};

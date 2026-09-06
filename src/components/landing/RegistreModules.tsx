import React from "react";
import { APP_NAME } from "../../lib/appConfig";
import {
  BarresBilan,
  EtiquetteStock,
  FicheClient,
  PageCarnet,
  PetitTicket,
  RubanCommande,
} from "./VignettesRegistre";

/**
 * Ce que le logiciel prend en charge, ligne à ligne.
 *
 * À gauche ce que le commerçant note aujourd'hui à la main, à droite ce
 * que le logiciel en fait — et, en face, l'objet lui-même : l'étiquette
 * de rayon, la page de carnet, la fiche client, le ruban de commande, le
 * ticket, les barres du bilan. Montrer vaut mieux qu'affirmer, et ces
 * six objets n'ont pas la même forme : c'est leur variété qui dit la
 * variété du travail couvert.
 *
 * Les bandes alternent le côté du visuel. Ce balancement donne le rythme
 * que six vignettes alignées n'auraient pas eu, sans qu'aucune animation
 * soit nécessaire — le mouvement de la page reste celui du ticket qui
 * s'imprime, et lui seul.
 */
const LIGNES = [
  {
    avant: "Les entrées et sorties de marchandise",
    apres: "Stock à jour, et l'alerte avant la rupture plutôt qu'après",
    visuel: <EtiquetteStock />,
  },
  {
    avant: "Les ventes de la journée sur un carnet",
    apres: "Encaissements, ventes à crédit et reste à payer, additionnés seuls",
    visuel: <PageCarnet />,
  },
  {
    avant: "Les noms de ceux qui doivent encore",
    apres: "Le solde de chaque client, sans avoir à le chercher",
    visuel: <FicheClient />,
  },
  {
    avant: "Les bons de commande sur un coin de table",
    apres: "Où en est chaque commande, jusqu'à la livraison",
    visuel: <RubanCommande />,
  },
  {
    avant: "Le ticket écrit à la main",
    apres: "Ticket 58 ou 80 mm, facture A4, imprimé ou envoyé en image",
    visuel: <PetitTicket />,
  },
  {
    avant: "Les comptes du mois, au crayon",
    apres: "Chiffre d'affaires, marges et bilan, calculés à mesure",
    visuel: <BarresBilan />,
  },
] as const;

export const RegistreModules: React.FC = () => (
  <section id="registre" className="scroll-mt-16 px-5 py-20 sm:py-24">
    <div className="mx-auto max-w-5xl">
      <h2 className="titrage text-[clamp(1.6rem,4.6vw,2.3rem)]">
        Ce que {APP_NAME} tient à votre place
      </h2>
      <p
        className="mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed"
        style={{ color: "var(--carbone-doux)" }}
      >
        Une vente saisie une fois se retrouve dans le stock, dans la caisse et dans le bilan. Vous
        ne l&apos;écrivez qu&apos;au premier endroit.
      </p>

      <div className="mt-12">
        {LIGNES.map(({ avant, apres, visuel }, i) => (
          <div
            key={avant}
            className="reglure grid items-center gap-7 py-10 sm:grid-cols-2 sm:gap-12"
          >
            <div className={i % 2 === 1 ? "sm:order-2" : undefined}>
              <p className="text-[0.9rem]" style={{ color: "var(--carbone-doux)" }}>
                {avant}
              </p>
              <p className="mt-2 text-[1.0625rem] font-medium leading-snug">{apres}</p>
            </div>
            <div
              className={`flex ${i % 2 === 1 ? "sm:order-1 sm:justify-end" : "sm:justify-start"}`}
            >
              {visuel}
            </div>
          </div>
        ))}
        <div className="reglure" />
      </div>
    </div>
  </section>
);

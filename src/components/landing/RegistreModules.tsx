import React from "react";
import { APP_NAME } from "../../lib/appConfig";

/**
 * Ce que le logiciel prend en charge, ligne à ligne.
 *
 * Six cartes identiques auraient dit « voici des fonctionnalités ». Deux
 * colonnes réglées disent autre chose : à gauche ce que le commerçant
 * note aujourd'hui à la main, à droite ce que le logiciel en fait. La
 * structure porte la comparaison, elle ne décore pas — c'est réellement
 * un tableau de correspondances, alors il en a la forme.
 *
 * Ne figurent ici que des écrans livrés : la promesse se vérifie dans la
 * minute qui suit l'inscription.
 */
const CORRESPONDANCES = [
  ["Les entrées et sorties de marchandise", "Stock à jour, alerte avant la rupture"],
  ["Les ventes de la journée sur un carnet", "Encaissements, ventes à crédit, reste à payer"],
  ["Les noms de ceux qui doivent encore", "Solde par client, sans avoir à chercher"],
  ["Les bons de commande sur un coin de table", "Commandes et livraisons suivies"],
  ["Le ticket écrit à la main", "Ticket 58 ou 80 mm, facture A4, PDF ou image"],
  ["Les comptes du mois, au crayon", "Chiffre d'affaires, marges et bilan, calculés"],
] as const;

export const RegistreModules: React.FC = () => (
  <section id="registre" className="scroll-mt-16 px-5 py-20 sm:py-24">
    <div className="mx-auto max-w-4xl">
      <h2 className="titrage text-[clamp(1.6rem,4.6vw,2.3rem)]">
        Ce que {APP_NAME} tient à votre place
      </h2>

      <div className="mt-10">
        <div
          className="hidden grid-cols-2 gap-8 pb-2 text-sm sm:grid"
          style={{ color: "var(--carbone-doux)" }}
        >
          <span>Ce que vous notez aujourd&apos;hui</span>
          <span>Ce que le logiciel en fait</span>
        </div>

        {CORRESPONDANCES.map(([avant, apres]) => (
          <div key={avant} className="reglure grid gap-1.5 py-5 sm:grid-cols-2 sm:gap-8">
            <p className="text-[0.95rem]" style={{ color: "var(--carbone-doux)" }}>
              {avant}
            </p>
            <p className="text-[0.95rem] font-medium" style={{ color: "var(--carbone)" }}>
              {apres}
            </p>
          </div>
        ))}
        <div className="reglure" />
      </div>

      <p
        className="mt-8 max-w-[54ch] text-sm leading-relaxed"
        style={{ color: "var(--carbone-doux)" }}
      >
        Chaque ligne du tableau partage les mêmes données que les autres : une vente saisie une fois
        se retrouve dans le stock, dans la caisse et dans le bilan, sans double saisie.
      </p>
    </div>
  </section>
);

import React from "react";
import { BarChart3, Boxes, FileText, ShoppingCart, Users, Wallet, Zap } from "lucide-react";
import { APP_NAME } from "../../lib/appConfig";
import { Revele } from "./Revele";
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
 * Six rangées de hauteur comparable, dont le côté de l'illustration
 * alterne. À gauche ce que le commerçant note aujourd'hui à la main, à
 * droite ce que le logiciel en fait — et, en face, l'objet lui-même.
 *
 * Un fil vertical relie les rangées, avec un point vert qui le descend
 * lentement. C'est l'idée de la section, rendue visible : une vente
 * saisie une fois descend jusqu'au stock, à la caisse, au client, à la
 * commande, au ticket et au bilan. Le fil reste très pâle ; s'il se
 * voyait, il volerait la vedette au contenu.
 *
 * Aucune donnée n'a changé : les six correspondances et leurs vignettes
 * sont celles d'avant, seulement mieux assises.
 */
const LIGNES = [
  {
    icone: Boxes,
    avant: "Les entrées et sorties de marchandise",
    apres: "Stock à jour, et l'alerte avant la rupture plutôt qu'après",
    visuel: <EtiquetteStock />,
  },
  {
    icone: ShoppingCart,
    avant: "Les ventes de la journée sur un carnet",
    apres: "Encaissements, ventes à crédit et reste à payer, additionnés seuls",
    visuel: <PageCarnet />,
  },
  {
    icone: Users,
    avant: "Les noms de ceux qui doivent encore",
    apres: "Le solde de chaque client, sans avoir à le chercher",
    visuel: <FicheClient />,
  },
  {
    icone: Wallet,
    avant: "Les bons de commande sur un coin de table",
    apres: "Où en est chaque commande, jusqu'à la livraison",
    visuel: <RubanCommande />,
  },
  {
    icone: FileText,
    avant: "Le ticket écrit à la main",
    apres: "Ticket 58 ou 80 mm, facture A4, imprimé ou envoyé en image",
    visuel: <PetitTicket />,
  },
  {
    icone: BarChart3,
    avant: "Les comptes du mois, au crayon",
    apres: "Chiffre d'affaires, marges et bilan, calculés à mesure",
    visuel: <BarresBilan />,
  },
] as const;

export const RegistreModules: React.FC = () => (
  <section
    id="registre"
    className="reglure relative scroll-mt-16 overflow-hidden px-5 py-20 sm:py-28"
  >
    <style>{`
      @keyframes rm-descendre {
        0%   { top: -12%; opacity: 0; }
        12%  { opacity: 1; }
        88%  { opacity: 1; }
        100% { top: 104%; opacity: 0; }
      }
      .rm-fil-point { animation: rm-descendre 14s linear infinite; }
      .rm-fil-point-2 { animation: rm-descendre 14s linear 7s infinite; }
      .rm-vignette { transition: transform .5s ease; }
      .rm-rangee:hover .rm-vignette { transform: translateY(-4px); }
      @media (prefers-reduced-motion: reduce) {
        .rm-fil-point, .rm-fil-point-2 { animation: none; display: none; }
        .rm-rangee:hover .rm-vignette { transform: none; }
      }
    `}</style>

    <div className="relative mx-auto max-w-5xl">
      <Revele>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold"
          style={{
            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            color: "var(--primary)",
          }}
        >
          <Zap className="h-3.5 w-3.5" />
          Tout est clair et organisé
        </span>

        <h2
          className="mt-6 max-w-[18ch] text-[clamp(1.8rem,5vw,2.9rem)] font-bold leading-[1.1] tracking-tight"
          style={{ color: "var(--carbone)" }}
        >
          Ce que {APP_NAME} tient à votre place
        </h2>

        <p
          className="mt-5 max-w-[54ch] text-[1.0625rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          Une vente saisie une fois se retrouve dans le stock, dans la caisse et dans le bilan. Vous
          ne l&apos;écrivez qu&apos;au premier endroit.
        </p>
      </Revele>

      {/* Le fil qui descend d'une rangée à l'autre, et les points qui
          le parcourent. Masqué sous `lg` : sur une colonne unique, il
          couperait le contenu au lieu de le relier. */}
      <div className="relative mt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 lg:block"
          style={{ background: "var(--reglure)" }}
        >
          <span
            className="rm-fil-point absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
            style={{ background: "var(--primary)" }}
          />
          <span
            className="rm-fil-point-2 absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
            style={{ background: "var(--primary)", opacity: 0.6 }}
          />
        </div>

        {LIGNES.map(({ icone: Icone, avant, apres, visuel }, i) => {
          const visuelAGauche = i % 2 === 1;
          return (
            <Revele key={avant} delai={(i % 2) * 60}>
              <div className="rm-rangee grid items-center gap-8 py-9 lg:grid-cols-2 lg:gap-16">
                <div className={visuelAGauche ? "lg:order-2" : undefined}>
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <Icone className="h-5 w-5" />
                  </span>
                  <p
                    className="mt-4 text-[1.0625rem] font-semibold leading-snug"
                    style={{ color: "var(--carbone)" }}
                  >
                    {avant}
                  </p>
                  <p
                    className="mt-1.5 text-[0.9375rem] leading-relaxed"
                    style={{ color: "var(--carbone-doux)" }}
                  >
                    {apres}
                  </p>
                </div>

                <div
                  className={`rm-vignette flex ${
                    visuelAGauche ? "lg:order-1 lg:justify-end" : "lg:justify-start"
                  }`}
                >
                  {visuel}
                </div>
              </div>
            </Revele>
          );
        })}
      </div>
    </div>
  </section>
);

import React from "react";
import { BarChart3, Boxes, FileText, ShieldCheck, ShoppingCart, Users, Wallet } from "lucide-react";
import { Revele } from "./Revele";
import { CarteRelief } from "./CarteRelief";

/**
 * Ce que le logiciel fait, module par module.
 *
 * Ne figurent ici que des écrans réellement livrés. Une promesse
 * affichée sur la page d'accueil se vérifie dans la minute qui suit
 * l'inscription ; en annoncer une de plus serait la perdre aussitôt.
 */
const MODULES = [
  {
    icone: Boxes,
    titre: "Stock & produits",
    texte: "Entrées, sorties et alertes de rupture. Chaque mouvement laisse une trace datée.",
  },
  {
    icone: ShoppingCart,
    titre: "Ventes & commandes",
    texte: "Encaissements, ventes à crédit, commandes clients et suivi des livraisons.",
  },
  {
    icone: Users,
    titre: "Clients & vendeurs",
    texte: "Fiches clients, soldes dus, activité de chaque vendeur et permissions au module près.",
  },
  {
    icone: FileText,
    titre: "Factures & tickets",
    texte: "Facture A4, ticket 58 ou 80 mm, export PDF ou image — au format exact du papier.",
  },
  {
    icone: Wallet,
    titre: "Trésorerie & capital",
    texte: "Caisse, dépenses, retraits, apports en capital et solde net en temps réel.",
  },
  {
    icone: BarChart3,
    titre: "Rapports & bilan",
    texte: "Chiffre d'affaires, marges, bilan mensuel et annuel, mois par mois.",
  },
] as const;

export const SectionModules: React.FC = () => (
  <section id="modules" className="scroll-mt-8 bg-background px-5 py-20 sm:py-24">
    <div className="mx-auto max-w-5xl">
      <Revele className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Une seule plateforme
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Tout ce qu&apos;une entreprise doit tenir
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
          Six modules qui partagent les mêmes données. Une vente met le stock à jour, la caisse
          suit, le bilan aussi — sans double saisie.
        </p>
      </Revele>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(({ icone: Icone, titre, texte }, i) => (
          <Revele key={titre} delai={i * 70}>
            <CarteRelief className="h-full">
              <article className="group h-full rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                  <Icone className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{texte}</p>
              </article>
            </CarteRelief>
          </Revele>
        ))}
      </div>

      <Revele delai={140}>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-card px-5 py-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Données isolées par boutique
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Verrouillage par code PIN
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Fonctionne installée sur le téléphone
          </span>
        </div>
      </Revele>
    </div>
  </section>
);

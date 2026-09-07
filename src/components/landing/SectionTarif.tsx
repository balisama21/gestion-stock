import React from "react";
import { Check } from "lucide-react";
import { Revele } from "./Revele";

/**
 * Ce que ça coûte.
 *
 * Un seul prix, écrit en toutes lettres, sans grille à trois colonnes où
 * il faut comparer des lignes pour comprendre laquelle on peut se
 * permettre. Le logiciel n'a qu'une offre : c'est le mérite de la dire
 * simplement.
 *
 * Les chiffres ne sont pas décoratifs — ils sont ceux que l'application
 * annonce déjà dans ses réglages : sept jours d'essai sans paiement,
 * puis cent mille ariary par boutique, une fois, à vie.
 *
 * Le numéro de paiement ne figure pas ici, volontairement. Il s'obtient
 * dans l'application, une fois la boutique créée : publier un numéro sur
 * une page d'accueil inviterait à payer avant d'avoir quoi que ce soit à
 * activer.
 */
const INCLUS = [
  "Stock, ventes, achats et trésorerie",
  "Clients, fournisseurs, prestataires",
  "Devis, reçus et factures à imprimer",
  "Plusieurs comptes pour votre équipe",
  "Sur téléphone, tablette et ordinateur",
  "Mises à jour comprises",
];

export const SectionTarif: React.FC<{ onCommencer: () => void }> = ({ onCommencer }) => (
  <section id="tarif" className="px-4 py-16 sm:py-24">
    <div className="mx-auto max-w-3xl">
      <Revele>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Le prix
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Un seul paiement, et c&apos;est à vous.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
          Pas d&apos;abonnement, pas de prélèvement mensuel. Vous essayez une semaine, puis vous
          payez une fois pour votre boutique.
        </p>
      </Revele>

      <Revele delai={120}>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* L'essai. */}
          <div className="app-card flex flex-col p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pour essayer
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
              Gratuit
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              7 jours, sans paiement à l&apos;inscription.
            </p>
            <p className="mt-4 flex-1 text-sm text-muted-foreground">
              Tout est ouvert pendant l&apos;essai — ce n&apos;est pas une version réduite. Ce que
              vous saisissez reste là ensuite.
            </p>
            <button onClick={onCommencer} className="app-btn-secondary mt-6 w-full">
              Créer ma boutique
            </button>
          </div>

          {/* L'activation. */}
          <div className="app-card flex flex-col border-success-border p-6">
            <p className="text-xs font-semibold uppercase tracking-wider t-success">
              Pour continuer
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
              100 000 Ar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Par boutique, une seule fois, à vie.
            </p>
            <ul className="mt-4 flex-1 space-y-2">
              {INCLUS.map((ligne) => (
                <li key={ligne} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 t-success" aria-hidden="true" />
                  <span>{ligne}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Le paiement se fait par MVola depuis l&apos;application, après la création de votre
              boutique.
            </p>
          </div>
        </div>
      </Revele>
    </div>
  </section>
);

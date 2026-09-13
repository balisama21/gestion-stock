import React from "react";
import { Check } from "lucide-react";
import { Revele } from "./Revele";
import {
  ESSAI_JOURS,
  INCLUS_DANS_TOUTES_LES_OFFRES,
  prixAVie,
  prixMensuel,
} from "../../lib/offres";

/**
 * Ce que ça coûte.
 *
 * ── Trois offres, et pourquoi ce n'est plus une seule ──
 *
 * La page n'annonçait qu'un prix, et le revendiquait : « pas
 * d'abonnement, pas de prélèvement mensuel ». L'argument était bon tant
 * qu'il n'y avait qu'une formule ; il devient un mensonge dès qu'on en
 * propose une au mois. Le texte a donc été réécrit, pas seulement
 * complété — ajouter une carte sous un titre qui la contredit aurait
 * laissé le lecteur se demander laquelle des deux phrases est vraie.
 *
 * ── Ce qui distingue les cartes, et ce qui ne les distingue pas ──
 *
 * Les deux formules payantes ouvrent EXACTEMENT le même logiciel. Seule
 * la façon de payer change. La liste de ce qui est compris est donc
 * écrite une seule fois, sous les trois cartes, plutôt que recopiée deux
 * fois : la répéter laisserait croire qu'il faut la comparer ligne à
 * ligne pour trouver ce qu'on perd en prenant le mensuel.
 *
 * ── Les chiffres ──
 *
 * Aucun n'est écrit ici : ils viennent de `lib/offres.ts`, d'où les
 * écrans de l'application les lisent aussi. C'est ce qui garantit que la
 * page d'accueil et les réglages ne pourront plus annoncer deux tarifs
 * différents.
 *
 * Le numéro de paiement ne figure pas ici, volontairement. Il s'obtient
 * dans l'application, une fois la boutique créée : publier un numéro sur
 * une page d'accueil inviterait à payer avant d'avoir quoi que ce soit à
 * activer.
 */
export const SectionTarif: React.FC<{ onCommencer: () => void }> = ({ onCommencer }) => (
  <section id="tarif" className="px-4 py-16 sm:py-24">
    <div className="mx-auto max-w-5xl">
      <Revele>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Le prix
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Essayez un mois. Payez ensuite comme vous voulez.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
          {ESSAI_JOURS} jours pour vous faire une idée, sans rien payer. Ensuite, au mois si vous
          préférez avancer doucement, ou une seule fois pour ne plus y penser.
        </p>
      </Revele>

      <Revele delai={120}>
        {/* Trois cartes empilées jusqu'à 768 pixels, puis côte à côte.
            Pas de palier à deux colonnes : il laisserait une carte seule
            sur sa ligne, ce qui la ferait passer pour l'intruse. */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {/* L'essai. */}
          <div className="app-card flex flex-col p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pour essayer
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
              Gratuit
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ESSAI_JOURS} jours, sans paiement à l&apos;inscription.
            </p>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              Tout est ouvert pendant l&apos;essai — ce n&apos;est pas une version réduite. Ce que
              vous saisissez reste là ensuite.
            </p>
            <button onClick={onCommencer} className="app-btn-secondary mt-6 w-full">
              Créer ma boutique
            </button>
          </div>

          {/* Le mois. */}
          <div className="app-card flex flex-col p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Au mois
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
              {prixMensuel()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Par mois et par boutique.</p>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              Vous renouvelez quand vous voulez, et vous arrêtez quand vous voulez. Rien n&apos;est
              prélevé automatiquement : c&apos;est vous qui payez le mois suivant.
            </p>
            <button onClick={onCommencer} className="app-btn-secondary mt-6 w-full">
              Commencer
            </button>
          </div>

          {/* L'activation définitive. */}
          <div className="app-card flex flex-col border-success-border p-6">
            <p className="text-xs font-medium uppercase tracking-wider t-success">
              Une fois pour toutes
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
              {prixAVie()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Par boutique, une seule fois, à vie.
            </p>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              Vous payez une fois et la boutique reste ouverte, sans échéance ni renouvellement.
              Au-delà d&apos;un an et demi d&apos;usage, c&apos;est la formule la moins chère.
            </p>
            <button onClick={onCommencer} className="app-btn-secondary mt-6 w-full">
              Commencer
            </button>
          </div>
        </div>
      </Revele>

      {/* Écrit une seule fois : les deux formules payantes ouvrent le
          même logiciel, et le dire ainsi évite la question « qu'est-ce
          que je perds en prenant le mensuel ». */}
      <Revele delai={200}>
        <div className="app-card mt-4 p-6">
          <p className="text-sm font-medium text-foreground">
            Compris dans les deux formules payantes, sans différence :
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {INCLUS_DANS_TOUTES_LES_OFFRES.map((ligne) => (
              <li key={ligne} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 t-success" aria-hidden="true" />
                <span>{ligne}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Le paiement se fait par MVola depuis l&apos;application, après la création de votre
            boutique.
          </p>
        </div>
      </Revele>
    </div>
  </section>
);

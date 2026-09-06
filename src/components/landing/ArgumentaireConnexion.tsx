import React from "react";
import { Check, Clock, ShieldCheck, Smartphone } from "lucide-react";
import { Revele } from "./Revele";
import { CarteRelief } from "./CarteRelief";
import { APP_NAME } from "../../lib/appConfig";

const PROMESSES = [
  {
    icone: Clock,
    titre: "Prêt en cinq minutes",
    texte: "Créez votre boutique, entrez vos produits, encaissez votre première vente.",
  },
  {
    icone: Smartphone,
    titre: "Sur le téléphone, sans boutique d'applications",
    texte: "Installez depuis le navigateur ; l'application s'ouvre depuis l'écran d'accueil.",
  },
  {
    icone: ShieldCheck,
    titre: "Chacun voit ce qu'il doit voir",
    texte: "Vos vendeurs accèdent à leur travail, pas à votre trésorerie.",
  },
] as const;

/**
 * Colonne d'arguments à côté du formulaire.
 *
 * Un formulaire seul ne dit rien à qui hésite encore : il demande sans
 * rien offrir. Ces trois promesses répondent aux questions qu'on se pose
 * la main sur le clavier — combien de temps, sur quel appareil, et
 * qu'est-ce que mes vendeurs verront.
 *
 * Sur téléphone, elle passe SOUS le formulaire : celui qui revient
 * chaque matin ne doit pas relire l'argumentaire avant de se connecter.
 */
export const ArgumentaireConnexion: React.FC = () => (
  <div className="order-2 lg:order-1">
    <Revele>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        Commencer maintenant
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Votre boutique, tenue au jour le jour
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {APP_NAME} rassemble ce que vous suivez aujourd&apos;hui sur des cahiers et des feuilles de
        calcul, et le garde à jour tout seul.
      </p>
    </Revele>

    <ul className="mt-7 space-y-4">
      {PROMESSES.map(({ icone: Icone, titre, texte }, i) => (
        <Revele key={titre} delai={i * 90}>
          <li className="flex gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary">
              <Icone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{titre}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{texte}</p>
            </div>
          </li>
        </Revele>
      ))}
    </ul>

    <Revele delai={300}>
      <CarteRelief className="mt-8 hidden lg:block" amplitude={5}>
        {/* Un aperçu de ce qu'on obtient, plutôt qu'une capture d'écran :
            il reste net à toutes les tailles et se met à jour avec le
            thème, ce qu'une image ne fait pas. */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Aujourd&apos;hui
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            412 000 <span className="text-lg font-semibold text-muted-foreground">Ar</span>
          </p>
          <div className="mt-4 space-y-2">
            {[
              ["Ventes encaissées", "310 000 Ar"],
              ["Reste à encaisser", "102 000 Ar"],
              ["Dépenses du jour", "− 24 000 Ar"],
            ].map(([libelle, valeur]) => (
              <div key={libelle} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{libelle}</span>
                <span className="font-semibold text-foreground">{valeur}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary" />
            Stock, caisse et bilan mis à jour ensemble
          </p>
        </div>
      </CarteRelief>
    </Revele>
  </div>
);

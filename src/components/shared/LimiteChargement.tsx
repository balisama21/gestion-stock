import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { reprendreApresDeploiement } from "../../lib/chunkRecovery";

interface Props {
  children: React.ReactNode;
}

interface State {
  erreur: Error | null;
}

/**
 * Ce qui se passe quand un écran n'arrive pas.
 *
 * Les écrans sont chargés à la demande : ouvrir l'onglet Produits va
 * chercher le morceau qui le contient. Deux choses peuvent alors mal
 * tourner.
 *
 * La première est un onglet resté ouvert pendant une mise en ligne : le
 * fichier réclamé n'existe plus sous ce nom. Ce n'est pas une panne,
 * c'est une version périmée, et `reprendreApresDeploiement` recharge la
 * page une fois — l'utilisateur ne voit rien d'autre qu'un
 * rafraîchissement.
 *
 * La seconde est une vraie coupure réseau. Là, recharger ne servirait à
 * rien : on le dit, et on propose de réessayer sans quitter la page.
 * C'est le cas courant en connexion mobile.
 */
export class LimiteChargement extends React.Component<Props, State> {
  override state: State = { erreur: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur };
  }

  override componentDidCatch(erreur: Error) {
    // Rend la main tout de suite si la page se recharge : inutile de
    // peindre un message que personne n'aura le temps de lire.
    reprendreApresDeploiement(erreur);
  }

  override render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <div className="app-card flex flex-col items-center gap-3 px-4 py-12 text-center">
        <AlertCircle className="h-7 w-7 t-danger" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Cet écran n&apos;a pas pu être chargé.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre connexion s&apos;est peut-être interrompue. Vos données sont intactes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => this.setState({ erreur: null })}
          className="app-btn-primary"
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
      </div>
    );
  }
}

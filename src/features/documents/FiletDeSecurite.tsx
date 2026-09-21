import React from "react";

/**
 * LE FILET SOUS LES NOUVEAUX DOCUMENTS
 *
 * Si quoi que ce soit se casse dans la v2 — une donnée inattendue, un
 * modèle mal réglé —, l'écran ne doit pas devenir blanc devant
 * quelqu'un qui voulait imprimer une facture. Cette barrière attrape
 * l'erreur et rend **l'ancien document**, celui qui marche depuis des
 * mois.
 *
 * C'est le complément de l'interrupteur de Paramètres → Documents :
 * l'interrupteur se coupe à la main, ce filet se déclenche tout seul,
 * et sans qu'on ait rien à faire la boutique continue de facturer.
 *
 * Une classe, et non un composant à crochets : React n'offre pas
 * d'autre moyen d'attraper l'erreur d'un enfant.
 */

interface Props {
  /**
   * Prévenu une fois, quand la v2 tombe.
   *
   * C'est ainsi que l'écran revient à l'ancien document : il retient
   * la chute et cesse de demander la v2, plutôt que d'avoir à
   * dupliquer ici la modale d'avant.
   */
  onErreur?: () => void;
  /** Ce qu'on affiche à la place quand la v2 tombe. */
  secours: React.ReactNode;
  children: React.ReactNode;
}

interface Etat {
  tombe: boolean;
}

export class FiletDeSecurite extends React.Component<Props, Etat> {
  override state: Etat = { tombe: false };

  static getDerivedStateFromError(): Etat {
    return { tombe: true };
  }

  override componentDidCatch(erreur: Error) {
    this.props.onErreur?.();
    /*
     * Consigné dans la console, jamais montré à l'utilisateur : une
     * pile d'appels n'aide personne au comptoir, et l'ancien document
     * s'affiche déjà. La trace reste pour qui ouvrira les outils de
     * développement.
     */
    console.error("[documents v2] repli sur l'ancien document :", erreur);
  }

  override render() {
    return this.state.tombe ? this.props.secours : this.props.children;
  }
}

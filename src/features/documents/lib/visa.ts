import { createContext, useContext } from "react";

/**
 * LE CACHET ET LA SIGNATURE APPOSÉS SUR LA FEUILLE
 *
 * En mode simple, la boutique n'a rien à placer : son tampon et sa
 * signature se posent d'eux-mêmes au-dessus de la ligne « Cachet et
 * signature de l'entreprise », la signature à cheval sur le tampon,
 * comme sur un papier signé à la main.
 *
 * Les images arrivent déjà chargées (en `data:`) : la photographie du
 * PDF ne doit rien attendre.
 */
export interface ImageVisa {
  src: string;
  opacite: number;
  /** Proportions de l'image, pour réserver la bonne place. */
  ratio: number;
}

export interface Visa {
  cachet?: ImageVisa;
  signature?: ImageVisa;
}

export const ContexteVisa = createContext<Visa | null>(null);

export const useVisaDuDocument = () => useContext(ContexteVisa);

/** Une facture reçue d'un fournisseur porte SON cachet, jamais le nôtre ; un ticket n'en a pas. */
export const typeAvecVisa = (type: string) => type !== "facture_achat" && type !== "ticket";

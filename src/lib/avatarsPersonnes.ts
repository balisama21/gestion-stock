import { createContext } from "react";
import type { Traits } from "./avatarPersonne";

/**
 * Les avatars réglés à la main dans la boutique : un visage choisi, ou
 * une photo. Tout le reste se dessine à partir du nom.
 *
 * Partagé par un contexte : un avatar s'affiche dans vingt écrans, et
 * lui faire passer la table par chaque composant intermédiaire
 * n'apporterait rien.
 */

export interface AvatarRegle {
  traits: unknown;
  photoChemin: string | null;
  /** Lien signé, de courte durée : le seau des photos est privé. */
  photoUrl: string | null;
}

export interface AvatarsPersonnes {
  /** Par nom ramené à sa forme stable (`cleDeNom`). */
  regles: Map<string, AvatarRegle>;
  /** Faux tant que la table n'existe pas en base, ou sans boutique. */
  modifiable: boolean;
  enregistrerVisage?: (nom: string, traits: Traits) => Promise<{ error: string | null }>;
  enregistrerPhoto?: (nom: string, fichier: File) => Promise<{ error: string | null }>;
  retirerPhoto?: (nom: string) => Promise<{ error: string | null }>;
  revenirAuVisageDuNom?: (nom: string) => Promise<{ error: string | null }>;
}

export const AvatarsPersonnesContext = createContext<AvatarsPersonnes>({
  regles: new Map(),
  modifiable: false,
});

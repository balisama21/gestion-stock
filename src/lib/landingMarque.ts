/**
 * Page d'accueil d'une marque cliente, lue depuis `branding.landing`.
 *
 * Le JSON vient de la base : chaque champ est vérifié, tronqué, et tout
 * ce qui n'a pas la forme attendue est ignoré plutôt que d'échouer.
 */

export interface ElementLanding {
  titre: string;
  texte: string;
}

export interface BlocLanding {
  titre: string;
  elements: ElementLanding[];
}

export interface ContactLanding {
  telephone: string | null;
  whatsapp: string | null;
  email: string | null;
  adresse: string | null;
}

export interface LandingMarque {
  titre: string;
  sousTitre: string;
  /** Lignes de l'étiquette du héros. */
  pour: string;
  contenu: string;
  offres: BlocLanding | null;
  arguments: BlocLanding | null;
  etapes: BlocLanding | null;
  contact: ContactLanding | null;
}

type Objet = Record<string, unknown>;

const estObjet = (v: unknown): v is Objet =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const texte = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const ouNull = (v: unknown, max: number): string | null => texte(v, max) || null;

function bloc(v: unknown): BlocLanding | null {
  if (!estObjet(v) || !Array.isArray(v.elements)) return null;
  const elements = v.elements
    .filter(estObjet)
    .map((e) => ({ titre: texte(e.titre, 80), texte: texte(e.texte, 300) }))
    .filter((e) => e.titre)
    .slice(0, 8);
  return elements.length ? { titre: texte(v.titre, 80), elements } : null;
}

function contact(v: unknown): ContactLanding | null {
  if (!estObjet(v)) return null;
  const c: ContactLanding = {
    telephone: ouNull(v.telephone, 30),
    whatsapp: ouNull(v.whatsapp, 30),
    email: ouNull(v.email, 120),
    adresse: ouNull(v.adresse, 200),
  };
  return c.telephone || c.whatsapp || c.email || c.adresse ? c : null;
}

export function landingDepuisJson(v: unknown): LandingMarque | null {
  if (!estObjet(v)) return null;
  const titre = texte(v.titre, 120);
  if (!titre) return null;
  return {
    titre,
    sousTitre: texte(v.sousTitre, 300),
    pour: texte(v.pour, 80),
    contenu: texte(v.contenu, 80),
    offres: bloc(v.offres),
    arguments: bloc(v.arguments),
    etapes: bloc(v.etapes),
    contact: contact(v.contact),
  };
}

/** Lien WhatsApp : chiffres seuls, indicatif compris. */
export const lienWhatsapp = (numero: string): string | null => {
  const chiffres = numero.replace(/\D/g, "");
  return chiffres.length >= 8 ? `https://wa.me/${chiffres}` : null;
};

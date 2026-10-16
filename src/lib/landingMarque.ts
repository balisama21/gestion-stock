/**
 * Page d'accueil d'une marque cliente, lue depuis `branding.landing`.
 *
 * Le JSON vient de la base : chaque champ est vérifié, tronqué, et tout
 * ce qui n'a pas la forme attendue est ignoré plutôt que d'échouer.
 */

export interface ElementLanding {
  titre: string;
  texte: string;
  /** Photo de l'élément : identifiant Unsplash ou adresse https / locale. */
  image?: string;
  /** Les formats proposés, en une ligne (« 50 à 150 ml »). */
  formats?: string;
}

export interface BlocLanding {
  titre: string;
  elements: ElementLanding[];
}

export interface ContactLanding {
  telephones: string[];
  whatsapp: string | null;
  emails: string[];
  adresse: string | null;
}

export interface LandingMarque {
  titre: string;
  sousTitre: string;
  /** Lignes de l'étiquette du héros. */
  pour: string;
  contenu: string;
  /** Photo d'ouverture : identifiant Unsplash ou adresse https / locale. */
  photo: string | null;
  offres: BlocLanding | null;
  /** Les familles de produits, chacune avec sa photo et ses formats. */
  catalogue: BlocLanding | null;
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

/** Un identifiant de photo Unsplash, sans le préfixe `photo-`. */
const ID_UNSPLASH = /^\d{10,13}-[0-9a-f]{10,14}$/;
const URL_SURE = /^(https:\/\/|\/)[^"'\\\s()<>]+$/;

/** Une photo acceptée telle quelle, ou rien. */
function image(v: unknown): string | null {
  const t = texte(v, 300);
  return ID_UNSPLASH.test(t) || URL_SURE.test(t) ? t : null;
}

/** L'adresse d'une photo à une largeur donnée. */
export const urlImage = (img: string, largeur: number): string =>
  ID_UNSPLASH.test(img)
    ? `https://images.unsplash.com/photo-${img}?auto=format&fit=crop&w=${largeur}&q=70`
    : img;

function bloc(v: unknown, max = 8): BlocLanding | null {
  if (!estObjet(v) || !Array.isArray(v.elements)) return null;
  const elements = v.elements
    .filter(estObjet)
    .map((e): ElementLanding => {
      const el: ElementLanding = { titre: texte(e.titre, 80), texte: texte(e.texte, 300) };
      const img = image(e.image);
      if (img) el.image = img;
      const formats = texte(e.formats, 120);
      if (formats) el.formats = formats;
      return el;
    })
    .filter((e) => e.titre)
    .slice(0, max);
  return elements.length ? { titre: texte(v.titre, 80), elements } : null;
}

/** Une valeur ou une liste de valeurs, dédoublonnée. */
function liste(seul: unknown, plusieurs: unknown, max: number): string[] {
  const brut = Array.isArray(plusieurs) ? plusieurs : [seul];
  return [...new Set(brut.map((x) => texte(x, max)).filter(Boolean))].slice(0, 4);
}

function contact(v: unknown): ContactLanding | null {
  if (!estObjet(v)) return null;
  const c: ContactLanding = {
    telephones: liste(v.telephone, v.telephones, 30),
    whatsapp: ouNull(v.whatsapp, 30),
    emails: liste(v.email, v.emails, 120),
    adresse: ouNull(v.adresse, 200),
  };
  return c.telephones.length || c.whatsapp || c.emails.length || c.adresse ? c : null;
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
    photo: image(v.photo),
    offres: bloc(v.offres),
    catalogue: bloc(v.catalogue, 12),
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

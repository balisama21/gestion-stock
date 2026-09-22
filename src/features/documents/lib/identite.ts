/**
 * NIVEAU 1 — L'IDENTITÉ COMMUNE DE LA BOUTIQUE
 *
 * Saisie une seule fois, reprise par TOUS les documents. Aucun
 * document n'en garde de copie : il lit l'identité au moment où on
 * l'imprime, et c'est la même pour la facture, le devis et le reçu.
 *
 * ── CE QUI N'EST PAS ICI, ET POURQUOI ──────────────────────────────
 *
 * Le nom, le sous-titre, l'adresse, le téléphone, l'e-mail, le
 * NIF/STAT, le taux de TVA et le logo vivent déjà dans les colonnes
 * de `stores`, réglés depuis « Ma boutique ». Les recopier ici en
 * ferait deux vérités qui divergeraient au premier changement. Ce
 * fichier ne porte QUE ce qui n'existait nulle part :
 *
 *   • une liste de contacts répétable — une boutique a un gérant à
 *     Tana et un correspondant aux Comores, pas un téléphone ;
 *   • le site web et les réseaux sociaux ;
 *   • les coordonnées de paiement, pour que le client sache où payer ;
 *   • les identifiants légaux autres que le NIF et le STAT.
 *
 * ── TOUT EST VIDE PAR DÉFAUT, ET C'EST LE POINT ────────────────────
 *
 * Une boutique qui n'a rien saisi ne voit rien apparaître sur ses
 * documents : le rendu d'aujourd'hui est conservé au pixel près. Un
 * champ rempli est un champ que la boutique a voulu voir.
 */

/** Une personne à joindre : « Mariama — Comores — +269 … ». */
export interface ContactBoutique {
  /** Sert de clé de liste ; jamais imprimé. */
  id: string;
  nom: string;
  /** Rôle ou mention libre : « Gérante », « Commandes ». */
  mention: string;
  telephone: string;
  /** « Comores », « Tana », « Atelier ». */
  lieu: string;
  /** Décoché, le contact reste enregistré mais ne s'imprime pas. */
  surDocuments: boolean;
}

/** Un compte de paiement mobile : « MVola · 034 12 345 67 ». */
export interface CompteMobileMoney {
  id: string;
  operateur: string;
  numero: string;
}

/** « RCS », « Licence », « N° d'agrément »… */
export interface IdentifiantLegal {
  id: string;
  libelle: string;
  valeur: string;
}

export interface ReseauxSociaux {
  facebook: string;
  whatsapp: string;
  instagram: string;
}

export interface CoordonneesPaiement {
  mobileMoney: CompteMobileMoney[];
  banque: string;
  rib: string;
}

export interface IdentiteBoutique {
  siteWeb: string;
  contacts: ContactBoutique[];
  reseaux: ReseauxSociaux;
  paiement: CoordonneesPaiement;
  identifiants: IdentifiantLegal[];
}

export const IDENTITE_PAR_DEFAUT: IdentiteBoutique = {
  siteWeb: "",
  contacts: [],
  reseaux: { facebook: "", whatsapp: "", instagram: "" },
  paiement: { mobileMoney: [], banque: "", rib: "" },
  identifiants: [],
};

/* ─────────────────────────────────────────────────────────────
 * Lecture de la colonne JSON
 * ───────────────────────────────────────────────────────────── */

const mot = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const objet = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Une clé de liste stable, même sur un enregistrement d'avant. */
const cle = (v: unknown, prefixe: string, i: number): string => mot(v) || `${prefixe}${i}`;

/**
 * Ce que la colonne contient, ramené à une forme sûre.
 *
 * Les entrées entièrement vides sont écartées à la lecture : une
 * ligne de contact restée blanche dans l'éditeur ne doit pas se
 * traduire par une puce vide sur une facture.
 */
export function lireIdentite(brut: unknown): IdentiteBoutique {
  const r = objet(brut);
  const reseaux = objet(r.reseaux);
  const paiement = objet(r.paiement);

  const contacts: ContactBoutique[] = liste(r.contacts)
    .map((c, i) => {
      const o = objet(c);
      return {
        id: cle(o.id, "c", i),
        nom: mot(o.nom),
        mention: mot(o.mention),
        telephone: mot(o.telephone),
        lieu: mot(o.lieu),
        // Une clé absente veut dire « oui » : un contact qu'on saisit
        // est un contact qu'on veut voir.
        surDocuments: typeof o.surDocuments === "boolean" ? o.surDocuments : true,
      };
    })
    .filter((c) => c.nom || c.mention || c.telephone || c.lieu);

  const mobileMoney: CompteMobileMoney[] = liste(paiement.mobileMoney)
    .map((m, i) => {
      const o = objet(m);
      return { id: cle(o.id, "m", i), operateur: mot(o.operateur), numero: mot(o.numero) };
    })
    .filter((m) => m.operateur || m.numero);

  const identifiants: IdentifiantLegal[] = liste(r.identifiants)
    .map((x, i) => {
      const o = objet(x);
      return { id: cle(o.id, "i", i), libelle: mot(o.libelle), valeur: mot(o.valeur) };
    })
    .filter((x) => x.libelle || x.valeur);

  return {
    siteWeb: mot(r.siteWeb),
    contacts,
    reseaux: {
      facebook: mot(reseaux.facebook),
      whatsapp: mot(reseaux.whatsapp),
      instagram: mot(reseaux.instagram),
    },
    paiement: { mobileMoney, banque: mot(paiement.banque), rib: mot(paiement.rib) },
    identifiants,
  };
}

/** Rien n'a été saisi : les documents ne changent pas d'un pixel. */
export function identiteVide(identite: IdentiteBoutique): boolean {
  return (
    !identite.siteWeb &&
    identite.contacts.length === 0 &&
    identite.identifiants.length === 0 &&
    !identite.reseaux.facebook &&
    !identite.reseaux.whatsapp &&
    !identite.reseaux.instagram &&
    identite.paiement.mobileMoney.length === 0 &&
    !identite.paiement.banque &&
    !identite.paiement.rib
  );
}

/* ─────────────────────────────────────────────────────────────
 * De l'identité au papier
 * ───────────────────────────────────────────────────────────── */

const joindre = (...parts: string[]): string => parts.filter(Boolean).join(" · ");

/**
 * Les contacts retenus pour l'impression, une ligne chacun.
 *
 * L'ordre est celui de la liste : c'est la boutique qui décide qui
 * vient en premier, en déplaçant les lignes dans les réglages.
 */
export function lignesDesContacts(identite: IdentiteBoutique): string[] {
  return identite.contacts
    .filter((c) => c.surDocuments)
    .map((c) => joindre(c.nom, c.mention, c.telephone, c.lieu))
    .filter(Boolean);
}

/**
 * Le site et les réseaux, sur une seule ligne.
 *
 * Chaque réseau porte son nom : « Instagram maboutique » se comprend,
 * « maboutique » tout seul ne se comprend pas.
 */
export function ligneEnLigne(identite: IdentiteBoutique): string | null {
  const { facebook, whatsapp, instagram } = identite.reseaux;
  return (
    joindre(
      identite.siteWeb,
      facebook && `Facebook ${facebook}`,
      whatsapp && `WhatsApp ${whatsapp}`,
      instagram && `Instagram ${instagram}`,
    ) || null
  );
}

/** « RCS 2024-B-112 · Licence 4478 », ou rien. */
export function ligneDesIdentifiants(identite: IdentiteBoutique): string | null {
  const un = (x: IdentifiantLegal) => [x.libelle, x.valeur].filter(Boolean).join(" ");
  return joindre(...identite.identifiants.map(un)) || null;
}

/**
 * Où le client peut payer, une ligne par moyen.
 *
 * Un moyen incomplet s'imprime quand même s'il porte un numéro : une
 * boutique qui écrit le numéro sans l'opérateur sait ce qu'elle fait,
 * et son client aussi.
 */
export function lignesDePaiement(identite: IdentiteBoutique): string[] {
  const { mobileMoney, banque, rib } = identite.paiement;
  return [...mobileMoney.map((m) => joindre(m.operateur, m.numero)), joindre(banque, rib)].filter(
    Boolean,
  );
}

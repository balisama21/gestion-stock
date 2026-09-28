import type { Document } from "./buildDocument";

/**
 * LE NOM ET LES COORDONNÉES DE LA BOUTIQUE, ÉCRITS SUR LA FEUILLE
 *
 * Ce ne sont pas des mots de la mise en page : ce sont les données de la
 * fiche de l'entreprise. Écrits sur la feuille, ils restent en attente
 * jusqu'à « Enregistrer », qui les reporte dans la fiche — et donc dans
 * Paramètres et dans tous les documents qui suivront.
 */

export type ChampBoutique = "storeName" | "subtitle" | "address" | "phone" | "email" | "nifStat";
export type ModifsBoutique = Partial<Record<ChampBoutique, string>>;

/** La coordonnée affichée → le champ de la fiche qu'elle montre. */
export const CHAMP_DE_COORDONNEE: Record<string, ChampBoutique> = {
  "entete.adresse": "address",
  "entete.telephone": "phone",
  "entete.email": "email",
  "entete.nifStat": "nifStat",
};

export const NOMS_CHAMPS_BOUTIQUE: Record<ChampBoutique, string> = {
  storeName: "Nom de la boutique",
  subtitle: "Activité",
  address: "Adresse",
  phone: "Téléphone",
  email: "E-mail",
  nifStat: "NIF/STAT",
};

const COORDONNEE_DU_CHAMP = Object.fromEntries(
  Object.entries(CHAMP_DE_COORDONNEE).map(([k, v]) => [v, k]),
) as Partial<Record<ChampBoutique, string>>;

/** Le document tel qu'il sortira une fois la fiche mise à jour. Une valeur vidée disparaît. */
export function appliquerBoutique(d: Document, m: ModifsBoutique): Document {
  if (Object.keys(m).length === 0) return d;
  const e = d.emetteur;
  const vaut = (k: ChampBoutique, actuel: string) => (m[k] === undefined ? actuel : m[k]!.trim());
  const champs = e.champs
    ?.map((c) => {
      const k = CHAMP_DE_COORDONNEE[c.cle];
      return k && m[k] !== undefined ? { ...c, valeur: m[k]!.trim() } : c;
    })
    .filter((c) => c.valeur !== "");
  return {
    ...d,
    emetteur: {
      ...e,
      nom: e.nom ? vaut("storeName", e.nom) : e.nom,
      sousTitre: e.sousTitre ? vaut("subtitle", e.sousTitre) || null : e.sousTitre,
      nif: e.nif ? vaut("nifStat", e.nif) || null : e.nif,
      champs,
    },
  };
}

/** La valeur de la fiche derrière une coordonnée, telle qu'elle est aujourd'hui. */
export const coordonneeDuChamp = (k: ChampBoutique) => COORDONNEE_DU_CHAMP[k];

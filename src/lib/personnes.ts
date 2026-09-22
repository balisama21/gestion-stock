import type { Database } from "./database.types";
import { cleDeListe } from "./listes";

export type PersonneExterne = Database["public"]["Tables"]["personnes_externes"]["Row"];

/**
 * D'où vient la personne qu'on désigne.
 *
 * — `membre` : elle a un compte dans cette boutique.
 * — `externe` : elle a une fiche, mais aucun accès à l'application.
 * — `heritee` : un nom écrit dans une vente ou une dépense avant que
 *   les fiches n'existent, et qu'aucune fiche ne réclame. On le garde
 *   sélectionnable parce que le supprimer du choix reviendrait à
 *   renommer le passé de quelqu'un.
 */
export type NaturePersonne = "membre" | "externe" | "heritee";

export interface Personne {
  /** L'identifiant d'option du sélecteur. Jamais écrit en base. */
  cle: string;
  nom: string;
  nature: NaturePersonne;
  /** Le compte, quand c'en est un. */
  membreId: string | null;
  /** La fiche externe, quand c'en est une. */
  personneId: string | null;
  /** Un téléphone, un rôle : ce qui distingue deux homonymes. */
  mention: string | null;
}

export const GROUPES: Record<NaturePersonne, string> = {
  membre: "Équipe",
  externe: "Hors équipe",
  heritee: "Déjà saisis",
};

export const cleDePersonne = (p: {
  membreId?: string | null;
  personneId?: string | null;
  nom: string;
}): string =>
  p.membreId
    ? `membre:${p.membreId}`
    : p.personneId
      ? `externe:${p.personneId}`
      : `nom:${cleDeListe(p.nom)}`;

interface SourcesDePersonnes {
  /** Les comptes de la boutique, propriétaire compris. */
  membres: { id: string; nom: string; mention?: string | null }[];
  externes: PersonneExterne[];
  /** Les noms déjà écrits dans les ventes et les dépenses. */
  nomsHerites: string[];
}

/**
 * TOUTES LES PERSONNES QU'ON PEUT DÉSIGNER, EN UNE SEULE LISTE.
 *
 * L'ordre compte : l'équipe d'abord, parce que c'est elle qu'on
 * désigne quatre-vingt-dix-neuf fois sur cent. Les fiches externes
 * ensuite. Les noms hérités en dernier, et seulement ceux qu'aucune
 * fiche ne réclame déjà — sans ce filtre, « Lanto » apparaîtrait deux
 * fois, une fois comme fiche et une fois comme souvenir.
 */
export const listerLesPersonnes = ({
  membres,
  externes,
  nomsHerites,
}: SourcesDePersonnes): Personne[] => {
  const vus = new Set<string>();
  const liste: Personne[] = [];

  const ajouter = (p: Personne) => {
    const cle = cleDeListe(p.nom);
    if (!cle || vus.has(cle)) return;
    vus.add(cle);
    liste.push(p);
  };

  for (const m of membres) {
    ajouter({
      cle: `membre:${m.id}`,
      nom: m.nom,
      nature: "membre",
      membreId: m.id,
      personneId: null,
      mention: m.mention ?? null,
    });
  }

  for (const e of externes) {
    if (!e.actif) continue;
    ajouter({
      cle: `externe:${e.id}`,
      nom: e.nom,
      nature: "externe",
      membreId: null,
      personneId: e.id,
      mention: e.role || e.telephone || "externe",
    });
  }

  for (const nom of nomsHerites) {
    ajouter({
      cle: `nom:${cleDeListe(nom)}`,
      nom,
      nature: "heritee",
      membreId: null,
      personneId: null,
      mention: null,
    });
  }

  return liste;
};

/** Retrouver une personne à partir du nom écrit sur un enregistrement. */
export const personneParNom = (personnes: Personne[], nom: string): Personne | undefined => {
  const cle = cleDeListe(nom);
  if (!cle) return undefined;
  return personnes.find((p) => cleDeListe(p.nom) === cle);
};

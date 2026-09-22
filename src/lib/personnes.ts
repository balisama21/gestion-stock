import type { Database } from "./database.types";
import { cleDeListe } from "./listes";

export type PersonneExterne = Database["public"]["Tables"]["personnes_externes"]["Row"];

/** `heritee` : un nom écrit avant que les fiches n'existent. */
export type NaturePersonne = "membre" | "externe" | "heritee";

export interface Personne {
  /** Identifiant d'option du sélecteur, jamais écrit en base. */
  cle: string;
  nom: string;
  nature: NaturePersonne;
  membreId: string | null;
  personneId: string | null;
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
 * L'équipe d'abord, les fiches ensuite, les noms hérités en dernier —
 * et seulement ceux qu'aucune fiche ne réclame déjà, sinon « Lanto »
 * apparaîtrait deux fois.
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

/** Retrouver une personne depuis le nom écrit sur une ligne. */
export const personneParNom = (personnes: Personne[], nom: string): Personne | undefined => {
  const cle = cleDeListe(nom);
  if (!cle) return undefined;
  return personnes.find((p) => cleDeListe(p.nom) === cle);
};

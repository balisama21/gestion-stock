import { ENTITES } from "../../../lib/activite";
import { dateDuJour } from "../../../lib/dates";
import type { LigneJournalComplete } from "../hooks/useDashboardData";

/**
 * UNE LIGNE DE JOURNAL, DITE EN FRANÇAIS
 *
 * Le vocabulaire vient de `src/lib/activite.ts` — « Vente »,
 * « Règlement », « Dépense » — pour que le tableau de bord, la cloche
 * et l'historique appellent un geste du même nom. Deux tables de
 * traduction finiraient par diverger.
 *
 * L'ACTION SE DIT AU PASSÉ, ET S'ACCORDE. « Vente créée », « Achat
 * modifié », « Dépense supprimée » : le genre est porté par `ENTITES`,
 * qui sait que « vente » est féminin et « achat » masculin.
 */

export type GenreJournal = "vente" | "reglement" | "stock" | "autre";

export interface EvenementJournal {
  id: number;
  /** « 10:13 » */
  heure: string;
  /** « Vente créée · Huile × 3 » */
  texte: string;
  /** Ce qui précise, quand il y a quelque chose à préciser. */
  detail: string | null;
  montant: number | null;
  genre: GenreJournal;
  /** Le jour local, pour grouper. */
  jour: string;
}

const ACTIONS: Record<string, { mot: string; accorde: boolean }> = {
  creation: { mot: "créé", accorde: true },
  modification: { mot: "modifié", accorde: true },
  suppression: { mot: "supprimé", accorde: true },
};

/** À quelle famille la ligne appartient, pour l'icône et le filtre. */
function genreDe(entite: string): GenreJournal {
  if (entite === "sales" || entite === "orders" || entite === "quotes") return "vente";
  if (entite === "payments") return "reglement";
  if (entite === "products" || entite === "purchases") return "stock";
  return "autre";
}

export function lireLigneJournal(l: LigneJournalComplete): EvenementJournal | null {
  const ent = ENTITES[l.entite];
  if (!ent) return null;

  const action = ACTIONS[l.action];
  const verbe = action ? `${action.mot}${action.accorde ? ent.e : ""}` : l.action;
  const instant = new Date(l.cree_le);

  return {
    id: l.id,
    heure: instant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    texte: `${ent.libelle} ${verbe}`,
    detail: l.etiquette?.trim() || null,
    montant: l.montant,
    genre: genreDe(l.entite),
    jour: dateDuJour(instant),
  };
}

/** Les lignes lisibles, dans l'ordre où elles sont arrivées. */
export function lireJournal(lignes: LigneJournalComplete[]): EvenementJournal[] {
  return lignes.map(lireLigneJournal).filter((e): e is EvenementJournal => e !== null);
}

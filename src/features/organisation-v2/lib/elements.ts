import type { Tache } from "../../../lib/taches";
import type { Rappel } from "../../../lib/rappels";
import type { Evenement, LigneAgenda } from "../../../lib/evenements";
import { heureDe, jourDe } from "../../../lib/evenements";
import { occurrencesEntre } from "./occurrences";

/**
 * UNE LIGNE D'AGENDA, QUELLE QUE SOIT SA SOURCE
 *
 * Le fil de la journée, la semaine et le calendrier mêlent quatre
 * choses que la base range à part : les événements saisis, les
 * échéances de tâches, les occurrences de rappels et les échéances
 * que le métier porte déjà (achat à régler, devis qui expire, course
 * prévue). Les ramener à une même forme permet de les trier par heure
 * sans que l'écran sache d'où chacune vient.
 */
export type TypeElement = "rdv" | "tache" | "rappel" | "echeance";

export type Reference =
  | { kind: "tache"; id: string }
  | { kind: "evenement"; id: string }
  | { kind: "rappel"; id: string }
  | { kind: "echeance"; id: string };

export interface ElementOrg {
  cle: string;
  type: TypeElement;
  jour: string;
  /** « 14:30 », ou `null` pour ce qui vaut la journée entière. */
  heure: string | null;
  titre: string;
  sous: string;
  ref: Reference;
  enRetard?: boolean;
}

/** Les filtres de l'agenda, par type affiché. */
export type TypesAffiches = Record<"rendez_vous" | "tache" | "rappel" | "echeance", boolean>;

export const TOUS_LES_TYPES: TypesAffiches = {
  rendez_vous: true,
  tache: true,
  rappel: true,
  echeance: true,
};

export const CLASSE_TYPE: Record<TypeElement, string> = {
  rdv: "",
  tache: "tache",
  rappel: "rappel",
  echeance: "echeance",
};

export const COULEUR_TYPE: Record<TypeElement, string> = {
  rdv: "var(--accent)",
  tache: "var(--info)",
  rappel: "var(--warn)",
  echeance: "var(--crit)",
};

export interface Sources {
  taches: Tache[];
  evenements: Evenement[];
  rappels: Rappel[];
  echeances: LigneAgenda[];
  aujourdhui: string;
  nomDe: (id: string | null) => string;
}

const sousEvenement = (e: Evenement): string => {
  if (e.journee_entiere) return "Toute la journée";
  const plage = e.fin ? `${heureDe(e.debut)}–${heureDe(e.fin)}` : heureDe(e.debut);
  return e.lieu ? `${plage} · ${e.lieu}` : plage;
};

/** Tout ce qui tombe entre deux jours inclus, trié par jour puis par heure. */
export const elementsEntre = (
  debut: string,
  fin: string,
  s: Sources,
  types: TypesAffiches = TOUS_LES_TYPES,
): ElementOrg[] => {
  const sortie: ElementOrg[] = [];

  if (types.rendez_vous) {
    for (const e of s.evenements) {
      const jour = jourDe(e.debut);
      if (jour < debut || jour > fin) continue;
      sortie.push({
        cle: `ev-${e.id}`,
        type: "rdv",
        jour,
        heure: e.journee_entiere ? null : heureDe(e.debut),
        titre: e.titre,
        sous: sousEvenement(e),
        ref: { kind: "evenement", id: e.id },
      });
    }
  }

  if (types.tache) {
    for (const t of s.taches) {
      if (!t.echeance || t.statut === "termine") continue;
      if (t.echeance < debut || t.echeance > fin) continue;
      sortie.push({
        cle: `ta-${t.id}`,
        type: "tache",
        jour: t.echeance,
        // La table n'a pas d'heure : une tâche vaut pour la journée.
        heure: null,
        titre: t.titre,
        sous: `Tâche · ${s.nomDe(t.assignee_id)}`,
        ref: { kind: "tache", id: t.id },
        enRetard: t.echeance < s.aujourdhui,
      });
    }
  }

  if (types.rappel) {
    for (const r of s.rappels) {
      for (const o of occurrencesEntre(r, debut, fin)) {
        sortie.push({
          cle: `ra-${r.id}-${o.jour}`,
          type: "rappel",
          jour: o.jour,
          heure: o.heure,
          titre: r.titre,
          sous: "Rappel",
          ref: { kind: "rappel", id: r.id },
        });
      }
    }
  }

  if (types.echeance) {
    for (const l of s.echeances) {
      if (l.jour < debut || l.jour > fin) continue;
      sortie.push({
        cle: `ec-${l.id}`,
        type: "echeance",
        jour: l.jour,
        heure: l.heure,
        titre: l.titre,
        sous: l.detail,
        ref: { kind: "echeance", id: l.id },
        enRetard: l.jour < s.aujourdhui,
      });
    }
  }

  return sortie.sort((a, b) =>
    (a.jour + (a.heure ?? "00:00")).localeCompare(b.jour + (b.heure ?? "00:00")),
  );
};

import { dateDuJour } from "../../../lib/dates";
import { jourDe } from "./chiffres";

/**
 * CE QUI EST PRÉVU, JOUR PAR JOUR
 *
 * Le calendrier de la carte Agenda réunit quatre sources qui ne se
 * parlent pas : les événements, les échéances de tâches, les livraisons
 * prévues et les rappels. Chacune a sa façon de dire « quand », et
 * c'est ici qu'on les ramène toutes à un jour du calendrier local.
 *
 * LES RAPPELS N'ONT PAS DE DATE. La table `rappels` porte une
 * récurrence, une heure, un quantième et un jour de semaine — pas un
 * jour précis. Un rappel accroché à un événement ou à une tâche est
 * déjà représenté par celui-ci ; on ne le compte donc pas deux fois.
 * Restent les rappels autonomes :
 *
 *   mensuel       tombe sur son quantième
 *   hebdomadaire  tombe sur son jour de semaine
 *   quotidien     ÉCARTÉ — une pastille sur les trente jours du mois
 *                 ne dit plus rien de ce qui est prévu ; elle dit
 *                 seulement qu'un rappel quotidien existe, ce que la
 *                 page Rappels montre déjà mieux.
 */

export type NatureAgenda = "evenement" | "tache" | "livraison" | "rappel";

export interface ItemAgenda {
  id: string;
  jour: string;
  titre: string;
  /** « 15:00 », « Tâche en retard », « Réception »… */
  precision: string;
  nature: NatureAgenda;
}

export interface SourcesAgenda {
  evenements: { id: string; titre: string; debut: string; journee_entiere: boolean }[];
  taches: { id?: string; titre?: string; statut: string; echeance: string | null }[];
  deliveries: { id?: string; destinataire?: string; statut: string; date_prevue?: string | null }[];
  rappels: {
    id: string;
    titre: string;
    actif: boolean;
    recurrence: string;
    heure: string | null;
    jour_mois: number | null;
    jour_semaine: number | null;
    evenement_id: string | null;
    tache_id: string | null;
  }[];
}

/** « 15:00 » à partir d'un horodatage, en heure locale. */
const heureDe = (instant: string): string =>
  new Date(instant).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Tous les jours d'un mois donné, au format « AAAA-MM-JJ ». */
export function joursDuMois(annee: number, mois: number): string[] {
  const dernier = new Date(annee, mois + 1, 0).getDate();
  return Array.from(
    { length: dernier },
    (_, i) => `${annee}-${String(mois + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
  );
}

/**
 * Ce qui est prévu pendant le mois affiché, rangé par jour.
 *
 * On se limite au mois : le calendrier n'en montre qu'un, et parcourir
 * l'historique entier pour n'en retenir que trente jours serait payer
 * cher un résultat qu'on jette.
 */
export function agendaDuMois(
  s: SourcesAgenda,
  annee: number,
  mois: number,
  aujourdhui = dateDuJour(),
): Map<string, ItemAgenda[]> {
  const table = new Map<string, ItemAgenda[]>();
  const jours = joursDuMois(annee, mois);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];

  const poser = (item: ItemAgenda) => {
    if (item.jour < premier || item.jour > dernier) return;
    const liste = table.get(item.jour) ?? [];
    liste.push(item);
    table.set(item.jour, liste);
  };

  for (const e of s.evenements) {
    const jour = jourDe(e.debut);
    poser({
      id: `ev-${e.id}`,
      jour,
      titre: e.titre,
      precision: e.journee_entiere ? "Toute la journée" : heureDe(e.debut),
      nature: "evenement",
    });
  }

  for (const [i, t] of s.taches.entries()) {
    if (!t.echeance || t.statut === "termine") continue;
    poser({
      id: `ta-${t.id ?? i}`,
      jour: t.echeance,
      titre: t.titre ?? "Tâche",
      precision: t.echeance < aujourdhui ? "Échéance dépassée" : "Échéance",
      nature: "tache",
    });
  }

  for (const [i, d] of s.deliveries.entries()) {
    if (!d.date_prevue || d.statut === "annulee" || d.statut === "livree") continue;
    poser({
      id: `li-${d.id ?? i}`,
      jour: d.date_prevue,
      titre: d.destinataire ? `Livraison · ${d.destinataire}` : "Livraison",
      precision: "Prévue",
      nature: "livraison",
    });
  }

  for (const r of s.rappels) {
    // Déjà porté par l'événement ou la tâche auquel il est accroché.
    if (!r.actif || r.evenement_id || r.tache_id) continue;
    const heure = r.heure?.slice(0, 5) ?? null;
    const precision = heure ? `Rappel · ${heure}` : "Rappel";

    if (r.recurrence === "mensuel" && r.jour_mois) {
      const cible = jours[Math.min(r.jour_mois, jours.length) - 1];
      poser({ id: `ra-${r.id}`, jour: cible, titre: r.titre, precision, nature: "rappel" });
    } else if (r.recurrence === "hebdomadaire" && r.jour_semaine != null) {
      for (const jour of jours) {
        const [a, m, d] = jour.split("-").map(Number);
        if (new Date(a, m - 1, d).getDay() === r.jour_semaine) {
          poser({ id: `ra-${r.id}-${jour}`, jour, titre: r.titre, precision, nature: "rappel" });
        }
      }
    }
  }

  // Dans la journée, l'heure décide ; à défaut, l'ordre d'arrivée.
  for (const liste of table.values()) {
    liste.sort((a, b) => a.precision.localeCompare(b.precision));
  }
  return table;
}

/** Les `combien` premiers éléments à partir d'un jour, celui-ci compris. */
export function prochainsDepuis(
  table: Map<string, ItemAgenda[]>,
  depuis: string,
  combien = 3,
): ItemAgenda[] {
  return [...table.entries()]
    .filter(([jour]) => jour >= depuis)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, items]) => items)
    .slice(0, combien);
}

import { describe, expect, it } from "vitest";
import type { Rappel } from "../../../lib/rappels";
import { prochaineOccurrence } from "../../../lib/rappels";
import { jourLocal } from "../../../lib/evenements";
import { occurrencesEntre } from "./occurrences";

const base: Rappel = {
  id: "r",
  store_id: "s",
  createur_id: "u",
  destinataire_id: "u",
  titre: "R",
  recurrence: "quotidien",
  heure: "09:00:00",
  declenche_le: null,
  jour_semaine: null,
  jour_mois: null,
  actif: true,
  evenement_id: null,
  tache_id: null,
  created_at: "",
  updated_at: "",
};

const jours = (r: Partial<Rappel>, debut: string, fin: string) =>
  occurrencesEntre({ ...base, ...r }, debut, fin).map((o) => o.jour);

describe("occurrences des rappels", () => {
  it("quotidien : chaque jour, à l'heure enregistrée", () => {
    const o = occurrencesEntre(base, "2026-09-19", "2026-09-21");
    expect(o).toEqual([
      { jour: "2026-09-19", heure: "09:00" },
      { jour: "2026-09-20", heure: "09:00" },
      { jour: "2026-09-21", heure: "09:00" },
    ]);
  });

  it("hebdomadaire : le jour de la semaine enregistré (1 = lundi)", () => {
    expect(
      jours({ recurrence: "hebdomadaire", jour_semaine: 1 }, "2026-09-01", "2026-09-30"),
    ).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    // 0 = dimanche, comme en base et comme getDay().
    expect(
      jours({ recurrence: "hebdomadaire", jour_semaine: 0 }, "2026-09-14", "2026-09-20"),
    ).toEqual(["2026-09-20"]);
  });

  it("mensuel : le jour du mois, et rien les mois qui ne l'ont pas", () => {
    expect(jours({ recurrence: "mensuel", jour_mois: 20 }, "2026-08-01", "2026-10-31")).toEqual([
      "2026-08-20",
      "2026-09-20",
      "2026-10-20",
    ]);
    expect(jours({ recurrence: "mensuel", jour_mois: 31 }, "2026-08-01", "2026-11-30")).toEqual([
      "2026-08-31",
      "2026-10-31",
    ]);
  });

  it("ponctuel : le jour de declenche_le, à son heure locale", () => {
    const quand = new Date(2026, 8, 22, 14, 30);
    const o = occurrencesEntre(
      { ...base, recurrence: "aucune", heure: null, declenche_le: quand.toISOString() },
      "2026-09-01",
      "2026-09-30",
    );
    expect(o).toEqual([{ jour: "2026-09-22", heure: "14:30" }]);
  });

  it("désactivé : ne sonne jamais", () => {
    expect(jours({ actif: false }, "2026-09-01", "2026-09-30")).toEqual([]);
  });

  it("concorde avec prochaineOccurrence, déjà utilisée par l'application", () => {
    const maintenant = new Date(2026, 8, 19, 10, 0);
    for (const r of [
      { ...base },
      { ...base, recurrence: "hebdomadaire", jour_semaine: 1 },
      { ...base, recurrence: "mensuel", jour_mois: 20 },
    ] as Rappel[]) {
      const p = prochaineOccurrence(r, maintenant)!;
      const apres = occurrencesEntre(r, "2026-09-19", "2026-10-31").find(
        (o) => new Date(`${o.jour}T${o.heure}:00`) > maintenant,
      );
      expect(apres?.jour).toBe(jourLocal(p));
    }
  });
});

import { describe, expect, it } from "vitest";
import { disponibilite, MESSAGE_IA_NON_CONFIGUREE, type EtatIA } from "./clientIA";

const boutique = {
  plateforme_active: true,
  modele_defini: true,
  boutique_active: true,
  fonctionnalites: ["assistant" as const],
  requetes_mois: 0,
  requetes_mensuelles_max: null as number | null,
  part_utilisee_pct: 10,
  cout_mois_usd: null,
  plafond_mensuel_usd: null,
};

const etat = (p: Partial<EtatIA> = {}, b: Partial<typeof boutique> = {}): EtatIA => ({
  cleConfiguree: true,
  coupe: false,
  boutique: { ...boutique, ...b },
  ...p,
});

describe("disponibilite", () => {
  it("IA non configurée tant qu'il manque la clé, la fonction serveur ou l'activation", () => {
    expect(disponibilite(null, "assistant").raison).toBe(MESSAGE_IA_NON_CONFIGUREE);
    expect(disponibilite(etat({ cleConfiguree: false }), "assistant").raison).toBe(
      MESSAGE_IA_NON_CONFIGUREE,
    );
    expect(disponibilite(etat({ boutique: null }), "assistant").raison).toBe(
      MESSAGE_IA_NON_CONFIGUREE,
    );
    expect(disponibilite(etat({}, { plateforme_active: false }), "assistant").raison).toBe(
      MESSAGE_IA_NON_CONFIGUREE,
    );
    expect(disponibilite(etat({}, { modele_defini: false }), "assistant").raison).toBe(
      MESSAGE_IA_NON_CONFIGUREE,
    );
  });

  it("explique les autres blocages", () => {
    expect(disponibilite(etat({ coupe: true }), "assistant").disponible).toBe(false);
    expect(disponibilite(etat({}, { boutique_active: false }), "assistant").raison).toMatch(
      /boutique/,
    );
    expect(disponibilite(etat(), "redaction").raison).toMatch(/n'est pas activée/);
    expect(
      disponibilite(etat({}, { requetes_mensuelles_max: 3, requetes_mois: 3 }), "assistant").raison,
    ).toMatch(/Quota/);
    expect(disponibilite(etat({}, { part_utilisee_pct: 100 }), "assistant").raison).toMatch(
      /Plafond/,
    );
  });

  it("disponible quand tout est réuni", () => {
    expect(disponibilite(etat(), "assistant")).toEqual({ disponible: true, raison: null });
  });
});

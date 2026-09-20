import { describe, expect, it } from "vitest";
import { boutiqueEstVerrouillee, vueAffichee, VUE_VERROUILLEE } from "./verrouillage";

const HIER = new Date(Date.now() - 86_400_000).toISOString();
const DEMAIN = new Date(Date.now() + 86_400_000).toISOString();

describe("boutiqueEstVerrouillee — le miroir de store_is_locked()", () => {
  it("ferme une boutique verrouillée explicitement", () => {
    expect(
      boutiqueEstVerrouillee({
        activation_status: "locked",
        trial_ends_at: DEMAIN,
        abonnement_jusqu_au: null,
      }),
    ).toBe(true);
  });

  it("laisse ouverte une activation à vie, quelle que soit la date d'essai", () => {
    // C'est le cas du bug : le compte est réglé, la date d'essai de la
    // boutique est depuis longtemps passée, et elle doit rester ouverte.
    expect(
      boutiqueEstVerrouillee({
        activation_status: "active",
        trial_ends_at: HIER,
        abonnement_jusqu_au: null,
      }),
    ).toBe(false);
  });

  it("laisse ouvert un abonnement au mois dont l'échéance est à venir", () => {
    expect(
      boutiqueEstVerrouillee({
        activation_status: "active",
        trial_ends_at: HIER,
        abonnement_jusqu_au: DEMAIN,
      }),
    ).toBe(false);
  });

  it("ferme un abonnement au mois échu, même « actif »", () => {
    expect(
      boutiqueEstVerrouillee({
        activation_status: "active",
        trial_ends_at: DEMAIN,
        abonnement_jusqu_au: HIER,
      }),
    ).toBe(true);
  });

  it("laisse ouvert un essai en cours", () => {
    expect(
      boutiqueEstVerrouillee({
        activation_status: "trial",
        trial_ends_at: DEMAIN,
        abonnement_jusqu_au: null,
      }),
    ).toBe(false);
  });

  it("ferme un essai terminé", () => {
    expect(
      boutiqueEstVerrouillee({
        activation_status: "trial",
        trial_ends_at: HIER,
        abonnement_jusqu_au: null,
      }),
    ).toBe(true);
  });
});

describe("vueAffichee — ce qu'on peut encore faire quand c'est fermé", () => {
  it("ne change rien tant que la boutique est ouverte", () => {
    expect(vueAffichee("ventes", false)).toBe("ventes");
    expect(vueAffichee("settings", false)).toBe("settings");
  });

  it("remplace une vue de données par l'écran d'activation", () => {
    expect(vueAffichee("ventes", true)).toBe(VUE_VERROUILLEE);
    expect(vueAffichee("dashboard", true)).toBe(VUE_VERROUILLEE);
    expect(vueAffichee("produits", true)).toBe(VUE_VERROUILLEE);
  });

  it("laisse les Paramètres joignables — profil, e-mail, support", () => {
    expect(vueAffichee("settings", true)).toBe("settings");
  });
});

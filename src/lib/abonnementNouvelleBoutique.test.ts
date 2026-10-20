import { describe, expect, it } from "vitest";
import { abonnementNouvelleBoutique } from "./abonnementNouvelleBoutique";

/**
 * La fenêtre « Créer une boutique » annonce ce que la base appliquera
 * (protect_store_activation_fields) : l'état du COMPTE, jamais un essai
 * neuf pour qui en a déjà un.
 */
const MAINTENANT = new Date("2026-10-20T12:00:00Z").getTime();
const boutique = (b: Partial<Parameters<typeof abonnementNouvelleBoutique>[0][number]>) => ({
  owner_id: "moi",
  marque_id: null,
  activation_status: "trial",
  trial_ends_at: "2026-11-01T00:00:00Z",
  abonnement_jusqu_au: null,
  ...b,
});

describe("ce qu'une nouvelle boutique reprend du compte", () => {
  it("compte activé à vie : ouverte tout de suite", () => {
    expect(
      abonnementNouvelleBoutique(
        [boutique({ activation_status: "active" })],
        "moi",
        null,
        MAINTENANT,
      ),
    ).toEqual({ type: "a-vie" });
  });

  it("abonnement au mois : la même échéance", () => {
    const jusquAu = "2026-12-01T00:00:00Z";
    expect(
      abonnementNouvelleBoutique(
        [boutique({ activation_status: "active", abonnement_jusqu_au: jusquAu })],
        "moi",
        null,
        MAINTENANT,
      ),
    ).toEqual({ type: "au-mois", jusquAu });
  });

  it("essai en cours : la fin d'essai la plus proche du compte, pas un essai neuf", () => {
    expect(
      abonnementNouvelleBoutique(
        [
          boutique({ trial_ends_at: "2026-11-15T00:00:00Z" }),
          boutique({ trial_ends_at: "2026-11-01T00:00:00Z" }),
        ],
        "moi",
        null,
        MAINTENANT,
      ),
    ).toEqual({ type: "essai", jusquAu: "2026-11-01T00:00:00Z" });
  });

  it("essai terminé, abonnement échu : la boutique attendra l'activation", () => {
    expect(
      abonnementNouvelleBoutique(
        [
          boutique({ trial_ends_at: "2026-10-01T00:00:00Z" }),
          boutique({ activation_status: "active", abonnement_jusqu_au: "2026-10-10T00:00:00Z" }),
        ],
        "moi",
        null,
        MAINTENANT,
      ).type,
    ).toBe("essai-termine");
  });

  it("ignore les boutiques des autres et celles des marques", () => {
    const autres = [
      boutique({ owner_id: "hote", activation_status: "active" }),
      boutique({ marque_id: "m1", activation_status: "active" }),
    ];
    expect(abonnementNouvelleBoutique(autres, "moi", null, MAINTENANT)).toEqual({
      type: "essai-neuf",
    });
  });

  it("sur le domaine d'une marque : rien à annoncer", () => {
    expect(abonnementNouvelleBoutique([], "moi", "m1", MAINTENANT)).toEqual({ type: "marque" });
  });
});

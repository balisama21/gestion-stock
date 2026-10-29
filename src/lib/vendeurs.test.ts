import { describe, expect, it } from "vitest";
import { aUneEquipe, collaborateurs, estResponsable, libelleNature } from "./vendeurs";

/**
 * LE RESPONSABLE N'EST PAS UN VENDEUR DE L'ÉQUIPE
 *
 * Seul, il n'a pas d'équipe ; un membre invité ou un nom sans compte
 * en forment une. Une nature absente garde l'ancien comportement.
 */

const RESPONSABLE = { nature: "responsable" as const, role: null };
const VENDEUSE = { nature: "membre" as const, role: "vendeur" };
const ANCIEN = { nature: "sans_compte" as const, role: null };

describe("l'équipe de vente", () => {
  it("le responsable seul n'a pas d'équipe", () => {
    expect(aUneEquipe([RESPONSABLE])).toBe(false);
    expect(collaborateurs([RESPONSABLE])).toEqual([]);
    expect(aUneEquipe([])).toBe(false);
  });

  it("un membre invité ou un nom sans compte forment une équipe", () => {
    expect(collaborateurs([RESPONSABLE, VENDEUSE])).toEqual([VENDEUSE]);
    expect(aUneEquipe([RESPONSABLE, ANCIEN])).toBe(true);
  });

  it("une nature absente compte comme un membre, comme avant", () => {
    expect(estResponsable({})).toBe(false);
    expect(aUneEquipe([{}])).toBe(true);
  });

  it("dit le rôle réel de chacun", () => {
    expect(libelleNature(RESPONSABLE)).toBe("Responsable");
    expect(libelleNature(VENDEUSE)).toBe("Vendeur");
    expect(libelleNature({ nature: "membre", role: "manager" })).toBe("Manager");
    expect(libelleNature(ANCIEN)).toBe("Sans compte");
    expect(libelleNature({ nature: "membre", role: "inconnu" })).toBe("Membre");
  });
});

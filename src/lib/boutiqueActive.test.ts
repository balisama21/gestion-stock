import { beforeEach, describe, expect, it } from "vitest";
import { lireBoutiqueActive, oublierBoutiqueActive, retenirBoutiqueActive } from "./boutiqueActive";

const MAMY = "8d22f166-7409-4319-9ac1-8f468b16dc17";
const AUTRE = "2a2f1d47-6573-42ac-99c6-a31aaf49ccb0";

describe("la boutique retenue d'un navigateur", () => {
  beforeEach(() => window.localStorage.clear());

  it("ne se souvient de rien au premier passage", () => {
    expect(lireBoutiqueActive(MAMY)).toBeNull();
  });

  it("retient puis relit le choix", () => {
    retenirBoutiqueActive(MAMY, "boutique-a");
    expect(lireBoutiqueActive(MAMY)).toBe("boutique-a");
  });

  it("ne mélange pas deux comptes sur le même navigateur", () => {
    retenirBoutiqueActive(MAMY, "boutique-a");
    retenirBoutiqueActive(AUTRE, "boutique-b");
    expect(lireBoutiqueActive(MAMY)).toBe("boutique-a");
    expect(lireBoutiqueActive(AUTRE)).toBe("boutique-b");
  });

  it("oublie — sans quoi une boutique expirée redevenait inévitable", () => {
    // Le cœur du bug 2 : la clé n'était effacée nulle part, donc chaque
    // reconnexion ramenait sur la boutique qu'on venait de quitter.
    retenirBoutiqueActive(MAMY, "boutique-expiree");
    oublierBoutiqueActive(MAMY);
    expect(lireBoutiqueActive(MAMY)).toBeNull();
  });

  it("n'oublie que le compte visé", () => {
    retenirBoutiqueActive(MAMY, "boutique-a");
    retenirBoutiqueActive(AUTRE, "boutique-b");
    oublierBoutiqueActive(MAMY);
    expect(lireBoutiqueActive(AUTRE)).toBe("boutique-b");
  });
});

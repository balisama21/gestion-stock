import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOrganisationV2 } from "./drapeau";

/**
 * L'INTERRUPTEUR QUI RAMÈNE LES ANCIENS ÉCRANS.
 *
 * `VITE_ORGANISATION_V2` vaut faux dans les tests (voir
 * `vitest.config.ts`) : c'est le socle contre lequel le navigateur et
 * l'adresse sont mesurés.
 */
const CLE = "organisation_v2";
const adresse = (recherche: string) => window.history.replaceState(null, "", `/${recherche}`);

beforeEach(() => {
  window.localStorage.clear();
  adresse("");
});
afterEach(() => {
  window.localStorage.clear();
  adresse("");
});

const lire = () => renderHook(() => useOrganisationV2()).result.current;

describe("drapeau organisation_v2", () => {
  it("est baissé par défaut", () => {
    expect(lire()).toBe(false);
  });

  it("s'allume pour ce navigateur", () => {
    window.localStorage.setItem(CLE, "1");
    expect(lire()).toBe(true);
  });

  it("s'allume par l'adresse, retient le choix et nettoie la barre", () => {
    adresse("?organisation_v2=1&autre=x");
    expect(lire()).toBe(true);
    expect(window.localStorage.getItem(CLE)).toBe("1");
    expect(window.location.search).toBe("?autre=x");
  });

  it("s'éteint par l'adresse, même allumé dans le navigateur", () => {
    window.localStorage.setItem(CLE, "1");
    adresse("?organisation_v2=0");
    expect(lire()).toBe(false);
    expect(lire()).toBe(false);
  });

  it("n'est pas allumé par celui du tableau de bord", () => {
    window.localStorage.setItem("dashboard_v2", "1");
    expect(lire()).toBe(false);
  });
});

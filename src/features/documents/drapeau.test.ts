import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentsV2 } from "./drapeau";

/**
 * L'INTERRUPTEUR QUI DOIT MARCHER QUAND TOUT LE RESTE BRÛLE.
 *
 * C'est lui qui ramène les anciennes factures si les nouvelles posent
 * problème. Un ordre de priorité faux, et l'on se retrouve à ne plus
 * pouvoir éteindre — d'où ces tests, qui vérifient surtout QUI
 * l'emporte sur QUI.
 *
 * `VITE_DOCUMENTS_V2` est figé à la compilation et vaut faux dans les
 * tests : c'est donc le socle contre lequel les trois autres
 * interrupteurs sont mesurés.
 */

const CLE = "documents_v2";

const adresse = (recherche: string) => {
  window.history.replaceState(null, "", `/${recherche}`);
};

beforeEach(() => {
  window.localStorage.clear();
  adresse("");
});

afterEach(() => {
  window.localStorage.clear();
  adresse("");
});

const lire = (reglage: boolean | null = null) =>
  renderHook(() => useDocumentsV2(reglage)).result.current;

describe("sans rien de réglé", () => {
  it("suit le déploiement, qui vaut faux dans les tests", () => {
    expect(lire()).toBe(false);
  });
});

describe("le réglage de la boutique", () => {
  it("allume quand il dit oui", () => {
    expect(lire(true)).toBe(true);
  });

  it("éteint quand il dit non", () => {
    expect(lire(false)).toBe(false);
  });

  it("laisse le déploiement décider quand il ne dit rien", () => {
    // Trois états, et non deux : une boutique qui n'a jamais touché au
    // réglage ne l'a pas refusé.
    expect(lire(null)).toBe(false);
  });
});

describe("le navigateur passe devant la boutique", () => {
  it("allume pour un seul navigateur, même si la boutique se tait", () => {
    window.localStorage.setItem(CLE, "1");
    expect(lire(null)).toBe(true);
  });

  it("mais n'empêche pas la boutique d'allumer", () => {
    expect(lire(true)).toBe(true);
  });
});

describe("l'adresse a le dernier mot", () => {
  it("éteint malgré un réglage de boutique qui allume", () => {
    /*
     * LE CAS QUI COMPTE VRAIMENT. Si l'écran de réglages lui-même
     * n'est plus atteignable, il reste un lien à ouvrir depuis un
     * téléphone pour revenir aux anciennes factures.
     */
    adresse("?documents_v2=0");
    expect(lire(true)).toBe(false);
  });

  it("allume malgré un réglage de boutique qui éteint", () => {
    adresse("?documents_v2=1");
    expect(lire(false)).toBe(true);
  });

  it("passe aussi devant le navigateur", () => {
    window.localStorage.setItem(CLE, "1");
    adresse("?documents_v2=0");
    expect(lire(null)).toBe(false);
  });

  it("retient le choix et nettoie la barre d'adresse", () => {
    // Sans cela le réglage se perdrait à la première navigation, et
    // on le partagerait sans le vouloir en envoyant un lien.
    adresse("?documents_v2=1");
    lire(null);
    expect(window.location.search).toBe("");
    expect(window.localStorage.getItem(CLE)).toBe("1");
  });

  it("efface le choix retenu quand on éteint par l'adresse", () => {
    window.localStorage.setItem(CLE, "1");
    adresse("?documents_v2=0");
    lire(null);
    expect(window.localStorage.getItem(CLE)).toBeNull();
  });
});

describe("ce qu'il refuse d'interpréter", () => {
  it("ignore une valeur d'adresse qui ne veut rien dire", () => {
    adresse("?documents_v2=peut-etre");
    expect(lire(true)).toBe(true);
  });

  it("accepte les mots courants, pas seulement les chiffres", () => {
    adresse("?documents_v2=oui");
    expect(lire(false)).toBe(true);
    adresse("?documents_v2=non");
    expect(lire(true)).toBe(false);
  });
});

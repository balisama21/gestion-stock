import { describe, expect, it } from "vitest";
import { deviseEnToutesLettres, montantEnLettres, nombreEnLettres } from "./montantEnLettres";

/**
 * LA MENTION QUI FAIT FOI.
 *
 * Sur une facture contestée, c'est le montant en lettres qui tranche.
 * Une faute d'accord n'est donc pas une coquetterie d'orthographe :
 * c'est un document qui se discute.
 *
 * Les neuf cas demandés sont marqués « ⚑ ». Les autres sont là parce
 * que chacun a un piège que les neuf ne couvraient pas.
 */

describe("les neuf cas de contrôle", () => {
  const CAS: [number, string][] = [
    [1, "un"],
    [71, "soixante et onze"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [100, "cent"],
    [200, "deux cents"],
    [1000, "mille"],
    [331800, "trois cent trente et un mille huit cents"],
    [1500000, "un million cinq cent mille"],
  ];

  it.each(CAS)("⚑ %i → « %s »", (valeur, attendu) => {
    expect(nombreEnLettres(valeur)).toBe(attendu);
  });
});

describe("le s de « cent » et de « quatre-vingt »", () => {
  it("prend son s quand il est multiplié et que rien ne le suit", () => {
    expect(nombreEnLettres(200)).toBe("deux cents");
    expect(nombreEnLettres(900)).toBe("neuf cents");
    expect(nombreEnLettres(80)).toBe("quatre-vingts");
  });

  it("le perd dès qu'un mot de nombre le suit", () => {
    expect(nombreEnLettres(201)).toBe("deux cent un");
    expect(nombreEnLettres(281)).toBe("deux cent quatre-vingt-un");
    expect(nombreEnLettres(81)).toBe("quatre-vingt-un");
  });

  it("le perd aussi devant « mille », qui est un mot de nombre", () => {
    // Le piège central de ce module. « Deux cents mille » est une
    // faute, « deux cents millions » n'en est pas une.
    expect(nombreEnLettres(200000)).toBe("deux cent mille");
    expect(nombreEnLettres(80000)).toBe("quatre-vingt mille");
  });

  it("le garde devant « million », qui est un nom", () => {
    expect(nombreEnLettres(200000000)).toBe("deux cents millions");
    expect(nombreEnLettres(80000000)).toBe("quatre-vingts millions");
  });

  it("ne le prend jamais quand il n'est pas multiplié", () => {
    expect(nombreEnLettres(100)).toBe("cent");
    expect(nombreEnLettres(180)).toBe("cent quatre-vingts");
  });
});

describe("soixante-dix et quatre-vingt-dix", () => {
  it("s'écrivent en additionnant", () => {
    expect(nombreEnLettres(70)).toBe("soixante-dix");
    expect(nombreEnLettres(72)).toBe("soixante-douze");
    expect(nombreEnLettres(90)).toBe("quatre-vingt-dix");
    expect(nombreEnLettres(99)).toBe("quatre-vingt-dix-neuf");
  });

  it("seul soixante et onze prend le « et »", () => {
    // Il n'y a pas de règle : c'est l'usage. Le test est là pour que
    // personne ne « corrige » l'un en croyant harmoniser l'autre.
    expect(nombreEnLettres(71)).toBe("soixante et onze");
    expect(nombreEnLettres(91)).toBe("quatre-vingt-onze");
  });

  it("le « et » des autres dizaines suit la règle ordinaire", () => {
    expect(nombreEnLettres(21)).toBe("vingt et un");
    expect(nombreEnLettres(61)).toBe("soixante et un");
    expect(nombreEnLettres(22)).toBe("vingt-deux");
  });
});

describe("mille", () => {
  it("ne se fait jamais précéder de « un »", () => {
    expect(nombreEnLettres(1000)).toBe("mille");
    expect(nombreEnLettres(1001)).toBe("mille un");
  });

  it("est invariable", () => {
    expect(nombreEnLettres(2000)).toBe("deux mille");
    expect(nombreEnLettres(9000)).toBe("neuf mille");
  });
});

describe("million et milliard", () => {
  it("prennent la marque du pluriel", () => {
    expect(nombreEnLettres(1000000)).toBe("un million");
    expect(nombreEnLettres(2000000)).toBe("deux millions");
    expect(nombreEnLettres(1000000000)).toBe("un milliard");
    expect(nombreEnLettres(3000000000)).toBe("trois milliards");
  });

  it("s'enchaînent dans l'ordre", () => {
    expect(nombreEnLettres(1234567)).toBe(
      "un million deux cent trente-quatre mille cinq cent soixante-sept",
    );
  });

  it("sautent les tranches vides sans laisser de trou", () => {
    expect(nombreEnLettres(1000001)).toBe("un million un");
    expect(nombreEnLettres(1000000000)).toBe("un milliard");
  });
});

describe("les montants d'une vraie boutique", () => {
  it.each([
    [6500, "six mille cinq cents"],
    [15000, "quinze mille"],
    [45000, "quarante-cinq mille"],
    [331800, "trois cent trente et un mille huit cents"],
    [2750000, "deux millions sept cent cinquante mille"],
  ])("%i → « %s »", (valeur, attendu) => {
    expect(nombreEnLettres(valeur)).toBe(attendu);
  });
});

describe("les cas limites", () => {
  it("dit zéro plutôt que rien", () => {
    expect(nombreEnLettres(0)).toBe("zéro");
  });

  it("arrondit, comme l'affichage en chiffres", () => {
    // Les deux mentions du document doivent dire la même chose : si
    // « 6 500 Ar » s'affiche, « six mille cinq cents » doit suivre.
    expect(nombreEnLettres(6499.6)).toBe("six mille cinq cents");
    expect(nombreEnLettres(6500.4)).toBe("six mille cinq cents");
  });

  it("sait dire un montant négatif", () => {
    expect(nombreEnLettres(-1500)).toBe("moins mille cinq cents");
  });

  it("renonce plutôt que d'inventer, au-delà du représentable", () => {
    // Le document masque alors la mention. Mieux vaut pas de phrase
    // qu'une phrase tronquée sur un papier qui engage.
    expect(nombreEnLettres(1e15)).toBeNull();
    expect(nombreEnLettres(Number.POSITIVE_INFINITY)).toBeNull();
    expect(nombreEnLettres(Number.NaN)).toBeNull();
  });
});

describe("la devise", () => {
  it("s'ajoute au bout, en toutes lettres", () => {
    expect(montantEnLettres(331800, "ariary")).toBe(
      "trois cent trente et un mille huit cents ariary",
    );
  });

  it("vaut ariary par défaut", () => {
    expect(montantEnLettres(1)).toBe("un ariary");
  });

  it("traduit le sigle de la boutique en mot", () => {
    // « trois cents Ar » ne s'écrit pas dans une mention légale.
    expect(deviseEnToutesLettres("Ar")).toBe("ariary");
    expect(deviseEnToutesLettres("€")).toBe("euros");
    expect(deviseEnToutesLettres("")).toBe("ariary");
  });

  it("recopie ce qu'elle ne connaît pas plutôt que d'inventer", () => {
    expect(deviseEnToutesLettres("Kz")).toBe("kz");
  });

  it("se tait quand le montant n'est pas représentable", () => {
    expect(montantEnLettres(Number.NaN)).toBeNull();
  });
});

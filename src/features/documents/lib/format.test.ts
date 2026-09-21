import { describe, expect, it } from "vitest";
import { formatCurrency, formatDateLocale } from "../../../utils/formulas";
import {
  dateCourte,
  dateEcheance,
  dateLongue,
  heure,
  initiales,
  LIBELLE_ECHEANCE,
  montant,
  montantOuTiret,
  nombre,
} from "./format";

/**
 * LE DOCUMENT NE DOIT JAMAIS CONTREDIRE L'ÉCRAN.
 *
 * Les deux premiers blocs sont les plus importants du fichier : ils
 * comparent le formatage des documents à celui du reste de
 * l'application. Le jour où quelqu'un touche à l'un des deux sans
 * l'autre, c'est ici que cela se voit — pas sur une facture chez le
 * client.
 */

/**
 * Les deux mises en forme ne diffèrent que par la nature de l'espace
 * qui précède la devise : ordinaire à l'écran, insécable sur le
 * papier (voir le test qui suit). Cette différence est invisible et
 * voulue ; on la neutralise pour comparer ce qui compte — les
 * chiffres et leur groupement.
 */
const memeEspace = (s: string) => s.replace(/\u00a0/g, " ");

describe("les montants disent la même chose que la page Ventes", () => {
  it.each([0, 1, 999, 1000, 6500, 331800, 1500000])("%i", (v) => {
    expect(memeEspace(montant(v, "Ar"))).toBe(memeEspace(formatCurrency(v)));
  });

  it("ne laisse pas la devise passer à la ligne toute seule", () => {
    // C'est la seule différence assumée avec `formatCurrency`. À
    // l'écran, « Ar » qui descend d'une ligne est un détail ; sur une
    // facture imprimée, un total dont la devise s'est détachée fait
    // douter du montant.
    expect(montant(1500)).toBe("1\u00a0500\u00a0Ar");
    expect(formatCurrency(1500)).toBe("1\u00a0500 Ar");
  });

  it("sépare les milliers par une espace insécable ordinaire", () => {
    // U+00A0 et non U+202F : la fine insécable ne survit pas à tous
    // les encodages, et « 6 500 » y devient « 6/500 ».
    expect(nombre(6500)).toBe("6\u00a0500");
    expect(nombre(6500)).not.toContain("\u202f");
  });

  it("suit la devise de la boutique", () => {
    expect(montant(1500, "€")).toBe("1\u00a0500\u00a0€");
    // Une devise absente ne doit pas produire « 1 500 undefined ».
    expect(montant(1500, null)).toBe("1\u00a0500\u00a0Ar");
    expect(montant(1500, "  ")).toBe("1\u00a0500\u00a0Ar");
  });

  it("arrondit sans décimale, comme partout ailleurs", () => {
    expect(memeEspace(montant(6499.6))).toBe(memeEspace(formatCurrency(6499.6)));
  });
});

describe("un prix inconnu n'est pas un prix nul", () => {
  it("affiche un tiret plutôt que zéro", () => {
    // « 0 Ar » sur un bon de commande se lit « gratuit ». C'est une
    // erreur qu'on ne rattrape plus une fois le papier parti.
    expect(montantOuTiret(null)).toBe("—");
    expect(montantOuTiret(undefined)).toBe("—");
  });

  it("mais zéro reste zéro quand c'est vraiment zéro", () => {
    expect(memeEspace(montantOuTiret(0))).toBe(memeEspace(formatCurrency(0)));
  });
});

describe("les dates disent la même chose que le reste de l'application", () => {
  it.each(["2026-09-13", "2026-01-01", "2026-12-31"])("%s", (iso) => {
    expect(dateCourte(iso, "FR")).toBe(formatDateLocale(iso, "FR"));
    expect(dateCourte(iso, "US")).toBe(formatDateLocale(iso, "US"));
  });

  it("ne recule pas d'un jour selon le fuseau", () => {
    // `new Date("2026-09-13")` se lit en UTC puis s'affiche en local :
    // à l'ouest de Greenwich, la facture porterait le 12. Les dates de
    // l'application sont des jours commerciaux, pas des instants.
    expect(dateCourte("2026-09-13")).toBe("13/09/2026");
    expect(dateCourte("2026-09-13T23:30:00+03:00")).toBe("13/09/2026");
  });

  it("écrit la date en toutes lettres pour un document soigné", () => {
    expect(dateLongue("2026-09-13")).toBe("13 septembre 2026");
    expect(dateLongue("2026-08-01")).toBe("1er août 2026");
  });

  it("ne rend rien plutôt que « Invalid Date »", () => {
    expect(dateCourte(null)).toBe("");
    expect(dateCourte("")).toBe("");
    expect(dateLongue(undefined)).toBe("");
  });

  it("lit l'heure d'un horodatage, pour le ticket", () => {
    const t = new Date(2026, 8, 13, 9, 41).toISOString();
    expect(heure(t)).toBe("09:41");
    expect(heure(null)).toBe("");
    expect(heure("pas une date")).toBe("");
  });
});

describe("l'échéance", () => {
  it("ajoute les jours du réglage à la date de vente", () => {
    expect(dateEcheance("2026-09-13", "sous_15_jours")).toBe("2026-09-28");
    expect(dateEcheance("2026-09-13", "sous_30_jours")).toBe("2026-10-13");
    expect(dateEcheance("2026-09-13", "a_reception")).toBe("2026-09-13");
  });

  it("franchit les mois et les années sans aide", () => {
    expect(dateEcheance("2026-12-28", "sous_15_jours")).toBe("2027-01-12");
    // 2028 est bissextile : le 29 février existe.
    expect(dateEcheance("2028-02-20", "sous_15_jours")).toBe("2028-03-06");
  });

  it("ne donne pas de date quand la vente est comptant", () => {
    // Il n'y a rien à attendre : le document montre le libellé seul.
    expect(dateEcheance("2026-09-13", "comptant")).toBeNull();
    expect(LIBELLE_ECHEANCE.comptant).toBe("Payée comptant");
  });

  it("ne donne pas de date sans date de vente", () => {
    expect(dateEcheance(null, "sous_15_jours")).toBeNull();
  });
});

describe("les initiales d'une boutique sans logo", () => {
  it("prennent la première lettre des deux premiers mots", () => {
    expect(initiales("Ma Boutique")).toBe("MB");
    expect(initiales("TROPIC VISION Mangarivotra")).toBe("TV");
  });

  it("se rabattent sur deux lettres quand il n'y a qu'un mot", () => {
    expect(initiales("Épicerie")).toBe("ÉP");
  });

  it("ne rendent rien plutôt qu'un carré vide", () => {
    expect(initiales("")).toBe("");
    expect(initiales(null)).toBe("");
    expect(initiales("   ")).toBe("");
  });

  it("ignorent la ponctuation isolée", () => {
    expect(initiales("Chez  ·  Toky")).toBe("CT");
  });
});

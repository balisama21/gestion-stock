import { beforeEach, describe, expect, it } from "vitest";
import type { Expense, Sale } from "../types";
import type { LigneNote } from "./bar";
import { depuisLe, fichesHabitues, repartirReglement, trierHabitues } from "./habituesBar";
import { bilanCaissiers, bilanServeurs, SANS_SERVEUR } from "./equipeBar";
import { bilanBar, periodeDe } from "./bilanBar";
import {
  bonsDeLaCommande,
  derniereCommande,
  lireReglagesBons,
  posteParDefaut,
  prochainNumeroDeBon,
} from "./bonsBar";

let n = 0;
const vente = (p: Partial<Sale>): Sale => ({
  id: `v${++n}`,
  numero: `V${n}`,
  date: "2026-11-20",
  productId: "thb",
  designation: "THB",
  quantite: 1,
  prixVenteUnit: 5000,
  totalVente: 5000,
  prixAchatUnitRef: 3500,
  totalAchatRef: 3500,
  margeTotale: 1500,
  vendeur: "Caisse",
  commission: 0,
  montantPaye: 5000,
  montantRembourse: 0,
  montantAvoire: 0,
  soldeDu: 0,
  statutCredit: "Payé",
  ...p,
});

const ligne = (p: Partial<LigneNote>): LigneNote => ({
  id: `l${++n}`,
  store_id: "s",
  note_id: "n1",
  product_id: "thb",
  designation: "THB",
  genre: "article",
  quantite: 1,
  prix_unit: 5000,
  offert: false,
  serveur: "Rado",
  annulee: false,
  motif: null,
  sale_id: null,
  cree_le: "2026-11-20T20:00:00Z",
  ...p,
});

describe("les habitués", () => {
  const rado = { id: "c1", nom: "Rakoto", prenom: "Rado", telephone: null };
  const vola = { id: "c2", nom: "Vola", prenom: null, telephone: "034" };
  const solo = { id: "c3", nom: "Zo", prenom: null, telephone: null };
  const ventes = [
    vente({ clientId: "c1", date: "2026-11-10", quantite: 4, totalVente: 20000 }),
    vente({
      clientId: "c1",
      date: "2026-11-18",
      productId: "coca",
      designation: "Coca",
      totalVente: 3000,
      soldeDu: 3000,
    }),
    vente({ clientId: "c1", date: "2026-11-18", totalVente: 5000, soldeDu: 2000 }),
    vente({ clientId: "c2", date: "2026-11-19" }),
  ];

  it("compte les venues, l'ardoise et les favoris", () => {
    const [f] = fichesHabitues([rado], ventes);
    expect(f.visites).toBe(2);
    expect(f.derniereVenue).toBe("2026-11-18");
    expect(f.depense).toBe(28000);
    expect(f.ardoise).toBe(5000);
    expect(f.favoris[0]).toEqual({ nom: "THB", quantite: 5 });
  });

  it("met en tête ceux qui doivent, puis les derniers venus", () => {
    const tri = trierHabitues(fichesHabitues([solo, vola, rado], ventes));
    expect(tri.map((f) => f.client.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("éteint la dette la plus ancienne d'abord", () => {
    const dues = [
      vente({ id: "b", date: "2026-11-18", soldeDu: 3000 }),
      vente({ id: "a", date: "2026-11-02", soldeDu: 2000 }),
    ];
    expect(repartirReglement(dues, 4000)).toEqual([
      { saleId: "a", montant: 2000 },
      { saleId: "b", montant: 2000 },
    ]);
    expect(repartirReglement(dues, 9000).reduce((s, p) => s + p.montant, 0)).toBe(5000);
  });

  it("dit depuis quand il n'est pas venu", () => {
    expect(depuisLe("2026-11-20", "2026-11-20")).toBe("aujourd'hui");
    expect(depuisLe("2026-11-19", "2026-11-20")).toBe("hier");
    expect(depuisLe("2026-11-10", "2026-11-20")).toBe("il y a 10 jours");
    expect(depuisLe(null, "2026-11-20")).toBe("jamais venu");
  });
});

describe("l'équipe", () => {
  it("dit ce que chaque serveur a servi, offert et retiré", () => {
    const b = bilanServeurs([
      ligne({ quantite: 3 }),
      ligne({ note_id: "n2", quantite: 1, offert: true }),
      ligne({ quantite: 1, annulee: true }),
      ligne({ serveur: "Fara", quantite: 10 }),
      ligne({ serveur: null, quantite: 1 }),
      ligne({ genre: "droit_table", product_id: null, serveur: null, prix_unit: 20000 }),
    ]);
    expect(b.map((s) => s.serveur)).toEqual(["Fara", "Rado", SANS_SERVEUR]);
    expect(b[1]).toEqual({
      serveur: "Rado",
      servi: 15000,
      articles: 4,
      tables: 2,
      offerts: 5000,
      retraits: 5000,
      nbRetraits: 1,
    });
  });

  it("dit ce que chaque caissier a encaissé", () => {
    const c = bilanCaissiers([
      vente({ vendeur: "Lova", ticketId: "t1" }),
      vente({ vendeur: "Lova", ticketId: "t1" }),
      vente({ vendeur: "Lova", ticketId: "t2" }),
      vente({ vendeur: "Mamy" }),
    ]);
    expect(c[0]).toEqual({ caissier: "Lova", encaisse: 15000, additions: 2 });
  });
});

describe("le bilan des soirées", () => {
  it("découpe les périodes au soir, à la semaine (lundi) et au mois", () => {
    expect(periodeDe("soir", 1, "2026-11-20")).toMatchObject({
      debut: "2026-11-19",
      libelle: "Hier",
    });
    // Le 20 novembre 2026 est un vendredi.
    expect(periodeDe("semaine", 0, "2026-11-20")).toMatchObject({
      debut: "2026-11-16",
      fin: "2026-11-22",
    });
    expect(periodeDe("mois", 1, "2026-11-20")).toEqual({
      debut: "2026-10-01",
      fin: "2026-10-31",
      libelle: "Octobre 2026",
    });
  });

  it("fait le compte d'une semaine de bar", () => {
    const depense = {
      id: "d",
      numero: "D",
      date: "2026-11-17",
      vendeur: "x",
      type: "Autre dépense",
      montant: 1000,
      note: "",
      impactTresorerieGlobale: -1000,
      categoryId: "dj",
    } as Expense;
    const b = bilanBar({
      ventes: [
        vente({ date: "2026-11-20", quantite: 4, totalVente: 20000, margeTotale: 6000 }),
        vente({ date: "2026-11-13", totalVente: 99999 }), // hors période
        vente({
          date: "2026-11-21",
          productId: "",
          designation: "Droit de table",
          totalVente: 20000,
          margeTotale: 20000,
        }),
      ],
      depenses: [depense],
      periode: periodeDe("semaine", 0, "2026-11-20"),
      rubriqueDe: new Map([["thb", "Bières"]]),
      posteDe: new Map([["dj", "Animation et DJ"]]),
    });
    expect(b).toMatchObject({
      ca: 40000,
      cout: 14000,
      marge: 26000,
      depenses: 1000,
      resultat: 25000,
      droitsDeTable: 20000,
      soirees: 2,
      moyenneParSoiree: 20000,
    });
    expect(b.parSoir).toHaveLength(7);
    expect(b.parJourSemaine[4]).toEqual({ jour: "Vendredi", moyenne: 20000, soirees: 1 });
    expect(b.parRubrique).toEqual([
      { nom: "Bières", ca: 20000 },
      { nom: "Droits de table", ca: 20000 },
    ]);
    expect(b.depensesParPoste).toEqual([{ nom: "Animation et DJ", montant: 1000 }]);
  });
});

describe("les bons de préparation", () => {
  beforeEach(() => localStorage.clear());

  it("envoie à boire au bar et à manger en cuisine", () => {
    expect(posteParDefaut("Bières")).toBe("bar");
    expect(posteParDefaut("Brochettes et grillades")).toBe("cuisine");
    expect(posteParDefaut("Plats")).toBe("cuisine");
    expect(posteParDefaut("Cigarettes")).toBe("aucun");
    expect(posteParDefaut(null)).toBe("bar");
  });

  it("regroupe une commande en un bon par poste", () => {
    const rubriques = new Map([
      ["thb", { id: "bi", nom: "Bières" }],
      ["broch", { id: "gr", nom: "Brochettes et grillades" }],
      ["clope", { id: "ci", nom: "Cigarettes" }],
      ["coca", { id: "so", nom: "Softs et jus" }],
    ]);
    const bons = bonsDeLaCommande(
      [
        { productId: "broch", designation: "Brochette zébu", quantite: 2 },
        { productId: "thb", designation: "THB", quantite: 2 },
        { productId: "thb", designation: "THB", quantite: 1 },
        { productId: "clope", designation: "Boston", quantite: 1 },
        { productId: "coca", designation: "Coca", quantite: 1 },
      ],
      rubriques,
      { so: "cuisine" },
    );
    expect(bons).toEqual([
      { poste: "bar", lignes: [{ designation: "THB", quantite: 3 }] },
      {
        poste: "cuisine",
        lignes: [
          { designation: "Brochette zébu", quantite: 2 },
          { designation: "Coca", quantite: 1 },
        ],
      },
    ]);
  });

  it("retrouve la dernière commande d'une note", () => {
    const tot = "2026-11-20T20:00:00Z";
    const tard = "2026-11-20T21:30:00Z";
    const d = derniereCommande([
      ligne({ cree_le: tot }),
      ligne({ cree_le: tard, designation: "Coca" }),
      ligne({ cree_le: tard, designation: "THB" }),
      ligne({ cree_le: "2026-11-20T22:00:00Z", annulee: true }),
      ligne({ cree_le: "2026-11-20T23:00:00Z", genre: "droit_table" }),
    ]);
    expect(d.map((l) => l.designation)).toEqual(["Coca", "THB"]);
  });

  it("numérote les bons du jour et lit des réglages absents", () => {
    expect(lireReglagesBons("s")).toEqual({ actif: false, largeur: 80, postes: {} });
    expect(prochainNumeroDeBon("s", "2026-11-20")).toBe(1);
    expect(prochainNumeroDeBon("s", "2026-11-20")).toBe(2);
    expect(prochainNumeroDeBon("s", "2026-11-21")).toBe(1);
  });
});

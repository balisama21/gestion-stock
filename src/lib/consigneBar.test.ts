import { describe, expect, it } from "vitest";
import { montantPropose, soldes, type Emballage, type MouvementEmballage } from "./consigneBar";

const bouteille: Emballage = {
  id: "b",
  store_id: "s",
  nom: "Bouteille THB 65 cl",
  consigne: 500,
  actif: true,
  ordre: 0,
};
const casier: Emballage = { ...bouteille, id: "c", nom: "Casier THB", consigne: 3000 };

let n = 0;
const mvt = (p: Partial<MouvementEmballage>): MouvementEmballage => ({
  id: `m${++n}`,
  store_id: "s",
  emballage_id: "b",
  genre: "recu",
  quantite: 1,
  montant: 0,
  note: null,
  cree_le: "2026-11-20T10:00:00Z",
  ...p,
});

describe("la consigne", () => {
  it("tient la dette envers le fournisseur et ce qui est chez les clients", () => {
    const r = soldes(
      [bouteille, casier],
      [
        mvt({ genre: "recu", quantite: 48 }),
        mvt({ genre: "rendu", quantite: 40 }),
        mvt({ genre: "perdu_paye", quantite: 2, montant: 1000 }),
        mvt({ genre: "correction", quantite: -1 }),
        mvt({ genre: "client_emporte", quantite: 3, montant: 1500 }),
        mvt({ genre: "client_rapporte", quantite: 1, montant: 500 }),
        mvt({ emballage_id: "c", genre: "recu", quantite: 4 }),
      ],
    );
    expect(r.map((s) => [s.emballage.id, s.aRendre, s.chezClients, s.consignesGardees])).toEqual([
      ["b", 5, 2, 1000],
      ["c", 4, 0, 0],
    ]);
  });

  it("propose la consigne au client et la perte au fournisseur, rien pour un rendu", () => {
    expect(montantPropose("client_emporte", 3, 500)).toBe(1500);
    expect(montantPropose("perdu_paye", 2, 3000)).toBe(6000);
    expect(montantPropose("rendu", 10, 500)).toBe(0);
  });
});

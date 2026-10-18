import { describe, expect, it } from "vitest";
import { repartirVentesParClient } from "./ventesClients";

const clients = [
  { id: "a", nom: "Rakoto" },
  { id: "b", nom: "Rabe" },
  { id: "c", nom: "Soa" },
  { id: "d", nom: "soa " },
];

const ids = (r: Record<string, { id: string }[]>, c: string) => r[c].map((v) => v.id).sort();

describe("à quel client appartient une vente", () => {
  it("la clé fait foi", () => {
    const r = repartirVentesParClient(clients, [{ id: "v1", clientId: "a" }]);
    expect(ids(r, "a")).toEqual(["v1"]);
  });

  it("une vente liée à A n'apparaît jamais chez B, même avec le nom de B", () => {
    const r = repartirVentesParClient(clients, [{ id: "v1", clientId: "a", clientCredit: "Rabe" }]);
    expect(ids(r, "a")).toEqual(["v1"]);
    expect(ids(r, "b")).toEqual([]);
  });

  it("une ancienne vente sans clé se rattache par le nom, à la casse près", () => {
    const r = repartirVentesParClient(clients, [
      { id: "v1", clientId: null, clientCredit: " rabe" },
    ]);
    expect(ids(r, "b")).toEqual(["v1"]);
  });

  it("un nom porté par deux fiches ne rattache rien", () => {
    const r = repartirVentesParClient(clients, [{ id: "v1", clientId: null, clientCredit: "Soa" }]);
    expect(ids(r, "c")).toEqual([]);
    expect(ids(r, "d")).toEqual([]);
  });

  it("une vente sans client ne va nulle part", () => {
    const r = repartirVentesParClient(clients, [{ id: "v1" }]);
    expect(Object.values(r).flat()).toEqual([]);
  });
});

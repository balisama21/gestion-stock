import { describe, expect, it } from "vitest";
import {
  compterNonVues,
  estNonLue,
  fusionnerEtats,
  type EtatNotification,
} from "./notificationsLues";
import { destinationDe } from "./routageNotifications";

const etats = (e: [string, EtatNotification][]) => new Map(e);

describe("la pastille de la cloche", () => {
  const notifs = [{ id: "a" }, { id: "b" }, { id: "c", deMoi: true }, { id: "d" }];

  it("compte ce qui n'a été ni vu ni lu, sans ses propres gestes", () => {
    expect(compterNonVues(notifs, etats([]))).toBe(3);
    expect(
      compterNonVues(
        notifs,
        etats([
          ["a", "vu"],
          ["b", "lu"],
        ]),
      ),
    ).toBe(1);
  });

  it("retombe à zéro dès que tout a été vu, même non ouvert", () => {
    const vues = etats([
      ["a", "vu"],
      ["b", "vu"],
      ["d", "vu"],
    ]);
    expect(compterNonVues(notifs, vues)).toBe(0);
    // … mais ce qui n'a pas été ouvert reste à lire.
    expect(notifs.filter((n) => estNonLue(n, vues)).map((n) => n.id)).toEqual(["a", "b", "d"]);
  });

  it("« lu » l'emporte toujours sur « vu » à la fusion", () => {
    const r = fusionnerEtats(
      etats([
        ["a", "lu"],
        ["b", "vu"],
      ]),
      etats([
        ["a", "vu"],
        ["b", "lu"],
      ]),
    );
    expect(r.get("a")).toBe("lu");
    expect(r.get("b")).toBe("lu");
  });
});

describe("où mène une notification", () => {
  it("ouvre la fiche quand elle désigne un enregistrement, recherche vidée", () => {
    expect(destinationDe({ onglet: "ventes", cibleId: "t1", reference: "V025" })).toEqual({
      onglet: "ventes",
      texte: "",
      id: "t1",
    });
  });

  it("pose le filtre quand elle parle d'un ensemble", () => {
    expect(destinationDe({ onglet: "produits", filtre: "Alerte" })).toEqual({
      onglet: "produits",
      texte: "",
      filtre: "Alerte",
    });
  });

  it("sans fiche possible, garde la référence ; sans écran, ne mène nulle part", () => {
    expect(destinationDe({ onglet: "paiements", cibleId: "p1", reference: "V002" })).toEqual({
      onglet: "paiements",
      texte: "V002",
    });
    expect(destinationDe({ onglet: undefined })).toBeNull();
  });
});

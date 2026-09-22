import { describe, expect, it } from "vitest";
import {
  cleDePersonne,
  listerLesPersonnes,
  personneParNom,
  type PersonneExterne,
} from "./personnes";

const externe = (p: Partial<PersonneExterne> & { id: string; nom: string }): PersonneExterne =>
  ({
    actif: true,
    created_at: "",
    created_by: null,
    email: null,
    notes: null,
    role: null,
    store_id: "b",
    taux_commission: null,
    telephone: null,
    updated_at: "",
    user_id: null,
    ...p,
  }) as PersonneExterne;

describe("la liste des personnes qu'on peut désigner", () => {
  it("met l'équipe en premier, puis les fiches, puis les noms hérités", () => {
    const l = listerLesPersonnes({
      membres: [{ id: "u1", nom: "Mamy" }],
      externes: [externe({ id: "e1", nom: "Lanto" })],
      nomsHerites: ["Kanto"],
    });
    expect(l.map((p) => p.nom)).toEqual(["Mamy", "Lanto", "Kanto"]);
    expect(l.map((p) => p.nature)).toEqual(["membre", "externe", "heritee"]);
  });

  /**
   * Le cas qui motive tout le filtre : « Lanto » est à la fois une fiche
   * externe et un nom écrit dans d'anciennes ventes. Sans dédoublonnage,
   * il apparaîtrait deux fois dans la liste, une fois comme fiche et une
   * fois comme souvenir, et personne ne saurait laquelle choisir.
   */
  it("ne montre pas deux fois quelqu'un qui a une fiche ET un passé", () => {
    const l = listerLesPersonnes({
      membres: [],
      externes: [externe({ id: "e1", nom: "Lanto" })],
      nomsHerites: ["lanto", "LANTO"],
    });
    expect(l).toHaveLength(1);
    expect(l[0].nature).toBe("externe");
    expect(l[0].personneId).toBe("e1");
  });

  it("laisse l'équipe l'emporter sur une fiche du même nom", () => {
    const l = listerLesPersonnes({
      membres: [{ id: "u1", nom: "Lanto" }],
      externes: [externe({ id: "e1", nom: "Lanto" })],
      nomsHerites: [],
    });
    expect(l).toHaveLength(1);
    expect(l[0].nature).toBe("membre");
    expect(l[0].membreId).toBe("u1");
  });

  it("cache les fiches archivées", () => {
    const l = listerLesPersonnes({
      membres: [],
      externes: [externe({ id: "e1", nom: "Ancien", actif: false })],
      nomsHerites: [],
    });
    expect(l).toHaveLength(0);
  });

  it("ignore les noms vides venus d'anciennes lignes", () => {
    const l = listerLesPersonnes({ membres: [], externes: [], nomsHerites: ["", "   "] });
    expect(l).toHaveLength(0);
  });

  it("montre le rôle, sinon le téléphone, sinon « externe »", () => {
    const [avecRole, avecTel, sansRien] = listerLesPersonnes({
      membres: [],
      externes: [
        externe({ id: "1", nom: "A", role: "chauffeur", telephone: "033" }),
        externe({ id: "2", nom: "B", telephone: "034" }),
        externe({ id: "3", nom: "C" }),
      ],
      nomsHerites: [],
    });
    expect(avecRole.mention).toBe("chauffeur");
    expect(avecTel.mention).toBe("034");
    expect(sansRien.mention).toBe("externe");
  });
});

describe("retrouver quelqu'un depuis le nom écrit sur une ligne", () => {
  const personnes = listerLesPersonnes({
    membres: [{ id: "u1", nom: "Mamy Herinatenaina" }],
    externes: [externe({ id: "e1", nom: "Lanto" })],
    nomsHerites: [],
  });

  it("pardonne la casse et les accents", () => {
    expect(personneParNom(personnes, "  LANTO ")?.personneId).toBe("e1");
  });

  it("ne rend rien pour un nom inconnu", () => {
    expect(personneParNom(personnes, "Quelqu'un d'autre")).toBeUndefined();
  });

  it("ne rend rien pour un nom vide", () => {
    expect(personneParNom(personnes, "")).toBeUndefined();
  });
});

describe("la clé d'option", () => {
  it("distingue un compte, une fiche et un simple nom", () => {
    expect(cleDePersonne({ membreId: "u1", nom: "Mamy" })).toBe("membre:u1");
    expect(cleDePersonne({ personneId: "e1", nom: "Lanto" })).toBe("externe:e1");
    expect(cleDePersonne({ nom: "Kanto" })).toBe("nom:kanto");
  });
});

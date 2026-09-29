import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AvatarPersonne } from "./AvatarPersonne";
import { traitsDe } from "../../lib/avatarPersonne";

afterEach(cleanup);

describe("l'avatar illustré d'une personne", () => {
  it("donne toujours le même visage au même nom, accents et casse compris", () => {
    expect(traitsDe("Héry Rabe")).toEqual(traitsDe("  hery rabe "));
  });

  it("ne donne pas le même visage à tout le monde", () => {
    const noms = ["Rindra", "Andry", "Lova", "Hery", "Lanto", "Mamy", "Fara", "Tahina"];
    const visages = new Set(noms.map((n) => JSON.stringify(traitsDe(n))));
    expect(visages.size).toBe(noms.length);
  });

  it("dessine un buste à la taille demandée", () => {
    const { container } = render(<AvatarPersonne nom="Lova Nirina" taille={40} />);
    const avatar = container.querySelector(".avatar-personne") as HTMLElement;
    expect(avatar.style.width).toBe("40px");
    expect(avatar.querySelector("ellipse")).toBeTruthy();
  });

  it("montre une silhouette neutre quand on ne connaît pas le client", () => {
    const { container } = render(<AvatarPersonne nom="  " />);
    expect(container.querySelector(".avatar-personne svg")).toBeTruthy();
    expect(container.querySelector("ellipse")).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Banniere } from "./Tn";

/**
 * UNE BANNIÈRE À SCÈNE DÉTOURÉE
 *
 * Avec une scène, la bannière pose l'image détourée à côté du titre :
 * ni photo plein cadre, ni voile.
 */
afterEach(cleanup);

const SCENE = {
  src: "/illustrations/ventes.webp",
  alt: "Au comptoir.",
  largeur: 1100,
  hauteur: 778,
};

describe("Banniere", () => {
  it("pose la scène détourée à la place de la photo", () => {
    render(
      <Banniere
        id="ventes-titre"
        image="/repli.webp"
        photo={{ id: "123", cadrage: "50% 50%" }}
        scene={SCENE}
        titre="Ventes"
      />,
    );
    expect(screen.getByRole("heading", { name: "Ventes" }).id).toBe("ventes-titre");
    expect(screen.getByRole("img", { name: "Au comptoir." }).getAttribute("src")).toBe(SCENE.src);
    expect(document.querySelector(".bn-photo")).toBeNull();
    expect(document.querySelector(".banner.full")).toBeNull();
  });

  it("sans scène, garde la photo plein cadre", () => {
    render(
      <Banniere
        id="argent-titre"
        image="/repli.webp"
        photo={{ id: "123", cadrage: "50% 50%" }}
        titre="L'argent"
      />,
    );
    expect(document.querySelector(".banner.full.photo .bn-photo")).not.toBeNull();
  });
});

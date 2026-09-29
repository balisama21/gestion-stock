import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AvatarInitiale } from "./AvatarInitiale";
import { teinteAvatar } from "../../lib/teintes";
import { fondDominant, pastelDe } from "../../lib/vignetteDetouree";

afterEach(cleanup);

describe("l'avatar à initiale", () => {
  it("montre l'initiale en majuscule, sur la couleur du nom", () => {
    const { container } = render(<AvatarInitiale nom="rindra Volana" taille={40} />);
    const pastille = container.querySelector(".avatar-initiale") as HTMLElement;
    expect(pastille.textContent).toBe("R");
    expect(pastille.style.width).toBe("40px");
    expect(pastille.style.background).not.toBe("");
  });

  it("garde la même couleur d'un écran à l'autre, accents et casse compris", () => {
    expect(teinteAvatar("Héry")).toBe(teinteAvatar("  hery "));
    expect(teinteAvatar("Andry Rakoto")).toBe(teinteAvatar("Andry Rakoto"));
  });

  it("ne rend jamais une pastille vide", () => {
    const { container } = render(<AvatarInitiale nom="  " />);
    expect(container.textContent).toBe("?");
  });
});

describe("le fond d'une vignette produit", () => {
  const pixels = (rgb: [number, number, number], n = 50) => {
    const d = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) d.set([...rgb, 255], i * 4);
    return d;
  };

  it("prend la teinte du produit, éclaircie", () => {
    // Une huile ambrée : un fond chaud et pâle, pas un gris.
    const fond = fondDominant(pixels([200, 130, 40]));
    const [, t, , l] = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(fond) ?? [];
    expect(Number(t)).toBeGreaterThan(20);
    expect(Number(t)).toBeLessThan(50);
    expect(Number(l)).toBeGreaterThanOrEqual(88);
  });

  it("reste gris clair pour un produit blanc", () => {
    expect(fondDominant(pixels([250, 250, 250]))).toMatch(/^hsl\(\d+ (1[0-2]|[0-9])% 9\d%\)$/);
  });

  it("donne à un produit sans photo un fond stable, tiré de son nom", () => {
    expect(pastelDe("Savon artisanal")).toEqual(pastelDe("savon artisanal"));
  });
});

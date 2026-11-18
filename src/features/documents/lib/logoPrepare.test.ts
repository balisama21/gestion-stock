import { describe, expect, it } from "vitest";
import { cadreUtile } from "./logoPrepare";

/** Une image de `l` × `h`, vide, où l'on peint des pixels pleins. */
function image(l: number, h: number, pleins: [number, number][], fond: "transparent" | "blanc") {
  const px = new Uint8ClampedArray(l * h * 4);
  for (let i = 0; i < l * h; i++) {
    if (fond === "blanc") px.set([255, 255, 255, 255], i * 4);
  }
  for (const [x, y] of pleins) px.set([20, 40, 90, 255], (y * l + x) * 4);
  return px;
}

describe("le cadre utile d'un logo", () => {
  it("rogne la marge transparente autour du dessin", () => {
    const px = image(
      100,
      100,
      [
        [40, 30],
        [59, 69],
      ],
      "transparent",
    );
    const c = cadreUtile(px, 100, 100)!;
    // Le dessin va de (40,30) à (59,69), plus un liseré de 2 % de 40 px.
    expect(c).toEqual({ x: 39, y: 29, l: 22, h: 42 });
  });

  it("rogne aussi un fond blanc, celui d'une photo ou d'un JPEG", () => {
    const px = image(
      200,
      50,
      [
        [10, 10],
        [189, 39],
      ],
      "blanc",
    );
    const c = cadreUtile(px, 200, 50)!;
    expect(c.x).toBeLessThanOrEqual(10);
    expect(c.x + c.l).toBeGreaterThanOrEqual(190);
    expect(c.y).toBeLessThanOrEqual(10);
  });

  it("laisse une image vide telle quelle", () => {
    expect(cadreUtile(image(10, 10, [], "transparent"), 10, 10)).toBeNull();
  });
});

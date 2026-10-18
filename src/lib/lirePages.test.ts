import { describe, expect, it } from "vitest";
import { lireToutesLesPages } from "./lirePages";

/** Une « table » de n lignes servie par tranches, comme PostgREST. */
function table(n: number) {
  const lignes = Array.from({ length: n }, (_, i) => ({ id: i }));
  const appels: [number, number][] = [];
  const lire = async (debut: number, fin: number) => {
    appels.push([debut, fin]);
    return { data: lignes.slice(debut, fin + 1), error: null };
  };
  return { lire, appels };
}

describe("lireToutesLesPages", () => {
  it("lit au-delà de la première tranche", async () => {
    const t = table(2500);
    const r = await lireToutesLesPages(t.lire, 1000);
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(2500);
    expect(t.appels).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("s'arrête après une tranche incomplète, même vide", async () => {
    const t = table(1000);
    const r = await lireToutesLesPages(t.lire, 1000);
    expect(r.data).toHaveLength(1000);
    expect(t.appels).toHaveLength(2);
  });

  it("rend l'erreur sans données partielles", async () => {
    let n = 0;
    const r = await lireToutesLesPages(async () => {
      n++;
      return n === 1
        ? { data: Array.from({ length: 10 }, (_, i) => ({ id: i })), error: null }
        : { data: null, error: { message: "refusé" } };
    }, 10);
    expect(r.data).toBeNull();
    expect(r.error?.message).toBe("refusé");
  });
});

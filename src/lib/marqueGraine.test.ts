// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://kinvest.mg/" }
import { afterEach, describe, expect, it } from "vitest";
import {
  CLE_CACHE_MARQUE,
  marqueDepuisLigne,
  scriptMarqueAvantRendu,
  type LigneMarquePublique,
} from "./marque";

const ligne: LigneMarquePublique = {
  app_name: "Kinvest</script>",
  short_name: null,
  tagline: null,
  page_title: null,
  logo_url: null,
  favicon_url: null,
  splash_logo_url: null,
  login_image_url: null,
  login_title: null,
  login_subtitle: null,
  primary_color: null,
  primary_color_dark: null,
  splash_background: null,
};

afterEach(() => {
  document.getElementById("tantana-marque")?.remove();
  localStorage.clear();
});

describe("script du <head> amorcé par le serveur", () => {
  it("applique la marque du serveur dès la première visite et l'inscrit au cache", () => {
    const script = scriptMarqueAvantRendu(marqueDepuisLigne(ligne));
    expect(script).not.toContain("</script>");
    new Function(script)();
    expect(document.title).toBe("Kinvest</script>");
    const cache = JSON.parse(localStorage.getItem(CLE_CACHE_MARQUE) ?? "null");
    expect(cache.hote).toBe("kinvest.mg");
    expect(cache.marque.nom).toBe("Kinvest</script>");
    expect((window as { __marqueRendu?: unknown }).__marqueRendu).toEqual(cache.marque);
  });
});

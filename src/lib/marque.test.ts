// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  CLE_CACHE_MARQUE,
  appliquerMarqueAuDocument,
  estHoteParDefaut,
  marqueDepuisLigne,
  normaliserHote,
  scriptMarqueAvantRendu,
  type LigneMarquePublique,
} from "./marque";

const ligne: LigneMarquePublique = {
  app_name: 'Kin"vest</style>',
  short_name: null,
  tagline: "Gérer simplement",
  page_title: null,
  logo_url: "https://cdn.kinvest.mg/logo.png",
  favicon_url: 'javascript:alert(1)")',
  splash_logo_url: null,
  login_image_url: null,
  login_title: null,
  login_subtitle: null,
  primary_color: "#1D4ED8",
  primary_color_dark: "rouge",
  splash_background: null,
};

afterEach(() => {
  document.getElementById("tantana-marque")?.remove();
  document.documentElement.removeAttribute("data-marque");
  localStorage.clear();
});

describe("hôtes", () => {
  it("normalise port, casse, point final et www", () => {
    expect(normaliserHote(" WWW.Kinvest.mg:8080")).toBe("kinvest.mg");
    expect(normaliserHote("kinvest.mg.")).toBe("kinvest.mg");
  });

  it("reconnaît les hôtes qui gardent Tantana", () => {
    expect(estHoteParDefaut("localhost")).toBe(true);
    expect(estHoteParDefaut("127.0.0.1")).toBe(true);
    expect(estHoteParDefaut("deploy-preview-12--tantana.netlify.app")).toBe(true);
    expect(estHoteParDefaut("kinvest.mg")).toBe(false);
  });
});

describe("marqueDepuisLigne", () => {
  it("écarte URL et couleurs non sûres", () => {
    const m = marqueDepuisLigne(ligne);
    expect(m.faviconUrl).toBe("https://cdn.kinvest.mg/logo.png");
    expect(m.couleurPrimaire).toBe("#1D4ED8");
    expect(m.couleurPrimaireSombre).toBeNull();
    expect(m.nomCourt).toBe(ligne.app_name);
    expect(m.parDefaut).toBe(false);
  });

  it("sans image fournie, ne retombe pas sur le logo de Tantana", () => {
    const m = marqueDepuisLigne({ ...ligne, logo_url: null, favicon_url: null });
    expect(m.logoUrl).toBe("");
    expect(m.faviconUrl).toMatch(/^\/marque-icone-any-192\.png\?v=/);
    expect(m.iconeAppleUrl).toMatch(/^\/marque-icone-apple-180\.png\?v=/);
  });

  it("avec un logo, l'icône d'écran d'accueil est ce logo", () => {
    expect(marqueDepuisLigne(ligne).iconeAppleUrl).toBe("https://cdn.kinvest.mg/logo.png");
  });
});

describe("application au document", () => {
  it("pose titre, couleurs et variables sans pouvoir fermer la balise style", () => {
    appliquerMarqueAuDocument(marqueDepuisLigne(ligne));
    const style = document.getElementById("tantana-marque");
    expect(document.title).toBe(ligne.app_name);
    expect(document.documentElement.dataset.marque).toBe("client");
    expect(style?.textContent).toContain("--primary:#1D4ED8");
    expect(style?.textContent).not.toContain("</style>");
    expect(style?.textContent).not.toContain('Kin"');
  });

  it("pointe le manifeste vers celui de la marque", () => {
    appliquerMarqueAuDocument(marqueDepuisLigne(ligne));
    const lien = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    expect(lien?.getAttribute("href")).toBe("/marque.webmanifest");
    lien?.remove();
  });

  it("sans logo, le splash n'affiche aucune image", () => {
    appliquerMarqueAuDocument(marqueDepuisLigne({ ...ligne, logo_url: null }));
    expect(document.getElementById("tantana-marque")?.textContent).toContain("--marque-logo:none");
  });

  it("rétablit Tantana avec null", () => {
    appliquerMarqueAuDocument(marqueDepuisLigne(ligne));
    appliquerMarqueAuDocument(null);
    expect(document.getElementById("tantana-marque")).toBeNull();
    expect(document.documentElement.hasAttribute("data-marque")).toBe(false);
  });

  it("le script du <head> n'agit pas sur localhost, même avec un cache", () => {
    localStorage.setItem(
      CLE_CACHE_MARQUE,
      JSON.stringify({ hote: "localhost", marque: marqueDepuisLigne(ligne), t: Date.now() }),
    );
    new Function(scriptMarqueAvantRendu())();
    expect(document.getElementById("tantana-marque")).toBeNull();
  });
});

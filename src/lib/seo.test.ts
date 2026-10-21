// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MOT_OFFRE } from "./motsOffre";
import { MARQUE_PAR_DEFAUT, marqueDepuisLigne, titreDePage, type Marque } from "./marque";
import {
  descriptionDe,
  donneesStructurees,
  hoteIndexable,
  imageDePartage,
  lienCanonique,
  metasDeReferencement,
  robotsTxt,
  sitemapXml,
  estRobot,
} from "./seo";

const kinvest: Marque = marqueDepuisLigne({
  app_name: "Kinvest",
  short_name: "Kinvest",
  tagline: null,
  page_title: null,
  logo_url: "https://mg-kinvest.com/marques/kinvest/logo-k-512.png",
  favicon_url: null,
  splash_logo_url: null,
  login_image_url: null,
  login_title: null,
  login_subtitle: null,
  primary_color: "#0e7c80",
  primary_color_dark: null,
  splash_background: null,
  landing: {
    titre: "Emballages et packaging, avec ou sans personnalisation",
    sousTitre: "À Moroni, K Invests fournit les emballages de vos produits.",
    photo: "1769355104335-acef3aa4c9b6",
    catalogue: {
      titre: "Catalogue des produits",
      elements: [
        { titre: "Doypacks", texte: "Kraft à fenêtre.", image: "1780660231448-7f0aa4d236e9" },
      ],
    },
    contact: {
      telephones: ["+269 334 03 57", "+269 453 87 24"],
      emails: ["infos.services@kinvestgroup.com"],
      adresse: "Moroni, Union des Comores",
    },
  },
});

const contenu = (metas: ReturnType<typeof metasDeReferencement>, cle: string) =>
  metas.find((m) => ("name" in m ? m.name : m.property) === cle)?.content;

describe("référencement par domaine", () => {
  it("Kinvest se présente sous sa propre identité, sur son domaine", () => {
    const titre = titreDePage(kinvest, "titre Tantana");
    expect(titre).toBe("Kinvest — Emballages et packaging, avec ou sans personnalisation");
    const metas = metasDeReferencement(kinvest, "www.mg-kinvest.com", titre);
    expect(contenu(metas, "description")).toMatch(/^À Moroni, K Invests/);
    expect(contenu(metas, "og:site_name")).toBe("Kinvest");
    expect(contenu(metas, "robots")).toMatch(/^index, follow/);
    expect(contenu(metas, "og:image")).toMatch(/^https:\/\/images\.unsplash\.com\/.*&h=630$/);
    expect(contenu(metas, "twitter:card")).toBe("summary_large_image");
    expect(lienCanonique(kinvest, "www.mg-kinvest.com")).toBe("https://mg-kinvest.com/");
    expect(JSON.stringify(metas)).not.toMatch(/tantana/i);
    // Ni essai, ni abonnement, ni tarif du logiciel chez un client.
    expect(JSON.stringify(metas)).not.toMatch(MOT_OFFRE);
    expect(JSON.stringify(donneesStructurees(kinvest, "mg-kinvest.com"))).not.toMatch(MOT_OFFRE);
  });

  it("Tantana garde les siennes, et un aperçu Netlify renvoie au vrai site sans être indexé", () => {
    const metas = metasDeReferencement(MARQUE_PAR_DEFAUT, "tantana-suite.com", "T");
    expect(contenu(metas, "robots")).toMatch(/^index/);
    expect(contenu(metas, "og:image")).toBe("https://tantana-suite.com/icon-512.png");
    expect(descriptionDe(MARQUE_PAR_DEFAUT)).toMatch(/gestion/);
    expect(lienCanonique(MARQUE_PAR_DEFAUT, "deploy-preview-3--x.netlify.app")).toBe(
      "https://tantana-suite.com/",
    );
    expect(hoteIndexable("deploy-preview-3--x.netlify.app", MARQUE_PAR_DEFAUT)).toBe(false);
    expect(hoteIndexable("localhost", null)).toBe(false);
    expect(hoteIndexable("www.tantana-suite.com", null)).toBe(true);
  });

  it("un domaine client dont la marque est inconnue n'est jamais indexé aux couleurs de Tantana", () => {
    expect(hoteIndexable("mg-kinvest.com", MARQUE_PAR_DEFAUT)).toBe(false);
    expect(hoteIndexable("mg-kinvest.com", null)).toBe(false);
    expect(robotsTxt("mg-kinvest.com", null)).toBe("User-agent: *\nDisallow: /\n");
    expect(sitemapXml("mg-kinvest.com", null)).toBeNull();
  });

  it("robots.txt et sitemap annoncent le domaine visité", () => {
    expect(robotsTxt("mg-kinvest.com", kinvest)).toContain(
      "Sitemap: https://mg-kinvest.com/sitemap.xml",
    );
    expect(robotsTxt("tantana-suite.com", null)).toContain(
      "Sitemap: https://tantana-suite.com/sitemap.xml",
    );
    expect(sitemapXml("mg-kinvest.com", kinvest)).toContain("<loc>https://mg-kinvest.com/</loc>");
    expect(sitemapXml("tantana-suite.netlify.app", null)).toBeNull();
  });

  it("données structurées : un commerce à Moroni pour Kinvest, un logiciel pour Tantana", () => {
    const k = donneesStructurees(kinvest, "mg-kinvest.com") as {
      "@graph": Record<string, unknown>[];
    };
    const commerce = k["@graph"][0];
    expect(commerce["@type"]).toBe("LocalBusiness");
    expect(commerce.url).toBe("https://mg-kinvest.com/");
    expect(commerce.address).toBe("Moroni, Union des Comores");
    expect(commerce.telephone).toBe("+269 334 03 57");
    expect(JSON.stringify(k)).not.toMatch(/tantana/i);

    const t = donneesStructurees(MARQUE_PAR_DEFAUT, "tantana-suite.com") as {
      "@graph": Record<string, unknown>[];
    };
    expect(t["@graph"].map((n) => n["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
    ]);
  });

  it("image de partage : le logo, en petit, faute de photo", () => {
    const sansPhoto = { ...kinvest, landing: null };
    expect(imageDePartage(sansPhoto, "https://mg-kinvest.com")).toEqual({
      url: "https://mg-kinvest.com/marques/kinvest/logo-k-512.png",
      alt: "Kinvest",
      grande: false,
    });
    expect(titreDePage(sansPhoto, "x")).toBe("Kinvest");
  });

  it("reconnaît les robots d'indexation et d'aperçu", () => {
    expect(
      estRobot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
    ).toBe(true);
    expect(estRobot("facebookexternalhit/1.1")).toBe(true);
    expect(estRobot("WhatsApp/2.23.20.0")).toBe(true);
    expect(estRobot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36")).toBe(
      false,
    );
    expect(estRobot(null)).toBe(false);
  });
});

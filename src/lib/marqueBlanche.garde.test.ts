import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde de la marque blanche : sur un domaine client, rien ne doit dire
 * « Tantana ». Le nom passe par `useMarque()` / `marqueCourante()`.
 * Seuls les fichiers ci-dessous le lisent en dur, parce qu'ils ne
 * s'affichent que pour Tantana ou lui servent de valeur par défaut.
 */

const RACINE = join(process.cwd(), "src");

/** Peuvent importer APP_NAME / APP_SHORT_NAME / APP_TAGLINE. */
const LECTEURS_AUTORISES = new Set([
  "lib/appConfig.ts",
  "lib/marque.ts",
  "utils/exportExcel.ts", // valeur par défaut du paramètre
  "routes/index.tsx", // titre passé à titreDePage, Tantana seulement
  "components/shared/AppLoader.tsx", // variante masquée hors Tantana
  "components/shared/MotSymbole.tsx", // branche parDefaut
  "components/landing/PanneauMarque.tsx", // vitrine
  "components/landing/RegistreModules.tsx", // vitrine
  "components/landing/TicketImprime.tsx", // vitrine
]);

/** Peuvent écrire le mot en clair. */
const MOT_AUTORISE = new Set(["lib/appConfig.ts", "components/shared/MotSymbole.tsx"]);

function sources(dossier: string, liste: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sources(chemin, liste);
    else if (/\.(ts|tsx)$/.test(nom) && !/\.test\.|routeTree\.gen/.test(nom)) liste.push(chemin);
  }
  return liste;
}

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const fichiers = sources(RACINE).map((chemin) => ({
  rel: relative(RACINE, chemin).split(sep).join("/"),
  code: sansCommentaires(readFileSync(chemin, "utf8")),
}));

describe("marque blanche — garde", () => {
  it("n'écrit « Tantana » en clair que là où c'est prévu", () => {
    // Identifiants techniques exclus : clés de stockage « tantana.x »,
    // ids « tantana-x », noms de variables comme `titreTantana`.
    const mot = /(?<![A-Za-z])tantana(?![.\-A-Za-z])/i;
    const fautifs = fichiers.filter((f) => !MOT_AUTORISE.has(f.rel) && mot.test(f.code));
    expect(fautifs.map((f) => f.rel)).toEqual([]);
  });

  it("ne lit le nom par défaut que dans les fichiers prévus", () => {
    const lecture = /\bAPP_(NAME|SHORT_NAME|TAGLINE)\b/;
    const fautifs = fichiers.filter((f) => !LECTEURS_AUTORISES.has(f.rel) && lecture.test(f.code));
    expect(fautifs.map((f) => f.rel)).toEqual([]);
  });
});

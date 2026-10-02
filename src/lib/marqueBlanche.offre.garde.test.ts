import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ficheAide } from "./aide";
import { MOT_OFFRE } from "./motsOffre";

/**
 * Garde de l'offre : sur un domaine client, ni essai, ni gratuité, ni
 * abonnement, ni tarif, ni invitation à créer sa boutique. Le texte visible
 * (JSX et chaînes) qui en parle n'existe que dans les fichiers ci-dessous,
 * chacun pour la raison donnée. Les écrans d'un domaine client sont en plus
 * rendus pour de vrai dans `components/marqueCliente.offre.test.tsx`.
 */

const AUTORISES: Record<string, string> = {
  "components/landing/SectionTarif.tsx": "vitrine Tantana seulement",
  "components/landing/SectionQuestions.tsx": "vitrine Tantana seulement",
  "components/settings/BillingSection.tsx": "onglet masqué pour une boutique de marque",
  "components/settings/SettingsLayout.tsx": "onglet Abonnement filtré par sansAbonnement",
  "components/StoreLockedScreen.tsx": "une boutique de marque n'est jamais verrouillée",
  "components/ParametresView.tsx": "génération de codes, dans l'onglet Abonnement",
  "components/AuthPage.tsx": "encadré d'essai et activation sous `vitrine`",
  "components/CreateStoreOnboarding.tsx": "création réservée aux propriétaires listés",
  "components/Header.tsx": "textes conditionnés par marque_id / accesMarque",
  "lib/activite.ts": "échéances non transmises pour une boutique de marque",
  "lib/aide.ts": "question marquée `offre`, filtrée hors Tantana",
  "hooks/useAbonnementAlertesStock.ts": "message conditionné par la marque",
  "hooks/useReglagesAlertesStock.ts": "message conditionné par la marque",
  // Vocabulaire métier, sans rapport avec l'offre du logiciel.
  "components/PrestatairesView.tsx": "tarif d'une prestation",
  "lib/permissions.ts": "module « Prestations et tarifs »",
  "components/settings/IdentiteDocuments.tsx": "licence professionnelle (RCS, agrément)",
};

const RACINE = join(process.cwd(), "src");

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

/** Texte susceptible d'être affiché : contenu JSX et chaînes. */
const textesVisibles = (code: string): string[] => [
  ...[...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ...[...code.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]),
];

describe("marque blanche — garde de l'offre", () => {
  it("ne parle d'essai, de gratuité, d'abonnement ou de tarif que là où c'est prévu", () => {
    const fautifs = sources(RACINE)
      .map((chemin) => ({
        rel: relative(RACINE, chemin).split(sep).join("/"),
        code: sansCommentaires(readFileSync(chemin, "utf8")),
      }))
      .filter((f) => !(f.rel in AUTORISES) && textesVisibles(f.code).some((t) => MOT_OFFRE.test(t)))
      .map((f) => f.rel);
    expect(fautifs).toEqual([]);
  });

  it("l'aide d'un domaine client ne parle jamais de l'offre", () => {
    const ecrans = ["general", "dashboard", "ventes", "produits", "parametres", "inconnu"];
    for (const ecran of ecrans) {
      expect(JSON.stringify(ficheAide(ecran, "fr", true))).not.toMatch(MOT_OFFRE);
    }
    expect(JSON.stringify(ficheAide("general", "fr", false))).toMatch(MOT_OFFRE);
  });
});

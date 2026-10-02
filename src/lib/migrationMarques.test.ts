import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Relecture automatique de M2 et du script de données Kinvest : les droits
 * de propriétaire de marque suivent le compte (user_id), jamais l'e-mail.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const M2 = lire("supabase/migrations/20261001110000_marques_boutiques_etiquetees.sql");
const DONNEES = lire("supabase/donnees/20261001_kinvest_proprietaires_et_etiquetage.sql");
const RETOUR = lire("supabase/retours-arriere/20261001110000_marques_boutiques_etiquetees.sql");

const sansCommentaires = (sql: string) => sql.replace(/--.*$/gm, "");

/** Corps d'une fonction créée dans M2. */
function corps(nom: string): string {
  const debut = M2.indexOf(`FUNCTION public.${nom}(`);
  expect(debut, nom).toBeGreaterThan(-1);
  const ouverture = M2.indexOf("AS $", debut);
  const delimiteur = M2.slice(ouverture + 3).match(/^\$\w*\$/)![0];
  const fin = M2.indexOf(delimiteur, ouverture + 3 + delimiteur.length);
  return sansCommentaires(M2.slice(debut, fin + delimiteur.length));
}

describe("M2 — liste des propriétaires par compte", () => {
  it("indexe la liste par user_id, lié à auth.users", () => {
    const table = sansCommentaires(
      M2.slice(
        M2.indexOf("CREATE TABLE public.proprietaires_de_marque"),
        M2.indexOf(");", M2.indexOf("CREATE TABLE public.proprietaires_de_marque")),
      ),
    );
    expect(table).toMatch(/user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(table).toMatch(/PRIMARY KEY \(marque_id, user_id\)/);
    expect(table).not.toMatch(/email[^\n]*NOT NULL/);
  });

  it("décide sur auth.uid(), sans lire l'e-mail", () => {
    const controle = corps("est_proprietaire_de_marque");
    expect(controle).toMatch(/p\.user_id = auth\.uid\(\)/);
    expect(controle).not.toMatch(/email/i);
  });

  it("toutes les RPC de marque passent par ce contrôle", () => {
    expect(corps("acces_a_la_marque")).toMatch(/est_proprietaire_de_marque\(/);
    expect(corps("ouvrir_boutique_de_marque")).toMatch(/est_proprietaire_de_marque\(/);
    expect(corps("copy_store")).toMatch(/est_proprietaire_de_marque\(/);
  });

  it("aucune politique d'écriture sur la liste", () => {
    const politiques = [...M2.matchAll(/CREATE POLICY[\s\S]*?;/g)]
      .map((m) => m[0])
      .filter((p) => p.includes("proprietaires_de_marque"));
    expect(politiques).toHaveLength(1);
    expect(politiques[0]).toMatch(/FOR SELECT/);
  });

  it("chaque fonction SECURITY DEFINER fixe son search_path", () => {
    const definer = [...M2.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*?AS \$/g)]
      .filter((m) => /SECURITY DEFINER/.test(m[0]))
      .map((m) => m[1]);
    expect(definer.length).toBeGreaterThan(5);
    for (const nom of definer) expect(corps(nom), nom).toMatch(/SET search_path/);
  });
});

describe("fichiers SQL bien formés", () => {
  it("chaque corps de fonction ouvert est refermé par le même délimiteur", () => {
    const fichiers = {
      M1: lire("supabase/migrations/20261001100000_invitations_email_du_compte.sql"),
      M2,
      RETOUR_M1: lire("supabase/retours-arriere/20261001100000_invitations_email_du_compte.sql"),
      RETOUR,
    };
    for (const [nom, sql] of Object.entries(fichiers)) {
      const ouverts = [...sql.matchAll(/\bAS (\$\w*\$)\s*$/gm)].map((m) => m[1]);
      const fermes = [...sql.matchAll(/^(\$\w*\$);\s*$/gm)].map((m) => m[1]);
      expect(ouverts.length, nom).toBeGreaterThan(0);
      expect(fermes, nom).toEqual(ouverts);
    }
  });
});

describe("script de données Kinvest", () => {
  const code = sansCommentaires(DONNEES);

  it("n'inscrit que des comptes existants, par user_id", () => {
    expect(code).toMatch(
      /INSERT INTO public\.proprietaires_de_marque \(marque_id, user_id, email\)/,
    );
    expect(code).toMatch(/FROM auth\.users u/);
    expect(code).toMatch(/u\.deleted_at IS NULL/);
    expect(code).not.toMatch(/unnest[\s\S]*INSERT INTO/);
  });

  it("liste les e-mails sans compte", () => {
    expect(code).toMatch(/email_sans_compte[\s\S]*NOT EXISTS/);
  });

  it("le retour arrière supprime la liste", () => {
    expect(RETOUR).toMatch(/DROP TABLE IF EXISTS public\.proprietaires_de_marque/);
  });
});

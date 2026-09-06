-- ═══════════════════════════════════════════════════════════════════
-- Étape 3 bis — les champs personnalisés
--
-- « La solution peut être configurée et adaptée selon votre activité. »
-- Cette phrase de l'annonce commerciale suppose qu'une entreprise
-- puisse ajouter ses propres informations là où le produit n'en prévoit
-- pas : un numéro de patient, une taille de palette, un code douane.
--
-- CETTE MIGRATION EST ENTIÈREMENT ADDITIVE. Une table de définitions,
-- et une colonne `champs_perso` sur quatre tables métier. Rien n'est
-- supprimé, rien n'est renommé, aucune valeur existante n'est touchée.
-- La version du logiciel ouverte chez le client ignore ces colonnes et
-- continue de fonctionner à l'identique.
--
-- POURQUOI DU JSONB, ET PAS UNE TABLE DE VALEURS
--
-- La solution relationnelle classique — une table
-- (entité, ligne, champ, valeur) — obligerait à joindre à chaque
-- lecture. Or l'application lit ses tables entières d'un seul
-- `select("*")` et filtre côté client. Une colonne JSONB arrive donc
-- avec la ligne, sans changer une seule requête existante, et Postgres
-- sait l'indexer si le besoin s'en présente.
--
-- Le prix de ce choix : la base ne valide pas le contenu contre les
-- définitions. La vérification est faite à la saisie. C'est acceptable
-- ici — ces champs décrivent, ils ne calculent pas. Le jour où un champ
-- personnalisé entrerait dans un calcul d'argent, il faudrait une vraie
-- colonne, pas celle-ci.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. Les définitions
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Sur quoi porte le champ. Volontairement une liste fermée : un
  -- champ posé sur une entité qui n'existe pas serait invisible et
  -- introuvable.
  entite      TEXT NOT NULL CHECK (entite IN ('client', 'produit', 'fournisseur', 'prestataire')),

  -- La clé technique, celle qui sert de nom dans le JSON. Elle ne
  -- change JAMAIS : renommer le libellé affiché ne doit pas égarer les
  -- valeurs déjà saisies.
  cle         TEXT NOT NULL CHECK (cle ~ '^[a-z][a-z0-9_]{0,38}$'),
  libelle     TEXT NOT NULL,

  type        TEXT NOT NULL DEFAULT 'texte'
              CHECK (type IN ('texte', 'texte_long', 'nombre', 'date', 'booleen', 'liste')),
  -- Les choix possibles, pour le type « liste » uniquement.
  options     TEXT[],
  aide        TEXT,
  obligatoire BOOLEAN NOT NULL DEFAULT FALSE,
  ordre       INTEGER NOT NULL DEFAULT 0,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un champ de type « liste » sans choix ne serait pas saisissable.
  CONSTRAINT custom_field_liste_a_des_options
    CHECK (type <> 'liste' OR (options IS NOT NULL AND cardinality(options) > 0))
);

-- Deux champs de même clé sur la même entité se recouvriraient dans le
-- JSON : le second effacerait le premier sans prévenir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_champ_perso_cle
  ON custom_field_definitions (store_id, entite, cle);
CREATE INDEX IF NOT EXISTS idx_champ_perso_entite
  ON custom_field_definitions (store_id, entite, ordre);

DROP TRIGGER IF EXISTS trg_custom_field_definitions_updated_at ON custom_field_definitions;
CREATE TRIGGER trg_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- 2. Les valeurs, portées par chaque ligne
-- ─────────────────────────────────────────
-- `NOT NULL DEFAULT '{}'` plutôt que nullable : le code n'a alors
-- jamais à distinguer « aucun champ » de « pas encore de valeur ».
-- Postgres pose ce défaut sans réécrire la table.

ALTER TABLE clients     ADD COLUMN IF NOT EXISTS champs_perso JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE products    ADD COLUMN IF NOT EXISTS champs_perso JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE suppliers   ADD COLUMN IF NOT EXISTS champs_perso JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE providers   ADD COLUMN IF NOT EXISTS champs_perso JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Une valeur personnalisée est toujours un objet, jamais un tableau ni
-- un nombre nu : sans cela, une écriture maladroite rendrait la ligne
-- illisible pour l'affichage.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'products', 'suppliers', 'providers'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_champs_perso_objet') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (jsonb_typeof(champs_perso) = ''object'') NOT VALID',
        t, t || '_champs_perso_objet');
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', t, t || '_champs_perso_objet');
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- 3. Sécurité au niveau des lignes
-- ─────────────────────────────────────────
-- Définir un champ, c'est modifier la structure de la boutique : réservé
-- au propriétaire. Le lire reste ouvert à tous ses membres, sans quoi
-- personne ne pourrait afficher les valeurs.

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_field_definitions_select" ON custom_field_definitions;
CREATE POLICY "custom_field_definitions_select" ON custom_field_definitions FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "custom_field_definitions_insert" ON custom_field_definitions;
CREATE POLICY "custom_field_definitions_insert" ON custom_field_definitions FOR INSERT
  WITH CHECK (is_store_owner(store_id));

DROP POLICY IF EXISTS "custom_field_definitions_update" ON custom_field_definitions;
CREATE POLICY "custom_field_definitions_update" ON custom_field_definitions FOR UPDATE
  USING (is_store_owner(store_id));

DROP POLICY IF EXISTS "custom_field_definitions_delete" ON custom_field_definitions;
CREATE POLICY "custom_field_definitions_delete" ON custom_field_definitions FOR DELETE
  USING (is_store_owner(store_id));

REVOKE ALL ON custom_field_definitions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_field_definitions TO authenticated;

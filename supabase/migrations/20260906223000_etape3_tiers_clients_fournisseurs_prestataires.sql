-- ═══════════════════════════════════════════════════════════════════
-- Étape 3 du cahier des charges — les tiers
--
-- Clients enrichis, et deux entités qui n'existaient pas : les
-- fournisseurs et les prestataires.
--
-- CETTE MIGRATION EST ENTIÈREMENT ADDITIVE. Elle ne supprime aucune
-- colonne, n'en renomme aucune, ne modifie aucune valeur existante.
-- Le logiciel actuellement ouvert chez le client continue de
-- fonctionner exactement pareil après son passage : il ne connaît pas
-- les nouvelles tables et lit toujours les anciennes colonnes.
--
-- En particulier :
--   • `stores.suppliers` (le tableau de textes) est CONSERVÉ. Il est
--     recopié dans la nouvelle table, pas déplacé. Le code en service
--     le lit encore ; il ne pourra être retiré que le jour où plus
--     aucune version déployée n'en dépend.
--   • `purchases.fournisseur` (le texte libre) est CONSERVÉ. On lui
--     ajoute seulement un `supplier_id` à côté, qui peut rester nul.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. Clients — les champs qui manquaient
-- ─────────────────────────────────────────
-- Le cahier des charges (§6) demande douze informations ; la table
-- n'en portait que quatre. Toutes les colonnes ajoutées acceptent le
-- nul : les clients déjà enregistrés restent valides tels quels.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS prenom      TEXT,
  ADD COLUMN IF NOT EXISTS entreprise  TEXT,
  ADD COLUMN IF NOT EXISTS adresse     TEXT,
  ADD COLUMN IF NOT EXISTS ville       TEXT,
  ADD COLUMN IF NOT EXISTS pays        TEXT,
  ADD COLUMN IF NOT EXISTS type_client TEXT,
  ADD COLUMN IF NOT EXISTS statut      TEXT NOT NULL DEFAULT 'actif';

-- Les contraintes sont posées en NOT VALID puis validées : Postgres
-- ne verrouille alors pas la table le temps de relire chaque ligne,
-- ce qui compte sur une base en service.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_statut_check') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_statut_check
      CHECK (statut IN ('actif', 'inactif')) NOT VALID;
    ALTER TABLE clients VALIDATE CONSTRAINT clients_statut_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_type_check') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_type_check
      CHECK (type_client IS NULL OR type_client IN ('particulier', 'entreprise', 'revendeur'))
      NOT VALID;
    ALTER TABLE clients VALIDATE CONSTRAINT clients_type_check;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_store_statut ON clients (store_id, statut);

-- ─────────────────────────────────────────
-- 2. Fournisseurs (§7)
-- ─────────────────────────────────────────
-- Jusqu'ici un fournisseur n'était qu'un texte : une case dans l'achat
-- et une liste de chaînes sur la boutique. Impossible d'ouvrir sa
-- fiche, de cumuler ce qu'on lui doit, ou de retrouver ses achats.

CREATE TABLE IF NOT EXISTS suppliers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  nom                   TEXT NOT NULL,
  entreprise            TEXT,
  contact_principal     TEXT,
  telephone             TEXT,
  email                 TEXT,
  adresse               TEXT,
  ville                 TEXT,
  pays                  TEXT,
  numero_fiscal         TEXT,
  categorie             TEXT,
  -- Ce que ce fournisseur livre, en clair. Le lien ferme vers les
  -- produits viendra à l'étape 4, quand les produits auront une fiche
  -- fournisseur ; ce champ garde la connaissance en attendant.
  produits_fournis      TEXT[],
  conditions_paiement   TEXT,
  delai_livraison_jours INTEGER CHECK (delai_livraison_jours IS NULL OR delai_livraison_jours >= 0),
  note                  TEXT,
  statut                TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deux fois le même fournisseur dans une boutique n'a pas de sens, et
-- la casse ne doit pas suffire à en faire deux. L'index se construit
-- sans risque : les lignes créées plus bas viennent d'un DISTINCT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_store_nom
  ON suppliers (store_id, lower(nom));
CREATE INDEX IF NOT EXISTS idx_suppliers_store_statut
  ON suppliers (store_id, statut);

-- ─────────────────────────────────────────
-- 3. Prestataires (§8)
-- ─────────────────────────────────────────
-- Un prestataire n'est pas un fournisseur : il ne vend pas du stock,
-- il rend un service — transport, livraison, impression, réparation.
-- Ses dépenses ne passent donc pas par les achats.

CREATE TABLE IF NOT EXISTS providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  nom           TEXT NOT NULL,
  entreprise    TEXT,
  type_service  TEXT,
  contact       TEXT,
  telephone     TEXT,
  email         TEXT,
  adresse       TEXT,
  ville         TEXT,
  pays          TEXT,
  -- Un tarif de référence, librement libellé : « 15 000 Ar la course »
  -- se dit avec un montant et une unité, pas avec un nombre seul.
  tarif_base    NUMERIC(14, 2) CHECK (tarif_base IS NULL OR tarif_base >= 0),
  tarif_unite   TEXT,
  conditions    TEXT,
  note          TEXT,
  statut        TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_store_nom
  ON providers (store_id, lower(nom));
CREATE INDEX IF NOT EXISTS idx_providers_store_statut
  ON providers (store_id, statut);

-- Nécessaire pour que provider_services puisse pointer sur le COUPLE
-- (prestataire, boutique) — voir le commentaire de sa clé étrangère.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'providers_id_store_key') THEN
    ALTER TABLE providers ADD CONSTRAINT providers_id_store_key UNIQUE (id, store_id);
  END IF;
END $$;

-- Le détail des prestations proposées par un prestataire.
CREATE TABLE IF NOT EXISTS provider_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- store_id est répété ici volontairement : la RLS doit pouvoir
  -- trancher sans aller chercher la ligne parente à chaque lecture.
  -- La clé étrangère porte alors sur le COUPLE, sinon rien
  -- n'empêcherait d'écrire une prestation dont la boutique déclarée
  -- diffère de celle du prestataire, et la RLS regarderait la mauvaise.
  provider_id UUID NOT NULL,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id, store_id) REFERENCES providers (id, store_id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  libelle     TEXT NOT NULL,
  tarif       NUMERIC(14, 2) CHECK (tarif IS NULL OR tarif >= 0),
  unite       TEXT,
  note        TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services (provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_store    ON provider_services (store_id);

-- ─────────────────────────────────────────
-- 4. Rattacher les achats à un fournisseur
-- ─────────────────────────────────────────
-- La colonne est nullable et le texte d'origine reste : un achat déjà
-- enregistré ne change pas, et le code en service ne voit rien.

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases (supplier_id);

-- ─────────────────────────────────────────
-- 5. Reprise des fournisseurs déjà connus
-- ─────────────────────────────────────────
-- Deux sources : la liste posée sur la boutique, et les noms saisis
-- au fil des achats. On les fusionne sans doublon de casse.

-- `created_by` reçoit le propriétaire de la boutique plutôt que le nul :
-- la politique de modification s'appuie dessus, et une ligne sans
-- créateur n'aurait été modifiable par personne d'autre que lui de
-- toute façon — autant que ce soit dit.
INSERT INTO suppliers (store_id, created_by, nom, statut)
SELECT DISTINCT ON (s.id, lower(btrim(nom_source)))
       s.id, s.owner_id, btrim(nom_source), 'actif'
FROM stores s
CROSS JOIN LATERAL (
  SELECT unnest(COALESCE(s.suppliers, ARRAY[]::TEXT[])) AS nom_source
  UNION
  SELECT p.fournisseur FROM purchases p WHERE p.store_id = s.id
) AS sources
WHERE btrim(COALESCE(nom_source, '')) <> ''
ORDER BY s.id, lower(btrim(nom_source)), btrim(nom_source)
ON CONFLICT DO NOTHING;

-- Puis on relie les achats existants au fournisseur retrouvé par son nom.
UPDATE purchases p
SET supplier_id = f.id
FROM suppliers f
WHERE p.supplier_id IS NULL
  AND f.store_id = p.store_id
  AND lower(btrim(p.fournisseur)) = lower(f.nom);

-- ─────────────────────────────────────────
-- 6. Horodatage automatique
-- ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_providers_updated_at ON providers;
CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_provider_services_updated_at ON provider_services;
CREATE TRIGGER trg_provider_services_updated_at BEFORE UPDATE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- 7. Sécurité au niveau des lignes
-- ─────────────────────────────────────────
-- Mêmes règles que les tables métier existantes : on lit ce qui
-- appartient à sa boutique, on ne modifie que ce qu'on a créé, sauf à
-- être propriétaire de la boutique.

ALTER TABLE suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "providers_select" ON providers;
CREATE POLICY "providers_select" ON providers FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "providers_insert" ON providers;
CREATE POLICY "providers_insert" ON providers FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "providers_update" ON providers;
CREATE POLICY "providers_update" ON providers FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "providers_delete" ON providers;
CREATE POLICY "providers_delete" ON providers FOR DELETE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "provider_services_select" ON provider_services;
CREATE POLICY "provider_services_select" ON provider_services FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "provider_services_insert" ON provider_services;
CREATE POLICY "provider_services_insert" ON provider_services FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "provider_services_update" ON provider_services;
CREATE POLICY "provider_services_update" ON provider_services FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "provider_services_delete" ON provider_services;
CREATE POLICY "provider_services_delete" ON provider_services FOR DELETE
  USING (can_modify_in_store(created_by, store_id));

-- Les rôles anonymes n'ont rien à faire ici : seul le rôle authentifié
-- passe, et la RLS tranche ensuite ligne par ligne.
REVOKE ALL ON suppliers, providers, provider_services FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers, providers, provider_services TO authenticated;

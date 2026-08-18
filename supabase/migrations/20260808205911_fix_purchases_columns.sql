-- ⚠️ RECONSTRUCTION INFÉRÉE — PAS LE TEXTE ORIGINAL.
-- Cette migration a été appliquée avant notre intervention.
-- Elle est conservée uniquement pour documenter l'état historique
-- observé dans la base Supabase.

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS totalachat NUMERIC;

ALTER TABLE stores ADD COLUMN IF NOT EXISTS capital_initial NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS seuil_alerte_tresorerie NUMERIC NOT NULL DEFAULT 50000;
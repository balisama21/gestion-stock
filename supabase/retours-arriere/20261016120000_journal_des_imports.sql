-- Retour arrière de 20261016120000_journal_des_imports.sql
-- Supprime le journal des imports (les données importées restent en place).
DROP TABLE IF EXISTS public.imports_donnees;
DROP FUNCTION IF EXISTS public.imports_donnees_fige();

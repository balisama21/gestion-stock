-- Retour arrière de 20261119192740_bar_karaoke.sql
-- Supprime le bar-karaoké (zones, tables, notes). Les ventes déjà
-- encaissées restent : ce sont des ventes ordinaires.
DROP FUNCTION IF EXISTS public.encaisser_note_bar(uuid, uuid[], date, text, uuid, numeric, text, text);
DROP TABLE IF EXISTS public.bar_note_lignes;
DROP TABLE IF EXISTS public.bar_notes;
DROP TABLE IF EXISTS public.bar_tables;
DROP TABLE IF EXISTS public.bar_zones;
DROP FUNCTION IF EXISTS public.bar_note_lignes_fige();
DROP FUNCTION IF EXISTS public.bar_notes_fige();

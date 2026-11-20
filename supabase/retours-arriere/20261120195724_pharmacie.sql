-- Retour arrière de 20261120195724_pharmacie.sql
-- Supprime la pharmacie (fiches, lots, ordonnancier, organismes). Le
-- stock des produits, les achats et les ventes restent : ce sont des
-- lignes ordinaires. Seul le détail par lot est perdu.
DROP TRIGGER IF EXISTS pharma_suivre_stock ON public.stock_movements;
DROP FUNCTION IF EXISTS public.pharma_suivre_stock();
DROP FUNCTION IF EXISTS public.pharma_recevoir(uuid, date, text, jsonb, numeric, date, text);
DROP FUNCTION IF EXISTS public.pharma_dater_stock(uuid, text, date, int);
DROP FUNCTION IF EXISTS public.pharma_corriger_lot(uuid, text, date);
DROP FUNCTION IF EXISTS public.pharma_retirer_lot(uuid, int, text, text);
DROP TABLE IF EXISTS public.pharma_ordonnances;
DROP FUNCTION IF EXISTS public.pharma_numeroter_ordonnance();
DROP FUNCTION IF EXISTS public.pharma_ordonnance_fige();
DROP TABLE IF EXISTS public.pharma_organismes;
DROP TABLE IF EXISTS public.pharma_lot_mouvements;
DROP TABLE IF EXISTS public.pharma_lots;
DROP TABLE IF EXISTS public.pharma_fiches;

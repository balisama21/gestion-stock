-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — LA FACTURE PROFORMA
--
-- « Même structure que le devis, titre FACTURE PROFORMA, sans état de
-- paiement, avec durée de validité. Doit pouvoir être convertie en
-- facture en un clic, en reprenant toutes les lignes. »
--
-- POURQUOI DEUX COLONNES ET NON UNE TABLE JUMELLE. Une proforma EST
-- un devis, au mot près : mêmes lignes, même client, même total, même
-- conversion en vente. Une table à part obligerait à dédoubler
-- `quote_items`, les politiques, le compteur, l'écran et la
-- transformation en vente — cinq occasions de diverger pour une seule
-- différence, qui est le titre imprimé.
--
-- LE DÉFAUT 'devis' LAISSE L'EXISTANT OÙ IL EST. L'unique devis en
-- base le prend sans rien changer, et l'écran Devis continue de le
-- lire sans modification.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'devis';

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS duree_validite_jours integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_type_connu'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_type_connu CHECK (type IN ('devis', 'proforma'));
  END IF;
END $$;

COMMENT ON COLUMN public.quotes.type IS
  'devis ou proforma. Meme structure, meme ecran, titre et compteur differents.';
COMMENT ON COLUMN public.quotes.duree_validite_jours IS
  'Combien de jours l''offre tient, au moment ou elle a ete etablie. Nul = le reglage de la boutique.';

CREATE INDEX IF NOT EXISTS quotes_type_par_boutique
  ON public.quotes (store_id, type);

-- Chaque type tire son propre compteur : mêler proformas et devis
-- dans une même série ferait des trous dans les deux.
CREATE OR REPLACE FUNCTION public.assign_quote_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    IF NEW.type = 'proforma' THEN
      NEW.numero := 'PRO' || LPAD(next_store_counter(NEW.store_id, 'proforma')::text, 3, '0');
    ELSE
      NEW.numero := 'DEV' || LPAD(next_store_counter(NEW.store_id, 'quote')::text, 3, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

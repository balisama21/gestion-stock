-- Le taux de TVA par defaut d une categorie de produits.
--
-- La fiche produit portait deja son taux (`products.tva_rate`), et la
-- boutique le sien (`stores.tva_rate`). Entre les deux, rien : une
-- boutique qui vend des denrees exonerees a cote d articles a 20 %
-- devait saisir le taux produit par produit. La categorie le porte
-- desormais, sur le modele exact de `taux_marge` : NULL = herite de la
-- boutique.
--
-- Additive : une colonne nullable, aucune donnee reprise, aucune
-- politique touchee. Les politiques `categories_*` existantes couvrent
-- la nouvelle colonne comme les autres.

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tva_rate numeric(5, 2);
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_tva_rate_borne;
ALTER TABLE public.categories ADD CONSTRAINT categories_tva_rate_borne
  CHECK (tva_rate IS NULL OR (tva_rate >= 0 AND tva_rate <= 100));

COMMENT ON COLUMN public.categories.tva_rate IS
  'Taux de TVA des produits de cette categorie qui n ont pas le leur, en pourcentage. NULL = herite du taux de la boutique.';

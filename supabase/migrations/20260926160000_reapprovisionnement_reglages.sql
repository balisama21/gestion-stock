-- Réapprovisionnement : réglage par boutique, éteint par défaut.
-- Additif : trois colonnes facultatives, aucune ligne existante modifiée.
-- Le niveau cible par produit réutilise products.stock_max (déjà facultatif).

ALTER TABLE public.reglages_alertes_stock
  ADD COLUMN IF NOT EXISTS reappro_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reappro_mode   text
    CHECK (reappro_mode IS NULL OR reappro_mode IN ('multiple', 'ecart')),
  ADD COLUMN IF NOT EXISTS reappro_valeur numeric
    CHECK (reappro_valeur IS NULL OR (reappro_valeur > 0 AND reappro_valeur <= 9999));

COMMENT ON COLUMN public.reglages_alertes_stock.reappro_active IS
  'Niveau cible et feuille de réapprovisionnement. Faux ou nul = comportement historique (2 × seuil).';
COMMENT ON COLUMN public.reglages_alertes_stock.reappro_mode IS
  'Règle du niveau cible quand le produit n en a pas : multiple du seuil ou seuil + écart. Nul = multiple.';
COMMENT ON COLUMN public.reglages_alertes_stock.reappro_valeur IS
  'Valeur de la règle. Nul = 2.';

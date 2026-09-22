-- Le prix de vente calcule, et le « Confie a » qui s'ouvre.
--
-- `mode_prix` part a « manuel » : les 50 produits en production ont un
-- prix saisi a la main, et les basculer en automatique changerait sans
-- prevenir des prix affiches en rayon.
--
-- `deliveries.confie_a` vient A COTE de `livreur_id`, jamais a sa
-- place : choisir un membre continue d'ecrire l'identifiant, sans quoi
-- l'espace livreur cesserait d'afficher quoi que ce soit.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS mode_prix text NOT NULL DEFAULT 'manuel',
  ADD COLUMN IF NOT EXISTS taux_marge numeric;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_mode_prix_connu;
ALTER TABLE public.products ADD CONSTRAINT products_mode_prix_connu
  CHECK (mode_prix IN ('manuel', 'auto'));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_taux_marge_borne;
ALTER TABLE public.products ADD CONSTRAINT products_taux_marge_borne
  CHECK (taux_marge IS NULL OR (taux_marge >= 0 AND taux_marge <= 100));

COMMENT ON COLUMN public.products.mode_prix IS
  'auto = le prix de vente suit le prix d achat. manuel = le commercant fixe son prix, plus rien ne le recalcule. Defaut manuel : aucun prix existant ne bouge.';

COMMENT ON COLUMN public.products.taux_marge IS
  'Taux applique sur le prix d achat, en pourcentage, propre a ce produit. NULL = herite de sa categorie, puis de la boutique.';

-- Le « Confiee a » d'une livraison etait ferme aux seuls membres ayant
-- le role livreur.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS confie_a text;

COMMENT ON COLUMN public.deliveries.confie_a IS
  'Le nom de qui porte la course quand ce n est pas un membre de l equipe. Vient a cote de livreur_id, jamais a sa place.';

-- Les suggestions du champ se lisent dans les valeurs déjà tapées.
CREATE INDEX IF NOT EXISTS idx_deliveries_confie_a
  ON public.deliveries (store_id, confie_a)
  WHERE confie_a IS NOT NULL;

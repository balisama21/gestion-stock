-- ═══════════════════════════════════════════════════════════════════
-- Le prix de vente calculé, et le « Confié à » qui s'ouvre.
--
-- ── Pourquoi `mode_prix` part à « manuel » ──
--
-- Les 50 produits en production ont un prix saisi à la main. Les faire
-- basculer en automatique recalculerait leur prix de vente au premier
-- achat enregistré — c'est-à-dire changerait, sans prévenir, des prix
-- que le commerçant affiche en rayon. Le défaut est donc « manuel » :
-- une boutique qui ne touche à rien ne voit strictement aucun
-- changement, ce que le cahier des charges exige.
--
-- Le taux se lit du plus précis au plus général : produit, puis
-- catégorie, puis boutique. `NULL` à un niveau veut dire « demande au
-- niveau au-dessus » — jamais « zéro pour cent ».
-- ═══════════════════════════════════════════════════════════════════

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

-- ═══════════════════════ « CONFIÉ À » ═══════════════════════
--
-- Le champ existe déjà — c'est le « Confiée à » d'une livraison — mais
-- il est fermé : une liste des seuls membres de l'équipe ayant le rôle
-- livreur. Or une course se confie aussi au voisin, au taxi-be, à une
-- personne externe.
--
-- `confie_a` vient À CÔTÉ de `livreur_id`, jamais à sa place : choisir
-- un membre continue d'écrire `livreur_id`, sans quoi l'espace livreur
-- cesserait d'afficher quoi que ce soit. Un nom libre n'écrit que
-- `confie_a`.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS confie_a text;

COMMENT ON COLUMN public.deliveries.confie_a IS
  'Le nom de qui porte la course quand ce n est pas un membre de l equipe. Vient a cote de livreur_id, jamais a sa place.';

-- Les suggestions du champ se lisent dans les valeurs déjà tapées.
CREATE INDEX IF NOT EXISTS idx_deliveries_confie_a
  ON public.deliveries (store_id, confie_a)
  WHERE confie_a IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- Étape 9a — ranger les dépenses, et savoir à qui elles sont payées
--
-- CE QUE LES DONNÉES DISAIENT
--
-- Les trois dépenses enregistrées portent toutes le même type : « Autre
-- dépense ». La liste en proposait trois — achat de stock, retrait
-- d'argent, autre —, écrites en dur dans l'écran, et le commerçant
-- tombait à chaque fois dans celle qui ne veut rien dire. Ce n'est pas
-- qu'il range mal : c'est que la liste n'est pas la sienne. Le loyer,
-- l'électricité, le carburant, la patente n'y figurent pas, et ne
-- pourraient pas y figurer puisqu'elle est la même pour toutes les
-- boutiques.
--
-- UN USAGE, PLUTÔT QU'UNE SECONDE TABLE
--
-- Les catégories existent déjà : deux niveaux, un écran de réglage, des
-- règles de lecture, un déclencheur qui interdit un troisième niveau.
-- Écrire une table `expense_categories` à côté, ce serait recopier tout
-- cela pour le voir diverger. On ajoute donc une colonne `usage`, et la
-- même mécanique sert aux deux.
--
-- L'index d'unicité est refait pour l'inclure : sans cela, une boutique
-- ne pourrait pas avoir « Divers » à la fois comme rayon et comme poste
-- de dépense — ce qui est pourtant le cas le plus banal.
--
-- LE PRESTATAIRE
--
-- C'était la troisième dette de données que j'avais signalée en lisant
-- le cahier des charges : on pouvait tenir une fiche prestataire, mais
-- rien ne reliait ce qu'on lui payait. `provider_id` ferme ce trou. Sa
-- fiche pourra enfin dire combien elle a coûté.
--
-- CE QUE LE DÉCLENCHEUR TIENT
--
-- Une catégorie de produit rangée dans une dépense ferait de `usage` un
-- indice plutôt qu'un fait, et le premier rapport qui s'y fierait
-- mentirait. Le déclencheur vérifie aussi que catégorie et prestataire
-- appartiennent bien à la boutique de la dépense — le couple
-- (id, store_id) n'existe pas comme clé sur ces tables, contrairement
-- aux commandes et aux devis.
--
-- RIEN NE CHANGE POUR L'EXISTANT : les trois dépenses enregistrées
-- gardent leur type en texte libre, sans catégorie ni prestataire, et
-- restent parfaitement lisibles.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE categories ADD COLUMN IF NOT EXISTS usage text NOT NULL DEFAULT 'produit';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_usage_connu') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_usage_connu
      CHECK (usage IN ('produit', 'depense'));
  END IF;
END $$;

-- Refait pour inclure l'usage : « Divers » doit pouvoir être à la fois
-- un rayon et un poste de dépense.
DROP INDEX IF EXISTS idx_categories_nom;
CREATE UNIQUE INDEX idx_categories_nom ON categories
  (store_id, usage, lower(nom), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id uuid
  REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS provider_id uuid
  REFERENCES providers(id) ON DELETE SET NULL;
-- Le chemin d'une photo du reçu dans le seau « documents ».
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS justificatif text;

CREATE INDEX IF NOT EXISTS idx_expenses_categorie ON expenses (store_id, category_id)
  WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_prestataire ON expenses (provider_id)
  WHERE provider_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.depense_rattachements_coherents()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_store uuid; v_usage text;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT store_id, usage INTO v_store, v_usage FROM categories WHERE id = NEW.category_id;
    IF NOT FOUND OR v_store <> NEW.store_id THEN
      RAISE EXCEPTION 'Catégorie introuvable dans cette boutique.';
    END IF;
    IF v_usage <> 'depense' THEN
      RAISE EXCEPTION 'Cette catégorie sert à ranger des produits, pas des dépenses.';
    END IF;
  END IF;

  IF NEW.provider_id IS NOT NULL THEN
    SELECT store_id INTO v_store FROM providers WHERE id = NEW.provider_id;
    IF NOT FOUND OR v_store <> NEW.store_id THEN
      RAISE EXCEPTION 'Prestataire introuvable dans cette boutique.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_depense_rattachements ON expenses;
CREATE TRIGGER trg_depense_rattachements
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION depense_rattachements_coherents();

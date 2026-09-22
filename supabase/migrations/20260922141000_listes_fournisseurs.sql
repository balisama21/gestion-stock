-- Les fournisseurs : un annuaire, pas une liste. Seul leur TYPE devient
-- une valeur de liste.
--
-- Les textes libres deja ecrits sont rattaches a une fiche, une par nom
-- distinct et par boutique. La colonne texte est CONSERVEE a cote de
-- l'identifiant : si un rattachement est faux, la valeur d'origine est
-- toujours la.
--
-- Aucune fusion hasardeuse : le rattachement se fait sur l'egalite
-- stricte de `cle_de_liste(nom)`, dans la meme boutique.

-- Le type d un fournisseur.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS type_id uuid REFERENCES public.categories (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.suppliers.type_id IS
  'Type de fournisseur, valeur de liste (categories usage = type_fournisseur).';

COMMENT ON COLUMN public.suppliers.categorie IS
  'Ancien type en texte libre. Conserve comme filet de la migration vers type_id ; ne plus ecrire dedans.';

CREATE INDEX IF NOT EXISTS idx_suppliers_type ON public.suppliers (type_id);

-- Le type appartient a la meme boutique, et c est bien un type de
-- fournisseur, pas une categorie de produit rangee par erreur.
CREATE OR REPLACE FUNCTION public.fournisseur_type_coherent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_store uuid; v_usage text;
BEGIN
  IF NEW.type_id IS NOT NULL THEN
    SELECT store_id, usage INTO v_store, v_usage FROM public.categories WHERE id = NEW.type_id;
    IF NOT FOUND OR v_store <> NEW.store_id THEN
      RAISE EXCEPTION 'Type de fournisseur introuvable dans cette boutique.';
    END IF;
    IF v_usage <> 'type_fournisseur' THEN
      RAISE EXCEPTION 'Cette valeur n est pas un type de fournisseur.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fournisseur_type_coherent ON public.suppliers;
CREATE TRIGGER trg_fournisseur_type_coherent
  BEFORE INSERT OR UPDATE OF type_id ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fournisseur_type_coherent();

-- Anti-doublon sur l annuaire. Les trois fiches en production portent
-- trois noms distincts : l index se cree sans reprise. Limite aux
-- fiches actives, pour qu archiver puis recreer reste possible.
CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_boutique_nom
  ON public.suppliers (store_id, public.cle_de_liste(nom))
  WHERE statut = 'actif';

-- Une fiche par nom distinct et par boutique, prise dans les achats et
-- dans les produits. Les noms vides sont ignores.
INSERT INTO public.suppliers (store_id, created_by, nom, note)
SELECT DISTINCT ON (t.store_id, public.cle_de_liste(t.nom))
       t.store_id,
       st.owner_id,
       btrim(t.nom),
       'Fiche creee automatiquement lors de la reprise des fournisseurs saisis en texte libre.'
  FROM (
        SELECT store_id, fournisseur AS nom FROM public.purchases
         WHERE supplier_id IS NULL AND btrim(coalesce(fournisseur, '')) <> ''
        UNION ALL
        SELECT store_id, fournisseur AS nom FROM public.products
         WHERE supplier_id IS NULL AND btrim(coalesce(fournisseur, '')) <> ''
       ) t
  JOIN public.stores st ON st.id = t.store_id
 WHERE NOT EXISTS (
         SELECT 1 FROM public.suppliers s
          WHERE s.store_id = t.store_id
            AND public.cle_de_liste(s.nom) = public.cle_de_liste(t.nom)
       )
 ORDER BY t.store_id, public.cle_de_liste(t.nom), btrim(t.nom);

-- Rattachement des achats et des produits.
UPDATE public.purchases p
   SET supplier_id = s.id
  FROM public.suppliers s
 WHERE p.supplier_id IS NULL
   AND s.store_id = p.store_id
   AND btrim(coalesce(p.fournisseur, '')) <> ''
   AND public.cle_de_liste(s.nom) = public.cle_de_liste(p.fournisseur);

UPDATE public.products pr
   SET supplier_id = s.id
  FROM public.suppliers s
 WHERE pr.supplier_id IS NULL
   AND s.store_id = pr.store_id
   AND btrim(coalesce(pr.fournisseur, '')) <> ''
   AND public.cle_de_liste(s.nom) = public.cle_de_liste(pr.fournisseur);

-- Le type en texte libre rejoint la liste.
--
-- Aucune fiche n en porte aujourd hui ; le code est ecrit pour les
-- boutiques qui en auraient saisi avant que la migration ne passe.
INSERT INTO public.categories (store_id, created_by, nom, usage, ordre)
SELECT DISTINCT ON (s.store_id, public.cle_de_liste(s.categorie))
       s.store_id, st.owner_id, btrim(s.categorie), 'type_fournisseur', 1000
  FROM public.suppliers s
  JOIN public.stores st ON st.id = s.store_id
 WHERE btrim(coalesce(s.categorie, '')) <> ''
 ORDER BY s.store_id, public.cle_de_liste(s.categorie), btrim(s.categorie)
    ON CONFLICT DO NOTHING;

UPDATE public.suppliers s
   SET type_id = c.id
  FROM public.categories c
 WHERE s.type_id IS NULL
   AND c.store_id = s.store_id
   AND c.usage = 'type_fournisseur'
   AND btrim(coalesce(s.categorie, '')) <> ''
   AND public.cle_de_liste(c.nom) = public.cle_de_liste(s.categorie);

COMMENT ON COLUMN public.purchases.fournisseur IS
  'Nom du fournisseur tel que saisi a l epoque. Conserve comme filet derriere supplier_id ; l ecran ecrit desormais les deux.';

COMMENT ON COLUMN public.products.fournisseur IS
  'Nom du fournisseur tel que saisi a l epoque. Conserve comme filet derriere supplier_id ; l ecran ecrit desormais les deux.';

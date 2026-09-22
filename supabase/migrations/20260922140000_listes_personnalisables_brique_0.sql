-- La brique commune : la « liste personnalisable ».
--
-- La table generique existait deja : `categories` porte store_id, nom,
-- parent_id, ordre, actif, created_by et un `usage` borne a deux
-- valeurs. En creer une a cote aurait oblige a demenager deux cles
-- etrangeres deja en service, ou a laisser deux mecanismes de liste
-- dans le logiciel. L'elargir ne coute qu'un CHECK remplace.
--
-- Le nom de la table ne change pas : le renommer casserait le code qui
-- tourne en ce moment meme, pour un gain de vocabulaire.

-- IMMUTABLE : elle sert dans un index unique. Ecrite a la main plutot
-- qu'avec `unaccent`, qui n'est pas installe et n'est pas IMMUTABLE.
CREATE OR REPLACE FUNCTION public.cle_de_liste(p_texte text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $function$
  SELECT regexp_replace(
           btrim(lower(translate(
             p_texte,
             'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÇçÑñŸÿÝý',
             'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuCcNnYyYy'
           ))),
           '\s+', ' ', 'g');
$function$;

COMMENT ON FUNCTION public.cle_de_liste(text) IS
  'Minuscules, accents retires, espaces reduits. Sert a l anti-doublon et a la recherche des listes.';

-- Trois usages aujourd hui, davantage demain sans migration de donnees.
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_usage_connu;
ALTER TABLE public.categories ADD CONSTRAINT categories_usage_connu
  CHECK (usage IN ('produit', 'depense', 'type_fournisseur'));

COMMENT ON TABLE public.categories IS
  'Les listes personnalisables d une boutique. La colonne usage dit de quelle liste il s agit : categories de produits, postes de depense, types de fournisseur. On archive (actif = false), on ne supprime jamais une valeur deja utilisee.';

COMMENT ON COLUMN public.categories.actif IS
  'Faux = archivee. Disparait des selecteurs, reste lisible sur les anciens enregistrements.';

-- Le taux de marge par defaut d une categorie.
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS taux_marge numeric;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_taux_marge_borne;
ALTER TABLE public.categories ADD CONSTRAINT categories_taux_marge_borne
  CHECK (taux_marge IS NULL OR (taux_marge >= 0 AND taux_marge <= 100));

COMMENT ON COLUMN public.categories.taux_marge IS
  'Taux applique sur le prix d achat, en pourcentage. NULL = herite du reglage de la boutique.';

-- L anti-doublon, tenu par la base et pas seulement par l ecran.
--
-- Rien n empechait jusqu ici « Grossiste » et « grossiste » de coexister.
-- La table est vide en production : l index se cree sans reprise.
CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_boutique_usage_cle
  ON public.categories (store_id, usage, public.cle_de_liste(nom));

CREATE INDEX IF NOT EXISTS idx_categories_boutique_usage_actif
  ON public.categories (store_id, usage, actif, ordre);

-- Reglage par boutique, lu dans `stores.personnalisation`. Cle absente
-- = tout le monde, c'est-a-dire comme aujourd'hui. Verifie ICI, cote
-- serveur : l'ecran le respecte aussi, mais l'ecran n'est pas une garde.
CREATE OR REPLACE FUNCTION public.peut_ajouter_une_valeur_de_liste(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.store_allows_write(p_store_id)
     AND (
       COALESCE(
         (SELECT personnalisation -> 'listes' ->> 'ajoutDepuisFormulaire'
            FROM public.stores WHERE id = p_store_id),
         'tous'
       ) <> 'responsables'
       OR public.is_store_owner(p_store_id)
       OR EXISTS (
            SELECT 1 FROM public.store_members
             WHERE store_id = p_store_id
               AND user_id = (SELECT auth.uid())
               AND role IN ('admin', 'manager')
          )
     );
$function$;

COMMENT ON FUNCTION public.peut_ajouter_une_valeur_de_liste(uuid) IS
  'Ajout d une valeur de liste : tout le monde, ou responsables seuls, selon personnalisation.listes.ajoutDepuisFormulaire. Contient store_allows_write : le verrou de boutique s applique.';

DROP POLICY IF EXISTS categories_insert ON public.categories;
CREATE POLICY categories_insert ON public.categories
  FOR INSERT TO public
  WITH CHECK (
    public.peut_ajouter_une_valeur_de_liste(store_id)
    AND (SELECT auth.uid()) = created_by
  );

-- Les valeurs par defaut d une nouvelle boutique.
--
-- Génériques, jamais celles d un client en particulier. Chaque boutique
-- les renomme, les archive et en ajoute a sa guise.
CREATE OR REPLACE FUNCTION public.installer_les_listes_par_defaut(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_usage text;
  v_nom text;
  v_rang int;
  v_defauts jsonb := jsonb_build_object(
    'produit', jsonb_build_array(
      'Alimentation', 'Boissons', 'Hygiène et entretien', 'Emballages',
      'Fournitures', 'Équipements', 'Services', 'Autre'
    ),
    'type_fournisseur', jsonb_build_array(
      'Fabricant', 'Grossiste', 'Distributeur', 'Importateur',
      'Détaillant', 'Prestataire de services', 'Particulier', 'Autre'
    ),
    'depense', jsonb_build_array(
      'Loyer', 'Salaires', 'Transport', 'Électricité et eau',
      'Téléphone et internet', 'Fournitures', 'Entretien et réparations',
      'Taxes et impôts', 'Marketing', 'Autre'
    )
  );
BEGIN
  SELECT owner_id INTO v_owner FROM public.stores WHERE id = p_store_id;
  IF v_owner IS NULL THEN RETURN; END IF;

  FOR v_usage IN SELECT jsonb_object_keys(v_defauts) LOOP
    v_rang := 0;
    FOR v_nom IN SELECT jsonb_array_elements_text(v_defauts -> v_usage) LOOP
      INSERT INTO public.categories (store_id, created_by, nom, usage, ordre)
      VALUES (p_store_id, v_owner, v_nom, v_usage, v_rang)
      ON CONFLICT DO NOTHING;
      v_rang := v_rang + 10;
    END LOOP;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.installer_les_listes_par_defaut(uuid) IS
  'Pre-remplit les listes d une boutique. Idempotente : ON CONFLICT DO NOTHING sur l index d anti-doublon.';

CREATE OR REPLACE FUNCTION public.listes_par_defaut_a_la_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.installer_les_listes_par_defaut(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_listes_par_defaut ON public.stores;
CREATE TRIGGER trg_listes_par_defaut
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.listes_par_defaut_a_la_creation();

-- Les boutiques deja la partent du meme socle.
--
-- Elles partent du même socle que les nouvelles. C est additif : aucune
-- ligne existante n est touchée, et ce qui ne sert pas s archive.
DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.stores LOOP
    PERFORM public.installer_les_listes_par_defaut(v_id);
  END LOOP;
END;
$$;

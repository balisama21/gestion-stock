-- ════════════════════════════════════════════════════════════════
-- LE VENDEUR D'UNE VENTE : CHOISI PAR LE RESPONSABLE, IMPOSÉ AUX INVITÉS
-- ════════════════════════════════════════════════════════════════
--
-- L'écran verrouille déjà le champ « Vendeur » d'un invité sur son
-- propre nom. Cette règle-ci le garantit côté base, quel que soit le
-- chemin d'écriture : `create_sale` / `create_sale_ticket`, ou une
-- écriture directe dans `sales`, que les politiques RLS permettent à
-- un membre.
--
--  - Le responsable du compte (`stores.owner_id`) écrit le vendeur
--    qu'il veut, comme avant.
--  - Un invité : à la création, la vente prend SON nom, celui que
--    l'écran affiche (`profiles.full_name`, sinon l'e-mail) ; à la
--    modification, le vendeur ne change pas.
--  - Sans session (service, tâches de maintenance) : rien n'est imposé.
--
-- Rien d'autre n'est touché : ni stock, ni montants, ni paiements. Le
-- déclencheur ne lit que la colonne `vendeur`, et ne s'arme en
-- modification que si cette colonne est visée.

CREATE OR REPLACE FUNCTION public.vendeur_impose_aux_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_nom text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM stores WHERE id = NEW.store_id AND owner_id = v_uid) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.vendeur := OLD.vendeur;
    RETURN NEW;
  END IF;

  -- Le nom tel que l'écran le montre : `full_name || email`.
  SELECT COALESCE(NULLIF(p.full_name, ''), p.email) INTO v_nom
    FROM profiles p WHERE p.id = v_uid;
  IF v_nom IS NULL OR v_nom = '' THEN
    SELECT u.email INTO v_nom FROM auth.users u WHERE u.id = v_uid;
  END IF;

  NEW.vendeur := COALESCE(v_nom, '');
  RETURN NEW;
END;
$function$;

-- Un déclencheur, pas une fonction appelable : personne ne l'exécute
-- à la main.
REVOKE ALL ON FUNCTION public.vendeur_impose_aux_invites() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sales_vendeur_impose ON public.sales;
CREATE TRIGGER sales_vendeur_impose
  BEFORE INSERT OR UPDATE OF vendeur ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.vendeur_impose_aux_invites();

-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — QUI A LE DROIT DE RÉGLER LES DOCUMENTS
--
-- Le cahier des charges le demande explicitement : « RLS Supabase
-- côté serveur, pas seulement un bouton masqué ».
--
-- CE QUI EXISTAIT. La politique d'écriture de `stores` est
-- `is_store_member(id) AND NOT store_is_locked(id)`, et
-- `is_store_member` accepte le propriétaire ET tout membre dont le
-- rôle n'est pas « livreur ». Un vendeur pouvait donc, en théorie,
-- réécrire `personnalisation` — et avec elle le modèle de facture de
-- toute la boutique. Rien dans l'écran ne le propose ; rien en base ne
-- l'empêchait.
--
-- POURQUOI UN DÉCLENCHEUR ET NON UNE POLITIQUE. Restreindre la
-- politique d'UPDATE de `stores` entière aux seuls administrateurs
-- couperait tout ce que cette ligne porte d'autre. Le déclencheur
-- vise exactement la clé concernée : `personnalisation -> 'documents'`.
-- Le reste de la ligne continue de s'écrire comme avant.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.peut_regler_les_documents(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM store_members
     WHERE store_id = p_store_id
       AND user_id = auth.uid()
       AND role IN ('admin', 'manager')
  );
$function$;

COMMENT ON FUNCTION public.peut_regler_les_documents(uuid) IS
  'Le proprietaire, l''administrateur et le manager. Tous les vendeurs produisent des documents identiques.';

CREATE OR REPLACE FUNCTION public.stores_documents_reserves()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- auth.uid() nul : personne n'est connecté, l'appel vient du serveur
  -- (tâche d'administration, migration). Ce chemin est déjà privilégié.
  IF auth.uid() IS NOT NULL
     AND (NEW.personnalisation -> 'documents') IS DISTINCT FROM (OLD.personnalisation -> 'documents')
     AND NOT public.peut_regler_les_documents(NEW.id)
  THEN
    RAISE EXCEPTION
      'Seuls le proprietaire, l''administrateur et le manager reglent les documents.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stores_documents_reserves ON public.stores;
CREATE TRIGGER stores_documents_reserves
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.stores_documents_reserves();

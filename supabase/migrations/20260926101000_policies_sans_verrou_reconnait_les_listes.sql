-- peut_ajouter_une_valeur_de_liste appelle store_allows_write : ce n'est pas un trou.
CREATE OR REPLACE FUNCTION public.policies_sans_verrou()
RETURNS TABLE(nom_table text, policy text, commande text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT tablename::text, policyname::text, cmd::text
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
    AND coalesce(qual,'') || ' ' || coalesce(with_check,'')
        !~ 'store_allows_write|can_modify_in_store|store_is_locked|boutique_ouverte_a|proprietaire_dune_boutique_ouverte|peut_ajouter_une_valeur_de_liste'
    AND tablename NOT IN ('profiles','access_codes','password_recovery_requests','activations_de_compte')
    AND NOT (tablename = 'stores' AND cmd IN ('INSERT','DELETE'))
    AND NOT (tablename = 'abonnements_alertes_stock' AND cmd = 'DELETE')
  ORDER BY tablename, cmd, policyname;
$function$;

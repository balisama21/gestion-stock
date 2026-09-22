-- Qui peut appeler quoi, et un chemin de recherche fixe.
--
-- Supabase accorde par defaut l'execution de toute fonction de `public`
-- a `anon` et `authenticated`, que PostgREST expose alors en
-- `/rest/v1/rpc/<nom>`. Le projet referme cette porte fonction par
-- fonction depuis les documents v3.
--
-- `peut_ajouter_une_valeur_de_liste` est lue par deux politiques RLS,
-- donc evaluee sous le role de l'appelant : `authenticated` garde son
-- droit, `anon` le perd.

REVOKE EXECUTE ON FUNCTION public.listes_par_defaut_a_la_creation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fournisseur_type_coherent() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.installer_les_listes_par_defaut(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_ajouter_une_valeur_de_liste(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.peut_ajouter_une_valeur_de_liste(uuid) TO authenticated;

-- Le corps n'emploie que des fonctions de `pg_catalog`, toujours cherche
-- en premier : le resultat ne change pas, l'index unique reste valide.
CREATE OR REPLACE FUNCTION public.cle_de_liste(p_texte text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
SET search_path TO ''
AS $function$
  SELECT regexp_replace(
           btrim(lower(translate(
             p_texte,
             'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÇçÑñŸÿÝý',
             'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuCcNnYyYy'
           ))),
           '\s+', ' ', 'g');
$function$;

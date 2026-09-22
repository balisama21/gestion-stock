-- ════════════════════════════════════════════════════════════════════
-- LISTES — QUI PEUT APPELER QUOI, ET UN CHEMIN DE RECHERCHE FIXÉ
--
-- Supabase accorde par défaut l'exécution de toute fonction de `public`
-- aux rôles `anon` et `authenticated`, et PostgREST les expose alors en
-- `/rest/v1/rpc/<nom>`. Le projet referme cette porte fonction par
-- fonction depuis les documents v3 ; les cinq fonctions ajoutées par la
-- mission « listes personnalisables » suivent la même règle.
--
-- Les deux fonctions de DÉCLENCHEUR n'ont rien à faire dans une API :
-- elles n'ont de sens qu'appelées par le moteur, sur une ligne.
--
-- `installer_les_listes_par_defaut` est SECURITY DEFINER et écrit dans
-- la boutique qu'on lui nomme. Elle n'est appelée que par le
-- déclencheur de création et par sa migration, tous deux exécutés par le
-- propriétaire de la base : personne d'autre n'a besoin de l'atteindre.
--
-- `peut_ajouter_une_valeur_de_liste` est lue par deux politiques RLS,
-- donc évaluée sous le rôle de l'appelant : `authenticated` garde son
-- droit, `anon` le perd — un visiteur non connecté n'a aucune liste à
-- compléter.
-- ════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.listes_par_defaut_a_la_creation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fournisseur_type_coherent() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.installer_les_listes_par_defaut(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_ajouter_une_valeur_de_liste(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.peut_ajouter_une_valeur_de_liste(uuid) TO authenticated;

-- ── Le chemin de recherche de `cle_de_liste`, fixé ──
--
-- Elle ne le déclarait pas, et le vérificateur de Supabase le signale à
-- juste titre : une fonction dont le `search_path` dépend de l'appelant
-- peut être détournée en plaçant un homonyme dans un schéma qu'il
-- contrôle.
--
-- Le corps n'emploie que des fonctions de `pg_catalog`, toujours
-- cherché en premier quel que soit le réglage : le résultat ne change
-- pas d'un caractère, et l'index unique qui s'appuie dessus reste
-- valide. Seul l'attribut de la fonction change.
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

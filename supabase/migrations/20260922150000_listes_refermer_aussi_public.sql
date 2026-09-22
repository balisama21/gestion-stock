-- Correction : revoquer depuis `anon` ne suffisait pas.
--
-- Postgres accorde EXECUTE a PUBLIC sur toute fonction, en plus des
-- droits nommes que Supabase ajoute. La migration precedente n'avait
-- retire que les seconds : `has_function_privilege('anon', ..., 'EXECUTE')`
-- rendait toujours vrai, par heritage de PUBLIC. La porte etait donc
-- restee ouverte.
--
-- `installer_les_listes_par_defaut` est le cas qui comptait : SECURITY
-- DEFINER, appelable en RPC, et elle ecrit dans la boutique qu'on lui
-- nomme. Elle n'est appelee que par le declencheur de creation, dont le
-- corps s'execute sous le proprietaire de la base — revoquer PUBLIC ne
-- casse donc pas la creation d'une boutique.
--
-- Les deux fonctions de DECLENCHEUR gardent PUBLIC : PostgREST n'expose
-- jamais une fonction qui rend `trigger`, elles ne sont donc atteignables
-- par personne, et toucher aux droits d'une fonction que la creation de
-- boutique declenche en production serait un risque sans contrepartie.

REVOKE EXECUTE ON FUNCTION public.installer_les_listes_par_defaut(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.peut_ajouter_une_valeur_de_liste(uuid) FROM PUBLIC;
-- Relu par deux politiques RLS, donc evalue sous le role de l'appelant.
GRANT EXECUTE ON FUNCTION public.peut_ajouter_une_valeur_de_liste(uuid) TO authenticated;

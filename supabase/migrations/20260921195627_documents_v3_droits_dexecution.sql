-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — QUI PEUT APPELER QUOI
--
-- Supabase accorde par défaut l'exécution de toute fonction de
-- `public` aux rôles `anon` et `authenticated`, et PostgREST les
-- expose alors en `/rest/v1/rpc/<nom>`. Un `REVOKE ... FROM public`
-- ne suffit pas : ces droits-là sont accordés nommément.
--
-- Les deux fonctions de DÉCLENCHEUR n'ont rien à faire dans une API :
-- elles n'ont de sens qu'appelées par le moteur, sur une ligne.
--
-- Les trois autres refusent déjà l'appel d'un inconnu — elles
-- vérifient l'appartenance à la boutique — mais une porte fermée vaut
-- mieux qu'une porte qui répond « non ».
--
-- Le reste du projet porte le même avertissement sur soixante-quinze
-- fonctions antérieures. Le nettoyage général est un chantier à lui
-- seul, sur une base en service : il n'est pas mêlé à celui-ci.
-- ════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.stores_documents_reserves() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_supplier_invoice_numero() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_regler_les_documents(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prochain_numero_de_document(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fixer_compteur_de_document(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.peut_regler_les_documents(uuid) TO authenticated;

-- Journal des imports de données : un résultat consultable par import.
--
-- Purement additif. Les lignes importées, elles, vont dans leurs tables
-- habituelles (products, clients, suppliers, purchases) par les mêmes
-- fonctions que la saisie à l'écran ; les déclencheurs de journal_activite
-- les tracent déjà une à une. Cette table garde le BILAN de chaque import :
-- fichier, destinations, lignes ajoutées / mises à jour / ignorées /
-- rejetées, et les premières erreurs.
--
-- Écriture : l'auteur, dans une boutique ouverte, pour lui-même. Un
-- import « en_cours » peut être complété par son auteur ; une fois clos,
-- il ne change plus.
-- Lecture : l'auteur, le propriétaire de la boutique, le super admin.
--
-- Retour arrière : supabase/retours-arriere/20261016120000_journal_des_imports.sql

CREATE TABLE IF NOT EXISTS public.imports_donnees (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id      uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  nom_fichier  text NOT NULL CHECK (char_length(nom_fichier) BETWEEN 1 AND 200),
  source       text NOT NULL DEFAULT 'fichier' CHECK (source IN ('fichier', 'ia')),
  statut       text NOT NULL DEFAULT 'en_cours'
                 CHECK (statut IN ('en_cours', 'termine', 'partiel', 'echec', 'interrompu')),
  -- [{ "module": "produits", "ajoutes": 3, "mis_a_jour": 1, "ignores": 2, "rejetes": 0 }, …]
  bilan        jsonb NOT NULL DEFAULT '[]'::jsonb
                 CHECK (jsonb_typeof(bilan) = 'array' AND pg_column_size(bilan) <= 16384),
  -- [{ "module": "produits", "ligne": 7, "message": "…" }, …] (200 au plus)
  erreurs      jsonb NOT NULL DEFAULT '[]'::jsonb
                 CHECK (jsonb_typeof(erreurs) = 'array' AND pg_column_size(erreurs) <= 65536),
  cree_le      timestamptz NOT NULL DEFAULT now(),
  termine_le   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_imports_donnees_boutique ON public.imports_donnees (store_id, cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_imports_donnees_utilisateur ON public.imports_donnees (user_id);

ALTER TABLE public.imports_donnees ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.imports_donnees FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.imports_donnees TO authenticated;
GRANT ALL ON public.imports_donnees TO service_role;

DROP POLICY IF EXISTS imports_donnees_lecture ON public.imports_donnees;
CREATE POLICY imports_donnees_lecture ON public.imports_donnees
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_store_owner(store_id)
    OR (SELECT public.is_platform_admin())
  );

DROP POLICY IF EXISTS imports_donnees_ajout ON public.imports_donnees;
CREATE POLICY imports_donnees_ajout ON public.imports_donnees
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_store_member(store_id)
    AND NOT public.store_is_locked(store_id)
  );

DROP POLICY IF EXISTS imports_donnees_cloture ON public.imports_donnees;
CREATE POLICY imports_donnees_cloture ON public.imports_donnees
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND statut = 'en_cours')
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Ni boutique, ni auteur, ni date de création ne changent après coup.
CREATE OR REPLACE FUNCTION public.imports_donnees_fige()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id <> OLD.store_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.cree_le <> OLD.cree_le OR NEW.nom_fichier <> OLD.nom_fichier THEN
    RAISE EXCEPTION 'Un import journalisé ne change pas de boutique, d''auteur ni de fichier.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS imports_donnees_fige ON public.imports_donnees;
CREATE TRIGGER imports_donnees_fige
  BEFORE UPDATE ON public.imports_donnees
  FOR EACH ROW EXECUTE FUNCTION public.imports_donnees_fige();

REVOKE ALL ON FUNCTION public.imports_donnees_fige() FROM PUBLIC, anon, authenticated;

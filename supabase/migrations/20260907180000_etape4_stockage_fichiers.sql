-- ═══════════════════════════════════════════════════════════════════
-- Étape 4 (suite) — le stockage de fichiers
--
-- Supabase Storage n'était utilisé nulle part. Le logo de la boutique
-- vit en base64 dans une colonne : il repart donc entièrement à chaque
-- chargement de l'application, et il a fallu le réduire à 256 pixels
-- pour que ce soit supportable. Ce n'est pas tenable pour des photos de
-- produits, ni pour des justificatifs de dépense.
--
-- DEUX SEAUX, parce que deux besoins opposés :
--
--   • `produits` est PUBLIC en lecture. Une photo de catalogue est faite
--     pour être vue, y compris hors connexion à l'application, et un
--     lien signé qui expire compliquerait l'affichage sans rien
--     protéger de sensible.
--
--   • `documents` est PRIVÉ. Un justificatif de dépense, une facture
--     fournisseur ou une pièce d'identité ne se lisent que par un
--     membre de la boutique, et seulement par un lien signé de courte
--     durée.
--
-- L'ÉCRITURE est dans les deux cas réservée aux membres de la boutique,
-- et le chemin le prouve : tout fichier vit sous `<store_id>/…`, et la
-- politique compare ce premier dossier à l'appartenance de celui qui
-- écrit. Une boutique ne peut donc rien déposer chez une autre.
--
-- MIGRATION ADDITIVE. Elle ne touche à aucune table métier.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('produits', 'produits', TRUE, 5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('documents', 'documents', FALSE, 10485760,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Le premier dossier du chemin, quand c'est bien un identifiant.
--
-- Le passage par une fonction n'est pas cosmétique : une conversion
-- directe en UUID lèverait une erreur sur un fichier déposé hors
-- convention, et cette erreur ferait échouer la politique entière
-- plutôt que de refuser proprement la ligne.
CREATE OR REPLACE FUNCTION storage_boutique_du_chemin(chemin TEXT)
RETURNS UUID AS $$
  SELECT CASE
    WHEN (storage.foldername(chemin))[1] ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN ((storage.foldername(chemin))[1])::uuid
    ELSE NULL
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─────────────────────────────────────────
-- Politiques sur les objets
-- ─────────────────────────────────────────

DROP POLICY IF EXISTS "medias_lecture_membre" ON storage.objects;
CREATE POLICY "medias_lecture_membre" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('produits', 'documents')
    AND is_store_member(storage_boutique_du_chemin(name))
  );

DROP POLICY IF EXISTS "medias_depot_membre" ON storage.objects;
CREATE POLICY "medias_depot_membre" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('produits', 'documents')
    AND is_store_member(storage_boutique_du_chemin(name))
  );

DROP POLICY IF EXISTS "medias_remplacement_membre" ON storage.objects;
CREATE POLICY "medias_remplacement_membre" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('produits', 'documents')
    AND is_store_member(storage_boutique_du_chemin(name))
  );

DROP POLICY IF EXISTS "medias_suppression_membre" ON storage.objects;
CREATE POLICY "medias_suppression_membre" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('produits', 'documents')
    AND is_store_member(storage_boutique_du_chemin(name))
  );

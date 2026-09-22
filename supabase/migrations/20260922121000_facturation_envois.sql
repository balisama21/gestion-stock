-- ════════════════════════════════════════════════════════════════════
-- FACTURATION — CE QUI EST PARTI CHEZ LE CLIENT
--
-- « Envoyer : lien de partage WhatsApp et email » et « Relancer une
-- facture en retard ». Les deux laissent la même trace : une pièce a
-- quitté la boutique, tel jour, par tel canal, de la main de
-- quelqu'un.
--
-- POURQUOI UNE TABLE À PART, ET NON UNE COLONNE SUR
-- `document_emissions`. Cette table-là est figée par construction :
-- aucune politique d'UPDATE, et c'est ce qui fait sa valeur. Un envoi,
-- lui, se répète — on relance une facture trois fois. Ce n'est pas un
-- état à réécrire, c'est un journal à empiler.
--
-- ELLE N'ÉCRIT RIEN D'AUTRE. Ni trésorerie, ni stock, ni statut : le
-- statut « Envoyée » se déduit de la présence d'une ligne ici, comme
-- le nombre de relances se compte en les additionnant.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.document_envois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- La même paire que `document_emissions` : la table d'où sort la
  -- pièce, et la ligne. Pas de clé étrangère, pour la même raison —
  -- une vente supprimée ne doit pas emporter la preuve de l'envoi.
  entite text NOT NULL,
  entite_id uuid NOT NULL,
  type text NOT NULL,
  -- whatsapp, email, ou autre.
  canal text NOT NULL DEFAULT 'autre',
  -- Une relance est un envoi de plus, pas un envoi d'une autre nature.
  relance boolean NOT NULL DEFAULT false,
  envoye_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  envoye_le timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_envois_par_boutique
  ON public.document_envois (store_id, envoye_le DESC);
CREATE INDEX IF NOT EXISTS document_envois_par_piece
  ON public.document_envois (store_id, entite, entite_id);

ALTER TABLE public.document_envois ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'document_envois'
       AND policyname = 'document_envois_select'
  ) THEN
    CREATE POLICY document_envois_select ON public.document_envois
      FOR SELECT USING (is_store_member(store_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'document_envois'
       AND policyname = 'document_envois_insert'
  ) THEN
    CREATE POLICY document_envois_insert ON public.document_envois
      FOR INSERT WITH CHECK (store_allows_write(store_id));
  END IF;
END $$;

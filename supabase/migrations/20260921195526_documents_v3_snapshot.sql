-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — LA COPIE FIGÉE D'UN DOCUMENT ÉMIS
--
-- « Un document déjà émis garde une copie figée de l'identité, des
-- réglages et de la mise en page au moment de son émission. Si la
-- boutique change son logo, son adresse ou sa mise en page plus tard,
-- les anciens documents ne changent pas. »
--
-- POURQUOI UNE TABLE À PART. La copie ne appartient pas à la vente :
-- elle appartient à la PIÈCE qu'on en a tirée. Une même vente peut
-- donner une facture en mars et un reçu en avril, avec deux
-- identités différentes si la boutique a déménagé entre les deux.
-- Une colonne sur `sales` n'en porterait qu'une.
--
-- ELLE NE SE MODIFIE PAS. Aucune politique d'UPDATE, aucune de
-- DELETE : figé veut dire figé. Le jour où une pièce doit changer,
-- on en émet une autre — c'est ce que fait une facture d'avoir.
--
-- UNE SEULE PAR PIÈCE. L'index unique le garantit ; l'application
-- insère avec ON CONFLICT DO NOTHING, de sorte qu'une réimpression
-- relit la copie au lieu d'en écrire une nouvelle.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.document_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- facture, recu, devis, proforma, commande, facture_achat…
  type text NOT NULL,
  -- La table d'où sort la pièce, et la ligne. Pas de clé étrangère :
  -- une vente supprimée ne doit pas emporter la preuve de ce qui est
  -- parti chez le client.
  entite text NOT NULL,
  entite_id uuid NOT NULL,
  numero text,
  -- L'identité, les réglages du type et la mise en page, tels qu'ils
  -- étaient. Le document se reconstruit à partir de là, et de rien
  -- d'autre.
  snapshot jsonb NOT NULL,
  emis_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  emis_le timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_emissions_piece
  ON public.document_emissions (store_id, type, entite, entite_id);
CREATE INDEX IF NOT EXISTS document_emissions_par_boutique
  ON public.document_emissions (store_id, emis_le DESC);

ALTER TABLE public.document_emissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_emissions_select ON public.document_emissions
  FOR SELECT USING (is_store_member(store_id));

CREATE POLICY document_emissions_insert ON public.document_emissions
  FOR INSERT WITH CHECK (store_allows_write(store_id));

-- Bar-karaoké : la consigne des bouteilles et des casiers.
--
-- Purement additif : deux tables neuves, aucune table existante touchée.
--
-- Un EMBALLAGE est ce qui se rend : « Bouteille THB 65 cl », « Casier
-- THB »… avec sa valeur de consigne. Ses MOUVEMENTS en tiennent le compte :
--   recu            — livré plein par le fournisseur : on lui en doit autant ;
--   rendu           — rendu vide au fournisseur : la dette baisse ;
--   perdu_paye      — cassé ou perdu, réglé en argent au fournisseur ;
--   client_emporte  — un client part avec, en laissant sa consigne ;
--   client_rapporte — il le rapporte, on lui rend sa consigne ;
--   correction      — un recomptage (quantité signée) sur la dette fournisseur.
--
-- Le journal ne se modifie pas : une erreur se corrige par un mouvement.
--
-- Lecture : tout membre. Emballages : le propriétaire. Mouvements : tout
-- membre, boutique ouverte.
--
-- Retour arrière : supabase/retours-arriere/20261119203951_bar_consigne.sql

CREATE TABLE IF NOT EXISTS public.bar_emballages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  nom        text NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 1 AND 80),
  consigne   numeric(14, 2) NOT NULL DEFAULT 0 CHECK (consigne >= 0),
  actif      boolean NOT NULL DEFAULT true,
  ordre      int NOT NULL DEFAULT 0,
  cree_le    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, nom)
);
CREATE INDEX IF NOT EXISTS idx_bar_emballages_boutique ON public.bar_emballages (store_id, ordre);

CREATE TABLE IF NOT EXISTS public.bar_mouvements_emballages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  emballage_id  uuid NOT NULL REFERENCES public.bar_emballages(id) ON DELETE CASCADE,
  genre         text NOT NULL CHECK (genre IN (
                  'recu', 'rendu', 'perdu_paye', 'client_emporte', 'client_rapporte', 'correction'
                )),
  quantite      int NOT NULL CHECK (
                  quantite BETWEEN -100000 AND 100000
                  AND (CASE WHEN genre = 'correction' THEN quantite <> 0 ELSE quantite > 0 END)
                ),
  -- L'argent qui accompagne le mouvement : consigne laissée ou rendue au
  -- client, perte réglée au fournisseur. 0 sinon.
  montant       numeric(14, 2) NOT NULL DEFAULT 0 CHECK (montant >= 0),
  note          text CHECK (note IS NULL OR char_length(note) <= 200),
  cree_par      uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  cree_le       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bar_mvt_emballages_boutique
  ON public.bar_mouvements_emballages (store_id, cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_bar_mvt_emballages_emballage
  ON public.bar_mouvements_emballages (emballage_id);

ALTER TABLE public.bar_emballages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_mouvements_emballages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bar_emballages, public.bar_mouvements_emballages FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_emballages TO authenticated;
GRANT SELECT, INSERT ON public.bar_mouvements_emballages TO authenticated;
GRANT ALL ON public.bar_emballages, public.bar_mouvements_emballages TO service_role;

DROP POLICY IF EXISTS bar_emballages_lecture ON public.bar_emballages;
CREATE POLICY bar_emballages_lecture ON public.bar_emballages
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS bar_emballages_reglage ON public.bar_emballages;
CREATE POLICY bar_emballages_reglage ON public.bar_emballages
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id))
  WITH CHECK (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id));

DROP POLICY IF EXISTS bar_mvt_emballages_lecture ON public.bar_mouvements_emballages;
CREATE POLICY bar_mvt_emballages_lecture ON public.bar_mouvements_emballages
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS bar_mvt_emballages_ajout ON public.bar_mouvements_emballages;
CREATE POLICY bar_mvt_emballages_ajout ON public.bar_mouvements_emballages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.store_allows_write(store_id)
    AND cree_par = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.bar_emballages e
       WHERE e.id = emballage_id AND e.store_id = bar_mouvements_emballages.store_id
    )
  );

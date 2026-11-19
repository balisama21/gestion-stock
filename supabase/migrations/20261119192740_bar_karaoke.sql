-- Bar-karaoké : zones, tables, notes ouvertes et leurs lignes.
--
-- Purement additif : quatre tables neuves et une fonction. Aucune table
-- existante n'est modifiée.
--
-- Une NOTE est l'addition en cours d'une table : on y ajoute les
-- consommations au fil de la soirée, puis on l'encaisse. L'encaissement
-- passe par `create_sale_ticket`, exactement comme la caisse : chaque
-- ligne devient une vente ordinaire, le stock sort à ce moment-là, et le
-- bilan, l'historique, les factures et le crédit client fonctionnent sans
-- rien savoir du bar.
--
-- Le droit de table (prix d'une table standard, d'une table VIP…) est
-- une ligne de la note comme une autre, sans produit : une prestation.
--
-- Lecture : tout membre de la boutique.
-- Écriture des zones et tables : le propriétaire.
-- Écriture des notes et lignes : tout membre, boutique ouverte, tant que
-- la note est ouverte et la ligne pas encore encaissée.
--
-- Retour arrière : supabase/retours-arriere/20261119192740_bar_karaoke.sql

-- ── Zones : Standard, VIP, Terrasse… ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.bar_zones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  nom          text NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 1 AND 60),
  -- Ce qu'une table de la zone paie, ajouté à son addition. 0 : rien.
  droit_table  numeric(14, 2) NOT NULL DEFAULT 0 CHECK (droit_table >= 0),
  ordre        int NOT NULL DEFAULT 0,
  cree_le      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bar_zones_boutique ON public.bar_zones (store_id, ordre);

-- ── Tables numérotées ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bar_tables (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  zone_id      uuid REFERENCES public.bar_zones(id) ON DELETE SET NULL,
  numero       text NOT NULL CHECK (char_length(btrim(numero)) BETWEEN 1 AND 20),
  places       int CHECK (places IS NULL OR places BETWEEN 1 AND 200),
  -- NULL : le droit de table de sa zone.
  droit_table  numeric(14, 2) CHECK (droit_table IS NULL OR droit_table >= 0),
  active       boolean NOT NULL DEFAULT true,
  ordre        int NOT NULL DEFAULT 0,
  cree_le      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_bar_tables_boutique ON public.bar_tables (store_id, ordre);

-- ── Notes : l'addition d'une table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bar_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_id           uuid NOT NULL REFERENCES public.bar_tables(id) ON DELETE RESTRICT,
  statut             text NOT NULL DEFAULT 'ouverte'
                       CHECK (statut IN ('ouverte', 'encaissee', 'annulee')),
  client_id          uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  nb_personnes       int CHECK (nb_personnes IS NULL OR nb_personnes BETWEEN 1 AND 500),
  ouverte_par        uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  ouverte_le         timestamptz NOT NULL DEFAULT now(),
  fermee_le          timestamptz,
  motif_annulation   text CHECK (motif_annulation IS NULL OR char_length(motif_annulation) <= 200)
);
-- Une seule note ouverte par table.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bar_notes_ouverte
  ON public.bar_notes (table_id) WHERE statut = 'ouverte';
CREATE INDEX IF NOT EXISTS idx_bar_notes_boutique ON public.bar_notes (store_id, statut, ouverte_le DESC);

-- ── Lignes d'une note ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bar_note_lignes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  note_id      uuid NOT NULL REFERENCES public.bar_notes(id) ON DELETE CASCADE,
  -- NULL : une prestation (le droit de table), sans stock.
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  designation  text NOT NULL CHECK (char_length(btrim(designation)) BETWEEN 1 AND 200),
  genre        text NOT NULL DEFAULT 'article' CHECK (genre IN ('article', 'droit_table')),
  quantite     int NOT NULL CHECK (quantite BETWEEN 1 AND 10000),
  prix_unit    numeric(14, 2) NOT NULL CHECK (prix_unit >= 0),
  -- Offert par la maison : sort du stock, encaissé à 0.
  offert       boolean NOT NULL DEFAULT false,
  serveur      text CHECK (serveur IS NULL OR char_length(serveur) <= 80),
  annulee      boolean NOT NULL DEFAULT false,
  motif        text CHECK (motif IS NULL OR char_length(motif) <= 200),
  -- La vente née de l'encaissement : posée par `encaisser_note_bar`.
  sale_id      uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  cree_par     uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  cree_le      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bar_note_lignes_note ON public.bar_note_lignes (note_id, cree_le);
CREATE INDEX IF NOT EXISTS idx_bar_note_lignes_boutique ON public.bar_note_lignes (store_id);

-- ── Droits ────────────────────────────────────────────────────────
ALTER TABLE public.bar_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_note_lignes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bar_zones, public.bar_tables, public.bar_notes, public.bar_note_lignes
  FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_zones, public.bar_tables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bar_notes, public.bar_note_lignes TO authenticated;
GRANT ALL ON public.bar_zones, public.bar_tables, public.bar_notes, public.bar_note_lignes
  TO service_role;

-- Zones et tables : lues par l'équipe, réglées par le propriétaire.
DROP POLICY IF EXISTS bar_zones_lecture ON public.bar_zones;
CREATE POLICY bar_zones_lecture ON public.bar_zones
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS bar_zones_reglage ON public.bar_zones;
CREATE POLICY bar_zones_reglage ON public.bar_zones
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id))
  WITH CHECK (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id));

DROP POLICY IF EXISTS bar_tables_lecture ON public.bar_tables;
CREATE POLICY bar_tables_lecture ON public.bar_tables
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS bar_tables_reglage ON public.bar_tables;
CREATE POLICY bar_tables_reglage ON public.bar_tables
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id))
  WITH CHECK (
    public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id)
    AND (zone_id IS NULL OR EXISTS (
      SELECT 1 FROM public.bar_zones z WHERE z.id = zone_id AND z.store_id = bar_tables.store_id
    ))
  );

-- Notes : l'équipe les ouvre et les tient ; une note close ne bouge plus.
DROP POLICY IF EXISTS bar_notes_lecture ON public.bar_notes;
CREATE POLICY bar_notes_lecture ON public.bar_notes
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS bar_notes_ouverture ON public.bar_notes;
CREATE POLICY bar_notes_ouverture ON public.bar_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.store_allows_write(store_id) AND statut = 'ouverte'
    AND EXISTS (
      SELECT 1 FROM public.bar_tables t
       WHERE t.id = table_id AND t.store_id = bar_notes.store_id AND t.active
    )
    AND (client_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.store_id = bar_notes.store_id
    ))
  );
DROP POLICY IF EXISTS bar_notes_tenue ON public.bar_notes;
CREATE POLICY bar_notes_tenue ON public.bar_notes
  FOR UPDATE TO authenticated
  USING (public.store_allows_write(store_id) AND statut = 'ouverte')
  WITH CHECK (
    public.store_allows_write(store_id)
    AND EXISTS (
      SELECT 1 FROM public.bar_tables t
       WHERE t.id = table_id AND t.store_id = bar_notes.store_id
    )
    AND (client_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.store_id = bar_notes.store_id
    ))
  );

-- Lignes : ajoutées et corrigées tant que la note est ouverte et la
-- ligne pas encaissée. Le lien vers la vente n'est posé que par la
-- fonction d'encaissement.
DROP POLICY IF EXISTS bar_note_lignes_lecture ON public.bar_note_lignes;
CREATE POLICY bar_note_lignes_lecture ON public.bar_note_lignes
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS bar_note_lignes_ajout ON public.bar_note_lignes;
CREATE POLICY bar_note_lignes_ajout ON public.bar_note_lignes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.store_allows_write(store_id) AND sale_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.bar_notes n
       WHERE n.id = note_id AND n.store_id = bar_note_lignes.store_id AND n.statut = 'ouverte'
    )
    AND (product_id IS NULL OR EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.id = product_id AND p.store_id = bar_note_lignes.store_id
    ))
  );
DROP POLICY IF EXISTS bar_note_lignes_correction ON public.bar_note_lignes;
CREATE POLICY bar_note_lignes_correction ON public.bar_note_lignes
  FOR UPDATE TO authenticated
  USING (public.store_allows_write(store_id) AND sale_id IS NULL)
  WITH CHECK (
    public.store_allows_write(store_id) AND sale_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.bar_notes n
       WHERE n.id = note_id AND n.store_id = bar_note_lignes.store_id AND n.statut = 'ouverte'
    )
  );

-- Ni boutique, ni note, ni produit ne changent après coup.
CREATE OR REPLACE FUNCTION public.bar_note_lignes_fige()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Changer de note (regrouper deux tables) reste permis : la règle
  -- d'écriture exige une note ouverte de la même boutique.
  IF NEW.store_id <> OLD.store_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.genre <> OLD.genre THEN
    RAISE EXCEPTION 'Une ligne de note ne change ni de boutique ni de produit.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bar_note_lignes_fige ON public.bar_note_lignes;
CREATE TRIGGER bar_note_lignes_fige
  BEFORE UPDATE ON public.bar_note_lignes
  FOR EACH ROW EXECUTE FUNCTION public.bar_note_lignes_fige();

CREATE OR REPLACE FUNCTION public.bar_notes_fige()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id <> OLD.store_id THEN
    RAISE EXCEPTION 'Une note ne change pas de boutique.' USING ERRCODE = '42501';
  END IF;
  -- Encaissée : seule la fonction d'encaissement (propriétaire de la
  -- fonction, pas l'utilisateur) la ferme ainsi.
  IF NEW.statut = 'encaissee' AND OLD.statut <> 'encaissee'
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Une note se ferme en l''encaissant.' USING ERRCODE = '42501';
  END IF;
  -- Annuler une note déjà payée en partie effacerait des ventes de la
  -- soirée : on encaisse ou on annule ligne par ligne.
  IF NEW.statut = 'annulee' AND OLD.statut <> 'annulee' AND EXISTS (
    SELECT 1 FROM public.bar_note_lignes WHERE note_id = NEW.id AND sale_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Une partie de cette note est déjà encaissée : elle ne s''annule plus.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.statut <> 'ouverte' AND NEW.fermee_le IS NULL THEN
    NEW.fermee_le := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bar_notes_fige ON public.bar_notes;
CREATE TRIGGER bar_notes_fige
  BEFORE UPDATE ON public.bar_notes
  FOR EACH ROW EXECUTE FUNCTION public.bar_notes_fige();

REVOKE ALL ON FUNCTION public.bar_note_lignes_fige() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bar_notes_fige() FROM PUBLIC, anon, authenticated;

-- ── Encaisser tout ou partie d'une note ───────────────────────────
--
-- `p_ligne_ids` NULL : toute la note. Sinon, les lignes choisies (pour
-- diviser l'addition) ; la note reste ouverte tant qu'il reste des
-- lignes à payer.
--
-- Les lignes identiques (même produit, même prix, même offert) se
-- regroupent en une seule vente : « 6 THB » plutôt que six lignes « 1 THB ».
CREATE OR REPLACE FUNCTION public.encaisser_note_bar(
  p_note_id uuid,
  p_ligne_ids uuid[],
  p_date date,
  p_vendeur text,
  p_client_id uuid,
  p_montant_paye numeric,
  p_methode text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note     public.bar_notes;
  v_lignes   jsonb := '[]'::jsonb;
  v_groupes  jsonb := '[]'::jsonb;
  v_groupe   jsonb;
  v_index    int := 0;
  v_ticket   jsonb;
  v_vente_id uuid;
  v_client   text;
  v_ticket_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Clé d''encaissement manquante.';
  END IF;

  SELECT * INTO v_note FROM public.bar_notes WHERE id = p_note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note introuvable.'; END IF;
  IF NOT public.store_allows_write(v_note.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;

  -- Rejoué (double clic, réseau) : on rend le ticket déjà créé.
  SELECT s.ticket_id INTO v_ticket_id
    FROM public.sales s WHERE s.idempotency_key = p_idempotency_key || ':1';
  IF v_ticket_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ticket_id', v_ticket_id,
      'ventes', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
                   FROM public.sales s WHERE s.ticket_id = v_ticket_id)
    );
  END IF;

  IF v_note.statut <> 'ouverte' THEN RAISE EXCEPTION 'Cette note est déjà close.'; END IF;

  -- Les groupes à encaisser, dans l'ordre où ils ont été servis.
  SELECT COALESCE(jsonb_agg(g ORDER BY g.premier), '[]'::jsonb) INTO v_groupes
    FROM (
      SELECT l.product_id,
             l.designation,
             CASE WHEN l.offert THEN 0 ELSE l.prix_unit END AS prix,
             SUM(l.quantite)::int AS quantite,
             array_agg(l.id) AS ids,
             MIN(l.cree_le) AS premier
        FROM public.bar_note_lignes l
       WHERE l.note_id = p_note_id
         AND NOT l.annulee
         AND l.sale_id IS NULL
         AND (p_ligne_ids IS NULL OR l.id = ANY (p_ligne_ids))
       GROUP BY l.product_id, l.designation, CASE WHEN l.offert THEN 0 ELSE l.prix_unit END
    ) g;

  IF jsonb_array_length(v_groupes) = 0 THEN
    RAISE EXCEPTION 'Rien à encaisser sur cette note.';
  END IF;

  FOR v_groupe IN SELECT * FROM jsonb_array_elements(v_groupes) LOOP
    v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
      'product_id', COALESCE(v_groupe->>'product_id', ''),
      'quantite', (v_groupe->>'quantite')::int,
      'prix_vente_unit', (v_groupe->>'prix')::numeric,
      'designation', v_groupe->>'designation'
    ));
  END LOOP;

  SELECT NULLIF(btrim(concat_ws(' ', prenom, nom)), '') INTO v_client FROM public.clients
   WHERE id = COALESCE(p_client_id, v_note.client_id) AND store_id = v_note.store_id;

  v_ticket := public.create_sale_ticket(
    v_note.store_id, p_date, p_vendeur, v_client, COALESCE(p_client_id, v_note.client_id),
    p_montant_paye, p_methode, v_lignes, p_idempotency_key
  );

  -- Chaque groupe pointe vers sa vente : `create_sale_ticket` donne à la
  -- n-ième ligne la clé `<clé>:n`.
  FOR v_groupe IN SELECT * FROM jsonb_array_elements(v_groupes) LOOP
    v_index := v_index + 1;
    SELECT id INTO v_vente_id FROM public.sales
     WHERE idempotency_key = p_idempotency_key || ':' || v_index;
    UPDATE public.bar_note_lignes
       SET sale_id = v_vente_id
     WHERE id IN (SELECT jsonb_array_elements_text(v_groupe->'ids')::uuid);
  END LOOP;

  -- Plus rien à payer : la note se ferme, la table se libère.
  IF NOT EXISTS (
    SELECT 1 FROM public.bar_note_lignes
     WHERE note_id = p_note_id AND NOT annulee AND sale_id IS NULL
  ) THEN
    UPDATE public.bar_notes SET statut = 'encaissee', fermee_le = now() WHERE id = p_note_id;
  END IF;

  RETURN v_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.encaisser_note_bar(uuid, uuid[], date, text, uuid, numeric, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encaisser_note_bar(uuid, uuid[], date, text, uuid, numeric, text, text)
  TO authenticated;

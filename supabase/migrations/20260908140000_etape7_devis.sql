-- ═══════════════════════════════════════════════════════════════════
-- Étape 7a — les devis
--
-- POURQUOI UN DEVIS MÈNE À UNE VENTE, ET NON À UNE COMMANDE
--
-- Les commandes existent en base depuis longtemps, avec leurs lignes,
-- leur client, leurs paiements et leur cycle réserver → livrer. Mais
-- elles n'ont jamais servi : zéro commande enregistrée, contre vingt et
-- une ventes. Ce que fait la boutique, c'est vendre au comptoir. Un
-- devis accepté doit donc remplir le panier, pas ouvrir une commande
-- dans un module que personne n'utilise.
--
-- CE QU'UN DEVIS N'EST PAS
--
-- Il ne touche ni au stock ni à la caisse : c'est une proposition de
-- prix, pas un engagement. Rien n'est réservé, rien n'est décrémenté.
-- C'est précisément ce qui manquait — commandes et ventes engagent
-- toutes deux le stock dès leur écriture.
--
-- LE NUMÉRO
--
-- Même mécanique que les ventes et les achats : `next_store_counter`,
-- par boutique, dans un déclencheur BEFORE INSERT. Un devis reçoit donc
-- DEV001, DEV002… sans trou et sans collision entre boutiques.
--
-- CE QUI EST FIGÉ
--
-- Un devis accepté a servi de base à une vente : ses lignes ne peuvent
-- plus bouger, et il ne peut plus être supprimé. Sinon le montant qu'on
-- relit des mois après ne serait plus celui qui a été proposé.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS quotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  numero      TEXT,
  -- Le client peut être une fiche, ou seulement un nom : on établit des
  -- devis pour des gens qui ne sont pas encore clients.
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_nom  TEXT NOT NULL DEFAULT '',

  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  valide_jusqu_au   DATE,
  statut            TEXT NOT NULL DEFAULT 'brouillon'
                    CHECK (statut IN ('brouillon', 'envoye', 'accepte', 'refuse')),
  note              TEXT,

  -- Entretenu par déclencheur depuis les lignes, jamais écrit à la main.
  total       NUMERIC NOT NULL DEFAULT 0,

  -- Le ticket de la vente issue du devis, quand il a été accepté.
  vente_ticket_id UUID,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Le couple référencé par les lignes doit exister comme clé, comme pour
-- les règlements fournisseurs : sans cela on pourrait écrire une ligne
-- dont la boutique diffère de celle du devis, et la RLS regarderait la
-- mauvaise.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_id_store_key') THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_id_store_key UNIQUE (id, store_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_store_numero
  ON quotes (store_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_store_date ON quotes (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes (client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS quote_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID NOT NULL,
  store_id    UUID NOT NULL,
  FOREIGN KEY (quote_id, store_id) REFERENCES quotes (id, store_id) ON DELETE CASCADE,

  -- Une ligne peut désigner un produit du catalogue, ou décrire une
  -- prestation qui n'y figure pas.
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  designation TEXT NOT NULL,
  quantite    INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC NOT NULL CHECK (prix_unitaire >= 0),
  total       NUMERIC GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
  ordre       INTEGER NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_devis ON quote_items (quote_id, ordre);

-- ── Le numéro ──
CREATE OR REPLACE FUNCTION public.assign_quote_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'DEV' || LPAD(next_store_counter(NEW.store_id, 'quote')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_quote_numero ON quotes;
CREATE TRIGGER trg_assign_quote_numero
  BEFORE INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION assign_quote_numero();

-- ── Le total suit les lignes ──
CREATE OR REPLACE FUNCTION public.recalculer_total_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE cible UUID;
BEGIN
  cible := COALESCE(NEW.quote_id, OLD.quote_id);
  UPDATE quotes
  SET total = COALESCE((SELECT SUM(total) FROM quote_items WHERE quote_id = cible), 0),
      updated_at = NOW()
  WHERE id = cible;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalculer_total_devis ON quote_items;
CREATE TRIGGER trg_recalculer_total_devis
  AFTER INSERT OR UPDATE OR DELETE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION recalculer_total_devis();

-- ── Un devis accepté ne bouge plus ──
CREATE OR REPLACE FUNCTION public.devis_accepte_est_fige()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_statut TEXT;
BEGIN
  SELECT statut INTO v_statut FROM quotes WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  -- Le devis parent peut avoir déjà disparu : on est alors dans la
  -- cascade de sa propre suppression, qui a ses propres règles.
  IF FOUND AND v_statut = 'accepte' THEN
    RAISE EXCEPTION 'Ce devis a été accepté : ses lignes ne peuvent plus être modifiées.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_devis_accepte_est_fige ON quote_items;
CREATE TRIGGER trg_devis_accepte_est_fige
  BEFORE INSERT OR UPDATE OR DELETE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION devis_accepte_est_fige();

-- ── Qui voit quoi ──
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "quotes_insert" ON quotes;
CREATE POLICY "quotes_insert" ON quotes FOR INSERT
  WITH CHECK (store_allows_write(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "quotes_update" ON quotes;
CREATE POLICY "quotes_update" ON quotes FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

-- Un devis accepté a servi de base à une vente : il reste.
DROP POLICY IF EXISTS "quotes_delete" ON quotes;
CREATE POLICY "quotes_delete" ON quotes FOR DELETE
  USING (can_modify_in_store(created_by, store_id) AND statut <> 'accepte');

DROP POLICY IF EXISTS "quote_items_select" ON quote_items;
CREATE POLICY "quote_items_select" ON quote_items FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "quote_items_insert" ON quote_items;
CREATE POLICY "quote_items_insert" ON quote_items FOR INSERT
  WITH CHECK (store_allows_write(store_id));

DROP POLICY IF EXISTS "quote_items_update" ON quote_items;
CREATE POLICY "quote_items_update" ON quote_items FOR UPDATE
  USING (store_allows_write(store_id));

DROP POLICY IF EXISTS "quote_items_delete" ON quote_items;
CREATE POLICY "quote_items_delete" ON quote_items FOR DELETE
  USING (store_allows_write(store_id));

-- ═══════════════════════════════════════════════════════════════════
-- Les operations, en une transaction chacune
--
-- Un devis et ses lignes s ecrivent ensemble ou pas du tout : un
-- document a moitie ecrit se relirait comme un devis a moins de lignes,
-- donc a un total faux, sans que rien ne le signale.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_quote(
  p_store_id uuid,
  p_client_id uuid,
  p_client_nom text,
  p_date date,
  p_valide_jusqu_au date,
  p_note text,
  p_lignes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_devis uuid;
  v_ligne jsonb;
  v_ordre int := 0;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifie.'; END IF;
  IF NOT store_allows_write(p_store_id) THEN RAISE EXCEPTION 'Non autorise.'; END IF;
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Un devis sans ligne ne propose rien.';
  END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  INSERT INTO quotes (store_id, created_by, client_id, client_nom, date,
                      valide_jusqu_au, note)
  VALUES (p_store_id, v_owner, p_client_id, COALESCE(p_client_nom, ''),
          COALESCE(p_date, CURRENT_DATE), p_valide_jusqu_au, p_note)
  RETURNING id INTO v_devis;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_ordre := v_ordre + 1;
    INSERT INTO quote_items (quote_id, store_id, product_id, designation,
                             quantite, prix_unitaire, ordre)
    VALUES (v_devis, p_store_id,
            NULLIF(v_ligne->>'product_id', '')::uuid,
            v_ligne->>'designation',
            (v_ligne->>'quantite')::int,
            (v_ligne->>'prix_unitaire')::numeric,
            v_ordre);
  END LOOP;

  RETURN (SELECT to_jsonb(q) FROM quotes q WHERE q.id = v_devis);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_quote(
  p_quote_id uuid,
  p_client_id uuid,
  p_client_nom text,
  p_date date,
  p_valide_jusqu_au date,
  p_note text,
  p_lignes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
  v_createur uuid;
  v_statut text;
  v_ligne jsonb;
  v_ordre int := 0;
BEGIN
  SELECT store_id, created_by, statut INTO v_store, v_createur, v_statut
    FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devis introuvable.'; END IF;
  IF NOT can_modify_in_store(v_createur, v_store) THEN
    RAISE EXCEPTION 'Non autorise.';
  END IF;
  IF v_statut = 'accepte' THEN
    RAISE EXCEPTION 'Ce devis a ete accepte : il ne peut plus etre modifie.';
  END IF;
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Un devis sans ligne ne propose rien.';
  END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = v_store
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  UPDATE quotes
  SET client_id = p_client_id,
      client_nom = COALESCE(p_client_nom, ''),
      date = COALESCE(p_date, date),
      valide_jusqu_au = p_valide_jusqu_au,
      note = p_note,
      updated_at = NOW()
  WHERE id = p_quote_id;

  -- Les lignes sont remplacees en bloc : l ecran les edite comme un
  -- tout, et suivre ligne a ligne ce qui a change couterait plus cher
  -- qu il ne rapporte sur un document de quelques lignes.
  DELETE FROM quote_items WHERE quote_id = p_quote_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_ordre := v_ordre + 1;
    INSERT INTO quote_items (quote_id, store_id, product_id, designation,
                             quantite, prix_unitaire, ordre)
    VALUES (p_quote_id, v_store,
            NULLIF(v_ligne->>'product_id', '')::uuid,
            v_ligne->>'designation',
            (v_ligne->>'quantite')::int,
            (v_ligne->>'prix_unitaire')::numeric,
            v_ordre);
  END LOOP;

  RETURN (SELECT to_jsonb(q) FROM quotes q WHERE q.id = p_quote_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_quote_status(
  p_quote_id uuid,
  p_statut text,
  p_vente_ticket_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
  v_createur uuid;
  v_statut text;
BEGIN
  SELECT store_id, created_by, statut INTO v_store, v_createur, v_statut
    FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devis introuvable.'; END IF;
  IF NOT can_modify_in_store(v_createur, v_store) THEN
    RAISE EXCEPTION 'Non autorise.';
  END IF;
  IF p_statut NOT IN ('brouillon', 'envoye', 'accepte', 'refuse') THEN
    RAISE EXCEPTION 'Statut inconnu : %.', p_statut;
  END IF;
  -- Un devis accepte a servi de base a une vente : le rouvrir
  -- laisserait croire qu on peut encore en changer les prix.
  IF v_statut = 'accepte' AND p_statut <> 'accepte' THEN
    RAISE EXCEPTION 'Ce devis a ete accepte : son statut ne change plus.';
  END IF;

  UPDATE quotes
  SET statut = p_statut,
      vente_ticket_id = COALESCE(p_vente_ticket_id, vente_ticket_id),
      updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN (SELECT to_jsonb(q) FROM quotes q WHERE q.id = p_quote_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_quote(uuid, uuid, text, date, date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quote(uuid, uuid, text, date, date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_quote_status(uuid, text, uuid) TO authenticated;

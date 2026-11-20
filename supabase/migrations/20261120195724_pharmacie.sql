-- Pharmacie : fiches médicament, lots et péremptions, ordonnancier,
-- tiers payant.
--
-- Purement additif : cinq tables neuves, des fonctions, et un
-- déclencheur sur `stock_movements` qui ne touche QUE les produits
-- rangés en lots. Aucune table existante n'est modifiée ; une boutique
-- sans lot (toutes les boutiques actuelles) ne voit aucune différence.
--
-- LE PRINCIPE DES LOTS
--
-- Le stock d'un produit reste `products.stock_actuel`, tenu par les
-- fonctions existantes (ventes, achats, ajustements, commandes). Les
-- lots en sont le DÉTAIL : combien de boîtes de chaque numéro de lot,
-- et quand elles périment. La somme des lots ne dépasse jamais le stock ;
-- l'écart éventuel est du stock « sans date » (reçu avant d'utiliser les
-- lots, ou entré par un ajustement), que la pharmacie peut dater.
--
-- Chaque mouvement de stock d'un produit à lots est suivi par un
-- déclencheur :
-- — une sortie (vente, livraison de commande, inventaire en baisse)
--   prend dans le lot qui périme le premier, les lots déjà périmés en
--   dernier ;
-- — une vente annulée rend ses boîtes aux lots d'où elles venaient ;
-- — une réception passe par `pharma_recevoir`, qui crée l'achat ET le lot.
-- Chaque geste sur un lot laisse une ligne dans `pharma_lot_mouvements` :
-- on sait à qui un lot a été vendu (rappel de lot).
--
-- Retour arrière : supabase/retours-arriere/20261120195724_pharmacie.sql

-- ── Fiche médicament (une par produit) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.pharma_fiches (
  product_id   uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- La molécule (dénomination commune), pour trouver les équivalents.
  dci          text CHECK (dci IS NULL OR char_length(dci) <= 200),
  dosage       text CHECK (dosage IS NULL OR char_length(dosage) <= 80),
  forme        text CHECK (forme IS NULL OR char_length(forme) <= 60),
  laboratoire  text CHECK (laboratoire IS NULL OR char_length(laboratoire) <= 120),
  -- Rayon, tiroir, étagère.
  emplacement  text CHECK (emplacement IS NULL OR char_length(emplacement) <= 60),
  regime       text NOT NULL DEFAULT 'libre'
                 CHECK (regime IN ('libre', 'ordonnance', 'liste_I', 'liste_II', 'stupefiant')),
  conservation text NOT NULL DEFAULT 'ambiante' CHECK (conservation IN ('ambiante', 'frais')),
  notes        text CHECK (notes IS NULL OR char_length(notes) <= 500),
  modifie_le   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharma_fiches_dci ON public.pharma_fiches (store_id, lower(dci));

-- ── Lots ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pharma_lots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  numero_lot       text CHECK (numero_lot IS NULL OR char_length(btrim(numero_lot)) BETWEEN 1 AND 60),
  -- NULL : date inconnue.
  date_peremption  date,
  quantite_recue   int NOT NULL CHECK (quantite_recue > 0),
  -- Ce qui en reste en rayon, en unités de base du produit.
  quantite         int NOT NULL CHECK (quantite >= 0 AND quantite <= quantite_recue),
  prix_achat_unit  numeric(14, 2) CHECK (prix_achat_unit IS NULL OR prix_achat_unit >= 0),
  fournisseur      text CHECK (fournisseur IS NULL OR char_length(fournisseur) <= 120),
  purchase_id      uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  recu_le          date NOT NULL DEFAULT current_date,
  cree_par         uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  cree_le          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharma_lots_produit
  ON public.pharma_lots (product_id, date_peremption) WHERE quantite > 0;
CREATE INDEX IF NOT EXISTS idx_pharma_lots_boutique ON public.pharma_lots (store_id, date_peremption);

-- ── Ce qui entre et sort de chaque lot ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.pharma_lot_mouvements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  lot_id          uuid NOT NULL REFERENCES public.pharma_lots(id) ON DELETE CASCADE,
  quantite        int NOT NULL CHECK (quantite <> 0),
  motif           text NOT NULL
                    CHECK (motif IN ('reception', 'stock_date', 'vente', 'retour', 'retrait', 'correction')),
  detail          text CHECK (detail IS NULL OR char_length(detail) <= 200),
  -- La vente, l'achat ou la commande à l'origine du geste.
  reference_type  text,
  reference_id    uuid,
  cree_par        uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  cree_le         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharma_lot_mvt_lot ON public.pharma_lot_mouvements (lot_id, cree_le);
CREATE INDEX IF NOT EXISTS idx_pharma_lot_mvt_ref ON public.pharma_lot_mouvements (reference_id);
CREATE INDEX IF NOT EXISTS idx_pharma_lot_mvt_boutique ON public.pharma_lot_mouvements (store_id, cree_le DESC);

-- ── Tiers payant : assurances, mutuelles, employeurs ──────────────
-- Un organisme est un client de la boutique : ce qu'il doit se suit
-- comme tout crédit client, et se règle de la même façon.
CREATE TABLE IF NOT EXISTS public.pharma_organismes (
  client_id   uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- La part qu'il prend en charge, en pourcentage.
  taux        numeric(5, 2) NOT NULL DEFAULT 80 CHECK (taux > 0 AND taux <= 100),
  convention  text CHECK (convention IS NULL OR char_length(convention) <= 120),
  actif       boolean NOT NULL DEFAULT true,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharma_organismes_boutique ON public.pharma_organismes (store_id);

-- ── Ordonnancier ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pharma_ordonnances (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- Numéro d'ordre dans le registre de la boutique, posé à l'écriture.
  numero             int NOT NULL DEFAULT 0,
  date_delivrance    date NOT NULL DEFAULT current_date,
  patient_nom        text NOT NULL CHECK (char_length(btrim(patient_nom)) BETWEEN 1 AND 120),
  patient_age        text CHECK (patient_age IS NULL OR char_length(patient_age) <= 20),
  patient_telephone  text CHECK (patient_telephone IS NULL OR char_length(patient_telephone) <= 40),
  patient_client_id  uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  prescripteur       text CHECK (prescripteur IS NULL OR char_length(prescripteur) <= 120),
  date_prescription  date,
  organisme_id       uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  matricule          text CHECK (matricule IS NULL OR char_length(matricule) <= 60),
  part_organisme     numeric(14, 2) NOT NULL DEFAULT 0 CHECK (part_organisme >= 0),
  -- Le ticket de caisse de la délivrance (`sales.ticket_id`).
  ticket_id          uuid,
  notes              text CHECK (notes IS NULL OR char_length(notes) <= 500),
  cree_par           uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  cree_le            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pharma_ordonnances_numero
  ON public.pharma_ordonnances (store_id, numero);
CREATE INDEX IF NOT EXISTS idx_pharma_ordonnances_boutique
  ON public.pharma_ordonnances (store_id, date_delivrance DESC);
CREATE INDEX IF NOT EXISTS idx_pharma_ordonnances_ticket ON public.pharma_ordonnances (ticket_id);

CREATE OR REPLACE FUNCTION public.pharma_numeroter_ordonnance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Deux comptoirs qui écrivent en même temps : l'un attend l'autre.
  PERFORM pg_advisory_xact_lock(hashtext('pharma_ordonnances:' || NEW.store_id::text));
  SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
    FROM public.pharma_ordonnances WHERE store_id = NEW.store_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pharma_numeroter_ordonnance ON public.pharma_ordonnances;
CREATE TRIGGER pharma_numeroter_ordonnance
  BEFORE INSERT ON public.pharma_ordonnances
  FOR EACH ROW EXECUTE FUNCTION public.pharma_numeroter_ordonnance();

-- ── Droits ────────────────────────────────────────────────────────
ALTER TABLE public.pharma_fiches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_lot_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_organismes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_ordonnances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pharma_fiches, public.pharma_lots, public.pharma_lot_mouvements,
  public.pharma_organismes, public.pharma_ordonnances FROM anon, PUBLIC;
-- Lots et mouvements : en lecture seule ; ils ne s'écrivent que par les fonctions.
GRANT SELECT ON public.pharma_lots, public.pharma_lot_mouvements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharma_fiches, public.pharma_organismes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pharma_ordonnances TO authenticated;
GRANT ALL ON public.pharma_fiches, public.pharma_lots, public.pharma_lot_mouvements,
  public.pharma_organismes, public.pharma_ordonnances TO service_role;

DROP POLICY IF EXISTS pharma_fiches_lecture ON public.pharma_fiches;
CREATE POLICY pharma_fiches_lecture ON public.pharma_fiches
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS pharma_fiches_ecriture ON public.pharma_fiches;
CREATE POLICY pharma_fiches_ecriture ON public.pharma_fiches
  FOR ALL TO authenticated
  USING (public.store_allows_write(store_id))
  WITH CHECK (
    public.store_allows_write(store_id)
    AND EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.id = product_id AND p.store_id = pharma_fiches.store_id
    )
  );

DROP POLICY IF EXISTS pharma_lots_lecture ON public.pharma_lots;
CREATE POLICY pharma_lots_lecture ON public.pharma_lots
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS pharma_lot_mvt_lecture ON public.pharma_lot_mouvements;
CREATE POLICY pharma_lot_mvt_lecture ON public.pharma_lot_mouvements
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));

-- Organismes : lus par l'équipe (au comptoir), réglés par le propriétaire.
DROP POLICY IF EXISTS pharma_organismes_lecture ON public.pharma_organismes;
CREATE POLICY pharma_organismes_lecture ON public.pharma_organismes
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS pharma_organismes_reglage ON public.pharma_organismes;
CREATE POLICY pharma_organismes_reglage ON public.pharma_organismes
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id))
  WITH CHECK (
    public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id)
    AND EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = client_id AND c.store_id = pharma_organismes.store_id
    )
  );

-- Ordonnancier : l'équipe écrit, seul le propriétaire corrige ; on ne
-- supprime pas une ligne d'un registre.
DROP POLICY IF EXISTS pharma_ordonnances_lecture ON public.pharma_ordonnances;
CREATE POLICY pharma_ordonnances_lecture ON public.pharma_ordonnances
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS pharma_ordonnances_ecriture ON public.pharma_ordonnances;
CREATE POLICY pharma_ordonnances_ecriture ON public.pharma_ordonnances
  FOR INSERT TO authenticated
  WITH CHECK (
    public.store_allows_write(store_id)
    AND (patient_client_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = patient_client_id AND c.store_id = pharma_ordonnances.store_id
    ))
    AND (organisme_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = organisme_id AND c.store_id = pharma_ordonnances.store_id
    ))
  );
DROP POLICY IF EXISTS pharma_ordonnances_correction ON public.pharma_ordonnances;
CREATE POLICY pharma_ordonnances_correction ON public.pharma_ordonnances
  FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id))
  WITH CHECK (public.is_store_owner(store_id) AND NOT public.store_is_locked(store_id));

CREATE OR REPLACE FUNCTION public.pharma_ordonnance_fige()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id <> OLD.store_id OR NEW.numero <> OLD.numero THEN
    RAISE EXCEPTION 'Une ligne de l''ordonnancier garde sa boutique et son numéro.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pharma_ordonnance_fige ON public.pharma_ordonnances;
CREATE TRIGGER pharma_ordonnance_fige
  BEFORE UPDATE ON public.pharma_ordonnances
  FOR EACH ROW EXECUTE FUNCTION public.pharma_ordonnance_fige();

-- ── Le suivi des lots, à chaque mouvement de stock ────────────────
CREATE OR REPLACE FUNCTION public.pharma_suivre_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reste int;
  v_part  int;
  v_lot   record;
  v_motif text;
BEGIN
  IF NEW.product_id IS NULL OR NEW.stock_actuel_delta = 0 THEN RETURN NEW; END IF;
  -- Une fonction qui gère elle-même ses lots (retrait d'un lot précis).
  IF COALESCE(current_setting('pharma.lots_geres', true), '') = 'oui' THEN RETURN NEW; END IF;
  -- Un produit sans lot (toutes les boutiques hors pharmacie) : rien à faire.
  IF NOT EXISTS (SELECT 1 FROM public.pharma_lots WHERE product_id = NEW.product_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_actuel_delta < 0 THEN
    v_reste := -NEW.stock_actuel_delta;
    v_motif := CASE
      WHEN NEW.type_mouvement IN ('vente', 'vente_modification', 'commande_livraison') THEN 'vente'
      ELSE 'correction'
    END;
    FOR v_lot IN
      SELECT l.id, l.quantite
        FROM public.pharma_lots l
       WHERE l.product_id = NEW.product_id AND l.quantite > 0
       ORDER BY
         -- Supprimer un achat retire d'abord le lot qu'il avait apporté.
         (NEW.type_mouvement = 'achat_suppression' AND EXISTS (
            SELECT 1 FROM public.pharma_lot_mouvements m
             WHERE m.lot_id = l.id AND m.motif = 'reception' AND m.reference_id = NEW.reference_id
         )) DESC,
         -- Le premier qui périme sort le premier ; un lot déjà périmé, en dernier.
         (l.date_peremption IS NOT NULL AND l.date_peremption < current_date) ASC,
         l.date_peremption ASC NULLS LAST,
         l.cree_le ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_reste <= 0;
      v_part := LEAST(v_reste, v_lot.quantite);
      UPDATE public.pharma_lots SET quantite = quantite - v_part WHERE id = v_lot.id;
      INSERT INTO public.pharma_lot_mouvements
        (store_id, lot_id, quantite, motif, detail, reference_type, reference_id, cree_par)
      VALUES
        (NEW.store_id, v_lot.id, -v_part, v_motif, NEW.type_mouvement,
         NEW.reference_type, NEW.reference_id, NEW.created_by);
      v_reste := v_reste - v_part;
    END LOOP;
  ELSIF NEW.type_mouvement IN ('vente_suppression', 'vente_modification',
                               'commande_annulation_apres_livraison')
        AND NEW.reference_id IS NOT NULL THEN
    -- Une vente annulée rend ses boîtes aux lots d'où elles étaient sorties.
    v_reste := NEW.stock_actuel_delta;
    FOR v_lot IN
      SELECT m.lot_id, -SUM(m.quantite)::int AS sorti
        FROM public.pharma_lot_mouvements m
        JOIN public.pharma_lots l ON l.id = m.lot_id
       WHERE m.reference_id = NEW.reference_id AND l.product_id = NEW.product_id
       GROUP BY m.lot_id
      HAVING SUM(m.quantite) < 0
       ORDER BY MAX(m.cree_le) DESC
    LOOP
      EXIT WHEN v_reste <= 0;
      v_part := LEAST(v_reste, v_lot.sorti);
      UPDATE public.pharma_lots
         SET quantite = LEAST(quantite_recue, quantite + v_part)
       WHERE id = v_lot.lot_id;
      INSERT INTO public.pharma_lot_mouvements
        (store_id, lot_id, quantite, motif, detail, reference_type, reference_id, cree_par)
      VALUES
        (NEW.store_id, v_lot.lot_id, v_part, 'retour', NEW.type_mouvement,
         NEW.reference_type, NEW.reference_id, NEW.created_by);
      v_reste := v_reste - v_part;
    END LOOP;
  END IF;
  -- Toute autre entrée (achat ordinaire, inventaire en hausse) reste du
  -- stock « sans date », que la pharmacie peut dater ensuite.
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pharma_suivre_stock ON public.stock_movements;
CREATE TRIGGER pharma_suivre_stock
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.pharma_suivre_stock();

REVOKE ALL ON FUNCTION public.pharma_suivre_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pharma_numeroter_ordonnance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pharma_ordonnance_fige() FROM PUBLIC, anon, authenticated;

-- ── Recevoir une livraison, lot par lot ───────────────────────────
--
-- Chaque ligne : { product_id, quantite, prix_achat_unit } ou, pour une
-- réception au carton, { product_id, conditionnement_id, nombre,
-- prix_conditionnement } ; plus `numero_lot` et `date_peremption`.
-- Chaque ligne devient un achat ordinaire (stock, dette fournisseur,
-- trésorerie) et un lot. Le règlement se répartit sur les lignes.
CREATE OR REPLACE FUNCTION public.pharma_recevoir(
  p_store_id uuid,
  p_date date,
  p_fournisseur text,
  p_lignes jsonb,
  p_montant_paye numeric,
  p_date_echeance date,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ligne     jsonb;
  v_index     int := 0;
  v_total     numeric := 0;
  v_reste     numeric;
  v_part      numeric;
  v_ligne_tot numeric;
  v_achat     jsonb;
  v_lot_id    uuid;
  v_cond      text;
  v_quantite  int;
  v_peremption date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT public.is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Clé de réception manquante.';
  END IF;
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'La livraison est vide.';
  END IF;

  -- Rejouée (double clic, réseau) : déjà enregistrée.
  IF EXISTS (SELECT 1 FROM public.purchases WHERE idempotency_key = p_idempotency_key || ':1') THEN
    RETURN jsonb_build_object('lignes', jsonb_array_length(p_lignes), 'rejouee', true);
  END IF;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    IF NULLIF(v_ligne->>'conditionnement_id', '') IS NOT NULL THEN
      v_total := v_total + (v_ligne->>'nombre')::int * (v_ligne->>'prix_conditionnement')::numeric;
    ELSE
      v_total := v_total + (v_ligne->>'quantite')::int * (v_ligne->>'prix_achat_unit')::numeric;
    END IF;
  END LOOP;
  IF p_montant_paye IS NOT NULL AND (p_montant_paye < 0 OR p_montant_paye > v_total) THEN
    RAISE EXCEPTION 'Le montant réglé doit être compris entre 0 et le total de la livraison.';
  END IF;
  v_reste := COALESCE(p_montant_paye, v_total);

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_index := v_index + 1;
    v_cond := NULLIF(v_ligne->>'conditionnement_id', '');
    IF v_cond IS NOT NULL THEN
      v_ligne_tot := (v_ligne->>'nombre')::int * (v_ligne->>'prix_conditionnement')::numeric;
    ELSE
      v_ligne_tot := (v_ligne->>'quantite')::int * (v_ligne->>'prix_achat_unit')::numeric;
    END IF;
    v_part := LEAST(v_reste, v_ligne_tot);
    v_reste := v_reste - v_part;

    IF v_cond IS NOT NULL THEN
      v_achat := public.add_purchase_conditionne(
        p_store_id, p_date, (v_ligne->>'product_id')::uuid, v_cond,
        (v_ligne->>'nombre')::int, (v_ligne->>'prix_conditionnement')::numeric,
        p_fournisseur, p_idempotency_key || ':' || v_index, v_part, p_date_echeance
      );
    ELSE
      v_achat := public.add_purchase(
        p_store_id, p_date, (v_ligne->>'product_id')::uuid, NULL, NULL, NULL, NULL, NULL,
        (v_ligne->>'quantite')::int, (v_ligne->>'prix_achat_unit')::numeric,
        p_fournisseur, p_idempotency_key || ':' || v_index, v_part, p_date_echeance
      );
    END IF;

    v_quantite := (v_achat->>'quantite')::int;
    v_peremption := NULLIF(v_ligne->>'date_peremption', '')::date;
    INSERT INTO public.pharma_lots
      (store_id, product_id, numero_lot, date_peremption, quantite_recue, quantite,
       prix_achat_unit, fournisseur, purchase_id, recu_le)
    VALUES
      (p_store_id, (v_achat->>'product_id')::uuid, NULLIF(btrim(v_ligne->>'numero_lot'), ''),
       v_peremption, v_quantite, v_quantite, (v_achat->>'prix_achat_unit')::numeric,
       NULLIF(btrim(COALESCE(p_fournisseur, '')), ''), (v_achat->>'id')::uuid, p_date)
    RETURNING id INTO v_lot_id;
    INSERT INTO public.pharma_lot_mouvements
      (store_id, lot_id, quantite, motif, reference_type, reference_id)
    VALUES (p_store_id, v_lot_id, v_quantite, 'reception', 'purchase', (v_achat->>'id')::uuid);
  END LOOP;

  RETURN jsonb_build_object('lignes', v_index, 'rejouee', false);
END;
$$;

-- ── Dater le stock déjà en rayon ──────────────────────────────────
-- Le stock reçu avant d'utiliser les lots est « sans date » ; on lui
-- donne son numéro et sa date sans rien changer au stock.
CREATE OR REPLACE FUNCTION public.pharma_dater_stock(
  p_product_id uuid,
  p_numero_lot text,
  p_date_peremption date,
  p_quantite int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_produit public.products%ROWTYPE;
  v_libre   int;
  v_lot_id  uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  SELECT * INTO v_produit FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable.'; END IF;
  IF NOT public.store_allows_write(v_produit.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  SELECT v_produit.stock_actuel - COALESCE(SUM(quantite), 0) INTO v_libre
    FROM public.pharma_lots WHERE product_id = p_product_id;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_quantite > v_libre THEN
    RAISE EXCEPTION 'Il ne reste que % unité(s) sans date pour ce produit.', GREATEST(v_libre, 0);
  END IF;
  INSERT INTO public.pharma_lots
    (store_id, product_id, numero_lot, date_peremption, quantite_recue, quantite, prix_achat_unit)
  VALUES
    (v_produit.store_id, p_product_id, NULLIF(btrim(COALESCE(p_numero_lot, '')), ''),
     p_date_peremption, p_quantite, p_quantite, v_produit.prix_achat)
  RETURNING id INTO v_lot_id;
  INSERT INTO public.pharma_lot_mouvements (store_id, lot_id, quantite, motif)
  VALUES (v_produit.store_id, v_lot_id, p_quantite, 'stock_date');
  RETURN v_lot_id;
END;
$$;

-- ── Corriger le numéro ou la date d'un lot ────────────────────────
CREATE OR REPLACE FUNCTION public.pharma_corriger_lot(
  p_lot_id uuid,
  p_numero_lot text,
  p_date_peremption date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot public.pharma_lots%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  SELECT * INTO v_lot FROM public.pharma_lots WHERE id = p_lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot introuvable.'; END IF;
  IF NOT public.store_allows_write(v_lot.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  UPDATE public.pharma_lots
     SET numero_lot = NULLIF(btrim(COALESCE(p_numero_lot, '')), ''),
         date_peremption = p_date_peremption
   WHERE id = p_lot_id;
END;
$$;

-- ── Retirer tout ou partie d'un lot ───────────────────────────────
-- Périmé, rendu au fournisseur, cassé : le stock baisse (ajustement
-- ordinaire, visible dans l'historique) et c'est CE lot qui baisse.
CREATE OR REPLACE FUNCTION public.pharma_retirer_lot(
  p_lot_id uuid,
  p_quantite int,
  p_raison text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot     public.pharma_lots%ROWTYPE;
  v_libelle text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  SELECT * INTO v_lot FROM public.pharma_lots WHERE id = p_lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot introuvable.'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 OR p_quantite > v_lot.quantite THEN
    RAISE EXCEPTION 'Ce lot n''a que % unité(s) en rayon.', v_lot.quantite;
  END IF;
  v_libelle := CASE p_raison
    WHEN 'perime' THEN 'Périmé'
    WHEN 'retour_fournisseur' THEN 'Rendu au fournisseur'
    WHEN 'casse' THEN 'Cassé ou abîmé'
    WHEN 'autre' THEN 'Retiré'
  END;
  IF v_libelle IS NULL THEN RAISE EXCEPTION 'Raison du retrait inconnue.'; END IF;

  -- `ajuster_stock` vérifie les droits et le verrou de la boutique.
  PERFORM set_config('pharma.lots_geres', 'oui', true);
  PERFORM public.ajuster_stock(
    v_lot.product_id, -p_quantite,
    v_libelle || ' · lot ' || COALESCE(v_lot.numero_lot, 'sans numéro')
      || COALESCE(' · ' || NULLIF(btrim(COALESCE(p_note, '')), ''), '')
  );
  PERFORM set_config('pharma.lots_geres', '', true);

  UPDATE public.pharma_lots SET quantite = quantite - p_quantite WHERE id = p_lot_id;
  INSERT INTO public.pharma_lot_mouvements (store_id, lot_id, quantite, motif, detail)
  VALUES (v_lot.store_id, p_lot_id, -p_quantite, 'retrait',
          v_libelle || COALESCE(' · ' || NULLIF(btrim(COALESCE(p_note, '')), ''), ''));
END;
$$;

REVOKE ALL ON FUNCTION public.pharma_recevoir(uuid, date, text, jsonb, numeric, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pharma_dater_stock(uuid, text, date, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pharma_corriger_lot(uuid, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pharma_retirer_lot(uuid, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pharma_recevoir(uuid, date, text, jsonb, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pharma_dater_stock(uuid, text, date, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pharma_corriger_lot(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pharma_retirer_lot(uuid, int, text, text) TO authenticated;

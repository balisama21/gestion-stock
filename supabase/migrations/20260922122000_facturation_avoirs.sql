-- ════════════════════════════════════════════════════════════════════
-- FACTURATION — L'AVOIR
--
-- « Une facture émise ne se supprime JAMAIS et ne se modifie plus.
-- Pour l'annuler ou la corriger, on crée un AVOIR, numéroté à part,
-- préfixe "AV-" par défaut. »
--
-- ── L'AVOIR EST UNE PIÈCE, ET RIEN D'AUTRE ─────────────────────────
--
-- Il ne rembourse pas de lui-même, ne remet rien en stock, ne retire
-- rien du chiffre d'affaires. C'est la seule façon de garantir qu'une
-- opération n'est jamais comptée deux fois : l'argent rendu passe par
-- `refund_sale`, la marchandise reprise par `ajuster_stock`, chacun
-- une seule fois, chacun par son chemin habituel. L'écran propose les
-- deux, cases décochées.
--
-- Et le montant de la facture d'origine RESTE dans le chiffre
-- d'affaires de sa période. On ne réécrit pas un mois déjà clos : le
-- contre-mouvement porte sa propre date, comme en comptabilité.
--
-- ── IL NE SE SUPPRIME PAS NON PLUS ─────────────────────────────────
--
-- Aucune politique de DELETE, aucune d'UPDATE. Une pièce qui annule
-- une pièce ne peut pas être plus fragile que ce qu'elle annule.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.avoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  numero text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  -- Le ticket de vente que cet avoir couvre. Pas de clé étrangère :
  -- `ticket_id` n'est pas une clé primaire, c'est le lien qui réunit
  -- les lignes d'un même passage en caisse.
  ticket_id uuid,
  -- Le numéro de la facture d'origine, RECOPIÉ. Il s'imprime sur
  -- l'avoir, et doit y rester lisible même si la vente disparaît.
  facture_numero text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_nom text NOT NULL DEFAULT '',
  motif text NOT NULL DEFAULT '',
  montant numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.avoir_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id uuid NOT NULL REFERENCES public.avoirs(id) ON DELETE CASCADE,
  -- Recopié comme sur `quote_items` : la politique de lecture s'écrit
  -- alors sans jointure.
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantite numeric NOT NULL DEFAULT 1,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  total numeric,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avoirs_par_boutique ON public.avoirs (store_id, date DESC);
CREATE INDEX IF NOT EXISTS avoirs_par_ticket ON public.avoirs (store_id, ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS avoirs_numero_par_boutique
  ON public.avoirs (store_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS avoir_items_par_avoir ON public.avoir_items (avoir_id);
CREATE INDEX IF NOT EXISTS avoir_items_par_boutique ON public.avoir_items (store_id);

ALTER TABLE public.avoirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avoir_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='avoirs' AND policyname='avoirs_select') THEN
    CREATE POLICY avoirs_select ON public.avoirs FOR SELECT USING (is_store_member(store_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='avoirs' AND policyname='avoirs_insert') THEN
    CREATE POLICY avoirs_insert ON public.avoirs FOR INSERT WITH CHECK (store_allows_write(store_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='avoir_items' AND policyname='avoir_items_select') THEN
    CREATE POLICY avoir_items_select ON public.avoir_items FOR SELECT USING (is_store_member(store_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='avoir_items' AND policyname='avoir_items_insert') THEN
    CREATE POLICY avoir_items_insert ON public.avoir_items FOR INSERT WITH CHECK (store_allows_write(store_id));
  END IF;
END $$;

-- ── La numérotation, comme partout ailleurs ─────────────────────────
--
-- Sa propre série, tirée du compteur atomique. Un numéro déjà posé
-- n'est jamais réécrit, pour qu'une reprise de données reste possible.
CREATE OR REPLACE FUNCTION public.set_avoir_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'AV' || LPAD(next_store_counter(NEW.store_id, 'avoir')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS avoirs_numero ON public.avoirs;
CREATE TRIGGER avoirs_numero
  BEFORE INSERT ON public.avoirs
  FOR EACH ROW EXECUTE FUNCTION public.set_avoir_numero();

-- ── L'avoir et ses lignes s'écrivent ensemble ───────────────────────
--
-- Deux appels depuis le navigateur laisseraient, à la première coupure
-- de réseau, un avoir sans son détail — c'est-à-dire une pièce
-- comptable illisible.
CREATE OR REPLACE FUNCTION public.creer_avoir(
  p_store_id uuid,
  p_ticket_id uuid,
  p_facture_numero text,
  p_client_id uuid,
  p_client_nom text,
  p_motif text,
  p_montant numeric,
  p_lignes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_ligne jsonb;
  v_ordre integer := 0;
  v_total_ticket numeric;
  v_deja numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT store_allows_write(p_store_id) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant d''un avoir doit être positif.' USING ERRCODE = '22023';
  END IF;

  -- Un avoir ne rend jamais plus que ce que la facture a porté. Sans
  -- ce garde-fou, une erreur de saisie fabriquerait une créance sur la
  -- boutique qui ne correspond à aucune vente.
  IF p_ticket_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total_vente), 0) INTO v_total_ticket
      FROM sales
     WHERE store_id = p_store_id
       AND (ticket_id = p_ticket_id OR id = p_ticket_id);

    SELECT COALESCE(SUM(montant), 0) INTO v_deja
      FROM avoirs WHERE store_id = p_store_id AND ticket_id = p_ticket_id;

    IF v_total_ticket > 0 AND p_montant + v_deja > v_total_ticket THEN
      RAISE EXCEPTION
        'Avoir refusé : la facture porte % et % a déjà été avoirée.',
        v_total_ticket, v_deja
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO avoirs (
    store_id, ticket_id, facture_numero, client_id, client_nom, motif, montant, created_by
  ) VALUES (
    p_store_id, p_ticket_id, NULLIF(btrim(COALESCE(p_facture_numero, '')), ''),
    p_client_id, COALESCE(p_client_nom, ''), COALESCE(p_motif, ''), p_montant, auth.uid()
  ) RETURNING id INTO v_id;

  IF p_lignes IS NOT NULL AND jsonb_typeof(p_lignes) = 'array' THEN
    FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
      v_ordre := v_ordre + 1;
      INSERT INTO avoir_items (
        avoir_id, store_id, product_id, designation, quantite, prix_unitaire, total, ordre
      ) VALUES (
        v_id, p_store_id,
        NULLIF(v_ligne->>'product_id', '')::uuid,
        COALESCE(v_ligne->>'designation', ''),
        COALESCE((v_ligne->>'quantite')::numeric, 1),
        COALESCE((v_ligne->>'prix_unitaire')::numeric, 0),
        COALESCE((v_ligne->>'quantite')::numeric, 1) * COALESCE((v_ligne->>'prix_unitaire')::numeric, 0),
        v_ordre
      );
    END LOOP;
  END IF;

  RETURN (SELECT to_jsonb(a) FROM avoirs a WHERE a.id = v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.creer_avoir(uuid, uuid, text, uuid, text, text, numeric, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.creer_avoir(uuid, uuid, text, uuid, text, text, numeric, jsonb) TO authenticated;

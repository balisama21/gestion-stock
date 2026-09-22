-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — LA NUMÉROTATION, CÔTÉ SERVEUR ET SANS DOUBLON
--
-- « La numérotation est séquentielle par boutique et par type, générée
-- côté serveur, sans doublon possible même si deux vendeurs valident
-- en même temps. »
--
-- Trois manques, relevés au fil des missions précédentes :
--
--   1. AUCUNE TABLE n'avait d'index unique sur (store_id, numero).
--      Le compteur `next_store_counter` ne rend jamais deux fois la
--      même valeur — c'est un UPSERT atomique — mais rien n'empêchait
--      qu'un numéro soit posé à la main, ou qu'une reprise de données
--      en duplique un. Vérifié avant de poser l'index : zéro doublon
--      sur les 61 ventes, 1 devis, 14 achats et 0 commande en base.
--
--   2. LES COMMANDES comptaient les lignes présentes
--      (`SELECT COUNT(*) + 1`) au lieu de tirer un compteur. Une
--      commande supprimée libérait son numéro, et deux insertions
--      simultanées lisaient le même total. Zéro commande en base :
--      c'est le bon moment, et le correctif ne casse rien.
--      Le numéro déjà posé n'est jamais réécrit, pour qu'une reprise
--      de données reste possible — comme partout ailleurs.
--
--   3. AUCUN MOYEN de tirer un numéro sans insérer une ligne, ni de
--      reprendre une numérotation existante. Deux fonctions le font,
--      la seconde réservée à qui règle les documents.
-- ════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS sales_numero_par_boutique
  ON public.sales (store_id, numero) WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quotes_numero_par_boutique
  ON public.quotes (store_id, numero) WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_numero_par_boutique
  ON public.orders (store_id, numero) WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_numero_par_boutique
  ON public.purchases (store_id, numero) WHERE numero IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_order_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'CMD' || LPAD(next_store_counter(NEW.store_id, 'order')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- ── Tirer un numéro sans insérer ────────────────────────────────────
--
-- Une proforma se prévisualise avant d'exister : il lui faut son
-- numéro avant sa ligne. Le compteur ne recule jamais, donc un numéro
-- tiré et non utilisé est un trou dans la série — c'est le prix, et
-- c'est le comportement de toute numérotation légale.
CREATE OR REPLACE FUNCTION public.prochain_numero_de_document(
  p_store_id uuid,
  p_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Boutique inconnue.' USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR btrim(p_type) = '' THEN
    RAISE EXCEPTION 'Type de document manquant.' USING ERRCODE = '22023';
  END IF;
  RETURN public.next_store_counter(p_store_id, btrim(p_type));
END;
$function$;

-- ── Reprendre une numérotation existante ────────────────────────────
--
-- Une boutique qui migre depuis un autre logiciel en est à la facture
-- 1250 : elle doit pouvoir le dire. En AVANT seulement. Reculer un
-- compteur ferait ressortir des numéros déjà imprimés chez des
-- clients, et l'index unique posé plus haut refuserait l'insertion au
-- moment le plus gênant — la vente suivante.
CREATE OR REPLACE FUNCTION public.fixer_compteur_de_document(
  p_store_id uuid,
  p_type text,
  p_prochain integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actuel integer;
BEGIN
  IF NOT public.peut_regler_les_documents(p_store_id) THEN
    RAISE EXCEPTION
      'Seuls le proprietaire, l''administrateur et le manager reglent la numerotation.'
      USING ERRCODE = '42501';
  END IF;
  IF p_prochain IS NULL OR p_prochain < 1 THEN
    RAISE EXCEPTION 'Le prochain numero doit valoir au moins 1.' USING ERRCODE = '22023';
  END IF;

  SELECT current_value INTO v_actuel
    FROM store_counters
   WHERE store_id = p_store_id AND counter_type = btrim(p_type);

  IF v_actuel IS NOT NULL AND p_prochain <= v_actuel THEN
    RAISE EXCEPTION
      'Un compteur ne recule pas : il est deja a %, et des documents portent ces numeros.',
      v_actuel
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO store_counters (store_id, counter_type, current_value)
  VALUES (p_store_id, btrim(p_type), p_prochain - 1)
  ON CONFLICT (store_id, counter_type)
  DO UPDATE SET current_value = EXCLUDED.current_value;

  RETURN p_prochain;
END;
$function$;

REVOKE ALL ON FUNCTION public.prochain_numero_de_document(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.fixer_compteur_de_document(uuid, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.prochain_numero_de_document(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fixer_compteur_de_document(uuid, text, integer) TO authenticated;

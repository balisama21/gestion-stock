-- ═══════════════════════════════════════════════════════════════════
-- Étape 8d — l'argent que le livreur rapporte
--
-- LE CHOIX, ET POURQUOI
--
-- Quand le livreur remet un colis et encaisse 80 000, trois réponses
-- étaient possibles. Écrire aussitôt le règlement aurait mis la
-- trésorerie à jour — mais elle aurait annoncé un argent encore dans la
-- poche du livreur, à l'autre bout de la ville. Ne rien écrire du tout
-- aurait obligé le commerçant à ressaisir chaque encaissement à la main.
--
-- C'est donc le troisième chemin : la remise se coche. Le livreur
-- déclare ce qu'il a encaissé quand il livre ; l'argent n'entre en
-- caisse qu'au moment où le commerçant coche « argent rendu », c'est-à-
-- dire au moment où il l'a réellement dans la main. La trésorerie dit
-- alors ce qu'elle contient, pas ce qu'elle attend.
--
-- OÙ VA LE RÈGLEMENT
--
-- Une course pointe vers une commande, ou vers un ticket de vente, ou
-- vers rien. Une commande reçoit un règlement ; un ticket en reçoit
-- autant que nécessaire, posés ligne à ligne dans l'ordre, chacun plafonné
-- au reste dû de sa ligne — la même règle que le panier de l'étape 6.
--
-- Une course sans vente ni commande ne produit AUCUN règlement : cet
-- argent n'a rien à solder, et inventer une écriture pour équilibrer
-- serait pire que de n'en écrire aucune. La remise est notée, le compte
-- rendu le signale.
--
-- CE QUE CETTE ÉTAPE NE SAIT PAS FAIRE, ET C'EST VOULU
--
-- Le montant rendu est celui que le livreur a déclaré avoir encaissé.
-- Un écart entre ce qu'il annonce et ce qu'il pose sur le comptoir est
-- une affaire humaine ; l'enregistrer demanderait un troisième montant
-- et la notion de manquant, qui n'existe pas ici. Le jour où le besoin
-- se présente, il aura son étape.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS argent_remis_le timestamptz;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS argent_remis_a uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_argent_du
  ON deliveries (store_id, argent_remis_le)
  WHERE statut = 'livree' AND argent_remis_le IS NULL;

CREATE OR REPLACE FUNCTION public.remettre_argent_livraisons(p_delivery_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v deliveries%ROWTYPE;
  v_id uuid;
  v_reste numeric;
  v_part numeric;
  v_vente record;
  v_total_remis numeric := 0;
  v_sans_contrepartie int := 0;
  v_nb int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF p_delivery_ids IS NULL OR array_length(p_delivery_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Aucune course indiquée.';
  END IF;

  -- Tout se joue dans une transaction : si une seule course ne peut pas
  -- être soldée, aucune ne l'est. Le livreur repasse une fois, et la
  -- caisse ne doit pas rester à moitié à jour.
  FOREACH v_id IN ARRAY p_delivery_ids LOOP
    SELECT * INTO v FROM deliveries WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable.'; END IF;
    IF NOT is_store_member(v.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
    IF v.statut <> 'livree' THEN
      RAISE EXCEPTION 'La course % n''a pas été livrée : il n''y a rien à rendre.', v.numero;
    END IF;
    IF v.argent_remis_le IS NOT NULL THEN
      RAISE EXCEPTION 'L''argent de la course % a déjà été rendu.', v.numero;
    END IF;
    IF v.montant_encaisse <= 0 THEN
      RAISE EXCEPTION 'Rien n''a été encaissé sur la course %.', v.numero;
    END IF;

    v_reste := v.montant_encaisse;

    IF v.order_id IS NOT NULL THEN
      PERFORM public.add_payment(v.store_id, v.order_id, NULL, v_reste, 'especes',
        v.numero, 'Argent rapporté par le livreur.', 'livraison:' || v.id::text);
      v_reste := 0;

    ELSIF v.sale_ticket_id IS NOT NULL THEN
      FOR v_vente IN
        SELECT id, GREATEST(total_vente - montant_paye, 0) AS du
        FROM sales WHERE ticket_id = v.sale_ticket_id AND store_id = v.store_id
        ORDER BY created_at
      LOOP
        EXIT WHEN v_reste <= 0;
        v_part := LEAST(v_reste, v_vente.du);
        IF v_part > 0 THEN
          PERFORM public.add_payment(v.store_id, NULL, v_vente.id, v_part, 'especes',
            v.numero, 'Argent rapporté par le livreur.',
            'livraison:' || v.id::text || ':' || v_vente.id::text);
          v_reste := v_reste - v_part;
        END IF;
      END LOOP;

      IF v_reste > 0 THEN
        RAISE EXCEPTION
          'La course % rapporte % de plus que ce que le ticket reste à devoir.',
          v.numero, v_reste;
      END IF;

    ELSE
      v_sans_contrepartie := v_sans_contrepartie + 1;
    END IF;

    UPDATE deliveries
    SET argent_remis_le = NOW(), argent_remis_a = auth.uid(), updated_at = NOW()
    WHERE id = v_id;

    v_total_remis := v_total_remis + v.montant_encaisse;
    v_nb := v_nb + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'courses', v_nb,
    'total', v_total_remis,
    'sans_contrepartie', v_sans_contrepartie
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.remettre_argent_livraisons(uuid[]) TO authenticated;

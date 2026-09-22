-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — CRÉER ET MODIFIER UNE PROFORMA
--
-- `create_quote` et `update_quote` reçoivent deux paramètres de plus :
-- le type de pièce, et la durée de validité promise au moment où elle
-- a été établie.
--
-- POURQUOI REMPLACER LA FONCTION AU LIEU D'EN AJOUTER UNE. Ajouter
-- des paramètres à une fonction PostgreSQL en crée une SECONDE, de
-- signature différente. PostgREST se retrouve alors avec deux
-- candidates et refuse de choisir. La fonction est donc remplacée
-- dans une seule transaction : il n'existe aucun instant où elle
-- manque.
--
-- LE CLIENT QUI TOURNE ENCORE CHEZ LE COMMERÇANT CONTINUE DE
-- FONCTIONNER. Un navigateur ouvert depuis hier appelle `create_quote`
-- avec ses sept arguments d'origine ; les deux nouveaux ont une valeur
-- par défaut, et « devis » est précisément ce qu'il voulait dire.
-- ════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_quote(uuid, uuid, text, date, date, text, jsonb);

CREATE FUNCTION public.create_quote(
  p_store_id uuid,
  p_client_id uuid,
  p_client_nom text,
  p_date date,
  p_valide_jusqu_au date,
  p_note text,
  p_lignes jsonb,
  p_type text DEFAULT 'devis',
  p_duree_validite_jours integer DEFAULT NULL
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
  v_type text := COALESCE(NULLIF(btrim(p_type), ''), 'devis');
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT store_allows_write(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF v_type NOT IN ('devis', 'proforma') THEN
    RAISE EXCEPTION 'Type de piece inconnu : %.', v_type;
  END IF;
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Un devis sans ligne ne propose rien.';
  END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  INSERT INTO quotes (store_id, created_by, client_id, client_nom, date,
                      valide_jusqu_au, note, type, duree_validite_jours)
  VALUES (p_store_id, v_owner, p_client_id, COALESCE(p_client_nom, ''),
          COALESCE(p_date, CURRENT_DATE), p_valide_jusqu_au, p_note,
          v_type, p_duree_validite_jours)
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

DROP FUNCTION IF EXISTS public.update_quote(uuid, uuid, text, date, date, text, jsonb);

CREATE FUNCTION public.update_quote(
  p_quote_id uuid,
  p_client_id uuid,
  p_client_nom text,
  p_date date,
  p_valide_jusqu_au date,
  p_note text,
  p_lignes jsonb,
  p_type text DEFAULT NULL,
  p_duree_validite_jours integer DEFAULT NULL
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
  v_type text := NULLIF(btrim(COALESCE(p_type, '')), '');
BEGIN
  SELECT store_id, created_by, statut INTO v_store, v_createur, v_statut
    FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devis introuvable.'; END IF;
  IF NOT can_modify_in_store(v_createur, v_store) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;
  IF v_statut = 'accepte' THEN
    RAISE EXCEPTION 'Ce devis a été accepté : il ne peut plus être modifié.';
  END IF;
  IF v_type IS NOT NULL AND v_type NOT IN ('devis', 'proforma') THEN
    RAISE EXCEPTION 'Type de piece inconnu : %.', v_type;
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
      type = COALESCE(v_type, type),
      duree_validite_jours = COALESCE(p_duree_validite_jours, duree_validite_jours),
      updated_at = NOW()
  WHERE id = p_quote_id;

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

REVOKE EXECUTE ON FUNCTION public.create_quote(uuid, uuid, text, date, date, text, jsonb, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_quote(uuid, uuid, text, date, date, text, jsonb, text, integer) FROM anon;

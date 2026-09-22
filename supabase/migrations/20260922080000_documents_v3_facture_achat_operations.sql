-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — ENREGISTRER UNE FACTURE REÇUE
--
-- Une facture et ses lignes s'écrivent ensemble ou pas du tout. Deux
-- appels depuis le navigateur laisseraient, à la première coupure de
-- réseau, une facture sans son détail — et personne pour s'en
-- apercevoir avant le contrôle.
--
-- LE TOTAL N'EST PAS RECALCULÉ. C'est celui qui est écrit sur le
-- papier reçu : frais de transport, arrondis, remises négociées au
-- téléphone. Les lignes sont le détail qu'on veut bien saisir, pas la
-- source du montant. L'écran montre la somme des lignes à côté du
-- total pour qu'un écart se voie, et laisse la personne trancher.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_supplier_invoice(
  p_store_id uuid,
  p_supplier_id uuid,
  p_fournisseur text,
  p_numero_fournisseur text,
  p_date date,
  p_date_echeance date,
  p_total numeric,
  p_montant_paye numeric,
  p_note text,
  p_piece_jointe text,
  p_lignes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_facture uuid;
  v_ligne jsonb;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT store_allows_write(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF COALESCE(btrim(p_fournisseur), '') = '' AND p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Indiquez de quel fournisseur vient cette facture.';
  END IF;
  IF p_supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM suppliers WHERE id = p_supplier_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Fournisseur introuvable dans cette boutique.';
  END IF;

  INSERT INTO supplier_invoices (
    store_id, created_by, supplier_id, fournisseur, numero_fournisseur,
    date, date_echeance, total, montant_paye, note, piece_jointe
  )
  VALUES (
    p_store_id, v_owner, p_supplier_id, COALESCE(btrim(p_fournisseur), ''),
    NULLIF(btrim(COALESCE(p_numero_fournisseur, '')), ''),
    COALESCE(p_date, CURRENT_DATE), p_date_echeance,
    COALESCE(p_total, 0), COALESCE(p_montant_paye, 0),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_piece_jointe, '')), '')
  )
  RETURNING id INTO v_facture;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(COALESCE(p_lignes, '[]'::jsonb)) LOOP
    INSERT INTO supplier_invoice_items (
      invoice_id, store_id, product_id, designation, quantite, unite, prix_unitaire, total
    )
    VALUES (
      v_facture, p_store_id,
      NULLIF(v_ligne->>'product_id', '')::uuid,
      COALESCE(NULLIF(btrim(COALESCE(v_ligne->>'designation', '')), ''), 'Article'),
      COALESCE((v_ligne->>'quantite')::numeric, 1),
      NULLIF(btrim(COALESCE(v_ligne->>'unite', '')), ''),
      COALESCE((v_ligne->>'prix_unitaire')::numeric, 0),
      COALESCE((v_ligne->>'total')::numeric,
               COALESCE((v_ligne->>'quantite')::numeric, 1)
               * COALESCE((v_ligne->>'prix_unitaire')::numeric, 0))
    );
  END LOOP;

  RETURN (SELECT to_jsonb(f) FROM supplier_invoices f WHERE f.id = v_facture);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_supplier_invoice(
  p_id uuid,
  p_supplier_id uuid,
  p_fournisseur text,
  p_numero_fournisseur text,
  p_date date,
  p_date_echeance date,
  p_total numeric,
  p_montant_paye numeric,
  p_note text,
  p_piece_jointe text,
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
  v_ligne jsonb;
BEGIN
  SELECT store_id, created_by INTO v_store, v_createur
    FROM supplier_invoices WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture introuvable.'; END IF;
  IF NOT can_modify_in_store(v_createur, v_store) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;
  IF p_supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM suppliers WHERE id = p_supplier_id AND store_id = v_store
  ) THEN
    RAISE EXCEPTION 'Fournisseur introuvable dans cette boutique.';
  END IF;

  UPDATE supplier_invoices
  SET supplier_id = p_supplier_id,
      fournisseur = COALESCE(btrim(p_fournisseur), ''),
      numero_fournisseur = NULLIF(btrim(COALESCE(p_numero_fournisseur, '')), ''),
      date = COALESCE(p_date, date),
      date_echeance = p_date_echeance,
      total = COALESCE(p_total, 0),
      montant_paye = COALESCE(p_montant_paye, 0),
      note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      piece_jointe = NULLIF(btrim(COALESCE(p_piece_jointe, '')), '')
  WHERE id = p_id;

  DELETE FROM supplier_invoice_items WHERE invoice_id = p_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(COALESCE(p_lignes, '[]'::jsonb)) LOOP
    INSERT INTO supplier_invoice_items (
      invoice_id, store_id, product_id, designation, quantite, unite, prix_unitaire, total
    )
    VALUES (
      p_id, v_store,
      NULLIF(v_ligne->>'product_id', '')::uuid,
      COALESCE(NULLIF(btrim(COALESCE(v_ligne->>'designation', '')), ''), 'Article'),
      COALESCE((v_ligne->>'quantite')::numeric, 1),
      NULLIF(btrim(COALESCE(v_ligne->>'unite', '')), ''),
      COALESCE((v_ligne->>'prix_unitaire')::numeric, 0),
      COALESCE((v_ligne->>'total')::numeric,
               COALESCE((v_ligne->>'quantite')::numeric, 1)
               * COALESCE((v_ligne->>'prix_unitaire')::numeric, 0))
    );
  END LOOP;

  RETURN (SELECT to_jsonb(f) FROM supplier_invoices f WHERE f.id = p_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_supplier_invoice(uuid, uuid, text, text, date, date, numeric, numeric, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_supplier_invoice(uuid, uuid, text, text, date, date, numeric, numeric, text, text, jsonb) FROM anon;

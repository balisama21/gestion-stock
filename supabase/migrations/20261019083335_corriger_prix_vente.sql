-- Corriger le prix d'une vente après coup.
--
-- Purement additif : une fonction NOUVELLE. `update_sale_quantity` et toutes
-- les autres fonctions restent inchangées ; aucune donnée n'est touchée par
-- la migration elle-même.
--
-- Constat (audit du 18 octobre, § 8) : `update_sale_quantity` n'écrit que la
-- quantité, le total et le client. Le prix unitaire (`prix_vente_unit`) ne
-- pouvait pas être corrigé : un prix mal saisi restait faux, ou il fallait
-- supprimer la vente — impossible dès qu'elle avait un paiement.
--
-- La fonction garde l'invariant « total = quantité × prix », recalcule la
-- marge (total − coût de référence, inchangé) et le solde par
-- `recalculer_solde_vente`, la seule règle du solde. Elle refuse :
--   - un appel sans session ;
--   - celui qui ne peut pas modifier cette vente (`can_modify_in_store` :
--     auteur ou propriétaire, boutique non verrouillée) ;
--   - un prix négatif ;
--   - un total qui descendrait sous ce qui a déjà été payé + avoiré,
--     ou sous la commission retenue.
-- Le déclencheur `journal_activite` trace la modification comme les autres.
--
-- Retour arrière : supabase/retours-arriere/20261019083335_corriger_prix_vente.sql

CREATE OR REPLACE FUNCTION public.corriger_prix_vente(p_sale_id uuid, p_nouveau_prix numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale record;
  v_paye numeric;
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.'; END IF;
  IF NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF p_nouveau_prix IS NULL OR p_nouveau_prix < 0 THEN
    RAISE EXCEPTION 'Prix invalide.';
  END IF;

  v_total := v_sale.quantite * p_nouveau_prix;
  SELECT COALESCE(SUM(montant), 0) INTO v_paye FROM payments WHERE sale_id = p_sale_id;

  IF v_paye + COALESCE(v_sale.montant_avoire, 0) > v_total THEN
    RAISE EXCEPTION 'Prix refusé : les paiements (%) et les avoirs (%) déjà enregistrés dépasseraient le nouveau total (%).',
      v_paye, COALESCE(v_sale.montant_avoire, 0), v_total;
  END IF;
  IF COALESCE(v_sale.commission, 0) > v_total THEN
    RAISE EXCEPTION 'Prix refusé : la commission retenue (%) dépasserait le nouveau total (%).',
      v_sale.commission, v_total;
  END IF;

  UPDATE sales SET
    prix_vente_unit = p_nouveau_prix,
    total_vente = v_total,
    marge_totale = v_total - total_achat_ref,
    updated_at = NOW()
  WHERE id = p_sale_id;

  PERFORM recalculer_solde_vente(p_sale_id);

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.corriger_prix_vente(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corriger_prix_vente(uuid, numeric) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — LA FACTURE D'ACHAT FOURNISSEUR (2/2 : DÉCLENCHEURS
-- ET DROITS)
--
-- Les politiques reprennent celles des achats et des lignes de devis,
-- à la lettre : lecture pour tout membre, écriture tant que la
-- boutique n'est pas verrouillée, modification et suppression pour qui
-- a saisi la pièce ou pour le propriétaire.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.assign_supplier_invoice_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'FA' || LPAD(
      next_store_counter(NEW.store_id, 'supplier_invoice')::text, 3, '0'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER supplier_invoices_set_numero
  BEFORE INSERT ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_supplier_invoice_numero();

CREATE OR REPLACE TRIGGER supplier_invoices_updated_at
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Le journal d'activité, comme pour les autres pièces : une facture
-- fournisseur qui disparaît doit laisser une trace de qui l'a retirée.
CREATE OR REPLACE TRIGGER trg_journal_supplier_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_activite();

CREATE POLICY supplier_invoices_select ON public.supplier_invoices
  FOR SELECT USING (is_store_member(store_id));

CREATE POLICY supplier_invoices_insert ON public.supplier_invoices
  FOR INSERT WITH CHECK (
    store_allows_write(store_id) AND (SELECT auth.uid()) = created_by
  );

CREATE POLICY supplier_invoices_update ON public.supplier_invoices
  FOR UPDATE USING (can_modify_in_store(created_by, store_id));

CREATE POLICY supplier_invoices_delete ON public.supplier_invoices
  FOR DELETE USING (can_modify_in_store(created_by, store_id));

CREATE POLICY supplier_invoice_items_select ON public.supplier_invoice_items
  FOR SELECT USING (is_store_member(store_id));

CREATE POLICY supplier_invoice_items_insert ON public.supplier_invoice_items
  FOR INSERT WITH CHECK (store_allows_write(store_id));

CREATE POLICY supplier_invoice_items_update ON public.supplier_invoice_items
  FOR UPDATE USING (store_allows_write(store_id));

CREATE POLICY supplier_invoice_items_delete ON public.supplier_invoice_items
  FOR DELETE USING (store_allows_write(store_id));

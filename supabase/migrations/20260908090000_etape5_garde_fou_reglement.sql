-- ═══════════════════════════════════════════════════════════════════
-- Étape 5d — on ne règle pas plus que ce que l'on doit
--
-- `solde_du` est une colonne calculée : `total_achat - montant_paye`.
-- Rien n'empêchait jusqu'ici la somme des règlements de dépasser le
-- montant de l'achat, et le solde serait alors devenu négatif — une
-- dette à l'envers, qui se serait propagée dans tous les totaux.
--
-- Un règlement est rattaché à UN achat précis (`purchase_id`). Verser
-- plus que son montant n'a donc pas de sens ici : ce serait une avance
-- au fournisseur, qui n'a pas de place dans ce modèle et demanderait sa
-- propre écriture. Le dépassement est refusé.
--
-- La vérification est posée dans le déclencheur qui entretient déjà
-- `montant_paye`, juste après le recalcul : elle voit donc la somme
-- réelle, et non le montant du seul règlement qu'on insère. Comme le
-- déclencheur s'exécute dans la transaction de l'insertion, un refus
-- annule le règlement fautif sans rien laisser derrière lui.
--
-- CE QUI NE CHANGE PAS
--
-- Rien pour les données existantes : les onze achats en base sont
-- réglés au centime près, aucun n'est en dépassement — vérifié avant
-- d'appliquer. La suppression d'un règlement continue de fonctionner
-- (elle fait baisser la somme, jamais monter), et un achat repasse
-- alors de « payé » à « partiel », comme avant.
--
-- Au passage, la fonction reçoit le `search_path` figé qui manquait :
-- elle s'exécute en SECURITY DEFINER, et le laisser au choix de
-- l'appelant est précisément ce que déconseille l'analyseur Supabase.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalculer_paiement_achat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cible UUID;
  v_total NUMERIC;
  v_paye  NUMERIC;
BEGIN
  cible := COALESCE(NEW.purchase_id, OLD.purchase_id);

  UPDATE purchases
  SET montant_paye = COALESCE(
    (SELECT SUM(montant) FROM supplier_payments WHERE purchase_id = cible), 0)
  WHERE id = cible
  RETURNING total_achat, montant_paye INTO v_total, v_paye;

  IF v_paye > v_total THEN
    RAISE EXCEPTION
      'Règlement de trop : le total réglé (%) dépasse le montant de l''achat (%).',
      v_paye, v_total;
  END IF;

  RETURN NULL;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════
-- Étape 5d bis — le `search_path` qui manquait au déclencheur jumeau
--
-- Même correction que pour `recalculer_paiement_achat` juste avant :
-- la fonction s'exécute en SECURITY DEFINER, donc avec les droits de
-- son propriétaire, et laisser le `search_path` au choix de l'appelant
-- est exactement ce que signale l'analyseur Supabase. Un schéma glissé
-- devant `public` par un appelant suffirait à détourner les noms de
-- table qu'elle utilise.
--
-- Le corps est inchangé, au caractère près. Vérifié dans une
-- transaction annulée sur les données réelles : un achat comptant
-- produit toujours son règlement complet et ressort « payé » ; un achat
-- à crédit n'en produit aucun et ressort « impayé » ; les onze achats
-- réels sont intacts.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reglement_comptant_a_l_achat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.total_achat > 0 AND ABS(COALESCE(NEW.impact_tresorerie, 0)) >= NEW.total_achat THEN
    INSERT INTO supplier_payments (purchase_id, store_id, recorded_by, montant, date, methode, note)
    VALUES (
      NEW.id, NEW.store_id, NEW.owner_id, NEW.total_achat, NEW.date, 'especes',
      'Réglé comptant à l''enregistrement de l''achat.'
    );
  END IF;
  RETURN NULL;
END;
$function$;

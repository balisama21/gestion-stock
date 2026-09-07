-- ═══════════════════════════════════════════════════════════════════
-- Étape 5a — la dette fournisseur
--
-- Aujourd'hui, tout achat sort intégralement de la caisse au moment où
-- on l'enregistre : `impact_tresorerie` vaut exactement l'opposé du
-- total, sans exception sur les onze achats de la base. Il n'existe
-- donc ni montant payé, ni échéance, ni reste dû côté fournisseur —
-- c'est ce qui m'a obligé à laisser la fiche fournisseur muette sur ce
-- point à l'étape 3.
--
-- PRINCIPE DE CETTE MIGRATION : ne rien changer à ce qui se passe, mais
-- le rendre descriptible. Après son passage, chaque achat existant est
-- « payé en totalité » — ce qu'il était déjà, sans qu'on sache le dire.
-- Aucun montant, aucune trésorerie, aucun calcul ne bouge.
--
-- LES FONCTIONS RPC NE SONT PAS TOUCHÉES. `add_purchase` continue de
-- s'exécuter à l'identique ; un déclencheur lit l'intention qu'elle
-- inscrit déjà dans `impact_tresorerie` et en tire le règlement. Le jour
-- où l'interface saura saisir un achat à crédit, il sera temps
-- d'étendre la fonction — pas avant.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. Les règlements versés aux fournisseurs
-- ─────────────────────────────────────────
-- Une table à part, et non la table `payments`. Celle-ci enregistre ce
-- que la boutique REÇOIT — de ses clients, sur ses ventes et ses
-- commandes. Y verser ce qu'elle DÉPENSE fausserait d'un seul coup tous
-- les écrans qui l'additionnent : encaissements, paiements à recevoir,
-- chiffre d'affaires.

CREATE TABLE IF NOT EXISTS supplier_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- Sur le couple, comme partout ailleurs : sans cela on pourrait
  -- écrire un règlement dont la boutique déclarée diffère de celle de
  -- l'achat, et la RLS regarderait la mauvaise.
  FOREIGN KEY (purchase_id, store_id) REFERENCES purchases (id, store_id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  montant     NUMERIC NOT NULL CHECK (montant > 0),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  methode     TEXT NOT NULL DEFAULT 'especes',
  reference   TEXT,
  note        TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_achat ON supplier_payments (purchase_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_store ON supplier_payments (store_id, date DESC);

-- Le couple référencé plus haut doit exister comme clé.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchases_id_store_key') THEN
    ALTER TABLE purchases ADD CONSTRAINT purchases_id_store_key UNIQUE (id, store_id);
  END IF;
END $$;

-- ─────────────────────────────────────────
-- 2. Ce que l'achat en retient
-- ─────────────────────────────────────────
-- `montant_paye` est entretenu par déclencheur, jamais écrit à la main :
-- une somme recopiée finit toujours par diverger de ses termes.
-- `solde_du` et `statut_paiement` en découlent et sont calculés par la
-- base — ils ne peuvent donc pas se contredire.

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS montant_paye  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_echeance DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'solde_du'
  ) THEN
    ALTER TABLE purchases
      ADD COLUMN solde_du NUMERIC GENERATED ALWAYS AS (total_achat - montant_paye) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'statut_paiement'
  ) THEN
    ALTER TABLE purchases
      ADD COLUMN statut_paiement TEXT GENERATED ALWAYS AS (
        CASE
          WHEN montant_paye >= total_achat THEN 'paye'
          WHEN montant_paye > 0            THEN 'partiel'
          ELSE 'impaye'
        END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_statut_paiement
  ON purchases (store_id, statut_paiement);

-- ─────────────────────────────────────────
-- 3. La somme se recalcule d'elle-même
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION recalculer_paiement_achat()
RETURNS TRIGGER AS $$
DECLARE cible UUID;
BEGIN
  cible := COALESCE(NEW.purchase_id, OLD.purchase_id);
  UPDATE purchases
  SET montant_paye = COALESCE(
    (SELECT SUM(montant) FROM supplier_payments WHERE purchase_id = cible), 0)
  WHERE id = cible;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalculer_paiement_achat ON supplier_payments;
CREATE TRIGGER trg_recalculer_paiement_achat
  AFTER INSERT OR UPDATE OR DELETE ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION recalculer_paiement_achat();

-- ─────────────────────────────────────────
-- 4. Un achat payé comptant se règle tout seul
-- ─────────────────────────────────────────
-- C'est ce qui permet de ne pas toucher à `add_purchase`. La fonction
-- inscrit déjà dans `impact_tresorerie` ce qui est sorti de la caisse ;
-- quand cette sortie couvre le total, l'achat est payé comptant et son
-- règlement s'écrit ici. Le jour où l'interface saura saisir un achat à
-- crédit, elle passera un impact moindre et ce déclencheur n'inventera
-- plus rien.

CREATE OR REPLACE FUNCTION reglement_comptant_a_l_achat()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reglement_comptant_a_l_achat ON purchases;
CREATE TRIGGER trg_reglement_comptant_a_l_achat
  AFTER INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION reglement_comptant_a_l_achat();

-- ─────────────────────────────────────────
-- 5. Reprise de l'existant
-- ─────────────────────────────────────────
-- Chaque achat déjà enregistré reçoit son règlement, du montant qui est
-- réellement sorti de la caisse. Après quoi tous sont « payés », ce
-- qu'ils étaient déjà — la base sait simplement le dire.

INSERT INTO supplier_payments (purchase_id, store_id, recorded_by, montant, date, methode, note)
SELECT p.id, p.store_id, p.owner_id, p.total_achat, p.date, 'especes',
       'Reprise : cet achat était sorti comptant de la caisse.'
FROM purchases p
WHERE p.total_achat > 0
  AND NOT EXISTS (SELECT 1 FROM supplier_payments sp WHERE sp.purchase_id = p.id);

-- ─────────────────────────────────────────
-- 6. Sécurité au niveau des lignes
-- ─────────────────────────────────────────

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_payments_select" ON supplier_payments;
CREATE POLICY "supplier_payments_select" ON supplier_payments FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "supplier_payments_insert" ON supplier_payments;
CREATE POLICY "supplier_payments_insert" ON supplier_payments FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = recorded_by);

-- Ni UPDATE ni DELETE : un règlement versé ne se rature pas. Le
-- corriger passera par une écriture inverse, traçable, comme les
-- remboursements côté client.
REVOKE ALL ON supplier_payments FROM PUBLIC, anon;
GRANT SELECT, INSERT ON supplier_payments TO authenticated;

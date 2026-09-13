-- L'argent qu'un vendeur rend à la caisse.
--
-- ── Le trou que cela comble ──
--
-- Le solde en poche d'un vendeur ne pouvait que MONTER. Aucune opération
-- ne le faisait redescendre : la seule façon était d'enregistrer une
-- dépense à son nom, ce qui est faux — l'argent ne sort pas de la
-- boutique, il change de main. Au bout d'un mois, un vendeur affichait un
-- solde absurde et l'écran devenait inutilisable.
--
-- Les LIVREURS avaient déjà ce mécanisme (`argent_remis_le` sur les
-- livraisons). Les vendeurs, non. Ce n'était pas un choix, c'était un
-- oubli.
--
-- ── Pourquoi une table, et pas un drapeau comme pour les livreurs ──
--
-- Une course est une somme identifiable ; un vendeur, lui, accumule vingt
-- ventes et remet un paquet de billets. Cocher vente par vente ferait
-- pointer quarante lignes pour un seul geste.
--
-- Surtout : l'argent d'une livraison n'est PAS encore en trésorerie, et
-- cocher la remise crée le règlement. L'argent d'une vente y est déjà
-- compté dès l'enregistrement. Une remise de vendeur ne crée donc rien —
-- elle dit seulement OÙ se trouve physiquement l'argent. Problème
-- différent, forme différente.
--
-- ── La trésorerie ne bouge pas ──
--
-- C'est le point qui commande tout le reste. Si une remise diminuait la
-- trésorerie, enregistrer qu'un vendeur vous rend votre argent
-- appauvrirait la boutique. Elle ne l'augmente pas non plus : la vente y
-- était déjà. Seul le solde en poche du vendeur baisse.
--
-- ── Un effet secondaire qu'on obtient gratuitement ──
--
-- Hanta annonce 120 000 et n'en pose que 118 000. On enregistre 118 000,
-- ce qu'on a réellement en main. Son solde ne tombe pas à zéro : il reste
-- 2 000. Le manquant apparaît tout seul, sans notion supplémentaire à
-- inventer — c'est précisément ce que la migration des livreurs avait
-- renoncé à modéliser.
--
-- ── Qui peut encaisser ──
--
-- Le propriétaire, ou un membre à qui le module Vendeurs est ouvert. Un
-- vendeur ne peut PAS enregistrer sa propre remise : ce serait lui
-- laisser déclarer qu'il vous a payé. Le garde est en base, pas seulement
-- dans l'écran. Il peut en revanche les LIRE — c'est son équipe.
--
-- ── Vérifié en transaction annulée, sur les données réelles ──
--
--   1 le propriétaire encaisse ......... ACCEPTÉ, numérotées REM001/REM002
--   2 le vendeur déclare la sienne ..... REFUSÉ
--   3 le vendeur les lit ............... 2 visibles
--   4 journal d'activité ............... 2 lignes, action « creation »
--
-- Le journal n'a demandé AUCUNE modification : sa fonction lit `numero`
-- et `montant` de façon générique, il a suffi d'accrocher le déclencheur.

CREATE TABLE IF NOT EXISTS public.remises_vendeur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  numero text,
  -- Le NOM, comme `sales.vendeur` et `expenses.vendeur`. Un vendeur
  -- historique — un nom présent dans d'anciennes ventes, sans compte —
  -- doit pouvoir remettre son argent lui aussi.
  vendeur text NOT NULL,
  montant numeric NOT NULL CHECK (montant > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  -- Qui a reçu l'argent. SET NULL : la remise est un fait comptable, elle
  -- survit au départ de celui qui l'a encaissée.
  recu_par uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.remises_vendeur IS
  'L argent qu un vendeur rend a la caisse. Ne touche pas la tresorerie : la vente y etait deja comptee, la remise dit seulement ou est l argent.';

CREATE INDEX IF NOT EXISTS idx_remises_boutique
  ON public.remises_vendeur (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_remises_vendeur
  ON public.remises_vendeur (store_id, vendeur);
CREATE INDEX IF NOT EXISTS idx_remises_recu_par
  ON public.remises_vendeur (recu_par);

CREATE OR REPLACE FUNCTION public.assign_remise_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'REM' || lpad(next_store_counter(NEW.store_id, 'remise')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS remises_assign_numero ON public.remises_vendeur;
CREATE TRIGGER remises_assign_numero BEFORE INSERT ON public.remises_vendeur
  FOR EACH ROW EXECUTE FUNCTION public.assign_remise_numero();

-- Le journal d'activité, sans toucher à sa fonction.
DROP TRIGGER IF EXISTS trg_journal_remises_vendeur ON public.remises_vendeur;
CREATE TRIGGER trg_journal_remises_vendeur
  AFTER INSERT OR UPDATE OR DELETE ON public.remises_vendeur
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_activite();

CREATE OR REPLACE FUNCTION public.peut_encaisser_une_remise(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM store_members
                  WHERE store_id = p_store_id AND user_id = auth.uid()
                    AND permissions -> 'vendeurs' ->> 'visible' = 'true');
$function$;

ALTER TABLE public.remises_vendeur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS remises_lecture ON public.remises_vendeur;
CREATE POLICY remises_lecture ON public.remises_vendeur FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS remises_creation ON public.remises_vendeur;
CREATE POLICY remises_creation ON public.remises_vendeur FOR INSERT
  WITH CHECK (
    store_allows_write(store_id)
    AND peut_encaisser_une_remise(store_id)
    AND (SELECT auth.uid()) = recu_par
  );

DROP POLICY IF EXISTS remises_modification ON public.remises_vendeur;
CREATE POLICY remises_modification ON public.remises_vendeur FOR UPDATE
  USING (can_modify_in_store(recu_par, store_id));

DROP POLICY IF EXISTS remises_suppression ON public.remises_vendeur;
CREATE POLICY remises_suppression ON public.remises_vendeur FOR DELETE
  USING (can_modify_in_store(recu_par, store_id));

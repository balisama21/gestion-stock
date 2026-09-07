-- ═══════════════════════════════════════════════════════════════════
-- Étape 8a — les livraisons
--
-- POURQUOI UNE TABLE, ET NON DES COLONNES SUR `orders`
--
-- Commandes et Livraison doivent pouvoir s'activer séparément : une
-- boutique peut livrer un achat fait au comptoir sans jamais prendre de
-- commande en ligne, et une autre prendre des commandes que le client
-- vient chercher. Poser la livraison sur la commande lierait les deux
-- pour toujours.
--
-- Une livraison désigne donc une commande OU un ticket de vente — au
-- plus l'un des deux —, ou rien du tout quand le commerçant fait porter
-- quelque chose qui n'est pas encore enregistré.
--
-- `sale_ticket_id` n'a volontairement PAS de clé étrangère : un ticket
-- est une valeur partagée par plusieurs lignes de `sales`, pas une ligne
-- unique. On ne peut donc pas la référencer, et la contrainte serait un
-- mensonge de plus qu'une garantie.
--
-- CE QUE `livreur_id` À NULL VEUT DIRE
--
-- « Pas encore assignée ». C'est ce qui laisse la porte ouverte à une
-- file d'attente où les livreurs prennent ce qui est libre, le jour où
-- la boutique en aura plusieurs — sans avoir à construire deux systèmes
-- aujourd'hui pour un commerce qui connaît son livreur par son nom.
--
-- POURQUOI UN STATUT « ÉCHOUÉE »
--
-- Parce que personne n'est à l'adresse, que le client ne répond pas, ou
-- qu'il refuse le colis. Sans ce statut, le livreur reste bloqué sur
-- « en cours » et l'écran ment sur ce qui s'est passé.
--
-- CE QUE CETTE ÉTAPE NE FAIT PAS
--
-- `montant_a_encaisser` et `montant_encaisse` notent ce que le livreur
-- doit rapporter et ce qu'il dit avoir pris. Ils ne touchent PAS à la
-- caisse : aucun règlement n'est écrit dans `payments`, aucun stock
-- n'est décrémenté, aucun statut de commande n'est modifié. Relier une
-- livraison remise au chemin de l'argent est une étape à part, qui
-- demandera ses propres essais.
--
-- Le rôle « livreur » n'arrive pas non plus ici. Tant que les règles de
-- lecture ne l'isolent pas, l'inviter lui donnerait accès en base à
-- toutes les ventes de la boutique : le rôle et son isolement doivent
-- être livrés ensemble.
-- ═══════════════════════════════════════════════════════════════════

-- Le couple référencé par les livraisons doit exister comme clé, comme
-- pour les règlements fournisseurs et les lignes de devis : sans cela on
-- pourrait écrire une livraison dont la boutique diffère de celle de la
-- commande, et la RLS regarderait la mauvaise.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_id_store_key') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_id_store_key UNIQUE (id, store_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  numero      TEXT,

  -- Ce qu'on livre. Au plus l'un des deux.
  order_id       UUID,
  sale_ticket_id UUID,
  -- Sans clause ON DELETE : une commande à laquelle une livraison est
  -- rattachée ne se supprime pas tant que la livraison existe. C'est le
  -- bon sens — on n'efface pas la commande dont on garde la trace de la
  -- remise —, et `ON DELETE SET NULL` était impossible ici : sur une clé
  -- composée, il viderait aussi `store_id`, qui ne peut pas être nul.
  FOREIGN KEY (order_id, store_id) REFERENCES orders (id, store_id),
  CONSTRAINT deliveries_une_seule_origine
    CHECK (num_nonnulls(order_id, sale_ticket_id) <= 1),

  -- Qui livre. NULL = pas encore assignée.
  livreur_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Où, et à qui. Le nom et l'adresse sont recopiés plutôt que lus dans
  -- la fiche client : on livre parfois chez quelqu'un d'autre, et
  -- l'adresse du jour ne doit pas changer si la fiche est corrigée plus
  -- tard.
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  destinataire  TEXT NOT NULL DEFAULT '',
  telephone     TEXT,
  adresse       TEXT NOT NULL DEFAULT '',
  precisions    TEXT,

  statut TEXT NOT NULL DEFAULT 'a_faire'
    CHECK (statut IN ('a_faire', 'en_cours', 'livree', 'echouee', 'annulee')),

  -- Ce que le livreur rapporte. Sans effet sur la caisse à ce stade.
  montant_a_encaisser NUMERIC NOT NULL DEFAULT 0 CHECK (montant_a_encaisser >= 0),
  montant_encaisse    NUMERIC NOT NULL DEFAULT 0 CHECK (montant_encaisse >= 0),

  date_prevue        DATE,
  prise_en_charge_le TIMESTAMPTZ,
  remise_le          TIMESTAMPTZ,
  motif_echec        TEXT,
  note               TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_store_numero
  ON deliveries (store_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_store_statut
  ON deliveries (store_id, statut, date_prevue);
-- L'écran du livreur ne lit que ses propres courses : c'est cet index
-- qu'il empruntera.
CREATE INDEX IF NOT EXISTS idx_deliveries_livreur
  ON deliveries (livreur_id, statut) WHERE livreur_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_commande
  ON deliveries (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_ticket
  ON deliveries (sale_ticket_id) WHERE sale_ticket_id IS NOT NULL;

-- ── Le numéro, comme partout ailleurs ──
CREATE OR REPLACE FUNCTION public.assign_delivery_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'LIV' || LPAD(next_store_counter(NEW.store_id, 'delivery')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_delivery_numero ON deliveries;
CREATE TRIGGER trg_assign_delivery_numero
  BEFORE INSERT ON deliveries
  FOR EACH ROW EXECUTE FUNCTION assign_delivery_numero();

-- ── Les horodatages suivent le statut ──
--
-- Ils sont posés par la base et non par l'écran : c'est l'heure du
-- serveur qui fait foi, pas celle du téléphone du livreur, qui peut être
-- fausse ou reculée.
CREATE OR REPLACE FUNCTION public.horodater_livraison()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF NEW.statut = 'en_cours' AND NEW.prise_en_charge_le IS NULL THEN
      NEW.prise_en_charge_le := NOW();
    END IF;
    IF NEW.statut IN ('livree', 'echouee') AND NEW.remise_le IS NULL THEN
      NEW.remise_le := NOW();
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_horodater_livraison ON deliveries;
CREATE TRIGGER trg_horodater_livraison
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION horodater_livraison();

-- ── Qui voit quoi, pour l'instant ──
--
-- Ce sont les règles de la boutique : le propriétaire et ses
-- collaborateurs. Le livreur, lui, ne doit voir QUE ses propres courses,
-- et surtout aucune vente ni aucun prix d'achat — c'est l'objet de
-- l'étape suivante, qui posera ses règles à lui.
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select" ON deliveries;
CREATE POLICY "deliveries_select" ON deliveries FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "deliveries_insert" ON deliveries;
CREATE POLICY "deliveries_insert" ON deliveries FOR INSERT
  WITH CHECK (store_allows_write(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "deliveries_update" ON deliveries;
CREATE POLICY "deliveries_update" ON deliveries FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "deliveries_delete" ON deliveries;
CREATE POLICY "deliveries_delete" ON deliveries FOR DELETE
  USING (can_modify_in_store(created_by, store_id) AND statut = 'a_faire');

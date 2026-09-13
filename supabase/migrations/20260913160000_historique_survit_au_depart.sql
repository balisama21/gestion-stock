-- L'historique commercial ne disparaît plus avec son auteur.
--
-- ── Le problème ──
--
-- `owner_id`, `recorded_by` et `created_by` désignent la PERSONNE QUI A
-- SAISI la ligne, pas la boutique. Ces colonnes étaient déclarées
-- `ON DELETE CASCADE` vers `profiles`. Supprimer le compte d'un vendeur
-- parti effaçait donc les ventes qu'il avait enregistrées : le chiffre
-- d'affaires de la boutique changeait rétroactivement, sans que personne
-- ne s'en aperçoive.
--
-- Un logiciel de gestion sert à répondre à « combien ai-je vendu l'an
-- dernier ». Si la réponse dépend de qui est encore dans l'équipe, il ne
-- remplit plus sa fonction.
--
-- ── La règle retenue ──
--
-- La donnée survit ; c'est le LIEN vers la personne qui devient nul.
-- Perdre le nom du saisisseur est un inconvénient mineur ; perdre la
-- vente fausse les comptes.
--
-- Ces colonnes étaient toutes `NOT NULL`, ce qui aurait fait échouer le
-- `SET NULL` au moment de la suppression — la contrainte est donc levée
-- sur chacune. Les écritures restent protégées par les politiques RLS,
-- qui exigent `auth.uid() = owner_id` : on ne peut toujours pas créer
-- une ligne sans auteur.
--
-- ── Ce qui garde volontairement son CASCADE ──
--
--   profiles.id -> users        le profil EST le compte
--   store_members.user_id       une appartenance sans personne n'a pas de sens
--   collaborator_invitations    une invitation est un lien, pas un fait
--
-- ── stores.owner_id : RESTRICT, et non SET NULL ──
--
-- C'est le maillon qui décide de tout le reste. Chaque table métier est
-- rattachée à `stores` en CASCADE : supprimer une boutique emporte ses
-- ventes quoi qu'on fasse par ailleurs. Laisser CASCADE ici aurait vidé
-- de son sens tout le reste de cette migration.
--
-- `SET NULL` n'était pas la bonne réponse non plus : une boutique sans
-- propriétaire ne serait administrable par personne. `RESTRICT` refuse
-- la suppression au lieu de détruire — on ne peut plus effacer quelqu'un
-- qui possède encore une boutique ; il faut d'abord la transmettre ou la
-- supprimer explicitement. Le refus est visible et réparable ; une
-- destruction silencieuse ne l'est pas.
--
-- ── Vérifié en transaction annulée, sur les données réelles ──
--
--   Supprimer un profil possédant encore une boutique : REFUSÉ.
--   Après transmission de ses boutiques puis suppression de son compte :
--   ZÉRO ligne perdue sur les dix tables métier ; ses 2 ventes et son
--   produit conservés avec un auteur vide ; 16 boutiques toujours là ;
--   son appartenance à l'équipe retirée, ce qui est la cascade voulue.

-- ─────────── Lever le NOT NULL, sinon SET NULL échouerait ───────────
ALTER TABLE public.sales           ALTER COLUMN owner_id     DROP NOT NULL;
ALTER TABLE public.products        ALTER COLUMN owner_id     DROP NOT NULL;
ALTER TABLE public.purchases       ALTER COLUMN owner_id     DROP NOT NULL;
ALTER TABLE public.payments        ALTER COLUMN recorded_by  DROP NOT NULL;
ALTER TABLE public.expenses        ALTER COLUMN owner_id     DROP NOT NULL;
ALTER TABLE public.orders          ALTER COLUMN owner_id     DROP NOT NULL;
ALTER TABLE public.refunds         ALTER COLUMN recorded_by  DROP NOT NULL;
ALTER TABLE public.capital_apports ALTER COLUMN owner_id     DROP NOT NULL;
ALTER TABLE public.clients         ALTER COLUMN created_by   DROP NOT NULL;
ALTER TABLE public.admin_actions   ALTER COLUMN performed_by DROP NOT NULL;

-- ─────────── Le lien se vide, la ligne reste ───────────
ALTER TABLE public.sales DROP CONSTRAINT sales_owner_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.products DROP CONSTRAINT products_owner_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.purchases DROP CONSTRAINT purchases_owner_id_fkey;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.payments DROP CONSTRAINT payments_recorded_by_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.expenses DROP CONSTRAINT expenses_owner_id_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT orders_owner_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.refunds DROP CONSTRAINT refunds_recorded_by_fkey;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.capital_apports DROP CONSTRAINT capital_apports_owner_id_fkey;
ALTER TABLE public.capital_apports ADD CONSTRAINT capital_apports_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.clients DROP CONSTRAINT clients_created_by_fkey;
ALTER TABLE public.clients ADD CONSTRAINT clients_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.admin_actions DROP CONSTRAINT admin_actions_performed_by_fkey;
ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─────────── La boutique protège désormais son propriétaire ───────────
ALTER TABLE public.stores DROP CONSTRAINT stores_owner_id_fkey;
ALTER TABLE public.stores ADD CONSTRAINT stores_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- ─────────── Garde-fou ───────────
-- La migration échoue plutôt que de laisser croire qu'elle a fait son
-- travail.
DO $garde$
DECLARE
  v_restantes int;
  v_stores text;
BEGIN
  SELECT count(*) INTO v_restantes
  FROM pg_constraint c
  JOIN pg_class t  ON t.oid = c.conrelid
  JOIN pg_class tp ON tp.oid = c.confrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'f' AND n.nspname = 'public' AND c.confdeltype = 'c'
    AND tp.relname = 'profiles'
    AND t.relname IN ('sales','products','purchases','payments','expenses',
                      'orders','refunds','capital_apports','clients','admin_actions');
  IF v_restantes > 0 THEN
    RAISE EXCEPTION 'Il reste % table(s) metier en CASCADE vers profiles', v_restantes;
  END IF;

  SELECT CASE c.confdeltype WHEN 'r' THEN 'RESTRICT' ELSE c.confdeltype::text END INTO v_stores
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  WHERE c.conname = 'stores_owner_id_fkey' AND t.relname = 'stores';
  IF v_stores IS DISTINCT FROM 'RESTRICT' THEN
    RAISE EXCEPTION 'stores.owner_id n est pas en RESTRICT mais en %', v_stores;
  END IF;
END $garde$;

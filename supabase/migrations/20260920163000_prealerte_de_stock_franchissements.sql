-- ═══════════════════════════════════════════════════════════════════
-- LA PRÉALERTE DE STOCK — 2. LES FRANCHISSEMENTS, ET L'ANTI-RÉPÉTITION
-- ═══════════════════════════════════════════════════════════════════
--
-- ── Le problème à résoudre, et c'est le seul qui compte ──
--
-- Un produit qui oscille autour de son niveau de préalerte produirait
-- dix notifications par jour, et le commerçant les ignorerait toutes.
-- Il faut UNE notification par produit et par franchissement, et ne
-- re-notifier qu'après que le stock soit remonté au-dessus du niveau.
--
-- ── LA PRÉSENCE D'UNE LIGNE EST L'ÉTAT ──
--
-- Pas de compteur, pas d'horodatage à comparer, rien à faire expirer.
-- Une ligne dans `prealertes_stock` veut dire « ce produit a déjà été
-- signalé ». Le stock remonte au-dessus du niveau : la ligne est
-- supprimée, le produit se réarme. Le stock retombe : la ligne est
-- recréée.
--
-- Tout tient dans le `ON CONFLICT (product_id) DO NOTHING` de
-- l'insertion. Dix ventes dans la journée sur le même produit, ce sont
-- dix passages du déclencheur et UNE ligne.
--
-- ── Pourquoi un déclencheur, et pas un contrôle dans chaque fonction ──
--
-- Onze fonctions SQL écrivent `products.stock_actuel` : create_sale,
-- add_purchase, ajuster_stock, delete_sale, modifier_achat,
-- set_order_status, update_sale_quantity… Poser le contrôle dans
-- chacune ferait onze endroits à tenir d'accord, et un douzième à ne
-- pas oublier demain.
--
-- Un déclencheur de LIGNE les couvre toutes, et il ne voit par
-- construction que les produits dont le stock vient de bouger : la
-- contrainte de performance est satisfaite par la forme du mécanisme,
-- pas par une optimisation qu'il faudrait surveiller.
--
-- ── `stock_actuel`, PAS `stock_disponible` ──
--
-- Les deux diffèrent dès qu'une commande a réservé de la marchandise.
-- `chiffres.ts` porte un commentaire explicite : la règle du seuil
-- compare `stockActuel`, comme la page Produits et comme la cloche.
-- Changer de colonne ici ferait diverger des écrans qui doivent
-- s'accorder.
--
-- ── Deux origines, et pourquoi il en faut deux ──
--
-- Le client a tranché le 20/09 : le jour où une boutique active la
-- préalerte, rien ne doit sonner. Or, sur la base d'aujourd'hui, 31
-- produits sur 41 sont déjà sous leur seuil. Une notification de
-- rattrapage arriverait avec une trentaine de lignes, c'est-à-dire la
-- liste qu'on ignore.
--
-- Les lignes portent donc leur origine. « franchissement » : le stock a
-- vraiment franchi le niveau, la ligne a le droit d'être annoncée.
-- « reprise » : la ligne a été posée par une resynchronisation — à
-- l'activation, ou quand on change le mode — et elle ne sera JAMAIS
-- annoncée. Elle tient quand même son rôle d'anti-répétition : le
-- produit ne re-notifiera qu'après être remonté au-dessus du niveau,
-- ce qui est exactement la règle demandée.

-- ───────────────────────────────────────────────────────────────────
-- 1. L'état, et la file d'attente
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prealertes_stock (
  product_id  uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,

  origine     text NOT NULL CHECK (origine IN ('franchissement', 'reprise')),

  -- Le niveau calculé au moment où la ligne a été posée. Recalculable,
  -- mais l'écrire rend la ligne lisible seule : on sait pourquoi elle
  -- est là sans rejouer le réglage de l'époque.
  niveau      integer NOT NULL,

  franchie_le timestamptz NOT NULL DEFAULT now(),

  -- Quand la préalerte est SORTIE : cloche et e-mail. Nulle tant
  -- qu'elle attend le résumé quotidien. C'est le seul robinet, pour les
  -- deux canaux à la fois.
  notifiee_le timestamptz
);

COMMENT ON TABLE public.prealertes_stock IS
  'Un produit deja signale. La PRESENCE de la ligne est l etat : elle interdit de re-notifier tant que le stock n est pas remonte au-dessus du niveau.';
COMMENT ON COLUMN public.prealertes_stock.origine IS
  'franchissement = le stock a franchi le niveau, annoncable. reprise = pose par une resynchronisation (activation, changement de mode), jamais annonce.';

-- Les lignes d'une boutique, et celles qui attendent leur résumé.
CREATE INDEX IF NOT EXISTS prealertes_stock_boutique
  ON public.prealertes_stock (store_id);
CREATE INDEX IF NOT EXISTS prealertes_stock_en_attente
  ON public.prealertes_stock (store_id)
  WHERE notifiee_le IS NULL AND origine = 'franchissement';

ALTER TABLE public.prealertes_stock ENABLE ROW LEVEL SECURITY;

-- Lecture seule, par l'équipe. AUCUNE policy d'écriture : cette table
-- n'est remplie que par les fonctions SECURITY DEFINER ci-dessous. Sans
-- cela, n'importe qui effacerait l'anti-répétition d'un `delete()` et
-- se re-notifierait à volonté.
--
-- C'est aussi pourquoi `policies_sans_verrou()` ne la signalera pas :
-- il ne contrôle que les policies ALL/INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "L equipe lit les prealertes" ON public.prealertes_stock;
CREATE POLICY "L equipe lit les prealertes"
  ON public.prealertes_stock FOR SELECT
  USING (public.is_store_member(store_id));

-- ───────────────────────────────────────────────────────────────────
-- 2. Le niveau d'un produit, réglages de sa boutique compris
-- ───────────────────────────────────────────────────────────────────
--
-- Rend 0 quand il n'y a rien à surveiller : pas de réglages, préalerte
-- éteinte, produit sans seuil, service, ou fiche archivée. Un seul
-- endroit décide de tout cela, et les trois usages ci-dessous s'y
-- rapportent — le déclencheur, la resynchronisation et la preuve.

CREATE OR REPLACE FUNCTION public.niveau_surveille(p_product_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT public.niveau_de_prealerte(p.seuil_alerte, r.mode, r.ecart, r.pourcentage)
       FROM public.products p
       JOIN public.reglages_alertes_stock r ON r.store_id = p.store_id
      WHERE p.id = p_product_id
        AND r.prealerte_active
        AND p.statut = 'actif'
        AND p.type_produit IS DISTINCT FROM 'service'),
    0);
$function$;

-- Appelée uniquement par les fonctions SECURITY DEFINER ci-dessous,
-- qui tournent en `postgres` : personne d'autre n'a à interroger l'état
-- de surveillance d'un produit arbitraire.
REVOKE EXECUTE ON FUNCTION public.niveau_surveille(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────
-- 3. LE DÉCLENCHEUR
-- ───────────────────────────────────────────────────────────────────
--
-- Il écoute aussi `seuil_alerte`, et pas seulement le stock. Relever le
-- seuil d'un produit de trois à huit le fait entrer dans la zone sans
-- qu'une seule unité ait bougé ; ne pas réagir laisserait un état faux
-- jusqu'à la vente suivante. C'est une modification manuelle, sur une
-- ligne, faite à la main : la contrainte de performance ne s'y applique
-- pas.

CREATE OR REPLACE FUNCTION public.controler_prealerte_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_niveau    integer;
  v_frequence text;
BEGIN
  -- `UPDATE OF` garantit que la colonne était dans le SET, pas que sa
  -- valeur a changé. Une vente qui ne touche pas au stock ne doit rien
  -- coûter.
  IF NEW.stock_actuel IS NOT DISTINCT FROM OLD.stock_actuel
     AND NEW.seuil_alerte IS NOT DISTINCT FROM OLD.seuil_alerte THEN
    RETURN NULL;
  END IF;

  v_niveau := public.niveau_surveille(NEW.id);

  -- Préalerte éteinte, produit sans seuil, service ou fiche archivée :
  -- on sort. Pour une boutique qui n'a pas activé la fonction, c'est
  -- une sonde d'index sur clé primaire, et rien d'autre.
  IF v_niveau <= 0 THEN
    RETURN NULL;
  END IF;

  -- Remonté au-dessus du niveau : le produit se réarme.
  IF NEW.stock_actuel > v_niveau THEN
    DELETE FROM public.prealertes_stock WHERE product_id = NEW.id;
    RETURN NULL;
  END IF;

  SELECT frequence INTO v_frequence
    FROM public.reglages_alertes_stock WHERE store_id = NEW.store_id;

  -- LE CŒUR DE L'ANTI-RÉPÉTITION. `DO NOTHING` : la ligne qui existe
  -- déjà n'est pas retouchée, donc ni re-notifiée, ni re-datée.
  INSERT INTO public.prealertes_stock (product_id, store_id, origine, niveau, notifiee_le)
  VALUES (
    NEW.id,
    NEW.store_id,
    'franchissement',
    v_niveau,
    -- « À chaque mouvement » : la préalerte sort tout de suite.
    -- « Résumé quotidien » : elle attend l'heure choisie, et c'est le
    -- travail horaire qui la libérera.
    CASE WHEN v_frequence = 'mouvement' THEN now() ELSE NULL END
  )
  ON CONFLICT (product_id) DO NOTHING;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Perdre une préalerte est un incident ; faire échouer une vente
    -- est un client qui repart. Ce déclencheur n'a pas le droit de
    -- casser l'écriture qui l'a appelé. Même raisonnement, et même
    -- formulation, que `journaliser_activite()`.
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS products_prealerte ON public.products;
CREATE TRIGGER products_prealerte
  AFTER UPDATE OF stock_actuel, seuil_alerte ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.controler_prealerte_stock();

-- ───────────────────────────────────────────────────────────────────
-- 4. LA RESYNCHRONISATION, ET LE SILENCE À L'ACTIVATION
-- ───────────────────────────────────────────────────────────────────
--
-- Remet l'état d'une boutique d'aplomb sans rien annoncer :
--
--   — ce qui n'est plus dans la zone est retiré, donc réarmé ;
--   — ce qui y est entré reçoit une ligne « reprise », qui ne sortira
--     jamais mais qui empêche une notification de rattrapage.
--
-- Appelée à l'activation et à chaque changement de réglage. Changer
-- l'écart de deux à cinq fait entrer des produits dans la zone : les
-- annoncer ferait sonner une vingtaine de lignes parce qu'on a fait
-- glisser un nombre. Le tableau de bord, lui, les montre en orange
-- immédiatement — c'est là que se lit l'effet d'un réglage.

CREATE OR REPLACE FUNCTION public.resynchroniser_prealertes(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- La jointure latérale calcule le niveau UNE fois par produit, au
  -- lieu d'une fois par mention.
  --
  -- Ce qui n'a plus lieu d'être : préalerte éteinte, stock remonté,
  -- seuil retiré, produit archivé. `niveau_surveille` répond à tout.
  DELETE FROM public.prealertes_stock a
   USING public.products p
         CROSS JOIN LATERAL (SELECT public.niveau_surveille(p.id) AS niveau) n
   WHERE a.product_id = p.id
     AND p.store_id = p_store_id
     AND (n.niveau <= 0 OR p.stock_actuel > n.niveau);

  INSERT INTO public.prealertes_stock (product_id, store_id, origine, niveau, notifiee_le)
  SELECT p.id, p.store_id, 'reprise', n.niveau, now()
    FROM public.products p
         CROSS JOIN LATERAL (SELECT public.niveau_surveille(p.id) AS niveau) n
   WHERE p.store_id = p_store_id
     AND n.niveau > 0
     AND p.stock_actuel <= n.niveau
  ON CONFLICT (product_id) DO NOTHING;
END;
$function$;

-- Appelée par le déclencheur ci-dessous, et par personne d'autre :
-- elle prend un identifiant de boutique, et resynchroniser CELLE DES
-- AUTRES reviendrait à faire taire leurs préalertes en attente.
REVOKE EXECUTE ON FUNCTION public.resynchroniser_prealertes(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Déclenchée par la table des réglages plutôt qu'appelée par
-- l'interface : c'est ainsi que la reprise se fait dans LA MÊME
-- TRANSACTION que l'enregistrement du réglage. Entre un `upsert` et un
-- appel de fonction, il resterait une fenêtre pendant laquelle une
-- vente produirait la notification de rattrapage qu'on veut éviter.
CREATE OR REPLACE FUNCTION public.reglages_alertes_stock_resynchroniser()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.resynchroniser_prealertes(NEW.store_id);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS reglages_alertes_stock_reprise ON public.reglages_alertes_stock;
CREATE TRIGGER reglages_alertes_stock_reprise
  AFTER INSERT OR UPDATE OF prealerte_active, mode, ecart, pourcentage
  ON public.reglages_alertes_stock
  FOR EACH ROW EXECUTE FUNCTION public.reglages_alertes_stock_resynchroniser();

-- ───────────────────────────────────────────────────────────────────
-- 5. Ce que la cloche et l'e-mail ont le droit de montrer
-- ───────────────────────────────────────────────────────────────────
--
-- Une vue plutôt qu'une requête recopiée : la cloche, le travail
-- horaire et l'e-mail doivent s'accorder sur ce qu'est « un produit en
-- préalerte », et la définition ne s'écrit qu'ici.
--
-- LA BANDE ORANGE SEULE. Un produit tombé SOUS son seuil garde bien sa
-- ligne — sinon il re-notifierait en remontant à quatre —, mais il ne
-- figure pas ici : il relève de l'alerte rouge, qui existe déjà et dit
-- mieux les choses. « Approche du seuil » sur un produit qui y est
-- déjà serait faux.

CREATE OR REPLACE VIEW public.prealertes_a_annoncer
WITH (security_invoker = true) AS
  SELECT
    a.product_id,
    a.store_id,
    a.niveau,
    a.franchie_le,
    a.notifiee_le,
    p.display_name AS produit,
    p.numero,
    p.stock_actuel,
    p.seuil_alerte,
    p.unite
  FROM public.prealertes_stock a
  JOIN public.products p ON p.id = a.product_id
  WHERE a.origine = 'franchissement'
    AND p.stock_actuel > p.seuil_alerte
    AND p.stock_actuel <= a.niveau;

COMMENT ON VIEW public.prealertes_a_annoncer IS
  'Les produits dans la bande orange dont le franchissement est reel. security_invoker : la RLS de prealertes_stock et de products s applique au lecteur.';

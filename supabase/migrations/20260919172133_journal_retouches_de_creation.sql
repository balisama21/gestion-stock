-- ═══════════════════════════════════════════════════════════════════
-- Un seul geste ne fait qu'une seule ligne de journal.
--
-- Enregistrer une vente inscrivait « Vente créée » PUIS « Vente
-- modifiée » à la même seconde. Créer un produit avec sa fiche
-- inscrivait « Produit créé » PUIS « Produit modifié ». La seconde
-- ligne ne disait rien que la première ne disait déjà.
--
-- ── Les deux écritures fautives ──
--
--   VENTES    `create_sale` insère la vente, puis lui rattache son
--             ticket de caisse dans la MÊME transaction :
--             `UPDATE sales SET ticket_id = …` (migration
--             20260908110000). `ticket_id` est un numéro de
--             regroupement interne, jamais une correction humaine.
--             Cela se produisait à CHAQUE vente.
--
--   PRODUITS  l'écran Produits appelle `create_product`, puis envoie
--             la fiche descriptive si elle a été remplie
--             (`ProduitsView.tsx`). Deux transactions séparées par un
--             aller-retour réseau, une seule intention.
--
-- ── Les deux changements ──
--
-- 1. `ticket_id` rejoint les colonnes ignorées pour `sales`, aux côtés
--    de `montant_paye` et `solde_du` qui y étaient déjà pour la même
--    raison : elles bougent toutes seules.
--
-- 2. Une modification qui tombe dans les dix secondes suivant la
--    naissance de la ligne prolonge la création, elle ne la corrige
--    pas. Cette règle couvre le cas des produits, et couvrira d'avance
--    le prochain écran qui créera puis complétera.
--
-- CE QU'ON PERD, ET C'EST ASSUMÉ. Une vraie correction faite dans les
-- dix secondes qui suivent une création n'est plus journalisée. En
-- pratique c'est la même main qui finit sa saisie. Pour resserrer,
-- remplacer `interval '10 seconds'` par `interval '3 seconds'` : le cas
-- des ventes reste couvert de façon exacte, puisque l'écart y est nul.
--
-- POURQUOI `now()` SUFFIT POUR LE CAS EXACT. Dans PostgreSQL, `now()`
-- vaut l'heure de début de la TRANSACTION, pas l'heure courante. Pour
-- une ligne créée et modifiée dans la même transaction — le ticket de
-- caisse — `created_at` est exactement égal à `now()`. La comparaison
-- attrape donc ce cas sans dépendre d'un délai.
--
-- ── Ce que cette migration ne fait pas ──
--
-- Elle ne touche ni table, ni colonne, ni index, ni politique, ni
-- donnée. Elle remplace le corps d'une fonction de déclencheur, et
-- rien d'autre. Les lignes déjà écrites restent : un journal est une
-- trace, on n'en efface pas des lignes parce qu'elles gênent. Le
-- tableau de bord les masque déjà à l'affichage
-- (`retouchesDeCreation`, dans `src/lib/activite.ts`).
--
-- POUR REVENIR EN ARRIÈRE : rejouer la fonction telle qu'elle est dans
-- `supabase/migrations/20260912120000_journal_activite.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.journaliser_activite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ligne   jsonb;
  v_avant   jsonb;
  v_store   uuid;
  v_action  text;
  v_diff    jsonb := NULL;
  v_ignores text[] := ARRAY['updated_at', 'created_at'];
  v_cle     text;
  v_ne      timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ligne := to_jsonb(OLD);
    v_action := 'suppression';
  ELSIF TG_OP = 'UPDATE' THEN
    v_ligne := to_jsonb(NEW);
    v_avant := to_jsonb(OLD);
    v_action := 'modification';
  ELSE
    v_ligne := to_jsonb(NEW);
    v_action := 'creation';
  END IF;

  v_store := NULLIF(v_ligne ->> 'store_id', '')::uuid;
  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  -- Les colonnes que d'autres déclencheurs font bouger toutes seules.
  IF TG_TABLE_NAME = 'products' THEN
    v_ignores := v_ignores || ARRAY['stock_actuel', 'stock_reserve', 'stock_disponible'];
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_ignores := v_ignores
      || ARRAY['montant_paye', 'montant_rembourse', 'reste_a_payer', 'statut_paiement'];
  ELSIF TG_TABLE_NAME = 'sales' THEN
    -- CHANGEMENT 1 — `ticket_id` est rattaché par `create_sale` juste
    -- après l'insertion, dans la même transaction.
    v_ignores := v_ignores
      || ARRAY['montant_paye', 'montant_rembourse', 'solde_du', 'statut_credit', 'ticket_id'];
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_ignores := v_ignores || ARRAY['montant_paye', 'solde_du', 'statut_paiement'];
  END IF;

  -- CHANGEMENT 2 — une retouche dans la foulée de la création n'est pas
  -- une correction : c'est la création qui se termine.
  --
  -- `->>` rend NULL aussi bien quand la colonne n'existe pas que quand
  -- elle est vide, ce qui couvre les deux cas d'un seul test. On évite
  -- volontairement l'opérateur `?` de jsonb : il est ambigu quand du
  -- SQL transite par une API qui s'en sert comme marque-place.
  IF v_action = 'modification' THEN
    v_ne := (v_ligne ->> 'created_at')::timestamptz;
    IF v_ne IS NOT NULL AND v_ne > now() - interval '10 seconds' THEN
      RETURN NULL;
    END IF;
  END IF;

  IF v_action = 'modification' THEN
    v_diff := '{}'::jsonb;
    FOR v_cle IN SELECT jsonb_object_keys(v_ligne) LOOP
      CONTINUE WHEN v_cle = ANY (v_ignores);
      -- IS DISTINCT FROM et non <> : deux valeurs nulles sont égales
      -- ici, et une valeur qui devient nulle est bien un changement.
      IF (v_ligne -> v_cle) IS DISTINCT FROM (v_avant -> v_cle) THEN
        v_diff := v_diff || jsonb_build_object(
          v_cle, jsonb_build_object('avant', v_avant -> v_cle, 'apres', v_ligne -> v_cle)
        );
      END IF;
    END LOOP;
    -- Rien de lisible n'a changé : il n'y a rien à raconter.
    IF v_diff = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.journal_activite (
    store_id, acteur_id, entite, entite_id, action, etiquette, montant, changements
  )
  VALUES (
    v_store,
    auth.uid(),
    TG_TABLE_NAME,
    NULLIF(v_ligne ->> 'id', '')::uuid,
    v_action,
    COALESCE(
      v_ligne ->> 'numero',
      v_ligne ->> 'designation',
      v_ligne ->> 'nom',
      v_ligne ->> 'destinataire',
      v_ligne ->> 'client_nom',
      v_ligne ->> 'source'
    ),
    COALESCE(
      (v_ligne ->> 'total_vente')::numeric,
      (v_ligne ->> 'total_achat')::numeric,
      (v_ligne ->> 'montant')::numeric,
      (v_ligne ->> 'montant_total')::numeric,
      (v_ligne ->> 'total')::numeric
    ),
    v_diff
  );

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Voir l'en-tête de la migration 20260912120000 : perdre une ligne
    -- de journal est un incident, perdre une vente est un client qui
    -- repart. Le déclencheur n'a donc pas le droit d'échouer.
    RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.journaliser_activite() IS
  'Écrit une ligne de journal. N''échoue jamais. Tait les retouches qui appartiennent à la création.';

-- Les droits d'exécution restent retirés, comme la migration d'origine
-- les avait posés : c'est une fonction de déclencheur, elle n'a aucune
-- raison d'être appelable depuis l'API. `CREATE OR REPLACE` conserve
-- les privilèges existants, mais on le redit pour que rejouer ce
-- fichier seul sur une base neuve donne le même résultat.
REVOKE ALL ON FUNCTION public.journaliser_activite() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.journaliser_activite() FROM anon;
REVOKE ALL ON FUNCTION public.journaliser_activite() FROM authenticated;

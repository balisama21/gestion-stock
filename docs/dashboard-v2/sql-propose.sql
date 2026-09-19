-- ═══════════════════════════════════════════════════════════════════
-- PROPOSÉ, PAS EXÉCUTÉ.
--
-- Rien de ce fichier n'a été appliqué à la base. Aucune migration n'a
-- été écrite dans `supabase/migrations/`. À vous de décider.
--
-- ── Le symptôme ──
--
-- Enregistrer une vente inscrit DEUX lignes au journal d'activité :
--
--     16:16  Vente créée      V025   4 500 Ar
--     16:16  Règlement créé   PAY044 4 500 Ar
--     16:16  Vente modifiée   V025   4 500 Ar     ← celle-ci est du bruit
--
-- Créer un produit avec sa fiche descriptive en inscrit deux aussi :
--
--     10:55  Produit créé     P023
--     10:55  Produit modifié  P023                ← celle-ci aussi
--
-- Un seul geste, deux lignes. La seconde ne dit rien que la première
-- ne dise déjà, et elle salit l'historique que le commerçant relit.
--
-- ── D'où cela vient ──
--
-- `journaliser_activite()` (migration 20260912120000) écoute les
-- `UPDATE` autant que les `INSERT`. Deux écritures suivent de près une
-- création, et aucune n'est un geste humain :
--
--   VENTES    `create_sale` insère la vente, puis lui rattache son
--             ticket de caisse dans la MÊME transaction :
--             `UPDATE sales SET ticket_id = v_ticket WHERE id = …`
--             (migration 20260908110000, ligne 134). `ticket_id` est
--             un numéro de regroupement interne. Il n'est pas dans la
--             liste des colonnes ignorées, donc le diff n'est pas vide,
--             donc une ligne « modification » part.
--
--   PRODUITS  l'écran Produits appelle `create_product`, puis envoie
--             la fiche descriptive si elle a été remplie
--             (`ProduitsView.tsx`, ligne 349). Deux transactions
--             séparées par un aller-retour réseau, mais une seule
--             intention : « je crée ce produit ».
--
-- La liste d'exceptions prévue par la migration d'origine couvre déjà
-- les colonnes mécaniques (`stock_actuel`, `montant_paye`, `solde_du`…).
-- Elle est simplement incomplète.
--
-- ── Ce qui est déjà corrigé, sans toucher à la base ──
--
-- `retouchesDeCreation()` dans `src/lib/activite.ts` tait, À
-- L'AFFICHAGE, une modification qui suit la création de la même ligne,
-- par la même personne, en moins de dix secondes. Le tableau de bord
-- s'en sert déjà.
--
-- Cela ne remplace pas ce qui suit, pour deux raisons. La base continue
-- d'écrire des lignes inutiles, qui s'accumulent. Et l'historique de la
-- cloche ne peut pas profiter de la règle : il écarte les créations dès
-- sa requête et n'a donc rien à quoi rapprocher la modification.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- OPTION A — le strict nécessaire, risque quasi nul
--
-- Ajoute `ticket_id` aux colonnes ignorées pour `sales`, exactement
-- comme `montant_paye` ou `solde_du` le sont déjà. Corrige le cas des
-- ventes, qui est le plus fréquent : il se produit à CHAQUE vente.
--
-- Ne corrige pas le cas des produits.
-- ───────────────────────────────────────────────────────────────────

-- Dans `journaliser_activite()`, remplacer :
--
--   ELSIF TG_TABLE_NAME = 'sales' THEN
--     v_ignores := v_ignores
--       || ARRAY['montant_paye', 'montant_rembourse', 'solde_du', 'statut_credit'];
--
-- par :
--
--   ELSIF TG_TABLE_NAME = 'sales' THEN
--     v_ignores := v_ignores
--       || ARRAY['montant_paye', 'montant_rembourse', 'solde_du', 'statut_credit',
--                -- Rattaché par `create_sale` juste apres l'insertion, dans la
--                -- meme transaction. Regroupement interne, jamais une correction.
--                'ticket_id'];


-- ───────────────────────────────────────────────────────────────────
-- OPTION B — complet : A, plus une fenêtre de grâce
--
-- Ajoute la règle générale : une modification qui tombe dans les dix
-- secondes suivant la naissance de la ligne prolonge la création, elle
-- ne la corrige pas. Couvre le cas des produits, et couvrira d'avance
-- le prochain écran qui créera puis complétera.
--
-- CE QU'ON PERD. Une vraie correction faite dans les dix secondes qui
-- suivent une création ne sera plus journalisée. En pratique c'est la
-- même main qui finit sa saisie ; mais c'est un choix, pas un détail,
-- et c'est à vous de le faire. Réduire à `interval '3 seconds'` garde
-- le cas des ventes (même transaction, donc écart nul) et couvre la
-- plupart des cas produits, sans masquer grand-chose.
--
-- POURQUOI `now()` SUFFIT. Dans PostgreSQL, `now()` vaut l'heure de
-- début de la TRANSACTION, pas l'heure courante. Pour une ligne créée
-- et modifiée dans la même transaction — le cas du ticket de caisse —
-- `created_at` est exactement égal à `now()`. La comparaison attrape
-- donc ce cas de façon exacte, sans dépendre d'un délai.
-- ───────────────────────────────────────────────────────────────────

-- Dans `journaliser_activite()`, juste avant le bloc
-- `IF v_action = 'modification' THEN` qui calcule le diff, insérer :
--
--   -- Une retouche dans la foulée de la création n'est pas une
--   -- correction : c'est la création qui se termine. Voir l'en-tête
--   -- de ce fichier pour les deux cas connus.
--   IF v_action = 'modification'
--      AND (v_ligne ? 'created_at')
--      AND (v_ligne ->> 'created_at')::timestamptz > now() - interval '10 seconds'
--   THEN
--     RETURN NULL;
--   END IF;


-- ───────────────────────────────────────────────────────────────────
-- LA MIGRATION, SI VOUS DITES OUI
--
-- Le corps ci-dessous est celui de la migration 20260912120000, avec
-- les deux changements de l'option B en place. Il est SÛR au sens où
-- il ne touche ni table, ni colonne, ni index, ni politique : il
-- remplace une fonction de déclencheur, et rien d'autre. Aucune donnée
-- existante n'est lue, modifiée ni supprimée.
--
-- Pour revenir en arrière, il suffit de rejouer la fonction telle
-- qu'elle est dans `supabase/migrations/20260912120000_journal_activite.sql`.
--
-- Je ne l'ai pas exécuté, et je ne l'exécuterai pas sans votre accord.
-- ───────────────────────────────────────────────────────────────────

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
    -- CHANGEMENT 1 : `ticket_id` est rattaché par `create_sale` juste
    -- après l'insertion, dans la même transaction. C'est un numéro de
    -- regroupement interne, jamais une correction humaine.
    v_ignores := v_ignores
      || ARRAY['montant_paye', 'montant_rembourse', 'solde_du', 'statut_credit', 'ticket_id'];
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_ignores := v_ignores || ARRAY['montant_paye', 'solde_du', 'statut_paiement'];
  END IF;

  -- CHANGEMENT 2 : une retouche dans la foulée de la création n'est pas
  -- une correction, c'est la création qui se termine. `now()` vaut
  -- l'heure de début de transaction : pour une ligne créée puis
  -- modifiée dans la même transaction, l'égalité est exacte.
  IF v_action = 'modification'
     AND (v_ligne ? 'created_at')
     AND (v_ligne ->> 'created_at')::timestamptz > now() - interval '10 seconds'
  THEN
    RETURN NULL;
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
    -- Voir l'en-tête du fichier d'origine : perdre une ligne de journal
    -- est un incident, perdre une vente est un client qui repart.
    RETURN NULL;
END;
$function$;


-- ───────────────────────────────────────────────────────────────────
-- CE QUI N'EST PAS PROPOSÉ ICI, ET POURQUOI
--
-- NETTOYER LES LIGNES DÉJÀ ÉCRITES. Un `DELETE FROM journal_activite`
-- sur les doublons du passé serait tentant. Je ne le propose pas : un
-- journal est une trace, on n'en efface pas des lignes parce qu'elles
-- gênent. La règle d'affichage suffit à les cacher, et elles restent
-- consultables si une question se pose un jour.
--
-- CHANGER `create_sale` POUR ÉVITER L'UPDATE. Techniquement possible —
-- calculer le ticket avant l'insertion plutôt qu'après. Mais c'est
-- toucher au cœur de l'enregistrement d'une vente, sur une application
-- en service, pour un problème d'affichage. Le rapport risque/bénéfice
-- ne le justifie pas.
--
-- CHANGER `create_product` POUR ACCEPTER LA FICHE DESCRIPTIVE. Cela
-- supprimerait le second aller-retour et rendrait la création plus
-- rapide sur une connexion lente — un vrai bénéfice, au-delà du
-- journal. Mais cela change la signature d'une fonction que le code en
-- production appelle : il faudrait ajouter une surcharge, pas modifier
-- l'existante, sans quoi un navigateur resté ouvert depuis la veille
-- casserait. C'est un chantier à part, à décider pour lui-même.
-- ───────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- LA PRÉALERTE DE STOCK — 1. LES RÉGLAGES, ET LE CALCUL DU NIVEAU
-- ═══════════════════════════════════════════════════════════════════
--
-- ── Ce qu'on ajoute ──
--
-- Un commerçant a dix unités d'un produit et un seuil d'alerte à trois.
-- L'alerte actuelle le prévient à trois, c'est-à-dire trop tard : le
-- temps de joindre le fournisseur et d'être livré, il aura vendu ce
-- qui restait. Il veut être prévenu AVANT, à cinq, pour avoir le temps
-- de commander.
--
-- La préalerte ne remplace donc rien. Elle ajoute un niveau AU-DESSUS
-- du seuil existant, qui reste saisi produit par produit et que cette
-- migration ne touche pas.
--
-- ── Pourquoi une table, et non une clé dans `stores.personnalisation` ──
--
-- La colonne JSON existe déjà et porte le vocabulaire et les rappels :
-- l'y ranger n'aurait coûté aucune migration. On l'écarte pour une
-- raison précise. Le déclencheur qui surveillera le stock (migration
-- suivante) lira ces réglages en SQL, et un JSON ne peut pas garantir
-- que `mode` vaut bien « ecart » ou « pourcentage » : une valeur
-- aberrante écrite par l'interface casserait le calcul côté serveur en
-- silence. Des colonnes typées avec leurs CHECK rendent cela
-- impossible — la base refuse la ligne plutôt que de la subir.
--
-- ── PAS DE LIGNE = FONCTION DÉSACTIVÉE ──
--
-- C'est ce qui rend « désactivé par défaut » gratuit : aucune reprise
-- de données, aucune ligne à créer pour les boutiques existantes, et
-- le déclencheur sortira immédiatement quand il ne trouvera rien. Une
-- boutique qui n'active pas la préalerte ne paie rien et ne voit rien
-- changer.
--
-- ── Le verrou ──
--
-- Les deux policies d'écriture passent par
-- `proprietaire_dune_boutique_ouverte()`, comme les douze tables
-- refermées le 20/09. Sans cela, `policies_sans_verrou()` — le
-- contrôle de non-régression posé le même jour — signalerait cette
-- table à sa prochaine exécution. Il rend zéro ligne aujourd'hui, il
-- doit en rendre zéro après.

-- ───────────────────────────────────────────────────────────────────
-- 1. Les réglages d'une boutique
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reglages_alertes_stock (
  store_id         uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,

  prealerte_active boolean  NOT NULL DEFAULT false,

  -- Le mode et ses DEUX valeurs. Elles cohabitent volontairement :
  -- passer d'un mode à l'autre puis revenir ne perd pas le réglage
  -- précédent. C'est l'AFFICHAGE qui est exclusif — l'interface ne
  -- montre que le champ du mode choisi —, pas le stockage.
  mode             text     NOT NULL DEFAULT 'ecart'
                            CHECK (mode IN ('ecart', 'pourcentage')),

  -- Mode A : un nombre d'unités au-dessus du seuil. Convient aux
  -- petites quantités. Seuil 3 + écart 2 : préalerte à 5.
  ecart            integer  NOT NULL DEFAULT 2
                            CHECK (ecart BETWEEN 1 AND 9999),

  -- Mode B : un pourcentage au-dessus du seuil, arrondi au supérieur.
  -- Convient aux gros volumes, où deux unités d'avance ne laissent
  -- aucun temps de réaction. Seuil 200 + 50 % : préalerte à 300.
  pourcentage      integer  NOT NULL DEFAULT 50
                            CHECK (pourcentage BETWEEN 1 AND 1000),

  -- Le minimum est UN et non zéro dans les deux cas : un écart nul
  -- poserait la préalerte sur le seuil lui-même, c'est-à-dire un
  -- réglage qui a l'air actif et ne fait rien.

  frequence        text     NOT NULL DEFAULT 'quotidien'
                            CHECK (frequence IN ('mouvement', 'quotidien')),

  -- L'heure du résumé, en heure de Madagascar (UTC+3, sans heure
  -- d'été). Pas de colonne de fuseau : toutes les boutiques y sont
  -- aujourd'hui, et en ajouter une plus tard reste additif.
  heure_resume     smallint NOT NULL DEFAULT 8
                            CHECK (heure_resume BETWEEN 0 AND 23),

  -- Les canaux EN PLUS de la notification dans l'application, qui est
  -- toujours active et n'a donc pas à être stockée — ce serait un
  -- réglage qui ne se règle pas.
  --
  -- Un tableau plutôt que des colonnes booléennes : « whatsapp » est
  -- DÉJÀ autorisé par la contrainte. Le jour où on l'ajoutera, aucune
  -- migration — seul l'envoyeur restera à écrire, et le code parcourt
  -- une liste au lieu de tester des colonnes une à une.
  canaux           text[]   NOT NULL DEFAULT '{}'
                            CHECK (canaux <@ ARRAY['email', 'whatsapp']::text[]),

  mis_a_jour_le    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reglages_alertes_stock IS
  'Prealerte de stock, reglee par boutique. Pas de ligne = fonction desactivee : c est le defaut, et il ne coute aucune reprise de donnees.';
COMMENT ON COLUMN public.reglages_alertes_stock.canaux IS
  'Canaux EN PLUS de la notification dans l application. « whatsapp » est deja autorise : l ajouter ne demandera pas de migration.';
COMMENT ON COLUMN public.reglages_alertes_stock.heure_resume IS
  'Heure du resume quotidien, en heure de Madagascar (UTC+3).';

ALTER TABLE public.reglages_alertes_stock ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────
-- 2. Qui lit, qui écrit
-- ───────────────────────────────────────────────────────────────────
--
-- Lecture par toute l'équipe : le tableau de bord d'un collaborateur
-- devra pouvoir peindre la préalerte en orange comme celui du patron.
-- Écriture par le seul propriétaire, et seulement si sa boutique n'est
-- pas verrouillée.
--
-- Pas de policy DELETE : on désactive la préalerte en posant
-- `prealerte_active = false`, pas en supprimant la ligne. Une ligne par
-- boutique, qui garde les valeurs choisies pour la prochaine fois.

DROP POLICY IF EXISTS "L equipe lit les reglages d alerte" ON public.reglages_alertes_stock;
CREATE POLICY "L equipe lit les reglages d alerte"
  ON public.reglages_alertes_stock FOR SELECT
  USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS "Le proprietaire cree ses reglages d alerte" ON public.reglages_alertes_stock;
CREATE POLICY "Le proprietaire cree ses reglages d alerte"
  ON public.reglages_alertes_stock FOR INSERT
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));

DROP POLICY IF EXISTS "Le proprietaire modifie ses reglages d alerte" ON public.reglages_alertes_stock;
CREATE POLICY "Le proprietaire modifie ses reglages d alerte"
  ON public.reglages_alertes_stock FOR UPDATE
  USING (public.proprietaire_dune_boutique_ouverte(store_id))
  WITH CHECK (public.proprietaire_dune_boutique_ouverte(store_id));

-- ───────────────────────────────────────────────────────────────────
-- 3. La date de dernière modification ne se saisit pas
-- ───────────────────────────────────────────────────────────────────
--
-- Confiée à un déclencheur plutôt qu'à l'interface : un client qui
-- l'oublierait laisserait une date fausse, et rien n'empêcherait d'en
-- écrire n'importe laquelle. Le nom de colonne français interdit de
-- réemployer `update_updated_at()`, qui écrit dans `updated_at`.

CREATE OR REPLACE FUNCTION public.toucher_mis_a_jour_le()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.mis_a_jour_le := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS reglages_alertes_stock_touche ON public.reglages_alertes_stock;
CREATE TRIGGER reglages_alertes_stock_touche
  BEFORE UPDATE ON public.reglages_alertes_stock
  FOR EACH ROW EXECUTE FUNCTION public.toucher_mis_a_jour_le();

-- ───────────────────────────────────────────────────────────────────
-- 4. LE CALCUL DU NIVEAU DE PRÉALERTE
-- ───────────────────────────────────────────────────────────────────
--
-- Le stock à partir duquel on prévient, pour un produit donné.
--
-- ── Pourquoi elle est ici, et pourquoi elle existe aussi en TypeScript ──
--
-- Le calcul tourne dans deux mondes : Postgres, parce que les
-- notifications doivent partir même application fermée ; le
-- navigateur, pour l'affichage du tableau de bord et l'export. Une
-- seule fonction littérale est donc impossible. Le précédent exact
-- dans ce dépôt est `store_is_locked()`, recopiée en
-- `boutiqueEstVerrouillee()`.
--
-- Ce qui est garanti à la place : UNE implémentation par monde, et une
-- table de cas écrite une seule fois que les deux rejouent —
-- `src/lib/prealerteStock.test.ts` d'un côté,
-- `docs/prealerte/verification-du-calcul.sql` de l'autre. Deux
-- implémentations qui divergeraient font un test rouge, pas un client
-- surpris.
--
-- ── Les règles ──
--
--   seuil 0 ou absent    : 0, le produit reste hors du système.
--   mode « ecart »       : seuil + écart.       3 + 2 = 5 ; 5 + 2 = 7.
--   mode « pourcentage » : arrondi supérieur de seuil × (1 + p).
--                          3 × 1,5 = 4,5 donc 5 ; 200 × 1,5 = 300.
--
-- L'ARRONDI EST AU SUPÉRIEUR. Descendre 4,5 à 4 avec un seuil de 3 ne
-- laisserait qu'une unité d'avance, c'est-à-dire le problème qu'on
-- essaie de résoudre.
--
-- IMMUTABLE : le même appel rend toujours le même nombre. Cela la rend
-- utilisable dans un index le jour où un catalogue grossira.

CREATE OR REPLACE FUNCTION public.niveau_de_prealerte(
  p_seuil       integer,
  p_mode        text,
  p_ecart       integer,
  p_pourcentage integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(p_seuil, 0) <= 0 THEN 0
    WHEN p_mode = 'pourcentage'
      THEN ceil(p_seuil * (1 + coalesce(p_pourcentage, 0)::numeric / 100))::integer
    ELSE p_seuil + coalesce(p_ecart, 0)
  END;
$function$;

COMMENT ON FUNCTION public.niveau_de_prealerte(integer, text, integer, integer) IS
  'Stock a partir duquel on previent. Miroir SQL de niveauDePrealerte() dans src/lib/prealerteStock.ts : les deux rejouent la meme table de cas.';

REVOKE EXECUTE ON FUNCTION public.niveau_de_prealerte(integer, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.niveau_de_prealerte(integer, text, integer, integer) TO authenticated;

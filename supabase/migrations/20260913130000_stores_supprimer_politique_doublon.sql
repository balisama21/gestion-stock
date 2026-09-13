-- La table des boutiques portait deux fois la même politique.
--
-- ── D'où venait le doublon ──
--
-- La migration du rôle livreur (20260908190000) devait élargir la
-- lecture de la boutique pour qu'un livreur voie où il travaille. Ne
-- sachant pas lequel des deux noms existait déjà en base, elle a
-- prudemment recréé LES DEUX avec le même prédicat. Le réflexe était
-- bon sur une base en service — mieux vaut deux politiques qu'un accès
-- perdu — mais il a laissé un doublon permanent : deux politiques
-- identiques trait pour trait, évaluées toutes les deux à chaque
-- lecture de la table.
--
-- ── Ce qui a été constaté dans le catalogue avant de supprimer ──
--
-- Même commande (SELECT), même caractère permissif, mêmes rôles
-- (PUBLIC), même expression « est_dans_la_boutique(id) », et aucune
-- clause WITH CHECK ni pour l'une ni pour l'autre. Elles ne diffèrent
-- que par leur nom.
--
-- On garde « Store members can view store », le plus parlant des deux.
--
-- ── Ce qui a été vérifié en transaction annulée ──
--
-- Un propriétaire tiers a été rattaché temporairement comme LIVREUR à
-- une boutique, puisqu'il n'existe aucun livreur en base aujourd'hui et
-- que c'est précisément le cas que cette politique sert. Il voyait bien
-- la boutique AVANT la suppression — sans cette vérification le test
-- aurait été creux — et la voyait toujours après.
--
-- Aucun des quatre profils testés (administrateur, vendeur, ce livreur,
-- un compte fantôme) ne voit une liste de boutiques différente, les
-- identifiants étant comparés un à un et pas seulement comptés.
--
-- ── Ce que cette migration ne fait PAS ──
--
-- Elle ne fait pas disparaître l'avertissement « multiple permissive
-- policies » sur stores. Il reste trois politiques de lecture, mais ce
-- sont trois RÈGLES DISTINCTES et légitimes : l'administrateur de la
-- plateforme, le personnel de la boutique, le propriétaire. Les fondre
-- en une seule expression reviendrait à réécrire de la logique métier,
-- ce qui est une autre décision. Seul le doublon exact est retiré.

DO $migration$
BEGIN
  -- Garde-fou : ne jamais retirer le doublon sans avoir constaté que
  -- celle qu'on garde est bien là, avec le même prédicat. Sans cela,
  -- rejouer ce fichier sur une base où la survivante aurait disparu
  -- retirerait l'accès au lieu d'un doublon.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stores'
      AND policyname = 'Store members can view store'
      AND cmd = 'SELECT'
      AND qual = 'est_dans_la_boutique(id)'
  ) THEN
    RAISE EXCEPTION
      'La politique conservee est absente ou differente : suppression annulee';
  END IF;

  DROP POLICY IF EXISTS "Members can view store" ON public.stores;
END $migration$;

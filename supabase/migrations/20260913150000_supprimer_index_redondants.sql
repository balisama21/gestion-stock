-- Deux index simples qui doublaient un index unique.
--
-- ── Ce qui faisait doublon ──
--
-- `access_codes` portait `idx_access_codes_code` sur (code), alors que
-- la contrainte d'unicité `access_codes_code_key` indexe déjà exactement
-- la même colonne. Idem pour `collaborator_invitations` avec `token`.
--
-- Un index unique sert toutes les recherches qu'un index simple
-- servirait : le second n'ajoutait rien, occupait de la place et
-- ralentissait chaque écriture sur la table.
--
-- ── Mesuré avant de supprimer ──
--
-- Le planificateur départageait deux index identiques de façon
-- arbitraire, et c'est le doublon qu'il avait choisi :
--
--   idx_access_codes_code               16 lectures
--   access_codes_code_key                0 lecture
--   idx_invitations_token                6 lectures
--   collaborator_invitations_token_key   0 lecture
--
-- Après suppression, l'index unique reprend la main au MÊME COÛT :
--
--   avant  Index Only Scan using idx_access_codes_code    0,14..2,36
--   après  Index Only Scan using access_codes_code_key    0,14..2,36
--
-- ── Le piège du test creux ──
--
-- Avec vingt-et-une lignes, le planificateur balaie la table quoi qu'il
-- arrive : les deux plans auraient été identiques sans rien démontrer.
-- La vérification a donc forcé la préférence pour un index
-- (enable_seqscan = off), seul moyen de prouver qu'un chemin indexé
-- subsiste bien après la suppression.
--
-- Vérifié aussi ce qui DOIT échouer : donner à une ligne le code d'une
-- autre reste refusé (unique_violation). L'unicité n'est pas portée par
-- l'index qu'on retire.

DO $migration$
DECLARE
  v_ok int;
BEGIN
  -- Garde-fou : ne jamais retirer le doublon sans avoir constaté que
  -- l'index unique qui doit prendre le relais existe, porte bien sur la
  -- même colonne, et est valide. Rejoué sur une base où il aurait
  -- disparu, ce fichier échoue au lieu de laisser la colonne sans index.
  SELECT count(*) INTO v_ok
  FROM pg_index i
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_class t  ON t.oid  = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'access_codes'
    AND ic.relname = 'access_codes_code_key'
    AND i.indisunique AND i.indisvalid AND i.indisready
    AND pg_get_indexdef(i.indexrelid) LIKE '%btree (code)%';
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'L index unique sur access_codes(code) est absent ou invalide : suppression annulee';
  END IF;
  DROP INDEX IF EXISTS public.idx_access_codes_code;

  SELECT count(*) INTO v_ok
  FROM pg_index i
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_class t  ON t.oid  = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'collaborator_invitations'
    AND ic.relname = 'collaborator_invitations_token_key'
    AND i.indisunique AND i.indisvalid AND i.indisready
    AND pg_get_indexdef(i.indexrelid) LIKE '%btree (token)%';
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'L index unique sur collaborator_invitations(token) est absent ou invalide : suppression annulee';
  END IF;
  DROP INDEX IF EXISTS public.idx_invitations_token;
END $migration$;

-- ═══════════════════════════════════════════════════════════════════
-- LE CALCUL DU NIVEAU DE PRÉALERTE, VÉRIFIÉ CÔTÉ BASE
-- ═══════════════════════════════════════════════════════════════════
--
-- À coller tel quel dans l'éditeur SQL de Supabase. Ne lit ni n'écrit
-- aucune donnée : la liste des cas est dans la requête.
--
-- Toutes les lignes doivent porter « ok ».
--
-- ── Pourquoi ce fichier existe ──
--
-- Le calcul de la préalerte tourne dans deux mondes : Postgres pour le
-- déclencheur qui surveille le stock, le navigateur pour l'affichage et
-- l'export. Deux implémentations, donc, et le risque qu'elles finissent
-- par ne plus dire la même chose.
--
-- Le bloc ci-dessous est ENGENDRÉ à partir de
-- `docs/prealerte/cas-de-calcul.json`, qui est la source unique. Le test
-- `src/lib/prealerteStock.test.ts` fait deux choses : il rejoue cette
-- liste contre l'implémentation TypeScript, et il vérifie que le bloc
-- ci-dessous correspond toujours au JSON — en affichant, s'il a changé,
-- le texte exact à recopier ici. Modifier les cas sans mettre ce fichier
-- à jour fait donc un test rouge.

WITH cas(n, seuil, mode, ecart, pourcentage, attendu, nom) AS (
  VALUES
-- ▼▼▼ engendré depuis docs/prealerte/cas-de-calcul.json — ne pas éditer à la main ▼▼▼
    (1, 3, 'ecart', 2, 50, 5, 'ecart : seuil 3 + 2, l''exemple du client'),
    (2, 5, 'ecart', 2, 50, 7, 'ecart : seuil 5 + 2, l''exemple du client'),
    (3, 1, 'ecart', 1, 50, 2, 'ecart : le plus petit reglage possible donne une unite d''avance'),
    (4, 200, 'ecart', 2, 50, 202, 'ecart : sur un gros volume, deux unites d''avance ne servent a rien'),
    (5, 3, 'pourcentage', 2, 50, 5, 'pourcentage : seuil 3 et 50 %, l''exemple du client, 4,5 arrondi a 5'),
    (6, 200, 'pourcentage', 2, 50, 300, 'pourcentage : seuil 200 et 50 %, l''exemple du client'),
    (7, 7, 'pourcentage', 2, 50, 11, 'pourcentage : 10,5 arrondi au superieur, pas a l''inferieur'),
    (8, 4, 'pourcentage', 2, 25, 5, 'pourcentage : un resultat entier ne bouge pas'),
    (9, 1, 'pourcentage', 2, 1, 2, 'pourcentage : le plus petit reglage donne quand meme une unite'),
    (10, 10, 'pourcentage', 2, 100, 20, 'pourcentage : doubler le seuil'),
    (11, 0, 'ecart', 2, 50, 0, 'sans seuil, le produit reste hors du systeme (ecart)'),
    (12, 0, 'pourcentage', 2, 50, 0, 'sans seuil, le produit reste hors du systeme (pourcentage)')
-- ▲▲▲ fin du bloc engendré ▲▲▲
)
SELECT
  n,
  nom,
  seuil,
  mode,
  CASE WHEN mode = 'ecart' THEN ecart ELSE pourcentage END AS valeur,
  attendu,
  public.niveau_de_prealerte(seuil, mode, ecart, pourcentage) AS obtenu,
  CASE
    WHEN public.niveau_de_prealerte(seuil, mode, ecart, pourcentage) = attendu THEN 'ok'
    ELSE '>>> ECHEC'
  END AS verdict
FROM cas
ORDER BY n;

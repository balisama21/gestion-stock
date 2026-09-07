-- ═══════════════════════════════════════════════════════════════════
-- Étape 3 bis (suite) — le vocabulaire et les modules
--
-- Une pharmacie ne dit pas « clients » mais « patients », une école dit
-- « élèves », un atelier dit « articles » plutôt que « produits ». Et
-- toutes n'utilisent pas les mêmes modules : une entreprise de service
-- n'a que faire d'un écran d'achats de marchandise.
--
-- Une seule colonne, sur la boutique. C'est un réglage de la boutique
-- entière, pas une donnée métier : il n'a ni historique, ni recherche,
-- ni relation. Une table dédiée aurait imposé une jointure à chaque
-- chargement pour lire trois libellés.
--
-- Forme attendue :
--   { "modules": { "clients": { "libelle": "Patients", "masque": false } } }
--
-- Une clé absente veut dire « comme prévu par le logiciel ». C'est ce
-- qui permet d'ajouter un module plus tard sans toucher aux boutiques
-- déjà configurées.
--
-- MIGRATION ADDITIVE. Une colonne avec un défaut, rien d'autre. Le code
-- en service chez le client ignore cette colonne.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS personnalisation JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Comme pour les champs personnalisés : un objet, jamais un tableau ni
-- un nombre nu, sans quoi la lecture côté application n'aurait plus de
-- forme sûre à attendre.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_personnalisation_objet') THEN
    ALTER TABLE stores ADD CONSTRAINT stores_personnalisation_objet
      CHECK (jsonb_typeof(personnalisation) = 'object') NOT VALID;
    ALTER TABLE stores VALIDATE CONSTRAINT stores_personnalisation_objet;
  END IF;
END $$;

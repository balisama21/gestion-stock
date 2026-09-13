-- Les trois index qui manquaient à la table des rappels.
--
-- Le premier corrige une erreur de la migration précédente : la table
-- n'était indexée que sur son destinataire, alors que l'application la
-- lit par boutique, triée par date de création, à chaque ouverture
-- (`useRappels.charger`). Le planificateur balayait donc la table
-- entière puis triait. Mesuré sur trois mille lignes fictives, dans une
-- transaction annulée :
--
--   avant  Seq Scan + Sort            coût 260,77 → 268,27
--   après  Index Scan, sans tri       coût   0,28 → 123,72
--
-- L'index couvre le filtre ET l'ordre, ce qui fait disparaître le tri :
-- les lignes sortent déjà rangées.
--
-- Les deux suivants couvrent des clés étrangères déclarées ON DELETE
-- CASCADE. Sans eux, supprimer une tâche ou un événement oblige
-- Postgres à balayer tous les rappels pour retrouver ceux qui en
-- dépendent — invisible aujourd'hui, coûteux après un an d'usage.
-- Le même test donne un Index Only Scan à 2,50 au lieu du balayage.
--
-- Ajout pur : aucune donnée touchée, aucune lecture ni écriture
-- existante modifiée, aucune politique changée. Une version plus
-- ancienne de l'application encore ouverte dans un navigateur continue
-- de fonctionner à l'identique.

CREATE INDEX IF NOT EXISTS idx_rappels_boutique
  ON public.rappels (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rappels_evenement
  ON public.rappels (evenement_id);

CREATE INDEX IF NOT EXISTS idx_rappels_tache
  ON public.rappels (tache_id);

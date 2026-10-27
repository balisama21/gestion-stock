-- ═══════════════════════════════════════════════════════════════════
-- TEMPS RÉEL POUR LA SECTION « OPÉRATIONS » DU TABLEAU DE BORD
--
-- Ajoute à la publication `supabase_realtime` les tables que la section
-- affiche : tâches, agenda, rappels, commandes, livraisons, ventes,
-- paiements, produits (alertes de stock) et devis. Le client
-- (`src/hooks/useTempsReel.ts`) écoute les créations et modifications de
-- la boutique active et relit la source concernée.
--
-- STRICTEMENT ADDITIF : aucune table, colonne, donnée ni politique n'est
-- modifiée. Realtime applique les politiques RLS de lecture de chaque
-- abonné : personne ne reçoit une ligne qu'il ne pourrait pas lire.
--
-- Idempotent : une table déjà publiée est laissée telle quelle.
--
-- Pour revenir en arrière :
--   alter publication supabase_realtime drop table public.<table>;
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'taches', 'evenements', 'rappels', 'orders', 'deliveries',
    'sales', 'payments', 'products', 'quotes'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

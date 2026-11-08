-- Données du transport push, accessibles uniquement au serveur.
create table public.rappel_push_appareils (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 endpoint text not null unique, abonnement jsonb not null, fuseau text not null,
 cree_le timestamptz not null default now()
);
create index rappel_push_destinataire on public.rappel_push_appareils(user_id);
create table public.rappel_push_envois (
 appareil uuid references public.rappel_push_appareils on delete cascade,
 rappel uuid references public.rappels on delete cascade, echeance timestamptz not null,
 reserve_le timestamptz not null default now(), envoye boolean not null default false,
 primary key(appareil,rappel,echeance)
);
create table public.rappel_push_config (id boolean primary key default true check(id), clefs jsonb not null);
alter table public.rappel_push_config enable row level security;
alter table public.rappel_push_appareils enable row level security;
alter table public.rappel_push_envois enable row level security;
revoke all on public.rappel_push_config,public.rappel_push_appareils,public.rappel_push_envois from public, anon, authenticated;
grant all on public.rappel_push_config,public.rappel_push_appareils,public.rappel_push_envois to service_role;

create function public.reserver_rappels_push() returns table(
 appareil uuid, rappel uuid, echeance timestamptz, abonnement jsonb
) language sql set search_path='' as $$
 with dus as (
 select a.id appareil,r.id rappel,d.echeance
 from public.rappels r join public.rappel_push_appareils a on a.user_id=r.destinataire_id
 join public.stores s on s.id=r.store_id
 cross join lateral (select (now() at time zone a.fuseau)::date as jour) j
 cross join lateral (select case when r.recurrence='aucune' then r.declenche_le
   else (j.jour+r.heure) at time zone a.fuseau end as echeance) d
 where r.actif and (s.owner_id=a.user_id or exists(select 1 from public.store_members m where m.store_id=s.id and m.user_id=a.user_id and m.role::text not in ('livreur','pending')))
 and (r.recurrence in ('aucune','quotidien') or (r.recurrence='hebdomadaire' and extract(dow from j.jour)=r.jour_semaine)
 or (r.recurrence='mensuel' and extract(day from j.jour)=r.jour_mois))
 and d.echeance between greatest(now()-interval '5 minutes',a.cree_le,r.created_at) and now()
 ), reserves as (
 insert into public.rappel_push_envois as e(appareil,rappel,echeance)
 select d.* from dus d where not exists(select from public.rappel_push_envois e where (e.appareil,e.rappel,e.echeance)=(d.appareil,d.rappel,d.echeance) and (e.envoye or e.reserve_le>now()-interval '50 seconds'))
 order by d.echeance limit 200
 on conflict on constraint rappel_push_envois_pkey do update set reserve_le=now() where not e.envoye and e.reserve_le<now()-interval '50 seconds'
 returning e.appareil,e.rappel,e.echeance)
 select r.*,a.abonnement from reserves r join public.rappel_push_appareils a on a.id=r.appareil
$$;
revoke all on function public.reserver_rappels_push() from public, anon, authenticated;
grant execute on function public.reserver_rappels_push() to service_role;

do $$ begin
 if not exists(select from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rappels') then
 alter publication supabase_realtime add table public.rappels;
 end if;
end $$;
select vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'tantana_rappel_cron');
create function public.autoriser_cron_rappels(jeton text) returns boolean
 language sql security definer set search_path='' as $$
 select exists(select from vault.decrypted_secrets where name='tantana_rappel_cron' and decrypted_secret=jeton)
$$;
revoke all on function public.autoriser_cron_rappels(text) from public,anon,authenticated;
grant execute on function public.autoriser_cron_rappels(text) to service_role;
select cron.schedule('tantana-rappels-minute','* * * * *',$job$
 select net.http_post(url:='https://jasyacrnpimgwapcjkpr.supabase.co/functions/v1/rappels-push',
 headers:=jsonb_build_object('Content-Type','application/json','X-Rappel-Cron',(select decrypted_secret from vault.decrypted_secrets where name='tantana_rappel_cron')),
 body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=45000)
 where exists(select from public.rappel_push_appareils);
$job$);
select cron.schedule('tantana-rappels-nettoyage','17 3 * * *',$job$
 delete from public.rappel_push_envois where echeance<now()-interval '1 day'
$job$);

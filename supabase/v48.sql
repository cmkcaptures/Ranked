-- Ranked v48: private visitor stats. Anonymous page views (random per-browser id, page, referrer site), readable
-- only through site_stats(), which only AspextPro can call. Run after v47.sql.
create table if not exists page_views (
  id bigserial primary key,
  vid text not null,                    -- random id stored in the visitor's browser
  page text not null,
  src text,                             -- referrer site on the first view of a visit
  user_id uuid,
  at timestamptz default now()
);
create index if not exists page_views_at on page_views (at);
alter table page_views enable row level security;
drop policy if exists "log views" on page_views;
create policy "log views" on page_views for insert to anon, authenticated with check (char_length(vid) <= 40 and char_length(page) <= 40 and char_length(coalesce(src, '')) <= 80);

create or replace function site_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uk timestamptz := date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London';
begin
  if not coalesce((select username = 'AspextPro' from profiles where id = auth.uid()), false) then raise exception 'Only the owner can see site stats'; end if;
  return jsonb_build_object(
    'today', (select count(distinct vid) from page_views where at >= uk),
    'week', (select count(distinct vid) from page_views where at >= now() - interval '7 days'),
    'all', (select count(distinct vid) from page_views),
    'views_week', (select count(*) from page_views where at >= now() - interval '7 days'),
    'signups', (select count(*) from profiles),
    'signups_week', (select count(*) from profiles where created_at >= now() - interval '7 days'),
    'leagues', (select count(*) from leagues), 'league_players', (select count(*) from league_members),
    'traders_week', (select count(distinct user_id) from activity where kind = 'trade' and created_at >= now() - interval '7 days'),
    'daily', coalesce((select jsonb_agg(x order by d) from (select (at at time zone 'Europe/London')::date d, count(distinct vid) v from page_views
      where at >= now() - interval '14 days' group by 1) x), '[]'),
    'sources', coalesce((select jsonb_agg(x) from (select coalesce(nullif(src, ''), 'direct') src, count(distinct vid) v from page_views
      where at >= now() - interval '7 days' and src is not null group by 1 order by 2 desc limit 10) x), '[]'),
    'pages', coalesce((select jsonb_agg(x) from (select page, count(*) n, count(distinct vid) v from page_views
      where at >= now() - interval '7 days' group by 1 order by 2 desc limit 12) x), '[]'),
    'signed_in_share', (select round(100.0 * count(distinct vid) filter (where user_id is not null) / nullif(count(distinct vid), 0)) from page_views where at >= now() - interval '7 days')
  );
end $$;
revoke execute on function site_stats() from public, anon;
grant execute on function site_stats() to authenticated;
select 'ok' as site_stats_ready;

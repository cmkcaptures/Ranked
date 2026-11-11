-- Ranked v44: multiple fantasy leagues. Run after v43.sql.
-- Every league is its own "season key": the original squad keeps 'FALL-2026'; new leagues use 'FALL-2026:<id>'.
-- fantasy_season() now returns the CALLER's league key, so draft, swaps, trades, chips, captains, waivers, cup etc.
-- all work per league without changing them. Background jobs loop over every league.

-- 1) base season (old formula) + league-aware fantasy_season()
create or replace function fantasy_base(ts timestamptz default now()) returns text language sql immutable as $$
  select (array['WINTER','SPRING','SUMMER','FALL'])[(extract(month from ts)::int - 1) / 3 + 1] || '-' || extract(year from ts)::int
$$;

create table if not exists leagues (
  id text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 6),
  base text not null default fantasy_base(),
  name text not null,
  code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  owner uuid references profiles on delete set null,
  public boolean not null default false,
  max_teams int not null default 8,
  created_at timestamptz default now()
);
create table if not exists league_members (
  base text not null, user_id uuid not null references profiles on delete cascade,
  league_id text not null references leagues on delete cascade, joined_at timestamptz default now(),
  primary key (base, user_id)
);
alter table leagues enable row level security;
alter table league_members enable row level security;
drop policy if exists "read leagues" on leagues; create policy "read leagues" on leagues for select to authenticated using (true);
drop policy if exists "read members" on league_members; create policy "read members" on league_members for select to authenticated using (true);

create or replace function fantasy_league_id() returns text language plpgsql stable security definer set search_path = public as $$
declare l text := nullif(current_setting('ranked.league', true), '');
begin
  if l is not null then return case when l = 'main' then null else l end; end if;
  return (select league_id from league_members where user_id = auth.uid() and base = fantasy_base());
end $$;

create or replace function fantasy_season(ts timestamptz default now()) returns text language plpgsql stable security definer set search_path = public as $$
declare l text := fantasy_league_id();
begin
  return fantasy_base(ts) || case when l is null then '' else ':' || l end;
end $$;

-- commissioner: AspextPro in the original league, the owner in any other
create or replace function is_commissioner() returns boolean language plpgsql stable security definer set search_path = public as $$
declare l text := fantasy_league_id();
begin
  if l is null then return coalesce((select username = 'AspextPro' from profiles where id = auth.uid()), false); end if;
  return coalesce((select owner = auth.uid() from leagues where id = l), false);
end $$;

-- 2) creating / joining leagues
create or replace function fantasy_in_main(p_user uuid) returns boolean language sql stable as $$
  select exists (select 1 from fantasy_picks where user_id = p_user and season = fantasy_base())
      or exists (select 1 from fantasy_draft where season = fantasy_base() and p_user = any(joined))
$$;

create or replace function league_enter(p_league text) returns void
language plpgsql security definer set search_path = public as $$
declare lg leagues; n int; s text;
begin
  select * into lg from leagues where id = p_league;
  if lg is null then raise exception 'League not found'; end if;
  if fantasy_in_main(auth.uid()) then raise exception 'You''re already in the original squad league this season'; end if;
  if exists (select 1 from league_members where user_id = auth.uid() and base = lg.base) then raise exception 'You''re already in a league this season. Leave it first'; end if;
  select count(*) into n from league_members where league_id = lg.id;
  if n >= lg.max_teams then raise exception 'That league is full'; end if;
  s := lg.base || ':' || lg.id;
  if exists (select 1 from fantasy_draft where season = s and status <> 'lobby') then raise exception 'That league has already drafted'; end if;
  insert into league_members (base, user_id, league_id) values (lg.base, auth.uid(), lg.id);
  insert into fantasy_draft (season) values (s) on conflict do nothing;
  update fantasy_draft set joined = array_append(array_remove(joined, auth.uid()), auth.uid()), updated_at = now() where season = s;
  insert into notifications (user_id, text) select m.user_id, format('🏆 %s joined your league %s', (select username from profiles where id = auth.uid()), lg.name)
    from league_members m where m.league_id = lg.id and m.user_id <> auth.uid();
end $$;

create or replace function league_create(p_name text, p_public boolean default false) returns leagues
language plpgsql security definer set search_path = public as $$
declare lg leagues;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Give your league a name'; end if;
  insert into leagues (name, owner, public) values (left(trim(p_name), 40), auth.uid(), coalesce(p_public, false)) returning * into lg;
  perform league_enter(lg.id);
  return lg;
end $$;

create or replace function league_join(p_code text) returns leagues
language plpgsql security definer set search_path = public as $$
declare lg leagues;
begin
  select * into lg from leagues where code = upper(trim(p_code)) and base = fantasy_base();
  if lg is null then raise exception 'No league with that code this season'; end if;
  perform league_enter(lg.id);
  return lg;
end $$;

-- solo players: drop into an open public league that hasn't drafted yet, or start a new one
create or replace function league_join_public() returns leagues
language plpgsql security definer set search_path = public as $$
declare lg leagues; n int;
begin
  select l.* into lg from leagues l
    where l.public and l.base = fantasy_base()
      and (select count(*) from league_members m where m.league_id = l.id) < l.max_teams
      and coalesce((select status from fantasy_draft d where d.season = l.base || ':' || l.id), 'lobby') = 'lobby'
    order by l.created_at limit 1;
  if lg is null then
    select count(*) + 1 into n from leagues where public and base = fantasy_base();
    insert into leagues (name, owner, public) values ('Open League #' || n, auth.uid(), true) returning * into lg;
  end if;
  perform league_enter(lg.id);
  return lg;
end $$;

create or replace function league_leave() returns void
language plpgsql security definer set search_path = public as $$
declare m league_members; s text;
begin
  select * into m from league_members where user_id = auth.uid() and base = fantasy_base();
  if m is null then raise exception 'You''re not in a league'; end if;
  s := m.base || ':' || m.league_id;
  if exists (select 1 from fantasy_draft where season = s and status <> 'lobby') then raise exception 'You can''t leave after the draft has started'; end if;
  update fantasy_draft set joined = array_remove(joined, auth.uid()) where season = s;
  delete from league_members where user_id = auth.uid() and base = m.base;
  -- empty leagues tidy themselves up; hand ownership on if the owner left
  if not exists (select 1 from league_members where league_id = m.league_id) then delete from leagues where id = m.league_id;
  else update leagues set owner = (select user_id from league_members where league_id = m.league_id order by joined_at limit 1) where id = m.league_id and owner = auth.uid(); end if;
end $$;

-- public leagues start themselves once full
create or replace function league_autostart() returns void
language plpgsql security definer set search_path = public as $$
declare l record;
begin
  for l in select lg.*, lg.base || ':' || lg.id as s from leagues lg where lg.public and lg.base = fantasy_base()
           and (select count(*) from league_members m where m.league_id = lg.id) >= lg.max_teams loop
    update fantasy_draft set status = 'live', pick_no = 0, turn_started = now(), updated_at = now(),
      draft_order = (select array_agg(u order by random()) from unnest(joined) u) where season = l.s and status = 'lobby';
  end loop;
end $$;

-- 3) story moments credit EVERY league that drafted the character
create or replace function fantasy_on_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; k text;
begin
  if new.event_key is not null and new.event_key is distinct from old.event_key then
    k := case when new.event_key like 'm%' then 'chapter' else 'episode' end;
    for r in select season, user_id from fantasy_picks where char_id = new.id and (season = fantasy_base() or season like fantasy_base() || ':%') loop
      if fantasy_dead(new.id, r.season) then continue; end if;
      if exists (select 1 from fantasy_events where season = r.season and char_id = new.id and kind = k and status = 'confirmed' and created_at > now() - interval '5 days') then continue; end if;
      insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
        values (r.season, fantasy_week(), r.user_id, new.id, k, case when k = 'chapter' then 8 else 10 end, new.event_label);
    end loop;
  end if;
  return new;
end $$;

create or replace function fantasy_bot_log(p_secret text, p_char int, p_kind text, p_ref text, p_note text, p_link text) returns text
language plpgsql security definer set search_path = public as $$
declare r record; pts int; done int := 0; any_pick boolean := false;
begin
  if p_secret is distinct from (select value from app_config where key = 'fantasy_bot_secret') then raise exception 'bad secret'; end if;
  pts := case p_kind when 'transform' then 20 when 'debut' then 30 when 'win' then 8 when 'appear' then 3 when 'lose' then -5 when 'death' then -20 when 'revive' then 0 when 'news' then 15 when 'trailer' then 20 end;
  if pts is null then raise exception 'Unknown kind %', p_kind; end if;
  for r in select season, user_id from fantasy_picks where char_id = p_char and (season = fantasy_base() or season like fantasy_base() || ':%') loop
    any_pick := true;
    if fantasy_dead(p_char, r.season) and p_kind not in ('revive', 'news', 'trailer') then continue; end if;
    if p_kind = 'debut' and exists (select 1 from fantasy_events where season = r.season and char_id = p_char and kind = 'debut' and ref = p_ref and status <> 'reset') then continue; end if;
    insert into fantasy_events (season, week, team_user, char_id, kind, points, note, link, source, status, ref)
      values (r.season, fantasy_week(), r.user_id, p_char, p_kind, pts, left(p_note, 200), left(p_link, 300), 'bot', 'confirmed', p_ref)
      on conflict do nothing;
    if found then done := done + 1; end if;
  end loop;
  return case when not any_pick then 'not drafted' when done > 0 then 'ok (' || done || ' league' || case when done > 1 then 's' else '' end || ')' else 'already logged' end;
end $$;

drop function if exists fantasy_bot_watchlist(text);
create or replace function fantasy_bot_watchlist(p_secret text) returns table (
  char_id int, name text, media_title text, form text, team text, event_label text, event_until timestamptz, dead boolean, logged jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from app_config where key = 'fantasy_bot_secret') then raise exception 'bad secret'; end if;
  return query
    select distinct on (c.id) c.id, c.name, c.media_title, c.form, pr.username, c.event_label, c.event_until, fantasy_dead(c.id, fp.season),
      coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'ref', e.ref)) from fantasy_events e
        where e.char_id = c.id and e.season = fp.season and e.ref is not null), '[]')
    from fantasy_picks fp join characters c on c.id = fp.char_id join profiles pr on pr.id = fp.user_id
    where fp.season = fantasy_base() or fp.season like fantasy_base() || ':%'
    order by c.id, (fp.season = fantasy_base()) desc;
end $$;
revoke execute on function fantasy_bot_watchlist(text) from public;
grant execute on function fantasy_bot_watchlist(text) to anon, authenticated;

-- 4) background jobs run once per league
create or replace function fantasy_each_league(p_fn text) returns void
language plpgsql security definer set search_path = public as $$
declare l text;
begin
  for l in select 'main' union all select id from leagues where base in (fantasy_base(), fantasy_base(now() - interval '1 hour')) loop
    perform set_config('ranked.league', l, true);
    begin execute format('select %I()', p_fn); exception when others then raise warning '% failed for league %: %', p_fn, l, sqlerrm; end;
  end loop;
  perform set_config('ranked.league', '', true);
end $$;
revoke execute on function fantasy_each_league(text) from public, anon, authenticated;

select cron.schedule('fantasy-weekly', '5 * * * *', $q$select fantasy_each_league('fantasy_weekly')$q$);
select cron.schedule('fantasy-bonuses', '20 * * * *', $q$select fantasy_each_league('fantasy_bonuses')$q$);
select cron.schedule('fantasy-cup', '25 * * * *', $q$select fantasy_each_league('fantasy_cup_award')$q$);
select cron.schedule('fantasy-waivers', '*/10 * * * *', $q$select fantasy_each_league('fantasy_waivers_run')$q$);
select cron.schedule('league-autostart', '*/5 * * * *', 'select league_autostart()');

alter publication supabase_realtime add table leagues;
alter publication supabase_realtime add table league_members;
select fantasy_season() as main_key, 'ok' as leagues_ready;

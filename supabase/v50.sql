-- Ranked v50: chips are earned, Stockpile rework, more ways to lose points. Run after v49.sql.
--  🎴 Chips: everyone starts with 1. Every 3 weeks you finish in the top half of the weekly scores earns another.
--  📦 Stockpile (was piggy bank): cash out early for half, captain cashes out x1.5.
--  📉 Risk: daily hype now pays -2 (bottom) to +5 (top). 👻 No-show: show aired but the character never appeared = -4.

-- ===== chips =====
create or replace function fantasy_chips_earned(p_user uuid, p_season text) returns int
language sql stable security definer set search_path = public as $$
  with wk as (select team_user, week, sum(points) pts from fantasy_events
              where season = p_season and status = 'confirmed' and week < fantasy_week() group by team_user, week),
       rk as (select team_user, week, rank() over (partition by week order by pts desc) r, count(*) over (partition by week) n from wk)
  select 1 + (count(*) filter (where team_user = p_user and r <= ceil(n / 2.0)))::int / 3 from rk
$$;
grant execute on function fantasy_chips_earned(uuid, text) to authenticated;

create or replace function fantasy_play_chip(p_chip text) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); w int := fantasy_week();
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from fantasy_picks where season = s and user_id = auth.uid()) then raise exception 'Draft a team first'; end if;
  if exists (select 1 from fantasy_chips where season = s and user_id = auth.uid() and chip = p_chip) then raise exception 'You''ve already used that chip this season'; end if;
  if exists (select 1 from fantasy_chips where season = s and user_id = auth.uid() and week = w) then raise exception 'One chip per week'; end if;
  if (select count(*) from fantasy_chips where season = s and user_id = auth.uid()) >= fantasy_chips_earned(auth.uid(), s) then
    raise exception 'No chip to play yet. You earn one every 3 weeks you finish in the top half'; end if;
  if p_chip = 'boost' and (select count(*) from fantasy_picks where season = s and user_id = auth.uid()) < 6 then raise exception 'Bench Boost needs a bench player'; end if;
  insert into fantasy_chips (season, user_id, chip, week) values (s, auth.uid(), p_chip, w);
  insert into notifications (user_id, text)
    select distinct fp.user_id, format('🎴 %s played %s this week', (select username from profiles where id = auth.uid()),
      case p_chip when 'triple' then 'Triple Captain (captain x3)' when 'boost' then 'Bench Boost (all 6 count)' else 'Wildcard (unlimited swaps)' end)
    from fantasy_picks fp where fp.season = s and fp.user_id <> auth.uid();
end $$;

-- ===== stockpile =====
create or replace function fantasy_vault_payout() returns trigger
language plpgsql security definer set search_path = public as $$
declare v fantasy_vaults;
begin
  if new.char_id is null or new.status <> 'confirmed'
     or new.kind not in ('news', 'trailer', 'episode', 'chapter', 'appear', 'transform', 'debut', 'win') then return new; end if;
  select * into v from fantasy_vaults where season = new.season and char_id = new.char_id for update;
  if v is null or v.amount <= 0 then return new; end if;
  update fantasy_vaults set amount = 0, weeks = 0, updated_at = now() where season = v.season and char_id = v.char_id;
  if v.user_id is distinct from new.team_user then return new; end if;
  insert into fantasy_events (season, week, team_user, char_id, kind, points, note, source, status, ref)
    values (new.season, new.week, new.team_user, new.char_id, 'vault', v.amount,
      left(format('📦 Stockpile cashed out after %s quiet week%s: %s', v.weeks, case when v.weeks = 1 then '' else 's' end, coalesce(new.note, new.kind)), 200),
      'auto', 'confirmed', 'vault:' || new.id);
  return new;
end $$;

-- cash out early: half now, stockpile resets
create or replace function fantasy_stockpile_cashout(p_char int) returns int
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); v fantasy_vaults; pts int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v from fantasy_vaults where season = s and char_id = p_char for update;
  if v is null or v.user_id is distinct from auth.uid() or v.amount <= 0 then raise exception 'Nothing stockpiled on that character'; end if;
  if not exists (select 1 from fantasy_picks where season = s and user_id = auth.uid() and char_id = p_char) then raise exception 'That character is not on your team'; end if;
  pts := floor(v.amount / 2.0);
  update fantasy_vaults set amount = 0, weeks = 0, updated_at = now() where season = s and char_id = p_char;
  insert into fantasy_events (season, week, team_user, char_id, kind, points, note, source, status)
    values (s, fantasy_week(), auth.uid(), p_char, 'vault', pts, format('📦 Cashed out early: half of %s', v.amount), 'auto', 'confirmed');
  return pts;
end $$;
grant execute on function fantasy_stockpile_cashout(int) to authenticated;

-- captain: x2 (x3 Triple Captain); a stockpile cashing out on your captain pays x1.5; weekly bonuses aren't doubled
create or replace function fantasy_captain_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.char_id is null or new.kind in ('streak', 'synergy', 'underdog') or new.char_id is distinct from fantasy_captain_of(new.team_user, new.season, new.week) then return new; end if;
  if new.kind = 'vault' then
    new.points := round(new.points * 1.5); new.note := left('(C x1.5) ' || coalesce(new.note, ''), 200);
  elsif fantasy_chip_on(new.team_user, new.season, new.week, 'triple') then
    new.points := new.points * 3; new.note := left('(C x3) ' || coalesce(new.note, ''), 200);
  else
    new.points := new.points * 2; new.note := left('(C) ' || coalesce(new.note, ''), 200);
  end if;
  return new;
end $$;

update fantasy_events set note = replace(note, '🐷 Piggy bank smashed', '📦 Stockpile cashed out') where kind = 'vault' and note like '%Piggy bank%';

-- ===== risk: daily hype pays -2 (bottom) to +5 (top) =====
create or replace function fantasy_daily_hype() returns void
language plpgsql security definer set search_path = public as $$
declare d date := ((now() at time zone 'Europe/London') - interval '1 day')::date;
  s text; w int; n int; r record; pts int; k text;
begin
  s := fantasy_season(now() - interval '1 hour');
  if d < date '2026-11-12' then return; end if;
  k := 'fantasy_hype_' || s || '_' || d;
  if exists (select 1 from app_config where key = k) then return; end if;
  w := fantasy_week((d::timestamp + interval '12 hours') at time zone 'Europe/London');
  select count(*) into n from fantasy_picks where season = s;
  if n = 0 then insert into app_config values (k, now()::text) on conflict do nothing; return; end if;
  for r in
    select fp.user_id, fp.char_id, fantasy_active(fp.char_id) as active,
      c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id and pt.t >= now() - interval '25 hours' order by pt.t limit 1), c.price), 0) - 1 as growth,
      row_number() over (order by c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id and pt.t >= now() - interval '25 hours' order by pt.t limit 1), c.price), 0) desc) as rk
    from fantasy_picks fp join characters c on c.id = fp.char_id where fp.season = s
  loop
    if fantasy_dead(r.char_id, s) then continue; end if;
    pts := -2 + round(7.0 * (n - r.rk) / greatest(n - 1, 1));
    if pts > 0 and not r.active then pts := round(pts * 1.5); end if;
    if pts = 0 then continue; end if;
    insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
      values (s, w, r.user_id, r.char_id, 'hype', pts,
        format('%s: #%s of %s for hype growth (%s%s)%s', to_char(d, 'Dy DD Mon'), r.rk, n, case when r.growth >= 0 then '+' else '' end,
          round(r.growth * 100, 1) || '%', case when r.active or pts < 0 then '' else ' · legacy x1.5' end));
  end loop;
  insert into app_config values (k, now()::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_daily_hype() from public, anon, authenticated;

-- ===== risk: no-show. Their show aired an episode/chapter that week but they never appeared = -4 =====
create or replace function fantasy_noshow() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); w int := fantasy_week(now() - interval '1 hour'); r record;
begin
  if fantasy_season() = s and fantasy_week() = w then return; end if;
  if not exists (select 1 from app_config where key = 'fantasy_done_' || s || '_' || w) then return; end if;
  if exists (select 1 from app_config where key = 'fantasy_noshow_' || s || '_' || w) then return; end if;
  for r in select fp.user_id, fp.char_id from fantasy_picks fp where fp.season = s
    and exists (select 1 from fantasy_events e where e.season = s and e.week = w and e.char_id = fp.char_id and e.team_user = fp.user_id and e.kind in ('episode', 'chapter') and e.status = 'confirmed')
    and not exists (select 1 from fantasy_events e where e.season = s and e.week = w and e.char_id = fp.char_id and e.kind in ('appear', 'win', 'lose', 'transform', 'debut', 'death', 'revive') and e.status = 'confirmed')
  loop
    if fantasy_dead(r.char_id, s) then continue; end if;
    insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
      values (s, w, r.user_id, r.char_id, 'noshow', -4, format('👻 Week %s: their show aired but they never appeared', w));
  end loop;
  insert into app_config values ('fantasy_noshow_' || s || '_' || w, now()::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_noshow() from public, anon, authenticated;
select cron.schedule('fantasy-noshow', '15 * * * *', $q$select fantasy_each_league('fantasy_noshow')$q$);

select 'ok' as v50_ready;

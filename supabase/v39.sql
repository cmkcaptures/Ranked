-- Ranked v39: catch-up mechanics for weekly-heavy teams. Run after v38.sql.
--  🔥 Streak: each week a character scores story points their streak grows: +2, +4, +6, +8, +10 (max). Miss a week = reset.
--  🔵 Underdog: last in the table at the start of a week gets +25% of that week's points, second-last +10%.
--  📺 Episode bonus: every new episode also pays +2 outside the weekly cap.
--  🆘 Mercy swap: the bottom 2 teams get 2 swaps a week instead of 1.
--  🤝 Synergy: 3+ of your characters score story points in the same week = +10.

create table if not exists fantasy_streaks (
  season text not null, char_id int not null, user_id uuid not null references profiles on delete cascade,
  streak int not null default 0, last_week int, primary key (season, char_id)
);
alter table fantasy_streaks enable row level security;
drop policy if exists "read streaks" on fantasy_streaks;
create policy "read streaks" on fantasy_streaks for select to authenticated using (true);

-- standings position before a given week (1 = top); ties share the better spot
create or replace function fantasy_pos_before(p_user uuid, p_season text, p_week int) returns int language sql stable as $$
  with t as (select fp.user_id, coalesce((select sum(points) from fantasy_events e where e.season = p_season and e.team_user = fp.user_id and e.week < p_week and e.status = 'confirmed'), 0) tot
             from (select distinct user_id from fantasy_picks where season = p_season) fp)
  select (select count(*) from t t2 where t2.tot > t.tot)::int + 1 from t where t.user_id = p_user
$$;
create or replace function fantasy_teams(p_season text) returns int language sql stable as $$
  select count(distinct user_id)::int from fantasy_picks where season = p_season
$$;

-- 📺 +2 per episode, outside the cap (separate row so the 30/week cap never eats it)
create or replace function fantasy_ep_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'episode' and new.status = 'confirmed' and new.char_id is not null then
    insert into fantasy_events (season, week, team_user, char_id, kind, points, note, source, status)
      values (new.season, new.week, new.team_user, new.char_id, 'epbonus', 2, 'Episode bonus', new.source, 'confirmed');
  end if;
  return new;
end $$;
drop trigger if exists fantasy_ep_bonus on fantasy_events;
create trigger fantasy_ep_bonus after insert on fantasy_events for each row execute function fantasy_ep_bonus();

-- captain doesn't double the piggy bank or the weekly bonuses
create or replace function fantasy_captain_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind not in ('vault', 'streak', 'synergy', 'underdog') and new.char_id is not null and new.char_id = fantasy_captain_of(new.team_user, new.season, new.week) then
    if fantasy_chip_on(new.team_user, new.season, new.week, 'triple') then
      new.points := new.points * 3; new.note := left('(C x3) ' || coalesce(new.note, ''), 200);
    else
      new.points := new.points * 2; new.note := left('(C) ' || coalesce(new.note, ''), 200);
    end if;
  end if;
  return new;
end $$;

-- 🆘 swaps: bottom 2 teams get 2 a week (Wildcard still = unlimited)
create or replace function fantasy_swap_check(p_user uuid, p_out int, p_in int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); w int := fantasy_week(); dup boolean; lim int; used int;
begin
  if not exists (select 1 from fantasy_picks where season = s and user_id = p_user and char_id = p_out) then raise exception 'That character is not on your team'; end if;
  if exists (select 1 from fantasy_picks where season = s and char_id = p_in) then raise exception 'That character is already taken'; end if;
  if exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id
             where fp.season = s and fp.user_id = p_user and fp.char_id <> p_out
               and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_in)) then
    raise exception 'You already have someone from that show'; end if;
  select exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id
                 where fp.season = s and fp.user_id = p_user and fp.char_id <> p_out
                   and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_out)) into dup;
  lim := case when fantasy_teams(s) >= 4 and fantasy_pos_before(p_user, s, w) > fantasy_teams(s) - 2 then 2 else 1 end;
  select count(*) into used from fantasy_swaps where season = s and user_id = p_user and week = w;
  if not dup and not fantasy_chip_on(p_user, s, w, 'wildcard') and used >= lim then
    raise exception '%', case when lim = 2 then 'You''ve used both mercy swaps this week' else 'You already swapped this week' end; end if;
  return dup;
end $$;
revoke execute on function fantasy_swap_check(uuid, int, int) from public, anon, authenticated;

-- end-of-week bonuses (runs after fantasy_weekly has closed the week)
create or replace function fantasy_bonuses() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); w int := fantasy_week(now() - interval '1 hour');
  r record; n int; st int; wk int; pos int; mult numeric;
begin
  if fantasy_season() = s and fantasy_week() = w then return; end if;
  if not exists (select 1 from app_config where key = 'fantasy_done_' || s || '_' || w) then return; end if;
  if exists (select 1 from app_config where key = 'fantasy_bonus_' || s || '_' || w) then return; end if;
  n := fantasy_teams(s);
  -- 🔥 streaks
  for r in select fp.user_id, fp.char_id, c.name,
             exists (select 1 from fantasy_events e where e.season = s and e.week = w and e.char_id = fp.char_id and e.team_user = fp.user_id and e.status = 'confirmed'
                     and e.kind in ('episode', 'chapter', 'transform', 'win', 'appear', 'debut') and e.points > 0) as scored
           from fantasy_picks fp join characters c on c.id = fp.char_id where fp.season = s loop
    select streak into st from fantasy_streaks where season = s and char_id = r.char_id and user_id = r.user_id;
    st := case when r.scored then coalesce(st, 0) + 1 else 0 end;
    insert into fantasy_streaks (season, char_id, user_id, streak, last_week) values (s, r.char_id, r.user_id, st, w)
      on conflict (season, char_id) do update set streak = case when fantasy_streaks.user_id = excluded.user_id then excluded.streak else (case when r.scored then 1 else 0 end) end,
        user_id = excluded.user_id, last_week = w;
    select streak into st from fantasy_streaks where season = s and char_id = r.char_id;
    if st > 0 then
      insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
        values (s, w, r.user_id, r.char_id, 'streak', least(2 * st, 10), format('🔥 %s-week scoring streak', st));
    end if;
  end loop;
  -- 🤝 synergy
  for r in select e.team_user, count(distinct e.char_id) as k from fantasy_events e
           where e.season = s and e.week = w and e.status = 'confirmed' and e.points > 0 and e.kind in ('episode', 'chapter', 'transform', 'win', 'appear', 'debut')
           group by e.team_user having count(distinct e.char_id) >= 3 loop
    insert into fantasy_events (season, week, team_user, kind, points, note) values (s, w, r.team_user, 'synergy', 10, format('🤝 Team synergy: %s characters scored this week', r.k));
  end loop;
  -- 🔵 underdog (needs 3+ teams and a real gap)
  if n >= 3 then
    for r in select distinct user_id from fantasy_picks where season = s loop
      pos := fantasy_pos_before(r.user_id, s, w);
      mult := case when pos = n then 0.25 when pos = n - 1 then 0.10 else 0 end;
      if mult > 0 and w > 1 then
        select coalesce(sum(points), 0) into wk from fantasy_events where season = s and week = w and team_user = r.user_id and status = 'confirmed' and kind not in ('underdog');
        if wk > 0 then
          insert into fantasy_events (season, week, team_user, kind, points, note)
            values (s, w, r.user_id, 'underdog', round(wk * mult), format('🔵 Underdog boost: +%s%% of your %s pts this week', round(mult * 100), wk));
        end if;
      end if;
    end loop;
  end if;
  insert into app_config values ('fantasy_bonus_' || s || '_' || w, now()::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_bonuses() from public, anon, authenticated;
select cron.schedule('fantasy-bonuses', '20 * * * *', 'select fantasy_bonuses()');

alter publication supabase_realtime add table fantasy_streaks;
select 'ok' as catchup_ready;

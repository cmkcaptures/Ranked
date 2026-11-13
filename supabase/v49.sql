-- Ranked v49: simpler League. Cup, trades and waivers gone; bonuses cut to two simple ones.
--  🔥 Streak: flat +5 each week a character scores story points again (no ladder)
--  🔵 Catch-up: bottom 2 teams (last only with 3 teams) get +20% of their week
--  Synergy and the +2 episode bonus are removed. Run after v48.sql.

-- Cup + waivers off
select cron.unschedule('fantasy-cup');
select cron.unschedule('fantasy-waivers');
create or replace function fantasy_on_waivers(p_char int) returns timestamptz language sql stable as $$ select null::timestamptz $$;
update fantasy_claims set status = 'cancelled' where status = 'pending';

-- trades off (pending offers cancelled)
update fantasy_trades set status = 'cancelled' where status = 'pending';
create or replace function trade_offer(p_give int, p_get int) returns bigint
language plpgsql security definer set search_path = public as $$
begin raise exception 'Trades have been removed. Use your weekly swap instead'; end $$;

-- episode bonus off
drop trigger if exists fantasy_ep_bonus on fantasy_events;

create or replace function fantasy_bonuses() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); w int := fantasy_week(now() - interval '1 hour');
  r record; n int; st int; wk int; pos int;
begin
  if fantasy_season() = s and fantasy_week() = w then return; end if;
  if not exists (select 1 from app_config where key = 'fantasy_done_' || s || '_' || w) then return; end if;
  if exists (select 1 from app_config where key = 'fantasy_bonus_' || s || '_' || w) then return; end if;
  n := fantasy_teams(s);
  -- 🔥 streak: +5 if they scored story points this week and last week
  for r in select fp.user_id, fp.char_id,
             exists (select 1 from fantasy_events e where e.season = s and e.week = w and e.char_id = fp.char_id and e.team_user = fp.user_id and e.status = 'confirmed'
                     and e.kind in ('episode', 'chapter', 'transform', 'win', 'appear', 'debut') and e.points > 0) as scored
           from fantasy_picks fp where fp.season = s loop
    select streak into st from fantasy_streaks where season = s and char_id = r.char_id and user_id = r.user_id;
    st := case when r.scored then coalesce(st, 0) + 1 else 0 end;
    insert into fantasy_streaks (season, char_id, user_id, streak, last_week) values (s, r.char_id, r.user_id, st, w)
      on conflict (season, char_id) do update set streak = case when fantasy_streaks.user_id = excluded.user_id then excluded.streak else (case when r.scored then 1 else 0 end) end,
        user_id = excluded.user_id, last_week = w;
    select streak into st from fantasy_streaks where season = s and char_id = r.char_id;
    if st >= 2 then
      insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
        values (s, w, r.user_id, r.char_id, 'streak', 5, format('🔥 Scored %s weeks running', st));
    end if;
  end loop;
  -- 🔵 catch-up: bottom 2 (4+ teams) or last (3 teams) get +20%
  if n >= 3 and w > 1 then
    for r in select distinct user_id from fantasy_picks where season = s loop
      pos := fantasy_pos_before(r.user_id, s, w);
      if pos = n or (n >= 4 and pos = n - 1) then
        select coalesce(sum(points), 0) into wk from fantasy_events where season = s and week = w and team_user = r.user_id and status = 'confirmed' and kind <> 'underdog';
        if wk > 0 then
          insert into fantasy_events (season, week, team_user, kind, points, note)
            values (s, w, r.user_id, 'underdog', round(wk * 0.2), format('🔵 Catch-up boost: +20%% of your %s pts', wk));
        end if;
      end if;
    end loop;
  end if;
  insert into app_config values ('fantasy_bonus_' || s || '_' || w, now()::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_bonuses() from public, anon, authenticated;

select 'ok' as simpler_league_ready;

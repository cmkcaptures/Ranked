-- Ranked v28: backfill the 2 weeks before the draft (Fall 2026, run 2026-11-07). Run after v27.sql.

-- 1. like fantasy_bot_log, but the moment is filed under the week it actually happened (so weekly caps apply per week),
--    and episodes/chapters can be posted too (the live trigger only catches new ones as they drop)
create or replace function fantasy_bot_backfill(p_secret text, p_char int, p_kind text, p_ref text, p_note text, p_link text, p_when timestamptz) returns text
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); owner uuid; pts int; w int;
begin
  if p_secret is distinct from (select value from app_config where key = 'fantasy_bot_secret') then raise exception 'bad secret'; end if;
  if p_when < now() - interval '15 days' or p_when > now() then raise exception 'Only the last 2 weeks can be backfilled'; end if;
  if fantasy_season(p_when) <> s then return 'different season'; end if;
  pts := case p_kind when 'episode' then 10 when 'chapter' then 8 when 'transform' then 20 when 'win' then 8 when 'appear' then 3
                     when 'lose' then -5 when 'death' then -20 when 'revive' then 0 when 'news' then 15 end;
  if pts is null then raise exception 'Unknown kind %', p_kind; end if;
  select user_id into owner from fantasy_picks where season = s and char_id = p_char;
  if owner is null then return 'not drafted'; end if;
  w := fantasy_week(p_when);
  insert into fantasy_events (season, week, team_user, char_id, kind, points, note, link, source, status, ref, created_at)
    values (s, w, owner, p_char, p_kind, pts, left(p_note, 200), left(p_link, 300), 'bot', 'confirmed', p_ref, p_when)
    on conflict do nothing;
  return case when found then 'ok (week ' || w || ')' else 'already logged' end;
end $$;
revoke execute on function fantasy_bot_backfill(text, int, text, text, text, text, timestamptz) from public;
grant execute on function fantasy_bot_backfill(text, int, text, text, text, text, timestamptz) to anon, authenticated;

-- 2. last week's hype ranking (it ran before anyone had a team, so paid nobody): every drafted character ranked by
--    market price growth over the last 7 days (the price history kept), +30 for 1st to +5 for last, legacy x1.5
do $$
declare s text := fantasy_season(); w int := fantasy_week() - 1; n int; r record; pts int;
begin
  if exists (select 1 from fantasy_events where season = s and week = w and kind = 'hype') then return; end if;
  select count(*) into n from fantasy_picks where season = s;
  for r in
    select fp.user_id, fp.char_id, fantasy_active(fp.char_id) as active,
      c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id order by pt.t limit 1), c.price), 0) - 1 as growth,
      row_number() over (order by c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id order by pt.t limit 1), c.price), 0) desc) as rk
    from fantasy_picks fp join characters c on c.id = fp.char_id where fp.season = s
  loop
    pts := 5 + round(25.0 * (n - r.rk) / greatest(n - 1, 1));
    if not r.active then pts := round(pts * 1.5); end if;
    insert into fantasy_events (season, week, team_user, char_id, kind, points, note, created_at)
      values (s, w, r.user_id, r.char_id, 'hype', pts,
        format('#%s of %s for hype growth (%s%s)%s · week %s backfill', r.rk, n, case when r.growth >= 0 then '+' else '' end,
          round(r.growth * 100, 1) || '%', case when r.active then '' else ' · legacy x1.5' end, w), now() - interval '1 day');
  end loop;
end $$;

select p.username, sum(e.points) as pts, count(*) as entries
from fantasy_events e join profiles p on p.id = e.team_user
where e.season = fantasy_season() and e.status = 'confirmed' group by p.username order by pts desc;

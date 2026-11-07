-- Ranked v25: fair League scoring. Run after v24.sql.
--  * One character per show (Johnny + Gyro, Gojo + Sukuna can't stack). Teams that already double up get a free swap.
--  * Fight wins +8 (was +15). Story points (episodes, chapters, fights, power-ups, appearances) capped at 30 per character per week.
--  * No more -5 "on break" penalty.
--  * Weekly HYPE points for every character, airing or not: drafted characters are ranked by how much their market price
--    (which tracks Wikipedia, AniList fans, trending) grew vs a week ago -> +30 for 1st down to +5 for last.
--    Characters whose show isn't airing and whose manga isn't releasing get x1.5 (legacy bonus).
--  * Big news +15 (new season/film announced, added to a game, poll win, anniversary), posted by the nightly checker.

-- same show = same franchise title, ignoring season / part / sequel suffixes
create or replace function fantasy_show_key(t text) returns text language sql immutable as $$
  select trim(regexp_replace(lower(split_part(split_part(coalesce(t, ''), ':', 1), ' - ', 1)),
    '(\s+(season|part|cour)\s*\d+.*|\s+\d+(st|nd|rd|th)\s+season.*|\s+shipp?uu?den.*|\s+final season.*|\s+the movie.*|\s+\(\d{4}\).*|\s+(ii|iii|iv|2|3|4)$|\s+brotherhood$)', '', 'g'))
$$;

-- is this character's story moving right now? (anime airing this week or manga releasing)
create or replace function fantasy_active(p_char int) returns boolean language sql stable as $$
  select coalesce((select (c.hype_parts -> 'airing' ->> 'label') not in ('not airing') and (c.hype_parts -> 'airing' ->> 'label') not like '%on break%'
                     or c.manga_status = 'RELEASING' from characters c where c.id = p_char), false)
$$;

create or replace function fantasy_pick(p_chars int[]) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); c int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if (select count(distinct x) from unnest(p_chars) x) <> 5 then raise exception 'Pick exactly 5 different characters'; end if;
  if (select count(distinct fantasy_show_key(media_title)) from characters where id = any(p_chars)) < 5 then
    raise exception 'Only one character per show'; end if;
  if exists (select 1 from fantasy_picks where season = s and user_id = auth.uid()) then raise exception 'You already have a team this season'; end if;
  foreach c in array p_chars loop
    if exists (select 1 from fantasy_picks where season = s and char_id = c) then
      raise exception '% is already on someone''s team', (select name from characters where id = c);
    end if;
    insert into fantasy_picks (season, char_id, user_id) values (s, c, auth.uid());
  end loop;
end $$;

-- one swap a week, plus a free one while your team has two from the same show
create or replace function fantasy_swap(p_out int, p_in int) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); w int := fantasy_week(); dup boolean;
begin
  if not exists (select 1 from fantasy_picks where season = s and user_id = auth.uid() and char_id = p_out) then raise exception 'That character is not on your team'; end if;
  if exists (select 1 from fantasy_picks where season = s and char_id = p_in) then raise exception 'That character is already taken'; end if;
  if exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id
             where fp.season = s and fp.user_id = auth.uid() and fp.char_id <> p_out
               and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_in)) then
    raise exception 'You already have someone from that show'; end if;
  -- swapping out half of a same-show pair is free
  select exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id
                 where fp.season = s and fp.user_id = auth.uid() and fp.char_id <> p_out
                   and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_out)) into dup;
  if not dup and exists (select 1 from fantasy_swaps where season = s and user_id = auth.uid() and week = w) then raise exception 'You already swapped this week'; end if;
  delete from fantasy_picks where season = s and char_id = p_out;
  insert into fantasy_picks (season, char_id, user_id) values (s, p_in, auth.uid());
  if not dup then insert into fantasy_swaps values (s, auth.uid(), w, p_out, p_in, now()); end if;
end $$;

-- nightly checker: fight win now +8, and big news +15
create or replace function fantasy_bot_log(p_secret text, p_char int, p_kind text, p_ref text, p_note text, p_link text) returns text
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); owner uuid; pts int;
begin
  if p_secret is distinct from (select value from app_config where key = 'fantasy_bot_secret') then raise exception 'bad secret'; end if;
  pts := case p_kind when 'transform' then 20 when 'win' then 8 when 'appear' then 3 when 'lose' then -5 when 'death' then -20 when 'revive' then 0 when 'news' then 15 end;
  if pts is null then raise exception 'Unknown kind %', p_kind; end if;
  select user_id into owner from fantasy_picks where season = s and char_id = p_char;
  if owner is null then return 'not drafted'; end if;
  if fantasy_dead(p_char, s) and p_kind not in ('revive', 'news') then return 'dead, scores 0'; end if;
  insert into fantasy_events (team_user, char_id, kind, points, note, link, source, status, ref)
    values (owner, p_char, p_kind, pts, left(p_note, 200), left(p_link, 300), 'bot', 'confirmed', p_ref)
    on conflict do nothing;
  return case when found then 'ok' else 'already logged' end;
end $$;

-- 30-point weekly cap on story points per character (runs before the captain doubling: triggers fire in name order)
create or replace function fantasy_a_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if new.char_id is null or new.status <> 'confirmed' or new.kind not in ('episode', 'chapter', 'transform', 'win', 'appear') or new.points <= 0 then return new; end if;
  select coalesce(sum(points), 0) into used from fantasy_events
    where season = new.season and week = new.week and char_id = new.char_id and team_user = new.team_user and status = 'confirmed'
      and kind in ('episode', 'chapter', 'transform', 'win', 'appear')
      and char_id is distinct from fantasy_captain_of(new.team_user, new.season, new.week);   -- captain rows are stored doubled
  if new.char_id = fantasy_captain_of(new.team_user, new.season, new.week) then
    select coalesce(sum(points), 0) / 2 into used from fantasy_events
      where season = new.season and week = new.week and char_id = new.char_id and team_user = new.team_user and status = 'confirmed'
        and kind in ('episode', 'chapter', 'transform', 'win', 'appear');
  end if;
  if used >= 30 then new.points := 0; new.note := left('(weekly cap reached) ' || coalesce(new.note, ''), 200);
  elsif used + new.points > 30 then new.points := 30 - used; new.note := left('(capped) ' || coalesce(new.note, ''), 200);
  end if;
  return new;
end $$;
drop trigger if exists fantasy_a_cap on fantasy_events;
create trigger fantasy_a_cap before insert on fantasy_events for each row execute function fantasy_a_cap();

-- end of each league week: hype ranking for every drafted character + squad vote winners. No break penalty any more.
create or replace function fantasy_weekly() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); w int := fantasy_week(now() - interval '1 hour');
  r record; v record; n int; pts int;
begin
  if fantasy_season() = s and fantasy_week() = w then return; end if;  -- week not finished yet
  if exists (select 1 from app_config where key = 'fantasy_done_' || s || '_' || w) then return; end if;
  select count(*) into n from fantasy_picks where season = s;
  for r in
    select fp.user_id, fp.char_id, c.name, fantasy_active(fp.char_id) as active,
      c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id and pt.t >= now() - interval '7 days 1 hour' order by pt.t limit 1), c.price), 0) - 1 as growth,
      row_number() over (order by c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id and pt.t >= now() - interval '7 days 1 hour' order by pt.t limit 1), c.price), 0) desc) as rk
    from fantasy_picks fp join characters c on c.id = fp.char_id where fp.season = s
  loop
    if fantasy_dead(r.char_id, s) then continue; end if;
    pts := 5 + round(25.0 * (n - r.rk) / greatest(n - 1, 1));
    if not r.active then pts := round(pts * 1.5); end if;
    insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
      values (s, w, r.user_id, r.char_id, 'hype', pts,
        format('#%s of %s for hype growth (%s%s)%s', r.rk, n, case when r.growth >= 0 then '+' else '' end, round(r.growth * 100, 1) || '%', case when r.active then '' else ' · legacy x1.5' end));
  end loop;
  for v in select a_user, b_user, count(*) filter (where pick = a_user) as a, count(*) filter (where pick = b_user) as b
           from fantasy_votes where season = s and week = w group by a_user, b_user loop
    if v.a <> v.b then
      insert into fantasy_events (season, week, team_user, kind, points, note, source)
        values (s, w, case when v.a > v.b then v.a_user else v.b_user end, 'vote', 5, format('Won the squad vote %s-%s', greatest(v.a, v.b), least(v.a, v.b)), 'vote');
    end if;
  end loop;
  insert into app_config values ('fantasy_done_' || s || '_' || w, now()::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_weekly() from public, anon, authenticated;

-- for the League page: who's active, and each character's show key
create or replace function fantasy_char_info(p_ids int[]) returns table (id int, active boolean, show_key text)
language sql stable security definer set search_path = public as $$
  select c.id, fantasy_active(c.id), fantasy_show_key(c.media_title) from characters c where c.id = any(p_ids)
$$;

-- check: teams currently doubling up on a show
select p.username, string_agg(c.name, ' + ') as same_show, fantasy_show_key(c.media_title) as show
from fantasy_picks fp join characters c on c.id = fp.char_id join profiles p on p.id = fp.user_id
where fp.season = fantasy_season()
group by p.username, fantasy_show_key(c.media_title) having count(*) > 1;

-- all Dragon Ball series count as one show (Z / Super / GT / Kai / Daima)
create or replace function fantasy_show_key(t text) returns text language sql immutable as $$
  select regexp_replace(trim(regexp_replace(lower(split_part(split_part(coalesce(t, ''), ':', 1), ' - ', 1)),
    '(\s+(season|part|cour)\s*\d+.*|\s+\d+(st|nd|rd|th)\s+season.*|\s+shipp?uu?den.*|\s+final season.*|\s+the movie.*|\s+\(\d{4}\).*|\s+(ii|iii|iv|2|3|4)$|\s+brotherhood$)', '', 'g')),
    '^dragon ball( z| super| gt| kai| daima)?$', 'dragon ball')
$$;

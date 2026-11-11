-- Ranked v47: daily hype payouts. Every night each drafted character is ranked by that day's hype (price) growth
-- in its league and paid +1 (last) to +5 (1st), legacy x1.5. Replaces the once-a-week hype payout
-- (Fall 2026 weeks 1-6 keep their weekly payouts; daily starts Thu 12 Nov). Run after v46.sql.

create or replace function fantasy_daily_hype() returns void
language plpgsql security definer set search_path = public as $$
declare d date := ((now() at time zone 'Europe/London') - interval '1 day')::date;   -- the day being paid
  s text; w int; n int; r record; pts int; k text;
begin
  s := fantasy_season(now() - interval '1 hour');
  if d < date '2026-11-12' then return; end if;                     -- weeks 1-6 were paid weekly
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
    pts := 1 + round(4.0 * (n - r.rk) / greatest(n - 1, 1));
    if not r.active then pts := round(pts * 1.5); end if;
    insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
      values (s, w, r.user_id, r.char_id, 'hype', pts,
        format('%s: #%s of %s for hype growth (%s%s)%s', to_char(d, 'Dy DD Mon'), r.rk, n, case when r.growth >= 0 then '+' else '' end,
          round(r.growth * 100, 1) || '%', case when r.active then '' else ' · legacy x1.5' end));
  end loop;
  insert into app_config values (k, now()::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_daily_hype() from public, anon, authenticated;

-- weekly close no longer pays hype (from week 7 of Fall 2026); piggy banks, votes and the bench are unchanged
create or replace function fantasy_weekly() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); w int := fantasy_week(now() - interval '1 hour');
  r record; v record; t record; n int; pts int; low record; weekly_hype boolean;
begin
  if fantasy_season() = s and fantasy_week() = w then return; end if;
  if exists (select 1 from app_config where key = 'fantasy_done_' || s || '_' || w) then return; end if;
  weekly_hype := s like 'FALL-2026%' and w < 7;
  select count(*) into n from fantasy_picks where season = s;
  for r in
    select fp.user_id, fp.char_id, c.name, fantasy_active(fp.char_id) as active,
      c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id and pt.t >= now() - interval '7 days 1 hour' order by pt.t limit 1), c.price), 0) - 1 as growth,
      row_number() over (order by c.price / nullif(coalesce((select pt.price from price_ticks pt where pt.char_id = fp.char_id and pt.t >= now() - interval '7 days 1 hour' order by pt.t limit 1), c.price), 0) desc) as rk
    from fantasy_picks fp join characters c on c.id = fp.char_id where fp.season = s
  loop
    if fantasy_dead(r.char_id, s) then continue; end if;
    if weekly_hype then
      pts := 5 + round(25.0 * (n - r.rk) / greatest(n - 1, 1));
      if not r.active then pts := round(pts * 1.5); end if;
      insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
        values (s, w, r.user_id, r.char_id, 'hype', pts,
          format('#%s of %s for hype growth (%s%s)%s', r.rk, n, case when r.growth >= 0 then '+' else '' end, round(r.growth * 100, 1) || '%', case when r.active then '' else ' · legacy x1.5' end));
    end if;
    if not r.active and not exists (select 1 from fantasy_events where season = s and week = w and char_id = r.char_id and kind = 'vault') then
      insert into fantasy_vaults (season, char_id, user_id, amount, weeks) values (s, r.char_id, r.user_id, 5, 1)
      on conflict (season, char_id) do update set
        amount = case when fantasy_vaults.user_id = excluded.user_id then least(60, round(fantasy_vaults.amount * 1.2)::int + 5) else 5 end,
        weeks = case when fantasy_vaults.user_id = excluded.user_id then fantasy_vaults.weeks + 1 else 1 end,
        user_id = excluded.user_id, updated_at = now();
    end if;
  end loop;
  for v in select a_user, b_user, count(*) filter (where pick = a_user) as a, count(*) filter (where pick = b_user) as b
           from fantasy_votes where season = s and week = w group by a_user, b_user loop
    if v.a <> v.b then
      insert into fantasy_events (season, week, team_user, kind, points, note, source)
        values (s, w, case when v.a > v.b then v.a_user else v.b_user end, 'vote', 5, format('Won the squad vote %s-%s', greatest(v.a, v.b), least(v.a, v.b)), 'vote');
    end if;
  end loop;
  for t in select user_id from fantasy_picks where season = s group by user_id having count(*) >= 6 loop
    if fantasy_chip_on(t.user_id, s, w, 'boost') then continue; end if;
    select fp.char_id, coalesce(sum(e.points), 0) as pts into low
      from fantasy_picks fp left join fantasy_events e on e.season = s and e.week = w and e.char_id = fp.char_id and e.team_user = t.user_id and e.status = 'confirmed'
      where fp.season = s and fp.user_id = t.user_id group by fp.char_id order by coalesce(sum(e.points), 0) asc limit 1;
    if low.pts <> 0 then
      insert into fantasy_events (season, week, team_user, char_id, kind, points, note)
        values (s, w, t.user_id, low.char_id, 'bench', -low.pts, format('Benched for week %s: lowest of your 6 (%s pts didn''t count)', w, low.pts));
    end if;
  end loop;
  insert into app_config values ('fantasy_done_' || s || '_' || w, now()::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_weekly() from public, anon, authenticated;

select cron.schedule('fantasy-daily-hype', '10 * * * *', $q$select fantasy_each_league('fantasy_daily_hype')$q$);
select 'ok' as daily_hype_ready;

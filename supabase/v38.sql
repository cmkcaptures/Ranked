-- Ranked v38: Piggy bank 🐷 for "investment" characters + 🎬 trailer moments (+20). Run after v37.sql.
-- Every week a drafted character's show isn't airing and manga isn't releasing, their piggy bank grows:
--   new = min(60, round(old * 1.2) + 5)   ->  5, 11, 18, 27, 37, 49, 60 ...
-- The next time they get real news or any story moment (a returning season's first episode, a chapter, a fight...),
-- the bank smashes: the whole amount is paid to the owner as a 'vault' event, then it resets to 0.
-- Trade or drop the character and the bank is lost (it only pays the owner who saved it up).
-- Not doubled by captain, not counted in the 30/week story cap.

create table if not exists fantasy_vaults (
  season text not null,
  char_id int not null references characters on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  amount int not null default 0,
  weeks int not null default 0,          -- dormant weeks saved up
  updated_at timestamptz default now(),
  primary key (season, char_id)
);
alter table fantasy_vaults enable row level security;
drop policy if exists "read vaults" on fantasy_vaults;
create policy "read vaults" on fantasy_vaults for select to authenticated using (true);
alter publication supabase_realtime add table fantasy_vaults;

-- smash the bank when a real moment lands for the owner who saved it
create or replace function fantasy_vault_payout() returns trigger
language plpgsql security definer set search_path = public as $$
declare v fantasy_vaults;
begin
  if new.char_id is null or new.status <> 'confirmed'
     or new.kind not in ('news', 'trailer', 'episode', 'chapter', 'appear', 'transform', 'debut', 'win') then return new; end if;
  select * into v from fantasy_vaults where season = new.season and char_id = new.char_id for update;
  if v is null or v.amount <= 0 then return new; end if;
  update fantasy_vaults set amount = 0, weeks = 0, updated_at = now() where season = v.season and char_id = v.char_id;
  if v.user_id is distinct from new.team_user then return new; end if;   -- traded/dropped: bank is lost
  insert into fantasy_events (season, week, team_user, char_id, kind, points, note, source, status, ref)
    values (new.season, new.week, new.team_user, new.char_id, 'vault', v.amount,
      left(format('🐷 Piggy bank smashed after %s quiet week%s: %s', v.weeks, case when v.weeks = 1 then '' else 's' end, coalesce(new.note, new.kind)), 200),
      'auto', 'confirmed', 'vault:' || new.id);
  return new;
end $$;
drop trigger if exists fantasy_vault_payout on fantasy_events;
create trigger fantasy_vault_payout after insert on fantasy_events for each row execute function fantasy_vault_payout();

-- captain doubles everything except the piggy bank (keeps the 60 max honest)
create or replace function fantasy_captain_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'vault' and new.char_id is not null and new.char_id = fantasy_captain_of(new.team_user, new.season, new.week) then
    if fantasy_chip_on(new.team_user, new.season, new.week, 'triple') then
      new.points := new.points * 3; new.note := left('(C x3) ' || coalesce(new.note, ''), 200);
    else
      new.points := new.points * 2; new.note := left('(C) ' || coalesce(new.note, ''), 200);
    end if;
  end if;
  return new;
end $$;

-- weekly close (same as v36) + fill piggy banks for dormant characters
create or replace function fantasy_weekly() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); w int := fantasy_week(now() - interval '1 hour');
  r record; v record; t record; n int; pts int; low record;
begin
  if fantasy_season() = s and fantasy_week() = w then return; end if;
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
    -- 🐷 piggy bank: dormant all week and nothing smashed it this week
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

-- head start: every currently dormant drafted character gets its first week saved (+5) so the badge shows today
insert into fantasy_vaults (season, char_id, user_id, amount, weeks)
  select fp.season, fp.char_id, fp.user_id, 5, 1 from fantasy_picks fp
  where fp.season = fantasy_season() and not fantasy_active(fp.char_id) and not fantasy_dead(fp.char_id, fp.season)
on conflict do nothing;

-- 🎬 trailer (+20): an official trailer/PV/teaser drops for a show, film or game the character is in (and it smashes the piggy bank)
create or replace function fantasy_bot_log(p_secret text, p_char int, p_kind text, p_ref text, p_note text, p_link text) returns text
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); owner uuid; pts int;
begin
  if p_secret is distinct from (select value from app_config where key = 'fantasy_bot_secret') then raise exception 'bad secret'; end if;
  pts := case p_kind when 'transform' then 20 when 'debut' then 30 when 'win' then 8 when 'appear' then 3 when 'lose' then -5 when 'death' then -20 when 'revive' then 0 when 'news' then 15 when 'trailer' then 20 end;
  if pts is null then raise exception 'Unknown kind %', p_kind; end if;
  select user_id into owner from fantasy_picks where season = s and char_id = p_char;
  if owner is null then return 'not drafted'; end if;
  if fantasy_dead(p_char, s) and p_kind not in ('revive', 'news', 'trailer') then return 'dead, scores 0'; end if;
  -- a debut can only happen once per form, ever
  if p_kind = 'debut' and exists (select 1 from fantasy_events where char_id = p_char and kind = 'debut' and ref = p_ref and status <> 'reset') then return 'already logged'; end if;
  insert into fantasy_events (team_user, char_id, kind, points, note, link, source, status, ref)
    values (owner, p_char, p_kind, pts, left(p_note, 200), left(p_link, 300), 'bot', 'confirmed', p_ref)
    on conflict do nothing;
  return case when found then 'ok' else 'already logged' end;
end $$;

select 'ok' as piggy_bank_ready;

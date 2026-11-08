-- Ranked v36: chips (Triple Captain, Bench Boost, Wildcard: once per season each) + waiver priority. Run after v35.sql.

-- ===== Chips =====
create table if not exists fantasy_chips (
  season text not null, user_id uuid not null references profiles on delete cascade,
  chip text not null check (chip in ('triple', 'boost', 'wildcard')),
  week int not null, created_at timestamptz default now(),
  primary key (season, user_id, chip)
);
alter table fantasy_chips enable row level security;
drop policy if exists "read chips" on fantasy_chips;
create policy "read chips" on fantasy_chips for select to authenticated using (true);

create or replace function fantasy_chip_on(p_user uuid, p_season text, p_week int, p_chip text) returns boolean language sql stable as $$
  select exists (select 1 from fantasy_chips where user_id = p_user and season = p_season and week = p_week and chip = p_chip)
$$;

create or replace function fantasy_play_chip(p_chip text) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); w int := fantasy_week();
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from fantasy_picks where season = s and user_id = auth.uid()) then raise exception 'Draft a team first'; end if;
  if exists (select 1 from fantasy_chips where season = s and user_id = auth.uid() and chip = p_chip) then raise exception 'You''ve already used that chip this season'; end if;
  if exists (select 1 from fantasy_chips where season = s and user_id = auth.uid() and week = w) then raise exception 'One chip per week'; end if;
  if p_chip = 'boost' and (select count(*) from fantasy_picks where season = s and user_id = auth.uid()) < 6 then raise exception 'Bench Boost needs a bench player'; end if;
  insert into fantasy_chips (season, user_id, chip, week) values (s, auth.uid(), p_chip, w);
  insert into notifications (user_id, text)
    select distinct fp.user_id, format('🎴 %s played %s this week', (select username from profiles where id = auth.uid()),
      case p_chip when 'triple' then 'Triple Captain (captain x3)' when 'boost' then 'Bench Boost (all 6 count)' else 'Wildcard (unlimited swaps)' end)
    from fantasy_picks fp where fp.season = s and fp.user_id <> auth.uid();
end $$;

-- captain: x2, or x3 with Triple Captain
create or replace function fantasy_captain_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.char_id is not null and new.char_id = fantasy_captain_of(new.team_user, new.season, new.week) then
    if fantasy_chip_on(new.team_user, new.season, new.week, 'triple') then
      new.points := new.points * 3; new.note := left('(C x3) ' || coalesce(new.note, ''), 200);
    else
      new.points := new.points * 2; new.note := left('(C) ' || coalesce(new.note, ''), 200);
    end if;
  end if;
  return new;
end $$;

-- ===== Swaps: Wildcard = unlimited, waivers block fresh drops =====
alter table fantasy_swaps drop constraint if exists fantasy_swaps_pkey;
alter table fantasy_swaps add column if not exists id bigserial;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fantasy_swaps_id_pkey') then
    alter table fantasy_swaps add constraint fantasy_swaps_id_pkey primary key (id);
  end if;
end $$;

-- a character dropped in the last 24h is on waivers
create or replace function fantasy_on_waivers(p_char int) returns timestamptz language sql stable as $$
  select max(created_at) + interval '24 hours' from fantasy_swaps
  where season = fantasy_season() and out_char = p_char and created_at > now() - interval '24 hours'
$$;

create or replace function fantasy_swap_check(p_user uuid, p_out int, p_in int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); w int := fantasy_week(); dup boolean;
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
  if not dup and not fantasy_chip_on(p_user, s, w, 'wildcard')
     and exists (select 1 from fantasy_swaps where season = s and user_id = p_user and week = w) then
    raise exception 'You already swapped this week'; end if;
  return dup;
end $$;

create or replace function fantasy_do_swap(p_user uuid, p_out int, p_in int) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); w int := fantasy_week(); dup boolean;
begin
  dup := fantasy_swap_check(p_user, p_out, p_in);
  delete from fantasy_picks where season = s and char_id = p_out;
  insert into fantasy_picks (season, char_id, user_id) values (s, p_in, p_user);
  delete from fantasy_captains where season = s and user_id = p_user and char_id = p_out and week = w;
  if not dup then insert into fantasy_swaps (season, user_id, week, out_char, in_char) values (s, p_user, w, p_out, p_in); end if;
end $$;
revoke execute on function fantasy_do_swap(uuid, int, int) from public, anon, authenticated;
revoke execute on function fantasy_swap_check(uuid, int, int) from public, anon, authenticated;

create or replace function fantasy_swap(p_out int, p_in int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if fantasy_on_waivers(p_in) is not null then
    raise exception 'They''re on waivers until %. Put in a claim instead: lowest in the table gets them', to_char(fantasy_on_waivers(p_in) at time zone 'Europe/London', 'Dy HH24:MI'); end if;
  perform fantasy_do_swap(auth.uid(), p_out, p_in);
end $$;

-- ===== Waiver claims =====
create table if not exists fantasy_claims (
  id bigserial primary key,
  season text not null default fantasy_season(),
  user_id uuid not null references profiles on delete cascade,
  char_id int not null references characters on delete cascade,
  out_char int not null references characters on delete cascade,
  status text not null default 'pending',   -- pending | won | lost | failed | cancelled
  note text, created_at timestamptz default now()
);
alter table fantasy_claims enable row level security;
drop policy if exists "read claims" on fantasy_claims;
create policy "read claims" on fantasy_claims for select to authenticated using (true);

create or replace function fantasy_claim(p_char int, p_out int) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season();
begin
  if fantasy_on_waivers(p_char) is null then raise exception 'They''re not on waivers, just swap them in'; end if;
  perform fantasy_swap_check(auth.uid(), p_out, p_char);
  update fantasy_claims set status = 'cancelled' where season = s and user_id = auth.uid() and char_id = p_char and status = 'pending';
  insert into fantasy_claims (season, user_id, char_id, out_char) values (s, auth.uid(), p_char, p_out);
end $$;

create or replace function fantasy_claim_cancel(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update fantasy_claims set status = 'cancelled' where id = p_id and user_id = auth.uid() and status = 'pending';
$$;

-- when the 24h ends: whoever is lowest in the table (season points) wins the claim
create or replace function fantasy_waivers_run() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); ch record; c record; won boolean;
begin
  for ch in select distinct char_id from fantasy_claims where season = s and status = 'pending' and fantasy_on_waivers(char_id) is null loop
    won := false;
    for c in select cl.*, coalesce((select sum(points) from fantasy_events e where e.season = s and e.team_user = cl.user_id and e.status = 'confirmed'), 0) as tot
             from fantasy_claims cl where cl.season = s and cl.char_id = ch.char_id and cl.status = 'pending' order by tot asc, cl.created_at asc loop
      if won then
        update fantasy_claims set status = 'lost', note = 'Someone lower in the table got them' where id = c.id;
        insert into notifications (user_id, text) values (c.user_id, format('❌ Waiver claim lost: %s went to someone lower in the table', (select name from characters where id = c.char_id)));
        continue;
      end if;
      begin
        perform fantasy_do_swap(c.user_id, c.out_char, c.char_id);
        update fantasy_claims set status = 'won' where id = c.id;
        insert into notifications (user_id, text) values (c.user_id, format('✅ Waiver claim won: %s is yours (%s dropped)', (select name from characters where id = c.char_id), (select name from characters where id = c.out_char)));
        won := true;
      exception when others then
        update fantasy_claims set status = 'failed', note = sqlerrm where id = c.id;
      end;
    end loop;
  end loop;
end $$;
revoke execute on function fantasy_waivers_run() from public, anon, authenticated;
select cron.schedule('fantasy-waivers', '*/10 * * * *', 'select fantasy_waivers_run()');

-- ===== End of week: Bench Boost skips the bench =====
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

alter publication supabase_realtime add table fantasy_chips;
alter publication supabase_realtime add table fantasy_claims;
select 'ok' as chips_and_waivers_ready;

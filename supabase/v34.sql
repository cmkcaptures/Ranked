-- Ranked v34: bench slot (6th character, best 5 count each week) + trades. Run after v33.sql.

-- ===== Bench =====
-- one free add per team per season: a free agent, one-per-show still applies, team must already have 5
create or replace function fantasy_add_bench(p_char int) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); n int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select count(*) into n from fantasy_picks where season = s and user_id = auth.uid();
  if n < 5 then raise exception 'Draft your 5 first'; end if;
  if n >= 6 then raise exception 'You already have a bench player (swap them like anyone else)'; end if;
  if exists (select 1 from fantasy_picks where season = s and char_id = p_char) then raise exception 'That character is already taken'; end if;
  if exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id where fp.season = s and fp.user_id = auth.uid()
             and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_char)) then
    raise exception 'You already have someone from that show'; end if;
  insert into fantasy_picks (season, char_id, user_id) values (s, p_char, auth.uid());
end $$;

-- the old cap on teams of 5 lived in the draft; swaps already keep team size, so nothing else changes

-- end of week: also bench each 6-character team's lowest scorer that week (best 5 count)
create or replace function fantasy_weekly() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); w int := fantasy_week(now() - interval '1 hour');
  r record; v record; t record; n int; pts int; low record;
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
  -- best 5 of 6: cancel out the lowest-scoring character's week
  for t in select user_id from fantasy_picks where season = s group by user_id having count(*) >= 6 loop
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

-- ===== Trades =====
create table if not exists fantasy_trades (
  id bigserial primary key,
  season text not null default fantasy_season(),
  from_user uuid not null references profiles on delete cascade,
  to_user uuid not null references profiles on delete cascade,
  give_char int not null references characters on delete cascade,   -- from_user gives this
  get_char int not null references characters on delete cascade,    -- from_user gets this
  status text not null default 'pending',   -- pending | accepted | declined | cancelled | void
  created_at timestamptz default now(),
  decided_at timestamptz
);
alter table fantasy_trades enable row level security;
create policy "read trades" on fantasy_trades for select to authenticated using (true);

-- would this team still have one per show after giving `p_out` and getting `p_in`?
create or replace function fantasy_show_ok(p_user uuid, p_out int, p_in int) returns boolean language sql stable as $$
  select not exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id
    where fp.season = fantasy_season() and fp.user_id = p_user and fp.char_id <> p_out
      and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_in))
$$;

create or replace function trade_offer(p_give int, p_get int) returns bigint
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); them uuid; id bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from fantasy_picks where season = s and user_id = auth.uid() and char_id = p_give) then raise exception 'That character isn''t on your team'; end if;
  select user_id into them from fantasy_picks where season = s and char_id = p_get;
  if them is null then raise exception 'That character isn''t on anyone''s team'; end if;
  if them = auth.uid() then raise exception 'You can''t trade with yourself'; end if;
  if not fantasy_show_ok(auth.uid(), p_give, p_get) then raise exception 'You''d have two from the same show'; end if;
  if not fantasy_show_ok(them, p_get, p_give) then raise exception 'They''d have two from the same show'; end if;
  if exists (select 1 from fantasy_trades where season = s and status = 'pending' and from_user = auth.uid() and give_char = p_give and get_char = p_get) then
    raise exception 'You''ve already offered that'; end if;
  insert into fantasy_trades (season, from_user, to_user, give_char, get_char) values (s, auth.uid(), them, p_give, p_get) returning fantasy_trades.id into id;
  insert into notifications (user_id, text) values (them, format('🔄 %s offers %s for your %s. Check the League → Trades tab',
    (select username from profiles where id = auth.uid()), (select name from characters where id = p_give), (select name from characters where id = p_get)));
  return id;
end $$;

create or replace function trade_respond(p_id bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare t fantasy_trades; s text := fantasy_season();
begin
  select * into t from fantasy_trades where id = p_id for update;
  if t is null or t.status <> 'pending' then raise exception 'That trade isn''t open any more'; end if;
  if t.to_user <> auth.uid() then raise exception 'Only the person it was offered to can answer'; end if;
  if not p_accept then
    update fantasy_trades set status = 'declined', decided_at = now() where id = p_id;
    insert into notifications (user_id, text) values (t.from_user, format('❌ %s declined your trade for %s', (select username from profiles where id = t.to_user), (select name from characters where id = t.get_char)));
    return;
  end if;
  -- both characters must still be where they were
  if not exists (select 1 from fantasy_picks where season = s and char_id = t.give_char and user_id = t.from_user)
     or not exists (select 1 from fantasy_picks where season = s and char_id = t.get_char and user_id = t.to_user) then
    update fantasy_trades set status = 'void', decided_at = now() where id = p_id;
    raise exception 'One of those characters has moved since the offer, so it''s void';
  end if;
  if not fantasy_show_ok(t.from_user, t.give_char, t.get_char) or not fantasy_show_ok(t.to_user, t.get_char, t.give_char) then
    raise exception 'That would put two from the same show on one team';
  end if;
  update fantasy_picks set user_id = t.to_user where season = s and char_id = t.give_char;
  update fantasy_picks set user_id = t.from_user where season = s and char_id = t.get_char;
  -- a traded captain stops being captain for their old team
  delete from fantasy_captains where season = s and ((user_id = t.from_user and char_id = t.give_char) or (user_id = t.to_user and char_id = t.get_char));
  update fantasy_trades set status = 'accepted', decided_at = now() where id = p_id;
  -- any other open offers involving these two characters are now void
  update fantasy_trades set status = 'void', decided_at = now()
    where season = s and status = 'pending' and id <> p_id and (give_char in (t.give_char, t.get_char) or get_char in (t.give_char, t.get_char));
  insert into notifications (user_id, text) values (t.from_user, format('✅ %s accepted: %s is yours, %s is theirs',
    (select username from profiles where id = t.to_user), (select name from characters where id = t.get_char), (select name from characters where id = t.give_char)));
end $$;

create or replace function trade_cancel(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update fantasy_trades set status = 'cancelled', decided_at = now() where id = p_id and from_user = auth.uid() and status = 'pending';
$$;

alter publication supabase_realtime add table fantasy_trades;
select 'ok' as bench_and_trades_ready;

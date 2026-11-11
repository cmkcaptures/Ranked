-- Ranked v42: IPO voting (the squad picks the next listing; voters get first dibs) + Mid-season Cup. Run after v41.sql.

-- ================= IPO voting =================
create table if not exists ipo_nominations (
  id bigserial primary key,
  char_id int not null unique,               -- AniList character id
  name text not null, image text, show text, color text, favourites int default 0,
  nominated_by uuid references profiles on delete set null,
  status text not null default 'open' check (status in ('open', 'listed', 'expired')),
  created_at timestamptz default now(), listed_at timestamptz
);
create table if not exists ipo_votes (
  nomination_id bigint not null references ipo_nominations on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (nomination_id, user_id)
);
alter table ipo_nominations enable row level security;
alter table ipo_votes enable row level security;
drop policy if exists "read noms" on ipo_nominations; create policy "read noms" on ipo_nominations for select to authenticated using (true);
drop policy if exists "read ipo votes" on ipo_votes; create policy "read ipo votes" on ipo_votes for select to authenticated using (true);

create or replace function ipo_nominate(p_char int, p_name text, p_image text, p_show text, p_color text, p_fav int) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from characters where id = p_char) then raise exception '% is already on the market', p_name; end if;
  if exists (select 1 from ipo_nominations where char_id = p_char and status = 'open') then raise exception '% is already nominated: vote for them instead', p_name; end if;
  if (select count(*) from ipo_nominations where nominated_by = auth.uid() and status = 'open') >= 2 then raise exception 'You can have 2 open nominations at a time'; end if;
  insert into ipo_nominations (char_id, name, image, show, color, favourites, nominated_by)
    values (p_char, left(p_name, 80), p_image, left(p_show, 120), p_color, coalesce(p_fav, 0), auth.uid())
    on conflict (char_id) do update set status = 'open', nominated_by = auth.uid(), created_at = now()
    returning id into nid;
  insert into ipo_votes (nomination_id, user_id) values (nid, auth.uid()) on conflict do nothing;
  return nid;
end $$;

-- one vote per person per nomination; toggles
create or replace function ipo_vote(p_nom bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from ipo_nominations where id = p_nom and status = 'open') then raise exception 'Voting on that one has closed'; end if;
  if exists (select 1 from ipo_votes where nomination_id = p_nom and user_id = auth.uid()) then
    delete from ipo_votes where nomination_id = p_nom and user_id = auth.uid(); return false;
  end if;
  insert into ipo_votes (nomination_id, user_id) values (p_nom, auth.uid()); return true;
end $$;

-- every Sunday from 20:00 UK: the top nomination (2+ votes) is announced as an IPO 48h out
create or replace function ipo_vote_close() returns void
language plpgsql security definer set search_path = public as $$
declare k text := 'ipo_vote_' || to_char(now() at time zone 'Europe/London', 'IYYY-IW'); n record; s text; i int := 2; p0 numeric; base numeric; voters int;
begin
  if extract(isodow from now() at time zone 'Europe/London') <> 7 or extract(hour from now() at time zone 'Europe/London') < 20 then return; end if;
  if exists (select 1 from app_config where key = k) then return; end if;
  select nm.*, (select count(*) from ipo_votes v where v.nomination_id = nm.id) as votes into n
    from ipo_nominations nm where nm.status = 'open' order by (select count(*) from ipo_votes v where v.nomination_id = nm.id) desc, nm.favourites desc, nm.created_at limit 1;
  insert into app_config values (k, now()::text) on conflict do nothing;
  if n is null or n.votes < 2 then return; end if;
  if exists (select 1 from characters where id = n.char_id) then update ipo_nominations set status = 'listed' where id = n.id; return; end if;
  s := upper(left(regexp_replace(split_part(n.name, ' ', 1), '[^A-Za-z]', '', 'g'), 6));
  if s = '' then s := 'NEW'; end if;
  while exists (select 1 from characters where sym = s) loop s := left(s, 5) || i; i := i + 1; end loop;
  base := round(5.283 * power(greatest(n.favourites, 50), 0.25), 2);
  p0 := round(2730 * power(greatest(n.favourites, 50) / 592.0, 0.15));
  insert into characters (id, name, sym, image, favourites, media_title, color, p0, base, power, price, price_24h, ipo_at, ipo_filled)
    values (n.char_id, n.name, s, n.image, n.favourites, n.show, n.color, p0, base, p0, base, base, now() + interval '48 hours', false);
  update ipo_nominations set status = 'listed', listed_at = now() where id = n.id;
  voters := n.votes;
  insert into news (up, source, text) values (true, 'trending', format('🗳️ THE SQUAD HAS VOTED: $%s (%s) IPOs IN 48 HOURS. %s VOTERS GET FIRST DIBS ON PRE-ORDERS', s, upper(n.name), voters));
  insert into notifications (user_id, text) select v.user_id, format('🗳️ You voted %s in! They IPO in 48h, and voters get the first 24h of pre-orders to themselves', n.name)
    from ipo_votes v where v.nomination_id = n.id;
  -- nominations that got nothing for 2 weeks drop off
  update ipo_nominations nm set status = 'expired' where nm.status = 'open' and nm.created_at < now() - interval '14 days'
    and (select count(*) from ipo_votes v where v.nomination_id = nm.id) < 2;
end $$;
revoke execute on function ipo_vote_close() from public, anon, authenticated;
select cron.schedule('ipo-vote-close', '10 * * * *', 'select ipo_vote_close()');

-- pre-orders: for a squad-voted IPO, only the voters can pre-order during the first 24 hours
create or replace function ipo_preorder(p_char int, p_qty int) returns void
language plpgsql security definer set search_path = public as $$
declare ch characters; cost numeric; w wallets; nom ipo_nominations;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_qty <= 0 or p_qty > 10000 then raise exception 'Bad quantity'; end if;
  select * into ch from characters where id = p_char;
  if ch.ipo_at is null or ch.ipo_at <= now() then raise exception 'Pre-orders are closed for this one'; end if;
  select * into nom from ipo_nominations where char_id = p_char and status = 'listed';
  if nom.id is not null and now() < nom.listed_at + interval '24 hours'
     and not exists (select 1 from ipo_votes where nomination_id = nom.id and user_id = auth.uid()) then
    raise exception 'Voters only for the first 24 hours: open to everyone at %', to_char((nom.listed_at + interval '24 hours') at time zone 'Europe/London', 'Dy HH24:MI'); end if;
  cost := ch.price * p_qty;
  insert into wallets (user_id) values (auth.uid()) on conflict do nothing;
  select * into w from wallets where user_id = auth.uid() for update;
  if cost > w.cash then raise exception 'Not enough coins'; end if;
  update wallets set cash = cash - cost, updated_at = now() where user_id = auth.uid();
  insert into ipo_preorders (user_id, char_id, qty, price) values (auth.uid(), p_char, p_qty, ch.price)
    on conflict (user_id, char_id) do update set qty = ipo_preorders.qty + excluded.qty;
end $$;

-- ================= Mid-season Cup =================
-- Seeds = league table before the cup starts. Round 1 (week a): 3v6, 4v5 (1 and 2 get byes). Semis (week a+1): 1 v lowest winner, 2 v other.
-- Final (week a+2). Each tie is won by whoever scores more league points that week; the higher seed wins a tie. Champion: +25.
create or replace function fantasy_cup_start(p_season text) returns int language sql immutable as $$ select 7 $$;

create or replace function fantasy_week_pts(p_user uuid, p_season text, p_week int) returns int language sql stable as $$
  select coalesce(sum(points), 0)::int from fantasy_events where season = p_season and week = p_week and team_user = p_user and status = 'confirmed' and kind <> 'cup'
$$;

create or replace function fantasy_cup_award() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(now() - interval '1 hour'); a int; seeds uuid[]; w1 uuid; w2 uuid; lo uuid; hi uuid; f1 uuid; f2 uuid; champ uuid;
  win uuid; fw int;
begin
  a := fantasy_cup_start(s); fw := a + 2;
  if not (fantasy_week(now() - interval '1 hour') = fw and not (fantasy_season() = s and fantasy_week() = fw)) then return; end if;
  if exists (select 1 from app_config where key = 'fantasy_cup_' || s) then return; end if;
  select array_agg(user_id order by tot desc, user_id) into seeds from (
    select fp.user_id, coalesce((select sum(points) from fantasy_events e where e.season = s and e.team_user = fp.user_id and e.week < a and e.status = 'confirmed'), 0) tot
    from (select distinct user_id from fantasy_picks where season = s) fp) t;
  if coalesce(array_length(seeds, 1), 0) < 4 then return; end if;
  -- round 1
  if array_length(seeds, 1) >= 6 then
    w1 := case when fantasy_week_pts(seeds[6], s, a) > fantasy_week_pts(seeds[3], s, a) then seeds[6] else seeds[3] end;
    w2 := case when fantasy_week_pts(seeds[5], s, a) > fantasy_week_pts(seeds[4], s, a) then seeds[5] else seeds[4] end;
  else
    w1 := seeds[3]; w2 := seeds[4];
  end if;
  -- lowest surviving seed plays seed 1
  if array_position(seeds, w1) > array_position(seeds, w2) then lo := w1; hi := w2; else lo := w2; hi := w1; end if;
  f1 := case when fantasy_week_pts(lo, s, a + 1) > fantasy_week_pts(seeds[1], s, a + 1) then lo else seeds[1] end;
  f2 := case when fantasy_week_pts(hi, s, a + 1) > fantasy_week_pts(seeds[2], s, a + 1) then hi else seeds[2] end;
  if array_position(seeds, f1) < array_position(seeds, f2) then
    champ := case when fantasy_week_pts(f2, s, fw) > fantasy_week_pts(f1, s, fw) then f2 else f1 end;
  else
    champ := case when fantasy_week_pts(f1, s, fw) > fantasy_week_pts(f2, s, fw) then f1 else f2 end;
  end if;
  insert into fantasy_events (season, week, team_user, kind, points, note) values (s, fw, champ, 'cup', 25, '🏆 Mid-season Cup champion');
  insert into notifications (user_id, text) select distinct user_id, format('🏆 %s won the Mid-season Cup! (+25)', (select username from profiles where id = champ))
    from fantasy_picks where season = s;
  insert into app_config values ('fantasy_cup_' || s, champ::text) on conflict do nothing;
end $$;
revoke execute on function fantasy_cup_award() from public, anon, authenticated;
select cron.schedule('fantasy-cup', '25 * * * *', 'select fantasy_cup_award()');

alter publication supabase_realtime add table ipo_nominations;
alter publication supabase_realtime add table ipo_votes;
select 'ok' as ipo_vote_and_cup_ready;

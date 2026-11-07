-- Ranked v26: live snake draft + team reset. Run after v25.sql.
-- Join the lobby, anyone starts it, order is randomised, snake order (1..n then n..1) for 5 rounds.

-- backup + reset every Fall 2026 team (and their captains/swaps); any points since the last reset are reset too
create table if not exists fantasy_picks_backup as select now() as backed_up_at, * from fantasy_picks where false;
insert into fantasy_picks_backup select now(), * from fantasy_picks where season = fantasy_season();
delete from fantasy_captains where season = fantasy_season();
delete from fantasy_swaps where season = fantasy_season();
delete from fantasy_picks where season = fantasy_season();
update fantasy_events set status = 'reset' where season = fantasy_season() and status = 'confirmed';

create table if not exists fantasy_draft (
  season text primary key,
  status text not null default 'lobby',          -- lobby | live | done
  joined uuid[] not null default '{}',
  draft_order uuid[],
  pick_no int not null default 0,                -- picks made so far
  rounds int not null default 5,
  turn_started timestamptz,
  updated_at timestamptz default now()
);
alter table fantasy_draft enable row level security;
create policy "read draft" on fantasy_draft for select to authenticated using (true);

-- whose turn is pick number n (0-based) in a snake draft
create or replace function draft_turn(p_order uuid[], p_n int) returns uuid language sql immutable as $$
  select case when (p_n / array_length(p_order, 1)) % 2 = 0
    then p_order[(p_n % array_length(p_order, 1)) + 1]
    else p_order[array_length(p_order, 1) - (p_n % array_length(p_order, 1))] end
$$;

create or replace function draft_join() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season();
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into fantasy_draft (season) values (s) on conflict do nothing;
  if (select status from fantasy_draft where season = s) <> 'lobby' then raise exception 'The draft has already started'; end if;
  update fantasy_draft set joined = array_append(array_remove(joined, auth.uid()), auth.uid()), updated_at = now() where season = s;
end $$;

create or replace function draft_leave() returns void
language plpgsql security definer set search_path = public as $$
begin
  update fantasy_draft set joined = array_remove(joined, auth.uid()), updated_at = now() where season = fantasy_season() and status = 'lobby';
end $$;

create or replace function draft_start() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); d fantasy_draft;
begin
  select * into d from fantasy_draft where season = s for update;
  if d is null or d.status <> 'lobby' then raise exception 'No draft lobby open'; end if;
  if not auth.uid() = any(d.joined) then raise exception 'Join the draft first'; end if;
  if coalesce(array_length(d.joined, 1), 0) < 2 then raise exception 'Need at least 2 players'; end if;
  update fantasy_draft set status = 'live', pick_no = 0, turn_started = now(), updated_at = now(),
    draft_order = (select array_agg(u order by random()) from unnest(d.joined) u) where season = s;
end $$;

create or replace function draft_pick(p_char int) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); d fantasy_draft; total int;
begin
  select * into d from fantasy_draft where season = s for update;
  if d is null or d.status <> 'live' then raise exception 'The draft isn''t live'; end if;
  if draft_turn(d.draft_order, d.pick_no) <> auth.uid() then raise exception 'Not your turn'; end if;
  if exists (select 1 from fantasy_picks where season = s and char_id = p_char) then raise exception 'Already taken'; end if;
  if exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id where fp.season = s and fp.user_id = auth.uid()
             and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_char)) then
    raise exception 'You already have someone from that show'; end if;
  insert into fantasy_picks (season, char_id, user_id) values (s, p_char, auth.uid());
  total := array_length(d.draft_order, 1) * d.rounds;
  update fantasy_draft set pick_no = pick_no + 1, turn_started = now(), updated_at = now(),
    status = case when pick_no + 1 >= total then 'done' else 'live' end where season = s;
  insert into activity (user_id, kind, payload) values (auth.uid(), 'fantasy_team',
    jsonb_build_object('season', s, 'names', jsonb_build_array((select name from characters where id = p_char)), 'cover', (select image from characters where id = p_char)));
end $$;

-- anyone in the draft can skip a player who's gone quiet (after 2 minutes on the clock)
create or replace function draft_skip() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); d fantasy_draft;
begin
  select * into d from fantasy_draft where season = s for update;
  if d is null or d.status <> 'live' then raise exception 'The draft isn''t live'; end if;
  if not auth.uid() = any(d.draft_order) then raise exception 'You''re not in this draft'; end if;
  if d.turn_started > now() - interval '2 minutes' then raise exception 'They still have time on the clock'; end if;
  -- move the skipped player's turn to the end of this round by swapping with the next picker
  update fantasy_draft set pick_no = pick_no, turn_started = now(),
    draft_order = (select array_agg(case when u = draft_turn(d.draft_order, d.pick_no) then draft_turn(d.draft_order, d.pick_no + 1)
                                         when u = draft_turn(d.draft_order, d.pick_no + 1) then draft_turn(d.draft_order, d.pick_no) else u end order by i)
                   from unnest(d.draft_order) with ordinality t(u, i))
    where season = s;
end $$;

-- the commissioner can wipe the draft back to an empty lobby (also clears picks)
create or replace function draft_reset() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season();
begin
  if not auth.uid() = any((select draft_order || joined from fantasy_draft where season = s)) then raise exception 'You''re not in this draft'; end if;
  delete from fantasy_picks where season = s;
  update fantasy_draft set status = 'lobby', joined = '{}', draft_order = null, pick_no = 0, turn_started = null, updated_at = now() where season = s;
end $$;

-- the old first-come team builder is off while a draft exists
create or replace function fantasy_pick(p_chars int[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Teams are picked in the live draft now';
end $$;

insert into fantasy_draft (season) values (fantasy_season()) on conflict (season) do update set status = 'lobby', joined = '{}', draft_order = null, pick_no = 0, turn_started = null;
alter publication supabase_realtime add table fantasy_draft;

select (select count(*) from fantasy_picks where season = fantasy_season()) as picks_left,
       (select count(*) from fantasy_picks_backup) as backed_up, (select status from fantasy_draft where season = fantasy_season()) as draft;

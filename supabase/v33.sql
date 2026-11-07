-- Ranked v33: the commissioner can set the draft order (shown to everyone as "Order set by the commissioner").
alter table fantasy_draft add column if not exists order_by_commish boolean not null default false;

create or replace function draft_start_ordered(p_order uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); d fantasy_draft;
begin
  if not is_commissioner() then raise exception 'Only the commissioner can set the order'; end if;
  select * into d from fantasy_draft where season = s for update;
  if d is null or d.status <> 'lobby' then raise exception 'No draft lobby open'; end if;
  if coalesce(array_length(p_order, 1), 0) < 2 then raise exception 'Need at least 2 players'; end if;
  -- the order must be exactly the players in the lobby
  if (select count(*) from unnest(p_order) u where u = any(d.joined)) <> coalesce(array_length(d.joined, 1), 0)
     or array_length(p_order, 1) <> array_length(d.joined, 1) then raise exception 'Order must include everyone in the lobby'; end if;
  update fantasy_draft set status = 'live', pick_no = 0, turn_started = now(), updated_at = now(), draft_order = p_order, order_by_commish = true where season = s;
end $$;

-- a normal random start clears the flag
create or replace function draft_start() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); d fantasy_draft;
begin
  select * into d from fantasy_draft where season = s for update;
  if d is null or d.status <> 'lobby' then raise exception 'No draft lobby open'; end if;
  if not auth.uid() = any(d.joined) then raise exception 'Join the draft first'; end if;
  if coalesce(array_length(d.joined, 1), 0) < 2 then raise exception 'Need at least 2 players'; end if;
  update fantasy_draft set status = 'live', pick_no = 0, turn_started = now(), updated_at = now(), order_by_commish = false,
    draft_order = (select array_agg(u order by random()) from unnest(d.joined) u) where season = s;
end $$;
select 'ok' as ordered_start_ready;

-- Ranked v32: commissioner tools, AspextPro only (checked on the server).
create or replace function is_commissioner() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select username = 'AspextPro' from profiles where id = auth.uid()), false)
$$;

-- clear every team this season (picks, captains, swaps). Points already scored stay unless reset separately.
create or replace function commish_reset_teams() returns int
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); n int;
begin
  if not is_commissioner() then raise exception 'Only the commissioner can do that'; end if;
  insert into fantasy_picks_backup select now(), * from fantasy_picks where season = s;
  delete from fantasy_captains where season = s;
  delete from fantasy_swaps where season = s;
  delete from fantasy_picks where season = s;
  get diagnostics n = row_count;
  return n;
end $$;

-- everyone back to 0 for the season. Points are marked 'reset', not deleted, so it can be undone.
create or replace function commish_reset_points() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_commissioner() then raise exception 'Only the commissioner can do that'; end if;
  update fantasy_events set status = 'reset' where season = fantasy_season() and status = 'confirmed';
  get diagnostics n = row_count;
  return n;
end $$;

-- draft reset: commissioner only (unchanged behaviour otherwise)
create or replace function draft_reset() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season();
begin
  if not is_commissioner() then raise exception 'Only the commissioner can reset the draft'; end if;
  delete from fantasy_captains where season = s;
  delete from fantasy_swaps where season = s;
  delete from fantasy_picks where season = s;
  insert into fantasy_draft (season) values (s) on conflict do nothing;
  update fantasy_draft set status = 'lobby', joined = coalesce(draft_order, joined), draft_order = null, pick_no = 0, turn_started = null, updated_at = now()
    where season = s;
end $$;

revoke execute on function commish_reset_teams() from public, anon;
revoke execute on function commish_reset_points() from public, anon;
select 'ok' as commissioner_tools_ready;

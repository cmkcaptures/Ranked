-- Ranked v27: commissioner reset. Only AspextPro can reset the draft: clears this season's picks, captains and swaps,
-- and puts the draft back to the lobby, keeping whoever had already joined.
create or replace function draft_reset() returns void
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season();
begin
  if (select username from profiles where id = auth.uid()) is distinct from 'AspextPro' then raise exception 'Only the commissioner can reset the draft'; end if;
  delete from fantasy_captains where season = s;
  delete from fantasy_swaps where season = s;
  delete from fantasy_picks where season = s;
  insert into fantasy_draft (season) values (s) on conflict do nothing;
  update fantasy_draft set status = 'lobby', joined = coalesce(draft_order, joined), draft_order = null, pick_no = 0, turn_started = null, updated_at = now()
    where season = s;
end $$;
select 'ok' as reset_function_ready;

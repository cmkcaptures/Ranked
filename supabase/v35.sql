-- Ranked v35: swap alerts. When someone swaps a character out, everyone else in the league is told they're a free agent.
create or replace function fantasy_swap_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; c text; pts int;
begin
  select username into who from profiles where id = new.user_id;
  select name into c from characters where id = new.out_char;
  select coalesce(sum(points), 0) into pts from fantasy_events where season = new.season and char_id = new.out_char and status = 'confirmed';
  insert into notifications (user_id, text)
    select distinct fp.user_id, format('🔔 %s dropped %s (%s pts). They''re a free agent now, grab them in My team → Swap', who, c, pts)
    from fantasy_picks fp where fp.season = new.season and fp.user_id <> new.user_id;
  return new;
end $$;
drop trigger if exists fantasy_swap_alert on fantasy_swaps;
create trigger fantasy_swap_alert after insert on fantasy_swaps for each row execute function fantasy_swap_alert();
select 'ok' as swap_alerts_ready;

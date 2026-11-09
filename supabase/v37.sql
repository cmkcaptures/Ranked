-- Ranked v37: new-form debut bonus (+30, outside the weekly cap) + live story shocks. Real episode/chapter moments move a character's market price instantly. Run after v36.sql.

-- nightly bot: 'debut' = a form/transformation shown on screen (or page) for the very first time. +30 on top of the +20 transform,
-- and not counted in the 30/week story cap, so a big reveal always pays out.
create or replace function fantasy_bot_log(p_secret text, p_char int, p_kind text, p_ref text, p_note text, p_link text) returns text
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); owner uuid; pts int;
begin
  if p_secret is distinct from (select value from app_config where key = 'fantasy_bot_secret') then raise exception 'bad secret'; end if;
  pts := case p_kind when 'transform' then 20 when 'debut' then 30 when 'win' then 8 when 'appear' then 3 when 'lose' then -5 when 'death' then -20 when 'revive' then 0 when 'news' then 15 end;
  if pts is null then raise exception 'Unknown kind %', p_kind; end if;
  select user_id into owner from fantasy_picks where season = s and char_id = p_char;
  if owner is null then return 'not drafted'; end if;
  if fantasy_dead(p_char, s) and p_kind not in ('revive', 'news') then return 'dead, scores 0'; end if;
  -- a debut can only happen once per form, ever
  if p_kind = 'debut' and exists (select 1 from fantasy_events where char_id = p_char and kind = 'debut' and ref = p_ref and status <> 'reset') then return 'already logged'; end if;
  insert into fantasy_events (team_user, char_id, kind, points, note, link, source, status, ref)
    values (owner, p_char, p_kind, pts, left(p_note, 200), left(p_link, 300), 'bot', 'confirmed', p_ref)
    on conflict do nothing;
  return case when found then 'ok' else 'already logged' end;
end $$;

create table if not exists story_shocks (
  id bigserial primary key,
  char_id int not null references characters on delete cascade,
  kind text not null,              -- death | lose | transform | win | news | revive
  pct numeric not null,            -- e.g. -0.25
  old_price numeric, new_price numeric,
  note text, at timestamptz default now()
);
alter table story_shocks enable row level security;
drop policy if exists "read shocks" on story_shocks;
create policy "read shocks" on story_shocks for select to authenticated using (true);

create or replace function story_shock() returns trigger
language plpgsql security definer set search_path = public as $$
declare pct numeric; hype numeric; c characters; np numeric;
begin
  if new.char_id is null or new.status <> 'confirmed' then return new; end if;
  pct := case new.kind when 'death' then -0.25 when 'lose' then -0.08 when 'transform' then 0.15 when 'win' then 0.06 when 'news' then 0.10 when 'revive' then 0.20 when 'debut' then 0.25 end;
  if pct is null then return new; end if;
  -- one shock per character per kind per 12h (backfills and duplicate moments don't stack)
  if exists (select 1 from story_shocks where char_id = new.char_id and kind = new.kind and at > now() - interval '12 hours') then return new; end if;
  select * into c from characters where id = new.char_id;
  if c is null or c.price is null then return new; end if;
  np := greatest(1, c.price * (1 + pct));
  -- move price and the underlying power together so the next tick doesn't snap it back; a 12h hype event keeps the pressure on
  update characters set price = np, power = power * (1 + pct), updated_at = now() where id = c.id;
  insert into price_ticks (char_id, price, power, hype) values (c.id, np, c.power * (1 + pct), c.hype);
  hype := case when pct < 0 then greatest(pct, -0.3) else least(pct, 0.3) end;
  insert into market_events (kind, title, char_ids, hype_delta, ends_at)
    values (case when pct < 0 then 'crash' else 'hype' end, format('%s %s', case when pct < 0 then '📉' else '🚀' end, left(coalesce(new.note, c.name), 80)), array[c.id], hype, now() + interval '12 hours');
  insert into story_shocks (char_id, kind, pct, old_price, new_price, note) values (c.id, new.kind, pct, c.price, np, left(new.note, 160));
  -- tell everyone holding it
  insert into notifications (user_id, text)
    select w.user_id, format('%s $%s %s %s%% on a story moment: %s', case when pct < 0 then '📉 CRASH:' else '🚀 SPIKE:' end, c.sym,
      case when pct < 0 then 'dropped' else 'jumped' end, round(abs(pct) * 100), left(coalesce(new.note, ''), 80))
    from wallets w where (w.holdings ? c.id::text) and coalesce((w.holdings -> c.id::text ->> 'qty')::numeric, 0) > 0;
  return new;
end $$;
drop trigger if exists story_shock on fantasy_events;
create trigger story_shock after insert on fantasy_events for each row execute function story_shock();

alter publication supabase_realtime add table story_shocks;
select 'ok' as story_shocks_ready;

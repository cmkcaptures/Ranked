-- Ranked v45: weekly Trading Cup. Everyone ranked by % gain on their net worth since Monday, so newcomers can win.
-- Winner: +2,000 coins, a 🏆 badge and a headline. You need at least one trade in the week to qualify. Run after v44.sql.

create table if not exists cup_snapshots (
  week_key text not null, user_id uuid not null references profiles on delete cascade,
  start_worth numeric not null, created_at timestamptz default now(),
  primary key (week_key, user_id)
);
create table if not exists cup_winners (
  week_key text primary key, user_id uuid references profiles on delete set null, pct numeric, prize int, created_at timestamptz default now()
);
alter table cup_snapshots enable row level security; alter table cup_winners enable row level security;
drop policy if exists "read cup snaps" on cup_snapshots; create policy "read cup snaps" on cup_snapshots for select to authenticated using (true);
drop policy if exists "read cup wins" on cup_winners; create policy "read cup wins" on cup_winners for select to authenticated using (true);

create or replace function cup_week(ts timestamptz default now()) returns text language sql stable as $$ select to_char(ts at time zone 'Europe/London', 'IYYY-IW') $$;

-- net worth = cash + holdings at current price + open shorts' value
create or replace function wallet_worth(p_user uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select cash from wallets where user_id = p_user), 10000)
    + coalesce((select sum(c.price * (h.value ->> 'qty')::numeric) from wallets w, jsonb_each(w.holdings) h join characters c on c.id = h.key::int where w.user_id = p_user), 0)
    + coalesce((select sum(greatest(0, s.collateral + (s.entry - c.price) * s.qty)) from shorts s join characters c on c.id = s.char_id where s.user_id = p_user and s.status = 'open'), 0)
$$;

-- new wallets join this week's cup from where they start
create or replace function cup_snapshot_new() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into cup_snapshots (week_key, user_id, start_worth) values (cup_week(), new.user_id, coalesce(new.cash, 10000)) on conflict do nothing;
  return new;
end $$;
drop trigger if exists cup_snapshot_new on wallets;
create trigger cup_snapshot_new after insert on wallets for each row execute function cup_snapshot_new();

-- live board for a week
create or replace function trading_cup_board(p_week text default null) returns table (user_id uuid, username text, start_worth numeric, worth numeric, pct numeric, trades int)
language sql stable security definer set search_path = public as $$
  select s.user_id, p.username, s.start_worth, wallet_worth(s.user_id), wallet_worth(s.user_id) / nullif(s.start_worth, 0) - 1,
    (select count(*)::int from activity a where a.user_id = s.user_id and a.kind = 'trade' and cup_week(a.created_at) = coalesce(p_week, cup_week()))
  from cup_snapshots s join profiles p on p.id = s.user_id
  where s.week_key = coalesce(p_week, cup_week())
  order by 5 desc nulls last
$$;

-- every Monday: crown last week's winner, then snapshot everyone for the new week
create or replace function trading_cup_roll() returns void language plpgsql security definer set search_path = public as $$
declare cur text := cup_week(); prev text := cup_week(now() - interval '7 days'); w record;
begin
  if not exists (select 1 from cup_winners where week_key = prev) and exists (select 1 from cup_snapshots where week_key = prev) then
    select * into w from trading_cup_board(prev) b where b.trades > 0 order by b.pct desc limit 1;
    insert into cup_winners (week_key, user_id, pct, prize) values (prev, w.user_id, w.pct, case when w.user_id is null then 0 else 2000 end);
    if w.user_id is not null then
      update wallets set cash = cash + 2000, updated_at = now() where user_id = w.user_id;
      insert into notifications (user_id, text) values (w.user_id, format('🏆 You won the Trading Cup (%s)! +%s%% this week. +2,000 coins', prev, round(w.pct * 100, 1)));
      insert into news (up, source, text) values (true, 'trending', format('🏆 TRADING CUP: %s WINS THE WEEK WITH A %s%% GAIN', upper(w.username), round(w.pct * 100, 1)));
    end if;
  end if;
  insert into cup_snapshots (week_key, user_id, start_worth)
    select cur, w2.user_id, wallet_worth(w2.user_id) from wallets w2 on conflict do nothing;
end $$;
revoke execute on function trading_cup_roll() from public, anon, authenticated;
select cron.schedule('trading-cup', '7 * * * *', 'select trading_cup_roll()');
select trading_cup_roll();
select count(*) as cup_players from cup_snapshots where week_key = cup_week();

-- Ranked v41: short selling. Bet a character's price goes DOWN. Run after v40.sql.
-- Opening a short locks the current price x qty of your cash as collateral.
-- Closing pays back collateral + (entry - now) x qty, so you profit if the price fell.
-- If the price doubles from your entry the short is liquidated and the collateral is gone (that's the max loss).

create table if not exists shorts (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  char_id int not null references characters on delete cascade,
  qty int not null check (qty > 0 and qty <= 100000),
  entry numeric not null, collateral numeric not null,
  status text not null default 'open' check (status in ('open', 'closed', 'liquidated')),
  close_price numeric, pnl numeric,
  opened_at timestamptz default now(), closed_at timestamptz
);
alter table shorts enable row level security;
drop policy if exists "read shorts" on shorts;
create policy "read shorts" on shorts for select to authenticated using (true);

create or replace function short_open(p_char int, p_qty int) returns wallets
language plpgsql security definer set search_path = public as $$
declare w wallets; c characters; col numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then raise exception 'Bad quantity'; end if;
  select * into c from characters where id = p_char;
  if c is null then raise exception 'Unknown stock'; end if;
  if c.ipo_at is not null and c.ipo_at > now() then raise exception 'Can''t short before the IPO'; end if;
  if (select count(*) from shorts where user_id = auth.uid() and status = 'open') >= 10 then raise exception 'Max 10 open shorts'; end if;
  col := c.price * p_qty;
  insert into wallets (user_id) values (auth.uid()) on conflict do nothing;
  select * into w from wallets where user_id = auth.uid() for update;
  if col > w.cash then raise exception 'Not enough coins for the collateral (%)', round(col); end if;
  update wallets set cash = cash - col, updated_at = now() where user_id = auth.uid() returning * into w;
  insert into shorts (user_id, char_id, qty, entry, collateral) values (auth.uid(), p_char, p_qty, c.price, col);
  insert into activity (user_id, kind, payload) values (auth.uid(), 'trade',
    jsonb_build_object('sym', c.sym, 'name', c.name, 'char_id', p_char, 'qty', -p_qty, 'price', round(c.price, 2), 'short', true));
  return w;
end $$;

create or replace function short_close(p_id bigint) returns wallets
language plpgsql security definer set search_path = public as $$
declare s shorts; pr numeric; pay numeric; w wallets;
begin
  select * into s from shorts where id = p_id and user_id = auth.uid() and status = 'open' for update;
  if s is null then raise exception 'That short isn''t open'; end if;
  select price into pr from characters where id = s.char_id;
  pay := greatest(0, s.collateral + (s.entry - pr) * s.qty);
  update wallets set cash = cash + pay, updated_at = now() where user_id = auth.uid() returning * into w;
  update shorts set status = 'closed', close_price = pr, pnl = pay - s.collateral, closed_at = now() where id = p_id;
  return w;
end $$;

-- price doubled on you: liquidated, collateral lost
create or replace function shorts_liquidate() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select s.*, c.price, c.sym from shorts s join characters c on c.id = s.char_id where s.status = 'open' and c.price >= s.entry * 2 loop
    update shorts set status = 'liquidated', close_price = r.price, pnl = -r.collateral, closed_at = now() where id = r.id;
    insert into notifications (user_id, text) values (r.user_id,
      format('💀 LIQUIDATED: your short on $%s got wiped (price doubled from %s to %s). Lost %s coins', r.sym, round(r.entry), round(r.price), round(r.collateral)));
  end loop;
end $$;
revoke execute on function shorts_liquidate() from public, anon, authenticated;
select cron.schedule('shorts-liquidate', '*/5 * * * *', 'select shorts_liquidate()');

-- reset wallet also clears shorts
create or replace function reset_shorts() returns void language sql security definer set search_path = public as $$
  update shorts set status = 'closed', pnl = -collateral, closed_at = now() where user_id = auth.uid() and status = 'open';
$$;

alter publication supabase_realtime add table shorts;
select 'ok' as shorts_ready;

-- Ranked v43: character families & rivals (story shocks ripple to linked characters) + monthly Transfer Deadline Day. Run after v42.sql.

-- ================= Families & rivals =================
-- family = same show (automatic). rivals = hand-picked pairs below; a rival moves the OPPOSITE way.
create table if not exists char_links (
  a int not null references characters on delete cascade,
  b int not null references characters on delete cascade,
  kind text not null default 'rival',
  primary key (a, b)
);
alter table char_links enable row level security;
drop policy if exists "read links" on char_links;
create policy "read links" on char_links for select to authenticated using (true);

-- seed rival pairs by name (skips any that aren't on the market)
insert into char_links (a, b, kind)
select x.id, y.id, 'rival' from (values
  ('Gokuu Son', 'Vegeta'), ('Naruto Uzumaki', 'Sasuke Uchiha'), ('Satoru Gojou', 'Sukuna'), ('Asta', 'Yuno'),
  ('Light Yagami', 'L'), ('Luffy Monkey', 'Marshall D. Teach'), ('Ichigo Kurosaki', 'Sousuke Aizen'), ('Eren Yeager', 'Reiner Braun'),
  ('Izuku Midoriya', 'Katsuki Bakugou'), ('Yuuji Itadori', 'Sukuna'), ('Denji', 'Makima'), ('Tanjirou Kamado', 'Muzan Kibutsuji'),
  ('Johnny Joestar', 'Funny Valentine'), ('Gon Freecss', 'Hisoka Morow'), ('Edward Elric', 'Father'), ('Conan Edogawa', 'Gin'),
  ('Saitama', 'Garou'), ('Yoichi Isagi', 'Rin Itoshi'), ('Hinata Shouyou', 'Tobio Kageyama'), ('Kaito Kuroba', 'Conan Edogawa')
) p(n1, n2)
join lateral (select id from characters where name ilike p.n1 order by favourites desc nulls last limit 1) x on true
join lateral (select id from characters where name ilike p.n2 order by favourites desc nulls last limit 1) y on true
on conflict do nothing;
insert into char_links (a, b, kind) select b, a, kind from char_links where kind = 'rival' on conflict do nothing;

-- after a real story shock: up to 5 same-show characters move 30% as far in the same direction; rivals move 15% the other way
create or replace function story_ripple() returns trigger
language plpgsql security definer set search_path = public as $$
declare src characters; r record; f numeric; np numeric;
begin
  if new.kind = 'ripple' then return new; end if;
  select * into src from characters where id = new.char_id;
  for r in
    (select c.*, 0.30::numeric as factor, 'family' as why from characters c
      where c.id <> src.id and fantasy_show_key(c.media_title) = fantasy_show_key(src.media_title) and (c.ipo_at is null or c.ipo_at <= now())
      order by c.favourites desc nulls last limit 5)
    union all
    (select c.*, -0.15::numeric, 'rival' from char_links l join characters c on c.id = l.b where l.a = src.id and l.kind = 'rival')
  loop
    f := new.pct * r.factor;
    np := greatest(1, r.price * (1 + f));
    update characters set price = np, power = power * (1 + f), updated_at = now() where id = r.id;
    insert into story_shocks (char_id, kind, pct, old_price, new_price, note)
      values (r.id, 'ripple', f, r.price, np, left(format('%s ripple from %s: %s', case when r.why = 'rival' then 'Rival' else 'Family' end, src.name, coalesce(new.note, new.kind)), 160));
  end loop;
  return new;
end $$;
drop trigger if exists story_ripple on story_shocks;
create trigger story_ripple after insert on story_shocks for each row execute function story_ripple();

-- ================= Transfer Deadline Day =================
-- first Saturday of every month, all day (UK time): unlimited swaps, no waivers
create or replace function fantasy_deadline_day(p_at timestamptz default now()) returns boolean language sql stable as $$
  select extract(isodow from (p_at at time zone 'Europe/London')) = 6 and extract(day from (p_at at time zone 'Europe/London')) <= 7
$$;

create or replace function fantasy_swap_check(p_user uuid, p_out int, p_in int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s text := fantasy_season(); w int := fantasy_week(); dup boolean; lim int; used int;
begin
  if not exists (select 1 from fantasy_picks where season = s and user_id = p_user and char_id = p_out) then raise exception 'That character is not on your team'; end if;
  if exists (select 1 from fantasy_picks where season = s and char_id = p_in) then raise exception 'That character is already taken'; end if;
  if exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id
             where fp.season = s and fp.user_id = p_user and fp.char_id <> p_out
               and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_in)) then
    raise exception 'You already have someone from that show'; end if;
  select exists (select 1 from fantasy_picks fp join characters c on c.id = fp.char_id
                 where fp.season = s and fp.user_id = p_user and fp.char_id <> p_out
                   and fantasy_show_key(c.media_title) = (select fantasy_show_key(media_title) from characters where id = p_out)) into dup;
  if fantasy_deadline_day() then return dup; end if;   -- ⏰ deadline day: unlimited
  lim := case when fantasy_teams(s) >= 4 and fantasy_pos_before(p_user, s, w) > fantasy_teams(s) - 2 then 2 else 1 end;
  select count(*) into used from fantasy_swaps where season = s and user_id = p_user and week = w and not fantasy_deadline_day(created_at);
  if not dup and not fantasy_chip_on(p_user, s, w, 'wildcard') and used >= lim then
    raise exception '%', case when lim = 2 then 'You''ve used both mercy swaps this week' else 'You already swapped this week' end; end if;
  return dup;
end $$;
revoke execute on function fantasy_swap_check(uuid, int, int) from public, anon, authenticated;

create or replace function fantasy_swap(p_out int, p_in int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not fantasy_deadline_day() and fantasy_on_waivers(p_in) is not null then
    raise exception 'They''re on waivers until %. Put in a claim instead: lowest in the table gets them', to_char(fantasy_on_waivers(p_in) at time zone 'Europe/London', 'Dy HH24:MI'); end if;
  perform fantasy_do_swap(auth.uid(), p_out, p_in);
end $$;

-- swap alert says DEADLINE DAY when it is
create or replace function fantasy_swap_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; c text; i text; pts int;
begin
  select username into who from profiles where id = new.user_id;
  select name into c from characters where id = new.out_char;
  select name into i from characters where id = new.in_char;
  select coalesce(sum(points), 0) into pts from fantasy_events where season = new.season and char_id = new.out_char and status = 'confirmed';
  insert into notifications (user_id, text)
    select distinct fp.user_id, case when fantasy_deadline_day() then format('⏰ DEADLINE DAY: %s signs %s, %s is released (%s pts)', who, i, c, pts)
      else format('🔔 %s dropped %s (%s pts). They''re a free agent now, grab them in My team → Swap', who, c, pts) end
    from fantasy_picks fp where fp.season = new.season and fp.user_id <> new.user_id;
  return new;
end $$;

select (select count(*) from char_links) as links, fantasy_deadline_day() as deadline_today;

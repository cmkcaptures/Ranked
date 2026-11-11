-- Ranked v46: highlights feed for the weekly TikTok clip generator (guarded by the bot secret). Run after v45.sql.
create or replace function clip_feed(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from app_config where key = 'fantasy_bot_secret') then raise exception 'bad secret'; end if;
  return jsonb_build_object(
    'shocks', coalesce((select jsonb_agg(x) from (
      select s.kind, s.pct, s.old_price, s.new_price, s.note, s.at, c.name, c.sym, c.image, c.media_title
      from story_shocks s join characters c on c.id = s.char_id
      where s.at > now() - interval '7 days' and s.kind <> 'ripple' order by abs(s.pct) desc limit 4) x), '[]'),
    'cup', coalesce((select jsonb_agg(x) from (select username, pct, worth, trades from trading_cup_board() where trades > 0 limit 5) x), '[]'),
    'moments', coalesce((select jsonb_agg(x) from (
      select e.kind, e.points, e.note, p.username as team, c.name, c.image, c.media_title
      from fantasy_events e join characters c on c.id = e.char_id join profiles p on p.id = e.team_user
      where e.created_at > now() - interval '7 days' and e.status = 'confirmed' and e.char_id is not null
        and e.kind in ('transform', 'debut', 'win', 'death', 'news', 'trailer', 'vault', 'revive')
      order by abs(e.points) desc limit 5) x), '[]'),
    'movers', coalesce((select jsonb_agg(x) from (
      select name, sym, image, price, price_24h, price / nullif(price_24h, 0) - 1 as ch from characters
      where price_24h > 0 and (ipo_at is null or ipo_at <= now()) order by abs(price / nullif(price_24h, 0) - 1) desc limit 6) x), '[]'),
    'images', coalesce((select jsonb_object_agg(name, image) from characters where favourites > 2000), '{}')
  );
end $$;
revoke execute on function clip_feed(text) from public;
grant execute on function clip_feed(text) to anon, authenticated;
select 'ok' as clip_feed_ready;

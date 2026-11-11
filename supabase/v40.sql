-- Ranked v40: Detective Conan cast (Amuro, Gin, Vermouth, Kogoro...) + fix two wrong show tags. Run after v39.sql.
do $$
declare r record; s text; n int; added int := 0;
begin
  for r in select * from (values
  (62041, 'Tooru Amuro', 'TOORU', 'TOOAMU', 'https://s4.anilist.co/file/anilistcdn/character/large/b62041-VVi8KARP1bVE.png', 497, 'Detective Conan', '#28a1e4', 2659, 24.94),
  (1746, 'Kogorou Mouri', 'KOGORO', 'KOGMOU', 'https://s4.anilist.co/file/anilistcdn/character/large/b1746-5I4sBSeXvCKP.png', 405, 'Detective Conan', '#28a1e4', 2579, 23.7),
  (6307, 'Vermouth', 'VERMOU', 'VERDC', 'https://s4.anilist.co/file/anilistcdn/character/large/b6307-enm7W6Cus3FF.jpg', 378, 'Detective Conan', '#28a1e4', 2552, 23.29),
  (6305, 'Gin', 'GIN', 'GINDC', 'https://s4.anilist.co/file/anilistcdn/character/large/b6305-Oz8cBjsAE3Ae.jpg', 248, 'Detective Conan', '#28a1e4', 2396, 20.96),
  (41833, 'Masumi Sera', 'MASUMI', 'MASSER', 'https://s4.anilist.co/file/anilistcdn/character/large/b41833-h5eU0760M5Sj.png', 205, 'Detective Conan', '#28a1e4', 2329, 19.99),
  (3198, 'Kazuha Tooyama', 'KAZUHA', 'KAZTOO', 'https://s4.anilist.co/file/anilistcdn/character/large/b3198-h08Pt1lqU5Po.png', 148, 'Detective Conan', '#28a1e4', 2217, 18.43),
  (9421, 'Wataru Takagi', 'WATARU', 'WATTAK', 'https://s4.anilist.co/file/anilistcdn/character/large/b9421-q1USRmSvw7BF.jpg', 148, 'Detective Conan', '#28a1e4', 2217, 18.43),
  (13975, 'Miwako Satou', 'MIWAKO', 'MIWSAT', 'https://s4.anilist.co/file/anilistcdn/character/large/b13975-0vSVf8z18ghU.png', 132, 'Detective Conan', '#28a1e4', 2180, 17.91),
  (1744, 'Eri Kisaki', 'ERI', 'ERIKIS', 'https://s4.anilist.co/file/anilistcdn/character/large/b1744-otjI6lcPBAzf.png', 119, 'Detective Conan', '#28a1e4', 2146, 17.45),
  (20372, 'Yukiko Kudo', 'YUKIKO', 'YUKKUD', 'https://s4.anilist.co/file/anilistcdn/character/large/b20372-UvED45jqnAfv.png', 115, 'Detective Conan', '#28a1e4', 2135, 17.3),
  (9177, 'Yusaku Kudo', 'YUSAKU', 'YUSKUD', 'https://s4.anilist.co/file/anilistcdn/character/large/9177.jpg', 112, 'Detective Conan', '#28a1e4', 2127, 17.19),
  (1749, 'Sonoko Suzuki', 'SONOKO', 'SONSUZ', 'https://s4.anilist.co/file/anilistcdn/character/large/b1749-Jt3uRH7SRntc.png', 100, 'Detective Conan', '#28a1e4', 2091, 16.71),
  (30364, 'Jinpei Matsuda', 'JINPEI', 'JINMAT', 'https://s4.anilist.co/file/anilistcdn/character/large/b30364-nzrh2LrBvl1E.png', 96, 'Detective Conan', '#28a1e4', 2078, 16.54)
  ) v(id, name, sym, alt, image, fav, show, color, p0, base) loop
    if exists (select 1 from characters where id = r.id) then continue; end if;
    s := r.sym;
    if exists (select 1 from characters where sym = s) then s := r.alt; end if;
    n := 2;
    while exists (select 1 from characters where sym = s) loop s := left(r.sym, 5) || n; n := n + 1; end loop;
    insert into characters (id, name, sym, image, favourites, media_title, color, p0, base, power, price, price_24h)
      values (r.id, r.name, s, r.image, r.fav, r.show, r.color, r.p0, r.base, r.p0, r.base, r.base);
    added := added + 1;
  end loop;
  insert into news (up, source, text) values (true, 'trending', format('🔍 MARKET EXPANSION: %s DETECTIVE CONAN CHARACTERS LISTED, INCLUDING GIN, VERMOUTH AND AMURO', added));
end $$;
-- Conan was tagged as TONIKAWA (cameo) and Lum as Detective Conan (cameo)
update characters set media_title = 'Detective Conan' where id = 1742;
update characters set media_title = 'Urusei Yatsura' where id = 4835;
-- link the cast to the Detective Conan manga (still releasing) so they count as Active and get chapter scoring
update characters set manga_id = 31061, manga_status = 'RELEASING', manga_title = 'Detective Conan'
  where id in (1744,1746,1749,3198,6305,6307,9177,9421,13975,20372,30364,41833,62041, 1742) and manga_id is null;
update characters set manga_id = null, manga_status = null, manga_title = null where id = 4835 and manga_id = 31061;
select count(*) filter (where media_title = 'Detective Conan') as conan_cast from characters;

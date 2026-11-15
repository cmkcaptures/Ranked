-- Ranked v51: full Black Clover cast (Gadjah, Lolopechka, Zenon, Vanica...). Run after v50.sql.
do $$
declare r record; s text; n int; added int := 0; ref characters;
begin
  select * into ref from characters where media_title = 'Black Clover' order by favourites desc limit 1;
  for r in select * from (values
  (124440, 'Yami Sukehiro', 'YAMI', 'YAMSUK', 'https://s4.anilist.co/file/anilistcdn/character/large/b124440-Lpdo6y8cljV6.png', 10939),
  (123285, 'Asta', 'ASTA', 'ASTABC', 'https://s4.anilist.co/file/anilistcdn/character/large/b123285-tKijiuQErDS0.png', 9573),
  (123283, 'Noelle Silva', 'NOELLE', 'NOESIL', 'https://s4.anilist.co/file/anilistcdn/character/large/b123283-7nJHtKha0LSm.png', 4960),
  (123284, 'Yuno', 'YUNO', 'YUNOBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b123284-w6kIFYnTclMd.png', 3450),
  (124522, 'Mereoleona Vermillion', 'MEREOL', 'MERVER', 'https://s4.anilist.co/file/anilistcdn/character/large/b124522-lJK4Hy6Aokie.png', 2945),
  (124435, 'Julius Novachrono', 'JULIUS', 'JULNOV', 'https://s4.anilist.co/file/anilistcdn/character/large/b124435-gXFVXWrCcieK.jpg', 2831),
  (124449, 'Luck Voltia', 'LUCK', 'LUCVOL', 'https://s4.anilist.co/file/anilistcdn/character/large/124449-M67Ex2GcxmYM.jpg', 2717),
  (126948, 'Kuro Nero', 'KURO', 'KURNER', 'https://s4.anilist.co/file/anilistcdn/character/large/b126948-2yL8YEIqLLpq.png', 1945),
  (124459, 'Zora Ideale', 'ZORA', 'ZORIDE', 'https://s4.anilist.co/file/anilistcdn/character/large/b124459-UggsjRUfNtko.png', 1824),
  (124436, 'Vanessa Enoteca', 'VANESS', 'VANENO', 'https://s4.anilist.co/file/anilistcdn/character/large/b124436-dES6CtprlZNy.png', 1667),
  (124447, 'Charmy Pappitson', 'CHARMY', 'CHAPAP', 'https://s4.anilist.co/file/anilistcdn/character/large/b124447-2J1PKMgWETNT.png', 1510),
  (124438, 'Mimosa Vermillion', 'MIMOSA', 'MIMVER', 'https://s4.anilist.co/file/anilistcdn/character/large/b124438-nTvKfJaMD4d5.jpg', 1491),
  (124433, 'Finral Roulacase', 'FINRAL', 'FINROU', 'https://s4.anilist.co/file/anilistcdn/character/large/b124433-QyoZrgIUsSpd.png', 1420),
  (124434, 'Charlotte Roselei', 'CHARLO', 'CHAROS', 'https://s4.anilist.co/file/anilistcdn/character/large/b124434-ZmaDj2J5lSId.png', 1190),
  (187268, 'Nacht Faust', 'NACHT', 'NACFAU', 'https://s4.anilist.co/file/anilistcdn/character/large/b187268-vkcrcTvjNSrA.png', 1178),
  (124439, 'Magna Swing', 'MAGNA', 'MAGSWI', 'https://s4.anilist.co/file/anilistcdn/character/large/b124439-EqjbyC8GOKW0.jpg', 1161),
  (192196, 'Liebe', 'LIEBE', 'LIEBBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b192196-giZLzC1Xj9Hp.png', 728),
  (124521, 'Fuegoleon Vermillion', 'FUEGOL', 'FUEVER', 'https://s4.anilist.co/file/anilistcdn/character/large/b124521-MqX5KT2tGSa8.png', 688),
  (124442, 'Nozel Silva', 'NOZEL', 'NOZSIL', 'https://s4.anilist.co/file/anilistcdn/character/large/b124442-KpZhHmhjw2EG.png', 654),
  (124458, 'Dorothy Unsworth', 'DOROTH', 'DORUNS', 'https://s4.anilist.co/file/anilistcdn/character/large/b124458-U6zNf813fDxG.png', 602),
  (124448, 'Gordon Agrippa', 'GORDON', 'GORAGR', 'https://s4.anilist.co/file/anilistcdn/character/large/b124448-YHRpWxJUhNnw.png', 542),
  (124441, 'William Vangeance', 'WILLIA', 'WILVAN', 'https://s4.anilist.co/file/anilistcdn/character/large/b124441-nggzgZExhb1w.png', 461),
  (124444, 'Grey', 'GREY', 'GREYBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124444-01PmRKd8Sned.jpg', 431),
  (124446, 'Gauche Adlai', 'GAUCHE', 'GAUADL', 'https://s4.anilist.co/file/anilistcdn/character/large/b124446-4YXFoCIllCKh.png', 357),
  (124457, 'Rill Boismortier', 'RILL', 'RILBOI', 'https://s4.anilist.co/file/anilistcdn/character/large/b124457-d3MtJfUT6yqI.png', 339),
  (137881, 'Leopold Vermillion', 'LEOPOL', 'LEOVER', 'https://s4.anilist.co/file/anilistcdn/character/large/b137881-fQLQZce8CTsY.png', 303),
  (124443, 'Lily Aquaria', 'LILY', 'LILAQU', 'https://s4.anilist.co/file/anilistcdn/character/large/b124443-T2JuU6c7Z9Tk.png', 300),
  (124472, 'Licht', 'LICHT', 'LICHBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124472-sCjDIE5232uS.png', 282),
  (124437, 'Klaus Lunettes', 'KLAUS', 'KLALUN', 'https://s4.anilist.co/file/anilistcdn/character/large/b124437-3C1plJbD8jSn.png', 280),
  (167952, 'Zenon Zogratis', 'ZENON', 'ZENZOG', 'https://s4.anilist.co/file/anilistcdn/character/large/b167952-Giy7Os8XrOKM.jpg', 277),
  (124456, 'Jack the Ripper', 'JACK', 'JACRIP', 'https://s4.anilist.co/file/anilistcdn/character/large/b124456-llrSWfAXlnbb.png', 270),
  (168300, 'Vanica Zogratis', 'VANICA', 'VANZOG', 'https://s4.anilist.co/file/anilistcdn/character/large/b168300-xpKqucVqnd7j.png', 268),
  (124462, 'Mars', 'MARS', 'MARSBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124462-6yGm80Um4Gbc.png', 214),
  (124690, 'Henry Legolant', 'HENRY', 'HENLEG', 'https://s4.anilist.co/file/anilistcdn/character/large/b124690-agQVNP3afoXA.png', 198),
  (124473, 'Rhya', 'RHYA', 'RHYABC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124473-w6gHH1KS8pV0.jpg', 192),
  (124519, 'Sally', 'SALLY', 'SALLBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124519-HGSExVAbCiju.png', 190),
  (124479, 'Fana', 'FANA', 'FANABC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124479-fxZzZFMOBoMt.png', 182),
  (124985, 'Sol Marron', 'SOL', 'SOLMAR', 'https://s4.anilist.co/file/anilistcdn/character/large/b124985-y8DFuDY9iDXX.png', 140),
  (163782, 'Dante Zogratis', 'DANTE', 'DANZOG', 'https://s4.anilist.co/file/anilistcdn/character/large/b163782-lbNzUCyy4lk0.png', 130),
  (124460, 'Sekke Bronzazza', 'SEKKE', 'SEKBRO', 'https://s4.anilist.co/file/anilistcdn/character/large/b124460-EUJVxM0PG7uV.png', 121),
  (158550, 'Lemiel Silvamillion Clover', 'LEMIEL', 'LEMCLO', 'https://s4.anilist.co/file/anilistcdn/character/large/b158550-m0UtbUtvW2ra.png', 120),
  (192588, 'Licita', 'LICITA', 'LICIBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b192588-drQZ91vMLKlS.png', 96),
  (124471, 'Rebecca Scarlet', 'REBECC', 'REBSCA', 'https://s4.anilist.co/file/anilistcdn/character/large/b124471-LaLkvEyuEMMY.png', 85),
  (161333, 'Zagred', 'ZAGRED', 'ZAGRBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b161333-PqfhwYg3AqKJ.png', 82),
  (124527, 'Mariella', 'MARIEL', 'MARIBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124527-K2GZSD493KV8.png', 78),
  (124525, 'Fanzell Kruger', 'FANZEL', 'FANKRU', 'https://s4.anilist.co/file/anilistcdn/character/large/b124525-zX1uOMR5lkKr.png', 77),
  (124975, 'Langris Vaude', 'LANGRI', 'LANVAU', 'https://s4.anilist.co/file/anilistcdn/character/large/b124975-vRUxV3oIOle7.png', 75),
  (174449, 'Lolopechka', 'LOLOPE', 'LOLOBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b174449-10WzJnmxemEm.png', 75),
  (125025, 'Sylph', 'SYLPH', 'SYLPBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b125025-sRhjEh0ZUsNh.png', 68),
  (124993, 'Kahono', 'KAHONO', 'KAHOBC', 'https://s4.anilist.co/file/anilistcdn/character/large/124993-ThlqIaQV2se3.png', 62),
  (124454, 'Marx Francois', 'MARX', 'MARFRA', 'https://s4.anilist.co/file/anilistcdn/character/large/b124454-6iHuVDLPEfrj.png', 60),
  (124989, 'Majo Ou', 'MAJO', 'MAJOU', 'https://s4.anilist.co/file/anilistcdn/character/large/b124989-H3Imuf6uMspp.png', 56),
  (174452, 'Gadjah', 'GADJAH', 'GADJBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b174452-t8GszGzwxklu.png', 56),
  (124972, 'Acier Silva', 'ACIER', 'ACISIL', 'https://s4.anilist.co/file/anilistcdn/character/large/b124972-UiuueASxpsRx.png', 55),
  (124524, 'Kirsch Vermillion', 'KIRSCH', 'KIRVER', 'https://s4.anilist.co/file/anilistcdn/character/large/b124524-FhfE2Y6drZDq.png', 47),
  (174451, 'Patry', 'PATRY', 'PATRBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b174451-le3VXzW3q04a.jpg', 43),
  (174446, 'Undine', 'UNDINE', 'UNDIBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b174446-uRQDIrqSvDqp.png', 40),
  (124475, 'Vetto', 'VETTO', 'VETTBC', 'https://s4.anilist.co/file/anilistcdn/character/large/124475-khoHRpHDhIWb.png', 39),
  (124526, 'Dominante Code', 'DOMINA', 'DOMCOD', 'https://s4.anilist.co/file/anilistcdn/character/large/b124526-mpNJFDhPbwWD.png', 39),
  (124476, 'Marie Adlai', 'MARIE', 'MARADL', 'https://s4.anilist.co/file/anilistcdn/character/large/b124476-bC651i64k8Gr.png', 36),
  (124994, 'Kiato', 'KIATO', 'KIATBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124994-BqEoS9cuWS2t.png', 36),
  (126023, 'Neige', 'NEIGE', 'NEIGBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b126023-Vj6xYNSh0nj3.png', 33),
  (124682, 'Orsi Ofai', 'ORSI', 'ORSOFA', 'https://s4.anilist.co/file/anilistcdn/character/large/b124682-MEC41WVLvsA2.png', 30),
  (124529, 'Zara Ideale', 'ZARA', 'ZARIDE', 'https://s4.anilist.co/file/anilistcdn/character/large/b124529-ixC0pW8UHIvK.jpg', 28),
  (124995, 'Ladros', 'LADROS', 'LADRBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b124995-nGV1j21kzQRA.png', 26),
  (126024, 'Theresa Rapual', 'THERES', 'THERAP', 'https://s4.anilist.co/file/anilistcdn/character/large/b126024-7fQBAdSfEwrv.png', 26),
  (174450, 'Letoile Becquerel', 'LETOIL', 'LETBEC', 'https://s4.anilist.co/file/anilistcdn/character/large/b174450-rlMqdEnWMq5F.png', 23),
  (124976, 'Finesse Calmreich', 'FINESS', 'FINCAL', 'https://s4.anilist.co/file/anilistcdn/character/large/b124976-aJx7HHae0K0s.png', 22),
  (181846, 'Lucifero', 'LUCIFE', 'LUCIBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b181846-xm7ss9ZCWENV.png', 19),
  (124477, 'Rades Spirito', 'RADES', 'RADSPI', 'https://s4.anilist.co/file/anilistcdn/character/large/b124477-wKePCmpoa3e0.png', 18),
  (124987, 'Fragil Tormenta', 'FRAGIL', 'FRATOR', 'https://s4.anilist.co/file/anilistcdn/character/large/b124987-498QKn7qJhBn.png', 18),
  (190584, 'Tetia', 'TETIA', 'TETIBC', 'https://s4.anilist.co/file/anilistcdn/character/large/b190584-txhvuiSbpdxD.jpg', 18),
  (174448, 'Damnatio Kira', 'DAMNAT', 'DAMKIR', 'https://s4.anilist.co/file/anilistcdn/character/large/b174448-MRvEHxvJpP5R.jpg', 17),
  (124974, 'Solid Silva', 'SOLID', 'SOLSIL', 'https://s4.anilist.co/file/anilistcdn/character/large/b124974-Fidlk7tYFper.png', 16)
  ) v(id, name, sym, alt, image, fav) loop
    if exists (select 1 from characters where id = r.id) then continue; end if;
    s := r.sym;
    if exists (select 1 from characters where sym = s) then s := r.alt; end if;
    n := 2;
    while exists (select 1 from characters where sym = s) loop s := left(r.sym, 5) || n; n := n + 1; end loop;
    insert into characters (id, name, sym, image, favourites, media_title, color, p0, base, power, price, price_24h, manga_id, manga_status, manga_title)
      values (r.id, r.name, s, r.image, r.fav, 'Black Clover', ref.color,
        round(2730 * power(greatest(r.fav, 50) / 592.0, 0.15)), round(5.283 * power(greatest(r.fav, 50), 0.25), 2),
        round(2730 * power(greatest(r.fav, 50) / 592.0, 0.15)), round(5.283 * power(greatest(r.fav, 50), 0.25), 2), round(5.283 * power(greatest(r.fav, 50), 0.25), 2),
        ref.manga_id, ref.manga_status, ref.manga_title);
    added := added + 1;
  end loop;
  insert into news (up, source, text) values (true, 'trending', format('🍀 MARKET EXPANSION: %s BLACK CLOVER CHARACTERS LISTED, INCLUDING GADJAH, LOLOPECHKA AND ZENON', added));
  raise notice 'added %', added;
end $$;
select count(*) as black_clover_cast, string_agg(name, ', ' order by favourites desc) filter (where name in ('Gadjah','Lolopechka','Zenon Zogratis','Vanica Zogratis','Dante Zogratis','Licht')) as check_names from characters where media_title = 'Black Clover';
-- new cast copied Yami (no manga link): match Zenon so everyone counts as airing
update characters c set manga_id = z.manga_id, manga_status = z.manga_status, manga_title = z.manga_title, media_title = z.media_title
from characters z where z.id = 167952 and fantasy_show_key(c.media_title) = 'black clover' and not fantasy_active(c.id);
update characters c set hype_parts = jsonb_set(coalesce(c.hype_parts, '{}'::jsonb), '{airing}', z.hype_parts -> 'airing')
from characters z where z.id = 167952 and fantasy_show_key(c.media_title) = 'black clover' and not fantasy_active(c.id) and z.hype_parts ? 'airing';

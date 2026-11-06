-- Ranked v23: GitHub account renamed sparkingzero-builds -> cmkcaptures, so the site (and the form headshots it hosts) moved.
update characters set image = replace(image, 'https://sparkingzero-builds.github.io/', 'https://cmkcaptures.github.io/') where image like 'https://sparkingzero-builds.github.io/%';
select count(*) as moved, (select count(*) from characters where image like '%sparkingzero-builds%') as left_old from characters where image like 'https://cmkcaptures.github.io/%';

-- Ranked v24: League points reset for Fall 2026 (2026-11-07). Teams, captains and swaps are kept.
-- Points aren't deleted, just marked 'reset' so standings show 0, the nightly checker won't re-score moments it already found,
-- and it can be undone with:  update fantasy_events set status = 'confirmed' where status = 'reset' and season = 'FALL-2026';
update fantasy_events set status = 'reset' where season = 'FALL-2026' and status = 'confirmed';
select count(*) filter (where status = 'reset') as reset_rows, coalesce(sum(points) filter (where status = 'confirmed'), 0) as points_left from fantasy_events where season = 'FALL-2026';

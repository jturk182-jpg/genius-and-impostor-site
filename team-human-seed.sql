-- Team Human reset + starter scores (2026-10-17).
-- Run once in the Supabase SQL editor (SQL Editor -> New query -> paste -> Run).
--
-- 1. Clears every existing score (JT's practice runs and staging test plays).
-- 2. Adds 18 starter scores centered on the human results in Inoue &
--    Matsuzawa (2007): median about 35%, against Ayumu's 80%.
-- 3. Each time a real player's round is saved, one starter score is deleted,
--    tails first, so the middle of the board stays steady. After 18 real
--    players the board is entirely real.
-- 4. team_human_stats() also reports how many starter scores are left, so the
--    results panel can say so.

delete from flash_scores;

alter table flash_scores add column if not exists seed boolean not null default false;
alter table flash_scores add column if not exists seed_order smallint;

-- hits out of 10 trials; seed_order = deletion order (1 goes first).
insert into flash_scores (acc, hits, trials, mean_measured, frame_dur, ip_hash, seed, seed_order)
select h / 10.0, h, 10, 210, 16.7, 'seed', true, o
from (values
  (7, 1), (1, 2), (6, 3), (1, 4), (5, 5), (2, 6), (5, 7), (2, 8), (4, 9),
  (2, 10), (4, 11), (3, 12), (4, 13), (3, 14), (4, 15), (3, 16), (3, 17), (3, 18)
) as v(h, o);

create or replace function retire_one_seed()
returns trigger
language plpgsql
as $$
begin
  if not new.seed then
    delete from flash_scores
     where id = (select id from flash_scores where seed order by seed_order limit 1);
  end if;
  return new;
end;
$$;

drop trigger if exists retire_seed_on_real_score on flash_scores;
create trigger retire_seed_on_real_score
  after insert on flash_scores
  for each row execute function retire_one_seed();

create or replace function team_human_stats()
returns json
language sql
stable
as $$
  with s as (select acc from flash_scores),
  b as (
    select gs as bucket,
           (select count(*) from s
             where floor(least(s.acc, 0.9999) * 10)::int = gs) as n
    from generate_series(0, 9) gs
  )
  select json_build_object(
    'count',   (select count(*) from s),
    'median',  (select coalesce(percentile_cont(0.5) within group (order by acc), 0) from s),
    'buckets', (select json_agg(n order by bucket) from b),
    'seeds',   (select count(*) from flash_scores where seed)
  );
$$;

-- Check: should return count 18, median 0.3, seeds 18.
select team_human_stats();

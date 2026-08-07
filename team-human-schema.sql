-- Team Human: one row per submitted flash round. Run this once in the
-- Supabase SQL editor (SQL Editor -> New query -> paste -> Run).

create table if not exists flash_scores (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  acc real not null check (acc >= 0 and acc <= 1),
  hits smallint not null check (hits >= 0 and hits <= 10),
  trials smallint not null check (trials between 3 and 10),
  mean_measured real,
  frame_dur real,
  ip_hash text
);

create index if not exists flash_scores_acc_idx on flash_scores (acc);
create index if not exists flash_scores_ip_idx on flash_scores (ip_hash, created_at);

-- Row level security on, with no policies: the anon key can do nothing at
-- all. Only the service role key (which lives in Netlify, never in the
-- browser) can read or write.
alter table flash_scores enable row level security;

-- The one aggregate the site shows: member count, median, and a ten-bucket
-- histogram of scores (0-10%, 10-20%, ... 90-100%).
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
    'buckets', (select json_agg(n order by bucket) from b)
  );
$$;

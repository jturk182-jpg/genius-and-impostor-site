-- Newsletter subscribers for GeniusAndImpostor.com. Run this once in the
-- Supabase SQL editor (SQL Editor -> New query -> paste -> Run), in the same
-- project Team Human already uses.

create table if not exists subscribers (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null unique,
  source text
);

-- Row level security on, with no policies: the anon key (in the browser) can
-- do nothing. Only the service role key (in Netlify) can read or write.
alter table subscribers enable row level security;

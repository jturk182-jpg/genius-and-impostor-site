-- Saved progress for the Ayumu Training Room. Run this once in the Supabase
-- SQL editor (SQL Editor -> New query -> paste -> Run), in the same project
-- Team Human and the newsletter list already use.
--
-- One row per player, keyed by email. `store` is the same object the page
-- keeps in localStorage (training sessions, the map, the nine, prefs), so a
-- signed-in player picks up exactly where they left off on any device.

create table if not exists training_players (
  email text primary key,
  store jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row level security on, with no policies: the anon key (in the browser) can
-- do nothing. Only the service role key (in Netlify) can read or write, and
-- it only does so after checking a signed sign-in token.
alter table training_players enable row level security;

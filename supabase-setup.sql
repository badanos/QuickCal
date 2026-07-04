-- Run this in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists public.kv (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.kv enable row level security;

create policy "own rows select" on public.kv
  for select using (auth.uid() = user_id);

create policy "own rows insert" on public.kv
  for insert with check (auth.uid() = user_id);

create policy "own rows update" on public.kv
  for update using (auth.uid() = user_id);

create policy "own rows delete" on public.kv
  for delete using (auth.uid() = user_id);

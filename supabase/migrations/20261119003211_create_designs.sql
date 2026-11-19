-- =====================================================================
-- Saved designs.
--
-- One row = one saved house design. "plan" holds the same JSON object
-- that plan.js / Claude produce (rooms, walls, doors, windows).
--
-- SECURITY, in plain English: this table is reachable from the browser,
-- so who-can-see-what is enforced HERE, by "Row Level Security" (RLS).
-- With RLS on, every query is filtered by the policies below, no matter
-- what the page's code asks for.
--   * You can see, edit and delete only YOUR designs.
--   * Anyone (even logged out) can read a design only if you marked it public
--     (that's what a short share link will use later).
-- =====================================================================

create table public.designs (
  id          uuid primary key default gen_random_uuid(),
  -- Who owns it. Filled in automatically with the logged-in user's id.
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  -- The plan itself. The size cap stops anyone storing huge junk.
  plan        jsonb not null check (jsonb_typeof(plan) = 'object' and octet_length(plan::text) < 100000),
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Makes "list my designs, newest first" fast.
create index designs_user_updated_idx on public.designs (user_id, updated_at desc);

-- Keep updated_at fresh whenever a design is edited.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger designs_set_updated_at
  before update on public.designs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Turn on RLS, then say exactly who may do what.
-- ---------------------------------------------------------------------
alter table public.designs enable row level security;

create policy "Owners can read their designs"
  on public.designs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can create designs"
  on public.designs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners can edit their designs"
  on public.designs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);     -- stops handing a design to someone else

create policy "Owners can delete their designs"
  on public.designs for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Anyone can read public designs"
  on public.designs for select to anon, authenticated
  using (is_public);

-- ---------------------------------------------------------------------
-- New tables are NOT reachable from the browser until we grant access.
-- (RLS above then decides which rows each person may touch.)
-- ---------------------------------------------------------------------
grant select on public.designs to anon;
grant select, insert, update, delete on public.designs to authenticated;

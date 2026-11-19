-- Merge the two "read" policies into one (faster: Postgres checks one rule instead of two).
-- Who can read a design: its owner, or anyone if it is marked public.
drop policy "Owners can read their designs" on public.designs;
drop policy "Anyone can read public designs" on public.designs;

create policy "Read own or public designs"
  on public.designs for select to anon, authenticated
  using (is_public or (select auth.uid()) = user_id);

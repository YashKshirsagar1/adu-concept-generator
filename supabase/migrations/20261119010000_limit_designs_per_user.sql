-- Safety limit: each person can save at most 50 designs.
-- Anyone can sign up for free, so without a cap one account could fill the database.
create function public.limit_designs_per_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.designs where user_id = new.user_id) >= 50 then
    raise exception 'You can save at most 50 designs. Delete one first.';
  end if;
  return new;
end;
$$;

create trigger designs_limit_per_user
  before insert on public.designs
  for each row execute function public.limit_designs_per_user();

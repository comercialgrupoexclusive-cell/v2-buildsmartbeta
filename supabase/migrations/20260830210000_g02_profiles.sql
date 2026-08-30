create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant select, insert, update on public.profiles to authenticated;

create or replace function public.upsert_own_profile(p_full_name text, p_display_name text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_display_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'full name is required' using errcode = '22023';
  end if;

  insert into public.profiles (id, full_name, display_name)
  values (v_user_id, trim(p_full_name), v_display_name)
  on conflict (id) do update
    set full_name = excluded.full_name,
        display_name = excluded.display_name,
        updated_at = now();
end;
$$;

revoke all on function public.upsert_own_profile(text, text) from public, anon;
grant execute on function public.upsert_own_profile(text, text) to authenticated;

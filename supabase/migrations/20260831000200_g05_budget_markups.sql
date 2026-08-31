create type public.markup_type as enum ('PERCENTAGE', 'FIXED');

create table public.budget_markups (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type public.markup_type not null,
  category text,
  value numeric(15,4) not null check (value >= 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_markups_budget_position_idx on public.budget_markups(budget_id, position);

alter table public.budget_markups enable row level security;

grant select, insert, update, delete on public.budget_markups to authenticated;

create policy budget_markups_select on public.budget_markups
for select to authenticated
using (private.is_project_member(private.budget_project_id(budget_id)));

create policy budget_markups_insert on public.budget_markups
for insert to authenticated
with check (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id));

create policy budget_markups_update on public.budget_markups
for update to authenticated
using (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id))
with check (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id));

create policy budget_markups_delete on public.budget_markups
for delete to authenticated
using (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id));

create or replace function private.enforce_budget_markup_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.budget_id <> old.budget_id then
    raise exception 'markup budget cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_budget_markup_write() from public, anon, authenticated;

create trigger budget_markups_enforce_write
before insert or update on public.budget_markups
for each row execute function private.enforce_budget_markup_write();

create trigger budget_markups_audit
after insert or update or delete on public.budget_markups
for each row execute function private.audit_budget_change();

create or replace function public.budget_markup_amount(p_budget_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(
    case
      when m.type = 'FIXED' then m.value
      else public.budget_total(p_budget_id) * (m.value / 100)
    end
  ), 0)
  from public.budget_markups m
  where m.budget_id = p_budget_id;
$$;

create or replace function public.budget_final_total(p_budget_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select public.budget_total(p_budget_id) + public.budget_markup_amount(p_budget_id);
$$;

revoke all on function public.budget_markup_amount(uuid) from public, anon;
revoke all on function public.budget_final_total(uuid) from public, anon;
grant execute on function public.budget_markup_amount(uuid) to authenticated;
grant execute on function public.budget_final_total(uuid) to authenticated;

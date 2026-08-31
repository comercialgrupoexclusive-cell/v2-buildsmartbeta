create type public.budget_status as enum ('DRAFT', 'APPROVED');

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  status public.budget_status not null default 'DRAFT',
  parent_budget_id uuid references public.budgets(id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_approval_pair check (
    (status = 'DRAFT' and approved_at is null and approved_by is null)
    or (status = 'APPROVED' and approved_at is not null and approved_by is not null)
  )
);

create index budgets_project_idx on public.budgets(project_id);
create index budgets_parent_idx on public.budgets(parent_budget_id) where parent_budget_id is not null;
create index budgets_created_by_idx on public.budgets(created_by);
create index budgets_approved_by_idx on public.budgets(approved_by) where approved_by is not null;

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  parent_id uuid references public.budget_items(id) on delete cascade,
  cost_item_id uuid references public.cost_items(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  unit text,
  quantity numeric(15,4) not null default 0 check (quantity >= 0),
  unit_price numeric(15,4) not null default 0 check (unit_price >= 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_items_budget_parent_position_idx
  on public.budget_items(budget_id, parent_id, position);
create index budget_items_parent_idx on public.budget_items(parent_id) where parent_id is not null;
create index budget_items_cost_item_idx on public.budget_items(cost_item_id) where cost_item_id is not null;

create or replace function private.budget_project_id(p_budget_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.project_id from public.budgets b where b.id = p_budget_id;
$$;

create or replace function private.is_budget_editor(p_budget_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.project_can_edit(private.budget_project_id(p_budget_id));
$$;

create or replace function private.is_budget_draft(p_budget_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.budgets where id = p_budget_id and status = 'DRAFT');
$$;

revoke all on function private.budget_project_id(uuid) from public, anon, authenticated;
revoke all on function private.is_budget_editor(uuid) from public, anon, authenticated;
revoke all on function private.is_budget_draft(uuid) from public, anon, authenticated;
grant execute on function private.budget_project_id(uuid) to authenticated;
grant execute on function private.is_budget_editor(uuid) to authenticated;
grant execute on function private.is_budget_draft(uuid) to authenticated;

alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;

grant select, insert, update on public.budgets to authenticated;
grant select, insert, update, delete on public.budget_items to authenticated;

create policy budgets_select on public.budgets
for select to authenticated
using (private.is_project_member(project_id));

create policy budgets_insert on public.budgets
for insert to authenticated
with check (created_by = (select auth.uid()) and private.project_can_edit(project_id));

create policy budgets_update on public.budgets
for update to authenticated
using (private.project_can_edit(project_id))
with check (private.project_can_edit(project_id));

create policy budget_items_select on public.budget_items
for select to authenticated
using (private.is_project_member(private.budget_project_id(budget_id)));

create policy budget_items_insert on public.budget_items
for insert to authenticated
with check (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id));

create policy budget_items_update on public.budget_items
for update to authenticated
using (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id))
with check (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id));

create policy budget_items_delete on public.budget_items
for delete to authenticated
using (private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id));

create or replace function private.enforce_budget_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := now();
    return new;
  end if;

  if new.project_id <> old.project_id then raise exception 'budget project cannot be changed'; end if;
  if new.created_by <> old.created_by then raise exception 'budget creator cannot be changed'; end if;
  if new.parent_budget_id is distinct from old.parent_budget_id then
    raise exception 'budget lineage cannot be changed';
  end if;
  if old.status = 'APPROVED' then
    if new.status <> 'APPROVED' then raise exception 'approved budget cannot be reopened'; end if;
    if new.name is distinct from old.name then raise exception 'approved budget is immutable'; end if;
  end if;
  if new.status = 'APPROVED' and old.status = 'DRAFT' then
    new.approved_at := now();
    new.approved_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.validate_budget_item_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'budget item cannot be its own parent';
    end if;
    if not exists (
      select 1 from public.budget_items p where p.id = new.parent_id and p.budget_id = new.budget_id
    ) then
      raise exception 'parent item must belong to the same budget';
    end if;
  end if;

  if new.cost_item_id is not null then
    if not exists (
      select 1
      from public.cost_items c
      join public.budgets b on b.id = new.budget_id
      join public.projects p on p.id = b.project_id
      where c.id = new.cost_item_id and c.organization_id = p.organization_id
    ) then
      raise exception 'cost item must belong to the budget organization';
    end if;
    new.unit := coalesce(new.unit, (select unit from public.cost_items where id = new.cost_item_id));
    new.unit_price := (select unit_price from public.cost_items where id = new.cost_item_id);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_budget_write() from public, anon, authenticated;
revoke all on function private.validate_budget_item_links() from public, anon, authenticated;

create trigger budgets_enforce_write
before insert or update on public.budgets
for each row execute function private.enforce_budget_write();

create trigger budget_items_validate_links
before insert or update on public.budget_items
for each row execute function private.validate_budget_item_links();

create or replace function private.audit_budget_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget_id uuid;
  v_project_id uuid;
  v_org_id uuid;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_table_name = 'budgets' then
    if tg_op = 'DELETE' then v_budget_id := old.id; v_project_id := old.project_id;
    else v_budget_id := new.id; v_project_id := new.project_id; end if;
    v_entity_id := v_budget_id::text;
  else
    if tg_op = 'DELETE' then v_budget_id := old.budget_id; v_entity_id := old.id::text;
    else v_budget_id := new.budget_id; v_entity_id := new.id::text; end if;
    v_project_id := private.budget_project_id(v_budget_id);
  end if;

  select p.organization_id into v_org_id from public.projects p where p.id = v_project_id;
  if tg_op = 'INSERT' then v_before := null; v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then v_before := to_jsonb(old); v_after := to_jsonb(new);
  else v_before := to_jsonb(old); v_after := null; end if;

  insert into public.audit_logs(
    organization_id, project_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, source
  ) values (
    v_org_id, v_project_id, (select auth.uid()),
    lower(tg_table_name) || '.' || lower(tg_op), tg_table_name, v_entity_id,
    v_before, v_after, 'web'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_budget_change() from public, anon, authenticated;

create trigger budgets_audit
after insert or update on public.budgets
for each row execute function private.audit_budget_change();

create trigger budget_items_audit
after insert or update or delete on public.budget_items
for each row execute function private.audit_budget_change();

create or replace function public.budget_item_total(p_item_id uuid)
returns numeric
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_total numeric;
  v_has_children boolean;
begin
  select exists(select 1 from public.budget_items where parent_id = p_item_id) into v_has_children;
  if v_has_children then
    select coalesce(sum(public.budget_item_total(id)), 0) into v_total
    from public.budget_items where parent_id = p_item_id;
  else
    select quantity * unit_price into v_total from public.budget_items where id = p_item_id;
  end if;
  return coalesce(v_total, 0);
end;
$$;

create or replace function public.budget_total(p_budget_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(public.budget_item_total(id)), 0)
  from public.budget_items
  where budget_id = p_budget_id and parent_id is null;
$$;

revoke all on function public.budget_item_total(uuid) from public, anon;
revoke all on function public.budget_total(uuid) from public, anon;
grant execute on function public.budget_item_total(uuid) to authenticated;
grant execute on function public.budget_total(uuid) to authenticated;

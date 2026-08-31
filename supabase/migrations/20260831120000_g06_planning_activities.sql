create type public.planning_activity_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

create table public.planning_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.planning_activities(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  planned_start_date date not null,
  planned_end_date date not null check (planned_end_date >= planned_start_date),
  duration_days integer not null default 0 check (duration_days >= 0),
  status public.planning_activity_status not null default 'NOT_STARTED',
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planning_activities_project_parent_position_idx
  on public.planning_activities(project_id, parent_id, position);
create index planning_activities_parent_idx
  on public.planning_activities(parent_id) where parent_id is not null;
create index planning_activities_created_by_idx on public.planning_activities(created_by);

create table public.planning_activity_budget_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.planning_activities(id) on delete cascade,
  budget_item_id uuid not null references public.budget_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (activity_id, budget_item_id)
);

create index planning_activity_budget_items_activity_idx
  on public.planning_activity_budget_items(activity_id);
create index planning_activity_budget_items_budget_item_idx
  on public.planning_activity_budget_items(budget_item_id);

create or replace function private.is_planning_editor(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.project_can_edit(p_project_id);
$$;

revoke all on function private.is_planning_editor(uuid) from public, anon, authenticated;
grant execute on function private.is_planning_editor(uuid) to authenticated;

alter table public.planning_activities enable row level security;
alter table public.planning_activity_budget_items enable row level security;

grant select, insert, update, delete on public.planning_activities to authenticated;
grant select, insert, update, delete on public.planning_activity_budget_items to authenticated;

create policy planning_activities_select on public.planning_activities
for select to authenticated
using (private.is_project_member(project_id));

create policy planning_activities_insert on public.planning_activities
for insert to authenticated
with check (created_by = (select auth.uid()) and private.is_planning_editor(project_id));

create policy planning_activities_update on public.planning_activities
for update to authenticated
using (private.is_planning_editor(project_id))
with check (private.is_planning_editor(project_id));

create policy planning_activities_delete on public.planning_activities
for delete to authenticated
using (private.is_planning_editor(project_id));

create or replace function private.planning_activity_project_id(p_activity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.project_id from public.planning_activities a where a.id = p_activity_id;
$$;

revoke all on function private.planning_activity_project_id(uuid) from public, anon, authenticated;
grant execute on function private.planning_activity_project_id(uuid) to authenticated;

create policy planning_activity_budget_items_select on public.planning_activity_budget_items
for select to authenticated
using (private.is_project_member(private.planning_activity_project_id(activity_id)));

create policy planning_activity_budget_items_insert on public.planning_activity_budget_items
for insert to authenticated
with check (private.is_planning_editor(private.planning_activity_project_id(activity_id)));

create policy planning_activity_budget_items_delete on public.planning_activity_budget_items
for delete to authenticated
using (private.is_planning_editor(private.planning_activity_project_id(activity_id)));

create or replace function private.enforce_planning_activity_write()
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

  if new.project_id <> old.project_id then raise exception 'planning activity project cannot be changed'; end if;
  if new.created_by <> old.created_by then raise exception 'planning activity creator cannot be changed'; end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.validate_planning_activity_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'planning activity cannot be its own parent';
    end if;
    if not exists (
      select 1 from public.planning_activities p where p.id = new.parent_id and p.project_id = new.project_id
    ) then
      raise exception 'parent activity must belong to the same project';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_planning_activity_budget_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.budget_items bi
    join public.budgets b on b.id = bi.budget_id
    join public.planning_activities a on a.id = new.activity_id
    where bi.id = new.budget_item_id and b.project_id = a.project_id
  ) then
    raise exception 'budget item must belong to the same project as the activity';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_planning_activity_write() from public, anon, authenticated;
revoke all on function private.validate_planning_activity_parent() from public, anon, authenticated;
revoke all on function private.validate_planning_activity_budget_link() from public, anon, authenticated;

create trigger planning_activities_enforce_write
before insert or update on public.planning_activities
for each row execute function private.enforce_planning_activity_write();

create trigger planning_activities_validate_parent
before insert or update on public.planning_activities
for each row execute function private.validate_planning_activity_parent();

create trigger planning_activity_budget_items_validate_link
before insert on public.planning_activity_budget_items
for each row execute function private.validate_planning_activity_budget_link();

create or replace function private.audit_planning_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_org_id uuid;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_table_name = 'planning_activities' then
    if tg_op = 'DELETE' then v_project_id := old.project_id; v_entity_id := old.id::text;
    else v_project_id := new.project_id; v_entity_id := new.id::text; end if;
  else
    if tg_op = 'DELETE' then v_entity_id := old.id::text; v_project_id := private.planning_activity_project_id(old.activity_id);
    else v_entity_id := new.id::text; v_project_id := private.planning_activity_project_id(new.activity_id); end if;
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

revoke all on function private.audit_planning_activity_change() from public, anon, authenticated;

create trigger planning_activities_audit
after insert or update or delete on public.planning_activities
for each row execute function private.audit_planning_activity_change();

create trigger planning_activity_budget_items_audit
after insert or delete on public.planning_activity_budget_items
for each row execute function private.audit_planning_activity_change();

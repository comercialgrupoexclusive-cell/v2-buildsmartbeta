create type public.planning_dependency_type as enum ('FS', 'SS', 'FF', 'SF');

create table public.planning_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_id uuid not null references public.planning_activities(id) on delete cascade,
  successor_id uuid not null references public.planning_activities(id) on delete cascade,
  dependency_type public.planning_dependency_type not null default 'FS',
  lag_days integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (predecessor_id, successor_id),
  check (predecessor_id <> successor_id)
);

create index planning_dependencies_predecessor_idx on public.planning_dependencies(predecessor_id);
create index planning_dependencies_successor_idx on public.planning_dependencies(successor_id);

alter table public.planning_dependencies enable row level security;

grant select, insert, update, delete on public.planning_dependencies to authenticated;

create policy planning_dependencies_select on public.planning_dependencies
for select to authenticated
using (private.is_project_member(private.planning_activity_project_id(predecessor_id)));

create policy planning_dependencies_insert on public.planning_dependencies
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_planning_editor(private.planning_activity_project_id(predecessor_id))
);

create policy planning_dependencies_update on public.planning_dependencies
for update to authenticated
using (private.is_planning_editor(private.planning_activity_project_id(predecessor_id)))
with check (private.is_planning_editor(private.planning_activity_project_id(predecessor_id)));

create policy planning_dependencies_delete on public.planning_dependencies
for delete to authenticated
using (private.is_planning_editor(private.planning_activity_project_id(predecessor_id)));

create or replace function private.validate_planning_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_predecessor_project uuid;
  v_successor_project uuid;
  v_cycle_hit boolean;
begin
  if tg_op = 'UPDATE' then
    if new.predecessor_id <> old.predecessor_id then raise exception 'dependency predecessor cannot be changed'; end if;
    if new.successor_id <> old.successor_id then raise exception 'dependency successor cannot be changed'; end if;
    new.updated_at := now();
    return new;
  end if;

  v_predecessor_project := private.planning_activity_project_id(new.predecessor_id);
  v_successor_project := private.planning_activity_project_id(new.successor_id);

  if v_predecessor_project is distinct from v_successor_project then
    raise exception 'predecessor and successor must belong to the same project';
  end if;

  -- Reject a link that would create a cycle: if the successor can already
  -- reach the predecessor through existing dependencies, adding
  -- predecessor -> successor would close a loop.
  with recursive reachable(activity_id) as (
    select successor_id from public.planning_dependencies where predecessor_id = new.successor_id
    union
    select d.successor_id
    from public.planning_dependencies d
    join reachable r on d.predecessor_id = r.activity_id
  )
  select exists(select 1 from reachable where activity_id = new.predecessor_id) into v_cycle_hit;

  if v_cycle_hit then
    raise exception 'dependency would create a cycle';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_planning_dependency() from public, anon, authenticated;

create trigger planning_dependencies_validate
before insert or update on public.planning_dependencies
for each row execute function private.validate_planning_dependency();

-- Extends the shared audit function from 20260831120000_g06_planning_activities.sql
-- with a branch for planning_dependencies, which has no activity_id column
-- (it has predecessor_id/successor_id instead).
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
  elsif tg_table_name = 'planning_dependencies' then
    if tg_op = 'DELETE' then v_entity_id := old.id::text; v_project_id := private.planning_activity_project_id(old.predecessor_id);
    else v_entity_id := new.id::text; v_project_id := private.planning_activity_project_id(new.predecessor_id); end if;
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

create trigger planning_dependencies_audit
after insert or update or delete on public.planning_dependencies
for each row execute function private.audit_planning_activity_change();

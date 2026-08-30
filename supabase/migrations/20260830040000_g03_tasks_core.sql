create type public.task_status as enum ('TO_DO','IN_PROGRESS','WAITING','COMPLETED','CANCELED');
create type public.task_priority as enum ('LOW','NORMAL','HIGH','URGENT');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text,
  status public.task_status not null default 'TO_DO',
  priority public.task_priority not null default 'NORMAL',
  assignee_id uuid references auth.users(id) on delete set null,
  start_at timestamptz,
  due_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_dates_order check (start_at is null or due_at is null or due_at >= start_at)
);

create index tasks_project_idx on public.tasks(project_id);
create index tasks_assignee_idx on public.tasks(assignee_id) where assignee_id is not null;
create index tasks_due_idx on public.tasks(due_at) where due_at is not null;

create table public.task_participants (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  position integer not null default 0 check (position >= 0),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_completion_pair check (
    (completed_at is null and completed_by is null)
    or (completed_at is not null and completed_by is not null)
  )
);

create index task_checklist_task_position_idx
  on public.task_checklist_items(task_id, position, created_at);

create or replace function private.user_is_active_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_memberships pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.is_active
  );
$$;

create or replace function private.task_project_id(p_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id from public.tasks t where t.id = p_task_id;
$$;

create or replace function private.is_task_participant(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.task_participants tp
    where tp.task_id = p_task_id
      and tp.user_id = (select auth.uid())
  );
$$;

create or replace function private.task_checklist_can_operate(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        private.project_can_edit(t.project_id)
        or t.assignee_id = (select auth.uid())
        or private.is_task_participant(t.id)
      )
  );
$$;

revoke all on function private.user_is_active_project_member(uuid,uuid) from public, anon, authenticated;
revoke all on function private.task_project_id(uuid) from public, anon, authenticated;
revoke all on function private.is_task_participant(uuid) from public, anon, authenticated;
revoke all on function private.task_checklist_can_operate(uuid) from public, anon, authenticated;
grant execute on function private.user_is_active_project_member(uuid,uuid) to authenticated;
grant execute on function private.task_project_id(uuid) to authenticated;
grant execute on function private.is_task_participant(uuid) to authenticated;
grant execute on function private.task_checklist_can_operate(uuid) to authenticated;

alter table public.tasks enable row level security;
alter table public.task_participants enable row level security;
alter table public.task_checklist_items enable row level security;

grant select, insert, update on public.tasks to authenticated;
grant select, insert, update, delete on public.task_participants to authenticated;
grant select, insert, update, delete on public.task_checklist_items to authenticated;

create policy tasks_select on public.tasks
for select to authenticated
using (private.is_project_member(project_id));

create policy tasks_insert on public.tasks
for insert to authenticated
with check (created_by = (select auth.uid()) and private.project_can_edit(project_id));

create policy tasks_update on public.tasks
for update to authenticated
using (private.project_can_edit(project_id) or assignee_id = (select auth.uid()))
with check (private.project_can_edit(project_id) or assignee_id = (select auth.uid()));

create policy task_participants_select on public.task_participants
for select to authenticated
using (private.is_project_member(private.task_project_id(task_id)));

create policy task_participants_insert on public.task_participants
for insert to authenticated
with check (private.project_can_edit(private.task_project_id(task_id)));

create policy task_participants_update on public.task_participants
for update to authenticated
using (private.project_can_edit(private.task_project_id(task_id)))
with check (private.project_can_edit(private.task_project_id(task_id)));

create policy task_participants_delete on public.task_participants
for delete to authenticated
using (private.project_can_edit(private.task_project_id(task_id)));

create policy task_checklist_select on public.task_checklist_items
for select to authenticated
using (private.is_project_member(private.task_project_id(task_id)));

create policy task_checklist_insert on public.task_checklist_items
for insert to authenticated
with check (private.task_checklist_can_operate(task_id));

create policy task_checklist_update on public.task_checklist_items
for update to authenticated
using (private.task_checklist_can_operate(task_id))
with check (private.task_checklist_can_operate(task_id));

create policy task_checklist_delete on public.task_checklist_items
for delete to authenticated
using (private.task_checklist_can_operate(task_id));

create or replace function private.enforce_task_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_editor boolean;
begin
  if v_actor is null then raise exception 'authentication required'; end if;

  if tg_op = 'INSERT' then
    if new.created_by <> v_actor then raise exception 'created_by must match authenticated user'; end if;
    if not private.project_can_edit(new.project_id) then raise exception 'task creation requires project editor permission'; end if;
    if new.assignee_id is not null and not private.user_is_active_project_member(new.project_id, new.assignee_id) then
      raise exception 'assignee must be an active member of the same project';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.project_id <> old.project_id then raise exception 'task project cannot be changed'; end if;
  if new.created_by <> old.created_by then raise exception 'task creator cannot be changed'; end if;

  v_editor := private.project_can_edit(old.project_id);
  if not v_editor then
    if old.assignee_id is distinct from v_actor then raise exception 'task update not permitted'; end if;
    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.priority is distinct from old.priority
       or new.assignee_id is distinct from old.assignee_id
       or new.start_at is distinct from old.start_at
       or new.due_at is distinct from old.due_at then
      raise exception 'assignee may only change operational status';
    end if;
  end if;

  if new.assignee_id is not null and not private.user_is_active_project_member(new.project_id, new.assignee_id) then
    raise exception 'assignee must be an active member of the same project';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'COMPLETED' and new.status <> 'IN_PROGRESS' then
      raise exception 'completed task may only reopen to IN_PROGRESS';
    end if;
    if old.status = 'CANCELED' and new.status <> 'TO_DO' then
      raise exception 'canceled task may only reactivate to TO_DO';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.enforce_task_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  v_project_id := private.task_project_id(new.task_id);
  if v_project_id is null then raise exception 'task not found'; end if;
  if not private.user_is_active_project_member(v_project_id, new.user_id) then
    raise exception 'participant must be an active member of the same project';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_checklist_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_task public.tasks%rowtype;
  v_editor boolean;
  v_assignee boolean;
  v_participant boolean;
  v_task_id uuid;
begin
  if tg_op = 'DELETE' then v_task_id := old.task_id; else v_task_id := new.task_id; end if;
  select * into v_task from public.tasks where id = v_task_id;
  if v_task.id is null then raise exception 'task not found'; end if;

  v_editor := private.project_can_edit(v_task.project_id);
  v_assignee := v_task.assignee_id = v_actor;
  v_participant := private.is_task_participant(v_task.id);
  if not (v_editor or v_assignee or v_participant) then raise exception 'checklist write not permitted'; end if;

  if tg_op = 'DELETE' then
    if v_participant and not (v_editor or v_assignee) then raise exception 'participant cannot delete checklist items'; end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if v_participant and not (v_editor or v_assignee) then raise exception 'participant cannot create checklist items'; end if;
    if new.completed_at is null then new.completed_by := null; else new.completed_by := v_actor; end if;
    new.updated_at := now();
    return new;
  end if;

  if new.task_id <> old.task_id then raise exception 'checklist item task cannot be changed'; end if;
  if v_participant and not (v_editor or v_assignee) then
    if new.text is distinct from old.text or new.position is distinct from old.position then
      raise exception 'participant may only complete or reopen checklist items';
    end if;
  end if;

  if new.completed_at is distinct from old.completed_at then
    if new.completed_at is null then new.completed_by := null; else new.completed_by := v_actor; end if;
  elsif new.completed_by is distinct from old.completed_by then
    raise exception 'completed_by is system controlled';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_project_id uuid;
  v_org_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_entity_id text;
begin
  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      v_task_id := new.id; v_project_id := new.project_id; v_entity_id := new.id::text;
    else
      v_task_id := old.id; v_project_id := old.project_id; v_entity_id := old.id::text;
    end if;
  elsif tg_table_name = 'task_participants' then
    if tg_op = 'DELETE' then
      v_task_id := old.task_id; v_entity_id := old.task_id::text || ':' || old.user_id::text;
    else
      v_task_id := new.task_id; v_entity_id := new.task_id::text || ':' || new.user_id::text;
    end if;
    v_project_id := private.task_project_id(v_task_id);
  elsif tg_table_name = 'task_checklist_items' then
    if tg_op = 'DELETE' then
      v_task_id := old.task_id; v_entity_id := old.id::text;
    else
      v_task_id := new.task_id; v_entity_id := new.id::text;
    end if;
    v_project_id := private.task_project_id(v_task_id);
  else
    return case when tg_op = 'DELETE' then old else new end;
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

revoke all on function private.enforce_task_write() from public, anon, authenticated;
revoke all on function private.enforce_task_participant() from public, anon, authenticated;
revoke all on function private.enforce_checklist_write() from public, anon, authenticated;
revoke all on function private.audit_task_change() from public, anon, authenticated;

create trigger tasks_enforce_write
before insert or update on public.tasks
for each row execute function private.enforce_task_write();

create trigger task_participants_enforce
before insert or update on public.task_participants
for each row execute function private.enforce_task_participant();

create trigger task_checklist_enforce
before insert or update or delete on public.task_checklist_items
for each row execute function private.enforce_checklist_write();

create trigger tasks_audit
after insert or update on public.tasks
for each row execute function private.audit_task_change();

create trigger task_participants_audit
after insert or update or delete on public.task_participants
for each row execute function private.audit_task_change();

create trigger task_checklist_audit
after insert or update or delete on public.task_checklist_items
for each row execute function private.audit_task_change();
create extension if not exists pgcrypto;

create type public.organization_role as enum ('OWNER','ADMIN','MEMBER');
create type public.project_role as enum ('MANAGER','EDITOR','VIEWER');
create type public.project_status as enum ('ACTIVE','ON_HOLD','COMPLETED','ARCHIVED');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'MEMBER',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text,
  name text not null check (length(trim(name)) > 0),
  description text,
  status public.project_status not null default 'ACTIVE',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index projects_org_code_unique
  on public.projects (organization_id, code)
  where code is not null;

create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.project_role not null default 'VIEWER',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  source text not null default 'web' check (source in ('web','ai','whatsapp','api','system')),
  created_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.is_active
  );
$$;

create or replace function private.org_can_manage(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role in ('OWNER','ADMIN')
  );
$$;

create or replace function private.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.project_memberships pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
      and pm.is_active
  );
$$;

create or replace function private.project_can_edit(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.project_memberships pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
      and pm.is_active
      and pm.role in ('MANAGER','EDITOR')
  );
$$;

create or replace function private.project_can_manage(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.project_memberships pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
      and pm.is_active
      and pm.role = 'MANAGER'
  );
$$;

revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.org_can_manage(uuid) from public, anon;
revoke all on function private.is_project_member(uuid) from public, anon;
revoke all on function private.project_can_edit(uuid) from public, anon;
revoke all on function private.project_can_manage(uuid) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.org_can_manage(uuid) to authenticated;
grant execute on function private.is_project_member(uuid) to authenticated;
grant execute on function private.project_can_edit(uuid) to authenticated;
grant execute on function private.project_can_manage(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select on public.organizations
for select to authenticated
using (private.is_org_member(id));

create policy organizations_insert on public.organizations
for insert to authenticated
with check (created_by = (select auth.uid()));

create policy organizations_update on public.organizations
for update to authenticated
using (private.org_can_manage(id))
with check (private.org_can_manage(id));

create policy organization_memberships_select on public.organization_memberships
for select to authenticated
using (user_id = (select auth.uid()) or private.org_can_manage(organization_id));

create policy organization_memberships_insert on public.organization_memberships
for insert to authenticated
with check (
  private.org_can_manage(organization_id)
  or (
    user_id = (select auth.uid())
    and role = 'OWNER'
    and exists (
      select 1 from public.organizations o
      where o.id = organization_id and o.created_by = (select auth.uid())
    )
    and not exists (
      select 1 from public.organization_memberships existing
      where existing.organization_id = organization_id
    )
  )
);

create policy organization_memberships_update on public.organization_memberships
for update to authenticated
using (private.org_can_manage(organization_id))
with check (private.org_can_manage(organization_id));

create policy projects_select on public.projects
for select to authenticated
using (private.is_project_member(id));

create policy projects_insert on public.projects
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_org_member(organization_id)
);

create policy projects_update on public.projects
for update to authenticated
using (private.project_can_edit(id))
with check (private.project_can_edit(id));

create policy project_memberships_select on public.project_memberships
for select to authenticated
using (user_id = (select auth.uid()) or private.project_can_manage(project_id));

create policy project_memberships_insert on public.project_memberships
for insert to authenticated
with check (
  private.project_can_manage(project_id)
  or (
    user_id = (select auth.uid())
    and role = 'MANAGER'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = (select auth.uid())
    )
    and not exists (
      select 1 from public.project_memberships existing
      where existing.project_id = project_id
    )
  )
);

create policy project_memberships_update on public.project_memberships
for update to authenticated
using (private.project_can_manage(project_id))
with check (private.project_can_manage(project_id));

create policy audit_logs_select on public.audit_logs
for select to authenticated
using (
  (project_id is not null and private.is_project_member(project_id))
  or (project_id is null and private.is_org_member(organization_id))
);

create policy audit_logs_insert on public.audit_logs
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and private.is_org_member(organization_id)
  and (project_id is null or private.is_project_member(project_id))
);

grant select, insert, update on public.organizations to authenticated;
grant select, insert, update on public.organization_memberships to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, update on public.project_memberships to authenticated;
grant select, insert on public.audit_logs to authenticated;

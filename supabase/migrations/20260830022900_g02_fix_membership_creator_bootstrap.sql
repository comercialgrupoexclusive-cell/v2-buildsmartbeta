create or replace function private.is_org_creator(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.organizations o
    where o.id = p_organization_id
      and o.created_by = (select auth.uid())
  );
$$;

create or replace function private.is_project_creator(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.created_by = (select auth.uid())
  );
$$;

revoke all on function private.is_org_creator(uuid) from public, anon;
revoke all on function private.is_project_creator(uuid) from public, anon;
grant execute on function private.is_org_creator(uuid) to authenticated;
grant execute on function private.is_project_creator(uuid) to authenticated;

drop policy if exists organization_memberships_insert on public.organization_memberships;
create policy organization_memberships_insert on public.organization_memberships
for insert to authenticated
with check (
  private.org_can_manage(organization_id)
  or (
    user_id = (select auth.uid())
    and role = 'OWNER'
    and private.is_org_creator(organization_id)
  )
);

drop policy if exists project_memberships_insert on public.project_memberships;
create policy project_memberships_insert on public.project_memberships
for insert to authenticated
with check (
  private.project_can_manage(project_id)
  or (
    user_id = (select auth.uid())
    and role = 'MANAGER'
    and private.is_project_creator(project_id)
  )
);

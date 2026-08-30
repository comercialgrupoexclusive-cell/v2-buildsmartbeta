drop policy if exists organization_memberships_insert on public.organization_memberships;
create policy organization_memberships_insert on public.organization_memberships
for insert to authenticated
with check (
  private.org_can_manage(organization_id)
  or (
    user_id = (select auth.uid())
    and role = 'OWNER'
    and exists (
      select 1 from public.organizations o
      where o.id = organization_id
        and o.created_by = (select auth.uid())
    )
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
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.created_by = (select auth.uid())
    )
  )
);

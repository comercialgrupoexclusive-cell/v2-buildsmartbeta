create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.audit_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_project_id uuid;
  v_entity_id text;
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
begin
  v_actor := (select auth.uid());

  if tg_table_name = 'organizations' then
    v_org_id := coalesce(new.id, old.id);
    v_project_id := null;
    v_entity_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name = 'organization_memberships' then
    v_org_id := coalesce(new.organization_id, old.organization_id);
    v_project_id := null;
    v_entity_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name = 'projects' then
    v_org_id := coalesce(new.organization_id, old.organization_id);
    v_project_id := coalesce(new.id, old.id);
    v_entity_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name = 'project_memberships' then
    v_project_id := coalesce(new.project_id, old.project_id);
    select p.organization_id into v_org_id
    from public.projects p
    where p.id = v_project_id;
    v_entity_id := coalesce(new.id, old.id)::text;
  else
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := null;
  end if;

  insert into public.audit_logs (
    organization_id,
    project_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    source
  ) values (
    v_org_id,
    v_project_id,
    v_actor,
    lower(tg_table_name) || '.' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_before,
    v_after,
    'api'
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.audit_identity_change() from public, anon, authenticated;

create trigger organizations_touch_updated_at
before update on public.organizations
for each row execute function private.touch_updated_at();

create trigger organization_memberships_touch_updated_at
before update on public.organization_memberships
for each row execute function private.touch_updated_at();

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function private.touch_updated_at();

create trigger project_memberships_touch_updated_at
before update on public.project_memberships
for each row execute function private.touch_updated_at();

create trigger organizations_audit
before insert or update on public.organizations
for each row execute function private.audit_identity_change();

create trigger organization_memberships_audit
after insert or update on public.organization_memberships
for each row execute function private.audit_identity_change();

create trigger projects_audit
after insert or update on public.projects
for each row execute function private.audit_identity_change();

create trigger project_memberships_audit
after insert or update on public.project_memberships
for each row execute function private.audit_identity_change();

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'organization name is required' using errcode = '22023';
  end if;

  insert into public.organizations (name, created_by)
  values (trim(p_name), v_user_id)
  returning id into v_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_organization_id, v_user_id, 'OWNER');

  return v_organization_id;
end;
$$;

create or replace function public.create_project(p_organization_id uuid, p_name text, p_code text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_project_id uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not private.is_org_member(p_organization_id) then
    raise exception 'organization access denied' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'project name is required' using errcode = '22023';
  end if;

  v_code := nullif(trim(p_code), '');

  insert into public.projects (organization_id, code, name, created_by)
  values (p_organization_id, v_code, trim(p_name), v_user_id)
  returning id into v_project_id;

  insert into public.project_memberships (project_id, user_id, role)
  values (v_project_id, v_user_id, 'MANAGER');

  return v_project_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.create_project(uuid, text, text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.create_project(uuid, text, text) to authenticated;

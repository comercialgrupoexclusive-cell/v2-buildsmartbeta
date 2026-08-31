create type public.cost_item_type as enum ('MATERIAL', 'LABOR', 'SERVICE');

create table public.cost_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  type public.cost_item_type not null,
  unit_price numeric(15,4) not null default 0 check (unit_price >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cost_items_organization_idx on public.cost_items(organization_id);
create index cost_items_created_by_idx on public.cost_items(created_by);

alter table public.cost_items enable row level security;

grant select, insert, update, delete on public.cost_items to authenticated;

create policy cost_items_select on public.cost_items
for select to authenticated
using (private.is_org_member(organization_id));

create policy cost_items_insert on public.cost_items
for insert to authenticated
with check (created_by = (select auth.uid()) and private.org_can_manage(organization_id));

create policy cost_items_update on public.cost_items
for update to authenticated
using (private.org_can_manage(organization_id))
with check (private.org_can_manage(organization_id));

create policy cost_items_delete on public.cost_items
for delete to authenticated
using (private.org_can_manage(organization_id));

create or replace function private.enforce_cost_item_write()
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

  if new.organization_id <> old.organization_id then
    raise exception 'cost item organization cannot be changed';
  end if;
  if new.created_by <> old.created_by then
    raise exception 'cost item creator cannot be changed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_cost_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_org_id uuid;
  v_entity_id text;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.organization_id; v_entity_id := old.id::text; v_before := to_jsonb(old); v_after := null;
  elsif tg_op = 'INSERT' then
    v_org_id := new.organization_id; v_entity_id := new.id::text; v_before := null; v_after := to_jsonb(new);
  else
    v_org_id := new.organization_id; v_entity_id := new.id::text; v_before := to_jsonb(old); v_after := to_jsonb(new);
  end if;

  insert into public.audit_logs(
    organization_id, project_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, source
  ) values (
    v_org_id, null, (select auth.uid()),
    'cost_items.' || lower(tg_op), 'cost_items', v_entity_id,
    v_before, v_after, 'web'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.enforce_cost_item_write() from public, anon, authenticated;
revoke all on function private.audit_cost_item_change() from public, anon, authenticated;

create trigger cost_items_enforce_write
before insert or update on public.cost_items
for each row execute function private.enforce_cost_item_write();

create trigger cost_items_audit
after insert or update or delete on public.cost_items
for each row execute function private.audit_cost_item_change();

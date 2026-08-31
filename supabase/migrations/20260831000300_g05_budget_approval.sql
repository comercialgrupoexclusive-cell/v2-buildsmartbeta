-- Torna a FK auto-referenciada de budget_items diferível: duplicate_budget
-- insere uma árvore inteira em um único INSERT ... SELECT e a ordem das
-- linhas não garante pai antes de filho: sem isso, a checagem por-linha da
-- FK falharia de forma dependente de ordem.
alter table public.budget_items
  alter constraint budget_items_parent_id_fkey deferrable initially deferred;

create or replace function public.approve_budget(p_budget_id uuid)
returns public.budgets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result public.budgets;
begin
  update public.budgets set status = 'APPROVED'
  where id = p_budget_id and status = 'DRAFT'
  returning * into v_result;

  if v_result.id is null then
    raise exception 'draft budget not found or access denied' using errcode = '42501';
  end if;

  return v_result;
end;
$$;

create or replace function public.duplicate_budget(p_source_budget_id uuid, p_name text)
returns public.budgets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.budgets;
  v_result public.budgets;
begin
  select * into v_source from public.budgets where id = p_source_budget_id and status = 'APPROVED';
  if v_source.id is null then
    raise exception 'approved budget not found or access denied' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'revision name is required' using errcode = '22023';
  end if;

  insert into public.budgets (project_id, name, parent_budget_id, created_by)
  values (v_source.project_id, trim(p_name), v_source.id, (select auth.uid()))
  returning * into v_result;

  with copied as (
    select i.*, gen_random_uuid() as new_id
    from public.budget_items i
    where i.budget_id = v_source.id
  )
  insert into public.budget_items (id, budget_id, parent_id, cost_item_id, description, unit, quantity, unit_price, position)
  select c.new_id, v_result.id, p.new_id, c.cost_item_id, c.description, c.unit, c.quantity, c.unit_price, c.position
  from copied c
  left join copied p on p.id = c.parent_id;

  insert into public.budget_markups (budget_id, name, type, category, value, position)
  select v_result.id, name, type, category, value, position
  from public.budget_markups where budget_id = v_source.id;

  return v_result;
end;
$$;

revoke all on function public.approve_budget(uuid) from public, anon;
revoke all on function public.duplicate_budget(uuid, text) from public, anon;
grant execute on function public.approve_budget(uuid) to authenticated;
grant execute on function public.duplicate_budget(uuid, text) to authenticated;

-- Reverte migrations aplicadas diretamente em produção fora do Git, sem PR,
-- sem CI e sem PASS do Product Owner no G05_PLANO.md (g05_budget,
-- g05_security_perf_fix). Tabelas estavam vazias (0 linhas) - nenhum dado
-- real foi perdido. G05 será reaberto formalmente pelo processo normal
-- (branch v2-g05-budget, PR, CI) quando autorizado.
drop table if exists public.budget_items cascade;
drop table if exists public.budget_markups cascade;
drop table if exists public.cost_items cascade;
drop table if exists public.budgets cascade;

drop function if exists public.approve_budget(uuid);
drop function if exists public.duplicate_budget(uuid, text);
drop function if exists public.block_approved_budget_mutation() cascade;
drop function if exists public.block_approved_budget_update() cascade;
drop function if exists public.validate_budget_item_links() cascade;
drop function if exists private.is_project_organization_member(uuid);
drop function if exists private.is_budget_organization_member(uuid);
drop function if exists private.is_budget_draft(uuid);

drop type if exists public.cost_item_type;
drop type if exists public.budget_status;
drop type if exists public.markup_type;

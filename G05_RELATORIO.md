# BuildSmart V2 — G05_RELATORIO

## Estado
EM EXECUÇÃO

## Branch
v2-g05-budget

## Alterações executadas

### Rodada 1 — G05.1 (base de custos `CostItem`)
- Migration `20260831000000_g05_cost_items.sql`: tabela `cost_items` (organization_id, description, unit, type enum MATERIAL/LABOR/SERVICE, unit_price, created_by), RLS (select = membro ativo da Organization; insert/update/delete = `org_can_manage`, ou seja OWNER/ADMIN), trigger de enforce (bloqueia mudar `organization_id`/`created_by` depois de criado), trigger de auditoria em `audit_logs`, índices em `organization_id` e `created_by`.
- Teste `tests/g05-cost-items-contract.test.ts` (5 testes): estrutura da tabela, RLS por `org_can_manage`, imutabilidade de `organization_id`/`created_by`, auditoria, índice de FK.
- Sem UI nesta rodada — G05.1 é só a base de dados; tela de cadastro de `CostItem` fica pra quando o CRUD de `Budget`/`BudgetItem` (G05.2) precisar consumi-la, evitando tela solta sem uso real ainda.

## Comandos executados

### Lint
Comando: `npm run lint`
Resultado: limpo.

### Typecheck
Comando: `npm run typecheck`
Resultado: limpo.

### Testes
Comando: `npm run test`
Resultado: 7 arquivos / 29 testes, todos passando (5 novos de `cost_items`).

### Build
Comando: `npm run build`
Resultado: limpo, 11 rotas geradas (nenhuma nova nesta rodada).

## Segurança
- Migration aplicada diretamente via Supabase MCP e replicada no arquivo do repositório (mesmo texto).
- Supabase Security Advisor: nenhum lint novo introduzido por esta rodada (o único WARN ativo, `auth_leaked_password_protection`, é pré-existente e bloqueado pelo plano Free).
- Supabase Performance Advisor: FK `created_by` já nasceu indexada (`cost_items_created_by_idx`) — sem alerta de índice faltando.

## Dívida técnica criada
Nenhuma nova nesta rodada.

## Itens deliberadamente não implementados nesta rodada
- G05.2 (Budget/BudgetItem), G05.3 (Markups), G05.4 (Aprovação), UI de qualquer parte — ficam para as próximas rodadas, uma de cada vez, conforme G05_PLANO seção 6.

## Evidências para revisão
- commit local (a ser pushado): migration + teste desta rodada.

## Autoavaliação do Gate
NÃO PRONTO — só a rodada 1 (G05.1) de 6 foi concluída.

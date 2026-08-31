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

### Rodada 2 — G05.2 (Budget e árvore de `BudgetItem`)
- Migration `20260831000100_g05_budgets.sql`: tabela `budgets` (status DRAFT/APPROVED, `parent_budget_id` para revisão, par `approved_at`/`approved_by` validado por CHECK), tabela `budget_items` em árvore livre (`parent_id` auto-referenciado, sem etapas fixas), `cost_item_id` opcional que herda unidade/preço do `CostItem`.
- RLS: leitura por membro do Project; escrita em `budget_items` exige `is_budget_editor` (project_can_edit) **e** `is_budget_draft` — trava automaticamente qualquer escrita assim que o Budget é aprovado.
- Trigger `enforce_budget_write`: impede mudar `project_id`/`created_by`/`parent_budget_id`, impede reabrir ou renomear Budget aprovado, preenche `approved_at`/`approved_by` automaticamente na transição DRAFT→APPROVED.
- Trigger `validate_budget_item_links`: impede item ser pai de si mesmo, exige que o pai pertença ao mesmo Budget, exige que `cost_item_id` pertença à mesma Organization do Project do Budget.
- Funções `public.budget_item_total`/`public.budget_total` (`security invoker`, recursivas): nó folha = quantidade × preço; nó pai = soma dos filhos. Rodam sob RLS de quem chama.
- Auditoria (`private.audit_budget_change`) em `budgets` e `budget_items`.
- Teste funcional real e descartável (transação com `ROLLBACK`, sem resíduo): árvore de 3 níveis (raiz → 2 galhos → 2 folhas em um dos galhos) — `budget_item_total` do galho intermediário deu 200 (esperado), da raiz deu 500 (esperado), e `budget_total` do orçamento inteiro também 500. Confirmado `select count(*)` = 0 em `budgets`/`budget_items` depois do rollback.
- Teste `tests/g05-budgets-contract.test.ts` (6 testes): árvore livre (nenhuma menção a "etapa" fixa), bloqueio de escrita fora de DRAFT, imutabilidade pós-aprovação, validação de vínculos pai/CostItem, funções de total como `security invoker`, auditoria.

## Comandos executados

### Lint
Comando: `npm run lint`
Resultado: limpo (rodadas 1 e 2).

### Typecheck
Comando: `npm run typecheck`
Resultado: limpo (rodadas 1 e 2).

### Testes
Comando: `npm run test`
Resultado: 8 arquivos / 35 testes, todos passando (6 novos de `budgets`, além dos 5 de `cost_items`).

### Build
Comando: `npm run build`
Resultado: limpo, 11 rotas geradas (nenhuma UI nova ainda — G05.2 também é só backend).

## Segurança
- Supabase Security Advisor: sem lint novo (só o WARN pré-existente de leaked password, bloqueado pelo plano Free).
- Supabase Performance Advisor: sem FK sem índice; só INFO de "unused index" (esperado, sem tráfego real ainda).

## Dívida técnica criada
Nenhuma nova nesta rodada.

## Itens deliberadamente não implementados nesta rodada
- G05.3 (Markups), G05.4 (Aprovação via RPC dedicada + `duplicate_budget` para revisão), G05.5 (mais testes), G05.6 (UI mobile-first) — ficam para as próximas rodadas, uma de cada vez, conforme G05_PLANO seção 6.
- UI de qualquer parte — ainda não há tela de Budget; entra quando houver o fluxo completo pra evitar tela solta sem funcionalidade real por trás.

## Evidências para revisão
- 2 commits na branch `v2-g05-budget` (rodada 1: `cost_items`; rodada 2: `budgets`/`budget_items`), ambos com lint/typecheck/test/build limpos.
- Teste funcional de 3 níveis de árvore executado ao vivo no banco, com rollback (sem resíduo).

## Autoavaliação do Gate
NÃO PRONTO — rodadas 1 e 2 (G05.1, G05.2) de 6 concluídas.

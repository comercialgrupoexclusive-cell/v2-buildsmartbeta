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

### Rodada 3 — G05.3 (Markups) + G05.4 (Aprovação e revisão)
- Migration `20260831000200_g05_budget_markups.sql`: `budget_markups` (percentual/fixo), mesma trava de escrita (`is_budget_editor` + `is_budget_draft`), `budget_markup_amount`/`budget_final_total` (`security invoker`).
- Migration `20260831000300_g05_budget_approval.sql`: FK auto-referenciada de `budget_items` tornada `deferrable initially deferred` (necessário pra `duplicate_budget` inserir uma árvore inteira em um único `INSERT ... SELECT` sem depender da ordem das linhas); `approve_budget` (RPC, só aprova DRAFT); `duplicate_budget` (RPC, só duplica APPROVED, cria revisão DRAFT com `parent_budget_id`, copia itens e markups com IDs remapeados).
- **Dois bugs reais achados e corrigidos durante o teste funcional ao vivo** (não só assumidos corretos):
  1. Rodar SQL direto (sem sessão autenticada) faz `auth.uid()` retornar `null` — o teste inicial falhou no próprio `CHECK` de `budgets_approval_pair`. Corrigido simulando sessão via `set_config('request.jwt.claims', ...)` + `set local role authenticated`.
  2. RLS em `UPDATE` não gera exceção quando a policy não bate — só filtra silenciosamente (zero linhas afetadas). O teste inicial assumia que tentar editar um item de orçamento aprovado geraria erro; corrigido para checar se o valor realmente não mudou.
- Teste funcional real e descartável (transação com `ROLLBACK`): item de 1000 direto + BDI 25% (+250) + taxa fixa 50 = 1300 final; aprovação preenche `approved_at`/`approved_by`; edição pós-aprovação bloqueada por RLS (valor não muda); `duplicate_budget` cria revisão DRAFT com o mesmo item e mesmo total final (1300). `select count(*)` = 0 em todas as tabelas depois do rollback.
- Teste `tests/g05-budget-markups-approval-contract.test.ts` (6 testes).

### Rodada 4 — G05.6 (UI mobile-first)
- `lib/budget/{types,repository,service}.ts`: mesmo padrão Repository/Service já usado em `lib/tasks`. Funções puras `buildItemTree`/`computeNodeTotal` (árvore livre a partir de lista plana; nó folha = qtd×preço, nó pai = soma dos filhos) — testáveis sem banco.
- `app/projects/[projectId]/budget/page.tsx` + `app/budget/budget-workspace.tsx`: tela única mobile-first — árvore colapsável (toque expande/recolhe), total em destaque no topo, formulário de item com 3 campos (descrição/quantidade/preço) fixo no rodapé (ação primária no polegar), markups atrás de "Avançado", botão "Aprovar orçamento" fixo no rodapé, tudo somente-leitura depois de aprovado.
- Link "Orçamento" adicionado em cada card de `/projects`.
- Teste `tests/g05-budget-tree.test.ts` (4 testes): árvore livre, total de folha, total de pai em 3 níveis, item órfão não quebra a árvore.

## Comandos executados (consolidado, rodadas 1-4)

### Lint / Typecheck / Build
Todos limpos.

### Testes
Comando: `npm run test`
Resultado: 10 arquivos / 45 testes, todos passando.

## Segurança
- Supabase Security Advisor: sem lint novo em nenhuma rodada (só o WARN pré-existente de leaked password, bloqueado pelo plano Free).
- Supabase Performance Advisor: sem FK sem índice.

## Dívida técnica criada
- UI de `CostItem` (cadastro de base de custos) ainda não existe — os itens de orçamento hoje só aceitam preço manual pela tela; vincular a um `CostItem` é possível no banco (`cost_item_id`) mas sem seletor na UI ainda. Registrado, não bloqueia o Gate (G05_PLANO não exige isso).

## Itens deliberadamente não implementados
- Multi-revisão lado a lado na UI (só a criação da revisão via `duplicate_budget` existe no banco; navegar entre revisões antigas fica pra quando houver caso real).
- Seletor de `CostItem` na tela de item (ver dívida técnica acima).

## Evidências para revisão
- 4 commits na branch `v2-g05-budget`, todos com lint/typecheck/test/build limpos.
- Dois testes funcionais ao vivo no banco (árvore de 3 níveis; markup+aprovação+duplicação), ambos em transação com `ROLLBACK`, sem resíduo.
- Build gera a rota `/projects/[projectId]/budget` normalmente.

### Rodada 5 — achado real de campo: beco sem saída pós-aprovação + auto-criação silenciosa de Budget
O Product Owner testou a tela em produção e achou dois problemas reais:
1. Depois de clicar "Aprovar orçamento", não tinha pra onde ir — a tela ficava travada, somente-leitura, sem indicar o próximo passo.
2. **Bug real de dado**: `getOrCreateActiveBudget` criava um Budget novo (vazio) toda vez que não achava um DRAFT — então, depois de aprovar, um simples reload da página gerava silenciosamente um segundo orçamento vazio duplicado. Confirmado ao vivo no banco de produção: existiam 2 Budgets pro mesmo Project (um `APPROVED` com os itens reais que o Product Owner digitou — Cimento, Areia, Prego, Alvenaria, Treliça — e um `DRAFT` vazio, artefato do bug). O duplicado vazio foi removido; o orçamento real com os itens do Product Owner não foi tocado.

**Correção:**
- `BudgetService.getOrCreateActiveBudget` agora só cria um Budget novo quando o Project **realmente não tem nenhum** (nem DRAFT nem histórico). Se existe histórico mas o mais recente está `APPROVED`, reaproveita esse — nunca cria um novo silenciosamente. Criar uma nova revisão passa a ser sempre ação explícita do usuário.
- Extraída a interface `BudgetRepository` (mesmo padrão de `TaskRepository`), permitindo testar essa lógica com repositório fake, sem banco — `tests/g05-budget-service.test.ts` (3 testes, cobrindo os 3 caminhos: DRAFT existe / só há histórico aprovado / não existe nada ainda).
- Tela reescrita: estado "Aprovado" agora mostra claramente banner explicando que está travado, botão **"Criar nova revisão"**, e histórico de orçamentos do Project (rascunho atual em destaque).
- Base de custos (`CostItem`) ganhou interface de verdade: seção "Avançado" no orçamento lista/cadastra itens de custo da Organization, e o formulário de adicionar item ganha um seletor pra puxar descrição/preço de um item de custo existente (continua editável).
- Teste funcional real e descartável (transação com `ROLLBACK`): cadastro de item de custo → item de orçamento vinculado herda unidade/preço corretamente (100kg × R$0,85 = R$85) → aprovação → revisão mantém o vínculo com o `cost_item_id` original. Zero resíduo confirmado.

### Rodada 6 — Polimento final
- Tela de orçamento ganhou link "‹ Projetos" no cabeçalho fixo — não era mais possível voltar pra lista de projetos sem usar o botão do navegador.

## Comandos executados (consolidado, rodadas 1-6)
Lint, typecheck, build: limpos em todas as rodadas.
Testes: 11 arquivos / 48 testes, todos passando.

## Autoavaliação do Gate
PRONTO PARA REVISÃO — G05.1 a G05.6 implementados, testados (automatizado + funcional ao vivo, incluindo um ciclo real de uso pelo Product Owner que revelou e corrigiu um bug de dado). Fluxo completo: cadastrar base de custos → montar orçamento em árvore → aplicar markup → aprovar → criar revisão quando precisar mudar algo depois de aprovado. Nada mais identificado como "casca vazia". Declaração de PASS é decisão do Product Owner.

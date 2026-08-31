# BuildSmart V2 — G06_RELATORIO

## Estado
PRONTO PARA REVISÃO (autoavaliação da execução — PASS é decisão do Product Owner)

## Branch
v2-g06-planning

## HIPÓTESE
Planejamento é o cronograma real da obra: atividades com datas, duração e dependências entre si, cada uma rastreável até o item de orçamento que ela executa (critério de Gate do G00: "previsto ↔ atividade rastreável por ID"). Sem dependências e caminho crítico (CPM), Planning seria apenas uma lista de tarefas redundante com o módulo Tasks já existente (G03/G04) — o CPM é o que diferencia os dois domínios.

## REFERÊNCIA
- **OpenConstructionERP** (código atual, lido e não copiado — AGPL-3.0): `backend/app/modules/schedule/models.py` (Schedule/Activity/ScheduleRelationship em árvore WBS livre, `boq_position_ids` ligando ao orçamento) e `backend/app/modules/schedule_advanced/cpm.py` (motor CPM forward/backward pass, FS/SS/FF/SF com lag, detecção de ciclo). Confirma a decisão do G06_PLANO de reimplementar o mesmo modelo conceitual do zero, sem herdar código.
- **Síntese Arquitetural Geral V0** (Drive, seção 9) — define o núcleo esperado de Planning (granularidade diária, FS/SS/FF/SF, prevenção de ciclos, folgas e caminho crítico) e o que fica para depois (baselines, cenários, Curva S, calendários com exceções).
- **G00 — Matriz de Referências e Gates** — critério de Gate literal usado como piso mínimo de escopo.

Ver `G06_PLANO.md` para o registro completo de decisões e do que foi deliberadamente adiado.

## O QUE FOI IMPLEMENTADO

### Rodada 1 — G06.1 (PlanningActivity + vínculo com Budget)
- Migration `20260831120000_g06_planning_activities.sql`: `planning_activities` em árvore livre (`parent_id` auto-referenciado, mesmo padrão de `budget_items`), datas planejadas, duração em dias, status; `planning_activity_budget_items` como junção N:N com `budget_items` — cumpre literalmente o critério de Gate do G00.
- RLS (leitura por membro do Project, escrita por `is_planning_editor`), trigger de enforce (bloqueia mudar `project_id`/`created_by`), trigger de validação de árvore (pai deve ser do mesmo Project) e de vínculo (item de orçamento deve ser do mesmo Project da atividade), auditoria em `audit_logs`.
- Aplicada ao vivo via Supabase MCP. Security/Performance Advisor sem alerta novo.

### Rodada 2 — G06.2 (PlanningDependency + motor CPM)
- Migration `20260831130000_g06_planning_dependencies.sql`: `planning_dependencies` (predecessor/sucessor, tipo FS/SS/FF/SF, lag em dias). Trigger de validação bloqueia: auto-dependência (constraint de banco), dependência entre atividades de Projects diferentes, e **dependência que criaria um ciclo** — checado via CTE recursiva perguntando se o sucessor já alcança o predecessor antes de aceitar o novo link.
- `lib/planning/cpm.ts`: motor CPM puro em TypeScript (`computeCpm`) — ordenação topológica (Kahn) que também serve como segunda linha de detecção de ciclo (lança `CycleError` se não conseguir ordenar todos os nós), forward pass (ES/EF) e backward pass (LS/LF) respeitando os quatro tipos de dependência com lag, folga total, marcação de crítico (`totalFloat <= 0`), suporte a sub-redes desconectadas.
- Aplicada ao vivo via Supabase MCP. Security Advisor sem alerta novo.

### Rodada 3 — G06.4 (UI mobile-first)
- `lib/planning/{types,repository,service}.ts`: mesmo padrão Repository/Service de `lib/budget`. Funções puras `buildActivityTree` (árvore a partir de lista plana) e `daysBetween` (duração a partir das datas).
- `app/projects/[projectId]/planning/page.tsx` + `app/planning/planning-workspace.tsx`: tela única mobile-first — árvore colapsável de atividades (nome, datas, duração, folga e badge "crítico" quando `isCritical`), item(ns) de orçamento vinculado(s) mostrado(s) por atividade, seção "Avançado" com dependências (lista + formulário de até 4 campos: predecessora/sucessora/tipo/lag), formulário de atividade fixo no rodapé (nome/datas/item de orçamento — até 4 campos visíveis), link "‹ Projetos" no cabeçalho.
- Link "Planejamento" adicionado em cada card de `/projects`.

## TESTES
- `tests/g06-planning-activities-contract.test.ts` (6 testes): árvore livre, vínculo por FK com `budget_items`, validação de mesmo Project, RLS via `is_planning_editor`, imutabilidade de `project_id`/`created_by`, auditoria.
- `tests/g06-planning-dependencies-contract.test.ts` (6 testes): quatro tipos PDM com lag, bloqueio de ciclo, bloqueio cross-project, imutabilidade de predecessor/sucessor, rejeição de auto-dependência via constraint, auditoria.
- `tests/g06-planning-cpm.test.ts` (4 testes): CPM calculado contra uma rede conhecida verificada à mão (A→B/A→C→D com A=3,B=2,C=4,D=1 — caminho crítico A→C→D com folga 0, B com folga 2), lag em FS, sub-redes desconectadas, `CycleError` em grafo cíclico.
- `tests/g06-planning-tree.test.ts` (4 testes): árvore a partir de lista plana, item órfão não quebra a árvore, `daysBetween`.
- **Teste funcional real e descartável** (transação com `ROLLBACK`, mesmo método usado em todo G05, contra o banco de produção real): organização/projeto criados via as RPCs `create_organization`/`create_project` já existentes (evita o efeito colateral de `RETURNING` reavaliar a policy de SELECT antes da membership existir — achado real durante este teste, ver FALHAS abaixo); orçamento com 2 itens; 2 atividades de planejamento, cada uma ligada a um item por ID; 1 dependência FS real criada; tentativa de criar dependência cíclica **bloqueada**; tentativa de vincular atividade a item de orçamento de **outro** Project **bloqueada**. `select count(*)` = 0 em todas as tabelas envolvidas depois do rollback — zero resíduo confirmado.

## DADOS COLETADOS
- 68 testes automatizados (15 arquivos), todos passando.
- Lint/typecheck/build limpos.
- Rota `/projects/[projectId]/planning` gerada no build (4.94 kB, dinâmica).
- CPM verificado contra exemplo manual: A(3)→C(4)→D(1) crítico (folga 0); A(3)→B(2)→D(1) com folga 2 em B — bate com o cálculo esperado de um exercício clássico de CPM.

## FALHAS ENCONTRADAS
- **Achado durante o teste funcional ao vivo, não assumido**: inserir diretamente em `organizations`/`projects` com `RETURNING id` sob RLS falha, porque o Postgres reavalia a policy de `SELECT` sobre a linha recém-criada para satisfazer o `RETURNING` — e a policy de `organizations`/`projects` exige `is_org_member`/`is_project_member`, que só passa depois que a membership é inserida (próxima instrução). O app real evita isso porque `create_organization`/`create_project` são `security definer` (bypassam RLS internamente e fazem os dois inserts antes de devolver o id). Corrigido no teste chamando essas RPCs em vez de inserts manuais — nenhum bug no código de produção, era um erro de metodologia do próprio teste.

## DECISÕES
- CPM roda na camada de aplicação (TypeScript), não em SQL recursivo — grafo dirigido com forward/backward pass não é natural em SQL declarativo, diferente da soma recursiva de `budget_item_total`. Ver `G06_PLANO.md` seção 4.3.
- Calendário de dias corridos simples neste Gate (sem feriados/fins de semana/calendário por atividade) — decisão explícita registrada em `G06_PLANO.md`, adiada para quando houver necessidade real comprovada.
- Vínculo atividade↔orçamento é N:N (uma atividade pode cobrir mais de um item; um item pode ser coberto por mais de uma atividade), não 1:1 — reflete o `boq_position_ids` (array) do OpenConstructionERP.

## DÍVIDA CONHECIDA (adiada, registrada em `G06_PLANO.md` seção 5 — não descartada)
- Baselines (snapshot imutável planejado × real) — fica para junto do G07 (Execução), que é quem consome "avanço real".
- Replanejamento versionado / cenários (`PlanningPlan` alternativo) — Budget já tem o padrão de revisão via `parent_budget_id`; Planning reaproveita esse padrão quando a necessidade aparecer.
- Curva S / físico-financeiro derivado, calendário de trabalho com exceções, marcos com condições técnicas de liberação, clima, RDO como evidência de pré-andamento, BIM links, nivelamento de recursos, EVM.

## Evidências para revisão
- 3 commits na branch `v2-g06-planning` (rodada 1: `planning_activities`; rodada 2: `planning_dependencies` + CPM; rodada 3: UI), todos com lint/typecheck/test/build limpos.
- Teste funcional ao vivo executado no banco de produção real, com rollback (sem resíduo).

## Autoavaliação do Gate
PRONTO PARA REVISÃO — G06.1 a G06.4 implementados, testados (automatizado + funcional ao vivo). Fluxo completo: cadastrar atividade → vincular a item de orçamento → criar dependência → ver caminho crítico calculado. Nada identificado como "casca vazia". Declaração de PASS é decisão do Product Owner.

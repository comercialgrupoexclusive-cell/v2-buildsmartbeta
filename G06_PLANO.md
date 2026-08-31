# BuildSmart V2 — G06_PLANO.md

## 1. Gate

**G06 — Planejamento**

Status inicial: **AUTORIZADO PARA EXECUÇÃO** (Product Owner, 2026-08-31, após G05 fechado com "PRONTO PARA REVISÃO").

Este arquivo é o contrato executivo do Gate. O Claude deve executar somente o que está definido aqui e manter `G06_RELATORIO.md` atualizado com evidências reais.

---

## 2. Alvo do G06

Construir o módulo de **Planejamento** do BuildSmart V2: atividades de cronograma vinculadas ao orçamento aprovado (`Budget`/`BudgetItem` do G05), com datas, duração, dependências entre atividades e caminho crítico (CPM) calculado deterministicamente.

Critério de Gate definido no G00 (`G00 — Matriz de Referências e Gates`): **"previsto ↔ atividade rastreável por ID"** — toda atividade de planejamento deve apontar, por FK, para o(s) item(ns) de orçamento que ela executa.

---

## 3. Evidência consultada

Hierarquia de evidência do G00 aplicada:

1. **Código atual do OpenConstructionERP** (`backend/app/modules/schedule/models.py`, `backend/app/modules/schedule_advanced/cpm.py`) — lido, não copiado (AGPL-3.0, mesma regra do G05). Confirma: `Schedule` (container) → `Activity` (WBS livre, `parent_id` auto-referenciado, datas, duração, `boq_position_ids` ligando ao orçamento), `ScheduleRelationship` (FS/SS/FF/SF + lag, motor CPM com forward/backward pass, detecção de ciclo, `is_critical`), `ScheduleBaseline` (fora de escopo deste Gate — ver seção 5).
2. **Síntese Arquitetural Geral V0** (Drive, seção 9 — "Planning: posição arquitetural atual") — já define o núcleo esperado: granularidade diária, FS/SS/FF/SF com lag, prevenção de ciclos, recálculo determinístico, folgas e caminho crítico derivados, baselines imutáveis, replanejamento no mesmo `PlanningPlan`, cenários em outro `PlanningPlan`, Curva S, necessidade futura de materiais. Documento também lista pontos "ainda não consolidados" (marcos/condições técnicas, clima, RDO como evidência) — não viram requisito deste Gate.
3. **G00 — Matriz de Referências e Gates**: critério de Gate é o mínimo ("atividade ↔ orçamento rastreável por ID"), não a lista completa da Síntese.

Decisão de escopo (regra do G00: "só entra o que tiver necessidade real demonstrada"): implementar o **núcleo determinístico real** (atividades, dependências, CPM) porque sem ele Planning é apenas uma lista de tarefas redundante com o módulo Tasks (G03/G04) já existente — o CPM é o que diferencia Planning de Tasks. Adiar tudo que depende de uso de campo ainda não ocorrido (baselines, replanejamento versionado, cenários, Curva S, calendários com exceções, clima, RDO) para quando houver necessidade real comprovada.

---

## 4. Decisões já aprovadas e congeladas

1. **Referência funcional é o OpenConstructionERP (código atual), não a V1.** A V1 não tinha módulo de planejamento equivalente — não há o que herdar dela aqui.
2. Estrutura adotada (simplificada do que o OpenConstructionERP confirma em código):
   - **PlanningActivity** (equivalente a `Activity`) — pertence a um Project; árvore livre (`parent_id` auto-referenciado, WBS); tem nome, datas de início/fim planejadas, duração em dias, status (`not_started` / `in_progress` / `done`).
   - **PlanningActivityBudgetLink** — tabela de junção N:N entre `PlanningActivity` e `budget_items` (uma atividade pode cobrir mais de um item de orçamento; um item pode ser coberto por mais de uma atividade — ex.: uma etapa grande dividida em duas atividades). Cumpre literalmente o critério de Gate do G00 ("previsto ↔ atividade rastreável por ID").
   - **PlanningDependency** (equivalente a `ScheduleRelationship`) — liga duas `PlanningActivity` da mesma árvore/Project, com tipo (FS/SS/FF/SF) e lag em dias. Motor de CPM roda sobre este grafo.
3. **Motor CPM roda na camada de aplicação (TypeScript), não em SQL recursivo.** Forward/backward pass sobre um grafo dirigido não é natural em SQL declarativo (diferente da soma recursiva de `budget_item_total`, que é uma árvore simples). Implementado como função pura testável (mesmo padrão de `buildItemTree`/`computeNodeTotal` do G05), consumindo `PlanningActivity[]` + `PlanningDependency[]` e devolvendo ES/EF/LS/LF/folga total/crítico por atividade. Detecção de ciclo (DFS) impede persistir uma dependência que cria loop — igual ao OpenConstructionERP, reimplementado do zero.
4. **Calendário: dias corridos simples neste Gate** (sem calendário de trabalho com feriados/fins de semana excluídos, sem calendário por atividade). É uma simplificação explícita — o OpenConstructionERP tem `OffsetCalendar` com exceções; fica para quando houver necessidade real comprovada em campo.
5. **Datas são texto ISO (`date`), sem fuso/hora** — consistente com o padrão de dias inteiros do resto do domínio de obra.
6. O trabalho deve ocorrer na branch `v2-g06-planning`. Merge só via PR. Nenhuma migração ou dado da V1 é copiado.
7. Toda operação de escrita passa por Action/Service/Repository (Organization → Project → PlanningActivity), nunca direto do componente React — mesma regra arquitetural do G02/G03/G05.
8. RLS: uma `PlanningActivity` e suas dependências só são visíveis/editáveis por membros da Organization dona do Project — mesmo isolamento já validado em G02/G03/G05.

---

## 5. O que NÃO fazer neste Gate (adiado, não descartado)

- **Baselines** (`ScheduleBaseline` / snapshot imutável para comparar planejado × real) — sem uso real ainda, e G07 (Execução) é quem consome "avanço real" — decidir baseline junto com G07.
- **Replanejamento versionado / cenários** (`PlanningPlan` alternativo, "what-if") — G05 já tem o padrão de revisão via `parent_budget_id`; Planning pode reaproveitar esse padrão quando a necessidade aparecer, não antes.
- **Curva S / físico-financeiro derivado** — depende de custo por atividade, que depende do vínculo com Budget já feito aqui, mas o cálculo em si é analítico e serve melhor depois que houver Execution real para comparar.
- **Calendário de trabalho com exceções** (feriados, fins de semana, calendário por atividade) — ver decisão 4 acima.
- **Marcos como atividade de duração zero com condições técnicas de liberação, clima, RDO como evidência de pré-andamento** — a Síntese Arquitetural já marca esses pontos como "ainda não consolidados", não requisito.
- **BIM links, GAEB, nivelamento de recursos, EVM, tokens de concorrência otimista** — mesma lógica do G05: sem necessidade demonstrada agora.

---

## 6. Escopo obrigatório

### G06.1 — PlanningActivity em árvore + vínculo com Budget
- CRUD de `PlanningActivity`: nome, datas (início/fim planejados), duração em dias, status, árvore livre por `parent_id`.
- Vínculo N:N com `budget_items` via `PlanningActivityBudgetLink` (uma atividade aponta para 1+ itens de orçamento aprovado).
- RLS + triggers de auditoria seguindo o padrão de `budget_items`.

### G06.2 — PlanningDependency + motor CPM
- CRUD de `PlanningDependency` (predecessor, sucessor, tipo FS/SS/FF/SF, lag).
- Bloqueio de dependência que criaria ciclo (validado antes de persistir).
- Função pura `computeCpm(activities, dependencies)`: forward pass (ES/EF), backward pass (LS/LF), folga total, marcação de caminho crítico. Suporta sub-redes desconectadas (cada componente calculado a partir do dia 0).

### G06.3 — Testes
- Testes automatizados: cálculo de CPM com uma rede conhecida (verificado à mão), detecção de ciclo, árvore de atividades (mesmo padrão de `g05-budget-tree.test.ts`).
- Teste funcional ao vivo (transação com `ROLLBACK`, mesmo método usado em todo G05): criar atividades reais vinculadas a itens de um orçamento aprovado existente, criar dependências, confirmar que o item de orçamento é rastreável por ID a partir da atividade.

### G06.4 — UI mobile-first
- Mesmo padrão do G05 (`app/budget/budget-workspace.tsx`): tela única por Project em `/projects/[projectId]/planning`, árvore colapsável de atividades, formulário de até 4 campos visíveis, ação primária no rodapé.
- Cada atividade mostra a que item(ns) de orçamento está ligada.
- Atividades no caminho crítico visualmente destacadas.
- Link de volta para `/projects` (aprendido do polimento final do G05).

---

## 7. Critérios de PASS (autoavaliação do Claude ao final; PASS real é decisão do Product Owner)

- [ ] `PlanningActivity` em árvore livre, CRUD completo, RLS testada.
- [ ] Toda atividade rastreável por ID até o(s) item(ns) de orçamento que executa — critério literal do G00.
- [ ] CPM calcula ES/EF/LS/LF/folga/crítico corretamente contra um exemplo conhecido, com teste automatizado.
- [ ] Dependência cíclica é rejeitada antes de persistir.
- [ ] Teste funcional ao vivo sem resíduo (ROLLBACK) confirma o fluxo real.
- [ ] UI mobile-first navegável (nada de "casca vazia").
- [ ] Lint/typecheck/test/build limpos.
- [ ] `G06_RELATORIO.md` atualizado com HIPÓTESE/REFERÊNCIA/IMPLEMENTADO/TESTES/DADOS/FALHAS/DECISÕES/DÍVIDA — formato do G00.

---

## 8. Primeira instrução ao Claude

Executar o escopo acima em rodadas pequenas (uma peça por vez, testada), sem pausar para confirmação a cada rodada — só ao final do Gate, se houver decisão arquitetural fora do combinado aqui, ou se travar de verdade em algo que só o Product Owner resolve. Ao terminar tudo (implementado, testado automaticamente, testado ao vivo, UI funcional de ponta a ponta, não uma casca vazia), atualizar `G06_RELATORIO.md`, mandar o link de produção e parar antes de abrir G07.

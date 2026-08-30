# G03 — Tasks Core — Relatório de execução

Status: **PASS técnico**  
Data: 30/08/2026

## Hipótese / objetivo

Implementar o Gate G03 já congelado no G00: entidade Task + Actions + Service + Repository, mantendo Task como entidade canônica vinculada obrigatoriamente a Project e comprovando CRUD operacional, responsável, prazo, prioridade, estados, permissões e Audit.

## Referência canônica

G00 aprovado:

- Organization → Project → Task.
- toda Task pertence obrigatoriamente a um Project;
- uma única Task canônica alimenta Lista, Kanban, Calendário, Minhas Tarefas e contexto do Project;
- estados: TO_DO, IN_PROGRESS, WAITING, COMPLETED, CANCELED;
- sem DRAFT operacional; OVERDUE é condição derivada, não status;
- prioridades: LOW, NORMAL, HIGH, URGENT;
- start_at e due_at opcionais;
- no máximo um responsável principal e zero ou mais participantes;
- responsável e participantes precisam ser membros ativos do mesmo Project;
- responsável pode alterar status operacional e checklist;
- participante pode atuar no checklist sem ganhar permissão adicional no Project;
- EDITOR/MANAGER administram a Task;
- hard delete não é operação normal: cancelamento preserva histórico;
- checklist é relacional e pertence à Task;
- writes relevantes + Audit formam unidade consistente;
- G03 entrega Core; validação de Lista/Kanban/Calendário em campo pertence ao G04.

## Implementado

### Persistência

- enums `task_status` e `task_priority`.
- tabela `tasks` com Project obrigatório, título, descrição, status, prioridade, responsável, start_at, due_at, autor e timestamps.
- `task_participants` relacional.
- `task_checklist_items` relacional com posição, conclusão, autor da conclusão e timestamps.
- sem tabelas paralelas de Kanban/Calendário/Lista.

### Segurança / permissões

- RLS habilitado nas três tabelas do domínio.
- grants explícitos para `authenticated`, compatíveis com a política atual da Data API do Supabase.
- leitura limitada a ProjectMembership.
- criação/edição administrativa exige EDITOR/MANAGER.
- assignee pode atualizar a Task somente no campo operacional de status.
- participante não pode alterar status da Task.
- participante pode concluir/reabrir item de checklist, mas não criar, apagar, renomear ou reordenar item.
- assignee e EDITOR+ podem operar checklist.
- assignee/participant externo ao Project é rejeitado pelo banco.
- `project_id` e `created_by` da Task são imutáveis.
- não existe policy de DELETE para `tasks`.

### Ciclo de vida

- estados canônicos congelados no G00.
- COMPLETED reabre somente para IN_PROGRESS.
- CANCELED reativa somente para TO_DO.
- demais mudanças continuam passando pelo mesmo guard de persistência e pelo Service.
- cancelamento substitui hard delete no fluxo normal.

### Audit

- Task, participantes e checklist possuem triggers de Audit.
- mutação e Audit ocorrem na mesma transação; falha do Audit implica rollback da mutação.
- registros preservam Organization, Project, ator, ação, entidade, before/after, source e timestamp pela infraestrutura transversal do G02.

### Camadas de aplicação

- `lib/tasks/types.ts`: contratos do domínio.
- `lib/tasks/repository.ts`: Repository e implementação Supabase.
- `lib/tasks/service.ts`: invariantes e ciclo de vida.
- `lib/tasks/actions.ts`: Actions autenticadas; identidade vem de `auth.getUser()`, não de `user_id` enviado como autoridade pelo cliente.

## Testes e evidências

### Banco — cenário autenticado

Teste transacional descartável no Supabase:

- MANAGER criou Task válida.
- responsável principal foi atribuído.
- participante foi vinculado.
- checklist foi criado.
- responsável alterou status TO_DO → IN_PROGRESS.
- participante concluiu checklist.
- `completed_by` foi definido pelo banco como o ator real.
- 5 registros de Audit de Task/checklist/participantes foram observados na transação.
- transação foi revertida; não deixou dados de teste.

### Banco — testes adversariais

Comprovado:

- assignee externo ao Project: rejeitado;
- VIEWER tentando alterar prioridade: 0 rows modificadas;
- assignee tentando alterar título: rejeitado;
- participante tentando alterar status: 0 rows modificadas;
- participante tentando renomear checklist: rejeitado;
- participante pode somente concluir/reabrir item no seu escopo operacional;
- usuário da Organization A não visualiza Task da Organization/Project B;
- usuário A não consegue atualizar Task de B;
- troca de UUID para Task de outro Project não concede acesso.

### Supabase Advisor

Security Advisor após G03: **0 lints**.

Performance Advisor contém apenas avisos INFO de índices, incluindo avisos preexistentes do G02 e índices recém-criados ainda sem uso por o banco estar vazio. Não há alerta de segurança bloqueante.

### CI

GitHub Actions run `33291802189` na branch `v2-g03-tasks-core`:

- npm ci: PASS.
- lint: PASS.
- typecheck: PASS.
- tests: PASS.
- build: PASS.

Testes automáticos do G03 cobrem:

- estados/prioridades canônicos e ausência de DRAFT/OVERDUE como status;
- criação vinculada a Project;
- título obrigatório/normalizado;
- intervalo de datas válido;
- reabertura de COMPLETED;
- reativação de CANCELED;
- My Tasks definido pelo assignee autenticado;
- cancelamento como substituto do hard delete.

## Falhas encontradas durante execução

1. Primeira versão do trigger de checklist avaliava OLD/NEW sem separar corretamente INSERT/DELETE. Corrigido antes dos testes finais.
2. Primeiro CI falhou no typecheck porque mocks de status foram inferidos como `string`. O teste foi corrigido para preservar o tipo `TaskStatus`; novo CI passou integralmente.

## Decisões

- G03 não implementa Kanban, Calendário ou Lista como estruturas separadas; essas visões reutilizarão a Task canônica no G04.
- Não foi criado motor de dependências entre Tasks; Planning continua sendo a futura fonte de predecessoras/sucessoras.
- Não foram criados tipos/status customizados, BIM links ou alertas avançados.
- A autorização permanece em profundidade: Actions autenticadas + Service + RLS + guards de banco.

## Dívida conhecida

- advisories do stack Next.js 14/dependências permanecem dívida herdada do G01/G02; não executar upgrade destrutivo dentro do G03.
- Performance Advisor possui INFOs de índices sem uso/FKs sem índice, sem impacto funcional ou de segurança no Gate atual; revisar com volume real antes de otimização prematura.

## Resultado

**G03 — PASS técnico.**

Critério do Gate comprovado: Task Core implementado com Actions + Service + Repository, CRUD operacional sem hard delete, responsável, prazo, prioridade e estados testados, isolamento por Project/Organization e Audit consistente.

Próximo Gate autorizado pelo plano canônico: **G04 — Tasks Campo**.
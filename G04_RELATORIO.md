# G04 — Tasks Campo

Status: **PASS técnico / validação de campo pendente**

## Escopo canônico

G04 materializa o Task Core do G03 no uso de campo sem criar uma segunda entidade de tarefa: Project Tasks, My Tasks e Kanban mínimo são projeções da mesma `Task` ligada ao `Project`.

## Implementação

- `/projects/[projectId]/tasks`: tarefas do Project.
- `/tasks/my`: tarefas atribuídas ao usuário autenticado.
- criação rápida com título, prioridade, responsável e prazo.
- Lista e Kanban mínimo sobre o mesmo conjunto de Tasks.
- mudança de estado reutiliza `TaskService` e `SupabaseTaskRepository` do G03.
- seletor de responsável limitado aos `project_memberships` visíveis por RLS.
- entrada para Tasks adicionada aos cards de Project e atalho global para My Tasks.
- layout responsivo, com Kanban horizontalmente utilizável em telas estreitas.

## Segurança e arquitetura

Nenhuma tabela paralela foi criada para Lista/Kanban/My Tasks. O G04 reutiliza integralmente RLS, permissões, Audit e invariantes do G03. A sessão autenticada continua sendo validada antes do carregamento da interface.

## Validação técnica concluída

GitHub Actions run `33292207462` no head `cbfc5944d0cec7ac3e6b3bf53297e710220c4aaf`:

- Install: PASS
- Lint: PASS
- Typecheck: PASS
- Test: PASS
- Build: PASS

Deploy de produção Vercel do merge em `main`: READY. `/login` em produção: HTTP 200.

## Validação operacional pendente

O G00 exige Project Tasks + My Tasks + Kanban mínimo **validado em uso real** e Gate com **período de uso definido sem correções estruturais**. Implementação, CI e deploy não substituem essa evidência.

O protocolo operacional está registrado em `G04_VALIDACAO_CAMPO.md`: mínimo de 1 dia de uso operacional real, iniciando no primeiro uso autenticado em produção com tarefas reais de Project.

## Resultado atual

**PASS técnico. PASS operacional ainda não concedido.**

O próximo Gate não deve ser considerado formalmente aberto até a validação de campo do G04 ser concluída conforme G00.

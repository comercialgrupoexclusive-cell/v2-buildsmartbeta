# G04 — Tasks Campo

Status: **PASS técnico**

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

## Validação

GitHub Actions run `33292207462` no head `cbfc5944d0cec7ac3e6b3bf53297e710220c4aaf`:

- Install: PASS
- Lint: PASS
- Typecheck: PASS
- Test: PASS
- Build: PASS

## Resultado

Critério do gate atendido: o usuário autenticado possui acesso operacional a Project Tasks, My Tasks e Kanban mínimo usando a mesma Task canônica.

A validação final de produção deve confirmar o deploy Vercel do merge em `main` e o carregamento das rotas autenticadas.

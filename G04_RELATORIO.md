# G04 — Tasks Campo

Status: **PASS técnico / validação de campo pendente**

## Escopo canônico

G04 materializa o Task Core do G03 no uso de campo sem criar uma segunda entidade de tarefa: Project Tasks, My Tasks e Kanban mínimo são projeções da mesma `Task` ligada ao `Project`.

## Precedência canônica de referência

Correção aprovada em 30/08/2026 e registrada no G00 canônico:

1. **OpenConstructionERP é a referência sistêmica principal** para fluxo, navegação, onboarding, organização de módulos e comportamento integrado do BuildSmart.
2. Projetos maduros/pesquisas no GitHub entram depois para simplificar implementação, reduzir complexidade e validar alternativas técnicas.
3. Uso real do BuildSmart continua sendo o teste prático do produto.

Essa precedência deve ser aplicada nas próximas Gates; uma alternativa tecnicamente simples não pode alterar o fluxo sistêmico sem confronto explícito com a referência principal e o G00.

## Implementação de Tasks

- `/projects/[projectId]/tasks`: tarefas do Project.
- `/tasks/my`: tarefas atribuídas ao usuário autenticado.
- criação rápida com título, prioridade, responsável e prazo.
- Lista e Kanban mínimo sobre o mesmo conjunto de Tasks.
- mudança de estado reutiliza `TaskService` e `SupabaseTaskRepository` do G03.
- seletor de responsável limitado aos `project_memberships` visíveis por RLS.
- layout responsivo, com Kanban horizontalmente utilizável em telas estreitas.

## Desvio estrutural encontrado em campo

A primeira validação humana detectou um desvio de rota anterior ao próprio uso de Tasks:

- login e criação de conta estavam misturados e ambíguos;
- confirmação de e-mail caiu em `localhost:3000`;
- configuração inicial de Organization e criação de Project apareciam permanentemente dentro da tela operacional de Projects;
- o primeiro uso não seguia o princípio observado no OpenConstructionERP de separar autenticação, onboarding e entrada na área operacional.

O achado é classificado como **estrutural**, portanto impede o PASS operacional do G04.

## Correção de rota em implementação

A branch `v2-g04-auth-onboarding` separa o ciclo em:

`/login` → autenticação apenas

`/signup` → criação de conta apenas + confirmação explícita de e-mail

`/onboarding` → primeiro uso autenticado: Organization → primeiro Project

`/projects` → área operacional, sem formulário fixo de Organization

`/projects/new` → criação posterior de Project em rota própria

Usuário autenticado sem Organization acessível é enviado ao onboarding; usuário já configurado não refaz onboarding.

O signup passa `emailRedirectTo` usando a origem real do ambiente (`window.location.origin`) para não fixar localhost no código. A configuração hospedada de URL do Supabase Auth também deve apontar para a origem canônica de produção; isso é condição explícita antes da nova validação humana.

## Segurança e arquitetura

Nenhuma tabela paralela foi criada para Lista/Kanban/My Tasks. O G04 reutiliza integralmente RLS, permissões, Audit e invariantes do G03. A sessão autenticada continua sendo validada antes do carregamento da interface.

Organization → Project permanece o modelo canônico. Onboarding é fluxo de primeiro uso, não nova entidade de domínio.

## Contratos automatizados

`tests/g04-auth-onboarding-contract.test.ts` trava os seguintes invariantes:

- Login não pode executar `signUp`.
- Signup é rota própria e deve definir `emailRedirectTo` sem localhost fixo.
- Organization de primeiro uso pertence ao onboarding, não à tela normal de Projects.
- Projects deve enviar usuário não configurado para onboarding.
- criação posterior de Project pertence a `/projects/new`.

## Validação técnica anterior

GitHub Actions run `33292207462` no head `cbfc5944d0cec7ac3e6b3bf53297e710220c4aaf`:

- Install: PASS
- Lint: PASS
- Typecheck: PASS
- Test: PASS
- Build: PASS

A rodada estrutural atual será considerada tecnicamente pronta somente após novo CI completo e deploy de produção da correção.

## Validação operacional pendente

O G00 exige Project Tasks + My Tasks + Kanban mínimo **validado em uso real** e Gate com **período de uso definido sem correções estruturais**. Implementação, CI e deploy não substituem essa evidência.

O protocolo operacional continua em `G04_VALIDACAO_CAMPO.md`. O período de uso só recomeça depois que o fluxo de autenticação/onboarding corrigido estiver em produção e passar pelo primeiro uso real.

## Resultado atual

**G04 permanece aberto.**

PASS técnico da área de Tasks existe, mas o desvio estrutural de primeiro uso deve ser corrigido e revalidado antes de qualquer PASS operacional ou abertura formal do G05.

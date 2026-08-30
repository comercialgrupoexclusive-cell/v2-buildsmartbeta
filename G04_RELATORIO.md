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

## Correção canônica aplicada

O PR #6, mergeado em `main`, separa o ciclo em:

`/login` → autenticação apenas

`/signup` → criação de conta apenas + confirmação explícita de e-mail

`/onboarding` → primeiro uso autenticado: Organization → primeiro Project

`/projects` → área operacional, sem formulário fixo de Organization

`/projects/new` → criação posterior de Project em rota própria

Usuário autenticado sem Organization acessível é enviado ao onboarding; usuário já configurado não refaz onboarding.

O signup passa `emailRedirectTo` usando a origem real do ambiente (`window.location.origin`) para não fixar localhost no código.

## Bloqueio externo conhecido — Supabase Auth URL

O redirecionamento de confirmação de e-mail também depende da configuração hospedada do Supabase Auth. A `Site URL` e a lista de `Redirect URLs` precisam aceitar a origem canônica de produção `https://v2-buildsmartbeta.vercel.app`.

O conector Supabase disponível nesta execução não expõe escrita dessa configuração administrativa. Portanto, esse item **não é marcado como corrigido** até ser alterado/verificado no projeto Supabase. O G04 não volta para validação humana antes disso.

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

## Validação técnica

PR #6: CI completo PASS no run `33295019650`.

`main` após merge `0ec72a62a5be9962a407e7545d333643a81313b1`: CI completo PASS no run `33295069855`.

- Install: PASS
- Lint: PASS
- Typecheck: PASS
- Test: PASS
- Build: PASS

## Validação operacional pendente

O G00 exige Project Tasks + My Tasks + Kanban mínimo **validado em uso real** e Gate com **período de uso definido sem correções estruturais**. Implementação, CI e deploy não substituem essa evidência.

O protocolo operacional continua em `G04_VALIDACAO_CAMPO.md`. O período de uso só recomeça depois que o fluxo de autenticação/onboarding corrigido estiver em produção, a URL do Supabase Auth estiver correta e o primeiro uso real passar sem novo desvio estrutural.

## Resultado atual

**G04 permanece aberto.**

A correção estrutural de código está tecnicamente aprovada. O bloqueio externo da URL do Supabase Auth e a posterior validação real ainda impedem o PASS operacional e a abertura formal do G05.

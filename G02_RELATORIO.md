# G02 — Identidade — Relatório de execução

Status: **PASS técnico**  
Data: 30/08/2026

## Hipótese / objetivo

Implementar o Gate G02 já congelado no G00: Auth + Organization + Membership + Permissions + Project + Audit, mantendo **Project como raiz permanente do ciclo de vida** e comprovando isolamento entre organizações.

## Referência canônica

G00 aprovado:

- Organization → Project → ProjectMembership.
- Project é a raiz permanente do ciclo de vida de negócio.
- Obra/Construction é processo/capacidade do Project, não uma segunda entidade raiz.
- Project status inicial: ACTIVE, ON_HOLD, COMPLETED, ARCHIVED.
- ProjectMembership: MANAGER, EDITOR, VIEWER.
- autorização server-side + RLS em profundidade + Audit.

## Implementado

### Auth

- Supabase Auth como identidade canônica.
- Tela `/login` com sign-in e sign-up por e-mail/senha.
- sessão Supabase usada como autoridade de identidade; `user_id`, role e organization não são aceitos como autoridade vinda do cliente.

### Organization / Membership

- `organizations`.
- `organization_memberships`.
- papéis iniciais: OWNER, ADMIN, MEMBER.
- bootstrap atômico de Organization + OWNER via `create_organization()`.

### Project / Membership

- `projects`.
- `project_memberships`.
- status: ACTIVE, ON_HOLD, COMPLETED, ARCHIVED.
- papéis: MANAGER, EDITOR, VIEWER.
- código opcional e único dentro da Organization.
- bootstrap atômico de Project + MANAGER via `create_project()`.
- tela `/projects` mostra somente Organizations/Projects autorizados pelo RLS e permite criação mínima.

### Permissões / isolamento

- RLS habilitado em todas as tabelas centrais do G02.
- helpers privados para Membership e permissões.
- VIEWER: leitura sem escrita de Project.
- EDITOR/MANAGER: escrita autorizada conforme papel.
- OWNER/ADMIN: gestão da Organization.
- RPCs de bootstrap finais usam `SECURITY INVOKER`, preservando RLS; execução liberada apenas para `authenticated`.

### Audit

- `audit_logs` com Organization, Project, ator, ação, entidade, before/after, source e timestamp.
- triggers automáticos para Organization, OrganizationMembership, Project e ProjectMembership.
- alterações de status e demais updates relevantes dessas entidades deixam histórico automaticamente.

## Testes e evidências

### Supabase — cenário autenticado

Bootstrap atômico validado em transação descartável:

- Organization visível: 1.
- OWNER membership: 1.
- Project visível: 1.
- MANAGER membership: 1.
- Audit gerado: 4 registros.

### Supabase — isolamento negativo / IDOR

Usuário da Organization A contra dados da Organization B:

- Organizations visíveis para A: 1.
- Projects visíveis para A: 1.
- Project da Organization B visível para A: 0.
- updates cross-Organization permitidos: 0.

### Supabase — VIEWER

- Project autorizado visível ao VIEWER: sim.
- update de Project pelo VIEWER: bloqueado.

### Segurança

Supabase Security Advisor após hardening final: **0 lints**.

### CI

GitHub Actions run `33288311062` na branch `v2-g02-identity`:

- npm ci: PASS.
- lint: PASS.
- typecheck: PASS.
- tests: PASS.
- build: PASS.

O workflow foi generalizado para validar `main` e branches `v2-g**`.

## Falhas encontradas durante execução

1. Política inicial de bootstrap de Membership provocou recursão de RLS. Corrigida com helpers privados de creator, sem consulta recursiva à própria policy.
2. Trigger inicial de Audit de Organization executava cedo demais para a FK. Corrigido para `AFTER INSERT/UPDATE`.
3. RPCs inicialmente usavam `SECURITY DEFINER`; Security Advisor sinalizou privilégio elevado. Foram reescritas como `SECURITY INVOKER`.
4. `INSERT ... RETURNING` nas RPCs invoker exigia visibilidade da linha antes do Membership existir. Corrigido gerando UUID antes do insert, mantendo a transação atômica e o RLS.
5. `/projects` criava o cliente Supabase durante prerender e quebrava o build sem env no runner. Cliente passou a ser criado somente no runtime do navegador. CI final passou integralmente.

## Vercel

- A integração automática com a branch G02 está ativa.
- Um preview anterior da tela de login respondeu HTTP 200.
- O preview do commit final de código estava em fila no momento do fechamento deste relatório; isso não altera a evidência de CI e banco do Gate, mas deve ser rechecado antes/ao promover para produção.

## Dívida conhecida não criada pelo G02

- advisories do stack legado Next.js 14/dependências permanecem dívida já conhecida do G01; não executar `npm audit fix --force` dentro deste Gate sem decisão específica de upgrade.
- proteção de `main` e limpeza do projeto Vercel duplicado permanecem governança externa não bloqueante registrada anteriormente.

## Resultado

**G02 — PASS técnico.**

Critério do Gate comprovado: identidade autenticada integrada ao Supabase e isolamento entre Organizations/Projects demonstrado por RLS e testes negativos. O próximo Gate autorizado pelo plano canônico é **G03 — Tasks Core**.

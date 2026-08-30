# G04 — Rodada de Teste de Campo Assistida

Status: **correções implementadas / aguardando validação humana final**

## Achados reproduzidos

1. Produção renderizava a tela de login, mas o frontend não tinha a configuração pública do Supabase embutida no build. O clique falhava antes de chegar ao Auth.
2. A home pública apresentava `Entrar` e `Projetos` como ações equivalentes, criando ambiguidade sobre Viewer/acesso público.
3. O primeiro acesso não explicava a sequência Organization → Project.
4. A interface de Task oferecia transições de status que o domínio rejeitava para `COMPLETED` e `CANCELED`.

## Correções

- `.env.production` contém somente URL e publishable key públicas do Supabase V2; nenhum secret/service role foi adicionado.
- login captura e apresenta falhas de inicialização/conexão.
- texto do login explica cadastro e primeiro acesso.
- home pública possui uma única entrada: `Entrar no BuildSmart`.
- `/projects` apresenta onboarding explícito no primeiro acesso e bloqueia a criação de Project até existir Organization.
- UI de Task reutiliza `canTransitionTaskStatus`, a mesma regra do `TaskService`, e não oferece transições inválidas.

## Verificação automatizada

GitHub Actions run `33293444328` no commit `c626e75694d322b63fa64ab93c1867a9104bd66f`:

- Install: PASS
- Lint: PASS
- Typecheck: PASS
- Test: PASS
- Build: PASS

Foi acrescentado teste para garantir que as regras de transição exibidas no campo permanecem iguais às regras canônicas do domínio.

## Verificação integrada do fluxo de dados

No Supabase V2 foi executado um teste transacional descartável simulando um usuário `authenticated`:

Organization → Project → Task atribuída ao próprio usuário → `TO_DO` → `IN_PROGRESS` → projeção de My Tasks.

Resultado observado: `G04_FIELD_FLOW_PASS`, status `IN_PROGRESS`, `my_tasks=1`.

O teste foi forçado a abortar ao final e uma consulta posterior confirmou zero resíduos: 0 usuários, 0 Organizations de teste, 0 Projects de teste e 0 Tasks de teste.

## Deploy de preview

A branch `v2-g04-field-fixes` gerou preview Vercel READY após as correções.

## Limite desta rodada

A validação automatizada cobre build, domínio, RLS/fluxo integrado e deploy. O clique real em browser com uma sessão criada pelo Auth ainda é a validação humana final do gate, porque o ambiente não possui uma conta real persistente para assumir sem criar credenciais em nome do usuário.

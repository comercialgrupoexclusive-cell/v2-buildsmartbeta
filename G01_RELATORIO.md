# G01_RELATORIO.md — Fundação técnica BuildSmart V2

## Estado
PRONTO PARA REVISÃO (autoavaliação do executor — o PASS final depende do Product Owner).
G01.1 a G01.8 executados. Duas pendências externas ficaram registradas (Vercel Git link e
branch protection em `main`), detalhadas abaixo.

## Branch
`v2-g01-foundation`, neste repositório próprio `v2-buildsmartbeta`, separado do repositório da
V1 (`buildsmart-ai`). `main` não foi alterada — contém apenas o commit inicial (`README.md`)
até que o Product Owner aprove o merge.

### Histórico da decisão de repositório (para transparência)
O G01 foi iniciado em uma sessão anterior dentro do repositório `buildsmart-ai` (V1), na
subpasta `v2/`, porque o ambiente de execução só tinha acesso configurado aos repositórios da
V1 e a integração GitHub não tinha permissão para criar repositórios novos
(`mcp__github__create_repository` retornou `403 Resource not accessible by integration`).
O Product Owner então criou manualmente este repositório vazio
(`comercialgrupoexclusive-cell/v2-buildsmartbeta`) e autorizou o acesso a ele. O histórico de
`v2/` foi extraído com `git subtree split -P v2` (2 commits) e enviado para cá como a branch
`v2-g01-foundation`, restaurando o critério de isolamento de repositório da seção 9. Em
seguida, a subpasta `v2/` foi removida da branch de trabalho em `buildsmart-ai`, que volta a
conter apenas a V1.

## Ambiente (versões efetivamente instaladas)
- Node.js: v22.22.2
- npm: 10.9.7
- next: 14.2.35 (ver nota de segurança abaixo)
- react / react-dom: 18.3.1
- @supabase/supabase-js: ^2.112.4
- typescript: ^5.6.3
- tailwindcss: ^3.4.14
- vitest: ^2.1.4 / @testing-library/react: ^16.0.1
- eslint: ^8.57.1 / eslint-config-next: 14.2.35

## Alterações executadas

### G01.1 — Aplicação limpa
Aplicação Next.js 14 criada do zero, App Router, TypeScript estrito, Tailwind configurado,
página inicial mínima (`app/page.tsx`), sem nenhum código de negócio da V1.

### G01.2 — Estrutura mínima
```
app/                 → aplicação/UI (layout, page, estilos globais)
lib/supabase/         → infraestrutura de conexão (cliente Supabase)
supabase/             → configuração e migrations (Supabase CLI)
tests/                → testes
*.config.*, tsconfig  → configuração
```
Não existe pasta `components/` — não há nenhum componente compartilhado real ainda (a página
inicial é o único elemento de UI); criar a pasta vazia seria antecipar arquitetura
especulativa, o que o plano proíbe explicitamente (seção 6). Será criada quando o primeiro
componente compartilhado real existir (G02+).

### G01.5 — Supabase V2
Infraestrutura de conexão preparada, sem antecipar domínios funcionais:
- **Projeto Supabase físico criado** (o executor tinha acesso via MCP): nome `buildsmart-v2`,
  ref `csqkhuwdghhupktwpeth`, organização `rjyskceybloqqqvhpjzd`
  (`comercialgrupoexclusive-cell's Org`), região `sa-east-1`, status `ACTIVE_HEALTHY`, custo
  confirmado em R$0/mês (plano gratuito) antes da criação.
- URL do projeto: `https://csqkhuwdghhupktwpeth.supabase.co`
- `lib/supabase/client.ts`: cliente único, lê `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` do ambiente; lança erro claro se ausentes. Nenhuma
  Organization/Membership/Project/RLS funcional foi criada.
- `.env.example`: documenta as duas variáveis, sem valores reais.
- `.env.local` (gitignorado, não commitado): contém a URL real e a chave publicável/anon real
  do projeto, para uso local — confirmado fora do controle de versão.
- `supabase/config.toml` + `supabase/migrations/` (com `.gitkeep`): estrutura padrão do
  Supabase CLI para migrations dos Gates seguintes. Nenhuma migration de schema foi criada
  neste Gate.
- V1 e V2 seguem com projetos Supabase totalmente distintos — nenhum dado ou schema
  compartilhado.

### G01.6 — Vercel V2
Tentativa de criar o novo projeto Vercel exclusivo da V2 via MCP
(`comercialgrupoexclusive-7249's projects`, team `team_g9JK2TEQI4UwGtJAty9tR9a8`) apontando
para o repositório `buildsmart-ai` com `rootDirectory: v2` **falhou** (feita antes da migração
para este repositório): o vínculo Git não pôde ser verificado (404) e `list_projects`/
`get_project` confirmaram que nenhum projeto foi persistido. Causa provável: a integração/
GitHub App do Vercel não está autorizada para os repositórios desta conta.
**Pendência externa registrada:** o Product Owner (ou alguém com acesso ao painel Vercel)
precisa instalar/autorizar a integração do Vercel com o GitHub antes de criar o projeto
Vercel apontando para este repositório (`v2-buildsmartbeta`, root directory `.`). Nenhum
deploy, URL ou configuração foi inventado. Não reutilizamos nenhum projeto Vercel da V1.

### G01.7 — CI
Criado `.github/workflows/ci.yml` na raiz deste repositório. O workflow:
- dispara em `pull_request` contra `main` e em `push` para `v2-g01-foundation`, exatamente
  como pede a seção G01.7 do plano;
- executa, em sequência: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build` — os mesmos comandos validados localmente nesta rodada;
- não usa nenhum segredo (build básico não depende de credencial de produção, incluindo
  Supabase — o cliente só falha em runtime se importado sem env vars, e nenhuma página do G01
  o importa ainda).

**Branch protection em `main` — pendência externa registrada.** Nenhuma ferramenta disponível
nesta sessão (GitHub MCP) cobre configuração de branch protection rules. Fica pendente de
execução manual pelo Product Owner (Settings → Branches → Branch protection rules, neste
repositório, exigindo o check `CI / build`).

### G01.8 — Ambiente e segurança básica
- `.gitignore`: exclui `node_modules`, `.next/`, `.env*.local`/`.env.local`,
  `*.tsbuildinfo`, `next-env.d.ts`.
- `.env.example` existe e não contém valores reais.
- Busca por padrões de segredo (`sk-`, `api_key`, `secret`, `password`, `token`,
  `service_role`, `postgres://`, `supabase_access_token`) nos arquivos versionados: nenhum
  resultado. A única credencial real gerada (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, uma chave
  publicável, feita para ser exposta no cliente) está apenas em `.env.local`, fora do
  controle de versão.
- Lockfile `package-lock.json` versionado.
- Node fixado via CI (`actions/setup-node@v4`, versão 22, igual ao ambiente local).

## Comandos executados e resultados
| Comando | Resultado |
|---|---|
| `npm install` | OK — 532 pacotes instalados |
| `npx tsc --noEmit` (modo estrito) | OK — 0 erros |
| `npm run lint` (`eslint . --ext .ts,.tsx`) | OK — 0 erros, 0 warnings |
| `npm run test` (`vitest run`) | OK — 1 arquivo de teste, 1 teste passando |
| `npm run build` (`next build`) | OK — build de produção concluído, 2 rotas estáticas geradas |

## Testes (G01.4)
- Ferramenta: Vitest + @testing-library/react + jsdom
- Comando: `npm run test`
- Quantidade: 1 teste
- O que verifica: `tests/page.test.tsx` renderiza o componente real `app/page.tsx` (Home) e
  verifica que o elemento com `data-testid="app-title"` contém o texto "BuildSmart V2" — teste
  de comportamento real de render, não trivial.
- Resultado: 1 passed (1)

## Nota de segurança de dependências (Next.js)
`npm audit` aponta múltiplos advisories em `next` cujo intervalo de correção começa apenas na
major 15 (ex.: GHSA-c4j6-fc7j-m34r, GHSA-m99w-x7hq-7vfj, GHSA-89xv-2m56-2m9x — corrigidos só a
partir de `15.5.x`). A versão instalada, `14.2.35`, é o último patch publicado na linha 14.x
fixada pelo plano (seção 4). Não há patch 14.x disponível para essas vulnerabilidades. Fica
registrado como **dívida técnica conhecida** — decisão de migrar para 15.x (fora do escopo
deste Gate, que fixa 14.x) cabe ao Product Owner.

## Dependências instaladas — justificativa
Nenhuma biblioteca além da stack-base definida na seção 4 do plano, mais o cliente oficial do
Supabase (também parte da stack-base, seção 4: "Supabase"). Adições:
- `@supabase/supabase-js` — cliente oficial, exigido pelo G01.5.
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`,
  `jsdom` — infraestrutura de testes exigida pelo G01.4.
- `autoprefixer`, `postcss` — pré-requisitos diretos do Tailwind CSS.
- `eslint`, `eslint-config-next` — comando de lint exigido pelo G01.3.
- Tipos (`@types/*`) — apenas suporte a TypeScript estrito, sem runtime.

## Erros encontrados e correções durante a execução
- `npm run lint` inicialmente falhava com `ERR_MODULE_NOT_FOUND` quando o projeto ainda vivia
  dentro de `buildsmart-ai/v2/`, porque o ESLint 8 carregava o `eslint.config.mjs` (flat
  config) da V1 no diretório pai. Após a migração para este repositório próprio, o problema
  desapareceu naturalmente (não há mais configuração de outro projeto acima na árvore de
  diretórios) e o script `lint` foi simplificado de volta para `eslint . --ext .ts,.tsx`.
- `next@14.2.18` (versão inicialmente escolhida) apresentava vulnerabilidade crítica reportada
  pelo próprio `npm install`. Atualizado para `14.2.35`, último patch da série 14.x.
- Criação do projeto Vercel falhou na verificação do vínculo Git (ver G01.6) — registrado como
  pendência externa em vez de forçar uma alternativa (ex.: deploy manual de arquivos), que
  criaria um projeto desconectado do Git e fora do espírito de deploy contínuo.
- `mcp__github__create_repository` foi negado (403) para este executor — o repositório deste
  projeto foi criado manualmente pelo Product Owner, que em seguida autorizou o acesso.

## Dívida técnica criada
- Vulnerabilidades de `next` sem patch disponível na major 14.x (ver nota de segurança acima).

## Itens deliberadamente não implementados
- Login, autenticação funcional, Organization, Membership, RBAC, Project, e qualquer regra de
  negócio ou RLS funcional — proibidos neste Gate pela seção 6 do plano.
- Pasta `components/` — nenhum componente compartilhado real existe ainda.
- Migrations de schema do Supabase — pertencem aos Gates seguintes.

## Pendências externas (fora do controle do executor)
1. **Vercel:** autorizar a integração/GitHub App do Vercel para este repositório e criar o
   projeto `buildsmart-v2` (root directory `.`).
2. **Branch protection em `main`:** configurar manualmente exigindo o check `CI / build`,
   já que nenhuma ferramenta disponível nesta sessão cobre essa configuração.
3. **Merge para `main`:** este relatório e o código vivem em `v2-g01-foundation`; o merge para
   `main` só deve ocorrer após o PASS explícito do Product Owner (seção 10 do plano).

## Evidências para revisão
- Branch `v2-g01-foundation` neste repositório, com o histórico completo do G01 (originado em
  `buildsmart-ai/v2/` via `git subtree split`, preservando os commits das rodadas G01.1 e
  G01.2–G01.8).
- Saída de `npm run test`: `Test Files 1 passed (1)` / `Tests 1 passed (1)`.
- Saída de `npm run build`: build de produção concluído com sucesso, rotas `/` e `/_not-found`
  geradas estaticamente.
- Projeto Supabase `buildsmart-v2` (ref `csqkhuwdghhupktwpeth`) visível no dashboard da
  organização `comercialgrupoexclusive-cell's Org`.

## Autoavaliação do Gate
**PRONTO PARA REVISÃO**, com duas pendências externas explícitas (Vercel e branch protection).
Todos os critérios objetivos da seção 9 que dependem exclusivamente do executor foram
atendidos, incluindo o que antes estava pendente: **repositório V2 é próprio e separado do
repositório V1** (este repositório, `v2-buildsmartbeta`), trabalho em branch dedicada, `main`
não alterada, aplicação criada do zero, instalação/lint/testes/build passando, teste real não
trivial, CI criada e coerente com os checks locais, nenhuma dependência fora da stack-base sem
justificativa, `.env.example` existente, nenhum segredo commitado, integração base com
Supabase V2 preparada sem antecipar G02, V1 e V2 isoladas (repositório e banco), nenhum
domínio funcional antecipado. O PASS final depende da revisão e aprovação explícita do
Product Owner, incluindo a decisão sobre as pendências externas acima.

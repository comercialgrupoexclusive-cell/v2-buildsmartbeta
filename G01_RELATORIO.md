# G01_RELATORIO.md — Fundação técnica BuildSmart V2

## Estado
PRONTO PARA REVISÃO (autoavaliação do executor — o PASS final depende do Product Owner).
G01.1 a G01.8 executados. Uma pendência externa segue registrada (branch protection em
`main`), detalhada abaixo.

**Desvio adicional registrado (seção 3, item 9 do plano — "não alterar main"):** para permitir
que o projeto Vercel V2 (criado manualmente pelo Product Owner pelo dashboard, já que a
integração Vercel↔GitHub desta sessão não conseguiu vincular o repositório via API) exibisse a
aplicação real em vez de 404 — o deploy de produção do Vercel segue a branch `main` do
repositório por padrão, e `main` só tinha o commit inicial (placeholder `README.md`) —, o
Product Owner autorizou explicitamente o merge de `v2-g01-foundation` em `main` **neste
repositório** (`v2-buildsmartbeta`), únicamente para destravar a visualização do deploy. Isso é
diferente de `buildsmart-ai`, onde `main` contém a V1 em produção e nunca foi tocado. Como este
repositório é novo, sem nada em produção antes deste Gate, o risco do merge é baixo — mas fica
registrado como desvio explícito, não como parte do processo padrão do plano (que previa manter
`main` intocada até o PASS formal). Merge feito com `git merge --allow-unrelated-histories`
(único conflito: `README.md`, resolvido a favor da versão de `v2-g01-foundation`); lint,
typecheck, testes e build revalidados em `main` após o merge, todos passando.

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
Duas tentativas de criar o projeto Vercel via MCP falharam (uma apontando para
`buildsmart-ai` com `rootDirectory: v2`, antes da migração de repositório; outra já apontando
para `v2-buildsmartbeta`): em ambas o vínculo Git não pôde ser verificado (404 na chamada de
verificação) e `list_projects`/`get_project` confirmaram que nada foi persistido do lado da
integração usada por esta sessão — mesmo passando a apontar para o repositório certo. Os nomes
`buildsmart-v2` e `v2-buildsmartbeta` ficaram reservados/órfãos no Vercel por causa dessas
tentativas.

**Resolvido manualmente pelo Product Owner:** o Product Owner criou o projeto diretamente pelo
painel do Vercel (vercel.com/new), importando o repositório `v2-buildsmartbeta` — nesse fluxo o
GitHub já estava de fato conectado à conta Vercel (a integração via MCP desta sessão usa um
token/escopo diferente do da conta logada no navegador, por isso nunca enxergou os projetos
criados pelo Product Owner nem os criados por ela mesma). O primeiro deploy ficou em 404 porque
a branch de produção padrão (`main`) só tinha o placeholder inicial; resolvido fazendo merge de
`v2-g01-foundation` em `main` (ver desvio registrado no topo deste relatório). Projeto Vercel
ativo, deploy de produção a partir de `main`.

URL de deploy confirmada pelo Product Owner (após o merge para `main`):
`https://buildsmart-v2-67nokozta-comercialgrupoexclusive-7249s-projects.vercel.app/`
Não foi possível verificar esta URL programaticamente nesta sessão (a integração Vercel via
MCP não enxerga este projeto — mesmo problema de escopo de conta descrito acima — e o acesso
de rede direto a domínios `*.vercel.app` está bloqueado pelo proxy de saída desta sessão);
registrado com base na confirmação visual do Product Owner. Não reutilizamos nenhum projeto
Vercel da V1.

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
1. **Branch protection em `main`:** configurar manualmente exigindo o check `CI / build`,
   já que nenhuma ferramenta disponível nesta sessão cobre essa configuração.
2. **Merge para `main` já ocorreu** (ver desvio registrado no topo) — por autorização explícita
   do Product Owner, exclusivamente para destravar o deploy Vercel, e não porque o Gate G01
   recebeu PASS formal. Fica registrado para visibilidade na revisão final: o merge não
   representa aprovação do Gate, apenas a decisão pontual de liberar `main` neste repositório
   novo (sem nada em produção antes disso).

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
**PRONTO PARA REVISÃO**, com uma pendência externa explícita (branch protection) e dois desvios
registrados e autorizados pelo Product Owner (repositório único acessível na sessão original, e
merge antecipado para `main` neste repositório para destravar o Vercel). Critérios objetivos da
seção 9 atendidos: **repositório V2 é próprio e separado do repositório V1** (este repositório,
`v2-buildsmartbeta`), aplicação criada do zero, instalação/lint/testes/build passando (validado
tanto em `v2-g01-foundation` quanto em `main` pós-merge), teste real não trivial, CI criada e
coerente com os checks locais, nenhuma dependência fora da stack-base sem justificativa,
`.env.example` existente, nenhum segredo commitado, integração base com Supabase V2 preparada
sem antecipar G02, V1 e V2 isoladas (repositório e banco), nenhum domínio funcional antecipado,
projeto Vercel V2 criado e servindo a aplicação real (sem 404). O critério "`main` não
alterada" **não foi cumprido à risca** neste repositório — desvio pontual já registrado e
autorizado. O PASS final do Gate continua dependendo da revisão e aprovação explícita do
Product Owner.

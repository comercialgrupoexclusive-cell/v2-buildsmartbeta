# BuildSmart V2

Fundação técnica do BuildSmart V2, construída do zero e isolada da V1 (repositório
`buildsmart-ai`). Ver `G01_RELATORIO.md` para o estado do Gate G01.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha com as credenciais do Supabase V2
npm run dev
```

## Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run lint` | Lint (ESLint) |
| `npm run typecheck` | TypeScript em modo estrito |
| `npm run test` | Testes (Vitest) |
| `npm run build` | Build de produção |

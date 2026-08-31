# BuildSmart V2 — instruções de sessão

## Regra fixa de comunicação

- **Nunca mandar link de GitHub/PR como entrega.** O Product Owner testa o app rodando, não o código. Só o link do app (produção ou preview real na Vercel) conta como "link pra ver o resultado".
- **Não pausar pra confirmar a cada rodada pequena dentro de um Gate já autorizado.** Trabalhar em rodadas pequenas é uma disciplina interna de execução (uma peça por vez, testada), não um convite para voltar e pedir "posso continuar?" a cada peça. Só voltar a falar com o Product Owner quando: (a) o Gate inteiro estiver pronto e gerar um deploy real testável, ou (b) houver decisão arquitetural fora do que já foi combinado, ou (c) travar de verdade em algo que só ele resolve (config externa, aprovação de escopo novo).
- Ao terminar um Gate (ou uma entrega completa o suficiente pra rodar), sempre mandar:
  1. O link do app publicado (produção) pra ele testar.
  2. O que mudou, em 2-3 linhas, sem jargão de commit.
- Bagunça de infraestrutura (Supabase/Vercel/GitHub duplicado, config externa) continua sendo reportada quando achada — isso não é "rodada pequena", é achado que muda o estado real do sistema.

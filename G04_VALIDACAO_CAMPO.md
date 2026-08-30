# G04 — Validação de Campo

Status: **PENDENTE DE USO REAL**

## Motivo

O G00 define o Gate G04 como: Project Tasks + My Tasks + Kanban mínimo validado em uso real, com período de uso definido sem correções estruturais. A implementação, CI e deploy já passaram, mas isso não substitui validação operacional por usuário real.

## Período de validação

Período mínimo: **1 dia de uso operacional real**.

Critério de início: primeiro uso autenticado em produção com tarefas reais de Project.

Critério de PASS: durante o período, Project Tasks, My Tasks e Kanban mínimo devem ser usados sem necessidade de correção estrutural de domínio, persistência ou permissões. Ajustes exclusivamente visuais/ergonômicos não invalidam o Gate.

## Cenário mínimo

- acessar produção autenticado;
- usar pelo menos 1 Project real;
- criar tarefas reais;
- atribuir responsável e prazo;
- alterar estados pelo fluxo oficial;
- visualizar as mesmas tarefas em Project Tasks, My Tasks e Kanban;
- confirmar que não houve duplicação, perda de dados ou quebra de permissão.

## Evidências já concluídas

- implementação mergeada na `main`;
- CI completo verde;
- deploy Vercel de produção READY;
- `/login` em produção responde HTTP 200.

## Regra de fechamento

G04 só recebe PASS operacional após o período acima. Até lá, o status correto é **PASS técnico / validação de campo pendente**.

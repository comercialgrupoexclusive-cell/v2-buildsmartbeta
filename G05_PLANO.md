# BuildSmart V2 — G05_PLANO.md

## 1. Gate

**G05 — Orçamento**

Status inicial: **AUTORIZADO PARA EXECUÇÃO**

Origem: decisão do Product Owner de abrir o G05 sem aguardar o período de uso real definido em `G04_VALIDACAO_CAMPO.md`. Isso é uma exceção explícita ao protocolo do G00 ("somente PASS abre o próximo Gate") — registrada aqui, não silenciosa. G04 permanece com status **PASS técnico / validação de campo pendente**; a pendência não foi resolvida, apenas adiada por decisão do Product Owner.

Este arquivo é o contrato executivo do Gate.
O Claude deve executar somente o que está definido aqui e manter `G05_RELATORIO.md` atualizado com evidências reais.

---

## 2. Alvo do G05

Construir o módulo de **Orçamento** do BuildSmart V2: uma estrutura hierárquica de itens (linhas de orçamento) ligada ao Project, com preços vindos de uma base de custos própria da Organization, e um mecanismo simples de aprovação/versão.

O G05 **não implementa** Planejamento (G06), Execução/medição (G07), Suprimentos (G08) nem Financeiro (G09) — só a estrutura e o cálculo do orçamento em si.

---

## 3. Decisões já aprovadas e congeladas

1. **Referência funcional é o OpenConstructionERP (código atual), não a V1.** A V1 (`buildsmart-ai` / `orcamento-civil`) não é copiada como modelo — é só fonte de casos reais de falha, conforme a hierarquia de evidência do G00 (1. código atual + teste/live, 2. código atual, 3. documentação oficial, 4. hipótese).
2. Estrutura adotada do OpenConstructionERP (`backend/app/modules/boq/models.py`), **simplificada** para o estágio atual:
   - **Budget** (equivalente ao `BOQ`) — pertence a um Project; tem status (`draft` / `approved`) e um campo de revisão (`parent_budget_id`) para versionar sem duplicar tudo.
   - **BudgetItem** (equivalente à `Position`) — **árvore livre** (auto-referenciada por `parent_id`), não uma lista fixa de etapas. Cada nó tem descrição, unidade, quantidade, preço unitário e total.
   - **BudgetMarkup** (equivalente ao `BOQMarkup`) — linhas separadas de overhead/lucro/imposto, não um único percentual fixo.
   - **CostItem** ("composição"/`Assembly` simplificado) — item reutilizável da base de custos da Organization, com preço unitário; sem parâmetros, sem fatores regionais, sem templates de catálogo público neste Gate.
3. **Ficam de fora deste Gate** (não descartados — adiados para quando houver necessidade real comprovada, conforme regra de escopo do G00):
   - vínculo com BIM/modelos (`QuantityLink`);
   - export GAEB ou qualquer formato de intercâmbio de licitação;
   - `variation_request_id` / gestão de aditivos;
   - cost-spine e integração com Financeiro;
   - token de concorrência otimista (`version` / lock por linha);
   - templates de composição compartilhados entre Organizations.
4. O trabalho deve ocorrer na branch `v2-g05-budget`.
5. Não alterar `main` diretamente — merge só via PR, como nos Gates anteriores.
6. Nenhuma migração ou dado da V1 é copiado para o banco da V2.
7. Toda operação de escrita passa por Action/Service/Repository (Organization → Project → Budget), nunca direto do componente React ou de uma Tool de IA — mesma regra arquitetural do G02/G03.
8. RLS: um Budget e seus itens só são visíveis/editáveis por membros da Organization dona do Project, mesmo isolamento já validado em G02/G03.

---

## 4. Escopo obrigatório

### G05.1 — Base de custos da Organization (`CostItem`)
- CRUD de itens de custo: descrição, unidade, tipo (material/mão de obra/serviço), preço unitário.
- Pertence à Organization (não ao Project) — reutilizável entre Projects da mesma Organization.
- Sem categorias, sem catálogo público, sem import de planilha neste Gate.

### G05.2 — Budget e árvore de itens
- Criar Budget para um Project (um Budget "ativo" por vez é suficiente neste Gate; múltiplas versões lado a lado ficam para depois).
- CRUD de `BudgetItem` em árvore livre (criar filho de qualquer nó, mover, reordenar, excluir com os filhos).
- Um `BudgetItem` folha pode referenciar um `CostItem` (herda preço) ou ter preço/quantidade digitados manualmente.
- Cálculo automático: total do nó = quantidade × preço unitário (folha) ou soma dos filhos (nó pai).

### G05.3 — Markups
- CRUD de `BudgetMarkup` (nome, tipo percentual/fixo, categoria livre) aplicado sobre o total direto do Budget.
- Sem escopo por seção (`scope_position_id`/override) neste Gate — markup é sempre do Budget inteiro.

### G05.4 — Aprovação simples
- Budget em `draft` pode ser editado livremente.
- Ação explícita muda para `approved`; a partir daí some a edição direta (precisa duplicar para nova revisão, referenciando `parent_budget_id`).

### G05.5 — Testes
- Testes automatizados cobrindo: cálculo de totais em árvore (nó pai soma filhos), aplicação de markup, isolamento por Organization (RLS), transição draft→approved bloqueando edição.

---

## 5. O que NÃO fazer neste Gate

- Não implementar Planejamento, Execução, Suprimentos ou Financeiro (G06–G09).
- Não copiar a lista de 20 etapas fixas do `orcamento-civil` nem qualquer estrutura fixa de etapas da V1.
- Não implementar BIM-links, GAEB, variation requests, cost-spine ou versionamento por token de concorrência.
- Não criar catálogo de composições compartilhado entre Organizations.
- Não antecipar Luiza/Tools sobre o módulo de Orçamento (isso é G10).
- Não modificar `main` diretamente nem fazer merge sem PR.

---

## 6. Processo de execução do Claude

Mesma regra do G01/G02/G03: rodadas pequenas, no máximo um item da seção 4 (G05.1 a G05.5) por rodada.

Para cada rodada:
1. ler este arquivo;
2. verificar estado real da branch;
3. implementar o menor conjunto de mudanças necessário;
4. rodar lint/typecheck/test/build;
5. registrar resultado em `G05_RELATORIO.md`;
6. parar se encontrar decisão arquitetural não coberta por este plano.

Quando houver duas soluções equivalentes, preferir a mais simples, reversível e testável.

---

## 7. G05_RELATORIO.md — obrigatório

Criar `G05_RELATORIO.md` na raiz do repositório, mesma estrutura factual usada em G02/G03/G04 (estado, alterações, comandos executados, testes, evidências, dívida técnica, itens não implementados, autoavaliação).

Não escrever `PASS` final no relatório por conta própria — depende de revisão do Product Owner.

---

## 8. Critérios objetivos para considerar G05 pronto para revisão

- [ ] trabalho está em `v2-g05-budget`;
- [ ] `main` não foi alterada diretamente;
- [ ] CostItem, Budget, BudgetItem (árvore) e BudgetMarkup implementados e testados;
- [ ] cálculo de totais correto em pelo menos 3 níveis de árvore;
- [ ] RLS testada (Organization A não acessa Budget de Organization B);
- [ ] transição draft→approved bloqueia edição;
- [ ] lint, typecheck, test e build passam localmente e na CI;
- [ ] nenhuma referência à estrutura fixa de etapas da V1;
- [ ] nenhum dos itens da seção 5 foi antecipado;
- [ ] `G05_RELATORIO.md` contém evidências suficientes para revisão.

---

## 9. Gate de revisão

Quando o Claude considerar o G05 pronto: parar novas implementações, atualizar `G05_RELATORIO.md` integralmente, entregar diff/commits e evidências, e aguardar revisão do Product Owner. Somente após PASS explícito o G06 pode abrir.

---

## 10. Primeira instrução ao Claude

> Leia `G05_PLANO.md` integralmente. Trabalhe apenas na branch `v2-g05-budget`. Implemente o módulo de Orçamento (CostItem, Budget, BudgetItem em árvore livre, BudgetMarkup, aprovação simples) seguindo a estrutura simplificada do OpenConstructionERP descrita na seção 3, sem antecipar os itens da seção 5. Execute em rodadas pequenas, mantenha `G05_RELATORIO.md` factual e atualizado, rode lint/typecheck/test/build a cada rodada, e pare para revisão quando os critérios da seção 8 estiverem atendidos.

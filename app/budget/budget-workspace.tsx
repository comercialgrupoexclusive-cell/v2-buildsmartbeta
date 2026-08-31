'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { SupabaseBudgetRepository } from '@/lib/budget/repository';
import { BudgetService, buildItemTree, computeNodeTotal, type BudgetItemNode } from '@/lib/budget/service';
import type { Budget, BudgetMarkup, BudgetRevision, CostItem, CostItemType } from '@/lib/budget/types';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const COST_ITEM_TYPE_LABEL: Record<CostItemType, string> = { MATERIAL: 'Material', LABOR: 'Mão de obra', SERVICE: 'Serviço' };

function ItemRow({
  node, depth, onAddChild, onRemove, disabled,
}: {
  node: BudgetItemNode; depth: number; onAddChild: (parentId: string) => void; onRemove: (id: string) => void; disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 border-b py-2" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button type="button" className="w-5 text-gray-500" onClick={() => setExpanded((v) => !v)} aria-label="Expandir">
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{node.description}</p>
          {!hasChildren ? <p className="text-xs text-gray-500">{node.quantity} {node.unit ?? ''} × {formatMoney(node.unitPrice)}</p> : null}
        </div>
        <p className="shrink-0 text-sm font-semibold">{formatMoney(computeNodeTotal(node))}</p>
        {!disabled ? (
          <div className="flex shrink-0 gap-1">
            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => onAddChild(node.id)}>+ item</button>
            <button type="button" className="rounded border px-2 py-1 text-xs text-red-600" onClick={() => onRemove(node.id)}>x</button>
          </div>
        ) : null}
      </div>
      {expanded && hasChildren
        ? node.children.map((child) => (
            <ItemRow key={child.id} node={child} depth={depth + 1} onAddChild={onAddChild} onRemove={onRemove} disabled={disabled} />
          ))
        : null}
    </div>
  );
}

export default function BudgetWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [actorId, setActorId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [budget, setBudget] = useState<Budget | null>(null);
  const [items, setItems] = useState<BudgetItemNode[]>([]);
  const [markups, setMarkups] = useState<BudgetMarkup[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [revisions, setRevisions] = useState<BudgetRevision[]>([]);
  const [totals, setTotals] = useState({ direct: 0, final: 0 });

  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [selectedCostItemId, setSelectedCostItemId] = useState('');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [markupName, setMarkupName] = useState('');
  const [markupValue, setMarkupValue] = useState('');

  const [showCostItems, setShowCostItems] = useState(false);
  const [newCostDescription, setNewCostDescription] = useState('');
  const [newCostUnit, setNewCostUnit] = useState('');
  const [newCostType, setNewCostType] = useState<CostItemType>('MATERIAL');
  const [newCostPrice, setNewCostPrice] = useState('0');

  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionName, setRevisionName] = useState('');

  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) { router.replace('/login'); return; }
      setActorId(authData.user.id);

      const service = new BudgetService(new SupabaseBudgetRepository(supabase));
      const orgId = await service.getProjectOrganizationId(projectId);
      setOrganizationId(orgId);

      const activeBudget = await service.getOrCreateActiveBudget(projectId, authData.user.id, 'Orçamento');
      setBudget(activeBudget);

      const [flatItems, budgetMarkups, finalTotal, orgCostItems, budgetRevisions] = await Promise.all([
        service.listItems(activeBudget.id),
        service.listMarkups(activeBudget.id),
        service.getFinalTotal(activeBudget.id),
        service.listCostItems(orgId),
        service.listRevisions(projectId),
      ]);
      setItems(buildItemTree(flatItems));
      setMarkups(budgetMarkups);
      setTotals(finalTotal);
      setCostItems(orgCostItems);
      setRevisions(budgetRevisions);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar orçamento.');
    }
  }, [projectId, router]);

  useEffect(() => { void load(); }, [load]);

  function resetItemForm() {
    setDescription(''); setQuantity('1'); setUnitPrice('0'); setSelectedCostItemId(''); setAddingUnder(null);
  }

  function selectCostItem(costItemId: string) {
    setSelectedCostItemId(costItemId);
    const costItem = costItems.find((item) => item.id === costItemId);
    if (costItem) {
      setDescription(costItem.description);
      setUnitPrice(String(costItem.unitPrice));
    }
  }

  async function submitItem(event: FormEvent) {
    event.preventDefault();
    if (!budget) return;
    try {
      const service = new BudgetService(new SupabaseBudgetRepository(createBrowserSupabaseClient()));
      await service.addItem({
        budgetId: budget.id, parentId: addingUnder, costItemId: selectedCostItemId || null,
        description, quantity: Number(quantity) || 0, unitPrice: Number(unitPrice) || 0,
      });
      resetItemForm();
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao adicionar item.'); }
  }

  async function removeItem(itemId: string) {
    try {
      const service = new BudgetService(new SupabaseBudgetRepository(createBrowserSupabaseClient()));
      await service.removeItem(itemId);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao remover item.'); }
  }

  async function submitMarkup(event: FormEvent) {
    event.preventDefault();
    if (!budget) return;
    try {
      const service = new BudgetService(new SupabaseBudgetRepository(createBrowserSupabaseClient()));
      await service.addMarkup({ budgetId: budget.id, name: markupName, type: 'PERCENTAGE', value: Number(markupValue) || 0 });
      setMarkupName(''); setMarkupValue('');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao adicionar markup.'); }
  }

  async function submitCostItem(event: FormEvent) {
    event.preventDefault();
    if (!actorId || !organizationId) return;
    try {
      const service = new BudgetService(new SupabaseBudgetRepository(createBrowserSupabaseClient()));
      await service.createCostItem({
        organizationId, description: newCostDescription, unit: newCostUnit, type: newCostType,
        unitPrice: Number(newCostPrice) || 0, createdBy: actorId,
      });
      setNewCostDescription(''); setNewCostUnit(''); setNewCostPrice('0');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao cadastrar item de custo. Só quem administra a Organization pode cadastrar.');
    }
  }

  async function approveBudget() {
    if (!budget) return;
    try {
      const service = new BudgetService(new SupabaseBudgetRepository(createBrowserSupabaseClient()));
      await service.approve(budget.id);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao aprovar orçamento.'); }
  }

  async function submitRevision(event: FormEvent) {
    event.preventDefault();
    if (!budget) return;
    try {
      const service = new BudgetService(new SupabaseBudgetRepository(createBrowserSupabaseClient()));
      await service.createRevision(budget.id, revisionName);
      setRevisionName(''); setShowRevisionForm(false);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao criar revisão.'); }
  }

  if (!budget) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6 text-sm text-gray-500">Carregando orçamento...</main>;
  }

  const isDraft = budget.status === 'DRAFT';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col pb-24">
      <div className="sticky top-0 z-10 border-b bg-white p-4">
        <p className="text-sm font-medium text-gray-500">{isDraft ? 'Rascunho' : 'Aprovado'}</p>
        <h1 className="text-xl font-bold">{budget.name}</h1>
        <p className="mt-1 text-2xl font-semibold">{formatMoney(totals.final)}</p>
        {totals.final !== totals.direct ? (
          <p className="text-xs text-gray-500">Direto: {formatMoney(totals.direct)}</p>
        ) : null}
      </div>

      {message ? <p className="mx-4 mt-3 rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

      {!isDraft ? (
        <div className="mx-4 mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Este orçamento está aprovado e não pode mais ser editado.</p>
          <p className="mt-1 text-xs text-green-700">Para mudar algo, crie uma nova revisão — ela parte de uma cópia deste orçamento.</p>
          {!showRevisionForm ? (
            <button type="button" className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white" onClick={() => setShowRevisionForm(true)}>
              Criar nova revisão
            </button>
          ) : (
            <form className="mt-3 flex flex-col gap-2" onSubmit={submitRevision}>
              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Nome da revisão (ex: Revisão 2)" value={revisionName} onChange={(e) => setRevisionName(e.target.value)} required />
              <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white" type="submit">Confirmar</button>
            </form>
          )}
        </div>
      ) : null}

      {revisions.length > 1 ? (
        <div className="mx-4 mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Histórico de orçamentos deste projeto</p>
          <div className="mt-1 flex flex-col gap-1">
            {revisions.map((revision) => (
              <p key={revision.id} className="text-sm">
                <span className={revision.id === budget.id ? 'font-semibold' : ''}>{revision.name}</span>
                {' — '}
                <span className="text-gray-500">{revision.status === 'APPROVED' ? 'Aprovado' : 'Rascunho'} · {formatDate(revision.createdAt)}</span>
                {revision.id === budget.id ? <span className="ml-1 text-xs text-gray-400">(atual)</span> : null}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1 px-4">
        {items.length === 0 ? <p className="py-6 text-sm text-gray-500">Nenhum item ainda. Use o botão abaixo para adicionar.</p> : null}
        {items.map((node) => (
          <ItemRow key={node.id} node={node} depth={0} onAddChild={setAddingUnder} onRemove={removeItem} disabled={!isDraft} />
        ))}
      </div>

      {isDraft ? (
        <div className="mx-4 mt-6 flex flex-col gap-3 rounded-2xl border p-4">
          <button type="button" className="text-left text-sm font-medium underline underline-offset-4" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Ocultar markups' : 'Avançado: markups (BDI, taxas)'}
          </button>
          {showAdvanced ? (
            <div className="flex flex-col gap-3">
              {markups.map((markup) => (
                <p key={markup.id} className="text-sm">{markup.name} — {markup.value}%</p>
              ))}
              <form className="flex flex-col gap-2" onSubmit={submitMarkup}>
                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Nome (ex: BDI)" value={markupName} onChange={(e) => setMarkupName(e.target.value)} required />
                <input className="rounded-lg border px-3 py-2 text-sm" type="number" placeholder="% sobre o total" value={markupValue} onChange={(e) => setMarkupValue(e.target.value)} required />
                <button className="rounded-lg border px-4 py-2 text-sm" type="submit">Adicionar markup</button>
              </form>
            </div>
          ) : null}

          <button type="button" className="text-left text-sm font-medium underline underline-offset-4" onClick={() => setShowCostItems((v) => !v)}>
            {showCostItems ? 'Ocultar base de custos' : 'Avançado: base de custos da Organization'}
          </button>
          {showCostItems ? (
            <div className="flex flex-col gap-3">
              {costItems.length === 0 ? <p className="text-sm text-gray-500">Nenhum item de custo cadastrado ainda.</p> : null}
              {costItems.map((costItem) => (
                <p key={costItem.id} className="text-sm">
                  {costItem.description} — {COST_ITEM_TYPE_LABEL[costItem.type]} — {formatMoney(costItem.unitPrice)}/{costItem.unit}
                </p>
              ))}
              <form className="flex flex-col gap-2" onSubmit={submitCostItem}>
                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Descrição" value={newCostDescription} onChange={(e) => setNewCostDescription(e.target.value)} required />
                <div className="flex gap-2">
                  <input className="w-1/3 rounded-lg border px-3 py-2 text-sm" placeholder="Unidade (m², kg...)" value={newCostUnit} onChange={(e) => setNewCostUnit(e.target.value)} required />
                  <select className="w-1/3 rounded-lg border px-3 py-2 text-sm" value={newCostType} onChange={(e) => setNewCostType(e.target.value as CostItemType)}>
                    <option value="MATERIAL">Material</option>
                    <option value="LABOR">Mão de obra</option>
                    <option value="SERVICE">Serviço</option>
                  </select>
                  <input className="w-1/3 rounded-lg border px-3 py-2 text-sm" type="number" placeholder="Preço" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} required />
                </div>
                <button className="rounded-lg border px-4 py-2 text-sm" type="submit">Cadastrar item de custo</button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}

      {isDraft ? (
        <form className="fixed inset-x-0 bottom-16 mx-auto flex max-w-xl flex-col gap-2 border-t bg-white p-3" onSubmit={submitItem}>
          {addingUnder ? (
            <p className="text-xs text-gray-500">Adicionando dentro de um item existente. <button type="button" className="underline" onClick={() => setAddingUnder(null)}>cancelar</button></p>
          ) : null}
          {costItems.length > 0 ? (
            <select className="rounded-lg border px-3 py-2 text-sm" value={selectedCostItemId} onChange={(e) => selectCostItem(e.target.value)}>
              <option value="">Preço manual (ou escolha da base de custos)</option>
              {costItems.map((costItem) => (
                <option key={costItem.id} value={costItem.id}>{costItem.description} — {formatMoney(costItem.unitPrice)}/{costItem.unit}</option>
              ))}
            </select>
          ) : null}
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} required />
          <div className="flex gap-2">
            <input className="w-1/2 rounded-lg border px-3 py-2 text-sm" type="number" placeholder="Qtd" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <input className="w-1/2 rounded-lg border px-3 py-2 text-sm" type="number" placeholder="Preço unit." value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <button className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white" type="submit">+ Adicionar item</button>
        </form>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl border-t bg-white p-3">
        {isDraft ? (
          <button className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white" type="button" onClick={approveBudget}>
            Aprovar orçamento
          </button>
        ) : (
          <p className="text-center text-sm text-gray-500">Orçamento aprovado — use &quot;Criar nova revisão&quot; acima para editar</p>
        )}
      </div>
    </main>
  );
}

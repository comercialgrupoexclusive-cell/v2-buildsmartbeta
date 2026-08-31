'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { SupabaseBudgetRepository } from '@/lib/budget/repository';
import { BudgetService, buildItemTree, computeNodeTotal, type BudgetItemNode } from '@/lib/budget/service';
import type { Budget, BudgetMarkup } from '@/lib/budget/types';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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
          {!hasChildren ? <p className="text-xs text-gray-500">{node.quantity} × {formatMoney(node.unitPrice)}</p> : null}
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
  const [budget, setBudget] = useState<Budget | null>(null);
  const [items, setItems] = useState<BudgetItemNode[]>([]);
  const [markups, setMarkups] = useState<BudgetMarkup[]>([]);
  const [totals, setTotals] = useState({ direct: 0, final: 0 });
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [markupName, setMarkupName] = useState('');
  const [markupValue, setMarkupValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) { router.replace('/login'); return; }

      const service = new BudgetService(new SupabaseBudgetRepository(supabase));
      const activeBudget = await service.getOrCreateActiveBudget(projectId, authData.user.id, 'Orçamento');
      setBudget(activeBudget);

      const [flatItems, budgetMarkups, finalTotal] = await Promise.all([
        service.listItems(activeBudget.id),
        service.listMarkups(activeBudget.id),
        service.getFinalTotal(activeBudget.id),
      ]);
      setItems(buildItemTree(flatItems));
      setMarkups(budgetMarkups);
      setTotals(finalTotal);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar orçamento.');
    }
  }, [projectId, router]);

  useEffect(() => { void load(); }, [load]);

  async function submitItem(event: FormEvent) {
    event.preventDefault();
    if (!budget) return;
    try {
      const supabase = createBrowserSupabaseClient();
      const service = new BudgetService(new SupabaseBudgetRepository(supabase));
      await service.addItem({
        budgetId: budget.id, parentId: addingUnder,
        description, quantity: Number(quantity) || 0, unitPrice: Number(unitPrice) || 0,
      });
      setDescription(''); setQuantity('1'); setUnitPrice('0'); setAddingUnder(null);
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

  async function approveBudget() {
    if (!budget) return;
    try {
      const service = new BudgetService(new SupabaseBudgetRepository(createBrowserSupabaseClient()));
      await service.approve(budget.id);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao aprovar orçamento.'); }
  }

  if (!budget) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6 text-sm text-gray-500">Carregando orçamento...</main>;
  }

  const isDraft = budget.status === 'DRAFT';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col pb-24">
      <div className="sticky top-0 border-b bg-white p-4">
        <p className="text-sm font-medium text-gray-500">{isDraft ? 'Rascunho' : 'Aprovado'}</p>
        <h1 className="text-xl font-bold">{budget.name}</h1>
        <p className="mt-1 text-2xl font-semibold">{formatMoney(totals.final)}</p>
        {totals.final !== totals.direct ? (
          <p className="text-xs text-gray-500">Direto: {formatMoney(totals.direct)}</p>
        ) : null}
      </div>

      {message ? <p className="mx-4 mt-3 rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

      <div className="flex-1 px-4">
        {items.length === 0 ? <p className="py-6 text-sm text-gray-500">Nenhum item ainda. Use o botão abaixo para adicionar.</p> : null}
        {items.map((node) => (
          <ItemRow key={node.id} node={node} depth={0} onAddChild={setAddingUnder} onRemove={removeItem} disabled={!isDraft} />
        ))}
      </div>

      {isDraft ? (
        <div className="mx-4 mt-6 rounded-2xl border p-4">
          <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Ocultar avançado' : 'Avançado: markups (BDI, taxas)'}
          </button>
          {showAdvanced ? (
            <div className="mt-3 flex flex-col gap-3">
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
        </div>
      ) : null}

      {isDraft ? (
        <form className="fixed inset-x-0 bottom-16 mx-auto flex max-w-xl flex-col gap-2 border-t bg-white p-3" onSubmit={submitItem}>
          {addingUnder ? (
            <p className="text-xs text-gray-500">Adicionando dentro de um item existente. <button type="button" className="underline" onClick={() => setAddingUnder(null)}>cancelar</button></p>
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
          <p className="text-center text-sm text-gray-500">Orçamento aprovado — somente leitura</p>
        )}
      </div>
    </main>
  );
}

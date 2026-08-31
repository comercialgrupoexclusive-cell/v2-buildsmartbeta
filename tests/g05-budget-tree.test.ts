import { describe, expect, it } from "vitest";
import { buildItemTree, computeNodeTotal } from "@/lib/budget/service";
import type { BudgetItem } from "@/lib/budget/types";

function item(overrides: Partial<BudgetItem>): BudgetItem {
  return {
    id: "item", budgetId: "budget", parentId: null, costItemId: null,
    description: "item", unit: null, quantity: 0, unitPrice: 0, position: 0,
    ...overrides,
  };
}

describe("buildItemTree / computeNodeTotal", () => {
  it("monta árvore livre a partir de lista plana (sem etapas fixas)", () => {
    const items: BudgetItem[] = [
      item({ id: "root", parentId: null }),
      item({ id: "child-a", parentId: "root" }),
      item({ id: "child-b", parentId: "root" }),
    ];

    const tree = buildItemTree(items);
    const root = tree[0];

    expect(tree).toHaveLength(1);
    expect(root?.id).toBe("root");
    expect(root?.children.map((c) => c.id).sort()).toEqual(["child-a", "child-b"]);
  });

  it("calcula total de nó folha como quantidade × preço unitário", () => {
    const leaf = { ...item({ id: "leaf", quantity: 3, unitPrice: 100 }), children: [] };
    expect(computeNodeTotal(leaf)).toBe(300);
  });

  it("calcula total de nó pai como soma dos filhos, em pelo menos 3 níveis", () => {
    const items: BudgetItem[] = [
      item({ id: "root", parentId: null }),
      item({ id: "branch-a", parentId: "root" }),
      item({ id: "branch-b", parentId: "root", quantity: 3, unitPrice: 100 }), // folha: 300
      item({ id: "leaf-a1", parentId: "branch-a", quantity: 2, unitPrice: 50 }), // 100
      item({ id: "leaf-a2", parentId: "branch-a", quantity: 4, unitPrice: 25 }), // 100
    ];

    const [root] = buildItemTree(items);
    if (!root) throw new Error("expected root node");
    const branchA = root.children.find((c) => c.id === "branch-a");
    if (!branchA) throw new Error("expected branch-a node");

    expect(computeNodeTotal(branchA)).toBe(200);
    expect(computeNodeTotal(root)).toBe(500);
  });

  it("item órfão (parent_id apontando para item inexistente) vira raiz, não quebra a árvore", () => {
    const items: BudgetItem[] = [item({ id: "orphan", parentId: "does-not-exist" })];
    const tree = buildItemTree(items);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("orphan");
  });
});

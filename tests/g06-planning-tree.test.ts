import { describe, expect, it } from "vitest";
import { buildActivityTree, daysBetween } from "@/lib/planning/service";
import type { PlanningActivity } from "@/lib/planning/types";

function activity(overrides: Partial<PlanningActivity>): PlanningActivity {
  return {
    id: "a", projectId: "p1", parentId: null, name: "Atividade",
    plannedStartDate: "2026-09-01", plannedEndDate: "2026-09-02", durationDays: 1,
    status: "NOT_STARTED", position: 0,
    ...overrides,
  };
}

describe("buildActivityTree", () => {
  it("monta árvore livre a partir de lista plana", () => {
    const flat = [
      activity({ id: "root", parentId: null }),
      activity({ id: "child", parentId: "root" }),
    ];

    const tree = buildActivityTree(flat);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("root");
    expect(tree[0]?.children[0]?.id).toBe("child");
  });

  it("trata item com parent_id órfão como raiz (não quebra a árvore)", () => {
    const flat = [activity({ id: "orphan", parentId: "nao-existe" })];

    const tree = buildActivityTree(flat);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("orphan");
  });
});

describe("daysBetween", () => {
  it("calcula dias corridos entre duas datas ISO", () => {
    expect(daysBetween("2026-09-01", "2026-09-05")).toBe(4);
  });

  it("retorna 0 quando início e fim são o mesmo dia", () => {
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
  });
});

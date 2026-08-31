import { describe, expect, it } from "vitest";
import { computeCpm, CycleError } from "@/lib/planning/cpm";

describe("computeCpm", () => {
  it("calcula ES/EF/LS/LF/folga/crítico contra uma rede conhecida (verificado à mão)", () => {
    // A(3) -> B(2) -> D(1)
    // A(3) -> C(4) -> D(1)
    // Caminho crítico esperado: A -> C -> D (folga 0); B tem folga 2.
    const activities = [
      { id: "A", durationDays: 3 },
      { id: "B", durationDays: 2 },
      { id: "C", durationDays: 4 },
      { id: "D", durationDays: 1 },
    ];
    const dependencies = [
      { predecessorId: "A", successorId: "B", type: "FS" as const, lagDays: 0 },
      { predecessorId: "A", successorId: "C", type: "FS" as const, lagDays: 0 },
      { predecessorId: "B", successorId: "D", type: "FS" as const, lagDays: 0 },
      { predecessorId: "C", successorId: "D", type: "FS" as const, lagDays: 0 },
    ];

    const result = computeCpm(activities, dependencies);
    const byId = Object.fromEntries(result.map((r) => [r.id, r]));

    expect(byId.A).toMatchObject({ earlyStart: 0, earlyFinish: 3, lateStart: 0, lateFinish: 3, totalFloat: 0, isCritical: true });
    expect(byId.B).toMatchObject({ earlyStart: 3, earlyFinish: 5, lateStart: 5, lateFinish: 7, totalFloat: 2, isCritical: false });
    expect(byId.C).toMatchObject({ earlyStart: 3, earlyFinish: 7, lateStart: 3, lateFinish: 7, totalFloat: 0, isCritical: true });
    expect(byId.D).toMatchObject({ earlyStart: 7, earlyFinish: 8, lateStart: 7, lateFinish: 8, totalFloat: 0, isCritical: true });
  });

  it("respeita lag em dependências FS", () => {
    const activities = [
      { id: "A", durationDays: 2 },
      { id: "B", durationDays: 2 },
    ];
    const dependencies = [{ predecessorId: "A", successorId: "B", type: "FS" as const, lagDays: 3 }];

    const result = computeCpm(activities, dependencies);
    const b = result.find((r) => r.id === "B")!;

    expect(b.earlyStart).toBe(5); // EF(A)=2 + lag 3
  });

  it("calcula sub-redes desconectadas independentemente, cada uma a partir de ES=0", () => {
    const activities = [
      { id: "A", durationDays: 2 },
      { id: "B", durationDays: 5 },
    ];

    const result = computeCpm(activities, []);
    const byId = Object.fromEntries(result.map((r) => [r.id, r]));

    expect(byId.A?.earlyStart).toBe(0);
    expect(byId.B?.earlyStart).toBe(0);
  });

  it("detecta ciclo e lança CycleError em vez de calcular algo errado", () => {
    const activities = [
      { id: "A", durationDays: 1 },
      { id: "B", durationDays: 1 },
    ];
    const dependencies = [
      { predecessorId: "A", successorId: "B", type: "FS" as const, lagDays: 0 },
      { predecessorId: "B", successorId: "A", type: "FS" as const, lagDays: 0 },
    ];

    expect(() => computeCpm(activities, dependencies)).toThrow(CycleError);
  });
});

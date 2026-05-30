import { useMemo, useState } from "react";
import type { WkDesignChapterSpec, WkParityPage, WkQaCheck } from "../../../../design-system/designSystemSpec";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";

interface QAGatesProps {
  parityMap: WkParityPage[];
  chapters: WkDesignChapterSpec[];
  globalQaGates: WkQaCheck[];
}

export function QAGates({ parityMap, chapters, globalQaGates }: QAGatesProps) {
  const [mode, setMode] = useState<"route" | "global">("route");
  const [selectedRoute, setSelectedRoute] = useState<string>(
    parityMap[0]?.route || ""
  );
  const [routeGates, setRouteGates] = useState<Record<string, Record<string, boolean>>>(
    () => {
      const initial: Record<string, Record<string, boolean>> = {};
      for (const p of parityMap) {
        initial[p.route] = {};
        for (const checkId of p.qaChecks) {
          initial[p.route][checkId] = false;
        }
        for (const g of globalQaGates) {
          initial[p.route][g.id] = false;
        }
      }
      return initial;
    }
  );

  const chapterLookup = useMemo(() => {
    const map: Record<string, WkDesignChapterSpec> = {};
    for (const c of chapters) map[c.id] = c;
    return map;
  }, [chapters]);

  const chapterByNumber = useMemo(() => {
    const map: Record<string, WkDesignChapterSpec> = {};
    for (const c of chapters) map[c.number] = c;
    return map;
  }, [chapters]);

  const toggleGate = (route: string, checkId: string) => {
    setRouteGates((prev) => ({
      ...prev,
      [route]: {
        ...prev[route],
        [checkId]: !prev[route]?.[checkId],
      },
    }));
  };

  const selectedRouteData = parityMap.find((p) => p.route === selectedRoute);
  const selectedGates = routeGates[selectedRoute] || {};

  // Collect all chapter-level qa checks for this route
  const chapterQaChecks = useMemo((): WkQaCheck[] => {
    if (!selectedRouteData) return [];
    const seen = new Set<string>();
    const checks: WkQaCheck[] = [];
    for (const chNum of selectedRouteData.chapters) {
      const ch = chapterByNumber[chNum];
      if (!ch) continue;
      for (const qc of ch.qaChecks) {
        if (!seen.has(qc.id)) {
          seen.add(qc.id);
          checks.push(qc);
        }
      }
    }
    return checks;
  }, [selectedRouteData, chapterByNumber]);

  const allChecksForRoute = [...globalQaGates, ...chapterQaChecks];
  const passCount = allChecksForRoute.filter((g) => selectedGates[g.id]).length;
  const totalCount = allChecksForRoute.length;
  const allPassed = passCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setMode("route")}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
            mode === "route"
              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
              : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
          }`}
        >
          Per-route QA
        </button>
        <button
          onClick={() => setMode("global")}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
            mode === "global"
              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
              : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
          }`}
        >
          Global gates
        </button>
      </div>

      {mode === "global" && (
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--wk-text-muted)]">
            These gates apply to every route without exception.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {globalQaGates.map((gate) => (
              <WkSurface key={gate.id} className="p-4">
                <div className="mb-1 text-[13px] font-bold text-[var(--wk-text)]">
                  {gate.label}
                </div>
                <div className="mb-2 text-[12px] text-[var(--wk-text-muted)]">
                  {gate.description}
                </div>
                <code className="font-mono text-[10px] text-[var(--wk-text-faint)]">
                  {gate.id}
                </code>
              </WkSurface>
            ))}
          </div>
        </div>
      )}

      {mode === "route" && (
        <div className="space-y-5">
          {/* Route picker */}
          <div className="flex flex-wrap gap-2">
            {parityMap.map((p) => {
              const gates = routeGates[p.route] || {};
              const passedForRoute = Object.values(gates).filter(Boolean).length;
              const totalForRoute = Object.keys(gates).length;
              const pct = totalForRoute > 0 ? Math.round((passedForRoute / totalForRoute) * 100) : 0;
              return (
                <button
                  key={p.route}
                  onClick={() => setSelectedRoute(p.route)}
                  className={`flex flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-all ${
                    selectedRoute === p.route
                      ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                      : "border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  <span className="text-[13px] font-semibold">{p.route}</span>
                  <span className="text-[11px] text-[var(--wk-text-faint)]">{pct}% passed</span>
                </button>
              );
            })}
          </div>

          {selectedRouteData && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-[15px] font-bold text-[var(--wk-text)]">
                    {selectedRouteData.route}
                  </div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">
                    {selectedRouteData.archetype}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <WkTag variant={allPassed ? "brand" : "default"}>
                    {passCount} / {totalCount} passed
                  </WkTag>
                  {allPassed && (
                    <WkTag variant="brand">
                      <i className="ri-check-double-line" />
                      Ready to ship
                    </WkTag>
                  )}
                </div>
              </div>

              {/* Global gates for this route */}
              <section className="mb-5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Global gates
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {globalQaGates.map((gate) => {
                    const passed = selectedGates[gate.id] || false;
                    return (
                      <GateRow
                        key={gate.id}
                        gate={gate}
                        passed={passed}
                        onToggle={() => toggleGate(selectedRoute, gate.id)}
                      />
                    );
                  })}
                </div>
              </section>

              {/* Chapter-specific qa checks */}
              {chapterQaChecks.length > 0 && (
                <section>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                    Chapter-specific checks ({chapterQaChecks.length})
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {chapterQaChecks.map((gate) => {
                      const passed = selectedGates[gate.id] || false;
                      return (
                        <GateRow
                          key={gate.id}
                          gate={gate}
                          passed={passed}
                          onToggle={() => toggleGate(selectedRoute, gate.id)}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface GateRowProps {
  gate: WkQaCheck;
  passed: boolean;
  onToggle: () => void;
}

function GateRow({ gate, passed, onToggle }: GateRowProps) {
  return (
    <WkSurface
      className={`p-3 transition-all ${
        passed
          ? "border-[var(--wk-success)] bg-[var(--wk-success-soft)]"
          : "border-[var(--wk-border)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
            passed
              ? "border-[var(--wk-success)] bg-[var(--wk-success)] text-white"
              : "border-[var(--wk-border-2)]"
          }`}
        >
          {passed && <i className="ri-check-line text-xs font-bold" />}
        </button>
        <div>
          <div className="text-[13px] font-bold text-[var(--wk-text)]">
            {gate.label}
          </div>
          <div className="text-[12px] text-[var(--wk-text-muted)]">
            {gate.description}
          </div>
          <code className="mt-0.5 block font-mono text-[10px] text-[var(--wk-text-faint)]">
            {gate.id}
          </code>
        </div>
      </div>
    </WkSurface>
  );
}
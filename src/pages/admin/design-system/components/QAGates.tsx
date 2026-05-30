import { useState } from "react";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";

const QA_GATES = [
  {
    id: "data-backed",
    label: "Data-backed",
    description: "All data comes from graph or real API.",
    pass: false,
  },
  {
    id: "no-mock",
    label: "No mock data",
    description: "Production routes contain no mock/placeholder data.",
    pass: false,
  },
  {
    id: "token-compliance",
    label: "Token compliance",
    description: "All colors, spacing, and typography use design tokens.",
    pass: false,
  },
  {
    id: "mobile-behavior",
    label: "Mobile behavior",
    description: "Layout is intentional on mobile, not collapsed desktop.",
    pass: false,
  },
  {
    id: "accessibility",
    label: "Accessibility",
    description: "WCAG 2.2 AA compliance, semantic headings, aria labels.",
    pass: false,
  },
  {
    id: "voice-copy",
    label: "Voice / Copy",
    description: "Editorial tone, specific CTAs, no emoji or filler text.",
    pass: false,
  },
  {
    id: "empty-states",
    label: "Empty states",
    description: "Loading, empty, and error states are handled.",
    pass: false,
  },
  {
    id: "archetype-match",
    label: "Archetype match",
    description: "Page maps to a design-system archetype.",
    pass: false,
  },
];

interface QAGatesProps {
  parityMap: { route: string; archetype: string; chapters: string[] }[];
  chapters: { id: string; number: string; title: string; group: string }[];
}

export function QAGates({ parityMap }: QAGatesProps) {
  const [routeGates, setRouteGates] = useState<Record<string, Record<string, boolean>>>(() => {
    const initial: Record<string, Record<string, boolean>> = {};
    for (const p of parityMap) {
      initial[p.route] = {};
      for (const g of QA_GATES) {
        initial[p.route][g.id] = false;
      }
    }
    return initial;
  });

  const [selectedRoute, setSelectedRoute] = useState<string>(
    parityMap[0]?.route || "",
  );

  const toggleGate = (route: string, gateId: string) => {
    setRouteGates((prev) => ({
      ...prev,
      [route]: {
        ...prev[route],
        [gateId]: !prev[route]?.[gateId],
      },
    }));
  };

  const selectedGates = routeGates[selectedRoute] || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {parityMap.map((p) => (
          <button
            key={p.route}
            onClick={() => setSelectedRoute(p.route)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
              selectedRoute === p.route
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
            }`}
          >
            {p.route}
          </button>
        ))}
      </div>

      <div>
        <h3 className="mb-4 text-[15px] font-bold text-[var(--wk-text)]">
          {selectedRoute}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {QA_GATES.map((gate) => {
            const passed = selectedGates[gate.id] || false;
            return (
              <WkSurface
                key={gate.id}
                className={`p-4 transition-all ${
                  passed
                    ? "border-[var(--wk-success)] bg-[var(--wk-success-soft)]"
                    : "border-[var(--wk-border)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleGate(selectedRoute, gate.id)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                      passed
                        ? "border-[var(--wk-success)] bg-[var(--wk-success)] text-white"
                        : "border-[var(--wk-border-2)]"
                    }`}
                  >
                    {passed && (
                      <i className="ri-check-line text-xs font-bold" />
                    )}
                  </button>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">
                      {gate.label}
                    </div>
                    <div className="text-[12px] text-[var(--wk-text-muted)]">
                      {gate.description}
                    </div>
                  </div>
                </div>
              </WkSurface>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <WkTag
            variant={
              Object.values(selectedGates).every(Boolean)
                ? "brand"
                : "default"
            }
          >
            {Object.values(selectedGates).filter(Boolean).length} /{" "}
            {QA_GATES.length} passed
          </WkTag>
          {Object.values(selectedGates).every(Boolean) && (
            <WkTag variant="brand">
              <i className="ri-check-double-line" />
              Ready to ship
            </WkTag>
          )}
        </div>
      </div>
    </div>
  );
}
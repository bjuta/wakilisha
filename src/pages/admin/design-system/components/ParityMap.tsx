import { useMemo, useState } from "react";
import type { WkDesignChapterSpec, WkParityPage } from "../../../../design-system/designSystemSpec";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";

interface ParityMapProps {
  parityMap: WkParityPage[];
  chapters: WkDesignChapterSpec[];
}

export function ParityMap({ parityMap, chapters }: ParityMapProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const chapterLookup = useMemo(() => {
    const map: Record<string, WkDesignChapterSpec> = {};
    for (const c of chapters) map[c.number] = c;
    return map;
  }, [chapters]);

  const selectedRouteData = parityMap.find((p) => p.route === selectedRoute);
  const allQaCheckIds = selectedRouteData?.qaChecks ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parityMap.map((p) => {
          const isActive = p.route === selectedRoute;
          return (
            <button
              key={p.route}
              onClick={() => setSelectedRoute(isActive ? null : p.route)}
              className={`rounded-xl border bg-[var(--wk-surface)] p-4 text-left transition-all ${
                isActive
                  ? "border-[var(--wk-brand)]"
                  : "border-[var(--wk-border)] hover:border-[var(--wk-border-2)]"
              }`}
            >
              <div className="mb-1 font-mono text-[13px] font-bold text-[var(--wk-text)]">
                {p.route}
              </div>
              <div className="mb-2 text-[11px] text-[var(--wk-text-muted)]">
                {p.archetype}
              </div>
              <div className="flex flex-wrap gap-1">
                {p.chapters.slice(0, 4).map((n) => (
                  <WkTag key={n}>{n}</WkTag>
                ))}
                {p.chapters.length > 4 && (
                  <WkTag>+{p.chapters.length - 4}</WkTag>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-[var(--wk-text-faint)]">
                <i className="ri-checkbox-circle-line text-xs" />
                {p.qaChecks.length} QA checks
              </div>
            </button>
          );
        })}
      </div>

      {selectedRouteData && (
        <div className="space-y-4">
          <WkSurface className="p-5">
            <h3 className="mb-1 text-[15px] font-bold text-[var(--wk-text)]">
              {selectedRouteData.route}
            </h3>
            <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
              {selectedRouteData.archetype}
            </div>

            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Required design chapters
            </h4>
            <div className="space-y-2">
              {selectedRouteData.chapters.map((n) => {
                const ch = chapterLookup[n];
                if (!ch) return null;
                return (
                  <div
                    key={n}
                    className="flex items-start gap-3 rounded-lg border border-[var(--wk-border)] p-3"
                  >
                    <WkTag variant="brand">{n}</WkTag>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[var(--wk-text)]">
                        {ch.title}
                      </div>
                      <div className="text-[12px] text-[var(--wk-text-muted)]">
                        {ch.group}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </WkSurface>

          <WkSurface className="p-5">
            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Route-level QA gates ({allQaCheckIds.length})
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {allQaCheckIds.map((checkId) => (
                <div
                  key={checkId}
                  className="flex items-center gap-2 rounded-lg border border-[var(--wk-border)] p-2"
                >
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border-2)]" />
                  <code className="font-mono text-[11px] text-[var(--wk-text-soft)]">
                    {checkId}
                  </code>
                </div>
              ))}
            </div>
          </WkSurface>
        </div>
      )}
    </div>
  );
}
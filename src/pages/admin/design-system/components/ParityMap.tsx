import { useMemo, useState } from "react";
import type { WkDesignChapter } from "../../../../design-system/designSystemManifest";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";

interface ParityMapProps {
  parityMap: { route: string; archetype: string; chapters: string[] }[];
  chapters: WkDesignChapter[];
}

export function ParityMap({ parityMap, chapters }: ParityMapProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const chapterLookup = useMemo(() => {
    const map: Record<string, WkDesignChapter> = {};
    for (const c of chapters) map[c.number] = c;
    return map;
  }, [chapters]);

  const selectedRouteData = parityMap.find(
    (p) => p.route === selectedRoute,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parityMap.map((p) => {
          const isActive = p.route === selectedRoute;
          return (
            <button
              key={p.route}
              onClick={() =>
                setSelectedRoute(isActive ? null : p.route)
              }
              className={`rounded-xl border bg-[var(--wk-surface)] p-4 text-left transition-all ${
                isActive
                  ? "border-[var(--wk-brand)]"
                  : "border-[var(--wk-border)] hover:border-[var(--wk-border-2)]"
              }`}
            >
              <div className="mb-1 text-[13px] font-bold text-[var(--wk-text)]">
                {p.route}
              </div>
              <div className="text-[11px] text-[var(--wk-text-muted)]">
                {p.archetype}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.chapters.slice(0, 4).map((n) => (
                  <WkTag key={n}>{n}</WkTag>
                ))}
                {p.chapters.length > 4 && (
                  <WkTag>+{p.chapters.length - 4}</WkTag>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedRouteData && (
        <WkSurface className="p-5">
          <h3 className="mb-4 text-[15px] font-bold text-[var(--wk-text)]">
            {selectedRouteData.route} — {selectedRouteData.archetype}
          </h3>
          <div className="space-y-3">
            {selectedRouteData.chapters.map((n) => {
              const ch = chapterLookup[n];
              if (!ch) return null;
              return (
                <div
                  key={n}
                  className="flex items-start gap-3 rounded-lg border border-[var(--wk-border)] p-3"
                >
                  <WkTag variant="brand">{n}</WkTag>
                  <div>
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
      )}
    </div>
  );
}
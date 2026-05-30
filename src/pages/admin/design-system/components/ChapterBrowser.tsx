import { useMemo } from "react";
import type { WkDesignChapter } from "../../../../design-system/designSystemManifest";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";

interface ChapterBrowserProps {
  chapters: WkDesignChapter[];
  selectedChapter: WkDesignChapter | null;
  onSelectChapter: (id: string | null) => void;
  allChapters: WkDesignChapter[];
  parityMap: { route: string; archetype: string; chapters: string[] }[];
}

export function ChapterBrowser({
  chapters,
  selectedChapter,
  onSelectChapter,
  allChapters,
  parityMap,
}: ChapterBrowserProps) {
  const chaptersByGroup = useMemo(() => {
    const map: Record<string, WkDesignChapter[]> = {};
    for (const c of chapters) {
      if (!map[c.group]) map[c.group] = [];
      map[c.group].push(c);
    }
    return map;
  }, [chapters]);

  if (selectedChapter) {
    const parityRoutes = parityMap.filter((p) =>
      p.chapters.includes(selectedChapter.number),
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <WkTag variant="brand">{selectedChapter.number}</WkTag>
          <WkTag>{selectedChapter.group}</WkTag>
          <button
            onClick={() => onSelectChapter(null)}
            className="ml-auto rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
          >
            Back to list
          </button>
        </div>

        <h2 className="text-2xl font-black tracking-tight text-[var(--wk-text)]">
          {selectedChapter.title}
        </h2>
        <p className="text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
          {selectedChapter.purpose}
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <WkSurface className="p-5">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Implementation Rules
            </h3>
            <ul className="space-y-2">
              {selectedChapter.implementationRules.map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--wk-text-soft)]"
                >
                  <i className="ri-check-line mt-0.5 shrink-0 text-[var(--wk-brand)]" />
                  {rule}
                </li>
              ))}
            </ul>
          </WkSurface>

          <WkSurface className="p-5">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Parity Targets
            </h3>
            <ul className="space-y-2">
              {selectedChapter.parityTargets.map((target, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--wk-text-soft)]"
                >
                  <i className="ri-focus-3-line mt-0.5 shrink-0 text-[var(--wk-brand)]" />
                  {target}
                </li>
              ))}
            </ul>
          </WkSurface>
        </div>

        {parityRoutes.length > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Routes using this chapter
            </h3>
            <div className="flex flex-wrap gap-2">
              {parityRoutes.map((p) => (
                <WkTag key={p.route} variant="brand">
                  {p.route}
                </WkTag>
              ))}
            </div>
          </WkSurface>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(chaptersByGroup).map(([group, groupChapters]) => (
        <div key={group}>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            {group}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupChapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => onSelectChapter(chapter.id)}
                className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 text-left transition-all hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <WkTag variant="brand">{chapter.number}</WkTag>
                  <i className="ri-arrow-right-line text-[var(--wk-text-faint)] opacity-0 transition-all group-hover:opacity-100" />
                </div>
                <h4 className="mb-1 text-[15px] font-bold text-[var(--wk-text)]">
                  {chapter.title}
                </h4>
                <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                  {chapter.purpose}
                </p>
                <div className="mt-3 flex items-center gap-1">
                  <i className="ri-file-list-line text-[11px] text-[var(--wk-text-faint)]" />
                  <span className="text-[11px] text-[var(--wk-text-faint)]">
                    {chapter.implementationRules.length} rules
                  </span>
                  <span className="text-[11px] text-[var(--wk-text-faint)]">
                    ·
                  </span>
                  <i className="ri-route-line text-[11px] text-[var(--wk-text-faint)]" />
                  <span className="text-[11px] text-[var(--wk-text-faint)]">
                    {
                      parityMap.filter((p) =>
                        p.chapters.includes(chapter.number),
                      ).length
                    }{" "}
                    routes
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {chapters.length === 0 && (
        <div className="py-16 text-center text-[var(--wk-text-muted)]">
          <i className="ri-search-line mb-3 block text-4xl" />
          No chapters match your search.
        </div>
      )}
    </div>
  );
}
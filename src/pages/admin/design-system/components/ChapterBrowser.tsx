import { useMemo } from "react";
import type { WkDesignChapterSpec, WkParityPage } from "../../../../design-system/designSystemSpec";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";
import { CanonicalChapterDetail } from "./CanonicalChapterDetail";

interface ChapterBrowserProps {
  chapters: WkDesignChapterSpec[];
  selectedChapter: WkDesignChapterSpec | null;
  onSelectChapter: (id: string | null) => void;
  allChapters: WkDesignChapterSpec[];
  parityMap: WkParityPage[];
}

export function ChapterBrowser({
  chapters,
  selectedChapter,
  onSelectChapter,
  parityMap,
}: ChapterBrowserProps) {
  const chaptersByGroup = useMemo(() => {
    const map: Record<string, WkDesignChapterSpec[]> = {};
    for (const c of chapters) {
      if (!map[c.group]) map[c.group] = [];
      map[c.group].push(c);
    }
    return map;
  }, [chapters]);

  if (selectedChapter) {
    return (
      <ChapterDetail
        chapter={selectedChapter}
        parityMap={parityMap}
        onBack={() => onSelectChapter(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(chaptersByGroup).map(([group, groupChapters]) => (
        <div key={group}>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
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
                  {chapter.summary}
                </p>
                {chapter.canonical && (
                  <div className="mt-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                      Canonical depth
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <MiniMetric value={chapter.canonical.canonicalSubsections.length} label="Sections" />
                      <MiniMetric value={chapter.canonical.richMedia.length} label="Visuals" />
                      <MiniMetric value={chapter.canonical.canonicalMetrics.tables} label="Tables" />
                    </div>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-1">
                  <div className="flex items-center gap-1">
                    <i className="ri-file-list-line text-[11px] text-[var(--wk-text-faint)]" />
                    <span className="text-[11px] text-[var(--wk-text-faint)]">
                      {chapter.implementationRules.length} rules
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="ri-stack-line text-[11px] text-[var(--wk-text-faint)]" />
                    <span className="text-[11px] text-[var(--wk-text-faint)]">
                      {chapter.componentsRequired.length} components
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="ri-checkbox-circle-line text-[11px] text-[var(--wk-text-faint)]" />
                    <span className="text-[11px] text-[var(--wk-text-faint)]">
                      {chapter.qaChecks.length} QA checks
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="ri-route-line text-[11px] text-[var(--wk-text-faint)]" />
                    <span className="text-[11px] text-[var(--wk-text-faint)]">
                      {parityMap.filter((p) => p.chapters.includes(chapter.number)).length} routes
                    </span>
                  </div>
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

function MiniMetric({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="text-[15px] font-black leading-none text-[var(--wk-text)]">{value}</div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">
        {label}
      </div>
    </div>
  );
}

interface ChapterDetailProps {
  chapter: WkDesignChapterSpec;
  parityMap: WkParityPage[];
  onBack: () => void;
}

function ChapterDetail({ chapter, parityMap, onBack }: ChapterDetailProps) {
  const parityRoutes = parityMap.filter((p) => p.chapters.includes(chapter.number));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <WkTag variant="brand">{chapter.number}</WkTag>
        <WkTag>{chapter.group}</WkTag>
        {chapter.canonical && <WkTag>Canonical source: {chapter.canonical.canonicalAnchor}</WkTag>}
        <button
          onClick={onBack}
          className="ml-auto rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
        >
          Back to chapters
        </button>
      </div>

      <h2 className="text-2xl font-black tracking-tight text-[var(--wk-text)]">
        {chapter.title}
      </h2>

      <CanonicalChapterDetail chapter={chapter} />

      {/* Summary */}
      <WkSurface className="p-5">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
          Summary
        </h3>
        <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
          {chapter.summary}
        </p>
      </WkSurface>

      {/* Admin sections */}
      {chapter.adminSections.length > 0 && (
        <WkSurface className="p-5">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Admin sections in scope
          </h3>
          <div className="flex flex-wrap gap-2">
            {chapter.adminSections.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-3 py-1 text-[12px] text-[var(--wk-text-soft)]"
              >
                {s}
              </span>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Implementation rules */}
      <WkSurface className="p-5">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
          Implementation rules
        </h3>
        <ul className="space-y-2">
          {chapter.implementationRules.map((rule, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--wk-text-soft)]"
            >
              <i className="ri-checkbox-blank-circle-fill mt-1 shrink-0 text-[8px] text-[var(--wk-brand)]" />
              {rule}
            </li>
          ))}
        </ul>
      </WkSurface>

      {/* Parity targets */}
      <WkSurface className="p-5">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
          Parity targets
        </h3>
        <ul className="space-y-2">
          {chapter.parityTargets.map((target, i) => (
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

      {/* Components required + Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {chapter.componentsRequired.length > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Components required
            </h3>
            <div className="flex flex-wrap gap-2">
              {chapter.componentsRequired.map((c) => (
                <code
                  key={c}
                  className="rounded border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 font-mono text-[11px] text-[var(--wk-brand)]"
                >
                  {c}
                </code>
              ))}
            </div>
          </WkSurface>
        )}

        {chapter.tables.length > 0 && (
          <WkSurface className="p-5">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Tables / data sources
            </h3>
            <div className="flex flex-wrap gap-2">
              {chapter.tables.map((t) => (
                <code
                  key={t}
                  className="rounded border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 font-mono text-[11px] text-[var(--wk-text-soft)]"
                >
                  {t}
                </code>
              ))}
            </div>
          </WkSurface>
        )}
      </div>

      {/* QA checks */}
      {chapter.qaChecks.length > 0 && (
        <WkSurface className="p-5">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            QA checks for this chapter
          </h3>
          <div className="space-y-2">
            {chapter.qaChecks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-3"
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border-2)]" />
                <div>
                  <div className="text-[13px] font-bold text-[var(--wk-text)]">
                    {check.label}
                  </div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">
                    {check.description}
                  </div>
                  <code className="mt-1 block font-mono text-[10px] text-[var(--wk-text-faint)]">
                    {check.id}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Routes using this chapter */}
      {parityRoutes.length > 0 && (
        <WkSurface className="p-5">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Routes using this chapter
          </h3>
          <div className="space-y-2">
            {parityRoutes.map((p) => (
              <div
                key={p.route}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--wk-border)] p-3"
              >
                <code className="font-mono text-[13px] font-bold text-[var(--wk-text)]">
                  {p.route}
                </code>
                <span className="text-[12px] text-[var(--wk-text-muted)]">
                  {p.archetype}
                </span>
                <div className="ml-auto flex flex-wrap gap-1">
                  {p.chapters.slice(0, 5).map((n) => (
                    <WkTag key={n}>{n}</WkTag>
                  ))}
                  {p.chapters.length > 5 && (
                    <WkTag>+{p.chapters.length - 5}</WkTag>
                  )}
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}
    </div>
  );
}

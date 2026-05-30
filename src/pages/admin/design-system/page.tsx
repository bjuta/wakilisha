import { useMemo, useState } from "react";
import {
  wakilishaDesignSystemSpec,
  chapterById,
  chapterByNumber,
  parityPagesForChapter,
  chaptersByGroup,
  allComponentNames,
  allTableNames,
  type WkDesignChapterSpec,
  type WkParityPage,
  GROUPS,
} from "../../../design-system/designSystemSpec";
import { useTheme } from "../../../components/design-system/theme/ThemeProvider";
import { WkTag } from "../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../components/design-system/primitives/Surface";
import { ChapterBrowser } from "./components/ChapterBrowser";
import { TokenInspector } from "./components/TokenInspector";
import { SpecimenWall } from "./components/SpecimenWall";
import { ParityMap } from "./components/ParityMap";
import { QAGates } from "./components/QAGates";

export type Section = "chapters" | "tokens" | "specimens" | "parity" | "qa";

export default function AdminDesignSystem() {
  const { theme, toggle } = useTheme();
  const [activeSection, setActiveSection] = useState<Section>("chapters");
  const [selectedGroup, setSelectedGroup] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const { chapters, meta, parityPageMap, globalQaGates } = wakilishaDesignSystemSpec;

  const filteredChapters = useMemo(() => {
    let list = [...chapters];
    if (selectedGroup !== "all") {
      list = list.filter((c) => c.group === selectedGroup);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q) ||
          c.implementationRules.some((r) => r.toLowerCase().includes(q)) ||
          c.parityTargets.some((r) => r.toLowerCase().includes(q)) ||
          c.componentsRequired.some((r) => r.toLowerCase().includes(q)) ||
          c.adminSections.some((r) => r.toLowerCase().includes(q))
      );
    }
    return list;
  }, [selectedGroup, query, chapters]);

  const selectedChapter = useMemo(
    () => chapterById(selectedChapterId || "") || null,
    [selectedChapterId]
  );

  const chapterCount = chapters.length;
  const componentCount = allComponentNames().length;
  const tableCount = allTableNames().length;
  const parityPageCount = parityPageMap.length;

  return (
    <div className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <header className="sticky top-0 z-[var(--wk-z-nav)] border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
              <i className="ri-settings-3-line text-sm font-bold" />
            </div>
            <div>
              <h1 className="text-[13px] font-bold leading-tight tracking-tight text-[var(--wk-text)]">
                {meta.name}
              </h1>
              <p className="text-[11px] text-[var(--wk-text-muted)]">
                {meta.version} — {meta.northStar}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {(
                [
                  ["chapters", "Chapters"],
                  ["tokens", "Tokens"],
                  ["specimens", "Specimens"],
                  ["parity", "Parity"],
                  ["qa", "QA"],
                ] as [Section, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all whitespace-nowrap ${
                    activeSection === key
                      ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                      : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="h-6 w-px bg-[var(--wk-border)]" />

            <button
              onClick={toggle}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--wk-text-soft)] transition-all hover:bg-[var(--wk-surface-raised)]"
            >
              <i className={theme === "dark" ? "ri-moon-line" : "ri-sun-line"} />
              <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="wk-container flex gap-8 px-6 py-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <WkSurface className="p-3 text-center">
                <div className="text-lg font-bold text-[var(--wk-brand)]">{chapterCount}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Chapters</div>
              </WkSurface>
              <WkSurface className="p-3 text-center">
                <div className="text-lg font-bold text-[var(--wk-brand)]">{componentCount}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Components</div>
              </WkSurface>
              <WkSurface className="p-3 text-center">
                <div className="text-lg font-bold text-[var(--wk-brand)]">{tableCount}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Tables</div>
              </WkSurface>
              <WkSurface className="p-3 text-center">
                <div className="text-lg font-bold text-[var(--wk-brand)]">{parityPageCount}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Routes</div>
              </WkSurface>
            </div>

            <div className="mb-4 space-y-1">
              <button
                onClick={() => setSelectedGroup("all")}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-all ${
                  selectedGroup === "all"
                    ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                    : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                }`}
              >
                All groups
              </button>
              {GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-all ${
                    selectedGroup === g
                      ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                      : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                Principles
              </div>
              <ul className="space-y-1">
                {meta.principles.map((p) => (
                  <li key={p} className="text-[11px] text-[var(--wk-text-soft)]">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chapters, rules, components, tables..."
                className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
              />
            </div>
            <div className="hidden items-center gap-1 md:flex">
              {GROUPS.map((g) => (
                <WkTag
                  key={g}
                  onClick={() =>
                    setSelectedGroup((prev) => (prev === g ? "all" : g))
                  }
                  variant={selectedGroup === g ? "brand" : "default"}
                >
                  {g}
                </WkTag>
              ))}
            </div>
          </div>

          {activeSection === "chapters" && (
            <ChapterBrowser
              chapters={filteredChapters}
              selectedChapter={selectedChapter}
              onSelectChapter={setSelectedChapterId}
              allChapters={chapters}
              parityMap={parityPageMap}
            />
          )}

          {activeSection === "tokens" && <TokenInspector />}

          {activeSection === "specimens" && <SpecimenWall />}

          {activeSection === "parity" && (
            <ParityMap
              parityMap={parityPageMap}
              chapters={chapters}
            />
          )}

          {activeSection === "qa" && (
            <QAGates
              parityMap={parityPageMap}
              chapters={chapters}
              globalQaGates={globalQaGates}
            />
          )}
        </main>
      </div>
    </div>
  );
}
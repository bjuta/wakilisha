import { useMemo, useState } from "react";
import {
  wakilishaDesignSystemSpec,
  chapterById,
  allComponentNames,
  allTableNames,
  type WkDesignChapterSpec,
  GROUPS,
} from "../../../design-system/designSystemSpec";
import { useTheme } from "../../../components/design-system/theme/ThemeProvider";
import { WkTag } from "../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../components/design-system/primitives/Surface";
import { TokenInspector } from "./components/TokenInspector";
import { ParityMap } from "./components/ParityMap";
import { QAGates } from "./components/QAGates";
import { CanonicalChapterDetail } from "./components/CanonicalChapterDetail";

export type Section = "workbench" | "tokens" | "pages" | "qa";

const QUICK_SPECIMENS = [
  { chapter: "16", label: "Player UI", icon: "ri-play-circle-line" },
  { chapter: "21", label: "Chart rows", icon: "ri-bar-chart-box-line" },
  { chapter: "37", label: "Artist cards", icon: "ri-user-star-line" },
  { chapter: "41", label: "Release pages", icon: "ri-album-line" },
  { chapter: "13", label: "Cards / lift", icon: "ri-layout-grid-line" },
  { chapter: "07", label: "Motion", icon: "ri-pulse-line" },
  { chapter: "04", label: "Color", icon: "ri-palette-line" },
  { chapter: "53", label: "Mobile", icon: "ri-smartphone-line" },
];

export default function AdminDesignSystem() {
  const { theme, toggle } = useTheme();
  const [activeSection, setActiveSection] = useState<Section>("workbench");
  const [selectedGroup, setSelectedGroup] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>("player-system");

  const { chapters, meta, parityPageMap, globalQaGates, canonicalParity } = wakilishaDesignSystemSpec;

  const selectedChapter = useMemo(() => {
    return chapterById(selectedChapterId || "") || chapters.find((c) => c.number === "16") || chapters[0] || null;
  }, [selectedChapterId, chapters]);

  const filteredChapters = useMemo(() => {
    let list = [...chapters];
    if (selectedGroup !== "all") list = list.filter((c) => c.group === selectedGroup);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => {
        const canonical = c.canonical;
        return (
          c.number.includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q) ||
          c.implementationRules.some((r) => r.toLowerCase().includes(q)) ||
          c.parityTargets.some((r) => r.toLowerCase().includes(q)) ||
          c.componentsRequired.some((r) => r.toLowerCase().includes(q)) ||
          c.adminSections.some((r) => r.toLowerCase().includes(q)) ||
          Boolean(canonical?.canonicalSubsections.some((r) => r.toLowerCase().includes(q))) ||
          Boolean(canonical?.richMedia.some((r) => r.label.toLowerCase().includes(q)))
        );
      });
    }
    return list;
  }, [selectedGroup, query, chapters]);

  const componentCount = allComponentNames().length;
  const tableCount = allTableNames().length;

  return (
    <div className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <header className="sticky top-0 z-[var(--wk-z-nav)] border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur">
        <div className="wk-container-max flex items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                <i className="ri-compasses-2-line text-sm font-bold" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[13px] font-black tracking-tight text-[var(--wk-text)]">
                  Design system workbench
                </h1>
                <p className="truncate text-[11px] text-[var(--wk-text-muted)]">
                  {meta.version} · {meta.northStar}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {([
                ["workbench", "Workbench"],
                ["tokens", "Tokens"],
                ["pages", "Pages"],
                ["qa", "QA"],
              ] as [Section, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${
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

      <div className="wk-container-max px-6 py-6">
        <div className="mb-5 grid gap-3 lg:grid-cols-4">
          <SummaryCard value={chapters.length} label="Chapters" note="Canonical sections live here" />
          <SummaryCard value={canonicalParity?.richMediaSpecimens ?? 0} label="Specimen groups" note="Player, charts, cards, motion" />
          <SummaryCard value={componentCount} label="Components" note="Reusable app patterns" />
          <SummaryCard value={tableCount} label="Data tables" note="Graph-backed app rules" />
        </div>

        {activeSection === "workbench" && (
          <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)_320px]">
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <WkSurface className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">
                    Find a specimen
                  </h2>
                  <WkTag variant="brand">Start here</WkTag>
                </div>
                <div className="relative mb-3">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search player, artist, chart, motion..."
                    className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] py-2 pl-9 pr-3 text-[13px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_SPECIMENS.map((item) => {
                    const chapter = chapters.find((c) => c.number === item.chapter);
                    return (
                      <button
                        key={item.chapter}
                        onClick={() => chapter && setSelectedChapterId(chapter.id)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          selectedChapter?.number === item.chapter
                            ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                            : "border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                        }`}
                      >
                        <i className={`${item.icon} mb-2 block text-lg`} />
                        <div className="text-[12px] font-bold leading-tight">{item.label}</div>
                        <div className="mt-1 font-mono text-[10px] opacity-70">Ch. {item.chapter}</div>
                      </button>
                    );
                  })}
                </div>
              </WkSurface>

              <WkSurface className="p-4">
                <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">
                  Chapter list
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  <WkTag onClick={() => setSelectedGroup("all")} variant={selectedGroup === "all" ? "brand" : "default"}>All</WkTag>
                  {GROUPS.map((group) => (
                    <WkTag key={group} onClick={() => setSelectedGroup(group)} variant={selectedGroup === group ? "brand" : "default"}>
                      {group.split(" ")[0]}
                    </WkTag>
                  ))}
                </div>
                <div className="max-h-[58vh] space-y-1 overflow-auto pr-1">
                  {filteredChapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => setSelectedChapterId(chapter.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left transition-all ${
                        selectedChapter?.id === chapter.id
                          ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                          : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold">{chapter.number}</span>
                        <span className="truncate text-[13px] font-bold">{chapter.title}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] opacity-70">
                        {chapter.canonical?.richMedia.length ?? 0} specimen groups · {chapter.qaChecks.length} QA
                      </div>
                    </button>
                  ))}
                </div>
              </WkSurface>
            </aside>

            <main className="min-w-0 space-y-5">
              {selectedChapter && (
                <>
                  <div className="rounded-3xl border border-[var(--wk-border)] bg-[linear-gradient(135deg,var(--wk-surface),var(--wk-bg-subtle))] p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <WkTag variant="brand">Chapter {selectedChapter.number}</WkTag>
                      <WkTag>{selectedChapter.group}</WkTag>
                      {selectedChapter.canonical && <WkTag>{selectedChapter.canonical.richMedia.length} specimen groups</WkTag>}
                    </div>
                    <h2 className="max-w-3xl text-4xl font-black leading-none tracking-[-0.055em] text-[var(--wk-text)] md:text-6xl">
                      {selectedChapter.title}
                    </h2>
                    <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
                      {selectedChapter.summary}
                    </p>
                  </div>
                  <CanonicalChapterDetail chapter={selectedChapter} />
                </>
              )}
            </main>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              {selectedChapter && <RightPanel chapter={selectedChapter} />}
            </aside>
          </div>
        )}

        {activeSection === "tokens" && <TokenInspector />}
        {activeSection === "pages" && <ParityMap parityMap={parityPageMap} chapters={chapters} />}
        {activeSection === "qa" && <QAGates parityMap={parityPageMap} chapters={chapters} globalQaGates={globalQaGates} />}
      </div>
    </div>
  );
}

function SummaryCard({ value, label, note }: { value: number | string; label: string; note: string }) {
  return (
    <WkSurface className="p-4">
      <div className="text-2xl font-black tracking-[-0.04em] text-[var(--wk-brand)]">{value}</div>
      <div className="mt-1 text-[12px] font-bold text-[var(--wk-text)]">{label}</div>
      <div className="text-[11px] text-[var(--wk-text-muted)]">{note}</div>
    </WkSurface>
  );
}

function RightPanel({ chapter }: { chapter: WkDesignChapterSpec }) {
  const routes = wakilishaDesignSystemSpec.parityPageMap.filter((page) => page.chapters.includes(chapter.number));
  return (
    <>
      <WkSurface className="p-4">
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">What to check</h3>
        <div className="space-y-2">
          {chapter.qaChecks.slice(0, 6).map((check) => (
            <div key={check.id} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3">
              <div className="text-[12px] font-bold text-[var(--wk-text)]">{check.label}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">{check.description}</div>
            </div>
          ))}
        </div>
      </WkSurface>

      <WkSurface className="p-4">
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Routes affected</h3>
        <div className="space-y-2">
          {routes.length === 0 && <div className="text-[12px] text-[var(--wk-text-muted)]">No route map entry yet.</div>}
          {routes.map((route) => (
            <div key={route.route} className="rounded-xl border border-[var(--wk-border)] p-3">
              <code className="font-mono text-[12px] font-bold text-[var(--wk-text)]">{route.route}</code>
              <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">{route.archetype}</div>
            </div>
          ))}
        </div>
      </WkSurface>

      <WkSurface className="p-4">
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Components</h3>
        <div className="flex flex-wrap gap-2">
          {chapter.componentsRequired.slice(0, 16).map((name) => (
            <code key={name} className="rounded border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-2 py-1 font-mono text-[11px] text-[var(--wk-brand)]">
              {name}
            </code>
          ))}
          {chapter.componentsRequired.length === 0 && <div className="text-[12px] text-[var(--wk-text-muted)]">No component list yet.</div>}
        </div>
      </WkSurface>
    </>
  );
}

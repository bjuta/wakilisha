import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ADMIN_SEARCH_INDEX, type AdminSearchItem } from "@/data/adminSearchIndex";

const GROUP_ORDER = [
  "Dashboard",
  "Content & Editorial",
  "Music Registry",
  "Charts Engine",
  "Media",
  "Review & Quality",
  "Data Import",
  "Settings",
  "Users",
  "Developer",
];

export function AdminCommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return ADMIN_SEARCH_INDEX.filter((item) => {
      const haystack = `${item.label} ${item.description} ${item.group} ${(item.keywords ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const grouped = useMemo(() => {
    const map: Record<string, AdminSearchItem[]> = {};
    for (const item of results) {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    }
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({ group: g, items: map[g] }));
  }, [results]);

  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const navigateTo = useCallback(
    (item: AdminSearchItem) => {
      navigate(item.path);
      onClose();
    },
    [navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          navigateTo(flatResults[selectedIndex]);
        }
      }
    },
    [flatResults, selectedIndex, navigateTo, onClose],
  );

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const el = listRef.current.querySelector(`[data-search-index="${selectedIndex}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[var(--wk-border)] px-5 py-4">
          <WkIcon name="Search" size={20} className="text-[var(--wk-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search admin pages, settings, features..."
            className="flex-1 bg-transparent text-[15px] font-medium text-[var(--wk-text)] placeholder:text-[var(--wk-text-muted)] outline-none"
          />
          <kbd className="hidden sm:flex h-6 items-center gap-0.5 rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
            <span>esc</span>
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-2">
          {query.trim() === "" ? (
            /* Empty state — show quick jump hints */
            <div className="px-4 py-10 text-center">
              <WkIcon name="Search" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-[14px] font-semibold text-[var(--wk-text-muted)]">Type to search</p>
              <p className="mt-1 text-[12px] text-[var(--wk-text-faint)]">
                Search across all admin pages, settings, and features
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {["articles", "ingest", "settings", "artists", "media"].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => setQuery(hint)}
                    className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[12px] font-medium text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] transition-colors"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          ) : grouped.length === 0 ? (
            /* No results */
            <div className="px-4 py-10 text-center">
              <WkIcon name="SearchX" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-[14px] font-semibold text-[var(--wk-text-muted)]">No results for "{query}"</p>
              <p className="mt-1 text-[12px] text-[var(--wk-text-faint)]">Try a different search term</p>
            </div>
          ) : (
            /* Grouped results */
            grouped.map((group, gi) => {
              let globalIdx = 0;
              if (gi > 0) {
                for (let i = 0; i < gi; i++) {
                  globalIdx += grouped[i].items.length;
                }
              }
              return (
                <div key={group.group} className="mb-1">
                  <div className="px-3 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--wk-text-faint)]">
                    {group.group}
                  </div>
                  {group.items.map((item, ii) => {
                    const idx = globalIdx + ii;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-search-index={idx}
                        onClick={() => navigateTo(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-[var(--wk-brand-soft)]"
                            : "hover:bg-[var(--wk-surface-raised)]"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                              : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                          }`}
                        >
                          <WkIcon name={item.icon as never} size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[13px] font-semibold ${isSelected ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"}`}>
                            {item.label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--wk-text-muted)] leading-snug line-clamp-2">
                            {item.description}
                          </div>
                        </div>
                        <div className="shrink-0 pt-1">
                          <WkIcon
                            name="CornerDownLeft"
                            size={14}
                            className={isSelected ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-[var(--wk-border)] px-5 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)]">
            <kbd className="flex h-5 items-center rounded border border-[var(--wk-border)] bg-[var(--wk-bg)] px-1.5 text-[10px] font-semibold">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)]">
            <kbd className="flex h-5 items-center rounded border border-[var(--wk-border)] bg-[var(--wk-bg)] px-1.5 text-[10px] font-semibold">↵</kbd>
            <span>Open</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)]">
            <kbd className="flex h-5 items-center rounded border border-[var(--wk-border)] bg-[var(--wk-bg)] px-1.5 text-[10px] font-semibold">esc</kbd>
            <span>Close</span>
          </div>
          <div className="ml-auto text-[11px] text-[var(--wk-text-faint)]">
            {flatResults.length} result{flatResults.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useCallback } from "react";
import { readingGuide } from "../readingData";

const FONT_SIZES = [15, 16, 17, 18, 19, 20, 21, 22];

interface ReadingReaderRailProps {
  onFontChange: (size: number) => void;
  currentFont: number;
}

export default function ReadingReaderRail({ onFontChange, currentFont }: ReadingReaderRailProps) {
  const [collapsed, setCollapsed] = useState(true);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setCollapsed(true);
    }
  }, []);

  return (
    <>
      {/* Toggle button (mobile only) */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center text-[18px] shadow-lg"
        style={{ background: "#C4A35A", color: "#FFFFFF" }}
        aria-label="Reader tools"
        aria-expanded={!collapsed}
      >
        <i className="ri-book-open-line" />
      </button>

      {/* Rail */}
      <aside
        className={`fixed lg:sticky lg:top-24 right-0 lg:right-auto z-30 lg:z-10 w-[280px] h-[100dvh] lg:h-auto lg:w-[220px] lg:ml-4 transition-transform duration-300 ease-out ${collapsed ? "translate-x-full lg:translate-x-0" : "translate-x-0"}`}
        style={{ background: "var(--wk-surface)", borderLeft: "1px solid var(--wk-divider)" }}
        aria-label="Reader tools"
      >
        {/* Mobile close */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--wk-divider)" }}>
          <span className="text-[13px] font-semibold" style={{ color: "var(--wk-text)" }}>Reader tools</span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="w-8 h-8 flex items-center justify-center text-[18px]"
            style={{ color: "var(--wk-text-muted)" }}
            aria-label="Close reader tools"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Contents */}
          <div>
            <div className="text-[11px] font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--wk-text-muted)" }}>
              Contents
            </div>
            <nav className="space-y-1" aria-label="Chapter sections">
              {readingGuide.toc.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left text-[13px] transition-colors hover:opacity-80"
                  style={{ color: "var(--wk-text-soft)" }}
                >
                  <b className="w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold flex-shrink-0" style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text-muted)" }}>
                    {item.num}
                  </b>
                  <span className="leading-snug">{item.subtitle || item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Text size */}
          <div>
            <div className="text-[11px] font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--wk-text-muted)" }}>
              Text size
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const idx = FONT_SIZES.indexOf(currentFont);
                  if (idx > 0) onFontChange(FONT_SIZES[idx - 1]);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[12px] font-bold transition-colors"
                style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }}
                aria-label="Decrease text size"
              >
                A−
              </button>
              <span className="text-[13px] font-medium tabular-nums w-10 text-center" style={{ color: "var(--wk-text)" }}>
                {currentFont}px
              </span>
              <button
                type="button"
                onClick={() => {
                  const idx = FONT_SIZES.indexOf(currentFont);
                  if (idx < FONT_SIZES.length - 1) onFontChange(FONT_SIZES[idx + 1]);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[14px] font-bold transition-colors"
                style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }}
                aria-label="Increase text size"
              >
                A+
              </button>
            </div>
          </div>

          {/* Bookmarks hint */}
          <div>
            <div className="text-[11px] font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--wk-text-muted)" }}>
              Bookmarks and highlights
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--wk-text-muted)" }}>
              No saved passages yet. Select text to highlight or bookmark.
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {!collapsed && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/20" onClick={() => setCollapsed(true)} />
      )}
    </>
  );
}
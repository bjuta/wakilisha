import { useState, useCallback } from "react";
import type { ProseArticleData, ChapterSection, TOCItem } from "../sectionTypes";

/* ─── Sub-components ─── */

function ChapterHead({ label, num, title, epigraph }: { label: string; num: string; title: string; epigraph?: { text: string; cite: string } }) {
  return (
    <header className="mb-10 md:mb-14">
      <span className="block text-[11px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "var(--wk-text-muted)" }}>{label}</span>
      <div className="flex items-start gap-4">
        <span className="hidden md:block text-[72px] md:text-[96px] font-black leading-none select-none" style={{ color: "var(--wk-surface-strong)", fontFamily: "var(--wk-font-heading)" }} aria-hidden="true">{num}</span>
        <div className="flex-1">
          <h2 className="text-[28px] md:text-[36px] font-black leading-tight italic" style={{ color: "var(--wk-text)", fontFamily: "var(--wk-font-heading)" }}>{title}</h2>
        </div>
      </div>
      <div className="mt-4 text-[20px]" style={{ color: "var(--wk-text-muted)" }} aria-hidden="true">❧</div>
      {epigraph && (
        <blockquote className="mt-8 pl-5 border-l-2" style={{ borderColor: "#C4A35A" }}>
          <p className="text-[15px] md:text-[16px] leading-relaxed italic" style={{ color: "var(--wk-text-soft)" }}>{epigraph.text}</p>
          <cite className="block mt-2 text-[12px] font-medium not-italic tracking-wide" style={{ color: "var(--wk-text-muted)" }}>{epigraph.cite}</cite>
        </blockquote>
      )}
    </header>
  );
}

function SectionTitle({ id, num, title }: { id: string; num: string; title: string }) {
  return (
    <div id={id} className="my-10 md:my-14 flex items-center gap-4">
      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--wk-text-muted)" }}>{num}</span>
      <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
      <span className="text-[13px] font-semibold tracking-wide uppercase" style={{ color: "var(--wk-text)" }}>{title}</span>
      <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
    </div>
  );
}

function ProseParagraph({ html, isDropCap, isCentered, fontSize }: { html: string; isDropCap?: boolean; isCentered?: boolean; fontSize: number }) {
  if (isCentered) {
    return (
      <p className="text-[15px] md:text-[16px] leading-[1.75] mb-5 text-center font-medium italic" style={{ fontSize: `${fontSize}px`, color: "var(--wk-text-soft)" }} dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
  if (isDropCap) {
    return (
      <p className="text-[15px] md:text-[16px] leading-[1.75] mb-5" style={{ fontSize: `${fontSize}px`, color: "var(--wk-text)" }}
        dangerouslySetInnerHTML={{
          __html: html.replace(/^(The|A|I|W|S|T|M|N|B|F|H|L|R|D|E|O|Y) /, (_match: string, first: string) =>
            `<span class="inline-block float-left text-[3.2em] font-black leading-[0.85] mr-2 mt-1" style="color:#C4A35A;font-family:var(--wk-font-heading)">${first}</span>`
          ),
        }}
      />
    );
  }
  return <p className="text-[15px] md:text-[16px] leading-[1.75] mb-5" style={{ fontSize: `${fontSize}px`, color: "var(--wk-text)" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

function PullQuote({ text, fontSize }: { text: string; fontSize: number }) {
  return (
    <div className="my-8 md:my-10 py-6 md:py-8 px-4 md:px-6 text-center" style={{ background: "var(--wk-surface-raised)" }}>
      <p className="text-[15px] md:text-[17px] font-medium italic leading-relaxed max-w-[540px] mx-auto" style={{ fontSize: `${fontSize + 1}px`, color: "var(--wk-text-soft)" }} dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}

function Aside({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="my-8 md:my-10 p-5 md:p-6 rounded-lg border" style={{ background: "var(--wk-surface-raised)", borderColor: "var(--wk-divider)" }}>
      <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--wk-text-muted)" }}>{kicker}</span>
      <h4 className="mt-1 text-[15px] font-bold" style={{ color: "var(--wk-text)" }}>{title}</h4>
      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--wk-text-soft)" }}>{body}</p>
    </div>
  );
}

function ListBurst({ items }: { items: string[] }) {
  return (
    <div className="my-8 md:my-10 space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full mt-2.5 flex-shrink-0" style={{ background: "#C4A35A" }} />
          <p className="text-[15px] md:text-[16px] leading-relaxed" style={{ color: "var(--wk-text)" }}>{item}</p>
        </div>
      ))}
    </div>
  );
}

function ReaderRail({ toc, onFontChange, currentFont, collapsed, setCollapsed }: { toc: TOCItem[]; onFontChange: (size: number) => void; currentFont: number; collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const FONT_SIZES = [15, 16, 17, 18, 19, 20, 21, 22];

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setCollapsed(true);
    }
  }, [setCollapsed]);

  return (
    <>
      <button type="button" onClick={() => setCollapsed(!collapsed)} className="lg:hidden fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center text-[18px] shadow-lg" style={{ background: "#C4A35A", color: "#FFFFFF" }} aria-label="Reader tools" aria-expanded={!collapsed}>
        <i className="ri-book-open-line" />
      </button>

      <aside className={`fixed lg:sticky lg:top-24 right-0 lg:right-auto z-30 lg:z-10 w-[280px] h-[100dvh] lg:h-auto lg:w-[220px] lg:ml-4 transition-transform duration-300 ease-out ${collapsed ? "translate-x-full lg:translate-x-0" : "translate-x-0"}`} style={{ background: "var(--wk-surface)", borderLeft: "1px solid var(--wk-divider)" }} aria-label="Reader tools">
        <div className="lg:hidden flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--wk-divider)" }}>
          <span className="text-[13px] font-semibold" style={{ color: "var(--wk-text)" }}>Reader tools</span>
          <button type="button" onClick={() => setCollapsed(true)} className="w-8 h-8 flex items-center justify-center text-[18px]" style={{ color: "var(--wk-text-muted)" }} aria-label="Close reader tools">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <div className="text-[11px] font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--wk-text-muted)" }}>Contents</div>
            <nav className="space-y-1" aria-label="Chapter sections">
              {toc.map((item) => (
                <button key={item.id} type="button" onClick={() => scrollTo(item.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left text-[13px] transition-colors hover:opacity-80" style={{ color: "var(--wk-text-soft)" }}>
                  <b className="w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold flex-shrink-0" style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text-muted)" }}>{item.num}</b>
                  <span className="leading-snug">{item.subtitle || item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--wk-text-muted)" }}>Text size</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { const idx = FONT_SIZES.indexOf(currentFont); if (idx > 0) onFontChange(FONT_SIZES[idx - 1]); }} className="w-8 h-8 flex items-center justify-center rounded-md text-[12px] font-bold transition-colors" style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }} aria-label="Decrease text size">A−</button>
              <span className="text-[13px] font-medium tabular-nums w-10 text-center" style={{ color: "var(--wk-text)" }}>{currentFont}px</span>
              <button type="button" onClick={() => { const idx = FONT_SIZES.indexOf(currentFont); if (idx < FONT_SIZES.length - 1) onFontChange(FONT_SIZES[idx + 1]); }} className="w-8 h-8 flex items-center justify-center rounded-md text-[14px] font-bold transition-colors" style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }} aria-label="Increase text size">A+</button>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--wk-text-muted)" }}>Bookmarks and highlights</div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--wk-text-muted)" }}>No saved passages yet. Select text to highlight or bookmark.</p>
          </div>
        </div>
      </aside>

      {!collapsed && <div className="lg:hidden fixed inset-0 z-20 bg-black/20" onClick={() => setCollapsed(true)} />}
    </>
  );
}

/* ─── Main article renderer ─── */

function RenderChapter({ chapter, fontSize, isFirst }: { chapter: ChapterSection; fontSize: number; isFirst: boolean }) {
  return (
    <>
      {isFirst && chapter.label && chapter.num && chapter.title && (
        <ChapterHead label={chapter.label} num={chapter.num} title={chapter.title} epigraph={chapter.epigraph} />
      )}
      {!isFirst && (
        <SectionTitle id={chapter.id} num={chapter.num} title={chapter.title} />
      )}

      <div className="space-y-1">
        {chapter.paragraphs.map((p, i) => (
          <ProseParagraph key={i} html={p.html} isDropCap={isFirst && p.isDropCap} isCentered={p.isCentered} fontSize={fontSize} />
        ))}
      </div>

      {chapter.pullQuote && <PullQuote text={chapter.pullQuote} fontSize={fontSize} />}

      {chapter.aside && <Aside kicker={chapter.aside.kicker} title={chapter.aside.title} body={chapter.aside.body} />}

      {chapter.paragraphsAfter && (
        <div className="space-y-1">
          {chapter.paragraphsAfter.map((p, i) => (
            <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
          ))}
        </div>
      )}

      {chapter.paragraphsAfterPull && (
        <div className="space-y-1">
          {chapter.paragraphsAfterPull.map((p, i) => (
            <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
          ))}
        </div>
      )}

      {chapter.listBurst && <ListBurst items={chapter.listBurst} />}
    </>
  );
}

/* ─── Main export ─── */

export default function ProseArticleSection({ data, fontSize, onFontChange }: { data: ProseArticleData; fontSize?: number; onFontChange?: (size: number) => void }) {
  const [localFont, setLocalFont] = useState(19);
  const [collapsed, setCollapsed] = useState(true);
  const [selectedText, setSelectedText] = useState("");

  const fs = fontSize ?? localFont;
  const setFs = onFontChange ?? setLocalFont;

  const handleSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      setSelectedText(sel.toString().trim());
    } else {
      setSelectedText("");
    }
  };

  return (
    <>
      <article id="prologue" className="relative max-w-[720px] mx-auto px-6 md:px-8 pb-16 md:pb-24" style={{ color: "var(--wk-text)" }} onMouseUp={handleSelection}>
        {selectedText && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-3 py-2 rounded-lg shadow-lg" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-divider)" }}>
            <span className="text-[12px] mr-2 max-w-[160px] truncate" style={{ color: "var(--wk-text-muted)" }}>{selectedText.length > 20 ? `${selectedText.slice(0, 20)}...` : selectedText}</span>
            <button type="button" onClick={() => setSelectedText("")} className="px-2 py-1 text-[11px] font-medium rounded" style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }}>Highlight</button>
            <button type="button" onClick={() => { navigator.clipboard.writeText(selectedText); setSelectedText(""); }} className="px-2 py-1 text-[11px] font-medium rounded" style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }}>Copy</button>
          </div>
        )}

        {data.chapters.map((chapter, index) => (
          <RenderChapter key={chapter.id} chapter={chapter} fontSize={fs} isFirst={index === 0} />
        ))}

        <div className="mt-14 md:mt-20 text-center text-[20px] tracking-widest" style={{ color: "var(--wk-text-muted)" }} aria-hidden="true">· · ·</div>
      </article>

      {data.toc && data.toc.length > 0 && (
        <ReaderRail toc={data.toc} onFontChange={setFs} currentFont={fs} collapsed={collapsed} setCollapsed={setCollapsed} />
      )}
    </>
  );
}
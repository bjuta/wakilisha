import { useState } from "react";
import { Link } from "react-router-dom";
import { readingGuide, prologueChapter } from "@/pages/guides/detail/readingData";

export default function MobileReadingGuide() {
  const [fontSize, setFontSize] = useState(17);
  const [tocOpen, setTocOpen] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // Reading progress tracking
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setReadingProgress(max > 0 ? window.scrollY / max : 0);
    }, { passive: true });
  }

  const shareLinks = [
    { icon: "ri-whatsapp-line", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${readingGuide.shareTitle} ${readingGuide.shareUrl}`)}`, color: "#25D366" },
    { icon: "ri-twitter-x-line", label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(readingGuide.shareTitle)}&url=${encodeURIComponent(readingGuide.shareUrl)}`, color: "#000" },
    { icon: "ri-facebook-line", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(readingGuide.shareUrl)}`, color: "#1877F2" },
    { icon: "ri-linkedin-line", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(readingGuide.shareUrl)}`, color: "#0A66C2" },
    { icon: "ri-mail-line", label: "Email", href: `mailto:?subject=${encodeURIComponent(readingGuide.shareTitle)}&body=${encodeURIComponent(readingGuide.shareDescription + "\n" + readingGuide.shareUrl)}`, color: "#EA4335" },
    { icon: "ri-link-m", label: "Copy", color: "#C4A35A", onClick: () => { navigator.clipboard?.writeText(readingGuide.shareUrl); setCopyToast(true); setTimeout(() => setCopyToast(false), 2000); } },
  ];

  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setTocOpen(false); };

  const ShareRow = () => (
    <section className="py-4 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {shareLinks.map((link) => (
          link.onClick ? (
            <button key={link.label} onClick={link.onClick} className="flex-shrink-0 w-10 h-10 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center active:scale-90 transition-transform cursor-pointer" style={{ color: link.color }}>
              <i className={copyToast && link.label === "Copy" ? "ri-check-line" : link.icon} />
            </button>
          ) : (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-10 h-10 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center active:scale-90 transition-transform" style={{ color: link.color }}>
              <i className={link.icon} />
            </a>
          )
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-transparent">
        <div className="h-full origin-left transition-transform duration-100" style={{ background: "#C4A35A", transform: `scaleX(${readingProgress})` }} />
      </div>

      {/* TOC toggle */}
      <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
          style={{ background: "#C4A35A" }}
        >
          <i className={tocOpen ? "ri-close-line" : "ri-list-unordered"} />
        </button>
      </div>

      {/* TOC panel */}
      {tocOpen && (
        <div className="fixed inset-0 z-45 flex items-end justify-center" onClick={() => setTocOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[500px] rounded-t-2xl bg-[var(--wk-bg)] p-5 pb-8 z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-black text-[var(--wk-text)]">Contents</h3>
              <button onClick={() => setTocOpen(false)} className="w-8 h-8 rounded-full border border-[var(--wk-border)] flex items-center justify-center text-[var(--wk-text-muted)] cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="space-y-1">
              {readingGuide.toc.map((item) => (
                <button key={item.id} onClick={() => scrollTo(item.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left active:bg-[var(--wk-surface-hover)] transition-colors cursor-pointer">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black" style={{ background: "#C4A35A15", color: "#C4A35A" }}>{item.num}</span>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--wk-text)]">{item.label}</p>
                    {item.subtitle && <p className="text-[10px] text-[var(--wk-text-muted)]">{item.subtitle}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative pt-14 pb-8 px-5" style={{ background: "var(--wk-bg)" }}>
        <Link to="/guides" className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-[var(--wk-text-muted)] mb-5">
          <i className="ri-arrow-left-line" /> Guides
        </Link>
        <div className="mb-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase text-[var(--wk-text-muted)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#C4A35A" }} />
            {readingGuide.issue} · {readingGuide.status}
          </span>
        </div>
        <h1 className="text-[32px] font-black leading-[1.05] tracking-tight text-[var(--wk-text)] mb-4" style={{ fontFamily: "var(--wk-font-heading)" }}>
          The Day<br />Reading<br />Changed
        </h1>
        <p className="text-[14px] leading-relaxed italic text-[var(--wk-text-soft)] mb-4" dangerouslySetInnerHTML={{ __html: readingGuide.lede }} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--wk-text-muted)] mb-5">
          <span>By <a href={readingGuide.author.url} className="underline underline-offset-2 text-[var(--wk-text)]">{readingGuide.author.name}</a></span>
          <span>{readingGuide.publisher}</span>
        </div>
        <a href="#prologue" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-md text-[13px] font-semibold text-white active:scale-[0.97] transition-transform whitespace-nowrap" style={{ background: "#C4A35A" }}>
          Start reading <i className="ri-arrow-down-line" />
        </a>
      </section>

      <ShareRow />

      {/* Text size control */}
      <div className="px-5 py-3 flex items-center justify-center gap-3" style={{ background: "var(--wk-bg-subtle)" }}>
        <span className="text-[10px] text-[var(--wk-text-muted)]">A</span>
        <input
          type="range"
          min={15}
          max={22}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-[120px] accent-[#C4A35A]"
        />
        <span className="text-[14px] text-[var(--wk-text-muted)]">A</span>
      </div>

      {/* Prologue */}
      <article id="prologue" className="py-10 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="text-center mb-8">
          <div className="text-[48px] font-black leading-none mb-2" style={{ color: "#C4A35A" }}>{prologueChapter.num}</div>
          <h2 className="text-[22px] font-black text-[var(--wk-text)] tracking-tight">{prologueChapter.title}</h2>
          <div className="mt-4 text-[16px] italic text-[var(--wk-text-muted)]">&#10083;</div>
        </div>

        {prologueChapter.epigraph && (
          <div className="border-l-2 pl-4 mb-8" style={{ borderColor: "#C4A35A" }}>
            <p className="text-[13px] leading-relaxed italic text-[var(--wk-text-soft)]">{prologueChapter.epigraph.text}</p>
            <cite className="mt-1 block text-[10px] font-semibold text-[var(--wk-text-muted)] not-italic">{prologueChapter.epigraph.cite}</cite>
          </div>
        )}

        <div style={{ fontSize: `${fontSize}px`, lineHeight: 1.75, color: "var(--wk-text)" }}>
          {prologueChapter.paragraphs.map((p, i) => (
            <p
              key={i}
              className={`mb-4 ${p.isDropCap ? "first-letter:float-left first-letter:text-[4em] first-letter:leading-[0.85] first-letter:pr-3 first-letter:font-black" : ""}`}
              style={p.isDropCap ? { color: "var(--wk-text)", ...({ "--first-letter-color": "#C4A35A" } as React.CSSProperties) } : undefined}
              dangerouslySetInnerHTML={{ __html: p.html }}
            />
          ))}
        </div>

        {prologueChapter.pullQuote && (
          <div className="my-8 py-5 px-5 rounded-xl text-center" style={{ background: "#C4A35A0D" }}>
            <p className="text-[15px] italic font-medium leading-relaxed" style={{ color: "#C4A35A" }}>{prologueChapter.pullQuote}</p>
          </div>
        )}
      </article>

      {/* Coming next */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-text-muted)]">Coming next</span>
          <h3 className="text-[18px] font-black text-[var(--wk-text)] mt-1 mb-1">{readingGuide.nextChapter.title}</h3>
          <p className="text-[13px] text-[var(--wk-text-muted)] mb-5">{readingGuide.nextChapter.subtitle}</p>
          <form
            action="https://readdy.ai/api/form/d8m5rsojb57qogjbh760"
            method="POST"
            data-readdy-form=""
            className="space-y-3"
          >
            <input
              type="email" name="email" placeholder="Your email address" required
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]/40"
            />
            <button type="submit" className="w-full rounded-lg px-4 py-3 text-[13px] font-bold text-white active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer" style={{ background: "#C4A35A" }}>
              Notify me when Chapter One drops
            </button>
          </form>
        </div>
      </section>

      {/* Page footer */}
      <div className="py-6 px-5 text-center border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <p className="text-[10px] tracking-wider uppercase text-[var(--wk-text-muted)]">WAKILISHA Books · Guide 06 · Prologue</p>
      </div>

      <div className="py-10 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <div className="px-5 text-center">
          <Link to="/guides" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] active:scale-[0.97] transition-transform whitespace-nowrap">
            <i className="ri-arrow-left-line" /> Back to All Guides
          </Link>
        </div>
      </div>
    </div>
  );
}
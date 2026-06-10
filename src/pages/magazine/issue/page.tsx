import { useEffect, useId, useRef, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMagazineArticles, useSiteContent } from "@/services/magazineArticles";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { MagazineGeneratedVisual } from "@/components/magazine/visuals/MagazineGeneratedVisual";
import {
  buildMagazineIssues,
  getAdjacentIssues,
  issueUrl,
  resolveIssueByKey,
  type MagazineIssue,
  type MagazineIssueArticle,
  type MagazineSpread,
} from "@/services/magazineIssues";
import { buildIssueEditorialSystem, type MagazineEditorialSystem } from "@/services/magazineNlg";
import {
  ArtistSpotlightSpread,
  ReleaseSpotlightSpread,
  ChartHighlightSpread,
} from "@/pages/magazine/components/RegistrySpotlight";
import type { SiteContentResponse } from "@/services/magazineSiteContent";
import { useArtDirector } from "@/magazine-art-director";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import "./magazineIssue.css";
import "./magazineIssueVariants.css";
import "./magazineImmersive.css";
import "@/magazine-art-director/schools.css";

const LOGO_DARK = "/assets/logos/wakilisha-logo-dark.svg";
const LOGO_LIGHT = "/assets/logos/wakilisha-logo-light.svg";

/* ── Scroll reveal hook — re-runs when content ready ── */
function useScrollReveal(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("mag-reveal-visible");
          }
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -24px 0px" },
    );
    const els = document.querySelectorAll(".mag-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ready]);
}

/* ── Progress rail ── */
function useProgressRail(spreadIds: string[]) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.5);
      const els = spreadIds.map((id) => document.getElementById(id));
      let closest = 0;
      let closestDist = Infinity;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }
      setActiveIndex(closest);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [spreadIds]);

  return { activeIndex, visible };
}

function MagProgressRail({ spreadIds, activeIndex, visible }: { spreadIds: string[]; activeIndex: number; visible: boolean }) {
  const labels = spreadIds.map((id) => {
    const match = id.match(/-([^-]+)(?=-\d+$|$)/);
    return match?.[1]?.replace(/\d+/g, '')?.replace(/-/g, ' ')?.trim() ?? '';
  });

  return (
    <div className={`mag-progress-rail ${visible ? 'visible' : ''}`}>
      {spreadIds.map((id, idx) => (
        <button
          key={id}
          className={`mag-progress-rail-dot ${idx === activeIndex ? 'active' : ''}`}
          onClick={() => {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          aria-label={`Go to section ${idx + 1}`}
        >
          <span className="mag-progress-rail-label">{labels[idx] || `Section ${idx + 1}`}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Reading progress bar ── */
function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="mag-progress">
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

/* ── Sticky mini-header ── */
function StickyHeader({ issue, mood, theme, onToggleTheme }: { issue: MagazineIssue; mood: string; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const isLight = mood === "paper" || mood === "archive";
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
      }`}
      style={{
        background: isLight
          ? "color-mix(in srgb, var(--mag-surface) 92%, transparent)"
          : "color-mix(in srgb, var(--mag-bg) 92%, transparent)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--mag-rule-strong)",
      }}
    >
      <div className="max-w-[1160px] mx-auto px-6 h-12 flex items-center gap-4">
        <Link
          to="/magazine/issues"
          className="text-[11px] font-bold text-[var(--mag-text-muted)] hover:text-[var(--mag-accent)] transition-colors whitespace-nowrap"
        >
          ← Issues
        </Link>
        <div className="h-3 w-px bg-[var(--mag-rule-strong)]" />
        <span className="text-[12px] font-bold text-[var(--mag-text)] truncate flex-1">
          {issue.issueLabel} — {issue.title}
        </span>
        <button
          onClick={onToggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer hover:bg-[var(--mag-rule)] transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i className={theme === 'dark' ? 'ri-sun-line text-[var(--mag-text-muted)]' : 'ri-moon-line text-[var(--mag-text-muted)]'} style={{ fontSize: '16px' }} />
        </button>
      </div>
    </div>
  );
}

/* ── Bolt icon ── */
function Bolt({ className = "" }: { className?: string }) {
  return (
    <span className={`mag-bolt ${className}`} aria-hidden="true">
      <svg viewBox="121.5 0 20.5 30" focusable="false">
        <path fill="currentColor" d="M132.91,11.14l-7.87,18.73,15.96-17.97c.26-.29.05-.76-.34-.76h-7.75Z" />
        <path fill="currentColor" d="M130.72.18h6.59c.15.01.26.17.2.31-2.24,5.23-4.48,10.46-6.73,15.69l-6.74-.02c-.19,0-.32-.19-.24-.37l6.54-15.37c.06-.15.21-.25.37-.25Z" />
      </svg>
    </span>
  );
}

/* ── Logo ── */
function Masthead({ small = false, mood = "night" }: { small?: boolean; mood?: string }) {
  const isLight = mood === "paper" || mood === "archive";
  return (
    <img
      className={`magazine-logo ${small ? "small" : ""}`}
      src={isLight ? LOGO_LIGHT : LOGO_DARK}
      alt="WAKILISHA"
    />
  );
}

/* ── Seal ── */
function MagazineSeal({ size = "medium" }: { size?: "small" | "medium" | "cover" }) {
  const pathId = useId().replace(/:/g, "");
  return (
    <span className={`mag-seal ${size}`} aria-label="WAKILISHA field-record seal">
      <svg viewBox="0 0 100 100" role="img">
        <defs>
          <path id={`seal-ring-${pathId}`} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth=".5" />
        <text className="ring-text" fill="currentColor">
          <textPath href={`#seal-ring-${pathId}`} startOffset="0%">
            · RECORDED IN NAIROBI · WAKILISHA FIELD RECORD ·
          </textPath>
        </text>
        <g transform="translate(50,52) scale(1.5) translate(-132.4,-15)">
          <path fill="currentColor" d="M132.91,11.14l-7.87,18.73,15.96-17.97c.26-.29.05-.76-.34-.76h-7.75Z" />
          <path fill="currentColor" d="M130.72.18h6.59c.15.01.26.17.2.31-2.24,5.23-4.48,10.46-6.73,15.69l-6.74-.02c-.19,0-.32-.19-.24-.37l6.54-15.37c.06-.15.21-.25.37-.25Z" />
        </g>
      </svg>
    </span>
  );
}

/* ── Typography helpers ── */
function coverTitle(title: string) {
  if (title.toLowerCase() === "your people are here")
    return <><span>Your people</span><br />are <em>here.</em></>;
  const words = title.split(" ");
  const last = words.pop();
  return <>{words.join(" ")}<br /><em>{last}</em></>;
}
function splitEmphasis(text: string) {
  const words = text.split(" ");
  const last = words.pop();
  return <>{words.join(" ")} <em>{last}</em></>;
}
function sectionTitle(title: string) {
  const parts = title.split(" ");
  const last = parts.pop();
  return <>{parts.join(" ")}<br /><em>{last}</em></>;
}

/* ═══════════════════════ COVER ═══════════════════════ */
function IssueCover({ issue, editorial, mood }: { issue: MagazineIssue; editorial: MagazineEditorialSystem; mood: string }) {
  const bills = issue.articles.slice(0, 4);
  const coverImage = editorial.coverVariant === "image-trace"
    ? issue.articles.find((a) => a.heroUrl)?.heroUrl
    : null;

  return (
    <section className="magazine-spread mag-cover mag-reveal" id={`${issue.id}-cover`}>
      {coverImage && (
        <img className="mag-cover-trace" src={coverImage} alt="" />
      )}
      <div className="mag-cover-inner">
        <div className="mag-cover-masthead">
          <Masthead mood={mood} />
          <div className="mag-cover-row magazine-meta">
            <span>Magazine</span>
            <b>{issue.issueLabel} · {issue.sourceEndDate.getFullYear()}</b>
            <span>Nairobi, Kenya</span>
          </div>
        </div>
        <div className="mag-cover-center">
          {editorial.coverVariant !== "type-cover" && <MagazineSeal size="cover" />}
          <div className="mag-cover-eyebrow magazine-meta">{issue.subtitle}</div>
          <h1 className="mag-cover-title">{coverTitle(issue.title)}</h1>
          <p className="mag-cover-deck">{issue.deck}</p>
        </div>
        <div className="mag-cover-foot">
          <div className="mag-cover-bills">
            {bills.map((article, idx) => (
              <Link
                key={article.slug}
                to={`/magazine/${article.slug}`}
                className="mag-cover-bill"
              >
                <span className="n magazine-meta">
                  P.{String(14 + idx * 7).padStart(2, "0")}
                </span>
                <Bolt />
                <span>{article.title}</span>
              </Link>
            ))}
          </div>
          <div className="mag-cover-coords magazine-meta">
            {issue.sourceWindowLabel}
            <br />{editorial.coverVariant.replace(/-/g, " ")}
            <br /><b>WAKILISHA.AFRICA</b>
          </div>
        </div>
        <div className="mag-scroll-indicator">
          <span>Scroll to explore</span>
          <svg viewBox="0 0 24 38">
            <rect x="1" y="1" width="22" height="36" rx="11" />
            <circle cx="12" cy="10" r="3" fill="currentColor" />
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ EDITOR'S NOTE ═══════════════════════ */
function EditorsNoteSpread({ issue, editorial }: { issue: MagazineIssue; editorial: MagazineEditorialSystem }) {
  const note = editorial.editorNote;
  return (
    <section className="magazine-spread mag-reveal" id={`${issue.id}-editors-note`} style={{ background: "var(--mag-surface)" }}>
      <div className="mag-note">
        <aside className="mag-note-side">
          <div className="mag-note-label magazine-meta">{note.eyebrow}</div>
          <p className="mag-editor-name">{editorial.editor.name}</p>
          <p className="mag-editor-role">{editorial.editor.role}</p>
          <p>{issue.issueLabel} · {issue.sourceWindowLabel}</p>
          <p>{issue.primaryVerticals.slice(0, 3).join(" / ")}</p>
          {note.mode !== "image-note" && <MagazineSeal size="small" />}
        </aside>
        <div>
          {note.imageUrl && (
            <figure className="mag-editor-image">
              <img src={note.imageUrl} alt="" />
              <figcaption>{note.imageCaption}</figcaption>
            </figure>
          )}
          <p className="mag-note-open">{note.title}</p>
          {note.mode === "playlist-note" && note.playlist?.length ? (
            <div className="mag-editor-playlist">
              {note.playlist.map((item, idx) => (
                <Link key={item.slug} to={`/magazine/${item.slug}`}>
                  <span>{String(idx + 1).padStart(2, "0")}</span>
                  {item.title}
                </Link>
              ))}
            </div>
          ) : null}
          {note.mode === "song-note" && note.lovedRelease ? (
            <Link className="mag-editor-loved" to={`/magazine/${note.lovedRelease.slug}`}>
              <Bolt /> <span>{note.lovedRelease.title}</span>
            </Link>
          ) : null}
          <div className="mag-note-flow">
            {note.body.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
            {note.pull && <p className="mag-pull">{note.pull}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ CONTENTS ═══════════════════════ */
function ContentsSpread({ issue, editorial, mood }: { issue: MagazineIssue; editorial: MagazineEditorialSystem; mood: string }) {
  const sectionGroups = issue.spreads.filter((s) => s.type === "section-opener");
  const hero = issue.articles[0];
  return (
    <section className="magazine-spread mag-reveal" id={`${issue.id}-contents`} style={{ background: "var(--mag-surface)" }}>
      <div className="mag-toc">
        <div className="mag-toc-top">
          <Masthead small mood={mood} />
          <div className="magazine-meta" style={{ textAlign: "right", color: "var(--mag-text-muted)", lineHeight: 1.9 }}>
            Contents<br />{issue.issueLabel}<br />{issue.sourceWindowLabel}
          </div>
        </div>
        <h2 className="mag-toc-title">{splitEmphasis(editorial.contentsTitle)}</h2>
        <div className="mag-toc-lead">
          <div className="mag-toc-hero">
            Start here: <b>{hero?.title ?? issue.title}</b> — the piece that gives this issue its first pulse.
          </div>
          <div className="mag-toc-page">
            14
            <span>Cover feature</span>
          </div>
        </div>
        <div className="mag-toc-cols">
          {sectionGroups.map((section, idx) => (
            <div className="mag-toc-block" key={section.id}>
              <h3>
                <span style={{ color: "var(--mag-accent)", fontStyle: "normal" }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>{" "}
                {section.title}
              </h3>
              {(section.articles ?? []).slice(0, 4).map((article, articleIdx) => (
                <Link className="mag-toc-line" key={article.slug} to={`/magazine/${article.slug}`}>
                  <span>{articleIdx === 0 ? <b>{article.title}</b> : article.title}</span>
                  <span className="pg">{14 + idx * 8 + articleIdx}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ FEATURE ═══════════════════════ */
function FeatureSpread({ spread, issue, editorial }: { spread: MagazineSpread; issue: MagazineIssue; editorial: MagazineEditorialSystem }) {
  const article = spread.articles?.[0];
  if (!article) return null;
  return (
    <section className="magazine-spread mag-reveal" id={spread.id}>
      <div className="mag-feature-open">
        <MagazineGeneratedVisual issue={issue} spread={spread} article={article} editorialSystem={editorial} />
        <div className="mag-feature-content">
          <div className="mag-rail magazine-meta">
            <span>{editorial.featureFrame.eyebrow}</span>
            <Masthead small />
          </div>
          {editorial.featureFrame.routeLabel && (
            <div className="mag-route-label magazine-meta">{editorial.featureFrame.routeLabel}</div>
          )}
          <h2 className="mag-feature-title">{article.title}</h2>
          <p className="mag-feature-deck">{article.dek}</p>
        </div>
      </div>
      <div className="mag-feature-body">
        <div className="mag-copy">
          {sampleParagraphs(article).map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
        <aside className="mag-side-card">
          <h4>{editorial.featureFrame.titlePrefix ?? "Field note"}</h4>
          <p style={{ color: "var(--mag-text-muted)", fontSize: 12 }}>
            {editorial.featureFrame.fieldNote}
          </p>
          <h4 style={{ marginTop: 20 }}>Related record</h4>
          {(spread.articles ?? []).slice(0, 4).map((item) => (
            <div className="mag-side-item" key={item.slug}>
              <Link to={`/magazine/${item.slug}`}>{item.title}</Link>
              <p>{item.canonicalSection} · {item.readingTime} min</p>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
function sampleParagraphs(article: MagazineIssueArticle) {
  const body = article.body?.filter(Boolean) ?? [];
  if (body.length >= 4) return body.slice(0, 6);
  return [
    article.dek || "This story anchors a larger cultural signal inside the issue.",
    "The magazine engine treats this feature as the issue's strongest available entry point.",
    "What matters is the movement: scenes, records, language, places, rights, and the people carrying them into memory.",
  ];
}

/* ═══════════════════════ FULL-BLEED IMAGE ═══════════════════════ */
function FullBleedImageSpread({ spread }: { spread: MagazineSpread }) {
  const article = spread.articles?.[0];
  if (!article?.heroUrl) return null;
  return (
    <section
      id={spread.id}
      className={`magazine-spread mag-reveal mag-fullbleed mag-fullbleed-${spread.variant ?? "title-overlay"}`}
      style={{ ["--section-accent" as string]: spread.accent ?? "var(--mag-accent)" } as React.CSSProperties}
    >
      <img src={article.heroUrl} alt="" />
      <div className="mag-fullbleed-shade" />
      <div className="mag-fullbleed-copy">
        <div className="magazine-meta">{spread.eyebrow ?? "Image record"}</div>
        <h2>{article.title}</h2>
        <p>{article.dek}</p>
      </div>
    </section>
  );
}

/* ═══════════════════════ QUOTE-ONLY ═══════════════════════ */
function QuoteOnlySpread({ spread }: { spread: MagazineSpread }) {
  const article = spread.articles?.[0];
  return (
    <section
      id={spread.id}
      className={`magazine-spread mag-reveal mag-quote-only mag-quote-${spread.variant ?? "accent"}`}
      style={{ ["--section-accent" as string]: spread.accent ?? "var(--mag-accent)" } as React.CSSProperties}
    >
      <div className="mag-quote-inner">
        <div className="magazine-meta">{spread.eyebrow ?? "Quote"}</div>
        <blockquote>"{spread.title}"</blockquote>
        {article && (
          <Link to={`/magazine/${article.slug}`}>From {article.title}</Link>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════ COLOR INTERLUDE ═══════════════════════ */
function ColorInterludeSpread({ spread }: { spread: MagazineSpread }) {
  return (
    <section
      id={spread.id}
      className="magazine-spread mag-reveal mag-color-interlude"
      style={{ ["--section-accent" as string]: spread.accent ?? "var(--mag-accent)" } as React.CSSProperties}
    >
      <div className="mag-color-interlude-inner">
        <div className="magazine-meta">{spread.eyebrow ?? "Interlude"}</div>
        <h2>{splitEmphasis(spread.title)}</h2>
        <p>{spread.deck}</p>
        {spread.articles?.[0] && (
          <Link to={`/magazine/${spread.articles[0].slug}`}>Open the first record →</Link>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════ SIGNAL ═══════════════════════ */
function SignalSpread({ spread, editorial }: { spread: MagazineSpread; editorial: MagazineEditorialSystem }) {
  const articles = spread.articles ?? [];
  return (
    <section id={spread.id} className="magazine-spread mag-reveal">
      <div className="mag-signal">
        <div className="mag-rail magazine-meta">
          <span>The Signal · Cultural Intelligence</span>
          <Masthead small />
        </div>
        <div className="mag-signal-head">
          <h2>{splitEmphasis(editorial.signalTitle)}</h2>
        </div>
        <div className="mag-signal-lead">
          <div className="mag-signal-big">{Math.min(articles.length, 12)}×</div>
          <div className="mag-signal-text">{editorial.signalDeck}</div>
          <MagazineSeal />
        </div>
        <div className="magazine-meta" style={{ color: "var(--mag-text-muted)" }}>
          Top issue signals · not a leaderboard
        </div>
        <div className="mag-ownership-bar">
          {articles.slice(0, 12).map((_, idx) => (
            <span key={idx}>{idx + 1}</span>
          ))}
        </div>
        <div className="mag-signal-grid">
          <div>
            {articles.slice(0, 12).map((article, idx) => (
              <Link className="mag-chart-row" key={article.slug} to={`/magazine/${article.slug}`}>
                <span className="rank">{String(idx + 1).padStart(2, "0")}</span>
                <span>
                  <h4>{article.title}</h4>
                  <p>{article.section} · {article.author}</p>
                </span>
                <span className="magazine-meta" style={{ color: "var(--mag-accent)" }}>
                  {article.role}
                </span>
              </Link>
            ))}
          </div>
          <div>
            <div className="mag-finding">
              <h4>Finding 01 · Pattern</h4>
              <p>The issue is read as a cluster of evidence, not a content dump.</p>
            </div>
            <div className="mag-finding">
              <h4>Finding 02 · Longevity</h4>
              <p>Evergreen articles carry more weight than expired announcements.</p>
            </div>
            <div className="mag-finding">
              <h4>Finding 03 · Editorial choice</h4>
              <p>The NLG layer changes the language and framing by issue mood.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ SECTION OPENER ═══════════════════════ */
function SectionOpener({ spread, index, mood }: { spread: MagazineSpread; index: number; mood: string }) {
  const isPaper = spread.variant === "paper-cut";
  return (
    <section
      id={spread.id}
      className={`magazine-spread mag-reveal mag-section ${isPaper ? "mag-section-paper" : ""}`}
      style={{ ["--section-accent" as string]: spread.accent ?? "var(--mag-accent)" } as React.CSSProperties}
    >
      <div className="mag-section-number">{String(index + 1).padStart(2, "0")}</div>
      <div className="mag-section-inner">
        <div className="mag-rail magazine-meta">
          <span>{spread.eyebrow} · {spread.title}</span>
          <Masthead small mood={isPaper ? "paper" : mood} />
        </div>
        <h2 className="mag-section-title">{sectionTitle(spread.title)}</h2>
        <p className="mag-section-deck">{spread.deck}</p>
      </div>
    </section>
  );
}

/* ═══════════════════════ HORIZONTAL ARTICLE STRIP ═══════════════════════ */
function ArticleListSpread({ spread }: { spread: MagazineSpread }) {
  const isLight = spread.variant === "editorial-list";
  const articles = spread.articles ?? [];
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onScroll = () => {
      const scrollLeft = strip.scrollLeft;
      const cardWidth = strip.firstElementChild?.clientWidth ?? window.innerWidth;
      const idx = Math.round(scrollLeft / cardWidth);
      setActiveCard(Math.min(idx, articles.length - 1));
    };
    strip.addEventListener("scroll", onScroll, { passive: true });
    return () => strip.removeEventListener("scroll", onScroll);
  }, [articles.length]);

  return (
    <section id={spread.id} className={`magazine-spread mag-reveal ${isLight ? "mag-article-list-paper" : ""}`}>
      <div className="mag-article-list">
        <div className="mag-article-list-header">
          <div>
            <div className="magazine-meta">{spread.title}</div>
            <h2>{splitEmphasis(spread.deck ?? "In this section")}</h2>
          </div>
          <div className="magazine-meta">
            {articles.length} records
          </div>
        </div>
        <div className="mag-horizontal-strip" ref={stripRef}>
          {articles.map((article, idx) => (
            <ArticleCard key={article.slug} article={article} index={idx} total={articles.length} />
          ))}
          <div className="mag-horizontal-strip-nav">
            {articles.map((_, idx) => (
              <span key={idx} className={idx === activeCard ? "active" : ""} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArticleCard({ article, index, total }: { article: MagazineIssueArticle; index: number; total: number }) {
  return (
    <Link className="mag-article-card" to={`/magazine/${article.slug}`}>
      {article.heroUrl && <img src={article.heroUrl} alt="" loading="lazy" />}
      <div>
        <div className="magazine-meta">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
        <h4>{article.title}</h4>
        <p>{article.dek}</p>
      </div>
    </Link>
  );
}

/* ═══════════════════════ GUIDE ═══════════════════════ */
function GuideSpread({ spread }: { spread: MagazineSpread }) {
  const article = spread.articles?.[0];
  return (
    <section id={spread.id} className="magazine-spread mag-reveal">
      <div className="mag-guide">
        <div className="mag-guide-hero">
          <div>
            <div className="magazine-meta" style={{ color: "var(--mag-accent-hi)", marginBottom: 14 }}>
              WAKILISHA Field Guides
            </div>
            <h2 className="mag-guide-title">{article?.title ?? spread.title}</h2>
          </div>
        </div>
        <div className="mag-guide-body">
          <div>
            <p>{article?.dek ?? spread.deck}</p>
            <p>Guides should feel like something you carry through a city, festival, room or argument.</p>
          </div>
          <aside className="mag-guide-card">
            <MagazineSeal size="small" />
            <p style={{ marginTop: 14 }}>Dossier · at a glance</p>
            <p>Source: {spread.section}</p>
            <p>Format: Carryable field document</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ REVIEWS ═══════════════════════ */
function ReviewSpread({ spread }: { spread: MagazineSpread }) {
  const [hero, ...rest] = spread.articles ?? [];
  return (
    <section id={spread.id} className="magazine-spread mag-reveal">
      <div className="mag-reviews">
        {hero && (
          <div className="mag-review-hero">
            {hero.heroUrl && <img src={hero.heroUrl} alt="" />}
            <div className="mag-review-copy">
              <div className="magazine-meta" style={{ color: "var(--mag-accent-hi)", marginBottom: 16 }}>
                On Record · The Verdict
              </div>
              <h2 className="mag-reviews-title">{hero.title}</h2>
              <p style={{ color: "var(--mag-text-soft)", marginTop: 18, fontFamily: "var(--mag-display)", fontStyle: "italic", fontSize: 19 }}>
                {hero.dek}
              </p>
            </div>
          </div>
        )}
        {rest.slice(0, 4).map((article) => (
          <Link className="mag-review-row" key={article.slug} to={`/magazine/${article.slug}`}>
            {article.heroUrl && <img src={article.heroUrl} alt="" />}
            <span>
              <b>{article.title}</b>
              <br /><small>{article.author}</small>
            </span>
            <span className="magazine-meta" style={{ color: "var(--mag-accent)" }}>
              {article.readingTime}/min
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════ PARTNER ═══════════════════════ */
function PartnerSpread({ spreadId }: { spreadId?: string }) {
  return (
    <section id={spreadId} className="magazine-spread mag-reveal">
      <div className="mag-partner">
        <div className="magazine-meta" style={{ color: "var(--mag-accent)", marginBottom: 18 }}>
          This section is made possible by
        </div>
        <h2>
          Cultural <em>Partner</em>
        </h2>
        <p>
          Patronage, not interruption. Magazine ad surfaces should feel like cultural support, not banner inventory.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════ BACK MATTER ═══════════════════════ */
function BackMatterSpread({ issue, editorial }: { issue: MagazineIssue; editorial: MagazineEditorialSystem }) {
  return (
    <section id={`${issue.id}-back`} className="magazine-spread mag-reveal">
      <div className="mag-back">
        <MagazineSeal size="cover" />
        <h2 className="mag-back-title">{splitEmphasis(editorial.backMatterLine)}</h2>
        <p>
          {issue.articles.length} selected pieces. {issue.excludedArticles.length} stale or review-flagged pieces held
          out of the issue. Source window: {issue.sourceWindowLabel}.
        </p>
        <div className="magazine-meta" style={{ color: "var(--mag-accent)", marginTop: 24 }}>
          WAKILISHA.AFRICA
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ BASE SPREAD RENDERER ═══════════════════════ */
function RenderSpread({
  spread,
  issue,
  editorial,
  index,
  mood,
}: {
  spread: MagazineSpread;
  issue: MagazineIssue;
  editorial: MagazineEditorialSystem;
  index: number;
  mood: string;
}) {
  switch (spread.type) {
    case "cover":
      return <IssueCover issue={issue} editorial={editorial} mood={mood} />;
    case "editors-note":
      return <EditorsNoteSpread issue={issue} editorial={editorial} />;
    case "contents":
      return <ContentsSpread issue={issue} editorial={editorial} mood={mood} />;
    case "feature":
      return <FeatureSpread spread={spread} issue={issue} editorial={editorial} />;
    case "signal":
      return <SignalSpread spread={spread} editorial={editorial} />;
    case "full-bleed-image":
      return <FullBleedImageSpread spread={spread} />;
    case "quote-only":
      return <QuoteOnlySpread spread={spread} />;
    case "color-interlude":
      return <ColorInterludeSpread spread={spread} />;
    case "section-opener":
      return <SectionOpener spread={spread} index={index} mood={mood} />;
    case "guide":
      return <GuideSpread spread={spread} />;
    case "review":
      return <ReviewSpread spread={spread} />;
    case "partner":
      return <PartnerSpread spreadId={spread.id} />;
    case "back-matter":
      return <BackMatterSpread issue={issue} editorial={editorial} />;
    case "article-list":
      return <ArticleListSpread spread={spread} />;
    default:
      return null;
  }
}

/* ═══════════════════════ SITE CONTENT INJECTOR ═══════════════════════ */
function injectRegistrySpreads(
  spreads: MagazineSpread[],
  siteContent: SiteContentResponse | null,
  mood: string,
  issueId: string,
) {
  if (!siteContent) return spreads;
  const hasArtists = siteContent.artists.length > 0;
  const hasReleases = siteContent.releases.length > 0;
  const hasCharts = siteContent.chartHighlights.length > 0;
  if (!hasArtists && !hasReleases && !hasCharts) return spreads;
  const result: (MagazineSpread | { type: "registry-artist" | "registry-release" | "registry-chart"; id: string })[] = [...spreads];
  const featureIdx = result.findIndex((s) => s.type === "feature");
  if (hasArtists && featureIdx >= 0) {
    result.splice(featureIdx + 2, 0, { type: "registry-artist", id: `${issueId}-registry-artist` });
  }
  if (hasReleases) {
    const midway = Math.floor(result.length / 2);
    result.splice(midway, 0, { type: "registry-release", id: `${issueId}-registry-release` });
  }
  if (hasCharts) {
    const signalIdx = result.findIndex((s) => s.type === "signal");
    const insertAt = signalIdx >= 0 ? signalIdx + 1 : result.length - 2;
    result.splice(insertAt, 0, { type: "registry-chart", id: `${issueId}-registry-chart` });
  }
  return result;
}

/* ═══════════════════════ NEW SCHOOL-AWARE SPREADS ═══════════════════════ */

function TypographicPosterSpread({ spread, issue }: { spread: MagazineSpread; issue: MagazineIssue }) {
  const article = spread.articles?.[0];
  const headline = article?.title ?? spread.title;
  const words = headline.split(' ');
  const firstLine = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const secondLine = words.slice(Math.ceil(words.length / 2)).join(' ');
  return (
    <section id={spread.id} className="magazine-spread mag-spread-typographic-poster mag-reveal">
      <div className="mag-typographic-poster-giant-bg" aria-hidden="true">
        {headline.charAt(0)}
      </div>
      <p className="mag-typographic-poster-sub">{spread.eyebrow ?? 'Cover statement'}</p>
      <h2 className="mag-typographic-poster-headline">
        <span style={{ display: 'block' }}>{firstLine}</span>
        <span style={{ display: 'block', color: 'var(--mag-accent)' }}>{secondLine}</span>
      </h2>
      {article && (
        <Link
          to={`/magazine/${article.slug}`}
          className="mt-8 inline-flex items-center gap-3 text-[13px] font-bold uppercase tracking-widest whitespace-nowrap cursor-pointer"
          style={{ color: 'var(--mag-text-muted)', fontFamily: 'var(--mag-mono)', position: 'relative', zIndex: 2 }}
        >
          Read the feature <i className="ri-arrow-right-line" />
        </Link>
      )}
    </section>
  );
}

function NumberMonumentSpread({ spread, issue }: { spread: MagazineSpread; issue: MagazineIssue }) {
  const count = spread.articles?.length ?? issue.articles.length;
  return (
    <section id={spread.id} className="magazine-spread mag-spread-number-monument mag-reveal">
      <div className="mag-number-monument-bg" aria-hidden="true">{count}</div>
      <div className="mag-number-monument-content">
        <div className="magazine-meta" style={{ color: 'var(--mag-accent)', marginBottom: 20 }}>
          {spread.eyebrow ?? 'Field count'}
        </div>
        <h2 style={{ fontFamily: 'var(--mag-display)', fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 700, lineHeight: 1, color: 'var(--mag-text)', letterSpacing: '-0.03em' }}>
          {count} {spread.title ?? 'stories in this issue'}
        </h2>
        <p style={{ color: 'var(--mag-text-soft)', fontFamily: 'var(--mag-body)', fontSize: 18, lineHeight: 1.5, marginTop: 20, maxWidth: 500 }}>
          {spread.deck ?? 'A field record drawn from the cultural signals of the window.'}
        </p>
      </div>
    </section>
  );
}

function TypeSpecimenSpread({ spread, issue }: { spread: MagazineSpread; issue: MagazineIssue }) {
  const sizes = [
    { size: '120', label: 'Display / Cover', text: issue.title.split(' ').slice(0, 2).join(' ') },
    { size: '72', label: 'Feature headline', text: issue.title.split(' ').slice(0, 3).join(' ') },
    { size: '42', label: 'Section opener', text: issue.subtitle ?? issue.primaryVerticals[0] },
    { size: '28', label: 'Sub-headline', text: issue.deck?.slice(0, 48) ?? 'Field record of African creative life' },
    { size: '18', label: 'Body / lead', text: 'The culture leaves a trace when the room remembers.' },
    { size: '14', label: 'Caption / meta', text: 'WAKILISHA FIELD RECORD · NAIROBI, KENYA · ' + issue.issueLabel },
  ];
  return (
    <section id={spread.id} className="magazine-spread mag-spread-type-specimen mag-reveal">
      <div className="magazine-meta" style={{ color: 'var(--mag-accent)', marginBottom: 32 }}>
        {spread.eyebrow ?? 'Type specimen'} · {issue.issueLabel}
      </div>
      {sizes.map(({ size, label, text }) => (
        <div key={size} className="mag-type-specimen-row">
          <span className="mag-type-specimen-size">{size}px</span>
          <span
            className="mag-type-specimen-sample"
            style={{ fontSize: `clamp(${Math.max(14, parseInt(size) * 0.4)}px, ${parseFloat(size) * 0.08}vw, ${size}px)` }}
          >
            {text}
          </span>
          <span className="magazine-meta" style={{ color: 'var(--mag-text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
            {label}
          </span>
        </div>
      ))}
    </section>
  );
}

function DataVisualizationSpread({ spread, issue }: { spread: MagazineSpread; issue: MagazineIssue }) {
  const articles = spread.articles ?? issue.articles.slice(0, 8);
  const maxScore = Math.max(...articles.map((a) => (a as MagazineIssueArticle).score ?? 50));
  return (
    <section id={spread.id} className="magazine-spread mag-spread-data-viz mag-reveal">
      <div className="magazine-meta" style={{ color: 'var(--mag-accent)', marginBottom: 24 }}>
        Signal map · {spread.eyebrow ?? 'Cultural intelligence'}
      </div>
      <h2 style={{ fontFamily: 'var(--mag-display)', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 40, color: 'var(--mag-text)' }}>
        {spread.title ?? 'The issue at a glance'}
      </h2>
      <div className="mag-data-chart">
        <div className="mag-data-chart-header">
          <span>Article</span>
          <span>Signal strength</span>
        </div>
        {articles.slice(0, 8).map((article, idx) => {
          const score = (article as MagazineIssueArticle).score ?? 50;
          const pct = Math.round((score / maxScore) * 100);
          return (
            <div key={article.slug} className="mag-data-bar-row">
              <span className="mag-data-bar-label">{String(idx + 1).padStart(2, '0')} · {article.section?.slice(0, 14) ?? 'Field'}</span>
              <div className="mag-data-bar-track">
                <div
                  className="mag-data-bar-fill"
                  style={{ width: `${pct}%`, animationDelay: `${idx * 0.08}s` }}
                />
              </div>
              <span className="mag-data-bar-value">{pct}%</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PatternFieldSpread({ spread }: { spread: MagazineSpread }) {
  return (
    <section id={spread.id} className="magazine-spread mag-spread-pattern-field mag-reveal">
      <div className="mag-pattern-field-bg" aria-hidden="true" />
      <div className="mag-pattern-field-content">
        <div className="magazine-meta" style={{ color: 'var(--mag-accent)', marginBottom: 24 }}>
          {spread.eyebrow ?? 'Interlude'}
        </div>
        <h2 style={{ fontFamily: 'var(--mag-display)', fontSize: 'clamp(44px, 9vw, 120px)', fontWeight: 800, lineHeight: 0.86, letterSpacing: '-0.04em', color: 'var(--mag-text)' }}>
          {spread.title}
        </h2>
        <p style={{ fontFamily: 'var(--mag-body)', fontSize: 20, lineHeight: 1.5, color: 'var(--mag-text-soft)', marginTop: 24, maxWidth: 500 }}>
          {spread.deck}
        </p>
      </div>
    </section>
  );
}

function GridManifestoSpread({ spread, issue }: { spread: MagazineSpread; issue: MagazineIssue }) {
  const articles = spread.articles ?? issue.articles.slice(0, 6);
  return (
    <section id={spread.id} className="magazine-spread mag-spread-grid-manifesto mag-reveal">
      <div className="mag-grid-manifesto-cell featured">
        <div>
          <div className="magazine-meta" style={{ marginBottom: 8, opacity: 0.7, fontSize: 9 }}>
            {spread.eyebrow ?? issue.issueLabel}
          </div>
          <div style={{ fontFamily: 'var(--mag-display)' }}>{spread.title ?? issue.title}</div>
        </div>
      </div>
      {articles.map((article, idx) => (
        <Link
          key={article.slug}
          to={`/magazine/${article.slug}`}
          className="mag-grid-manifesto-cell"
          style={{ gridColumn: idx === 0 ? 'span 2' : undefined }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'var(--mag-display)', fontSize: 13, color: 'var(--mag-text)', fontWeight: 500, lineHeight: 1.2 }}>
              {article.title.slice(0, 40)}
            </span>
            <span>{article.section?.slice(0, 14)}</span>
          </div>
        </Link>
      ))}
      {Array.from({ length: Math.max(0, 16 - articles.length - 1) }).map((_, i) => (
        <div key={`empty-${i}`} className="mag-grid-manifesto-cell" />
      ))}
    </section>
  );
}

function ArchiveWallSpread({ spread }: { spread: MagazineSpread }) {
  const articles = spread.articles ?? [];
  const withImages = articles.filter((a) => a.heroUrl);
  return (
    <section id={spread.id} className="magazine-spread mag-spread-archive-wall mag-reveal">
      {withImages.slice(0, 12).map((article, idx) => (
        <Link key={article.slug} to={`/magazine/${article.slug}`} className="mag-archive-wall-cell">
          <img src={article.heroUrl} alt={article.title} loading="lazy" />
          <div className="mag-archive-wall-caption">{article.section} · {article.readingTime}min</div>
        </Link>
      ))}
      {Array.from({ length: Math.max(0, 12 - withImages.length) }).map((_, i) => (
        <div key={`placeholder-${i}`} className="mag-archive-wall-cell" style={{ background: 'var(--mag-surface-raised)' }} />
      ))}
    </section>
  );
}

function TextureInterludeSpread({ spread }: { spread: MagazineSpread }) {
  return (
    <section id={spread.id} className="magazine-spread mag-spread-texture-interlude mag-reveal">
      <div className="mag-texture-interlude-inner">
        <div className="magazine-meta" style={{ color: 'var(--mag-accent)', marginBottom: 20 }}>
          {spread.eyebrow ?? 'Pause'}
        </div>
        <h3 style={{ fontFamily: 'var(--mag-display)', fontSize: 'clamp(36px, 7vw, 80px)', fontWeight: 700, lineHeight: 0.9, letterSpacing: '-0.03em', color: 'var(--mag-text)' }}>
          {spread.title}
        </h3>
        {spread.deck && (
          <p style={{ fontFamily: 'var(--mag-body)', fontSize: 18, lineHeight: 1.5, color: 'var(--mag-text-soft)', marginTop: 20, maxWidth: 500 }}>
            {spread.deck}
          </p>
        )}
      </div>
    </section>
  );
}

function PhotoEssaySpread({ spread }: { spread: MagazineSpread }) {
  const articles = (spread.articles ?? []).filter((a) => a.heroUrl);
  if (articles.length < 2) return <FullBleedImageSpread spread={spread} />;
  return (
    <section id={spread.id} className="magazine-spread mag-spread-photo-essay mag-reveal">
      {articles.slice(0, 2).map((article) => (
        <Link key={article.slug} to={`/magazine/${article.slug}`} className="relative overflow-hidden block" style={{ height: '100%', minHeight: '50vh' }}>
          <img src={article.heroUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 28px', background: 'linear-gradient(transparent, rgba(0,0,0,.75))', color: '#fff' }}>
            <div className="magazine-meta" style={{ marginBottom: 8, opacity: 0.8 }}>{article.section}</div>
            <h4 style={{ fontFamily: 'var(--mag-display)', fontSize: 'clamp(18px, 2.5vw, 28px)', lineHeight: 1.1, fontWeight: 400 }}>{article.title}</h4>
          </div>
        </Link>
      ))}
    </section>
  );
}

/* ═══════════════════════ EXTENDED SPREAD RENDERER ═══════════════════════ */
function RenderSpreadExtended({
  spread,
  issue,
  editorial,
  index,
  mood,
  artDirectorSchool,
}: {
  spread: MagazineSpread;
  issue: MagazineIssue;
  editorial: MagazineEditorialSystem;
  index: number;
  mood: string;
  artDirectorSchool: string;
}) {
  // New school-specific spread types
  switch (spread.type) {
    case 'typographic-poster':
      return <TypographicPosterSpread spread={spread} issue={issue} />;
    case 'number-monument':
      return <NumberMonumentSpread spread={spread} issue={issue} />;
    case 'type-specimen':
      return <TypeSpecimenSpread spread={spread} issue={issue} />;
    case 'data-visualization':
      return <DataVisualizationSpread spread={spread} issue={issue} />;
    case 'pattern-field':
      return <PatternFieldSpread spread={spread} />;
    case 'grid-manifesto':
      return <GridManifestoSpread spread={spread} issue={issue} />;
    case 'archive-wall':
      return <ArchiveWallSpread spread={spread} />;
    case 'texture-interlude':
      return <TextureInterludeSpread spread={spread} />;
    case 'photo-essay':
      return <PhotoEssaySpread spread={spread} />;
    default:
      return (
        <RenderSpread
          spread={spread}
          issue={issue}
          editorial={editorial}
          index={index}
          mood={mood}
        />
      );
  }
}

/* ═══════════════════════ SCHOOL BADGE ═══════════════════════ */
function SchoolBadge({ schoolName, isLight }: { schoolName: string; isLight: boolean }) {
  const LABELS: Record<string, string> = {
    swiss: 'Swiss Grid',
    modernist_poster: 'Modernist Poster',
    memphis_postmodern: 'Memphis',
    luxury_fashion_editorial: 'Fashion Editorial',
    japanese_minimal: 'Japanese Minimal',
    information_design: 'Information Design',
    folk_vernacular: 'Folk Vernacular',
    editorial_magazine: 'Editorial Magazine',
    brutalist_web: 'Brutalist Web',
    bauhaus: 'Bauhaus',
  };
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: 28,
        zIndex: 90,
        fontFamily: 'var(--mag-mono)',
        fontSize: 9,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--mag-text-muted)',
        border: '1px solid var(--mag-rule-strong)',
        borderRadius: 4,
        padding: '6px 12px',
        background: 'var(--mag-surface)',
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
      }}
    >
      Art direction: {LABELS[schoolName] ?? schoolName}
    </div>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function MagazineIssuePage() {
  const { issueKey } = useParams<{ issueKey: string }>();
  const { articles, loading, error } = useMagazineArticles();
  const { content: siteContent } = useSiteContent();
  const { theme, toggle: toggleTheme } = useTheme();

  const [spreadIds, setSpreadIds] = useState<string[]>([]);

  useScrollReveal(!loading);

  const { activeIndex, visible } = useProgressRail(spreadIds);

  // Resolve issue number for art director
  const issueNumber = useMemo(() => {
    if (!issueKey) return 1;
    const match = issueKey.match(/issue-0*(\d+)/);
    if (match) return parseInt(match[1], 10);
    return 1;
  }, [issueKey]);

  // Art director wires visual identity per issue — user theme preference overrides school default
  const { tokens, brief, issueClass, cssVars, isLight, schoolDisplayName } = useArtDirector(issueNumber, theme);

  // Inject per-issue font dynamically
  useEffect(() => {
    const SCHOOL_FONTS_URLS: Record<string, string> = {
      swiss: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
      modernist_poster: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap',
      memphis_postmodern: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=DM+Mono:wght@400;500&display=swap',
      luxury_fashion_editorial: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=DM+Mono:wght@400&display=swap',
      japanese_minimal: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap',
      information_design: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap',
      folk_vernacular: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;1,9..144,300;1,9..144,400;1,9..144,700&family=DM+Mono:wght@400&display=swap',
      editorial_magazine: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400&display=swap',
      brutalist_web: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap',
      bauhaus: 'https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400&family=DM+Mono:wght@400&display=swap',
    };
    const url = SCHOOL_FONTS_URLS[brief.primarySchool];
    if (!url) return;
    const existing = document.querySelector(`link[href="${url}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    return () => { /* leave font loaded */ };
  }, [brief.primarySchool]);

  if (loading) return <SkeletonMagazinePage />;
  if (error) return <MagazineIssueError message={error} />;

  const issues = buildMagazineIssues(articles);
  const issue = resolveIssueByKey(issues, issueKey);
  if (!issue) return <MagazineIssueError message="This issue has no stories yet." />;

  const editorial = buildIssueEditorialSystem(issue);
  const { previousIssue, nextIssue } = getAdjacentIssues(issues, issue);

  const enrichedSpreads = injectRegistrySpreads(issue.spreads, siteContent, editorial.issueMood, issue.id);

  // Inject school-specific spreads based on art director tokens
  const schoolSpreads = injectSchoolSpreads(enrichedSpreads, brief.primarySchool, issue);

  const computedIds = schoolSpreads.map((s) => s.id);
  if (JSON.stringify(computedIds) !== JSON.stringify(spreadIds)) {
    setSpreadIds(computedIds);
  }

  return (
    <main className={issueClass} style={cssVars}>
      <ReadingProgress />
      <StickyHeader issue={issue} mood={editorial.issueMood} theme={theme} onToggleTheme={toggleTheme} />
      <MagProgressRail spreadIds={spreadIds} activeIndex={activeIndex} visible={visible} />
      <SchoolBadge schoolName={brief.primarySchool} isLight={isLight} />

      <div className="magazine-shell">
        <div className="flex items-center justify-between gap-4 mb-0">
          <Link to="/magazine/issues" className="magazine-backlink">
            ← Browse all issues
          </Link>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 text-[12px] font-bold text-[var(--mag-text-muted)] hover:text-[var(--mag-accent)] transition-colors whitespace-nowrap cursor-pointer"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <i className={theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} style={{ fontSize: '15px' }} />
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {schoolSpreads.map((spread, index) => {
          if ("articles" in spread || spread.type === "cover" || spread.type === "editors-note" || spread.type === "contents" || spread.type === "feature" || spread.type === "signal" || spread.type === "full-bleed-image" || spread.type === "quote-only" || spread.type === "color-interlude" || spread.type === "section-opener" || spread.type === "guide" || spread.type === "review" || spread.type === "partner" || spread.type === "back-matter" || spread.type === "article-list" || spread.type === "typographic-poster" || spread.type === "number-monument" || spread.type === "type-specimen" || spread.type === "data-visualization" || spread.type === "pattern-field" || spread.type === "grid-manifesto" || spread.type === "archive-wall" || spread.type === "texture-interlude" || spread.type === "photo-essay" || spread.type === "split-screen") {
            return (
              <RenderSpreadExtended
                key={spread.id}
                spread={spread as MagazineSpread}
                issue={issue}
                editorial={editorial}
                index={index}
                mood={editorial.issueMood}
                artDirectorSchool={brief.primarySchool}
              />
            );
          }

          if (spread.type === "registry-artist") {
            return (
              <ArtistSpotlightSpread
                key={spread.id}
                artists={siteContent.artists}
                mood={editorial.issueMood}
              />
            );
          }

          if (spread.type === "registry-release") {
            return (
              <ReleaseSpotlightSpread
                key={spread.id}
                releases={siteContent.releases}
                mood={editorial.issueMood}
              />
            );
          }

          if (spread.type === "registry-chart") {
            return (
              <ChartHighlightSpread
                key={spread.id}
                highlights={siteContent.chartHighlights}
                mood={editorial.issueMood}
              />
            );
          }

          return null;
        })}

        <nav className="mag-nav">
          <span>
            {previousIssue && (
              <Link to={issueUrl(previousIssue)}>← {previousIssue.issueLabel}</Link>
            )}
          </span>
          <span>
            {nextIssue && (
              <Link to={issueUrl(nextIssue)}>{nextIssue.issueLabel} →</Link>
            )}
          </span>
        </nav>
      </div>
    </main>
  );
}

/* ═══════════════════════ SCHOOL SPREAD INJECTOR ═══════════════════════ */
function injectSchoolSpreads(
  spreads: Array<MagazineSpread | { type: string; id: string }>,
  schoolName: string,
  issue: MagazineIssue,
): Array<MagazineSpread | { type: string; id: string }> {
  const result = [...spreads];
  const featureIdx = result.findIndex((s) => s.type === 'feature');
  const backIdx = result.findIndex((s) => s.type === 'back-matter');

  // Swiss / Brutalist — inject grid manifesto after contents
  if (schoolName === 'swiss' || schoolName === 'brutalist_web') {
    const contentsIdx = result.findIndex((s) => s.type === 'contents');
    if (contentsIdx >= 0) {
      result.splice(contentsIdx + 2, 0, {
        type: 'grid-manifesto',
        id: `${issue.id}-grid-manifesto`,
        title: issue.title,
        eyebrow: issue.issueLabel,
        articles: issue.articles.slice(0, 6),
        deck: issue.deck,
      } as MagazineSpread);
    }
  }

  // Modernist Poster — inject typographic poster after feature
  if (schoolName === 'modernist_poster' && featureIdx >= 0) {
    const coverArticle = issue.articles[0];
    result.splice(featureIdx + 1, 0, {
      type: 'typographic-poster',
      id: `${issue.id}-type-poster`,
      title: issue.title,
      eyebrow: issue.issueLabel + ' · Cover statement',
      articles: coverArticle ? [coverArticle] : [],
    } as MagazineSpread);
  }

  // Bauhaus / Information Design — inject number monument before back matter
  if ((schoolName === 'bauhaus' || schoolName === 'information_design') && backIdx >= 0) {
    result.splice(backIdx, 0, {
      type: 'number-monument',
      id: `${issue.id}-number-monument`,
      title: 'stories in this issue',
      eyebrow: 'Field count',
      deck: issue.deck,
      articles: issue.articles,
    } as MagazineSpread);
  }

  // Brutalist Web — inject type specimen
  if (schoolName === 'brutalist_web' && backIdx >= 0) {
    result.splice(backIdx, 0, {
      type: 'type-specimen',
      id: `${issue.id}-type-specimen`,
      title: 'Type specimen',
      eyebrow: issue.issueLabel,
    } as MagazineSpread);
  }

  // Information Design — inject data visualization after signal
  if (schoolName === 'information_design') {
    const signalIdx = result.findIndex((s) => s.type === 'signal');
    if (signalIdx >= 0) {
      result.splice(signalIdx + 1, 0, {
        type: 'data-visualization',
        id: `${issue.id}-data-viz`,
        title: 'Signal strength by article',
        eyebrow: 'Cultural intelligence',
        articles: issue.articles.slice(0, 8),
      } as MagazineSpread);
    }
  }

  // Memphis / Folk — inject pattern field before back matter
  if ((schoolName === 'memphis_postmodern' || schoolName === 'folk_vernacular') && backIdx >= 0) {
    result.splice(backIdx, 0, {
      type: 'pattern-field',
      id: `${issue.id}-pattern-field`,
      title: issue.title,
      eyebrow: 'Interlude',
      deck: issue.deck,
    } as MagazineSpread);
  }

  // Folk Vernacular — inject archive wall
  if (schoolName === 'folk_vernacular') {
    const withImages = issue.articles.filter((a) => a.heroUrl);
    if (withImages.length >= 4 && featureIdx >= 0) {
      result.splice(featureIdx + 2, 0, {
        type: 'archive-wall',
        id: `${issue.id}-archive-wall`,
        title: 'Archive',
        eyebrow: 'Field images',
        articles: withImages.slice(0, 12),
      } as MagazineSpread);
    }
  }

  // Luxury / Japanese / Editorial — inject photo essay
  if (['luxury_fashion_editorial', 'editorial_magazine', 'japanese_minimal'].includes(schoolName)) {
    const withImages = issue.articles.filter((a) => a.heroUrl);
    if (withImages.length >= 2 && backIdx >= 0) {
      result.splice(backIdx, 0, {
        type: 'photo-essay',
        id: `${issue.id}-photo-essay`,
        title: 'Photo essay',
        eyebrow: 'Imagery record',
        articles: withImages.slice(0, 2),
      } as MagazineSpread);
    }
  }

  return result;
}

function MagazineIssueError({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
      <div className="text-center px-6">
        <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">{message}</p>
        <Link
          to="/magazine/issues"
          className="inline-flex items-center gap-2 mt-5 text-[13px] font-bold text-[var(--wk-brand)] hover:underline"
        >
          Back to issues
        </Link>
      </div>
    </main>
  );
}
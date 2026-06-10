import { useEffect, useId, useRef, useState } from "react";
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
import "./magazineIssue.css";
import "./magazineIssueVariants.css";

const LOGO_DARK = "/assets/logos/wakilisha-logo-dark.svg";
const LOGO_LIGHT = "/assets/logos/wakilisha-logo-light.svg";

/* ── Scroll reveal hook ── */
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

/* ── Sticky mini-header that appears on scroll ── */
function StickyHeader({ issue, mood }: { issue: MagazineIssue; mood: string }) {
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
        <span className="text-[12px] font-bold text-[var(--mag-text)] truncate">
          {issue.issueLabel} — {issue.title}
        </span>
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

/* ── Logo (switches for light moods) ── */
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
    <section className={`magazine-spread mag-cover mag-reveal`}>
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
      </div>
    </section>
  );
}

/* ═══════════════════════ EDITOR'S NOTE ═══════════════════════ */
function EditorsNoteSpread({ issue, editorial }: { issue: MagazineIssue; editorial: MagazineEditorialSystem }) {
  const note = editorial.editorNote;
  return (
    <section className="magazine-spread mag-reveal" style={{ background: "var(--mag-surface)" }}>
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
    <section className="magazine-spread mag-reveal" style={{ background: "var(--mag-surface)" }}>
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
    <section className="magazine-spread mag-reveal">
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
    <section className="magazine-spread mag-reveal">
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

/* ═══════════════════════ ARTICLE LIST ═══════════════════════ */
function ArticleListSpread({ spread }: { spread: MagazineSpread }) {
  const isLight = spread.variant === "editorial-list";
  return (
    <section className={`magazine-spread mag-reveal ${isLight ? "mag-article-list-paper" : ""}`}>
      <div className="mag-article-list">
        <div className="mag-rail magazine-meta">
          <span>{spread.title}</span>
          <Masthead small />
        </div>
        <div className="mag-list-grid">
          {(spread.articles ?? []).map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
function ArticleCard({ article }: { article: MagazineIssueArticle }) {
  return (
    <Link className="mag-article-card" to={`/magazine/${article.slug}`}>
      {article.heroUrl && <img src={article.heroUrl} alt="" loading="lazy" />}
      <div>
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
    <section className="magazine-spread mag-reveal">
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
    <section className="magazine-spread mag-reveal">
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
function PartnerSpread() {
  return (
    <section className="magazine-spread mag-reveal">
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
    <section className="magazine-spread mag-reveal">
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

/* ═══════════════════════ SPREAD RENDERER ═══════════════════════ */
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
      return <PartnerSpread />;
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
) {
  if (!siteContent) return spreads;

  const hasArtists = siteContent.artists.length > 0;
  const hasReleases = siteContent.releases.length > 0;
  const hasCharts = siteContent.chartHighlights.length > 0;

  if (!hasArtists && !hasReleases && !hasCharts) return spreads;

  const result: (MagazineSpread | { type: "registry-artist" | "registry-release" | "registry-chart"; id: string })[] = [...spreads];

  // Inject artist spotlight after the feature spread (around index 3-4)
  const featureIdx = result.findIndex((s) => s.type === "feature");
  if (hasArtists && featureIdx >= 0) {
    result.splice(featureIdx + 2, 0, {
      type: "registry-artist",
      id: `registry-artist-spotlight-${mood}`,
    });
  }

  // Inject release spotlight halfway through
  if (hasReleases) {
    const midway = Math.floor(result.length / 2);
    result.splice(midway, 0, {
      type: "registry-release",
      id: `registry-release-spotlight-${mood}`,
    });
  }

  // Inject chart highlights near the signal spread or later
  if (hasCharts) {
    const signalIdx = result.findIndex((s) => s.type === "signal");
    const insertAt = signalIdx >= 0 ? signalIdx + 1 : result.length - 2;
    result.splice(insertAt, 0, {
      type: "registry-chart",
      id: `registry-chart-spotlight-${mood}`,
    });
  }

  return result;
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function MagazineIssuePage() {
  const { issueKey } = useParams<{ issueKey: string }>();
  const { articles, loading, error } = useMagazineArticles();
  const { content: siteContent } = useSiteContent();

  useScrollReveal(!loading);

  if (loading) return <SkeletonMagazinePage />;
  if (error) return <MagazineIssueError message={error} />;

  const issues = buildMagazineIssues(articles);
  const issue = resolveIssueByKey(issues, issueKey);
  if (!issue) return <MagazineIssueError message="This issue has no stories yet." />;

  const editorial = buildIssueEditorialSystem(issue);
  const { previousIssue, nextIssue } = getAdjacentIssues(issues, issue);

  const enrichedSpreads = injectRegistrySpreads(issue.spreads, siteContent, editorial.issueMood);

  return (
    <main className={`magazine-issue mag-shell-mood-${editorial.issueMood}`}>
      <ReadingProgress />
      <StickyHeader issue={issue} mood={editorial.issueMood} />

      <div className="magazine-shell">
        <Link to="/magazine/issues" className="magazine-backlink">
          ← Browse all issues
        </Link>

        {enrichedSpreads.map((spread, index) => {
          if ("articles" in spread || spread.type === "cover" || spread.type === "editors-note" || spread.type === "contents" || spread.type === "feature" || spread.type === "signal" || spread.type === "full-bleed-image" || spread.type === "quote-only" || spread.type === "color-interlude" || spread.type === "section-opener" || spread.type === "guide" || spread.type === "review" || spread.type === "partner" || spread.type === "back-matter" || spread.type === "article-list") {
            return (
              <RenderSpread
                key={spread.id}
                spread={spread as MagazineSpread}
                issue={issue}
                editorial={editorial}
                index={index}
                mood={editorial.issueMood}
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
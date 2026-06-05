import { Link, useParams } from "react-router-dom";
import { useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import {
  buildMagazineIssues,
  getAdjacentIssues,
  issueUrl,
  resolveIssueByKey,
  type MagazineIssue,
  type MagazineIssueArticle,
  type MagazineSpread,
} from "@/services/magazineIssues";
import "./magazineIssue.css";

const LOGO_DARK = "/assets/logos/wakilisha-logo-dark.svg";

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

function Masthead({ small = false }: { small?: boolean }) {
  return <img className={`magazine-logo ${small ? "small" : ""}`} src={LOGO_DARK} alt="WAKILISHA" />;
}

function MagazineSeal({ size = "medium" }: { size?: "small" | "medium" | "cover" }) {
  return (
    <span className={`mag-seal ${size}`} aria-label="WAKILISHA field-record seal">
      <svg viewBox="0 0 100 100" role="img">
        <defs>
          <path id={`seal-ring-${size}`} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth=".5" />
        <text className="ring-text" fill="currentColor">
          <textPath href={`#seal-ring-${size}`} startOffset="0%">· RECORDED IN NAIROBI · WAKILISHA FIELD RECORD · </textPath>
        </text>
        <g transform="translate(50,52) scale(1.5) translate(-132.4,-15)">
          <path fill="currentColor" d="M132.91,11.14l-7.87,18.73,15.96-17.97c.26-.29.05-.76-.34-.76h-7.75Z" />
          <path fill="currentColor" d="M130.72.18h6.59c.15.01.26.17.2.31-2.24,5.23-4.48,10.46-6.73,15.69l-6.74-.02c-.19,0-.32-.19-.24-.37l6.54-15.37c.06-.15.21-.25.37-.25Z" />
        </g>
      </svg>
    </span>
  );
}

function IssueCover({ issue }: { issue: MagazineIssue }) {
  const bills = issue.articles.slice(0, 4);
  return (
    <section className="magazine-spread dark mag-cover">
      <div className="mag-cover-inner">
        <div className="mag-cover-masthead">
          <Masthead />
          <div className="mag-cover-row magazine-meta">
            <span>Magazine</span>
            <b>{issue.issueLabel} · 2026</b>
            <span>Nairobi, Kenya</span>
          </div>
        </div>
        <div className="mag-cover-center">
          <MagazineSeal size="cover" />
          <div className="mag-cover-eyebrow magazine-meta">{issue.subtitle}</div>
          <h1 className="mag-cover-title">{coverTitle(issue.title)}</h1>
          <p className="mag-cover-deck">{issue.deck}</p>
        </div>
        <div className="mag-cover-foot">
          <div className="mag-cover-bills">
            {bills.map((article, idx) => (
              <Link key={article.slug} to={`/magazine/${article.slug}`} className="mag-cover-bill">
                <span className="n magazine-meta">P.{String(14 + idx * 7).padStart(2, "0")}</span>
                <Bolt />
                <span>{article.title}</span>
              </Link>
            ))}
          </div>
          <div className="mag-cover-coords magazine-meta">
            01°17′S 36°49′E<br />Recorded in Nairobi<br /><b>WAKILISHA.AFRICA</b>
          </div>
        </div>
      </div>
    </section>
  );
}

function coverTitle(title: string) {
  if (title.toLowerCase() === "your people are here") {
    return <><span>Your people</span><br />are <em>here.</em></>;
  }
  const words = title.split(" ");
  const last = words.pop();
  return <>{words.join(" ")}<br /><em>{last}</em></>;
}

function EditorsNoteSpread({ issue }: { issue: MagazineIssue }) {
  return (
    <section className="magazine-spread paper">
      <div className="mag-note">
        <aside className="mag-note-side">
          <div className="mag-note-label magazine-meta">Why we made this</div>
          <p>We kept watching scenes happen and then vanish — peaking on a Friday, gone from the feed by Monday, unrecorded.</p>
          <p>WAKILISHA the platform tracks the music. This object is where we get to say what we think it means.</p>
          <p>{issue.issueLabel} is a cultural record drawn from {issue.sourceWindowLabel}.</p>
          <MagazineSeal size="small" />
        </aside>
        <div>
          <p className="mag-note-open">We did not set out to build a music site. We set out to make sure the <em>good nights got remembered.</em></p>
          <div className="mag-note-flow">
            <p>The first time you understand what a culture is doing, it is rarely inside a dashboard. It is in the room, in the timing, in the argument, in the way a song or scene starts to feel inevitable.</p>
            <p>That is why WAKILISHA Magazine exists as an issue-based object. The app keeps moving. The magazine slows down long enough to say what the movement means.</p>
            <p className="mag-pull">Documentation is a form of respect. Putting someone on the record is a way of saying: this counted.</p>
            <p>This issue moves the way the culture actually moves — across sound, scenes, places, memory and the systems underneath them. We treat the charts as intelligence, not scoreboards. We treat guides as field documents. We treat creative life as something worth remembering properly.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContentsSpread({ issue }: { issue: MagazineIssue }) {
  const sectionGroups = issue.spreads.filter((spread) => spread.type === "section-opener");
  const hero = issue.articles[0];
  return (
    <section className="magazine-spread paper">
      <div className="mag-toc">
        <div className="mag-toc-top">
          <Masthead small />
          <div className="magazine-meta" style={{ textAlign: "right", color: "var(--mag-ink-muted)", lineHeight: 1.9 }}>
            Contents<br />{issue.issueLabel}<br />{issue.sourceWindowLabel}
          </div>
        </div>
        <h2 className="mag-toc-title">The culture, <em>on record.</em></h2>
        <div className="mag-toc-lead">
          <div className="mag-toc-hero">Our cover story: <b>{hero?.title ?? issue.title}</b> — the anchor that gives this issue its first pulse.</div>
          <div className="mag-toc-page">14<span className="magazine-meta">Cover feature</span></div>
        </div>
        <div className="mag-toc-cols">
          {sectionGroups.map((section, idx) => (
            <div className="mag-toc-block" key={section.id}>
              <h3><span style={{ color: "var(--mag-green-deep)", fontStyle: "normal" }}>{String(idx + 1).padStart(2, "0")}</span> {section.title}</h3>
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

function FeatureSpread({ spread }: { spread: MagazineSpread }) {
  const article = spread.articles?.[0];
  if (!article) return null;
  return (
    <section className="magazine-spread dark">
      <div className="mag-feature-open">
        <div className="mag-map-bg" />
        <svg className="mag-route" viewBox="0 0 940 760" preserveAspectRatio="none" aria-hidden="true">
          <path d="M250,610 C360,520 420,430 560,300 C640,225 700,205 740,190" fill="none" stroke="url(#routeGradient)" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" />
          <defs><linearGradient id="routeGradient"><stop offset="0%" stopColor="#F0EFE8" stopOpacity=".45" /><stop offset="100%" stopColor="#84C241" /></linearGradient></defs>
          <circle cx="250" cy="610" r="6" fill="#F0EFE8" /><circle cx="740" cy="190" r="9" fill="#A4DC60" />
        </svg>
        <div className="mag-feature-content">
          <div className="mag-rail magazine-meta"><span>{spread.eyebrow} · {spread.section}</span><Masthead small /></div>
          <h2 className="mag-feature-title">{article.title}</h2>
          <p className="mag-feature-deck">{article.dek}</p>
        </div>
      </div>
      <div className="mag-feature-body">
        <div className="mag-copy">
          {sampleParagraphs(article).map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
        </div>
        <aside className="mag-side-card">
          <h4>Field note · Players on record</h4>
          {(spread.articles ?? []).slice(0, 4).map((item) => (
            <div className="mag-side-item" key={item.slug}>
              <Link to={`/magazine/${item.slug}`}>{item.title}</Link>
              <p>{item.canonicalSection} · {item.readingTime} min</p>
            </div>
          ))}
          <h4 style={{ marginTop: 22 }}>Source window</h4>
          <p style={{ color: "var(--mag-on-dark-muted)", fontSize: 12 }}>This feature was selected dynamically from the issue source window and scored as {article.role} editorial material.</p>
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
    "The magazine engine treats longform content as a feature when it carries enough cultural weight, not simply when it is recent.",
    "The goal is to make every issue feel designed around its strongest material rather than poured into a monthly archive template.",
    "What matters is the movement: scenes, records, language, places, rights, and the people carrying them into memory.",
  ];
}

function SignalSpread({ spread }: { spread: MagazineSpread }) {
  const articles = spread.articles ?? [];
  return (
    <section className="magazine-spread dark">
      <div className="mag-signal">
        <div className="mag-rail magazine-meta"><span>The Signal · Cultural Intelligence</span><Masthead small /></div>
        <div className="mag-signal-head">
          <h2>What the issue sounds like, <em>and who is holding the room.</em></h2>
        </div>
        <div className="mag-signal-lead">
          <div className="mag-signal-big">{Math.min(articles.length, 12)}×</div>
          <div className="mag-signal-text">Strong culture leaves patterns. This spread reads the issue for power, crossover, ownership, longevity and movement.</div>
          <MagazineSeal />
        </div>
        <div className="magazine-meta" style={{ color: "var(--mag-on-dark-muted)" }}>Who owns the chart · top issue signals</div>
        <div className="mag-ownership-bar">{articles.slice(0, 12).map((_, idx) => <span key={idx}>{idx + 1}</span>)}</div>
        <div className="mag-signal-grid">
          <div>{articles.slice(0, 12).map((article, idx) => (
            <Link className="mag-chart-row" key={article.slug} to={`/magazine/${article.slug}`}>
              <span className="rank">{String(idx + 1).padStart(2, "0")}</span>
              <span><h4>{article.title}</h4><p>{article.section} · {article.author}</p></span>
              <span className="magazine-meta" style={{ color: "var(--mag-green)" }}>{article.role}</span>
            </Link>
          ))}</div>
          <div>
            <div className="mag-finding"><h4>Finding 01 · Crossover</h4><p>The issue clusters music, guides, scenes and systems together. The culture is not separate rooms; it is one conversation in several accents.</p></div>
            <div className="mag-finding"><h4>Finding 02 · Longevity</h4><p>Evergreen articles carry more weight than expired announcements. The generator marks stale content for review instead of making it central.</p></div>
            <div className="mag-finding"><h4>Finding 03 · Ownership</h4><p>This spread is designed for chart and registry data once deeper label ownership data is available.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionOpener({ spread, index }: { spread: MagazineSpread; index: number }) {
  return (
    <section className="magazine-spread dark mag-section" style={{ ["--section-accent" as string]: spread.accent ?? "#84C241" }}>
      <div className="mag-section-number">{String(index + 1).padStart(2, "0")}</div>
      <div className="mag-section-inner">
        <div className="mag-rail magazine-meta"><span>{spread.eyebrow} · {spread.title}</span><Masthead small /></div>
        <h2 className="mag-section-title">{sectionTitle(spread.title)}</h2>
        <p className="mag-section-deck">{spread.deck}</p>
      </div>
    </section>
  );
}

function sectionTitle(title: string) {
  const parts = title.split(" ");
  const last = parts.pop();
  return <>{parts.join(" ")}<br /><em>{last}</em></>;
}

function ArticleListSpread({ spread }: { spread: MagazineSpread }) {
  return (
    <section className="magazine-spread dark">
      <div className="mag-article-list">
        <div className="mag-rail magazine-meta"><span>{spread.title}</span><Masthead small /></div>
        <div className="mag-list-grid">
          {(spread.articles ?? []).map((article) => <ArticleCard key={article.slug} article={article} />)}
        </div>
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: MagazineIssueArticle }) {
  return (
    <Link className="mag-article-card" to={`/magazine/${article.slug}`}>
      <img src={article.heroUrl} alt="" loading="lazy" />
      <div><h4>{article.title}</h4><p>{article.dek}</p></div>
    </Link>
  );
}

function GuideSpread({ spread }: { spread: MagazineSpread }) {
  const article = spread.articles?.[0];
  return (
    <section className="magazine-spread paper">
      <div className="mag-guide">
        <div className="mag-guide-hero"><div><div className="magazine-meta" style={{ color: "#9fc8ff", marginBottom: 14 }}>WAKILISHA Field Guides</div><h2 className="mag-guide-title">{article?.title ?? spread.title}</h2></div></div>
        <div className="mag-guide-body">
          <div><p>{article?.dek ?? spread.deck}</p><p>Guides should feel like something you carry through a city, festival, room or argument. The template supports route logic, travel cues and field notes while remaining dynamic.</p></div>
          <aside className="mag-guide-card"><MagazineSeal size="small" /><p style={{ marginTop: 14 }}>Dossier · at a glance</p><p>Source: {spread.section}</p><p>Format: Carryable field document</p></aside>
        </div>
      </div>
    </section>
  );
}

function ReviewSpread({ spread }: { spread: MagazineSpread }) {
  const [hero, ...rest] = spread.articles ?? [];
  return (
    <section className="magazine-spread dark">
      <div className="mag-reviews">
        {hero && <div className="mag-review-hero"><img src={hero.heroUrl} alt="" /><div className="mag-review-copy"><div className="magazine-meta" style={{ color: "var(--mag-green-hi)", marginBottom: 16 }}>On Record · The Verdict</div><h2 className="mag-reviews-title">{hero.title}</h2><p style={{ color: "var(--mag-on-dark-soft)", marginTop: 20, fontFamily: "var(--mag-display)", fontStyle: "italic", fontSize: 20 }}>{hero.dek}</p></div></div>}
        {rest.slice(0, 4).map((article) => <Link className="mag-review-row" key={article.slug} to={`/magazine/${article.slug}`}><img src={article.heroUrl} alt="" /><span><b>{article.title}</b><br /><small>{article.author}</small></span><span className="magazine-meta" style={{ color: "var(--mag-green)" }}>{article.readingTime}/min</span></Link>)}
      </div>
    </section>
  );
}

function PartnerSpread() {
  return (
    <section className="magazine-spread dark">
      <div className="mag-partner">
        <div className="magazine-meta" style={{ color: "var(--mag-green)", marginBottom: 18 }}>This section is made possible by</div>
        <h2>Cultural <em>Partner</em></h2>
        <p>Patronage, not interruption. Magazine ad surfaces should feel like cultural support, not banner inventory.</p>
      </div>
    </section>
  );
}

function BackMatterSpread({ issue }: { issue: MagazineIssue }) {
  return (
    <section className="magazine-spread dark">
      <div className="mag-back">
        <MagazineSeal size="cover" />
        <h2 className="mag-back-title">Your people<br /><em>are here.</em></h2>
        <p>{issue.articles.length} selected pieces. {issue.excludedArticles.length} stale or review-flagged pieces held out of the issue. Source window: {issue.sourceWindowLabel}.</p>
        <div className="magazine-meta" style={{ color: "var(--mag-green)", marginTop: 24 }}>WAKILISHA.AFRICA</div>
      </div>
    </section>
  );
}

function RenderSpread({ spread, issue, index }: { spread: MagazineSpread; issue: MagazineIssue; index: number }) {
  switch (spread.type) {
    case "cover": return <IssueCover issue={issue} />;
    case "editors-note": return <EditorsNoteSpread issue={issue} />;
    case "contents": return <ContentsSpread issue={issue} />;
    case "feature": return <FeatureSpread spread={spread} />;
    case "signal": return <SignalSpread spread={spread} />;
    case "section-opener": return <SectionOpener spread={spread} index={index} />;
    case "guide": return <GuideSpread spread={spread} />;
    case "review": return <ReviewSpread spread={spread} />;
    case "partner": return <PartnerSpread />;
    case "back-matter": return <BackMatterSpread issue={issue} />;
    case "article-list": return <ArticleListSpread spread={spread} />;
    default: return null;
  }
}

export default function MagazineIssuePage() {
  const { issueKey } = useParams<{ issueKey: string }>();
  const { articles, loading, error } = useMagazineArticles();

  if (loading) return <SkeletonMagazinePage />;
  if (error) return <MagazineIssueError message={error} />;

  const issues = buildMagazineIssues(articles);
  const issue = resolveIssueByKey(issues, issueKey);
  if (!issue) return <MagazineIssueError message="This issue has no stories yet." />;

  const { previousIssue, nextIssue } = getAdjacentIssues(issues, issue);

  return (
    <main className="magazine-issue">
      <div className="magazine-shell">
        <Link to="/magazine/issues" className="magazine-backlink">← Browse all issues</Link>
        {issue.spreads.map((spread, index) => <RenderSpread key={spread.id} spread={spread} issue={issue} index={index} />)}
        <nav className="mag-nav">
          <span>{previousIssue && <Link to={issueUrl(previousIssue)}>← {previousIssue.issueLabel}</Link>}</span>
          <span>{nextIssue && <Link to={issueUrl(nextIssue)}>{nextIssue.issueLabel} →</Link>}</span>
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
        <Link to="/magazine/issues" className="inline-flex items-center gap-2 mt-5 text-[13px] font-bold text-[var(--wk-brand)] hover:underline">Back to issues</Link>
      </div>
    </main>
  );
}

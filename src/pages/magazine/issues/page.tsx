import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles, useSiteContent } from "@/services/magazineArticles";
import { getTopArtists, getLatestReleases } from "@/services/magazineSiteContent";
import { buildMagazineIssues, issueUrl, type MagazineIssue } from "@/services/magazineIssues";
import { buildIssueEditorialSystem } from "@/services/magazineNlg";
import { releaseUrl } from "@/utils/releaseUrl";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import "../issue/magazineIssue.css";

/* ── Mood color map for cards ── */
const MOOD_GRADIENTS: Record<string, { bg: string; accent: string; text: string }> = {
  night: { bg: "linear-gradient(180deg, #0a0c08 0%, #060704 100%)", accent: "#84c241", text: "#ecebe4" },
  paper: { bg: "linear-gradient(180deg, #faf7ee 0%, #ede6d2 100%)", accent: "#6c982f", text: "#1a1a15" },
  travel: { bg: "linear-gradient(135deg, #071111 0%, #0a1a18 100%)", accent: "#4fd9c2", text: "#e8f0ed" },
  signal: { bg: "linear-gradient(180deg, #070714 0%, #0a0a1e 100%)", accent: "#9c8ff5", text: "#e8e8f2" },
  archive: { bg: "linear-gradient(180deg, #faf5e8 0%, #ede0c0 100%)", accent: "#d4943a", text: "#1a150c" },
  image: { bg: "linear-gradient(135deg, #060a07 0%, #0a100b 100%)", accent: "#6ba8f5", text: "#f0f2ed" },
};

function IssueSealPreview({ accent }: { accent: string }) {
  return (
    <span className="mag-seal small" aria-hidden="true" style={{ color: accent }}>
      <svg viewBox="0 0 100 100">
        <defs>
          <path id="archive-seal-ring" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth=".5" />
        <text className="ring-text" fill="currentColor">
          <textPath href="#archive-seal-ring">· WAKILISHA FIELD RECORD · RECORDED IN NAIROBI · </textPath>
        </text>
        <g transform="translate(50,52) scale(1.5) translate(-132.4,-15)">
          <path fill="currentColor" d="M132.91,11.14l-7.87,18.73,15.96-17.97c.26-.29.05-.76-.34-.76h-7.75Z" />
          <path fill="currentColor" d="M130.72.18h6.59c.15.01.26.17.2.31-2.24,5.23-4.48,10.46-6.73,15.69l-6.74-.02c-.19,0-.32-.19-.24-.37l6.54-15.37c.06-.15.21-.25.37-.25Z" />
        </g>
      </svg>
    </span>
  );
}

export default function AllIssuesPage() {
  const { articles, loading, error } = useMagazineArticles();
  const { content: siteContent, loading: siteContentLoading } = useSiteContent();
  const [search, setSearch] = useState("");
  const [showBackfilled, setShowBackfilled] = useState(false);
  const [hoveredIssue, setHoveredIssue] = useState<string | null>(null);

  const allIssues = useMemo(() => buildMagazineIssues(articles), [articles]);
  const visibleIssues = showBackfilled ? allIssues : allIssues.slice(0, Math.min(4, allIssues.length));

  const filteredIssues = useMemo(() => {
    const base = visibleIssues;
    if (!search.trim()) return base;
    const q = search.toLowerCase().trim();
    return base.filter(
      (issue) =>
        issue.title.toLowerCase().includes(q) ||
        issue.issueLabel.toLowerCase().includes(q) ||
        issue.sourceWindowLabel.toLowerCase().includes(q) ||
        issue.primaryVerticals.some((v) => v.toLowerCase().includes(q)),
    );
  }, [visibleIssues, search]);

  if (loading) return <SkeletonMagazinePage />;

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center px-6">
          <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">{error}</p>
          <Link to="/magazine" className="inline-flex items-center gap-2 mt-5 text-[13px] font-bold text-[var(--wk-brand)] hover:underline">
            Back to Magazine
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="magazine-issue min-h-screen">
      {/* ═══════════ HERO ═══════════ */}
      <section className="max-w-[1180px] mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-10">
        <Link to="/magazine" className="magazine-backlink">← Magazine</Link>
        <h1 className="font-[Fraunces] text-[clamp(48px,9vw,128px)] font-light tracking-[-.04em] leading-[.84] text-[var(--wk-text)] mt-4">
          Browse the <em className="text-[var(--wk-brand)] italic">field records.</em>
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
          WAKILISHA Magazine issues are content-based cultural volumes, not monthly folders.
          The source windows help us back-populate the archive, but the public object is the issue:
          title, theme, sections, spreads and record.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            className="inline-flex items-center gap-2 border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] rounded-full px-5 py-2.5 font-bold text-[13px] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all cursor-pointer whitespace-nowrap"
            type="button"
            onClick={() => setShowBackfilled((v) => !v)}
          >
            {showBackfilled ? "Show latest only" : "Show all issues"}
            <span className="text-[var(--wk-text-faint)] text-[11px]">
              {allIssues.length} total
            </span>
          </button>

          <div className="relative flex-1 max-w-[440px]">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[15px] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by theme, section, window..."
              className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] pl-10 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--wk-border)] flex items-center justify-center text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] cursor-pointer"
              >
                <i className="ri-close-line text-[12px]" />
              </button>
            )}
          </div>
        </div>

        {!showBackfilled && allIssues.length > 4 && (
          <p className="mt-4 text-[12px] text-[var(--wk-text-faint)]">
            Showing {Math.min(4, allIssues.length)} of {allIssues.length} issues.{" "}
            <button onClick={() => setShowBackfilled(true)} className="underline font-bold hover:text-[var(--wk-brand)] cursor-pointer">
              Show all
            </button>
          </p>
        )}
      </section>

      {/* ═══════════ SITE CONTENT PREVIEW STRIP ═══════════ */}
      <SiteContentPreviewStrip
        content={siteContent}
        loading={siteContentLoading}
      />

      {/* ═══════════ ISSUE GRID ═══════════ */}
      <section className="max-w-[1180px] mx-auto px-5 md:px-8 pb-20">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[15px] text-[var(--wk-text-muted)]">
              {search ? "No issues match your search." : "No issues available yet."}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-3 text-[13px] font-bold text-[var(--wk-brand)] hover:underline cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredIssues.map((issue, index) => (
              <IssueCard
                key={issue.slug}
                issue={issue}
                index={index}
                isNewest={index === 0 && !showBackfilled}
                isHovered={hoveredIssue === issue.slug}
                onHover={setHoveredIssue}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* ═══════════ SITE CONTENT PREVIEW STRIP ═══════════ */
function SiteContentPreviewStrip({
  content,
  loading,
}: {
  content: import("@/services/magazineSiteContent").SiteContentResponse;
  loading: boolean;
}) {
  const artists = useMemo(() => getTopArtists(content, 8), [content]);
  const releases = useMemo(() => getLatestReleases(content, 4), [content]);

  if (loading || (artists.length === 0 && releases.length === 0)) return null;

  return (
    <section className="max-w-[1180px] mx-auto px-5 md:px-8 pb-8">
      {artists.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">
              Artists in the archive
            </span>
            <span className="flex-1 h-px bg-[var(--wk-border)]" />
            <Link
              to="/artists"
              className="text-[11px] font-bold text-[var(--wk-brand)] hover:text-[var(--wk-brand-2)] transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              All artists
              <i className="ri-arrow-right-line text-[11px]" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {artists.map((artist) => (
              <Link
                key={artist.slug}
                to={`/artists/${artist.slug}`}
                className="inline-flex items-center gap-2.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 hover:border-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] transition-all group"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--wk-surface-raised)] shrink-0">
                  {artist.heroUrl ? (
                    <img src={artist.heroUrl} alt={artist.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--wk-brand-soft)] text-[9px] font-black text-[var(--wk-brand)]">
                      {artist.title.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="text-[12px] font-semibold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap">
                  {artist.title}
                </span>
                {artist.originIso2 && (
                  <span className="text-[9px] font-bold text-[var(--wk-text-faint)] uppercase">
                    {artist.originIso2}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {releases.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">
              Recent releases
            </span>
            <span className="flex-1 h-px bg-[var(--wk-border)]" />
            <Link
              to="/releases"
              className="text-[11px] font-bold text-[var(--wk-brand)] hover:text-[var(--wk-brand-2)] transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              All releases
              <i className="ri-arrow-right-line text-[11px]" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {releases.map((release) => (
              <Link
                key={release.slug}
                to={releaseUrl({ slug: release.slug, artist: release.author })}
                className="group flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 hover:border-[var(--wk-brand)] transition-all"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] shrink-0">
                  {release.heroUrl ? (
                    <img src={release.heroUrl} alt={release.title} className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--wk-border)] text-[var(--wk-text-faint)]">
                      <i className="ri-disc-line text-[16px]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors truncate">
                    {release.title}
                  </p>
                  <p className="text-[10px] text-[var(--wk-text-muted)]">
                    {release.author}
                    {release.releaseType && ` · ${release.releaseType}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ═══════════ ISSUE CARD — mood-aware, interactive ═══════════ */
function IssueCard({
  issue,
  index,
  isNewest,
  isHovered,
  onHover,
}: {
  issue: MagazineIssue;
  index: number;
  isNewest: boolean;
  isHovered: boolean;
  onHover: (slug: string | null) => void;
}) {
  const editorial = useMemo(() => buildIssueEditorialSystem(issue), [issue]);
  const mood = editorial.issueMood;
  const palette = MOOD_GRADIENTS[mood] ?? MOOD_GRADIENTS.night;
  const isLight = mood === "paper" || mood === "archive";
  const previewArticle = issue.articles[0];

  return (
    <Link
      to={issueUrl(issue)}
      className="group relative overflow-hidden rounded-xl min-h-[420px] flex flex-col transition-all duration-500"
      style={{
        background: palette.bg,
        color: palette.text,
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
      }}
      onMouseEnter={() => onHover(issue.slug)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Ambient glow from accent */}
      <div
        className="absolute inset-0 opacity-30 transition-opacity duration-500 group-hover:opacity-45"
        style={{
          background: `radial-gradient(70% 50% at 50% 30%, ${palette.accent}18, transparent 70%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col p-7 md:p-9">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <span
            className="font-[var(--mag-mono)] text-[10px] uppercase tracking-[.18em]"
            style={{ color: isLight ? "rgba(26,21,12,.5)" : "rgba(255,255,255,.45)" }}
          >
            {issue.issueLabel}
          </span>
          {isNewest && (
            <span
              className="text-[10px] font-black uppercase tracking-[.14em] px-2.5 py-1 rounded-full"
              style={{
                background: `${palette.accent}22`,
                color: palette.accent,
              }}
            >
              Latest
            </span>
          )}
        </div>

        {/* Seal */}
        <div className="mt-6 mb-4">
          <IssueSealPreview accent={palette.accent} />
        </div>

        {/* Title */}
        <h2
          className="font-[Fraunces] text-[clamp(36px,5vw,56px)] font-light tracking-[-.035em] leading-[.9] mt-auto"
          style={{ color: palette.text }}
        >
          {issue.title}
        </h2>

        {/* Deck */}
        <p
          className="mt-3 text-[14px] leading-relaxed max-w-[48ch]"
          style={{ color: isLight ? "rgba(26,21,12,.55)" : "rgba(255,255,255,.55)" }}
        >
          {issue.deck}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <span
            className="text-[11px] font-semibold"
            style={{ color: palette.accent }}
          >
            {issue.articles.length} selected
          </span>
          <span
            className="text-[11px]"
            style={{ color: isLight ? "rgba(26,21,12,.4)" : "rgba(255,255,255,.35)" }}
          >
            {issue.primaryVerticals.slice(0, 3).join(" / ")}
          </span>
        </div>

        {/* Preview article on hover */}
        {previewArticle && (
          <div
            className="mt-4 pt-4 border-t transition-all duration-400 overflow-hidden"
            style={{
              borderColor: isLight ? "rgba(26,21,12,.1)" : "rgba(255,255,255,.1)",
              maxHeight: isHovered ? "120px" : "0px",
              opacity: isHovered ? 1 : 0,
              marginTop: isHovered ? "16px" : "0",
              paddingTop: isHovered ? "16px" : "0",
            }}
          >
            <p
              className="text-[10px] font-black uppercase tracking-[.14em] mb-1"
              style={{ color: palette.accent }}
            >
              Featured
            </p>
            <p
              className="text-[13px] font-semibold leading-snug"
              style={{ color: palette.text }}
            >
              {previewArticle.title}
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: isLight ? "rgba(26,21,12,.45)" : "rgba(255,255,255,.45)" }}
            >
              {previewArticle.author} · {previewArticle.readingTime} min
            </p>
          </div>
        )}

        {/* Source window badge */}
        <div
          className="mt-5 text-[10px] font-[var(--mag-mono)] uppercase tracking-[.14em]"
          style={{ color: isLight ? "rgba(26,21,12,.38)" : "rgba(255,255,255,.38)" }}
        >
          {issue.sourceWindowLabel}
        </div>
      </div>

      {/* Hover accent border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] transition-all duration-400"
        style={{
          background: palette.accent,
          opacity: isHovered ? 1 : 0,
        }}
      />
    </Link>
  );
}
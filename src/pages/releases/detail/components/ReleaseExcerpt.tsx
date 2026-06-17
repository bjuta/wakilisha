import { useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import type { RepairedReleaseDetail } from "@/services/repairedContent/client";

interface ReleaseExcerptProps {
  release: RepairedReleaseDetail;
}

// ─── Prose generator ────────────────────────────────────────────────────────
// Builds a human-readable factual description from structured release data.
// All variance is extracted from the data itself — track count, duration, feature
// density, release type, and track naming patterns. Nothing is fabricated.

function releaseTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "album" || t === "studio album") return "studio album";
  if (t === "ep" || t === "extended play") return "extended play";
  if (t === "single") return "single";
  if (t === "compilation") return "compilation";
  if (t === "mixtape") return "mixtape";
  return t;
}

function releaseNoun(type: string): string {
  const t = type.toLowerCase();
  if (t === "album" || t === "studio album") return "album";
  if (t === "ep" || t === "extended play") return "EP";
  if (t === "single") return "single";
  if (t === "compilation") return "compilation";
  if (t === "mixtape") return "mixtape";
  return t;
}

function articleize(word: string): string {
  return "aeiou".includes(word.charAt(0).toLowerCase()) ? `an ${word}` : `a ${word}`;
}

function formatReleaseDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatDurationApprox(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `approximately ${m} minutes`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `approximately ${h} hour${h > 1 ? "s" : ""}`;
  return `approximately ${h} hour${h > 1 ? "s" : ""} and ${rm} minutes`;
}

/** Detect notable track naming patterns in the sorted tracklist. */
function detectTrackPatterns(tracks: Array<{ title: string; trackNumber: number }>): {
  hasIntro: boolean;
  hasOutro: boolean;
  interludeCount: number;
  skitCount: number;
} {
  const titles = tracks.map((t) => t.title.toLowerCase());
  return {
    hasIntro: titles.some((t) => t.includes("intro")),
    hasOutro: titles.some((t) => t.includes("outro")),
    interludeCount: titles.filter((t) => t.includes("interlude")).length,
    skitCount: titles.filter((t) => t.includes("skit")).length,
  };
}

function buildDescription(opts: {
  title: string;
  artist: string;
  year: string;
  releaseDate: string;
  releaseType: string;
  labelName: string;
  trackCount: number;
  tracks: RepairedReleaseDetail["tracks"];
  totalDuration: number;
  featuredArtists: Array<{ name: string; slug: string }>;
}): string {
  const { title, artist, year, releaseDate, releaseType, labelName, trackCount, tracks, totalDuration, featuredArtists } = opts;
  const rType = releaseTypeLabel(releaseType);
  const noun = releaseNoun(releaseType);
  const parts: string[] = [];

  const sorted = [...tracks].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  const first = sorted[0]?.title || "";
  const last = sorted.length > 1 ? sorted[sorted.length - 1]?.title : "";
  const patterns = detectTrackPatterns(sorted);

  const dateLabel = formatReleaseDate(releaseDate) || (year && year !== "Unknown year" ? year : "");
  const hasRealLabel = labelName && labelName !== "Independent" && labelName !== "Unknown" && labelName !== "WAKILISHA Registry" && labelName !== "WAKILISHA";
  const hasDuration = totalDuration > 0;
  const featureCount = featuredArtists?.length || 0;
  const minutes = hasDuration ? Math.round(totalDuration / 60) : 0;

  // ── Sentence 1: What, who, when ──────────────────────────────────────────
  let open: string;
  if (trackCount === 1) {
    // Singles are straightforward — just the facts
    open = `"${title}" is a single by ${artist}`;
  } else if (rType === "mixtape") {
    // Mixtapes have a slightly looser energy
    open = `"${title}" is a mixtape by ${artist}`;
  } else if (trackCount <= 5 && rType !== "compilation") {
    // Small projects — reference the track count directly
    const label = rType === "extended play" ? "EP" : rType;
    open = `"${title}" is ${articleize(label)} by ${artist}`;
  } else {
    open = `"${title}" is ${articleize(rType)} by ${artist}`;
  }

  if (dateLabel) open += `, released on ${dateLabel}`;
  if (hasRealLabel) open += ` through ${labelName}`;
  open += ".";
  parts.push(open);

  // ── Sentence 2: Tracklist overview ───────────────────────────────────────
  if (trackCount === 1) {
    parts.push(`The release consists of a single track, "${first}."`);
  } else if (trackCount === 2) {
    parts.push(`The two-track release opens with "${first}" and closes with "${last}".`);
  } else {
    // Choose phrasing based on track count and bookend patterns
    const bookended = patterns.hasIntro && patterns.hasOutro;
    let s: string;

    if (trackCount >= 20) {
      s = `Spanning ${trackCount} tracks, the ${noun} opens with "${first}"`;
    } else if (trackCount >= 13) {
      s = `Across its ${trackCount} tracks, the ${noun} opens with "${first}"`;
    } else if (trackCount <= 5) {
      s = `The ${trackCount}-track ${noun} opens with "${first}"`;
    } else {
      s = `The ${trackCount}-track project opens with "${first}"`;
    }

    if (last && last !== first) {
      s += bookended ? ` and is bookended by "${last}"` : `, concluding with "${last}"`;
    }

    // Note interludes/skits when they exist (factual, not embellishment)
    if (patterns.interludeCount > 0 || patterns.skitCount > 0) {
      const extras: string[] = [];
      if (patterns.interludeCount > 0) {
        extras.push(`${patterns.interludeCount} interlude${patterns.interludeCount > 1 ? "s" : ""}`);
      }
      if (patterns.skitCount > 0) {
        extras.push(`${patterns.skitCount} skit${patterns.skitCount > 1 ? "s" : ""}`);
      }
      s += `, with ${extras.join(" and ")} along the way`;
    }

    s += ".";
    parts.push(s);
  }

  // ── Sentence 3: Duration + features ──────────────────────────────────────
  if (hasDuration || featureCount > 0) {
    let s = `The ${noun}`;

    if (hasDuration) {
      if (minutes <= 5 && trackCount === 1) {
        // Very short single — just state it plainly
        s += ` clocks in at ${minutes} minute${minutes !== 1 ? "s" : ""}`;
      } else if (minutes <= 15 && trackCount > 1) {
        s += ` is a brisk ${formatDurationApprox(totalDuration)}`;
      } else if (minutes > 80) {
        s += ` clocks in at ${formatDurationApprox(totalDuration)}`;
      } else {
        s += ` runs for ${formatDurationApprox(totalDuration)}`;
      }
    }

    if (featureCount > 0) {
      const maxShow = 4;
      const shown = featuredArtists.slice(0, maxShow).map((f) => f.name);
      const remaining = featureCount - maxShow;

      if (hasDuration) s += " and";

      if (featureCount >= 10) {
        // Lots of features — "boasts" and "guest list" are earned here
        s += ` boasts a guest list of ${featureCount} artists, including ${shown.join(", ")}`;
        if (remaining > 0) s += ` and ${remaining} others`;
      } else if (featureCount >= 5) {
        s += ` features ${shown.join(", ")}`;
        if (remaining > 0) s += ` and ${remaining} other${remaining > 1 ? "s" : ""}`;
      } else if (featureCount === 1) {
        s += ` features ${shown[0]}`;
      } else {
        // 2-4 features: natural list
        const allButLast = shown.slice(0, -1).join(", ");
        s += ` features ${allButLast} and ${shown[shown.length - 1]}`;
      }
    }

    s += ".";
    parts.push(s);
  }

  return parts.join(" ");
}

export default function ReleaseExcerpt({ release }: ReleaseExcerptProps) {
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);
  const [expanded, setExpanded] = useState(false);

  const { title, artist, year, releaseDate, releaseType, labelName, trackCount, tracks, totalDuration, featuredArtists } = release;

  // Always regenerate. Never trust the API "description" field.
  const text = buildDescription({
    title,
    artist,
    year,
    releaseDate,
    releaseType,
    labelName,
    trackCount,
    tracks,
    totalDuration,
    featuredArtists,
  });

  if (!text) return null;

  // Factual chips
  const chips: string[] = [
    `${trackCount} track${trackCount !== 1 ? "s" : ""}`,
    labelName && labelName !== "WAKILISHA Registry" && labelName !== "WAKILISHA" && labelName !== "Independent" && labelName !== "Unknown" ? labelName : "",
  ].filter(Boolean);

  const sentences = text.split(". ").filter(Boolean);
  const preview = sentences.slice(0, 2).join(". ") + ".";
  const rest = sentences.slice(2).join(". ").trim();
  const hasMore = rest.length > 0;

  return (
    <section
      ref={ref}
      className={`${revealed ? "is-visible" : ""} reveal-up`}
    >
      <div className="relative border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] overflow-hidden">
        {/* Side accent bar */}
        <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-[var(--wk-brand)]" />

        <div className="px-6 py-5 pl-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center text-[var(--wk-brand)]">
                <i className="ri-file-text-line text-[14px]" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                About this release
              </span>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5 justify-end">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-text-muted)] whitespace-nowrap"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Text */}
          <p className="text-[14px] leading-[1.8] text-[var(--wk-text-soft)]">
            {preview}
          </p>
          {hasMore && expanded && (
            <p className="text-[14px] leading-[1.8] text-[var(--wk-text-soft)] mt-2">
              {rest}
            </p>
          )}
          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)] hover:opacity-80 transition-opacity cursor-pointer"
            >
              {expanded ? (
                <>
                  <i className="ri-arrow-up-s-line" />
                  Show less
                </>
              ) : (
                <>
                  <i className="ri-arrow-down-s-line" />
                  Read more
                </>
              )}
            </button>
          )}

          {/* Footer note */}
          <div className="mt-4 pt-4 border-t border-[var(--wk-border)]">
            <p className="text-[10px] text-[var(--wk-text-faint)] leading-relaxed">
              This summary is automatically generated from catalog data and may be updated as new information becomes available.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
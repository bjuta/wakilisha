import { useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import type { RepairedReleaseDetail } from "@/services/repairedContent/client";

interface ReleaseExcerptProps {
  release: RepairedReleaseDetail;
}

export default function ReleaseExcerpt({ release }: ReleaseExcerptProps) {
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);
  const [expanded, setExpanded] = useState(false);

  const { description, title, artist, year, releaseType, labelName, trackCount, tracks, totalDuration } = release;

  // Fallback: generate a description client-side if the API didn't provide one
  const clientDescription = !description ? buildFallbackDescription({ title, artist, year, releaseType, labelName, trackCount, tracks, totalDuration }) : null;
  const text = description || clientDescription || "";

  if (!text) return null;

  // Identify factual chips from the text structure
  const chips: string[] = [
    `${trackCount} track${trackCount !== 1 ? "s" : ""}`,
    releaseType.charAt(0).toUpperCase() + releaseType.slice(1).toLowerCase(),
    year,
    labelName !== "Independent" && labelName !== "Unknown" ? labelName : "",
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
              This summary is automatically generated from catalog data at canonicalization and may be updated as new information becomes available.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Client-side fallback generator ────────────────────────────────────────
// Mirrors the logic in the edge function for offline/mock scenarios

function releaseTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "album" || t === "studio album") return "studio album";
  if (t === "ep" || t === "extended play") return "extended play";
  if (t === "single") return "single";
  if (t === "compilation" || t === "mixtape") return t;
  return t;
}

function articleize(word: string): string {
  const first = word.charAt(0).toLowerCase();
  return "aeiou".includes(first) ? `an ${word}` : `a ${word}`;
}

function formatDurationApprox(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `approximately ${m} minutes`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `approximately ${h} hour${h > 1 ? "s" : ""}`;
  return `approximately ${h} hour${h > 1 ? "s" : ""} and ${rm} minutes`;
}

function buildFallbackDescription(opts: {
  title: string;
  artist: string;
  year: string;
  releaseType: string;
  labelName: string;
  trackCount: number;
  tracks: RepairedReleaseDetail["tracks"];
  totalDuration: number;
}): string {
  const { title, artist, year, releaseType, labelName, trackCount, tracks, totalDuration } = opts;
  const rType = releaseTypeLabel(releaseType);
  const parts: string[] = [];

  let open = `${title} is ${articleize(rType)} by ${artist}`;
  if (year) open += `, released in ${year}`;
  if (labelName && labelName !== "Independent" && labelName !== "Unknown") open += ` through ${labelName}`;
  open += ".";
  parts.push(open);

  const sorted = [...tracks].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  const first = sorted[0]?.title;
  const last = sorted.length > 1 ? sorted[sorted.length - 1]?.title : "";

  if (trackCount === 1 && first) {
    parts.push(`The release consists of a single track, "${first}."`);
  } else if (trackCount > 1 && first) {
    let s = `The ${trackCount}-track project opens with "${first}"`;
    if (last && last !== first) s += `, concluding with "${last}"`;
    s += ".";
    parts.push(s);
  }

  if (totalDuration > 0) {
    parts.push(
      `With a total runtime of ${formatDurationApprox(totalDuration)}, the project delivers ${trackCount > 5 ? "a substantial listening experience" : "a concise but complete statement"}.`
    );
  }

  parts.push(`${title} stands as a notable release in ${artist}'s discography, contributing to the broader cultural conversation.`);

  return parts.join(" ");
}
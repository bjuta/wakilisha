import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { validateWkArtworkUrl } from "@/components/data-viz/WkRecordingArtwork";
import type { VerifiedAppleChartSong } from "@/services/chartsPrivate/appleCatalogReview";

type SourcePosition = {
  source_key: string;
  native_rank: number;
  provider_track_id: string | null;
};
export type StudioMusicEntry = {
  position?: number;
  title: string;
  artist: string | null;
  score_points?: string;
  source_count?: number;
  contributions: SourcePosition[];
};

const SOURCE_NAMES: Record<string, string> = {
  youtube_ke: "YouTube",
  mdundo_ke: "Mdundo",
  apple_ke: "Apple Music",
  audiomack_ke: "Audiomack",
  shazam_ke: "Shazam",
};
export function formatChartTrackDuration(value: number | null | undefined): string | null {
  if (!Number.isInteger(value) || !value || value <= 0 || value > 3_600_000) return null;
  const total = Math.floor(value / 1000);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function ChartCover({ artworkUrl, title }: { artworkUrl: string | null; title: string }) {
  const verifiedUrl = validateWkArtworkUrl(artworkUrl);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[#1b2119] sm:h-[68px] sm:w-[68px]">
      {verifiedUrl && failed !== verifiedUrl ? (
        <img src={verifiedUrl} alt={"Cover artwork for " + title}
          loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setFailed(verifiedUrl)}
          className="h-full w-full object-contain" />
      ) : (
        <WkIcon name="Music" size={22} className="text-[#bbd9a0]" />
      )}
    </span>
  );
}

/** Same artwork-first reading order as our public playlist track rows. */
export function StudioChartMusicRow({
  entry, catalogSong, compact = false,
}: {
  entry: StudioMusicEntry;
  catalogSong?: VerifiedAppleChartSong | null;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const duration = formatChartTrackDuration(catalogSong?.durationMs);
  // The official Apple record may fill a missing artist credit for that exact
  // Apple track ID. Other platform labels are never merged by title alone.
  const artist = entry.artist || catalogSong?.artist || null;
  const release = catalogSong?.album || null;
  const positions = entry.contributions.map(c =>
    (SOURCE_NAMES[c.source_key] || c.source_key) + " #" + c.native_rank
  );
  return (
    <article data-wk-chart-music-row
      className={"min-w-0 border-b border-[var(--wk-divider)] last:border-b-0 " +
        (entry.position && entry.position <= 3 && !compact ? "bg-[var(--wk-brand-soft)]/20" : "")}>
      <div className="flex min-w-0 items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4">
        {entry.position ? (
          <span className="w-7 shrink-0 text-center font-[var(--wk-font-display)] text-[16px] font-extrabold tabular-nums text-[var(--wk-text-soft)] sm:w-9 sm:text-[20px]">
            {entry.position}
          </span>
        ) : null}
        <ChartCover artworkUrl={catalogSong?.artworkUrl || null} title={entry.title} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-extrabold leading-tight tracking-[-0.018em] text-[var(--wk-text)] sm:text-[15px]">
            {entry.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-[12px] font-medium text-[var(--wk-text-soft)]">
            {artist || "Artist not listed"}
          </p>
          {(release || duration) ? (
            <p className="mt-1 truncate text-[11px] text-[var(--wk-text-muted)]">
              {[release, duration].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="mt-1 truncate text-[11px] font-medium text-[var(--wk-text-muted)]">
            {positions.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {entry.score_points && !compact ? (
            <strong className="font-[var(--wk-font-display)] text-[17px] font-extrabold tabular-nums text-[var(--wk-text)] sm:text-[20px]">
              {entry.score_points}
            </strong>
          ) : null}
          {entry.contributions.length > 1 ? (
            <span className="text-[10px] font-semibold text-[var(--wk-text-muted)]">
              {entry.contributions.length} charts
            </span>
          ) : null}
          <button type="button" aria-expanded={expanded}
            aria-label={(expanded ? "Hide" : "View") + " chart appearances for " + entry.title}
            onClick={() => setExpanded(v => !v)}
            className="rounded-lg border border-[var(--wk-border)] px-2 py-1.5 text-[11px] font-bold text-[var(--wk-text-soft)] transition hover:text-[var(--wk-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wk-brand)]">
            {expanded ? "Less" : "Details"}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mx-3 mb-3 rounded-xl bg-[var(--wk-surface-raised)] px-3 py-3 sm:mx-4">
          <p className="mb-2 text-[11px] font-bold text-[var(--wk-text)]">Chart Appearances</p>
          <div className="flex flex-wrap gap-2">
            {entry.contributions.map(c => (
              <span key={c.source_key + ":" + c.native_rank}
                className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--wk-text-soft)]">
                {(SOURCE_NAMES[c.source_key] || c.source_key) + " #" + c.native_rank}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

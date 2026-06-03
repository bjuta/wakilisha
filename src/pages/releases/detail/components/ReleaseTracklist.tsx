import { useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import type { RepairedReleaseDetail } from "@/services/repairedContent/client";

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ReleaseTracklist({
  release,
  tracks,
}: {
  release: RepairedReleaseDetail;
  tracks: RepairedReleaseDetail["tracks"];
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);

  return (
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="ListMusic" size={12} />
            Tracklist
          </div>
          <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
            {release.trackCount} tracks
          </h2>
        </div>

        <div className="border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)]">
          {tracks.map((track, index) => {
            const isPlaying = playing === track.id;
            return (
              <Link
                key={track.id}
                to={`/tracks/${track.slug}`}
                className="group grid items-center gap-3 px-4 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0 transition-colors hover:bg-[var(--wk-surface-raised)]"
                style={{ gridTemplateColumns: "44px 1fr 72px 40px" }}
                onClick={(e) => {
                  if (isPlaying) e.preventDefault();
                }}
              >
                {/* Track number */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-[13px] font-extrabold text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors">
                  {isPlaying ? (
                    <span className="animate-pulse text-[var(--wk-brand)]">
                      <WkIcon name="Volume2" size={14} />
                    </span>
                  ) : (
                    <span className="group-hover:hidden">{index + 1}</span>
                  )}
                  <button
                    className="hidden group-hover:inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--wk-brand)] text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPlaying(isPlaying ? null : track.id);
                    }}
                  >
                    <WkIcon name="Play" size={13} />
                  </button>
                </div>

                {/* Track info */}
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold text-[var(--wk-text)] truncate">
                    {track.title}
                  </div>
                  <div className="text-[11px] font-semibold text-[var(--wk-text-muted)] mt-0.5 truncate">
                    {track.artist}
                  </div>
                </div>

                {/* Duration */}
                <div className="text-[12px] font-bold text-[var(--wk-text-faint)] text-right tabular-nums">
                  {formatDuration(track.duration)}
                </div>

                {/* More / Play indicator */}
                <div className="flex items-center justify-center">
                  <WkIcon
                    name="ChevronRight"
                    size={14}
                    className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-text-muted)] transition-colors"
                  />
                </div>
              </Link>
            );
          })}

          {tracks.length === 0 && (
            <div className="px-4 py-10 text-center text-[14px] font-semibold text-[var(--wk-text-muted)]">
              <WkIcon name="ListMusic" size={28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              No tracklist available for this release.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
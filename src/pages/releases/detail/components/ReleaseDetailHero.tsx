import { useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import type { RepairedReleaseDetail } from "@/services/repairedContent/client";

export default function ReleaseDetailHero({
  release,
  minutes,
}: {
  release: RepairedReleaseDetail;
  minutes: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <section className="relative overflow-hidden">
      {/* Ambient blurred background */}
      <div
        className="absolute inset-0 opacity-20 scale-110"
        style={{
          backgroundImage: `url(${release.artworkUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(90px) saturate(1.4)",
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/40 via-[var(--wk-bg)]/70 to-[var(--wk-bg)]" />

      {/* Content */}
      <div className="relative z-10 wk-container-wide px-6 py-16 md:py-24 lg:py-28">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-end">
          {/* Album cover */}
          <div
            className="relative flex-shrink-0 w-[280px] md:w-[340px] lg:w-[380px] aspect-square rounded-2xl overflow-hidden border border-[var(--wk-border)]"
            style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.28)" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <img
              src={release.artworkUrl}
              alt={release.title}
              className="w-full h-full object-cover transition-transform duration-700 ease-out"
              style={{ transform: hovered ? "scale(1.04)" : "scale(1)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-2">
            {/* Kicker */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)]/60 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-5">
              <WkIcon name="Album" size={13} />
              {release.releaseType}
            </div>

            {/* Title */}
            <h1
              className="font-[var(--wk-font-display)] font-black text-[var(--wk-text)] leading-[0.9] tracking-[-0.05em]"
              style={{ fontSize: "clamp(40px, 6vw, 84px)" }}
            >
              {release.title}
            </h1>

            {/* Artist / Label */}
            <div className="flex flex-wrap items-center gap-3 mt-4 text-[15px] md:text-[17px] font-bold text-[var(--wk-text-muted)]">
              <span className="text-[var(--wk-text)]">{release.artist}</span>
              <span className="text-[var(--wk-text-faint)]">·</span>
              <span>{release.labelName}</span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-5 mt-6 text-[12px] font-bold text-[var(--wk-text-muted)]">
              <span className="inline-flex items-center gap-2">
                <WkIcon name="Calendar" size={14} />
                {release.year}
              </span>
              <span className="inline-flex items-center gap-2">
                <WkIcon name="ListMusic" size={14} />
                {release.trackCount} tracks
              </span>
              <span className="inline-flex items-center gap-2">
                <WkIcon name="Clock3" size={14} />
                {minutes} min
              </span>
              <span className="inline-flex items-center gap-2">
                <WkIcon name="Disc3" size={14} />
                {release.releaseType}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mt-8">
              <button className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--wk-brand)] text-white px-6 py-3 text-[14px] font-extrabold hover:bg-[var(--wk-brand)]/90 transition-colors whitespace-nowrap">
                <WkIcon name="Play" size={18} />
                Play
              </button>
              <button className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-5 py-3 text-[13px] font-bold hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap">
                <WkIcon name="Shuffle" size={16} />
                Shuffle
              </button>
              <button className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-5 py-3 text-[13px] font-bold hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap">
                <WkIcon name="Heart" size={16} />
                Save
              </button>
              <div className="ml-1">
                <ShareButton
                  item={{
                    title: release.title,
                    subtitle: release.artist,
                    description: `${release.releaseType} by ${release.artist} on WAKILISHA`,
                    imageUrl: release.artworkUrl,
                    type: "album",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
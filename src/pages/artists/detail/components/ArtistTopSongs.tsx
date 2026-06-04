import { useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

interface ArtistTopSongsProps {
  songs: Array<{
    title: string;
    artists: string;
    image: string;
    duration: string;
    songUrl: string;
  }>;
}

export function ArtistTopSongs({ songs }: ArtistTopSongsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <div className="mb-6">
        <div className="wk-eyebrow mb-2">Popular</div>
        <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
          Top Songs
        </h2>
      </div>

      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[48px_56px_1fr_80px_56px] items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)]">
          <span className="text-center">#</span>
          <span></span>
          <span>Title</span>
          <span className="text-center">Duration</span>
          <span className="text-center"></span>
        </div>

        <div className="divide-y divide-[var(--wk-divider)]">
          {songs.map((song, index) => (
            <div
              key={`${index}-${song.title}`}
              className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--wk-surface-raised)] md:grid md:grid-cols-[48px_56px_1fr_80px_56px] md:gap-3"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Rank */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black text-[var(--wk-text-faint)] md:mx-auto transition-colors group-hover:bg-[var(--wk-brand-soft)] group-hover:text-[var(--wk-brand)]">
                {index + 1}
              </span>

              {/* Artwork */}
              <div className="hidden md:flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                {song.image ? (
                  <img src={song.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Ch19GradientImage slug={`song-${index}`} name={song.title} />
                )}
              </div>

              {/* Title & Artists */}
              <div className="min-w-0 flex-1 md:flex-none">
                <div className="truncate text-[14px] font-bold text-[var(--wk-text)]">{song.title}</div>
                <div className="truncate text-[12px] text-[var(--wk-text-muted)] md:hidden">
                  {song.artists} · {song.duration}
                </div>
                <div className="hidden md:block truncate text-[12px] text-[var(--wk-text-muted)]">
                  {song.artists}
                </div>
              </div>

              {/* Duration */}
              <span className="hidden text-center text-[13px] font-semibold text-[var(--wk-text-muted)] md:block">
                {song.duration}
              </span>

              {/* Play / More */}
              <span className="hidden md:flex items-center justify-center">
                {song.songUrl ? (
                  <a
                    href={song.songUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all ${
                      hoveredIndex === index ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    }`}
                  >
                    <i className="ri-play-mini-fill text-sm" />
                  </a>
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="ri-more-2-line text-sm" />
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
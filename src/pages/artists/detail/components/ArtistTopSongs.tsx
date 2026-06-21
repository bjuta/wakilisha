import React, { useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { usePlayer } from "@/context/PlayerContext";

interface Song {
  title: string;
  artists: string;
  image: string;
  duration: string;
  songUrl: string;
}

interface ArtistTopSongsProps {
  songs: Song[];
  artistSlug?: string;
}

/* ─────────────────────────────────────────────
   Expanded panel — same design language as
   ChartRowExpandedPanel, adapted for song data
   ───────────────────────────────────────────── */
function SongExpandedPanel({
  song,
  rank,
  artistSlug,
}: {
  song: Song;
  rank: number;
  artistSlug?: string;
}) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const artistList = song.artists
    .split(/,\s*|feat\.\s*|ft\.\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);

  const trackId = `top-song-${song.title}-${song.artists}`.toLowerCase().replace(/\s+/g, "-");
  const isCurrentTrack = currentTrack?.id === trackId;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlaySong = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentTrack) {
      togglePlay();
      return;
    }
    playTrack(
      {
        id: trackId,
        title: song.title,
        artist: song.artists,
        artworkUrl: song.image,
        isPlayable: true,
        previewUrl: song.songUrl,
      },
      undefined,
      {
        pageType: "artist_detail",
        entitySlug: artistSlug,
        entityType: "artist",
        sourceSection: "top_songs_expanded",
      },
    );
  };

  return (
    <div className="overflow-hidden">
      <div className="mx-3 mb-3 rounded-xl border border-[var(--wk-divider)] bg-[var(--wk-surface-raised)]/60 px-4 py-3.5">

        {/* Stat strip */}
        <div className="mb-3.5 flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-[var(--wk-divider)] pb-3.5">
          {/* Popularity rank */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">
              Popularity
            </span>
            <span className="text-[20px] font-black leading-none text-[var(--wk-brand)]">
              #{rank}
            </span>
          </div>

          {song.duration && (
            <>
              <div className="h-7 w-px self-end mb-0.5 bg-[var(--wk-divider)]" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">
                  Length
                </span>
                <span className="text-[20px] font-black leading-none text-[var(--wk-text)]">
                  {song.duration}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Bottom row: artist chips + listen link */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {artistList.map((name) => (
              <span
                key={name}
                className="flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)] whitespace-nowrap"
              >
                {name}
              </span>
            ))}
          </div>

          {song.songUrl && (
            <button
              onClick={handlePlaySong}
              className="flex items-center gap-1 text-[11px] font-bold text-[var(--wk-brand)] transition-opacity hover:opacity-70 whitespace-nowrap"
            >
              <i className={`text-[10px] ${isTrackPlaying ? "ri-pause-line" : "ri-play-line"}`} />
              {isTrackPlaying ? "Pause" : "Listen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Single song row — mirrors ChartRow exactly
   ───────────────────────────────────────────── */
function ArtistSongRow({ song, index, artistSlug }: { song: Song; index: number; artistSlug?: string }) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [isExpanded, setIsExpanded] = useState(false);
  const rank = index + 1;

  const trackId = `top-song-${song.title}-${song.artists}`.toLowerCase().replace(/\s+/g, "-");
  const isCurrentTrack = currentTrack?.id === trackId;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlaySong = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentTrack) {
      togglePlay();
      return;
    }
    playTrack({
      id: trackId,
      title: song.title,
      artist: song.artists,
      artworkUrl: song.image,
      isPlayable: true,
      previewUrl: song.songUrl,
    }, undefined, {
      pageType: "artist_detail",
      entitySlug: artistSlug,
      entityType: "artist",
      sourceSection: "top_songs",
    });
  };

  return (
    <div
      className={`group rounded-xl transition-all duration-200 ${
        isExpanded ? "bg-[var(--wk-surface-raised)]" : "hover:bg-[var(--wk-surface-raised)]"
      }`}
    >
      {/* Main row */}
      <div
        onClick={() => setIsExpanded((v) => !v)}
        className="flex cursor-pointer items-center gap-3 px-3 py-3 select-none"
      >
        {/* Rank */}
        <div className="flex w-10 shrink-0 flex-col items-center">
          <span className="text-[20px] font-black leading-none text-[var(--wk-text-muted)]">
            {rank}
          </span>
        </div>

        {/* Artwork — visible on all screen sizes */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
          {song.image ? (
            <img
              src={song.image}
              alt={song.title}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <Ch19GradientImage slug={`song-${index}-${song.title}`} name={song.title} />
          )}
        </div>

        {/* Title + artist */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-[var(--wk-text)]">
            {song.title}
          </div>
          <div className="truncate text-[12px] text-[var(--wk-text-muted)]">
            {song.artists}
          </div>
        </div>

        {/* Duration — desktop only in the row, shown in expanded panel on mobile */}
        {song.duration && (
          <span className="hidden shrink-0 text-[12px] tabular-nums text-[var(--wk-text-faint)] sm:block">
            {song.duration}
          </span>
        )}

        {/* Play button — always uses PlayerContext, never downloads */}
        <button
          onClick={handlePlaySong}
          aria-label={isTrackPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-150 whitespace-nowrap ${
            isCurrentTrack
              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-100 scale-100"
              : "bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-75"
          }`}
        >
          <i className={`text-sm ${isTrackPlaying ? "ri-pause-mini-fill" : "ri-play-mini-fill"}`} />
        </button>

        {/* Expand chevron */}
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-faint)] transition-all duration-200 ${
            isExpanded
              ? "rotate-180 bg-[var(--wk-surface-raised)] text-[var(--wk-text)]"
              : "group-hover:text-[var(--wk-text-muted)]"
          }`}
        >
          <i className="ri-arrow-down-s-line text-[16px]" />
        </div>
      </div>

      {/* Expandable panel — smooth grid-rows animation */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.25s ease",
        }}
      >
        <SongExpandedPanel song={song} rank={rank} artistSlug={artistSlug} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section
   ───────────────────────────────────────────── */
export function ArtistTopSongs({ songs, artistSlug }: ArtistTopSongsProps) {
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
        {/* Column header — desktop only */}
        <div className="hidden sm:flex items-center gap-3 border-b border-[var(--wk-divider)] px-3 py-2.5">
          <span className="w-10 shrink-0 text-center text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">#</span>
          <span className="w-12 shrink-0" />
          <span className="flex-1 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">Title</span>
          <span className="hidden sm:block text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">Time</span>
          <span className="w-9 shrink-0" />
          <span className="w-7 shrink-0" />
        </div>

        <div className="divide-y divide-[var(--wk-divider)]">
          {songs.map((song, index) => (
            <ArtistSongRow key={`${index}-${song.title}`} song={song} index={index} artistSlug={artistSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}
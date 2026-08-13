import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import type { ChartEntryRowViewModel } from "@/services/chartsPublic/viewModels";

// ─── Types ───

interface ArtistTrack {
  title: string;
  slug: string;
  rank: number;
  weeksOnChart: number;
  movement: ChartEntryRowViewModel["movement"];
  movementAmount: number | null;
  artworkUrl: string | null;
}

interface ArtistSummary {
  key: string;
  name: string;
  slug: string | null;
  topRank: number;
  trackCount: number;
  topArtworkUrl: string | null;
  tracks: ArtistTrack[];
}

// ─── Helpers ───

const RANK_COLOR: Record<number, string> = {
  1: "#C9A96E",
  2: "#A8A8A8",
  3: "#B87333",
};

const MVT_ICON: Record<string, { icon: string; color: string; label: string }> = {
  up: { icon: "ri-arrow-up-line", color: "var(--wk-success)", label: "Up" },
  down: { icon: "ri-arrow-down-line", color: "var(--wk-danger)", label: "Down" },
  new: { icon: "ri-star-smile-line", color: "var(--wk-brand)", label: "New" },
  re_entry: { icon: "ri-refresh-line", color: "var(--wk-brand)", label: "Re" },
  same: { icon: "ri-subtract-line", color: "var(--wk-text-faint)", label: "—" },
};

function buildArtists(entries: ChartEntryRowViewModel[]): ArtistSummary[] {
  const map = new Map<string, ArtistSummary>();

  entries.forEach((entry) => {
    const names = entry.artistNames ?? entry.artist.split(", ");
    const slugs = entry.artistSlugs ?? [];

    names.forEach((name, i) => {
      const slug = slugs[i] ?? null;
      const key = slug ?? name.toLowerCase().replace(/\s+/g, "-");

      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          slug,
          topRank: entry.rank,
          trackCount: 0,
          topArtworkUrl: entry.artworkUrl,
          tracks: [],
        });
      }

      const artist = map.get(key)!;
      artist.tracks.push({
        title: entry.title,
        slug: entry.slug,
        rank: entry.rank,
        weeksOnChart: entry.weeksOnChart,
        movement: entry.movement,
        movementAmount: entry.movementAmount,
        artworkUrl: entry.artworkUrl,
      });

      artist.tracks.sort((a, b) => a.rank - b.rank);
      artist.topRank = artist.tracks[0].rank;
      artist.topArtworkUrl = artist.tracks[0].artworkUrl;
      artist.trackCount = artist.tracks.length;
    });
  });

  return Array.from(map.values()).sort((a, b) => a.topRank - b.topRank);
}

// ─── Artist Circle Card ───

function ArtistCircle({
  artist,
  isSelected,
  onClick,
}: {
  artist: ArtistSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  const rankColor = RANK_COLOR[artist.topRank] ?? "var(--wk-brand)";

  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 cursor-pointer flex-col items-center gap-2 transition-all duration-200 ${isSelected ? "opacity-100 scale-105" : "opacity-70 hover:opacity-100 hover:scale-102"}`}
    >
      <div
        className={`relative h-[68px] w-[68px] overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-[var(--wk-bg)] transition-all duration-200 ${isSelected ? "ring-[var(--wk-brand)]" : "ring-[var(--wk-border)] hover:ring-[var(--wk-brand)]/50"}`}
      >
        {artist.topArtworkUrl ? (
          <img
            src={artist.topArtworkUrl}
            alt={artist.name}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <Ch19GradientImage slug={artist.key} name={artist.name} />
        )}
        {/* Rank badge */}
        <div
          className="absolute bottom-0 right-0 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-black leading-none"
          style={{
            backgroundColor: rankColor,
            color: artist.topRank <= 3 ? "#0a0a0a" : "#fff",
          }}
        >
          {artist.topRank}
        </div>
      </div>

      <div className="w-[68px] text-center">
        <div className="truncate text-[11px] font-bold text-[var(--wk-text)]">
          {artist.name}
        </div>
        {artist.trackCount > 1 && (
          <div className="text-[9px] font-semibold text-[var(--wk-brand)]">
            {artist.trackCount} tracks
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Track Row Inside Detail Panel ───

function ArtistTrackRow({
  track,
  onJump,
}: {
  track: ArtistTrack;
  onJump: (slug: string) => void;
}) {
  const mvt = MVT_ICON[track.movement] ?? MVT_ICON.same;
  const rankColor = RANK_COLOR[track.rank] ?? "var(--wk-text-muted)";

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--wk-surface-raised)]">
      {/* Rank */}
      <div className="w-8 shrink-0 text-right">
        <span className="text-[16px] font-black tabular-nums" style={{ color: rankColor }}>
          {track.rank}
        </span>
      </div>

      {/* Artwork */}
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md">
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <Ch19GradientImage slug={track.slug} name={track.title} />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{track.title}</div>
        <div className="text-[10px] text-[var(--wk-text-faint)]">
          {track.weeksOnChart} week{track.weeksOnChart !== 1 ? "s" : ""} on chart
        </div>
      </div>

      {/* Movement */}
      <div className="flex shrink-0 items-center gap-1">
        <i className={`${mvt.icon} text-[12px]`} style={{ color: mvt.color }} />
        {track.movementAmount && track.movementAmount > 0 && (
          <span className="text-[10px] font-bold tabular-nums" style={{ color: mvt.color }}>
            {track.movementAmount}
          </span>
        )}
      </div>

      {/* Jump to */}
      <button
        onClick={() => onJump(track.slug)}
        className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--wk-brand)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand-on)] transition-opacity hover:opacity-75 whitespace-nowrap cursor-pointer"
      >
        Jump <i className="ri-arrow-down-line text-[9px]" />
      </button>
    </div>
  );
}

// ─── Main Component ───

interface ArtistRolodexProps {
  entries: ChartEntryRowViewModel[];
  onJumpTo: (slug: string) => void;
  familyLabel: string;
}

export function ArtistRolodex({ entries, onJumpTo, familyLabel }: ArtistRolodexProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const artists = useMemo(() => buildArtists(entries), [entries]);
  const selected = useMemo(
    () => artists.find((a) => a.key === selectedKey) ?? null,
    [artists, selectedKey]
  );

  if (artists.length === 0) return null;

  const handleSelect = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  const handleJump = (slug: string) => {
    setSelectedKey(null);
    onJumpTo(slug);
  };

  return (
    <section className="wk-container px-4 pb-8 md:px-6">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="wk-eyebrow mb-1.5">Browse by artist</div>
          <h2 className="wk-h-section">Who's on the charts</h2>
          <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
            {artists.length} artists in this edition
          </p>
        </div>
        {selected && (
          <button
            onClick={() => setSelectedKey(null)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-close-line text-[14px]" /> Clear
          </button>
        )}
      </div>

      {/* Artist scroll */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {artists.map((artist) => (
          <ArtistCircle
            key={artist.key}
            artist={artist}
            isSelected={selectedKey === artist.key}
            onClick={() => handleSelect(artist.key)}
          />
        ))}
      </div>

      {/* Detail panel — smooth grid expand */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: selected ? "1fr" : "0fr",
          transition: "grid-template-rows 0.28s ease",
        }}
      >
        <div className="overflow-hidden">
          {selected && (
            <div className="mt-4 rounded-2xl border border-[var(--wk-brand)]/20 bg-[var(--wk-surface)] p-4">
              {/* Artist header */}
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--wk-brand)]/30">
                    {selected.topArtworkUrl ? (
                      <img
                        src={selected.topArtworkUrl}
                        alt={selected.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Ch19GradientImage slug={selected.key} name={selected.name} />
                    )}
                  </div>
                  <div>
                    <div className="text-[17px] font-black text-[var(--wk-text)]">{selected.name}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">
                      {selected.trackCount} track{selected.trackCount !== 1 ? "s" : ""} on {familyLabel} · Best position #{selected.topRank}
                    </div>
                  </div>
                </div>
                {selected.slug && (
                  <Link
                    to={`/artists/${selected.slug}`}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-[var(--wk-brand)] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Artist page
                    <i className="ri-arrow-right-up-line text-[10px]" />
                  </Link>
                )}
              </div>

              {/* Track list */}
              <div className="space-y-0.5">
                {selected.tracks.map((track) => (
                  <ArtistTrackRow
                    key={track.slug}
                    track={track}
                    onJump={handleJump}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
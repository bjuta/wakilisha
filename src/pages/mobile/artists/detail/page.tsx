import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { ARTIST_DETAILS } from "@/mocks/artistDetails";
import { ARTISTS } from "@/mocks/artists";

export default function MobileArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const detail = ARTIST_DETAILS.find((a) => a.slug === slug);
  const base = ARTISTS.find((a) => a.slug === slug);
  const [bioExpanded, setBioExpanded] = useState(false);

  if (!base) {
    return (
      <div className="px-5 py-20 text-center">
        <i className="ri-user-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
        <p className="text-[var(--wk-text-muted)]">Artist not found</p>
      </div>
    );
  }

  const artist = {
    name: base.name,
    imageUrl: detail?.imageUrl || base.imageUrl,
    genres: base.genres,
    country: base.country || "Nigeria",
    debutYear: base.debutYear || 2010,
    monthlyStreams: base.monthlyStreams || 0,
    trackCount: base.trackCount,
    releaseCount: base.releaseCount,
    isChartArtist: base.isChartArtist,
    topChartPosition: base.topChartPosition,
    bio: detail?.bio || base.spotlightBio || `${base.name} is an artist in the WAKILISHA registry.`,
    isRising: base.isRising,
    chartEntries: detail?.chartEntries,
    releases: detail?.releases,
    relatedArtists: detail?.relatedArtists,
  };

  const bioPreview = artist.bio.slice(0, 180);
  const bioFull = artist.bio;
  const bioIsLong = bioFull.length > 180;

  // Enrich related artists with images
  const relatedArtists = artist.relatedArtists?.map((ra) => {
    const found = ARTISTS.find((a) => a.slug === ra.slug);
    return { ...ra, imageUrl: found?.imageUrl };
  });

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[360px] flex items-end overflow-hidden">
        {artist.imageUrl && (
          <>
            <img
              src={artist.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />
          </>
        )}
        <div className="relative w-full px-5 pb-6 pt-20">
          <div className="mb-2 flex items-center gap-2">
            <Link
              to="/artists"
              className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]"
            >
              Artists
            </Link>
            <i className="ri-arrow-right-line text-[9px] text-white/40" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/50">
              Registry
            </span>
            {artist.isChartArtist && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                <i className="ri-bar-chart-line text-[9px]" />
                Chart # {artist.topChartPosition}
              </span>
            )}
          </div>
          <h1
            className="font-black leading-[0.88] tracking-[-0.04em] text-[#F0EFE8]"
            style={{ fontSize: "clamp(36px, 10vw, 56px)" }}
          >
            {artist.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-white/60">
            {artist.genres.map((g) => (
              <span
                key={g}
                className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm"
              >
                {g}
              </span>
            ))}
            <span className="text-white/30">·</span>
            <span>{artist.country}</span>
            <span className="text-white/30">·</span>
            <span>Since {artist.debutYear}</span>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="sticky top-0 z-20 border-b border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3 flex gap-3">
        <button className="flex-1 h-11 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] font-bold text-[13px] flex items-center justify-center gap-2">
          <i className="ri-play-fill text-lg" />
          Play
        </button>
        <button className="flex-1 h-11 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] font-bold text-[13px] flex items-center justify-center gap-2">
          <i className="ri-user-add-line text-[15px]" />
          Follow
        </button>
        <button className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)]">
          <i className="ri-share-line text-[15px]" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[
          { label: "Tracks", value: artist.trackCount, icon: "ri-music-2-line" },
          { label: "Releases", value: artist.releaseCount, icon: "ri-album-line" },
          { label: "Streams", value: `${artist.monthlyStreams}M`, icon: "ri-headphone-line" },
          { label: "Peak", value: artist.isChartArtist ? `#${artist.topChartPosition}` : "—", icon: "ri-bar-chart-line" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-1 py-3 text-center">
            <div className="text-[16px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Bio */}
      <div className="px-5 py-6">
        <div className="wk-eyebrow mb-2">About</div>
        <p className="text-[14px] leading-[1.6] text-[var(--wk-text-soft)]">
          {bioExpanded ? bioFull : bioPreview}
          {bioIsLong && !bioExpanded && "…"}
        </p>
        {bioIsLong && (
          <button
            onClick={() => setBioExpanded(!bioExpanded)}
            className="mt-2 text-[12px] font-bold text-[var(--wk-brand)]"
          >
            {bioExpanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Chart entries */}
      {artist.chartEntries && artist.chartEntries.length > 0 && (
        <div className="border-t border-[var(--wk-border)] px-5 py-6">
          <div className="wk-eyebrow mb-2">Chart entries</div>
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="divide-y divide-[var(--wk-divider)]">
              {artist.chartEntries.map((entry) => {
                const trackSlug = entry.title.toLowerCase().replace(/\s+/g, "-");
                return (
                  <Link
                    key={entry.rank}
                    to={`/tracks/${trackSlug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--wk-surface-raised)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[13px] font-black text-[var(--wk-brand)]">
                      {entry.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)]">
                        {entry.artist} · Peak #{entry.peakPosition} · {entry.weeksOnChart}w
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.movement === "up" && (
                        <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--wk-delta-up)]">
                          <i className="ri-arrow-up-line" /> {entry.movementAmount}
                        </span>
                      )}
                      {entry.movement === "down" && (
                        <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--wk-delta-down)]">
                          <i className="ri-arrow-down-line" /> {entry.movementAmount}
                        </span>
                      )}
                      {entry.movement === "new" && (
                        <span className="rounded bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-brand)]">
                          NEW
                        </span>
                      )}
                      {entry.movement === "same" && (
                        <span className="text-[11px] text-[var(--wk-text-faint)]">—</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Discography */}
      {artist.releases && artist.releases.length > 0 && (
        <div className="border-t border-[var(--wk-border)] px-5 py-6">
          <div className="wk-eyebrow mb-2">Discography</div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {artist.releases.map((rel) => (
              <Link
                key={rel.slug}
                to={`/releases/${rel.slug}`}
                className="group block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]"
                style={{ width: "160px" }}
              >
                <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                  {rel.artworkUrl ? (
                    <img
                      src={rel.artworkUrl}
                      alt={rel.title}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <i className="ri-album-line text-3xl text-[var(--wk-text-faint)]" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h4 className="truncate text-[13px] font-bold text-[var(--wk-text)]">{rel.title}</h4>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)]">
                    {rel.releaseType && (
                      <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--wk-text-soft)]">
                        {rel.releaseType}
                      </span>
                    )}
                    {rel.year && <span>{rel.year}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Related artists */}
      {relatedArtists && relatedArtists.length > 0 && (
        <div className="border-t border-[var(--wk-border)] px-5 py-6">
          <div className="wk-eyebrow mb-2">Related artists</div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {relatedArtists.map((a) => (
              <Link
                key={a.slug}
                to={`/artists/${a.slug}`}
                className="group block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] relative"
                style={{ width: "140px", aspectRatio: "3/4" }}
              >
                <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
                  {a.imageUrl ? (
                    <img
                      src={a.imageUrl}
                      alt={a.name}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <i className="ri-user-3-line text-2xl text-[var(--wk-text-faint)]" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h4 className="text-[13px] font-bold text-white">{a.name}</h4>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
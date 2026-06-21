import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchFeaturedArtists, type FeaturedArtist } from "@/services/magazineFeaturedArtists";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

function formatSlugName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FeaturedArtistSpotlight() {
  const [artists, setArtists] = useState<FeaturedArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFeaturedArtists().then((data) => {
      if (!cancelled) {
        setArtists(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="mag-reveal">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-7 h-px bg-[var(--wk-brand)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">Featured Artists</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] animate-pulse" style={{ aspectRatio: "3/4" }}>
              <div className="h-full w-full bg-[var(--wk-surface-raised)]" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (artists.length === 0) return null;

  return (
    <section className="mag-reveal">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
            Featured Artists
          </span>
          <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
            {artists.length} {artists.length === 1 ? "artist" : "artists"}
          </span>
        </div>
        <Link
          to="/artists"
          className="text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors flex items-center gap-1 whitespace-nowrap"
        >
          All artists <i className="ri-arrow-right-line text-[11px]" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {artists.map((artist) => {
          const displayName = artist.artist_name || formatSlugName(artist.artist_slug);
          const hasImage = !!artist.artist_image;

          return (
            <Link
              key={artist.id}
              to={`/artists/${artist.artist_slug}`}
              className="group relative block overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 hover:border-[var(--wk-border-strong)] hover:-translate-y-1 cursor-pointer"
              style={{ aspectRatio: "3/4" }}
            >
              {/* Artist image / gradient fallback */}
              <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
                {hasImage ? (
                  <img
                    src={artist.artist_image!}
                    alt={displayName}
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="relative h-full w-full">
                    <Ch19GradientImage slug={artist.artist_slug} name={displayName} />
                    {/* Center icon overlay for no-image state */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center backdrop-blur-sm bg-black/10">
                        <i className="ri-mic-line text-2xl text-white/60" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

              {/* Content overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-[16px] font-black tracking-[-0.02em] leading-tight text-white group-hover:text-[var(--wk-brand)] transition-colors">
                  {displayName}
                </h3>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/55 font-semibold">
                  {artist.artist_country && (
                    <>
                      <span>{artist.artist_country}</span>
                      {artist.artist_genres.length > 0 && <span className="text-white/25">·</span>}
                    </>
                  )}
                  {artist.artist_genres.length > 0 && (
                    <span className="truncate">{artist.artist_genres.slice(0, 2).join(", ")}</span>
                  )}
                </div>
                {artist.artist_genres.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {artist.artist_genres.slice(0, 2).map((g) => (
                      <span
                        key={g}
                        className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-white/70 backdrop-blur-sm"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Hover reveal */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/25">
                <div className="flex h-10 w-10 translate-y-3 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <i className="ri-arrow-right-line text-lg" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { MetaTags } from "@/components/seo/MetaTags";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import type { WebPageSchema } from "@/components/seo/SchemaOrg";
import { ch19Background } from "@/utils/ch19";
import { getGenre, type PublicGenreDetail } from "@/services/publicApi/client";
import { buildGenreHeroIntro, buildGenreSeoDescription } from "@/services/cultureContext/genreAdapters";
import { trackUrl } from "@/utils/trackUrl";
import { releaseUrl } from "@/utils/releaseUrl";
import { slugify } from "@/services/publicContent/client";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";

function formatArtistCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function releaseTypeBadge(type: string) {
  const t = type.toLowerCase();
  if (t === "album") return "Album";
  if (t === "ep") return "EP";
  if (t === "single") return "Single";
  return t;
}

export default function GenreDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<PublicGenreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) {
      setLoading(false);
      setError("No genre slug provided");
      return;
    }
    setLoading(true);
    setError(null);
    getGenre(slug)
      .then((data) => {
        if (!alive) return;
        if (!data) {
          setError("Genre not found.");
          setLoading(false);
          return;
        }
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load genre.");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Loading genre&hellip;</p>
        </div>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="min-h-screen px-6 py-20 text-center">
        <WkIcon name="Compass" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <h1 className="mb-2 text-[28px] font-black text-[var(--wk-text)]">Genre not found</h1>
        <p className="text-[var(--wk-text-muted)]">{error || "This genre could not be found."}</p>
        <Link to="/genres" className="inline-block mt-6 rounded-xl bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)]">Back to genres</Link>
      </main>
    );
  }

  const { genre, artists, releases, topTracks, relatedGenres } = detail;
  const sortedReleases = [...(releases || [])].sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
  const heroBg = ch19Background({ slug: genre.slug, name: genre.name });
  const genreIntro = buildGenreHeroIntro(detail) || genre.description || "";
  const seoDescription = buildGenreSeoDescription(detail);

  // Pick a random roster artist image for the hero (deterministic by slug)
  const artistsWithImages = (artists || []).filter((a) => a.imageUrl);
  const heroArtistImage = artistsWithImages.length > 0
    ? artistsWithImages[genre.slug.length % artistsWithImages.length].imageUrl
    : null;

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <MetaTags
        title={`${genre.name} on WAKILISHA`}
        description={seoDescription}
        type="website"
      />

      <SchemaOrg
        data={{
          "@type": "WebPage",
          name: `${genre.name}. WAKILISHA Genre`,
          description: seoDescription,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }}
      />

      <section className="relative -mt-16 pt-16 flex min-h-[380px] items-end overflow-hidden md:min-h-[520px]">
        <div className="absolute inset-0" style={{ background: heroBg }} />
        {heroArtistImage && (
          <div className="absolute inset-0">
            <img src={heroArtistImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/55" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative w-full px-4 pb-8 pt-20 md:px-8 md:pb-14 md:pt-28">
          <div className="mx-auto max-w-[1100px]">
            <Link to="/genres" className="mb-4 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/60 transition-colors hover:text-white">
              <span className="h-px w-5 bg-white/40" /> Genres
            </Link>
            <h1 className="font-black leading-[0.88] tracking-[-0.04em] text-white" style={{ fontSize: "clamp(36px, 7vw, 88px)" }}>{genre.name}</h1>
            {genreIntro && (
              <p className="mt-3 max-w-[620px] text-[14px] leading-relaxed text-white/60 md:text-[17px]">{genreIntro}</p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] text-white/50 md:text-[13px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                <WkIcon name="Users" size={13} />
                <strong className="text-white/80">{formatArtistCount(artists.length)}</strong> artists
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                <WkIcon name="Music2" size={13} />
                <strong className="text-white/80">{topTracks.length}</strong> top tracks
              </span>
              {sortedReleases.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                  <WkIcon name="Disc" size={13} />
                  <strong className="text-white/80">{sortedReleases.length}</strong> releases
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-14">
        <div className="space-y-14">
          {artists.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Representative artists</h2>
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">{artists.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {artists.slice(0, 18).map((artist) => (
                  <Link
                    key={artist.slug}
                    to={`/artists/${artist.slug}`}
                    className="group overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]"
                  >
                    <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                      {artist.imageUrl ? (
                        <img src={artist.imageUrl} alt={artist.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <Chapter19FallbackImage slug={artist.slug} name={artist.name} className="h-full" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="p-3">
                      <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{artist.name}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)]">Artist</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {topTracks.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Top tracks</h2>
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">{topTracks.length}</span>
              </div>
              <div className="divide-y divide-[var(--wk-divider)] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                {topTracks.slice(0, 12).map((track, i) => (
                  <Link
                    key={track.slug}
                    to={trackUrl(track.slug, [slugify(track.artistName)])}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--wk-surface-raised)] md:px-5 md:py-3.5"
                  >
                    <span className="w-6 text-center text-[12px] font-bold tabular-nums text-[var(--wk-text-faint)]">{i + 1}</span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt={track.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <WkIcon name="Music2" size={16} className="text-[var(--wk-text-faint)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold text-[var(--wk-text)]">{track.title}</div>
                      <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{track.artistName}</div>
                    </div>
                    <span className="rounded bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">#{track.peakRank}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {sortedReleases.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Releases</h2>
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">{sortedReleases.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {sortedReleases.map((release) => (
                  <Link
                    key={release.slug}
                    to={releaseUrl({ slug: release.slug, artist: release.artistName })}
                    className="group overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]"
                  >
                    <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                      {release.artworkUrl ? (
                        <img src={release.artworkUrl} alt={release.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <Chapter19FallbackImage slug={release.slug} name={release.title} className="h-full" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <span className="absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                        {releaseTypeBadge(release.releaseType)}
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{release.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)]">
                        {release.artistName && <span>{release.artistName} · </span>}
                        <span>{release.releaseDate ? release.releaseDate.split("-")[0] : "More soon"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {genre.description && (
            <section>
              <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">About this genre</h2>
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-7">
                <p className="text-[15px] leading-relaxed text-[var(--wk-text-soft)] md:text-[17px]">{genre.description}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="rounded-lg bg-[var(--wk-surface-raised)] px-4 py-2.5">
                    <div className="text-[20px] font-black text-[var(--wk-brand)]">{formatArtistCount(artists.length)}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Artists tagged</div>
                  </div>
                  <div className="rounded-lg bg-[var(--wk-surface-raised)] px-4 py-2.5">
                    <div className="text-[20px] font-black text-[var(--wk-text)]">{topTracks.length}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Charting tracks</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {relatedGenres.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Related genres</h2>
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">{relatedGenres.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {relatedGenres.map((rg) => (
                  <Link
                    key={rg.slug}
                    to={`/genres/${rg.slug}`}
                    className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
                  >
                    {rg.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[16px] font-black text-[var(--wk-text)]">Explore the full directory</h3>
                <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">Browse all genres, artists, tracks and labels across the WAKILISHA cultural map.</p>
              </div>
              <div className="flex gap-2">
                <Link to="/genres" className="whitespace-nowrap rounded-xl bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90">
                  All genres
                </Link>
                <Link to="/artists" className="whitespace-nowrap rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)]">
                  Artists
                </Link>
              </div>
            </div>
          </div>

          {/* ── Newsletter ── */}
          <section>
            <NewsletterSubscribe
              formId="genre-newsletter-form"
              headline={`Stay on the ${genre.name} pulse.`}
              description={`Get updates on ${genre.name} releases, chart movements, and new artists as they break through.`}
              contextFields={{ wk_page_type: "genre_detail", genre_slug: genre.slug, genre_name: genre.name }}
              analytics={{
                pageType: "genre_detail",
                entitySlug: slug,
                recordType: "genre",
                context: { genre_name: genre.name },
              }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

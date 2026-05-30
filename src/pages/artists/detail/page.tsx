import { useParams, Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkButton } from "@/components/design-system/primitives/Button";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ReleaseCard } from "@/components/design-system/registry/ReleaseCard";
import { ARTIST_DETAILS } from "@/mocks/artistDetails";

export default function ArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const artist = ARTIST_DETAILS.find((a) => a.slug === slug);

  if (!artist) {
    return (
      <div className="wk-container px-6 py-20 text-center">
        <i className="ri-user-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Artist not found</h1>
        <p className="text-[var(--wk-text-muted)]">This artist does not exist in the registry.</p>
        <Link to="/artists" className="mt-6 inline-block">
          <WkButton variant="primary">Back to directory</WkButton>
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Artist Hero */}
      <section className="relative min-h-[360px] md:min-h-[440px] flex items-end overflow-hidden">
        {artist.imageUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${artist.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        )}
        <div className="relative wk-container px-6 pb-10 pt-16 w-full">
          <div className="mb-3 flex items-center gap-2">
            <div className="wk-eyebrow" style={{ color: "var(--wk-brand)" }}>Registry</div>
            {artist.isChartArtist && <WkTag variant="brand">Charts</WkTag>}
          </div>
          <h1 className="wk-h-page mb-3" style={{ color: "#F0EFE8" }}>
            {artist.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-[14px]" style={{ color: "rgba(240,239,232,.7)" }}>
            {artist.genres.map((g) => (
              <span key={g} className="rounded-full border border-white/20 px-3 py-1 text-[12px] font-semibold">
                {g}
              </span>
            ))}
            <span>·</span>
            <span>{artist.trackCount} tracks</span>
            <span>·</span>
            <span>{artist.releaseCount} releases</span>
          </div>
        </div>
      </section>

      <div className="wk-container px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {/* Bio */}
            {artist.bio && (
              <div>
                <h2 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  About
                </h2>
                <p className="text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
                  {artist.bio}
                </p>
              </div>
            )}

            {/* Chart Appearances */}
            {artist.chartEntries && artist.chartEntries.length > 0 && (
              <div>
                <h2 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Chart appearances
                </h2>
                <WkSurface className="overflow-hidden">
                  <div className="divide-y divide-[var(--wk-divider)]">
                    {artist.chartEntries.map((entry) => (
                      <ChartRow key={entry.rank} {...entry} />
                    ))}
                  </div>
                </WkSurface>
              </div>
            )}

            {/* Releases */}
            {artist.releases && artist.releases.length > 0 && (
              <div>
                <h2 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Releases
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {artist.releases.map((release) => (
                    <ReleaseCard key={release.slug} {...release} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Stats */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <h3 className="mb-3 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                Stats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Tracks</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{artist.trackCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Releases</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{artist.releaseCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Charts</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">
                    {artist.chartEntries?.length ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Peak position</span>
                  <span className="text-[14px] font-bold text-[var(--wk-brand)]">
                    #{Math.min(...(artist.chartEntries?.map((e) => e.peakPosition ?? 999) ?? [999]))}
                  </span>
                </div>
              </div>
            </div>

            {/* Related Artists */}
            {artist.relatedArtists && artist.relatedArtists.length > 0 && (
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                <h3 className="mb-3 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Related artists
                </h3>
                <div className="space-y-2">
                  {artist.relatedArtists.map((a) => (
                    <Link
                      key={a.slug}
                      to={`/artists/${a.slug}`}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--wk-surface-raised)]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
                        <i className="ri-user-line text-[var(--wk-text-muted)]" />
                      </div>
                      <span className="text-[13px] font-semibold text-[var(--wk-text)]">{a.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
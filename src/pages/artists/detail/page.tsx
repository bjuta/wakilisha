import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { ARTIST_DETAILS, getArtistDetail, generateArtistDetailFromBase } from "@/mocks/artistDetails";
import { ARTISTS } from "@/mocks/artists";
import { ArtistDetailHero } from "./components/ArtistDetailHero";
import { ArtistStatsBar } from "./components/ArtistStatsBar";
import { ArtistChartSection } from "./components/ArtistChartSection";
import { ArtistDiscography } from "./components/ArtistDiscography";
import { RelatedArtistsShelf } from "./components/RelatedArtistsShelf";

export default function ArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const base = ARTISTS.find((a) => a.slug === slug);
  const detail = getArtistDetail(slug) || (base ? generateArtistDetailFromBase(base) : undefined);

  if (!base || !detail) {
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

  // Merge base + detail
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

  const stats = [
    { label: "Tracks", value: artist.trackCount, icon: "ri-music-2-line" },
    { label: "Releases", value: artist.releaseCount, icon: "ri-album-line" },
    { label: "Monthly streams", value: artist.monthlyStreams, suffix: "M", icon: "ri-headphone-line" },
    { label: "Peak chart", value: artist.isChartArtist ? `#${artist.topChartPosition}` : "—", icon: "ri-bar-chart-line" },
  ];

  // Enrich related artists with images
  const relatedArtists = artist.relatedArtists?.map((ra) => {
    const found = ARTISTS.find((a) => a.slug === ra.slug);
    return { ...ra, imageUrl: found?.imageUrl };
  });

  return (
    <div className="wk-app-shell">
      {/* Hero */}
      <ArtistDetailHero {...artist} />

      {/* Stats bar */}
      <ArtistStatsBar stats={stats} />

      {/* Bio — full editorial width */}
      <section className="wk-container px-6 py-10 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="wk-eyebrow mb-3">About the artist</div>
          <p className="text-[16px] leading-[1.65] text-[var(--wk-text-soft)] md:text-[18px]">
            {artist.bio}
          </p>
        </div>
      </section>

      {/* Chart entries */}
      {artist.chartEntries && artist.chartEntries.length > 0 && (
        <ArtistChartSection entries={artist.chartEntries} />
      )}
      {(!artist.chartEntries || artist.chartEntries.length === 0) && (
        <section className="py-10 md:py-14">
          <div className="wk-container px-6">
            <div className="mb-6">
              <div className="wk-eyebrow mb-2">Chart performance</div>
              <h3 className="text-[clamp(24px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                Chart entries
              </h3>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
              <i className="ri-bar-chart-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
              <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No chart entries yet</p>
              <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">This artist hasn't appeared on the WAKILISHA charts yet.</p>
            </div>
          </div>
        </section>
      )}

      {/* Discography */}
      {artist.releases && artist.releases.length > 0 && (
        <ArtistDiscography releases={artist.releases} />
      )}
      {(!artist.releases || artist.releases.length === 0) && (
        <section className="py-10 md:py-14">
          <div className="wk-container px-6">
            <div className="mb-6">
              <div className="wk-eyebrow mb-2">Discography</div>
              <h3 className="text-[clamp(24px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                Releases
              </h3>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
              <i className="ri-album-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
              <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No releases yet</p>
              <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">This artist's discography hasn't been added to the registry yet.</p>
            </div>
          </div>
        </section>
      )}

      {/* Related artists */}
      {relatedArtists && relatedArtists.length > 0 && (
        <RelatedArtistsShelf artists={relatedArtists} />
      )}
    </div>
  );
}
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { ARTIST_DETAILS, getArtistDetail, generateArtistDetailFromBase } from "@/mocks/artistDetails";
import { ARTISTS } from "@/mocks/artists";
import { ArtistDetailHero } from "./components/ArtistDetailHero";
import { ArtistStatsBar } from "./components/ArtistStatsBar";
import { ArtistChartSection } from "./components/ArtistChartSection";
import { ArtistDiscography } from "./components/ArtistDiscography";
import { RelatedArtistsShelf } from "./components/RelatedArtistsShelf";

type Tab = "Overview" | "Songs" | "Releases" | "Related";
const tabs: Tab[] = ["Overview", "Songs", "Releases", "Related"];

export default function ArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
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

  const relatedArtists = artist.relatedArtists?.map((ra) => {
    const found = ARTISTS.find((a) => a.slug === ra.slug);
    return { ...ra, imageUrl: found?.imageUrl };
  });

  const hasChartEntries = artist.chartEntries && artist.chartEntries.length > 0;
  const hasReleases = artist.releases && artist.releases.length > 0;
  const hasRelated = relatedArtists && relatedArtists.length > 0;

  return (
    <div className="wk-app-shell">
      {/* Hero */}
      <ArtistDetailHero {...artist} />

      {/* Stats bar */}
      <ArtistStatsBar stats={stats} />

      {/* Tab strip */}
      <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-6">
          <div className="flex gap-0 overflow-auto" style={{ scrollbarWidth: "none" }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`artist-dt-tab ${activeTab === tab ? "on" : ""}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="wk-container px-6 py-10 md:py-14">
        {/* Overview tab */}
        {activeTab === "Overview" && (
          <div className="space-y-10 md:space-y-14">
            {/* About */}
            <section>
              <div className="mb-3">
                <div className="artist-dt-kicker">About</div>
                <h2 className="artist-dt-section-title">About the artist</h2>
              </div>
              <p className="text-[16px] leading-[1.65] text-[var(--wk-text-soft)] md:text-[18px] max-w-3xl">
                {artist.bio}
              </p>
            </section>

            {/* Chart entries */}
            {hasChartEntries && (
              <section>
                <div className="mb-6">
                  <div className="artist-dt-kicker">Chart performance</div>
                  <h2 className="artist-dt-section-title">Chart entries</h2>
                </div>
                <ArtistChartSection entries={artist.chartEntries!} />
              </section>
            )}
            {!hasChartEntries && (
              <section>
                <div className="mb-6">
                  <div className="artist-dt-kicker">Chart performance</div>
                  <h2 className="artist-dt-section-title">Chart entries</h2>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
                  <i className="ri-bar-chart-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
                  <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No chart entries yet</p>
                  <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">This artist hasn't appeared on the WAKILISHA charts yet.</p>
                </div>
              </section>
            )}

            {/* Releases */}
            {hasReleases && (
              <section>
                <div className="mb-6">
                  <div className="artist-dt-kicker">Discography</div>
                  <h2 className="artist-dt-section-title">Releases</h2>
                </div>
                <ArtistDiscography releases={artist.releases!} />
              </section>
            )}
            {!hasReleases && (
              <section>
                <div className="mb-6">
                  <div className="artist-dt-kicker">Discography</div>
                  <h2 className="artist-dt-section-title">Releases</h2>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
                  <i className="ri-album-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
                  <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No releases yet</p>
                  <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">This artist's discography hasn't been added to the registry yet.</p>
                </div>
              </section>
            )}

            {/* Related artists */}
            {hasRelated && (
              <section>
                <div className="mb-6">
                  <div className="artist-dt-kicker">Connections</div>
                  <h2 className="artist-dt-section-title">Related artists</h2>
                </div>
                <RelatedArtistsShelf artists={relatedArtists!} />
              </section>
            )}
          </div>
        )}

        {/* Songs tab */}
        {activeTab === "Songs" && (
          <div>
            <div className="mb-6">
              <div className="artist-dt-kicker">Songs</div>
              <h2 className="artist-dt-section-title">All songs</h2>
            </div>
            {hasChartEntries ? (
              <div className="artist-dt-song-list">
                {artist.chartEntries!.map((entry, index) => {
                  const trackSlug = entry.slug || entry.title.toLowerCase().replace(/\s+/g, "-");
                  return (
                    <Link
                      key={`${entry.rank}-${entry.title}`}
                      to={`/tracks/${trackSlug}`}
                      className="artist-dt-song-row"
                    >
                      <div className="artist-dt-song-num">{index + 1}</div>
                      <div className="artist-dt-song-info">
                        <div className="artist-dt-song-title">{entry.title}</div>
                        <div className="artist-dt-song-sub">Peak #{entry.peakPosition} · {entry.weeksOnChart}w on chart</div>
                      </div>
                      <div className="artist-dt-song-more">
                        <i className="ri-more-2-line text-[16px]" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
                <i className="ri-music-2-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
                <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No songs yet</p>
                <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">This artist's songs haven't been added to the registry yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Releases tab */}
        {activeTab === "Releases" && (
          <div>
            <div className="mb-6">
              <div className="artist-dt-kicker">Discography</div>
              <h2 className="artist-dt-section-title">Releases</h2>
            </div>
            {hasReleases ? (
              <div className="artist-dt-release-grid">
                {artist.releases!.map((release) => (
                  <Link
                    key={release.slug}
                    to={`/releases/${release.slug}`}
                    className="artist-dt-release-card"
                  >
                    <div className="artist-dt-release-art">
                      {release.artworkUrl ? (
                        <img src={release.artworkUrl} alt={release.title} />
                      ) : (
                        <i className="ri-album-line text-4xl text-[var(--wk-text-faint)]" />
                      )}
                    </div>
                    <div className="artist-dt-release-body">
                      <h4 className="artist-dt-release-title">{release.title}</h4>
                      <div className="artist-dt-release-meta">
                        {release.releaseType && <span>{release.releaseType}</span>}
                        {release.year && <span>{release.year}</span>}
                        {release.trackCount !== undefined && <span>{release.trackCount} tracks</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
                <i className="ri-album-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
                <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No releases yet</p>
                <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">This artist's discography hasn't been added to the registry yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Related tab */}
        {activeTab === "Related" && (
          <div>
            <div className="mb-6">
              <div className="artist-dt-kicker">Connections</div>
              <h2 className="artist-dt-section-title">Related artists</h2>
            </div>
            {hasRelated ? (
              <div className="artist-dt-related-grid">
                {relatedArtists!.map((ra) => (
                  <Link key={ra.slug} to={`/artists/${ra.slug}`} className="artist-dt-related-card">
                    <div className="artist-dt-related-img">
                      {ra.imageUrl ? <img src={ra.imageUrl} alt={ra.name} /> : <i className="ri-user-3-line text-3xl text-[var(--wk-text-faint)]" />}
                    </div>
                    <div className="artist-dt-related-overlay">
                      <div className="artist-dt-related-name">{ra.name}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-10 text-center">
                <i className="ri-user-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
                <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No related artists</p>
                <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">Connections haven't been mapped yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
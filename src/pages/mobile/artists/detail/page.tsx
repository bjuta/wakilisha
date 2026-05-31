import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";
import { ARTIST_DETAILS } from "@/mocks/artistDetails";
import { ARTISTS } from "@/mocks/artists";
import { TRACK_DETAILS } from "@/mocks/trackDetails";

type Tab = "Overview" | "Songs" | "Releases" | "Related";
const tabs: Tab[] = ["Overview", "Songs", "Releases", "Related"];

export default function MobileArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [isFollowing, setIsFollowing] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [copied, setCopied] = useState(false);

  const base = ARTISTS.find((artist) => artist.slug === slug);
  const detail = ARTIST_DETAILS.find((artist) => artist.slug === slug);

  // Build playable queue from TRACK_DETAILS for this artist — must be before any early return
  const artistTracks = TRACK_DETAILS.filter((t) => t.artistSlug === slug).map((t) => ({
    id: t.slug,
    title: t.title,
    artist: t.artist,
    artworkUrl: t.artworkUrl,
    isPlayable: t.isPlayable,
    source: t.source,
    duration: t.duration,
  }));

  const hasPlayableTracks = artistTracks.length > 0 && artistTracks.some((t) => t.isPlayable);
  const isCurrentArtistPlaying = currentTrack && artistTracks.some((t) => t.id === currentTrack.id) && isPlaying;

  const handlePlay = () => {
    if (!hasPlayableTracks) return;
    const playable = artistTracks.filter((t) => t.isPlayable);
    if (playable.length === 0) return;

    const first = playable[0];
    if (currentTrack?.id === first.id) {
      togglePlay();
      return;
    }
    playTrack(first, playable);
  };

  const handleFollow = () => setIsFollowing((prev) => !prev);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!base) {
    return (
      <div className="wk-mobile-v5 px-5 py-16 text-[var(--wk-text-muted)]">
        <WkIcon name="User" size={38} className="mx-auto mb-3 block text-[var(--wk-text-faint)]" />
        <p className="text-center">Artist not found.</p>
        <Link to="/artists" className="mt-4 block text-center text-[14px] font-bold text-[var(--wk-brand)]">
          Back to directory
        </Link>
      </div>
    );
  }

  const artist = {
    ...base,
    imageUrl: detail?.imageUrl || base.imageUrl,
    bio: detail?.bio || base.spotlightBio || `${base.name} is part of the WAKILISHA registry.`,
    chartEntries: detail?.chartEntries ?? [],
    releases: detail?.releases ?? [],
    relatedArtists: detail?.relatedArtists ?? [],
  };

  const hasChartEntries = artist.chartEntries.length > 0;
  const hasReleases = artist.releases.length > 0;
  const hasRelated = artist.relatedArtists.length > 0;

  return (
    <div className="wk-mobile-v5">
      {/* Hero */}
      <section className="artist-page-hero">
        {artist.imageUrl && <img src={artist.imageUrl} alt="" />}
        <div className="artist-hero-overlay" />
        <Link to="/artists" className="artist-hero-back mobile-pressable">
          <i className="ri-arrow-left-line" />
        </Link>
        <button className="artist-hero-more mobile-pressable" onClick={() => setShowMoreSheet(true)}>
          <i className="ri-more-2-line" />
        </button>
        <div className="artist-hero-bottom">
          <h1 className="artist-hero-name">{artist.name}</h1>
          <div className="artist-hero-origin">
            {artist.country || "WAKILISHA"} · {artist.genres.slice(0, 2).join(", ")}
          </div>
          <div className="artist-hero-stats">
            <div className="artist-stat">
              <div className="artist-stat-val">{artist.trackCount}</div>
              <div className="artist-stat-lbl">Tracks</div>
            </div>
            <div className="artist-stat">
              <div className="artist-stat-val">{artist.releaseCount}</div>
              <div className="artist-stat-lbl">Releases</div>
            </div>
            <div className="artist-stat">
              <div className="artist-stat-val">{artist.isChartArtist ? `#${artist.topChartPosition}` : "—"}</div>
              <div className="artist-stat-lbl">Peak</div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="artist-actions-row">
        <button
          onClick={handlePlay}
          disabled={!hasPlayableTracks}
          className="phn-btn-primary mobile-pressable disabled:cursor-not-allowed disabled:opacity-40"
        >
          <WkIcon name={isCurrentArtistPlaying ? "Pause" : "Play"} size={16} />
          {isCurrentArtistPlaying ? "Pause" : hasPlayableTracks ? "Play" : "No tracks"}
        </button>
        <button
          onClick={handleFollow}
          className={`phn-btn-secondary mobile-pressable ${isFollowing ? "border-[var(--wk-brand)] text-[var(--wk-brand)]" : ""}`}
        >
          <WkIcon name={isFollowing ? "UserCheck" : "UserPlus"} size={16} />
          {isFollowing ? "Following" : "Follow"}
        </button>
      </div>

      {/* Tab strip */}
      <div className="artist-tab-strip">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`artist-tab mobile-pressable ${activeTab === tab ? "on" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "Overview" && (
        <>
          {/* Bio */}
          <section className="px-5 py-5">
            <div className="mag-card-tag mb-2">About</div>
            <h2 className="mb-2 font-black text-[18px] leading-[1.1] tracking-[-0.02em] text-[var(--wk-text)]" style={{ fontFamily: "var(--wk-font-display)" }}>
              About the artist
            </h2>
            <p className="text-[13px] leading-[1.65] text-[var(--wk-text-soft)]">{artist.bio}</p>
          </section>

          {/* Chart entries */}
          {hasChartEntries && (
            <section className="artist-tracks">
              <div className="spec-section-hd">Chart entries</div>
              {artist.chartEntries.slice(0, 8).map((entry) => {
                const trackSlug = entry.title.toLowerCase().replace(/\s+/g, "-");
                return (
                  <Link
                    key={`${entry.rank}-${entry.title}`}
                    to={`/tracks/${trackSlug}`}
                    className="atrow mobile-pressable"
                  >
                    <div className="atrow-num">{entry.rank}</div>
                    <div className="min-w-0">
                      <div className="atrow-title">{entry.title}</div>
                      <div className="atrow-sub">
                        Peak #{entry.peakPosition} · {entry.weeksOnChart}w
                      </div>
                    </div>
                    <div className="atrow-more">
                      <i className="ri-more-2-line" />
                    </div>
                  </Link>
                );
              })}
            </section>
          )}

          {/* Releases */}
          {hasReleases && (
            <section className="home-section">
              <div className="home-section-header">
                <div className="home-section-title">Releases</div>
              </div>
              <div className="home-shelf">
                {artist.releases.map((release) => (
                  <Link
                    key={release.slug}
                    to={`/releases/${release.slug}`}
                    className="hcard mobile-pressable"
                  >
                    <div className="hcard-art">
                      {release.artworkUrl ? <img src={release.artworkUrl} alt="" /> : null}
                    </div>
                    <div className="hcard-title">{release.title}</div>
                    <div className="hcard-sub">{release.year || "Release"}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Related artists */}
          {hasRelated && (
            <section className="home-section">
              <div className="home-section-header">
                <div className="home-section-title">Related artists</div>
              </div>
              <div className="home-shelf">
                {artist.relatedArtists.map((related) => {
                  const found = ARTISTS.find((item) => item.slug === related.slug);
                  return (
                    <Link
                      key={related.slug}
                      to={`/artists/${related.slug}`}
                      className="acard mobile-pressable"
                      style={{ width: 140, flex: "0 0 auto" }}
                    >
                      {found?.imageUrl && <img src={found.imageUrl} alt="" />}
                      <div className="acard-overlay">
                        <div className="acard-name">{related.name}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Songs tab */}
      {activeTab === "Songs" && (
        <section className="py-2">
          <div className="px-5 py-3">
            <div className="mag-card-tag mb-2">Songs</div>
            <h2 className="font-black text-[18px] leading-[1.1] tracking-[-0.02em] text-[var(--wk-text)]" style={{ fontFamily: "var(--wk-font-display)" }}>
              All songs
            </h2>
          </div>
          {hasChartEntries ? (
            <div>
              {artist.chartEntries.map((entry, index) => {
                const trackSlug = entry.title.toLowerCase().replace(/\s+/g, "-");
                return (
                  <Link
                    key={`${entry.rank}-${entry.title}`}
                    to={`/tracks/${trackSlug}`}
                    className="atrow mobile-pressable"
                  >
                    <div className="atrow-num">{index + 1}</div>
                    <div className="min-w-0">
                      <div className="atrow-title">{entry.title}</div>
                      <div className="atrow-sub">
                        Peak #{entry.peakPosition} · {entry.weeksOnChart}w on chart
                      </div>
                    </div>
                    <div className="atrow-more">
                      <i className="ri-more-2-line" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <WkIcon name="Music2" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No songs yet</p>
              <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">
                This artist's songs haven't been added to the registry yet.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Releases tab */}
      {activeTab === "Releases" && (
        <section className="py-2">
          <div className="px-5 py-3">
            <div className="mag-card-tag mb-2">Discography</div>
            <h2 className="font-black text-[18px] leading-[1.1] tracking-[-0.02em] text-[var(--wk-text)]" style={{ fontFamily: "var(--wk-font-display)" }}>
              Releases
            </h2>
          </div>
          {hasReleases ? (
            <div className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {artist.releases.map((release) => (
                  <Link
                    key={release.slug}
                    to={`/releases/${release.slug}`}
                    className="mobile-pressable overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
                  >
                    <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                      {release.artworkUrl ? (
                        <img src={release.artworkUrl} alt={release.title} className="h-full w-full object-cover" />
                      ) : (
                        <WkIcon name="Album" size={32} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="truncate text-[12px] font-bold text-[var(--wk-text)]">{release.title}</h4>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--wk-text-muted)]">
                        {release.releaseType && <span>{release.releaseType}</span>}
                        {release.year && <span>{release.year}</span>}
                        {release.trackCount !== undefined && <span>{release.trackCount} tracks</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <WkIcon name="Album" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No releases yet</p>
              <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">
                This artist's discography hasn't been added to the registry yet.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Related tab */}
      {activeTab === "Related" && (
        <section className="py-2">
          <div className="px-5 py-3">
            <div className="mag-card-tag mb-2">Connections</div>
            <h2 className="font-black text-[18px] leading-[1.1] tracking-[-0.02em] text-[var(--wk-text)]" style={{ fontFamily: "var(--wk-font-display)" }}>
              Related artists
            </h2>
          </div>
          {hasRelated ? (
            <div className="artist-grid-2col">
              {artist.relatedArtists.map((related) => {
                const found = ARTISTS.find((item) => item.slug === related.slug);
                return (
                  <Link
                    key={related.slug}
                    to={`/artists/${related.slug}`}
                    className="acard mobile-pressable"
                  >
                    {found?.imageUrl ? (
                      <img src={found.imageUrl} alt={related.name} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--wk-surface-raised)]">
                        <WkIcon name="User" size={28} className="text-[var(--wk-text-faint)]" />
                      </div>
                    )}
                    <div className="acard-overlay">
                      <div className="acard-name">{related.name}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <WkIcon name="User" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">No related artists</p>
              <p className="mt-1 text-[13px] text-[var(--wk-text-faint)]">
                Connections haven't been mapped yet.
              </p>
            </div>
          )}
        </section>
      )}

      {/* More sheet */}
      {showMoreSheet && (
        <>
          <div className="phn-more-backdrop" onClick={() => setShowMoreSheet(false)} />
          <div className="phn-more-sheet">
            <div className="phn-more-handle" />
            <div className="phn-more-title">More</div>
            <button onClick={handleShare} className="phn-more-row mobile-pressable">
              <WkIcon name={copied ? "Check" : "Share2"} size={18} />
              <div className="phn-more-row-label">{copied ? "Copied link" : "Share artist"}</div>
              {copied && <WkIcon name="Check" size={16} className="text-[var(--wk-brand)]" />}
            </button>
            <button className="phn-more-row mobile-pressable">
              <WkIcon name="Flag" size={18} />
              <div className="phn-more-row-label">Report</div>
            </button>
            <button className="phn-more-row mobile-pressable">
              <WkIcon name="Info" size={18} />
              <div className="phn-more-row-label">About WAKILISHA</div>
            </button>
            <div className="phn-more-footer">
              <span className="phn-more-footer-text">WAKILISHA v5</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
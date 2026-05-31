import { Link, useParams } from "react-router-dom";
import { ARTIST_DETAILS } from "@/mocks/artistDetails";
import { ARTISTS } from "@/mocks/artists";

export default function MobileArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const base = ARTISTS.find((artist) => artist.slug === slug);
  const detail = ARTIST_DETAILS.find((artist) => artist.slug === slug);

  if (!base) return <div className="wk-mobile-v5 px-5 py-16 text-white/50">Artist not found.</div>;

  const artist = {
    ...base,
    imageUrl: detail?.imageUrl || base.imageUrl,
    bio: detail?.bio || base.spotlightBio || `${base.name} is part of the WAKILISHA registry.`,
    chartEntries: detail?.chartEntries ?? [],
    releases: detail?.releases ?? [],
    relatedArtists: detail?.relatedArtists ?? [],
  };

  return (
    <div className="wk-mobile-v5">
      <section className="artist-page-hero">
        {artist.imageUrl && <img src={artist.imageUrl} alt="" />}
        <div className="artist-hero-overlay" />
        <Link to="/artists" className="artist-hero-back"><i className="ri-arrow-left-line" /></Link>
        <button className="artist-hero-more"><i className="ri-more-2-line" /></button>
        <div className="artist-hero-bottom">
          <h1 className="artist-hero-name">{artist.name}</h1>
          <div className="artist-hero-origin">{artist.country || "WAKILISHA"} · {artist.genres.slice(0, 2).join(", ")}</div>
          <div className="artist-hero-stats">
            <div className="artist-stat"><div className="artist-stat-val">{artist.trackCount}</div><div className="artist-stat-lbl">Tracks</div></div>
            <div className="artist-stat"><div className="artist-stat-val">{artist.releaseCount}</div><div className="artist-stat-lbl">Releases</div></div>
            <div className="artist-stat"><div className="artist-stat-val">{artist.isChartArtist ? `#${artist.topChartPosition}` : "—"}</div><div className="artist-stat-lbl">Peak</div></div>
          </div>
        </div>
      </section>

      <div className="artist-actions-row">
        <button className="phn-btn-primary"><i className="ri-play-fill" /> Play</button>
        <button className="phn-btn-secondary"><i className="ri-user-add-line" /> Follow</button>
      </div>

      <div className="artist-tab-strip">
        <span className="artist-tab on">Overview</span><span className="artist-tab">Songs</span><span className="artist-tab">Releases</span><span className="artist-tab">Related</span>
      </div>

      <section className="px-5 py-5">
        <div className="mag-card-tag">About</div>
        <p className="text-[13px] leading-[1.65] text-white/55">{artist.bio}</p>
      </section>

      {artist.chartEntries.length > 0 && (
        <section className="artist-tracks">
          <div className="spec-section-hd">Chart entries</div>
          {artist.chartEntries.slice(0, 8).map((entry, idx) => (
            <Link key={`${entry.rank}-${entry.title}`} to={`/tracks/${entry.title.toLowerCase().replace(/\s+/g, "-")}`} className="atrow">
              <div className="atrow-num">{entry.rank}</div>
              <div className="min-w-0"><div className="atrow-title">{entry.title}</div><div className="atrow-sub">Peak #{entry.peakPosition} · {entry.weeksOnChart}w</div></div>
              <div className="atrow-more"><i className="ri-more-2-line" /></div>
            </Link>
          ))}
        </section>
      )}

      {artist.releases.length > 0 && (
        <section className="home-section">
          <div className="home-section-header"><div className="home-section-title">Releases</div></div>
          <div className="home-shelf">
            {artist.releases.map((release) => (
              <Link key={release.slug} to={`/releases/${release.slug}`} className="hcard">
                <div className="hcard-art">{release.artworkUrl ? <img src={release.artworkUrl} alt="" /> : null}</div>
                <div className="hcard-title">{release.title}</div>
                <div className="hcard-sub">{release.year || "Release"}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {artist.relatedArtists.length > 0 && (
        <section className="home-section">
          <div className="home-section-header"><div className="home-section-title">Related artists</div></div>
          <div className="home-shelf">
            {artist.relatedArtists.map((related) => {
              const found = ARTISTS.find((item) => item.slug === related.slug);
              return (
                <Link key={related.slug} to={`/artists/${related.slug}`} className="acard" style={{ width: 140, flex: "0 0 auto" }}>
                  {found?.imageUrl && <img src={found.imageUrl} alt="" />}
                  <div className="acard-overlay"><div className="acard-name">{related.name}</div></div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

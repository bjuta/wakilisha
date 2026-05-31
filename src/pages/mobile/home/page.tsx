import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { HOME_CHART_ENTRIES, HOME_FEATURED_ARTISTS, HOME_EDITORIAL_STORIES, HOME_RECENT_RELEASES, HOME_TRENDING_TRACKS } from "@/mocks/home";

const trackPayload = (track: { slug?: string; title: string; artist: string; artworkUrl?: string; isPlayable?: boolean; source?: string }) => ({
  id: track.slug || `${track.title}-${track.artist}`.toLowerCase().replace(/\s+/g, "-"),
  title: track.title,
  artist: track.artist,
  artworkUrl: track.artworkUrl,
  isPlayable: track.isPlayable,
  source: track.source,
});

export default function MobileHome() {
  const { playTrack } = usePlayer();
  const chartTracks = HOME_CHART_ENTRIES.map(trackPayload);
  const topChart = HOME_CHART_ENTRIES.slice(0, 5);

  return (
    <div className="wk-mobile-v5">
      <section className="home-greeting">
        <div className="home-greeting-time">Live from the graph</div>
        <h1 className="home-greeting-msg">Your people are here.</h1>
        <div className="home-greeting-ed">Charts, artists, releases, labels, and editorial rebuilt from the WAKILISHA registry.</div>
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">Current #1</div>
          <Link to="/charts" className="home-section-more">Charts</Link>
        </div>
        {HOME_CHART_ENTRIES[0] && (
          <Link to={`/tracks/${HOME_CHART_ENTRIES[0].slug}`} className="mx-5 mb-5 block overflow-hidden rounded-[16px] border border-white/10 bg-[#141712]">
            <div className="chart-hero-card h-[132px]">
              <img src={HOME_CHART_ENTRIES[0].artworkUrl} alt="" />
              <div className="chart-hero-overlay">
                <div className="chart-hero-rank gold">1</div>
                <div className="min-w-0 flex-1">
                  <div className="chart-row-title">{HOME_CHART_ENTRIES[0].title}</div>
                  <div className="chart-row-sub">{HOME_CHART_ENTRIES[0].artist}</div>
                </div>
                <button onClick={(e) => { e.preventDefault(); playTrack(chartTracks[0], chartTracks); }} className="phn-mp-btn phn-mp-play"><i className="ri-play-fill" /></button>
              </div>
            </div>
          </Link>
        )}
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">Top chart entries</div>
          <Link to="/charts" className="home-section-more">View all</Link>
        </div>
        <div className="chart-row-list">
          {topChart.map((entry, idx) => (
            <Link key={`${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-row">
              <div className="chart-row-num">{entry.rank}</div>
              <div className="chart-row-art"><img src={entry.artworkUrl} alt="" /></div>
              <div className="min-w-0">
                <div className="chart-row-title">{entry.title}</div>
                <div className="chart-row-sub">{entry.artist}</div>
              </div>
              <button onClick={(e) => { e.preventDefault(); playTrack(chartTracks[idx], chartTracks); }} className="chart-delta delta-new"><i className="ri-play-fill" /></button>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header"><div className="home-section-title">Trending tracks</div><Link to="/search" className="home-section-more">Search</Link></div>
        <div className="home-shelf">
          {HOME_TRENDING_TRACKS.map((track) => (
            <button key={track.slug} onClick={() => playTrack(trackPayload(track), [trackPayload(track)])} className="hcard">
              <div className="hcard-art">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <div className="flex h-full items-center justify-center"><i className="ri-music-2-line text-2xl text-white/25" /></div>}</div>
              <div className="hcard-title">{track.title}</div>
              <div className="hcard-sub">{track.artist}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header"><div className="home-section-title">Featured artists</div><Link to="/artists" className="home-section-more">Artists</Link></div>
        <div className="artist-grid-2col pt-0">
          {HOME_FEATURED_ARTISTS.slice(0, 4).map((artist) => (
            <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard">
              <img src={artist.imageUrl} alt="" />
              <div className="acard-overlay"><div className="acard-name">{artist.name}</div><div className="acard-meta">{artist.genres?.[0]} · {artist.origin || artist.country || "WAKILISHA"}</div></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header"><div className="home-section-title">Recent releases</div><Link to="/releases" className="home-section-more">Releases</Link></div>
        <div className="home-shelf">
          {HOME_RECENT_RELEASES.map((release) => (
            <Link key={release.slug} to={`/releases/${release.slug}`} className="hcard">
              <div className="hcard-art"><img src={release.artworkUrl} alt="" /></div>
              <div className="hcard-title">{release.title}</div>
              <div className="hcard-sub">{release.artist}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header"><div className="home-section-title">WAKILISHA magazine</div><Link to="/magazine" className="home-section-more">Read</Link></div>
        <div className="mag-cards pt-0">
          {HOME_EDITORIAL_STORIES.slice(0, 3).map((story) => (
            <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card">
              <div className="mag-card-art"><img src={story.heroUrl} alt="" /></div>
              <div><div className="mag-card-tag">{story.section}</div><div className="mag-card-title">{story.title}</div><div className="mag-card-meta">{story.author} · {story.readingTime} min</div></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

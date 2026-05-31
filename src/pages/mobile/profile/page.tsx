import { Link } from "react-router-dom";
import { HOME_FEATURED_ARTISTS, HOME_TRENDING_TRACKS } from "@/mocks/home";
import { STORIES } from "@/mocks/magazine";

export default function MobileProfile() {
  const savedTracks = HOME_TRENDING_TRACKS.slice(0, 3);
  const followedArtists = HOME_FEATURED_ARTISTS.slice(0, 4);
  const savedStories = STORIES.slice(0, 3);

  return (
    <main className="wk-mobile-v5">
      <section className="profile-hero">
        <div className="profile-avatar">JB</div>
        <div>
          <div className="profile-kicker">Member profile</div>
          <h1 className="profile-name">Your WAKILISHA</h1>
          <p className="profile-sub">Saved charts, followed artists, reading list, and listening history.</p>
        </div>
      </section>

      <section className="profile-stats">
        <div><strong>{followedArtists.length}</strong><span>Artists</span></div>
        <div><strong>{savedTracks.length}</strong><span>Tracks</span></div>
        <div><strong>{savedStories.length}</strong><span>Reads</span></div>
      </section>

      <section className="profile-actions">
        <Link to="/auth" className="phn-btn-primary"><i className="ri-login-circle-line" /> Sign in</Link>
        <Link to="/search" className="phn-btn-secondary"><i className="ri-search-line" /> Discover</Link>
      </section>

      <div className="spec-section-hd">Followed artists</div>
      <div className="phn-scroll-row">
        {followedArtists.map((artist) => (
          <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard" style={{ width: 136, flex: "0 0 auto" }}>
            <img src={artist.imageUrl} alt="" />
            <div className="acard-overlay"><div className="acard-name">{artist.name}</div><div className="acard-meta">{artist.genres?.[0]}</div></div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Saved tracks</div>
      <div className="labels-list">
        {savedTracks.map((track) => (
          <Link key={track.slug} to={`/tracks/${track.slug}`} className="lbl-row">
            <div className="lbl-avatar">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <i className="ri-music-2-line" />}</div>
            <div><div className="lbl-name">{track.title}</div><div className="lbl-meta">{track.artist}</div></div>
            <i className="ri-play-fill lbl-chevron" />
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Reading list</div>
      <div className="mag-cards pt-0">
        {savedStories.map((story) => (
          <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card">
            <div className="mag-card-art"><img src={story.heroUrl} alt="" /></div>
            <div><div className="mag-card-tag">{story.section}</div><div className="mag-card-title">{story.title}</div><div className="mag-card-meta">{story.readingTime} min read</div></div>
          </Link>
        ))}
      </div>
    </main>
  );
}

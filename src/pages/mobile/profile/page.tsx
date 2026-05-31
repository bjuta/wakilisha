import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import { HOME_FEATURED_ARTISTS, HOME_TRENDING_TRACKS } from "@/mocks/home";
import { STORIES } from "@/mocks/magazine";

export default function MobileProfile() {
  const { theme, toggle } = useTheme();
  const savedTracks = HOME_TRENDING_TRACKS.slice(0, 3);
  const followedArtists = HOME_FEATURED_ARTISTS.slice(0, 4);
  const savedStories = STORIES.slice(0, 3);
  const [showThemeSheet, setShowThemeSheet] = useState(false);

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
        <Link to="/auth" className="phn-btn-primary mobile-pressable"><WkIcon name="LogIn" size={16} /> Sign in</Link>
        <Link to="/search" className="phn-btn-secondary mobile-pressable"><WkIcon name="Search" size={16} /> Discover</Link>
      </section>

      <div className="spec-section-hd">Settings</div>
      <button onClick={() => setShowThemeSheet(true)} className="profile-settings-row mobile-pressable">
        <WkIcon name={theme === "dark" ? "Moon" : "Sun"} size={18} />
        <div className="profile-settings-label">Dark mode</div>
        <div className="profile-settings-value">{theme === "dark" ? "On" : "Off"}</div>
        <WkIcon name="ChevronRight" size={16} />
      </button>

      {showThemeSheet && (
        <>
          <div className="phn-more-backdrop" onClick={() => setShowThemeSheet(false)} />
          <div className="phn-more-sheet">
            <div className="phn-more-handle" />
            <div className="phn-more-title">Appearance</div>
            <button onClick={() => { if (theme !== "light") toggle(); setShowThemeSheet(false); }} className={`profile-theme-option mobile-pressable ${theme === "light" ? "profile-theme-option-active" : ""}`}>
              <WkIcon name="Sun" size={18} />
              <div className="profile-theme-option-label">Light</div>
              {theme === "light" && <WkIcon name="Check" size={17} />}
            </button>
            <button onClick={() => { if (theme !== "dark") toggle(); setShowThemeSheet(false); }} className={`profile-theme-option mobile-pressable ${theme === "dark" ? "profile-theme-option-active" : ""}`}>
              <WkIcon name="Moon" size={18} />
              <div className="profile-theme-option-label">Dark</div>
              {theme === "dark" && <WkIcon name="Check" size={17} />}
            </button>
          </div>
        </>
      )}

      <div className="spec-section-hd">Followed artists</div>
      <div className="phn-scroll-row">
        {followedArtists.map((artist) => (
          <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard mobile-pressable" style={{ width: 136, flex: "0 0 auto" }}>
            <img src={artist.imageUrl} alt="" />
            <div className="acard-overlay"><div className="acard-name">{artist.name}</div><div className="acard-meta">{artist.genres?.[0]}</div></div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Saved tracks</div>
      <div className="labels-list">
        {savedTracks.map((track) => (
          <Link key={track.slug} to={`/tracks/${track.slug}`} className="lbl-row mobile-pressable">
            <div className="lbl-avatar">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <WkIcon name="Music2" size={17} />}</div>
            <div><div className="lbl-name">{track.title}</div><div className="lbl-meta">{track.artist}</div></div>
            <WkIcon name="Play" size={16} className="lbl-chevron" />
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Reading list</div>
      <div className="mag-cards pt-0">
        {savedStories.map((story) => (
          <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card mobile-pressable">
            <div className="mag-card-art"><img src={story.heroUrl} alt="" /></div>
            <div><div className="mag-card-tag">{story.section}</div><div className="mag-card-title">{story.title}</div><div className="mag-card-meta">{story.readingTime} min read</div></div>
          </Link>
        ))}
      </div>
    </main>
  );
}

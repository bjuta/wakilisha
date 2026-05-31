import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import { HOME_FEATURED_ARTISTS, HOME_TRENDING_TRACKS } from "@/mocks/home";
import { STORIES } from "@/mocks/magazine";

type Tab = "Likes" | "Tracks" | "Reads" | "Settings";
const tabs: Tab[] = ["Likes", "Tracks", "Reads", "Settings"];

const profile = {
  name: "James Beautah",
  handle: "@jb",
  bio: "Building WAKILISHA as a living cultural registry for African music, stories, charts, and memory.",
  cover: "https://picsum.photos/seed/wk-profile-cover/900/300",
  avatar: "https://picsum.photos/seed/wk-profile-avatar/240/240",
};

export default function MobileProfile() {
  const { theme, toggle } = useTheme();
  const savedTracks = HOME_TRENDING_TRACKS.slice(0, 6);
  const followedArtists = HOME_FEATURED_ARTISTS.slice(0, 6);
  const savedStories = STORIES.slice(0, 4);
  const likesGrid = [...savedTracks, ...savedStories].slice(0, 9);
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [tab, setTab] = useState<Tab>("Likes");

  return (
    <main className="wk-mobile-v5 profile74-shell">
      <section className="profile74-hero">
        <div className="profile74-cover"><img src={profile.cover} alt="" /></div>
        <div className="profile74-ava">
          {profile.avatar ? <img src={profile.avatar} alt="" /> : "JB"}
          <div className="profile74-badge"><WkIcon name="Check" size={10} /></div>
        </div>
      </section>

      <section className="profile74-info">
        <h1 className="profile74-name">{profile.name}</h1>
        <div className="profile74-handle">{profile.handle} · WAKILISHA member</div>
        <p className="profile74-bio">{profile.bio}</p>
      </section>

      <section className="profile74-stats">
        <div className="profile74-stat"><div className="profile74-stat-val">{followedArtists.length}</div><div className="profile74-stat-lbl">Artists</div></div>
        <div className="profile74-stat"><div className="profile74-stat-val">{savedTracks.length}</div><div className="profile74-stat-lbl">Tracks</div></div>
        <div className="profile74-stat"><div className="profile74-stat-val">{savedStories.length}</div><div className="profile74-stat-lbl">Reads</div></div>
      </section>

      <section className="profile74-actions">
        <Link to="/auth" className="phn-btn-primary mobile-pressable"><WkIcon name="LogIn" size={16} /> Sign in</Link>
        <Link to="/search" className="phn-btn-secondary mobile-pressable"><WkIcon name="Search" size={16} /> Discover</Link>
      </section>

      <nav className="profile74-tabbar" aria-label="Profile tabs">
        {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`profile74-tab mobile-pressable ${tab === item ? "on" : ""}`}>{item}</button>)}
      </nav>

      {tab === "Likes" && (
        <section>
          <div className="profile74-likes-grid">
            {likesGrid.map((item: any, index) => {
              const img = item.artworkUrl || item.heroUrl;
              const to = item.slug && item.artworkUrl ? `/tracks/${item.slug}` : item.slug ? `/magazine/${item.slug}` : "/search";
              return <Link key={`${item.slug}-${index}`} to={to} className="profile74-like mobile-pressable">{img ? <img src={img} alt="" /> : null}</Link>;
            })}
          </div>
        </section>
      )}

      {tab === "Tracks" && (
        <section>
          <div className="spec-section-hd">Saved tracks</div>
          <div className="profile74-list">
            {savedTracks.map((track) => (
              <Link key={track.slug} to={`/tracks/${track.slug}`} className="lbl-row mobile-pressable">
                <div className="lbl-avatar">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <WkIcon name="Music2" size={17} />}</div>
                <div><div className="lbl-name">{track.title}</div><div className="lbl-meta">{track.artist}</div></div>
                <WkIcon name="Play" size={16} className="lbl-chevron" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === "Reads" && (
        <section>
          <div className="spec-section-hd">Reading list</div>
          <div className="mag-cards pt-0">
            {savedStories.map((story) => (
              <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card mobile-pressable">
                <div className="mag-card-art"><img src={story.heroUrl} alt="" /></div>
                <div><div className="mag-card-tag">{story.section}</div><div className="mag-card-title">{story.title}</div><div className="mag-card-meta">{story.readingTime} min read</div></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === "Settings" && (
        <section>
          <div className="spec-section-hd">Account settings</div>
          <div className="profile74-settings">
            <button onClick={() => setShowThemeSheet(true)} className="profile74-row mobile-pressable">
              <div className="profile74-row-icon"><WkIcon name={theme === "dark" ? "Moon" : "Sun"} size={18} /></div>
              <div><div className="profile74-row-label">Appearance</div><div className="profile74-row-sub">Dark mode is {theme === "dark" ? "on" : "off"}</div></div>
              <WkIcon name="ChevronRight" size={16} className="text-[var(--wk-text-faint)]" />
            </button>
            <Link to="/settings" className="profile74-row mobile-pressable">
              <div className="profile74-row-icon"><WkIcon name="Settings" size={18} /></div>
              <div><div className="profile74-row-label">Full settings</div><div className="profile74-row-sub">Privacy, playback, notifications</div></div>
              <WkIcon name="ChevronRight" size={16} className="text-[var(--wk-text-faint)]" />
            </Link>
            <Link to="/auth" className="profile74-row mobile-pressable">
              <div className="profile74-row-icon"><WkIcon name="LogIn" size={18} /></div>
              <div><div className="profile74-row-label">Sign in</div><div className="profile74-row-sub">Sync profile and saves</div></div>
              <WkIcon name="ChevronRight" size={16} className="text-[var(--wk-text-faint)]" />
            </Link>
          </div>
        </section>
      )}

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
    </main>
  );
}

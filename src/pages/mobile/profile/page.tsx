import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import { HOME_FEATURED_ARTISTS, HOME_TRENDING_TRACKS } from "@/mocks/home";
import { STORIES } from "@/mocks/magazine";

type Tab = "Likes" | "Tracks" | "Reads" | "Settings";
const tabs: Tab[] = ["Likes", "Tracks", "Reads", "Settings"];

const profile = {
  name: "Akinyi Odhiambo",
  handle: "@akinyi",
  role: "Senior Writer",
  bio: "Music journalist based in Nairobi. Writing about East African music, culture, and the stories behind the sounds since 2019. Believes the music comes first.",
  cover: "https://readdy.ai/api/search-image?query=African%20music%20culture%20landscape%2C%20Nairobi%20city%20skyline%20at%20golden%20hour%2C%20warm%20earth%20tones%2C%20dramatic%20sky%2C%20editorial%20photography%2C%20cinematic%20wide%20shot%2C%20warm%20orange%20and%20amber%20lighting%2C%20professional%20documentary%20style%2C%20no%20text&width=1600&height=400&seq=profile-hero-1&orientation=landscape",
  avatar: "https://picsum.photos/seed/profile-ava-1/240/240",
  location: "Nairobi, Kenya",
  website: "wakilisha.africa/contributors/akinyi",
  followers: "2,410",
  following: 318,
  articles: 84,
  streams: "12.4K",
};

export default function MobileProfile() {
  const { theme, toggle } = useTheme();
  const savedTracks = HOME_TRENDING_TRACKS.slice(0, 10);
  const followedArtists = HOME_FEATURED_ARTISTS.slice(0, 8);
  const savedStories = STORIES.slice(0, 6);
  const likesGrid = [...savedTracks, ...savedStories].slice(0, 15);
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [tab, setTab] = useState<Tab>("Likes");

  return (
    <main className="wk-mobile-v5 profile74-shell">
      <section className="profile74-hero">
        <div className="profile74-cover"><img src={profile.cover} alt="" /></div>
        <div className="profile74-ava">
          {profile.avatar ? <img src={profile.avatar} alt="" /> : "AO"}
          <div className="profile74-badge"><WkIcon name="Check" size={10} /></div>
        </div>
      </section>

      <section className="profile74-info">
        <h1 className="profile74-name">{profile.name}</h1>
        <div className="profile74-handle">
          {profile.handle}
          <span className="profile74-role-badge">
            <WkIcon name="PenLine" size={11} /> {profile.role}
          </span>
        </div>
        <p className="profile74-bio">{profile.bio}</p>
      </section>

      <section className="profile74-stats">
        <div className="profile74-stat"><div className="profile74-stat-val">{profile.articles}</div><div className="profile74-stat-lbl">Articles</div></div>
        <div className="profile74-stat"><div className="profile74-stat-val">{profile.followers}</div><div className="profile74-stat-lbl">Followers</div></div>
        <div className="profile74-stat"><div className="profile74-stat-val">{profile.following}</div><div className="profile74-stat-lbl">Following</div></div>
        <div className="profile74-stat"><div className="profile74-stat-val">{profile.streams}</div><div className="profile74-stat-lbl">Streams</div></div>
        <div className="profile74-stat"><div className="profile74-stat-val">{followedArtists.length}</div><div className="profile74-stat-lbl">Artists</div></div>
        <div className="profile74-stat"><div className="profile74-stat-val">{savedTracks.length}</div><div className="profile74-stat-lbl">Saved</div></div>
      </section>

      <section className="profile74-actions">
        <Link to="/settings" className="phn-btn-primary mobile-pressable"><WkIcon name="Pencil" size={14} /> Edit profile</Link>
        <Link to="/search" className="phn-btn-secondary mobile-pressable"><WkIcon name="Search" size={16} /> Discover</Link>
      </section>

      <nav className="profile74-tabbar" aria-label="Profile tabs">
        {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`profile74-tab mobile-pressable ${tab === item ? "on" : ""}`}>{item}</button>)}
      </nav>

      {tab === "Likes" && (
        <section>
          <div className="profile74-section-head">
            <div className="profile74-section-kicker">Likes</div>
            <h2 className="profile74-section-title">Saved tracks & stories</h2>
          </div>
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
          <div className="profile74-section-head">
            <div className="profile74-section-kicker">Tracks</div>
            <h2 className="profile74-section-title">Saved tracks</h2>
          </div>
          <div className="profile74-track-list">
            {savedTracks.map((track, index) => (
              <Link key={track.slug} to={`/tracks/${track.slug}`} className="profile74-track-row mobile-pressable">
                <div className="profile74-track-num">{index + 1}</div>
                <div className="profile74-track-art">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <WkIcon name="Music2" size={17} />}</div>
                <div className="profile74-track-info">
                  <div className="profile74-track-title">{track.title}</div>
                  <div className="profile74-track-artist">{track.artist}</div>
                </div>
                <div className="profile74-track-meta">{track.streamCount}</div>
                <WkIcon name="Play" size={16} className="profile74-track-play" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === "Reads" && (
        <section>
          <div className="profile74-section-head">
            <div className="profile74-section-kicker">Reads</div>
            <h2 className="profile74-section-title">Reading list</h2>
          </div>
          <div className="profile74-reads-list">
            {savedStories.map((story) => (
              <Link key={story.slug} to={`/magazine/${story.slug}`} className="profile74-read-card mobile-pressable">
                <div className="profile74-read-art"><img src={story.heroUrl} alt="" /></div>
                <div className="profile74-read-body">
                  <div className="profile74-read-tag">{story.section}</div>
                  <div className="profile74-read-title">{story.title}</div>
                  <div className="profile74-read-meta">{story.readingTime} min read · {story.date || "Undated"}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === "Settings" && (
        <section>
          <div className="profile74-section-head">
            <div className="profile74-section-kicker">Settings</div>
            <h2 className="profile74-section-title">Account settings</h2>
          </div>
          <div className="profile74-settings">
            <div className="profile74-settings-group">
              <div className="profile74-settings-group-title">Preferences</div>
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
            </div>
            <div className="profile74-settings-group">
              <div className="profile74-settings-group-title">Account</div>
              <Link to="/auth" className="profile74-row mobile-pressable">
                <div className="profile74-row-icon"><WkIcon name="LogIn" size={18} /></div>
                <div><div className="profile74-row-label">Sign in</div><div className="profile74-row-sub">Sync profile and saves</div></div>
                <WkIcon name="ChevronRight" size={16} className="text-[var(--wk-text-faint)]" />
              </Link>
            </div>
            <div className="profile74-settings-group">
              <div className="profile74-settings-group-title">Profile info</div>
              <div className="profile74-info-row">
                <WkIcon name="MapPin" size={14} />
                <span>{profile.location}</span>
              </div>
              <div className="profile74-info-row">
                <WkIcon name="Globe" size={14} />
                <span>{profile.website}</span>
              </div>
              <div className="profile74-info-row">
                <WkIcon name="AtSign" size={14} />
                <span>Contributor profile</span>
              </div>
            </div>
            <div className="profile74-settings-group">
              <div className="profile74-settings-group-title">Activity</div>
              <div className="profile74-activity-summary">
                <div className="profile74-activity-item">
                  <div className="profile74-activity-val">6</div>
                  <div className="profile74-activity-lbl">Published this month</div>
                </div>
                <div className="profile74-activity-item">
                  <div className="profile74-activity-val">Afrobeats</div>
                  <div className="profile74-activity-lbl">Top genre</div>
                </div>
                <div className="profile74-activity-item">
                  <div className="profile74-activity-val">{followedArtists[0]?.name ?? "—"}</div>
                  <div className="profile74-activity-lbl">Top artist</div>
                </div>
                <div className="profile74-activity-item">
                  <div className="profile74-activity-val">Today</div>
                  <div className="profile74-activity-lbl">Last active</div>
                </div>
              </div>
            </div>
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
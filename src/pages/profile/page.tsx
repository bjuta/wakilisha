import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import { slugify } from "@/services/repairedContent/client";
const HOME_FEATURED_ARTISTS: any[] = [];
const HOME_TRENDING_TRACKS: any[] = [];
import { useMagazineArticles } from "@/services/magazineArticles";

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

export default function ProfilePage() {
  const { theme, toggle } = useTheme();
  const savedTracks = HOME_TRENDING_TRACKS.slice(0, 10);
  const followedArtists = HOME_FEATURED_ARTISTS.slice(0, 8);
  const { articles: savedStories, loading: storiesLoading, error: storiesError } = useMagazineArticles();
  const displayStories = savedStories.slice(0, 6);
  const likesGrid = [...savedTracks, ...displayStories].slice(0, 15);
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [tab, setTab] = useState<Tab>("Likes");

  return (
    <main className="profile-dt-shell">
      {/* Full-width hero */}
      <section className="profile-dt-hero">
        <div className="profile-dt-cover">
          <img src={profile.cover} alt="" className="h-full w-full object-cover" />
        </div>
      </section>

      {/* Profile header with avatar + info */}
      <div className="profile-dt-content">
        <div className="profile-dt-header">
          <div className="profile-dt-avatar-wrap">
            <div className="profile-dt-avatar">
              <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="profile-dt-badge">
              <WkIcon name="Check" size={12} />
            </div>
          </div>

          <div className="profile-dt-header-main">
            <div className="profile-dt-header-top">
              <div className="profile-dt-header-info">
                <h1 className="profile-dt-name">{profile.name}</h1>
                <div className="profile-dt-handle">
                  {profile.handle}
                  <span className="profile-dt-role">
                    <WkIcon name="PenLine" size={13} /> {profile.role}
                  </span>
                </div>
                <p className="profile-dt-bio">{profile.bio}</p>
              </div>
              <div className="profile-dt-header-actions">
                <Link to="/settings" className="profile-dt-btn-edit">
                  <WkIcon name="Pencil" size={14} /> Edit profile
                </Link>
                <Link to="/search" className="profile-dt-btn-ghost">
                  <WkIcon name="Search" size={14} /> Discover
                </Link>
              </div>
            </div>

            <div className="profile-dt-stats">
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{profile.articles}</div>
                <div className="profile-dt-stat-lbl">Articles</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{profile.followers}</div>
                <div className="profile-dt-stat-lbl">Followers</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{profile.following}</div>
                <div className="profile-dt-stat-lbl">Following</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{profile.streams}</div>
                <div className="profile-dt-stat-lbl">Streams</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{followedArtists.length}</div>
                <div className="profile-dt-stat-lbl">Artists</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{savedTracks.length}</div>
                <div className="profile-dt-stat-lbl">Saved</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <nav className="profile-dt-tabbar" aria-label="Profile content tabs">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`profile-dt-tab ${tab === item ? "active" : ""}`}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="profile-dt-body">
          {tab === "Likes" && (
            <div>
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">Likes</div>
                <h2 className="profile-dt-section-title">Saved tracks & stories</h2>
              </div>
              <div className="profile-dt-likes-grid">
                {likesGrid.map((item: any, index) => {
                  const img = item.artworkUrl || item.heroUrl;
                  const to =
                    item.slug && item.artworkUrl
                      ? `/tracks/${slugify(item.artist || '')}/${item.slug}`
                      : item.slug
                        ? `/magazine/${item.slug}`
                        : "/search";
                  return (
                    <Link key={`${item.slug}-${index}`} to={to} className="profile-dt-like">
                      {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "Tracks" && (
            <div>
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">Tracks</div>
                <h2 className="profile-dt-section-title">Saved tracks</h2>
              </div>
              <div className="profile-dt-track-list">
                {savedTracks.map((track, index) => (
                  <Link key={track.slug} to={`/tracks/${slugify(track.artist)}/${track.slug}`} className="profile-dt-track-row">
                    <div className="profile-dt-track-num">{index + 1}</div>
                    <div className="profile-dt-track-art">
                      {track.artworkUrl ? <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" /> : <WkIcon name="Music2" size={20} />}
                    </div>
                    <div className="profile-dt-track-info">
                      <div className="profile-dt-track-title">{track.title}</div>
                      <div className="profile-dt-track-artist">{track.artist}</div>
                    </div>
                    <div className="profile-dt-track-meta">{track.streamCount}</div>
                    <div className="profile-dt-track-meta">{track.source}</div>
                    <div className="profile-dt-track-play">
                      <WkIcon name="Play" size={16} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {tab === "Reads" && (
            <div>
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">Reads</div>
                <h2 className="profile-dt-section-title">Reading list</h2>
              </div>
              {storiesLoading ? (
                <div className="profile-dt-reads-grid">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="profile-dt-read-card animate-pulse">
                      <div className="profile-dt-read-art bg-[var(--wk-surface-raised)]" />
                      <div className="profile-dt-read-body space-y-2">
                        <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
                        <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                        <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : storiesError ? (
                <div className="text-[var(--wk-text-muted)]">{storiesError}</div>
              ) : (
                <div className="profile-dt-reads-grid">
                  {displayStories.map((story) => (
                    <Link key={story.slug} to={`/magazine/${story.slug}`} className="profile-dt-read-card">
                      <div className="profile-dt-read-art">
                        <img src={story.heroUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="profile-dt-read-body">
                        <div className="profile-dt-read-tag">{story.section}</div>
                        <div className="profile-dt-read-title">{story.title}</div>
                        <div className="profile-dt-read-meta">{story.readingTime} min read · {story.date || "Undated"}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "Settings" && (
            <div>
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">Settings</div>
                <h2 className="profile-dt-section-title">Account settings</h2>
              </div>
              <div className="profile-dt-settings-grid">
                <div className="profile-dt-settings-col">
                  <div className="profile-dt-settings-group">
                    <div className="profile-dt-settings-group-title">Preferences</div>
                    <button onClick={() => setShowThemeSheet(true)} className="profile-dt-settings-row">
                      <div className="profile-dt-settings-icon">
                        <WkIcon name={theme === "dark" ? "Moon" : "Sun"} size={18} />
                      </div>
                      <div className="profile-dt-settings-row-text">
                        <div className="profile-dt-settings-label">Appearance</div>
                        <div className="profile-dt-settings-sub">Dark mode is {theme === "dark" ? "on" : "off"}</div>
                      </div>
                      <WkIcon name="ChevronRight" size={16} />
                    </button>
                    <Link to="/settings" className="profile-dt-settings-row">
                      <div className="profile-dt-settings-icon">
                        <WkIcon name="Settings" size={18} />
                      </div>
                      <div className="profile-dt-settings-row-text">
                        <div className="profile-dt-settings-label">Full settings</div>
                        <div className="profile-dt-settings-sub">Privacy, playback, notifications</div>
                      </div>
                      <WkIcon name="ChevronRight" size={16} />
                    </Link>
                  </div>
                  <div className="profile-dt-settings-group">
                    <div className="profile-dt-settings-group-title">Account</div>
                    <Link to="/auth" className="profile-dt-settings-row">
                      <div className="profile-dt-settings-icon">
                        <WkIcon name="LogIn" size={18} />
                      </div>
                      <div className="profile-dt-settings-row-text">
                        <div className="profile-dt-settings-label">Sign in</div>
                        <div className="profile-dt-settings-sub">Sync profile and saves</div>
                      </div>
                      <WkIcon name="ChevronRight" size={16} />
                    </Link>
                  </div>
                </div>
                <div className="profile-dt-settings-col">
                  <div className="profile-dt-settings-group">
                    <div className="profile-dt-settings-group-title">Profile info</div>
                    <div className="profile-dt-settings-info">
                      <div className="profile-dt-info-row">
                        <WkIcon name="MapPin" size={15} />
                        <span>{profile.location}</span>
                      </div>
                      <div className="profile-dt-info-row">
                        <WkIcon name="Globe" size={15} />
                        <span>{profile.website}</span>
                      </div>
                      <div className="profile-dt-info-row">
                        <WkIcon name="AtSign" size={15} />
                        <span>Contributor profile</span>
                      </div>
                    </div>
                  </div>
                  <div className="profile-dt-settings-group">
                    <div className="profile-dt-settings-group-title">Activity</div>
                    <div className="profile-dt-activity-summary">
                      <div className="profile-dt-activity-item">
                        <div className="profile-dt-activity-val">6</div>
                        <div className="profile-dt-activity-lbl">Published this month</div>
                      </div>
                      <div className="profile-dt-activity-item">
                        <div className="profile-dt-activity-val">Afrobeats</div>
                        <div className="profile-dt-activity-lbl">Top genre</div>
                      </div>
                      <div className="profile-dt-activity-item">
                        <div className="profile-dt-activity-val">{followedArtists[0]?.name ?? "—"}</div>
                        <div className="profile-dt-activity-lbl">Top artist</div>
                      </div>
                      <div className="profile-dt-activity-item">
                        <div className="profile-dt-activity-val">Today</div>
                        <div className="profile-dt-activity-lbl">Last active</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Theme sheet */}
      {showThemeSheet && (
        <>
          <div className="profile-dt-backdrop" onClick={() => setShowThemeSheet(false)} />
          <div className="profile-dt-sheet">
            <div className="profile-dt-sheet-handle" />
            <div className="profile-dt-sheet-title">Appearance</div>
            <button
              onClick={() => {
                if (theme !== "light") toggle();
                setShowThemeSheet(false);
              }}
              className={`profile-dt-theme-option ${theme === "light" ? "profile-dt-theme-option-active" : ""}`}
            >
              <WkIcon name="Sun" size={18} />
              <div className="profile-dt-theme-option-label">Light</div>
              {theme === "light" && <WkIcon name="Check" size={17} />}
            </button>
            <button
              onClick={() => {
                if (theme !== "dark") toggle();
                setShowThemeSheet(false);
              }}
              className={`profile-dt-theme-option ${theme === "dark" ? "profile-dt-theme-option-active" : ""}`}
            >
              <WkIcon name="Moon" size={18} />
              <div className="profile-dt-theme-option-label">Dark</div>
              {theme === "dark" && <WkIcon name="Check" size={17} />}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
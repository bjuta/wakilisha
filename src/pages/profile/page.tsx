import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";
import { useMagazineArticles } from "@/services/magazineArticles";
import { supabase } from "@/lib/supabase";

type Tab = "Reads" | "Settings";
const tabs: Tab[] = ["Reads", "Settings"];

export default function ProfilePage() {
  const { theme, toggle } = useTheme();
  const authUser = useAuthUser();
  const { articles: savedStories, loading: storiesLoading, error: storiesError } = useMagazineArticles();
  const displayStories = savedStories.slice(0, 9);
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [tab, setTab] = useState<Tab>("Reads");

  const isSignedIn = !authUser.loading && !!authUser.id;
  const userDisplayName =
    authUser.name || authUser.email?.split("@")[0] || "Reader";
  const userEmail = authUser.email || "";
  const userInitial = userDisplayName[0]?.toUpperCase() || "W";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <main className="profile-dt-shell">
      {/* Hero */}
      <section className="profile-dt-hero">
        <div className="profile-dt-cover">
          <div className="h-full w-full bg-[linear-gradient(135deg,#1a3a0a,#2a5a1a)]" />
        </div>
      </section>

      {/* Profile header */}
      <div className="profile-dt-content">
        <div className="profile-dt-header">
          <div className="profile-dt-avatar-wrap">
            <div className="profile-dt-avatar">
              {authUser.avatarUrl ? (
                <img src={authUser.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[28px] font-black bg-[var(--wk-surface)] text-[var(--wk-brand)]">
                  {userInitial}
                </div>
              )}
            </div>
            {isSignedIn && (
              <div className="profile-dt-badge">
                <WkIcon name="Check" size={12} />
              </div>
            )}
          </div>

          <div className="profile-dt-header-main">
            <div className="profile-dt-header-top">
              <div className="profile-dt-header-info">
                {authUser.loading ? (
                  <>
                    <div className="h-[36px] w-48 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-[6px]" />
                    <div className="h-[18px] w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  </>
                ) : (
                  <>
                    <h1 className="profile-dt-name">
                      {isSignedIn ? userDisplayName : "WAKILISHA Reader"}
                    </h1>
                    <div className="profile-dt-handle">
                      {isSignedIn ? userEmail : "Sign in to customize your profile"}
                      {isSignedIn && (
                        <span className="profile-dt-role">
                          <WkIcon name="User" size={13} /> Reader
                        </span>
                      )}
                    </div>
                    <p className="profile-dt-bio">
                      {isSignedIn
                        ? "Your profile saves reading history, followed artists, and chart preferences across devices."
                        : "Sign in to track your reading, follow artists, and personalize your charts experience."}
                    </p>
                  </>
                )}
              </div>
              <div className="profile-dt-header-actions">
                {isSignedIn ? (
                  <Link to="/settings" className="profile-dt-btn-edit whitespace-nowrap">
                    <WkIcon name="Pencil" size={14} /> Edit profile
                  </Link>
                ) : (
                  <Link to="/auth" className="profile-dt-btn-edit whitespace-nowrap">
                    <WkIcon name="LogIn" size={14} /> Sign in
                  </Link>
                )}
                <Link to="/search" className="profile-dt-btn-ghost whitespace-nowrap">
                  <WkIcon name="Search" size={14} /> Discover
                </Link>
              </div>
            </div>

            <div className="profile-dt-stats">
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{displayStories.length}</div>
                <div className="profile-dt-stat-lbl">Reading List</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{savedStories.length}</div>
                <div className="profile-dt-stat-lbl">Stories</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{isSignedIn ? 1 : 0}</div>
                <div className="profile-dt-stat-lbl">Devices</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">
                  {savedStories.reduce((acc, s) => acc + (s.readingTime || 0), 0) || "—"}
                </div>
                <div className="profile-dt-stat-lbl">Min Read</div>
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
              className={`profile-dt-tab ${tab === item ? "active" : ""} cursor-pointer`}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="profile-dt-body">
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
                <div className="text-[var(--wk-text-muted)] py-8 text-center">
                  <WkIcon name="AlertTriangle" size={24} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
                  <p className="font-bold text-sm">{storiesError}</p>
                </div>
              ) : displayStories.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
                  <WkIcon name="BookOpen" size={32} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
                  <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">
                    No stories in your reading list yet
                  </p>
                  <Link
                    to="/magazine"
                    className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wk-brand)] hover:underline"
                  >
                    Browse magazine <i className="ri-arrow-right-line" />
                  </Link>
                </div>
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
                        <div className="profile-dt-read-meta">
                          {story.readingTime} min read · {story.date || "Undated"}
                        </div>
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
                    <button
                      onClick={() => setShowThemeSheet(true)}
                      className="profile-dt-settings-row cursor-pointer"
                    >
                      <div className="profile-dt-settings-icon">
                        <WkIcon name={theme === "dark" ? "Moon" : "Sun"} size={18} />
                      </div>
                      <div className="profile-dt-settings-row-text">
                        <div className="profile-dt-settings-label">Appearance</div>
                        <div className="profile-dt-settings-sub">
                          Dark mode is {theme === "dark" ? "on" : "off"}
                        </div>
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
                    {isSignedIn ? (
                      <button
                        onClick={handleSignOut}
                        className="profile-dt-settings-row cursor-pointer"
                      >
                        <div className="profile-dt-settings-icon">
                          <WkIcon name="LogOut" size={18} />
                        </div>
                        <div className="profile-dt-settings-row-text">
                          <div className="profile-dt-settings-label">Sign out</div>
                          <div className="profile-dt-settings-sub">{userEmail}</div>
                        </div>
                        <WkIcon name="ChevronRight" size={16} />
                      </button>
                    ) : (
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
                    )}
                  </div>
                </div>
                <div className="profile-dt-settings-col">
                  <div className="profile-dt-settings-group">
                    <div className="profile-dt-settings-group-title">Profile info</div>
                    <div className="profile-dt-settings-info">
                      <div className="profile-dt-info-row">
                        <WkIcon name="AtSign" size={15} />
                        <span>
                          {isSignedIn ? userEmail : "Sign in to see profile details"}
                        </span>
                      </div>
                      <div className="profile-dt-info-row">
                        <WkIcon name="Globe" size={15} />
                        <span>wakilisha.africa</span>
                      </div>
                      <div className="profile-dt-info-row">
                        <WkIcon name="User" size={15} />
                        <span>{isSignedIn ? "Contributor profile" : "Reader profile"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="profile-dt-settings-group">
                    <div className="profile-dt-settings-group-title">Activity</div>
                    <div className="profile-dt-activity-summary">
                      <div className="profile-dt-activity-item">
                        <div className="profile-dt-activity-val">{savedStories.length}</div>
                        <div className="profile-dt-activity-lbl">Total stories</div>
                      </div>
                      <div className="profile-dt-activity-item">
                        <div className="profile-dt-activity-val">
                          {isSignedIn ? "Active" : "Guest"}
                        </div>
                        <div className="profile-dt-activity-lbl">Status</div>
                      </div>
                      <div className="profile-dt-activity-item">
                        <div className="profile-dt-activity-val">
                          {displayStories[0]?.section ?? "—"}
                        </div>
                        <div className="profile-dt-activity-lbl">Top section</div>
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
              className={`profile-dt-theme-option cursor-pointer ${
                theme === "light" ? "profile-dt-theme-option-active" : ""
              }`}
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
              className={`profile-dt-theme-option cursor-pointer ${
                theme === "dark" ? "profile-dt-theme-option-active" : ""
              }`}
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
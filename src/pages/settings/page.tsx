import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useMessagesAccess } from "@/hooks/useMessagesAccess";
import { WkIcon } from "@/components/design-system/Icon";
import { AccountSettingsPane } from "./components/AccountSettingsPane";
import { AppearanceSettingsPane } from "./components/AppearanceSettingsPane";
import { NotificationsSettingsPane } from "./components/NotificationsSettingsPane";
import { PlaybackSettingsPane } from "./components/PlaybackSettingsPane";
import { PrivacySettingsPane } from "./components/PrivacySettingsPane";
import { DangerSettingsPane } from "./components/DangerSettingsPane";
import { MessagesSettingsPane } from "./components/MessagesSettingsPane";

type SettingsTab = "Account" | "Appearance" | "Notifications" | "Messages" | "Privacy" | "Playback" | "Danger";

const tabs: { key: SettingsTab; icon: string; desc: string }[] = [
  {
    key: "Account",
    icon: "ri-user-3-line",
    desc: "Public identity and profile information shown across WAKILISHA.",
  },
  {
    key: "Appearance",
    icon: "ri-palette-line",
    desc: "Theme, accent color, and density preferences for the interface.",
  },
  {
    key: "Notifications",
    icon: "ri-notification-3-line",
    desc: "Decide which cultural signals deserve to reach you.",
  },
  {
    key: "Messages",
    icon: "ri-message-3-line",
    desc: "Control who may contact you and how first-contact Messages are routed.",
  },
  {
    key: "Privacy",
    icon: "ri-shield-check-line",
    desc: "Control profile visibility, listening history, and analytics consent.",
  },
  {
    key: "Playback",
    icon: "ri-headphone-line",
    desc: "Apple Music connection, player behavior, and audio quality.",
  },
  {
    key: "Danger",
    icon: "ri-error-warning-line",
    desc: "Reset preferences and destructive actions live here, away from everyday settings.",
  },
];

function isSettingsTab(
  value: string | null,
): value is SettingsTab {
  return tabs.some(
    (tab) => tab.key === value,
  );
}

export default function SettingsPage() {
  const messagesAccess = useMessagesAccess();
  const [searchParams] = useSearchParams();
  const requestedSection =
    searchParams.get("section");
  const [active, setActive] =
    useState<SettingsTab>(
      isSettingsTab(requestedSection)
        ? requestedSection
        : "Account",
    );

  useEffect(() => {
    if (isSettingsTab(requestedSection)) {
      setActive(requestedSection);
    }
  }, [requestedSection]);

  useEffect(() => {
    if (
      !messagesAccess.loading
      && !messagesAccess.visible
      && active === "Messages"
    ) {
      setActive("Account");
    }
  }, [
    active,
    messagesAccess.loading,
    messagesAccess.visible,
  ]);

  const {
    profile,
    appearance,
    notifications,
    playback,
    privacy,
    loading,
    saving,
    error,
    saveStatus,
    dirty,
    isSignedIn,
    userId,
    userEmail,
    userInitial,
    authLoading,
    updateProfile,
    updateAppearance,
    updateNotifications,
    updatePlayback,
    updatePrivacy,
    saveAll,
    discardChanges,
    resetAll,
    uploadAvatar,
    uploadCover,
    checkUsernameAvailability,
  } = useUserSettings();

  const visibleTabs = tabs.filter(
    (tab) =>
      tab.key !== "Messages"
      || messagesAccess.visible,
  );
  const activeTab =
    visibleTabs.find(
      (tab) => tab.key === active,
    )
    ?? visibleTabs[0];

  const handleSave = async () => {
    await saveAll();
  };

  // ─── Save status pill ───
  const savePill = () => {
    if (saveStatus === "saving") {
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-text-muted)]">
          <i className="ri-loader-4-line animate-spin text-[13px]" /> Saving...
        </span>
      );
    }
    if (saveStatus === "saved") {
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-success)]">
          <i className="ri-checkbox-circle-fill text-[13px]" /> Saved to Supabase
        </span>
      );
    }
    if (saveStatus === "error") {
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-danger)]">
          <i className="ri-close-circle-fill text-[13px]" /> {error || "Save failed"}
        </span>
      );
    }
    if (!dirty) {
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-text-faint)]">
          <i className="ri-check-line text-[13px]" /> Up to date
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-warning)]">
        <i className="ri-edit-line text-[13px]" /> Unsaved changes
      </span>
    );
  };

  // ─── Account info card ───
  const profilePreview = () => {
    if (authLoading) {
      return (
        <div className="flex items-center gap-3 p-4 border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg-subtle)] animate-pulse">
          <div className="w-12 h-12 rounded-full bg-[var(--wk-surface-raised)]" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-28 bg-[var(--wk-surface-raised)] rounded" />
            <div className="h-3 w-20 bg-[var(--wk-surface-raised)] rounded" />
          </div>
        </div>
      );
    }

    const displayName = profile.displayName || userEmail?.split("@")[0] || "Reader";
    const sub = isSignedIn && profile.username ? `@${profile.username}` : isSignedIn ? userEmail : "Sign in to save preferences to your account";

    return (
      <div className="flex items-center gap-3 p-4 border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg-subtle)]">
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-[var(--wk-surface-raised)] flex items-center justify-center">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-black text-[var(--wk-brand)]">{userInitial}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-black text-[var(--wk-text)] truncate">{displayName}</div>
          <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{sub}</div>
        </div>
        {!isSignedIn && (
          <Link
            to="/auth"
            className="inline-flex items-center gap-1 h-[32px] px-4 rounded-lg text-[11px] font-bold bg-[var(--wk-brand)] text-[var(--wk-brand-on)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
          >
            Sign in
          </Link>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <main className="settings49-shell">
        <div className="settings49-wrap">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-48 bg-[var(--wk-surface-raised)] rounded" />
            <div className="h-6 w-96 bg-[var(--wk-surface-raised)] rounded" />
            <div className="grid grid-cols-[260px_1fr] gap-5">
              <div className="h-80 bg-[var(--wk-surface-raised)] rounded-xl" />
              <div className="h-80 bg-[var(--wk-surface-raised)] rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="settings49-shell">
      <div className="settings49-wrap">
        {/* Hero */}
        <section className="settings49-hero">
          <div className="settings49-kicker"><WkIcon name="Settings" size={14} /> Account controls</div>
          <h1 className="settings49-title">Settings</h1>
          <p className="settings49-sub">
            Manage profile identity, appearance, notifications, playback, privacy, and account actions.
            Changes persist locally and sync to your WAKILISHA account when signed in.
          </p>
        </section>

        {/* Layout */}
        <div className="settings49-layout">
          {/* Sidebar nav */}
          <nav className="settings49-nav" aria-label="Settings sections">
            <div className="mb-3 px-2">{profilePreview()}</div>
            {isSignedIn && (
              <Link
                to="/start?edit=1"
                className="settings49-nav-item mb-2"
              >
                <span className="settings49-nav-icon">
                  <i className="ri-group-line text-[15px]" />
                </span>
                Your People
              </Link>
            )}
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                className={`settings49-nav-item ${active === tab.key ? "active" : ""}`}
                onClick={() => setActive(tab.key)}
              >
                <span className="settings49-nav-icon">
                  <i className={`${tab.icon} text-[15px]`} />
                </span>
                {tab.key}
              </button>
            ))}
          </nav>

          {/* Main pane */}
          <section className="settings49-pane">
            {/* Pane header */}
            <div className="settings49-pane-head">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <i className={`${activeTab.icon} text-lg text-[var(--wk-brand)]`} />
                  <h2 className="settings49-pane-title">{activeTab.key}</h2>
                </div>
                <p className="settings49-pane-desc">{activeTab.desc}</p>
              </div>
            </div>

            {/* Pane body */}
            <div className="mb-8">
              {active === "Account" && (
                <AccountSettingsPane
                  profile={profile}
                  userId={userId}
                  userInitial={userInitial}
                  isSignedIn={isSignedIn}
                  updateProfile={updateProfile}
                  uploadAvatar={uploadAvatar}
                  uploadCover={uploadCover}
                  checkUsernameAvailability={checkUsernameAvailability}
                />
              )}
              {active === "Appearance" && (
                <AppearanceSettingsPane
                  appearance={appearance}
                  updateAppearance={updateAppearance}
                />
              )}
              {active === "Notifications" && (
                <NotificationsSettingsPane
                  notifications={notifications}
                  isSignedIn={isSignedIn}
                  updateNotifications={updateNotifications}
                />
              )}
              {active === "Messages"
                && messagesAccess.visible && (
                  <MessagesSettingsPane />
                )}
              {active === "Privacy" && (
                <PrivacySettingsPane
                  privacy={privacy}
                  profile={profile}
                  isSignedIn={isSignedIn}
                  updatePrivacy={updatePrivacy}
                  updateProfile={updateProfile}
                />
              )}
              {active === "Playback" && (
                <PlaybackSettingsPane
                  playback={playback}
                  isSignedIn={isSignedIn}
                  updatePlayback={updatePlayback}
                />
              )}
              {active === "Danger" && (
                <DangerSettingsPane onReset={resetAll} />
              )}
            </div>

            {active !== "Messages" && (
              <div className="settings49-savebar">
                <div>{savePill()}</div>
                <div className="flex items-center gap-2">
                  <button
                    className="wk-button wk-button-sm wk-button-ghost"
                    onClick={discardChanges}
                    disabled={!dirty || saving}
                  >
                    Discard
                  </button>
                  <button
                    className="wk-button wk-button-sm wk-button-primary"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
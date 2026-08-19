import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useTheme, type ThemeMode } from "@/components/design-system/theme/ThemeProvider";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import { supabase } from "@/lib/supabase";

type SettingsTab = "Account" | "Appearance" | "Notifications" | "Playback" | "Privacy" | "Danger";

const TABS: { key: SettingsTab; icon: string }[] = [
  { key: "Account", icon: "ri-user-3-line" },
  { key: "Appearance", icon: "ri-palette-line" },
  { key: "Notifications", icon: "ri-notification-3-line" },
  { key: "Playback", icon: "ri-headphone-line" },
  { key: "Privacy", icon: "ri-shield-check-line" },
  { key: "Danger", icon: "ri-error-warning-line" },
];

const ACCENTS = [
  { label: "Verdant", value: "#84C241" },
  { label: "Terracotta", value: "#D6766A" },
  { label: "Sand", value: "#C7A06D" },
  { label: "Amber", value: "#E8A23A" },
  { label: "Rose", value: "#E86A8A" },
  { label: "Teal", value: "#4AB8A0" },
];

function isSettingsTab(
  value: string | null,
): value is SettingsTab {
  return TABS.some(
    (tab) => tab.key === value,
  );
}

export default function MobileSettingsPage() {
  const [searchParams] = useSearchParams();
  const requestedSection =
    searchParams.get("section");
  const [active, setActive] =
    useState<SettingsTab>(
      isSettingsTab(requestedSection)
        ? requestedSection
        : "Account",
    );
  const navigate = useNavigate();

  useEffect(() => {
    if (isSettingsTab(requestedSection)) {
      setActive(requestedSection);
    }
  }, [requestedSection]);

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

  const { theme, setTheme } = useTheme();

  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [usernameAvailability, setUsernameAvailability] = useState({
    status: "idle",
    available: false,
    normalized: "",
    message: "Choose a public handle.",
  });

  useEffect(() => {
    if (!isSignedIn) return;

    const value = profile.username || "";
    setUsernameAvailability((prev) => ({
      ...prev,
      status: value ? "checking" : "idle",
      normalized: value.trim().replace(/^@+/, "").toLowerCase(),
      message: value ? "Checking handle..." : "Choose a public handle.",
    }));

    const timer = window.setTimeout(async () => {
      const result = await checkUsernameAvailability(value);
      setUsernameAvailability(result);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [profile.username, isSignedIn, checkUsernameAvailability]);

  const handleUsernameChange = (value: string) => {
    updateProfile({ username: value.trim().replace(/^@+/, "").toLowerCase() });
  };

  const usernameStatusClass =
    usernameAvailability.status === "available" || usernameAvailability.status === "current"
      ? "text-[var(--wk-success)]"
      : usernameAvailability.status === "checking" || usernameAvailability.status === "idle"
        ? "text-[var(--wk-text-faint)]"
        : "text-[var(--wk-danger)]";

  const handleSave = async () => {
    await saveAll();
    // Dispatch custom event so AccentProvider picks up changes
    window.dispatchEvent(new CustomEvent("wk-accent-changed"));
  };

  const handleConnectAppleMusic = async () => {
    if (!isSignedIn) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("apple-music-token", {});
      if (fnErr) throw new Error(fnErr.message || "Failed to get developer token");
      const devToken = data?.developerToken;
      if (!devToken) throw new Error(data?.error || "No developer token returned");

      if (!(window as any).MusicKit) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load MusicKit JS"));
          document.head.appendChild(script);
        });
      }

      const MusicKit = (window as any).MusicKit;
      await MusicKit.configure({
        developerToken: devToken,
        app: { name: "WAKILISHA", build: "1.0.0" },
      });

      const instance = MusicKit.getInstance();
      const userToken = await instance.authorize();

      if (userToken) {
        updatePlayback({ appleMusicConnected: true, appleMusicToken: userToken, preferApplePreviews: true });
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectAppleMusic = () => {
    try {
      const MusicKit = (window as any).MusicKit;
      if (MusicKit) {
        const instance = MusicKit.getInstance();
        if (instance) instance.unauthorize();
      }
    } catch { /* noop */ }
    updatePlayback({ appleMusicConnected: false, appleMusicToken: null, preferApplePreviews: false });
  };

  const handleCoverUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setCoverUploading(true);
      setCoverUploadError(null);
      try {
        const url = await uploadCover(file);
        if (url) updateProfile({ coverUrl: url });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Cover upload failed";
        setCoverUploadError(message);
        alert(message);
      } finally {
        setCoverUploading(false);
      }
    };
    input.click();
  }, [uploadCover, updateProfile]);

  const handleAvatarUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be under 5MB");
        return;
      }
      try {
        const url = await uploadAvatar(file);
        if (url) updateProfile({ avatarUrl: url });
      } catch (err) {
        alert("Upload failed. Please try again.");
      }
    };
    input.click();
  }, [uploadAvatar, updateProfile]);

  if (loading || authLoading) {
    return (
      <div className="wk-mobile-v5 min-h-[100dvh]">
        <div className="px-5 pt-12 pb-4">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-24 bg-[var(--wk-surface-raised)] rounded" />
            <div className="h-10 w-48 bg-[var(--wk-surface-raised)] rounded" />
            <div className="h-4 w-64 bg-[var(--wk-surface-raised)] rounded" />
          </div>
        </div>
        <div className="px-5 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-[var(--wk-surface-raised)] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="wk-mobile-v5 min-h-[100dvh] pb-28">
      {/* Header */}
      <div className="px-5 pt-12 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--wk-surface)] text-[var(--wk-text-muted)] mb-3 cursor-pointer"
        >
          <i className="ri-arrow-left-line text-lg" />
        </button>
        <h1 className="text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)]">Settings</h1>
        <p className="text-[12px] text-[var(--wk-text-muted)] mt-1.5">
          {isSignedIn ? userEmail : "Sign in to sync across devices"}
        </p>
      </div>

      {isSignedIn && (
        <div className="px-5 mb-4">
          <Link
            to="/start?edit=1"
            className="flex items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3.5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-group-line text-lg" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-[var(--wk-text)]">
                Your People
              </span>
              <span className="mt-0.5 block text-[11px] text-[var(--wk-text-muted)]">
                Change the Artists you keep close.
              </span>
            </span>
            <i className="ri-arrow-right-s-line text-lg text-[var(--wk-text-faint)]" />
          </Link>
        </div>
      )}

      {/* Scrollable tab bar */}
      <div className="px-5 mb-5">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                active === tab.key
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "bg-[var(--wk-surface)] text-[var(--wk-text-muted)] border border-[var(--wk-border)]"
              }`}
            >
              <i className={`${tab.icon} text-sm`} />
              {tab.key}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="px-5">
        {/* ─── Account ─── */}
        {active === "Account" && (
          <div className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleAvatarUpload}
                className="relative w-[72px] h-[72px] rounded-full overflow-hidden bg-[var(--wk-surface-raised)] flex items-center justify-center cursor-pointer group"
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-[var(--wk-brand)]">{userInitial}</span>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="ri-camera-line text-white text-lg" />
                </div>
              </button>
              <div>
                <div className="text-[15px] font-black text-[var(--wk-text)]">
                  {profile.displayName || userEmail?.split("@")[0] || "Reader"}
                </div>
                <div className="text-[12px] text-[var(--wk-text-muted)]">Tap avatar to change</div>
              </div>
            </div>

            {/* Cover photo */}
            <div>
              <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-2">Cover photo</div>
              <button
                onClick={handleCoverUpload}
                disabled={coverUploading || !isSignedIn}
                className="relative block w-full aspect-[8/3] min-h-[124px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] text-left"
                style={{
                  background: profile.coverUrl
                    ? "var(--wk-surface-raised)"
                    : "linear-gradient(135deg, #123908 0%, #245714 45%, #86c343 100%)",
                }}
              >
                {profile.coverUrl && (
                  <img src={profile.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/40" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/85">
                      {coverUploading ? "Uploading..." : profile.coverUrl ? "Change cover" : "Upload cover"}
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-white/75">
                      Min 1600×600. Recommended 2400×900. Ratio 2.4:1–3.2:1. Max 8MB.
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black">
                    <i className="ri-camera-line text-sm" />
                  </span>
                </div>
              </button>
              {profile.coverUrl && (
                <button
                  onClick={() => updateProfile({ coverUrl: null })}
                  className="mt-2 text-[11px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-danger)]"
                >
                  Remove cover
                </button>
              )}
              {coverUploadError && <p className="mt-2 text-[10px] font-bold text-[var(--wk-danger)]">{coverUploadError}</p>}
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-1">Display name</div>
                <input
                  className="w-full h-[44px] px-3 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] text-[var(--wk-text)] text-sm font-bold focus:outline-none focus:border-[var(--wk-brand)]"
                  value={profile.displayName}
                  onChange={(e) => updateProfile({ displayName: e.target.value })}
                  placeholder="Your display name"
                />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-1">Handle</div>
                <div className="flex h-[44px] overflow-hidden rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] focus-within:border-[var(--wk-brand)]">
                  <span className="flex items-center px-3 text-sm font-black text-[var(--wk-text-faint)]">@</span>
                  <input
                    className="min-w-0 flex-1 bg-transparent pr-3 text-sm font-bold text-[var(--wk-text)] focus:outline-none"
                    value={profile.username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="your_handle"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={!isSignedIn}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className={`text-[10px] font-bold ${usernameStatusClass}`}>
                    {usernameAvailability.message}
                  </p>
                  {usernameAvailability.normalized && (
                    <span className="shrink-0 text-[10px] text-[var(--wk-text-faint)]">
                      /u/{usernameAvailability.normalized}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-1">Bio</div>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2.5 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] text-[var(--wk-text)] text-sm resize-y focus:outline-none focus:border-[var(--wk-brand)]"
                  value={profile.bio}
                  onChange={(e) => updateProfile({ bio: e.target.value })}
                  placeholder="Tell the community about yourself..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-1">Country</div>
                  <input
                    className="w-full h-[44px] px-3 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] text-[var(--wk-text)] text-sm font-bold focus:outline-none focus:border-[var(--wk-brand)]"
                    value={profile.country}
                    onChange={(e) => updateProfile({ country: e.target.value })}
                    placeholder="Country"
                  />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-1">City</div>
                  <input
                    className="w-full h-[44px] px-3 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] text-[var(--wk-text)] text-sm font-bold focus:outline-none focus:border-[var(--wk-brand)]"
                    value={profile.city}
                    onChange={(e) => updateProfile({ city: e.target.value })}
                    placeholder="City"
                  />
                </div>
              </div>
            </div>

            {!isSignedIn && (
              <Link
                to="/auth"
                className="flex items-center justify-center gap-2 h-[44px] rounded-xl bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-sm font-bold cursor-pointer"
              >
                Sign in to save to your account
              </Link>
            )}
          </div>
        )}

        {/* ─── Appearance ─── */}
        {active === "Appearance" && (
          <div className="space-y-6">
            <div>
              <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-3">Theme</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setTheme("dark"); updateAppearance({ theme: "dark" }); }}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
                    appearance.theme === "dark" ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]" : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                  }`}
                >
                  <i className="ri-moon-line text-base text-[var(--wk-text)]" />
                  <div className="text-[13px] font-black text-[var(--wk-text)] mt-2">Dark</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">Cinematic default</div>
                </button>
                <button
                  onClick={() => { setTheme("light"); updateAppearance({ theme: "light" }); }}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
                    appearance.theme === "light" ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]" : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                  }`}
                >
                  <i className="ri-sun-line text-base text-[var(--wk-text)]" />
                  <div className="text-[13px] font-black text-[var(--wk-text)] mt-2">Light</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">Daytime surface</div>
                </button>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-3">Accent</div>
              <div className="flex gap-3 flex-wrap">
                {ACCENTS.map((acc) => (
                  <button
                    key={acc.value}
                    onClick={() => {
                      updateAppearance({ accent: acc.value });
                      window.dispatchEvent(new CustomEvent("wk-accent-changed"));
                    }}
                    className={`w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-110 border-[3px] ${
                      appearance.accent === acc.value ? "border-[var(--wk-text)]" : "border-transparent"
                    }`}
                    style={{ background: acc.value }}
                    aria-label={acc.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-[var(--wk-text-faint)] uppercase tracking-wider mb-2">Density</div>
              <select
                className="w-full h-[44px] px-4 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] text-[var(--wk-text)] text-sm font-bold focus:outline-none focus:border-[var(--wk-brand)] cursor-pointer"
                value={appearance.density}
                onChange={(e) => updateAppearance({ density: e.target.value as any })}
              >
                <option>Comfortable</option>
                <option>Compact</option>
              </select>
            </div>
          </div>
        )}

        {/* ─── Notifications ─── */}
        {active === "Notifications" && (
          <div>
            <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Weekly email digest</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">A calm weekly summary of charts, essays, and releases.</div>
        </div>
        <WakilishaToggle value={notifications.emailDigest} onChange={(v) => updateNotifications({ emailDigest: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Chart movement alerts</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">When followed artists enter or top a chart.</div>
        </div>
        <WakilishaToggle value={notifications.chartAlerts} onChange={(v) => updateNotifications({ chartAlerts: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Artist release alerts</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">New tracks and releases from followed artists.</div>
        </div>
        <WakilishaToggle value={notifications.artistDrops} onChange={(v) => updateNotifications({ artistDrops: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Reply notifications</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">When someone replies to your comments.</div>
        </div>
        <WakilishaToggle value={notifications.replyNotifications} onChange={(v) => updateNotifications({ replyNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Mention notifications</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">When someone @mentions you.</div>
        </div>
        <WakilishaToggle value={notifications.mentionNotifications} onChange={(v) => updateNotifications({ mentionNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Follow notifications</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">When someone follows your profile.</div>
        </div>
        <WakilishaToggle value={notifications.followNotifications} onChange={(v) => updateNotifications({ followNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Contribution alerts</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">When your contributions get reviewed.</div>
        </div>
        <WakilishaToggle value={notifications.contributionNotifications} onChange={(v) => updateNotifications({ contributionNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Marketing emails</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Occasional news about features and events.</div>
        </div>
        <WakilishaToggle value={notifications.marketingEmails} onChange={(v) => updateNotifications({ marketingEmails: v })} />
      </div>
            {!isSignedIn && (
              <div className="mt-4 p-3 rounded-xl bg-[var(--wk-warning-soft)] text-[11px] text-[var(--wk-text-muted)]">
                <i className="ri-information-line mr-1.5" /> Sign in to sync notification preferences.
              </div>
            )}
          </div>
        )}

        {/* ─── Playback ─── */}
        {active === "Playback" && (
          <div className="space-y-5">
            {/* Apple Music */}
            <div className="p-4 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--wk-surface-raised)]">
                  <i className="ri-apple-fill text-xl text-[var(--wk-text)]" />
                </div>
                <div>
                  <div className="text-sm font-black text-[var(--wk-text)]">Apple Music</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">
                    {playback.appleMusicConnected ? "Connected — full playback enabled" : "Connect for full track playback"}
                  </div>
                </div>
              </div>
              {playback.appleMusicConnected ? (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[var(--wk-success)]">
                    <i className="ri-checkbox-circle-fill text-sm mr-1" /> Connected
                  </span>
                  <button onClick={handleDisconnectAppleMusic} className="text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-danger)] cursor-pointer">
                    Disconnect
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handleConnectAppleMusic}
                    disabled={connecting || !isSignedIn}
                    className="flex items-center gap-2 h-[40px] px-4 rounded-lg text-xs font-bold bg-[var(--wk-brand)] text-[var(--wk-brand-on)] cursor-pointer disabled:opacity-50"
                  >
                    {connecting ? (
                      <><i className="ri-loader-4-line animate-spin" /> Connecting...</>
                    ) : (
                      <><i className="ri-apple-fill" /> Connect Apple Music</>
                    )}
                  </button>
                  {connectError && <p className="text-[11px] text-[var(--wk-danger)] mt-2">{connectError}</p>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Autoplay next track</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Continue through queues automatically.</div>
        </div>
        <WakilishaToggle value={playback.autoplay} onChange={(v) => updatePlayback({ autoplay: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Explicit content filter</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Hide tracks marked explicit.</div>
        </div>
        <WakilishaToggle value={playback.explicitFilter} onChange={(v) => updatePlayback({ explicitFilter: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Prefer Apple Music previews</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Prioritize full playback over YouTube.</div>
        </div>
        <WakilishaToggle value={playback.preferApplePreviews} onChange={(v) => updatePlayback({ preferApplePreviews: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Community moments while listening</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Show top timestamp comments as tracks play.</div>
        </div>
        <WakilishaToggle value={playback.showCommunityMoments !== false} onChange={(v) => updatePlayback({ showCommunityMoments: v })} />
      </div>

            <div className="flex items-center justify-between py-3.5">
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)]">Playback quality</div>
                <div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">Default stream quality</div>
              </div>
              <select
                className="h-[40px] px-3 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] text-[var(--wk-text)] text-sm font-bold cursor-pointer"
                value={playback.playbackQuality}
                onChange={(e) => updatePlayback({ playbackQuality: e.target.value as any })}
              >
                <option>Auto</option>
                <option>High</option>
                <option>Data saver</option>
              </select>
            </div>
          </div>
        )}

        {/* ─── Privacy ─── */}
        {active === "Privacy" && (
          <div>
                      <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[var(--wk-text)]">Public profile</div>
              <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Allow others to find and view your profile.</div>
            </div>
            <WakilishaToggle value={privacy.analyticsConsent ? profile.isPublic : false} onChange={(v) => { updateProfile({ isPublic: v }); updatePrivacy({ analyticsConsent: v }); }} />
          </div>
          <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[var(--wk-text)]">Private listening history</div>
              <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Don't share what you're listening to.</div>
            </div>
            <WakilishaToggle value={privacy.privateListening} onChange={(v) => updatePrivacy({ privateListening: v })} />
          </div>
          <div className="flex items-center justify-between gap-3 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[var(--wk-text)]">Analytics consent</div>
              <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Help us improve WAKILISHA with anonymized usage data.</div>
            </div>
            <WakilishaToggle value={privacy.analyticsConsent} onChange={(v) => updatePrivacy({ analyticsConsent: v })} />
          </div>
            <div className="mt-4 pt-4 border-t border-[var(--wk-divider)] space-y-3">
              <Link to="/privacy" className="flex items-center justify-between py-2 text-[13px] font-bold text-[var(--wk-text)]">
                Privacy Policy <i className="ri-arrow-right-s-line text-[var(--wk-text-muted)]" />
              </Link>
              <Link to="/terms" className="flex items-center justify-between py-2 text-[13px] font-bold text-[var(--wk-text)]">
                Terms of Service <i className="ri-arrow-right-s-line text-[var(--wk-text-muted)]" />
              </Link>
            </div>
          </div>
        )}

        {/* ─── Danger ─── */}
        {active === "Danger" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger-soft)]">
              <div className="text-sm font-black text-[var(--wk-danger)] mb-1">Reset all preferences</div>
              <p className="text-[12px] text-[var(--wk-text-muted)] mb-3">
                This clears all local settings and restores defaults. Your Supabase data is not affected.
              </p>
              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="h-[38px] px-4 rounded-lg text-[11px] font-bold border border-[var(--wk-danger)] text-[var(--wk-danger)] bg-transparent cursor-pointer"
                >
                  Reset preferences
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { resetAll(); setShowResetConfirm(false); }}
                    className="h-[38px] px-4 rounded-lg text-[11px] font-bold bg-[var(--wk-danger)] text-white cursor-pointer"
                  >
                    Confirm reset
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="h-[38px] px-4 rounded-lg text-[11px] font-bold border border-[var(--wk-border)] text-[var(--wk-text-muted)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="fixed bottom-[calc(52px+max(env(safe-area-inset-bottom),8px)+12px)] left-3 right-3 z-[75]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--wk-surface)] border border-[var(--wk-border)] backdrop-blur-xl">
          <div className="text-[11px] font-bold">
            {saveStatus === "saving" ? (
              <span className="text-[var(--wk-text-muted)]"><i className="ri-loader-4-line animate-spin mr-1" /> Saving...</span>
            ) : saveStatus === "saved" ? (
              <span className="text-[var(--wk-success)]"><i className="ri-checkbox-circle-fill mr-1" /> Saved</span>
            ) : saveStatus === "error" ? (
              <span className="text-[var(--wk-danger)]">{error || "Save failed"}</span>
            ) : dirty ? (
              <span className="text-[var(--wk-warning)]">Unsaved changes</span>
            ) : (
              <span className="text-[var(--wk-text-faint)]">Up to date</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={discardChanges}
              disabled={!dirty || saving}
              className="h-[36px] px-3 rounded-lg text-[11px] font-bold text-[var(--wk-text-muted)] cursor-pointer disabled:opacity-40"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="h-[36px] px-4 rounded-lg text-[11px] font-bold bg-[var(--wk-brand)] text-[var(--wk-brand-on)] cursor-pointer disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
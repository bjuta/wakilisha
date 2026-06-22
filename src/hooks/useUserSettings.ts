import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────

export interface UserProfileFields {
  username: string;
  displayName: string;
  bio: string;
  country: string;
  city: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  isPublic: boolean;
}

export type UsernameAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "current"
  | "invalid"
  | "taken"
  | "reserved"
  | "error";

export interface UsernameAvailability {
  status: UsernameAvailabilityStatus;
  available: boolean;
  normalized: string;
  message: string;
}

export interface UserAppearancePrefs {
  theme: "dark" | "light" | "system";
  density: "Comfortable" | "Compact";
  accent: string;
  coverColor: string;
}

export interface UserNotificationPrefs {
  emailDigest: boolean;
  chartAlerts: boolean;
  artistDrops: boolean;
  replyNotifications: boolean;
  mentionNotifications: boolean;
  followNotifications: boolean;
  contributionNotifications: boolean;
  marketingEmails: boolean;
}

export interface UserPlaybackPrefs {
  autoplay: boolean;
  explicitFilter: boolean;
  playbackQuality: "Auto" | "High" | "Data saver";
  appleMusicConnected: boolean;
  appleMusicToken: string | null;
  preferApplePreviews: boolean;
}

export interface UserPrivacyPrefs {
  privateListening: boolean;
  analyticsConsent: boolean;
}

export interface AllUserSettings {
  profile: UserProfileFields;
  appearance: UserAppearancePrefs;
  notifications: UserNotificationPrefs;
  playback: UserPlaybackPrefs;
  privacy: UserPrivacyPrefs;
}

// ─── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_PROFILE: UserProfileFields = {
  username: "",
  displayName: "",
  bio: "",
  country: "",
  city: "",
  avatarUrl: null,
  coverUrl: null,
  isPublic: true,
};

const DEFAULT_APPEARANCE: UserAppearancePrefs = {
  theme: "dark",
  density: "Comfortable",
  accent: "#84C241",
  coverColor: "#1a3a0a",
};

const DEFAULT_NOTIFICATIONS: UserNotificationPrefs = {
  emailDigest: true,
  chartAlerts: true,
  artistDrops: true,
  replyNotifications: true,
  mentionNotifications: true,
  followNotifications: false,
  contributionNotifications: false,
  marketingEmails: false,
};

const DEFAULT_PLAYBACK: UserPlaybackPrefs = {
  autoplay: false,
  explicitFilter: false,
  playbackQuality: "Auto",
  appleMusicConnected: false,
  appleMusicToken: null,
  preferApplePreviews: false,
};

const DEFAULT_PRIVACY: UserPrivacyPrefs = {
  privateListening: true,
  analyticsConsent: false,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────

const LS_PROFILE = "wk-profile-v2";
const LS_APPEARANCE = "wk-appearance-v2";
const LS_NOTIFICATIONS = "wk-notifications-v2";
const LS_PLAYBACK = "wk-playback-v2";
const LS_PRIVACY = "wk-privacy-v2";
const LS_SAVED_AT = "wk-settings-saved-v2";

const AVATAR_BUCKET = "avatars";
const COVER_BUCKET = "profile-covers";
const COVER_MAX_BYTES = 8 * 1024 * 1024;
const COVER_MIN_WIDTH = 1600;
const COVER_MIN_HEIGHT = 600;
const COVER_MIN_RATIO = 2.4;
const COVER_MAX_RATIO = 3.2;
const COVER_RECOMMENDED = "2400×900";
const AVATAR_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AvatarExtension = typeof AVATAR_EXTENSION_BY_MIME[keyof typeof AVATAR_EXTENSION_BY_MIME];

const USERNAME_PATTERN = /^[a-z0-9]([a-z0-9_]{1,28}[a-z0-9])$/;

export function normalizeUsernameInput(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function localUsernameAvailability(value: string, currentUsername: string): UsernameAvailability | null {
  const normalized = normalizeUsernameInput(value);

  if (!normalized) {
    return {
      status: "idle",
      available: false,
      normalized,
      message: "Choose a public handle.",
    };
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      status: "invalid",
      available: false,
      normalized,
      message: "Use 3-30 lowercase letters, numbers, or underscores. Start and end with a letter or number.",
    };
  }

  if (currentUsername && normalized === currentUsername) {
    return {
      status: "current",
      available: true,
      normalized,
      message: "This is your current handle.",
    };
  }

  return null;
}

function getAvatarExtension(file: File): AvatarExtension | null {
  const byMime = AVATAR_EXTENSION_BY_MIME[file.type as keyof typeof AVATAR_EXTENSION_BY_MIME];
  if (byMime) return byMime;

  const rawExt = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : null;
  if (rawExt === "jpeg") return "jpg";
  if (rawExt === "jpg" || rawExt === "png" || rawExt === "webp") return rawExt;
  return null;
}

function getAvatarContentType(file: File, ext: AvatarExtension): string {
  if (AVATAR_EXTENSION_BY_MIME[file.type as keyof typeof AVATAR_EXTENSION_BY_MIME]) return file.type;
  if (ext === "jpg") return "image/jpeg";
  return `image/${ext}`;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };

    image.src = url;
  });
}

async function validateCoverImage(file: File): Promise<void> {
  const ext = getAvatarExtension(file);
  if (!ext) throw new Error("Use a JPG, PNG, or WEBP cover image.");

  if (file.size > COVER_MAX_BYTES) {
    throw new Error("Cover image must be 8MB or smaller.");
  }

  const { width, height } = await getImageDimensions(file);
  const ratio = width / height;

  if (width < COVER_MIN_WIDTH || height < COVER_MIN_HEIGHT) {
    throw new Error(`Cover image must be at least ${COVER_MIN_WIDTH}×${COVER_MIN_HEIGHT}px. Recommended: ${COVER_RECOMMENDED}px.`);
  }

  if (ratio < COVER_MIN_RATIO || ratio > COVER_MAX_RATIO) {
    throw new Error("Cover image must be wide: accepted aspect ratio is 2.4:1 to 3.2:1. Recommended: 8:3.");
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useUserSettings() {
  const auth = useAuthUser();
  const userId = auth.id;

  const [profile, setProfile] = useState<UserProfileFields>(DEFAULT_PROFILE);
  const [appearance, setAppearance] = useState<UserAppearancePrefs>(DEFAULT_APPEARANCE);
  const [notifications, setNotifications] = useState<UserNotificationPrefs>(DEFAULT_NOTIFICATIONS);
  const [playback, setPlayback] = useState<UserPlaybackPrefs>(DEFAULT_PLAYBACK);
  const [privacy, setPrivacy] = useState<UserPrivacyPrefs>(DEFAULT_PRIVACY);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savedUsername, setSavedUsername] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ─── Dirty tracking ───
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");

  const dirty = useMemo(() => {
    const current = JSON.stringify({ profile, appearance, notifications, playback, privacy });
    return current !== savedSnapshot;
  }, [profile, appearance, notifications, playback, privacy, savedSnapshot]);

  // ─── Load from localStorage on mount ───
  useEffect(() => {
    try {
      const p = localStorage.getItem(LS_PROFILE);
      const a = localStorage.getItem(LS_APPEARANCE);
      const n = localStorage.getItem(LS_NOTIFICATIONS);
      const pb = localStorage.getItem(LS_PLAYBACK);
      const pr = localStorage.getItem(LS_PRIVACY);
      const sa = localStorage.getItem(LS_SAVED_AT);

      if (p) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(p) });
      if (a) setAppearance({ ...DEFAULT_APPEARANCE, ...JSON.parse(a) });
      if (n) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...JSON.parse(n) });
      if (pb) setPlayback({ ...DEFAULT_PLAYBACK, ...JSON.parse(pb) });
      if (pr) setPrivacy({ ...DEFAULT_PRIVACY, ...JSON.parse(pr) });
      if (sa) setSavedAt(sa);

      setSavedSnapshot(
        JSON.stringify({
          profile: p ? { ...DEFAULT_PROFILE, ...JSON.parse(p) } : DEFAULT_PROFILE,
          appearance: a ? { ...DEFAULT_APPEARANCE, ...JSON.parse(a) } : DEFAULT_APPEARANCE,
          notifications: n ? { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(n) } : DEFAULT_NOTIFICATIONS,
          playback: pb ? { ...DEFAULT_PLAYBACK, ...JSON.parse(pb) } : DEFAULT_PLAYBACK,
          privacy: pr ? { ...DEFAULT_PRIVACY, ...JSON.parse(pr) } : DEFAULT_PRIVACY,
        })
      );
    } catch { /* storage unavailable */ }

    setLoading(false);
  }, []);

  // ─── Sync FROM Supabase (community_profile + notification_prefs) ───
  useEffect(() => {
    if (!userId) return;

    // Load profile from Supabase
    supabase
      .rpc("community_get_user_profile", { p_user_id: userId })
      .then(({ data, error: rpcErr }) => {
        if (rpcErr || !data) return;
        const supabaseProfile: UserProfileFields = {
          username: data.username || data.username_normalized || "",
          displayName: data.display_name || "",
          bio: data.bio || "",
          country: data.country || "",
          city: data.city || "",
          avatarUrl: data.avatar_url || null,
          coverUrl: data.cover_url || null,
          isPublic: data.is_public ?? true,
        };
        setSavedUsername(supabaseProfile.username);
        setProfile((prev) => {
          const merged = { ...DEFAULT_PROFILE, ...prev, ...supabaseProfile };
          try { localStorage.setItem(LS_PROFILE, JSON.stringify(merged)); } catch { /* noop */ }
          return merged;
        });
      })
      .catch(() => { /* silent */ });

    // Load notification prefs from Supabase
    supabase
      .rpc("community_get_notification_prefs", { p_user_id: userId })
      .then(({ data, error: rpcErr }) => {
        if (rpcErr || !data) return;
        const supabaseNotifs: Partial<UserNotificationPrefs> = {
          emailDigest: data.email_digest ?? true,
          chartAlerts: data.chart_alerts ?? true,
          artistDrops: data.artist_drops ?? true,
          replyNotifications: data.reply_notifications ?? true,
          mentionNotifications: data.mention_notifications ?? true,
          followNotifications: data.follow_notifications ?? false,
          contributionNotifications: data.contribution_notifications ?? false,
          marketingEmails: data.marketing_emails ?? false,
        };
        setNotifications((prev) => {
          const merged = { ...DEFAULT_NOTIFICATIONS, ...prev, ...supabaseNotifs };
          try { localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(merged)); } catch { /* noop */ }
          return merged;
        });
      })
      .catch(() => { /* silent */ });
  }, [userId]);

  // ─── Updaters ───
  const updateProfile = useCallback((patch: Partial<UserProfileFields>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_PROFILE, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const updateAppearance = useCallback((patch: Partial<UserAppearancePrefs>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_APPEARANCE, JSON.stringify(next)); } catch { /* noop */ }
      // Notify AccentProvider of changes
      window.dispatchEvent(new CustomEvent("wk-accent-changed"));
      return next;
    });
  }, []);

  const updateNotifications = useCallback((patch: Partial<UserNotificationPrefs>) => {
    setNotifications((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const updatePlayback = useCallback((patch: Partial<UserPlaybackPrefs>) => {
    setPlayback((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_PLAYBACK, JSON.stringify(next)); } catch { /* noop */ }
      // Notify PlayerContext of changes
      window.dispatchEvent(new CustomEvent("wk-playback-changed"));
      return next;
    });
  }, []);

  const updatePrivacy = useCallback((patch: Partial<UserPrivacyPrefs>) => {
    setPrivacy((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_PRIVACY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const checkUsernameAvailability = useCallback(async (value: string): Promise<UsernameAvailability> => {
    const localResult = localUsernameAvailability(value, savedUsername);
    if (localResult) return localResult;

    const normalized = normalizeUsernameInput(value);

    try {
      const { data, error: rpcErr } = await supabase.rpc("community_username_available", {
        p_username: normalized,
      });

      if (rpcErr) {
        return {
          status: "error",
          available: false,
          normalized,
          message: rpcErr.message || "Could not check handle availability.",
        };
      }

      const result = data as Record<string, unknown> | null;
      const available = Boolean(result?.available);
      const reason = String(result?.reason || result?.status || "").toLowerCase();
      const message = String(result?.message || "");

      if (available) {
        return {
          status: "available",
          available: true,
          normalized,
          message: message || "Handle is available.",
        };
      }

      if (reason.includes("reserved")) {
        return {
          status: "reserved",
          available: false,
          normalized,
          message: message || "This handle is reserved.",
        };
      }

      return {
        status: "taken",
        available: false,
        normalized,
        message: message || "This handle is already taken.",
      };
    } catch (err) {
      return {
        status: "error",
        available: false,
        normalized,
        message: err instanceof Error ? err.message : "Could not check handle availability.",
      };
    }
  }, [savedUsername]);

  // ─── Save to Supabase ───
  const saveAll = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    setSaveStatus("saving");
    setError(null);

    try {
      let profileToPersist = profile;
      const normalizedUsername = normalizeUsernameInput(profile.username);

      if (normalizedUsername && normalizedUsername !== savedUsername) {
        const localResult = localUsernameAvailability(normalizedUsername, savedUsername);
        if (localResult && !localResult.available) {
          throw new Error(localResult.message);
        }

        const { error: usernameErr } = await supabase.rpc("community_update_username", {
          p_username: normalizedUsername,
        });

        if (usernameErr) throw new Error(`Handle save failed: ${usernameErr.message}`);

        profileToPersist = { ...profileToPersist, username: normalizedUsername };
        setProfile(profileToPersist);
        setSavedUsername(normalizedUsername);
      }

      // Save profile to Supabase
      const { error: profileErr } = await supabase.rpc("community_update_profile", {
        p_user_id: userId,
        p_display_name: profileToPersist.displayName || null,
        p_bio: profileToPersist.bio || null,
        p_country: profileToPersist.country || null,
        p_city: profileToPersist.city || null,
        p_is_public: profileToPersist.isPublic,
        p_avatar_url: profileToPersist.avatarUrl,
        p_clear_avatar: profileToPersist.avatarUrl === null,
        p_cover_url: profileToPersist.coverUrl,
        p_clear_cover: profileToPersist.coverUrl === null,
      });
      if (profileErr) throw new Error(`Profile save failed: ${profileErr.message}`);

      // Save notification prefs to Supabase
      const { error: notifErr } = await supabase.rpc("community_update_notification_prefs", {
        p_user_id: userId,
        p_email_digest: notifications.emailDigest,
        p_chart_alerts: notifications.chartAlerts,
        p_artist_drops: notifications.artistDrops,
        p_reply_notifications: notifications.replyNotifications,
        p_mention_notifications: notifications.mentionNotifications,
        p_follow_notifications: notifications.followNotifications,
        p_contribution_notifications: notifications.contributionNotifications,
        p_marketing_emails: notifications.marketingEmails,
      });
      if (notifErr) throw new Error(`Notification prefs save failed: ${notifErr.message}`);

      // Save everything to localStorage
      const now = new Date().toISOString();
      try {
        localStorage.setItem(LS_PROFILE, JSON.stringify(profileToPersist));
        localStorage.setItem(LS_APPEARANCE, JSON.stringify(appearance));
        localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications));
        localStorage.setItem(LS_PLAYBACK, JSON.stringify(playback));
        localStorage.setItem(LS_PRIVACY, JSON.stringify(privacy));
        localStorage.setItem(LS_SAVED_AT, now);
      } catch { /* noop */ }

      const snapshot = JSON.stringify({ profile: profileToPersist, appearance, notifications, playback, privacy });
      setSavedSnapshot(snapshot);
      setSavedAt(now);
      setSaveStatus("saved");
      setSaving(false);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg);
      setSaveStatus("error");
      setSaving(false);
      return false;
    }
  }, [userId, profile, appearance, notifications, playback, privacy, savedUsername]);

  const discardChanges = useCallback(() => {
    try {
      const p = localStorage.getItem(LS_PROFILE);
      const a = localStorage.getItem(LS_APPEARANCE);
      const n = localStorage.getItem(LS_NOTIFICATIONS);
      const pb = localStorage.getItem(LS_PLAYBACK);
      const pr = localStorage.getItem(LS_PRIVACY);

      if (p) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(p) });
      else setProfile(DEFAULT_PROFILE);

      if (a) setAppearance({ ...DEFAULT_APPEARANCE, ...JSON.parse(a) });
      else setAppearance(DEFAULT_APPEARANCE);

      if (n) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...JSON.parse(n) });
      else setNotifications(DEFAULT_NOTIFICATIONS);

      if (pb) setPlayback({ ...DEFAULT_PLAYBACK, ...JSON.parse(pb) });
      else setPlayback(DEFAULT_PLAYBACK);

      if (pr) setPrivacy({ ...DEFAULT_PRIVACY, ...JSON.parse(pr) });
      else setPrivacy(DEFAULT_PRIVACY);
    } catch { /* noop */ }
    setSavedSnapshot(
      JSON.stringify({ profile, appearance, notifications, playback, privacy })
    );
    setSaveStatus("idle");
  }, [profile, appearance, notifications, playback, privacy]);

  const resetAll = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setAppearance(DEFAULT_APPEARANCE);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setPlayback(DEFAULT_PLAYBACK);
    setPrivacy(DEFAULT_PRIVACY);
    setSavedSnapshot(JSON.stringify({
      profile: DEFAULT_PROFILE,
      appearance: DEFAULT_APPEARANCE,
      notifications: DEFAULT_NOTIFICATIONS,
      playback: DEFAULT_PLAYBACK,
      privacy: DEFAULT_PRIVACY,
    }));
    try {
      localStorage.removeItem(LS_PROFILE);
      localStorage.removeItem(LS_APPEARANCE);
      localStorage.removeItem(LS_NOTIFICATIONS);
      localStorage.removeItem(LS_PLAYBACK);
      localStorage.removeItem(LS_PRIVACY);
      localStorage.removeItem(LS_SAVED_AT);
    } catch { /* noop */ }
    setSaveStatus("idle");
  }, []);

  // ─── Avatar upload helper ───
  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!userId) return null;

    const ext = getAvatarExtension(file);
    if (!ext) throw new Error("Use a JPG, PNG, or WEBP image.");

    const path = `${userId}/avatar.${ext}`;
    const contentType = getAvatarContentType(file, ext);

    const { error: uploadErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return `${urlData.publicUrl}?v=${Date.now()}`;
  }, [userId]);

  // ─── Cover photo upload helper ───
  const uploadCover = useCallback(async (file: File): Promise<string | null> => {
    if (!userId) return null;

    await validateCoverImage(file);

    const ext = getAvatarExtension(file);
    if (!ext) throw new Error("Use a JPG, PNG, or WEBP cover image.");

    const path = `${userId}/cover.${ext}`;
    const contentType = getAvatarContentType(file, ext);

    const { error: uploadErr } = await supabase.storage
      .from(COVER_BUCKET)
      .upload(path, file, { upsert: true, contentType });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data: urlData } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
    return `${urlData.publicUrl}?v=${Date.now()}`;
  }, [userId]);

  return {
    // State
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
    savedAt,
    isSignedIn: !!userId,
    userId,
    userEmail: auth.email || "",
    userInitial: (auth.name || auth.email || "W")[0]?.toUpperCase() || "W",
    authLoading: auth.loading,

    // Updaters
    updateProfile,
    updateAppearance,
    updateNotifications,
    updatePlayback,
    updatePrivacy,

    // Actions
    saveAll,
    discardChanges,
    resetAll,
    uploadAvatar,
    uploadCover,
    checkUsernameAvailability,
  };
}

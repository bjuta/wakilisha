import { supabase } from "@/lib/supabase";

// The account record is deliberately limited to non-sensitive listening
// preferences. Provider credentials remain device-local in wk-playback-v2.
const LOCAL_KEY = "wk-playback-v2";
const TIMESTAMP_KEY = "wk-playback-v2-changed-at";
const CLOUD_KEY = "wk_playback_v2";

interface SharedPlayback {
  autoplay: boolean;
  crossfade: boolean;
  crossfadeSeconds: number;
  keepAlbumsGapless: boolean;
}

const defaults: SharedPlayback = {
  autoplay: true,
  crossfade: false,
  crossfadeSeconds: 6,
  keepAlbumsGapless: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function fromRecord(record: Record<string, unknown>): SharedPlayback {
  const duration = Number(record.crossfadeSeconds);
  return {
    autoplay: record.autoplay !== false,
    crossfade: record.crossfade === true,
    crossfadeSeconds: Number.isFinite(duration)
      ? Math.max(3, Math.min(12, Math.round(duration))) : 6,
    keepAlbumsGapless: record.keepAlbumsGapless !== false,
  };
}

function localFull(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    return isRecord(parsed) ? parsed : {};
  } catch { return {}; }
}

export function readShareablePlaybackPrefs(): SharedPlayback {
  return fromRecord({ ...defaults, ...localFull() });
}

function accountPayload(): SharedPlayback & { updatedAt: number } {
  const changed = Number(localStorage.getItem(TIMESTAMP_KEY));
  return { ...readShareablePlaybackPrefs(), updatedAt: Number.isFinite(changed) ? changed : 0 };
}

/**
 * Called once by the shared PlayerProvider. Account metadata is not used
 * in policies or permissions. Network failure never stops music playback.
 */
export function startPlaybackAccountSync(): () => void {
  let disposed = false;
  let applyingRemote = false;
  let userId: string | null = null;
  let saveTimer: number | null = null;
  let lastFingerprint = JSON.stringify(readShareablePlaybackPrefs());
  let writes = Promise.resolve();

  const scheduleSave = () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    if (!userId) return;
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      const expectedUser = userId;
      writes = writes.then(async () => {
        if (disposed || !expectedUser || userId !== expectedUser) return;
        const { error } = await supabase.auth.updateUser({
          data: { [CLOUD_KEY]: accountPayload() },
        });
        if (error) console.warn("Playback preferences could not sync:", error.message);
      }).catch(() => {
        // Keep the local preference even when network sync is unavailable.
      });
    }, 500);
  };

  const onLocalChange = () => {
    if (applyingRemote || disposed) return;
    const fingerprint = JSON.stringify(readShareablePlaybackPrefs());
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
    scheduleSave();
  };

  const hydrateFromAccount = async () => {
    if (disposed) return;
    const { data, error } = await supabase.auth.getUser();
    if (disposed || error || !data.user) {
      if (!disposed && !data.user) userId = null;
      return;
    }
    const user = data.user;
    userId = user.id;
    const metadata: unknown = user.user_metadata?.[CLOUD_KEY];
    if (!isRecord(metadata)) {
      scheduleSave();
      return;
    }

    const remoteTimestamp = Number(metadata.updatedAt) || 0;
    const localTimestamp = Number(localStorage.getItem(TIMESTAMP_KEY)) || 0;
    if (localTimestamp > remoteTimestamp) {
      scheduleSave();
      return;
    }
    const prefs = fromRecord(metadata);
    applyingRemote = true;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...localFull(), ...prefs }));
      localStorage.setItem(TIMESTAMP_KEY, String(remoteTimestamp));
      lastFingerprint = JSON.stringify(prefs);
      window.dispatchEvent(new CustomEvent("wk-playback-changed"));
      window.dispatchEvent(new CustomEvent("wk-playback-account-loaded"));
    } finally {
      applyingRemote = false;
    }
  };

  const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      userId = null;
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      // Defer API requests outside the auth callback to avoid client deadlocks.
      window.setTimeout(() => { void hydrateFromAccount(); }, 0);
    }
  });
  const onFocus = () => { void hydrateFromAccount(); };
  window.addEventListener("wk-playback-changed", onLocalChange);
  window.addEventListener("focus", onFocus);
  window.setTimeout(() => { void hydrateFromAccount(); }, 0);

  return () => {
    disposed = true;
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    subscription.subscription.unsubscribe();
    window.removeEventListener("wk-playback-changed", onLocalChange);
    window.removeEventListener("focus", onFocus);
  };
}

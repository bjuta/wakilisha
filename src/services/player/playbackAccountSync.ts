import { supabase } from "@/lib/supabase";

// WAKILISHA account metadata contains only non-sensitive listening choices.
// Apple Music tokens and provider credentials never leave wk-playback-v2.
const LOCAL_KEY = "wk-playback-v2";
const TIMESTAMP_KEY = "wk-playback-v2-changed-at";
const OWNER_KEY = "wk-playback-v2-account-id";
const CLOUD_KEY = "wk_playback_v2";

interface SharedPlayback {
  autoplay: boolean;
  crossfade: boolean;
  crossfadeSeconds: number;
  smartMix: boolean;
}

const defaults: SharedPlayback = {
  autoplay: true,
  crossfade: false,
  crossfadeSeconds: 6,
  smartMix: true,
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
    smartMix: record.smartMix !== false,
  };
}

function localFull(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readShareablePlaybackPrefs(): SharedPlayback {
  return fromRecord({ ...defaults, ...localFull() });
}

function accountPayload(): SharedPlayback & { updatedAt: number } {
  const changed = Number(localStorage.getItem(TIMESTAMP_KEY));
  return {
    ...readShareablePlaybackPrefs(),
    updatedAt: Number.isFinite(changed) && changed > 0 ? changed : Date.now(),
  };
}

/** Runs once under PlayerProvider; failure must never interrupt audio. */
export function startPlaybackAccountSync(): () => void {
  let disposed = false;
  let userId: string | null = null;
  let generation = 0;
  let applyingRemote = false;
  let saveTimer: number | null = null;
  let writes = Promise.resolve();
  let fingerprint = JSON.stringify(readShareablePlaybackPrefs());

  const save = () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = null;
    const expectedUser = userId;
    const expectedGeneration = generation;
    if (!expectedUser) return;

    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      writes = writes.then(async () => {
        if (disposed || userId !== expectedUser || generation !== expectedGeneration) return;
        if (localStorage.getItem(OWNER_KEY) !== expectedUser) return;

        // updateUser acts on the current auth session, never a specified user.
        // Check identity again before any mutation to avoid cross-account writes.
        const { data: { session } } = await supabase.auth.getSession();
        if (disposed || generation !== expectedGeneration ||
            session?.user?.id !== expectedUser) return;

        const { error } = await supabase.auth.updateUser({
          data: { [CLOUD_KEY]: accountPayload() },
        });
        if (error) console.warn("Playback preferences could not sync:", error.message);
      }).catch(() => {
        // Keep the local settings when authentication or network is unavailable.
      });
    }, 500);
  };

  const writeLocal = (
    prefs: SharedPlayback, accountId: string, timestamp: number,
    clearProviderCredentials = false,
  ) => {
    applyingRemote = true;
    try {
      const existing = localFull();
      if (clearProviderCredentials) {
        // An Apple Music authorization belongs to the previous account.
        delete existing.appleMusicToken;
        existing.appleMusicConnected = false;
        existing.preferApplePreviews = false;
      }
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...existing, ...prefs }));
      localStorage.setItem(TIMESTAMP_KEY, String(timestamp));
      localStorage.setItem(OWNER_KEY, accountId);
      fingerprint = JSON.stringify(prefs);
      window.dispatchEvent(new CustomEvent("wk-playback-changed"));
      window.dispatchEvent(new CustomEvent("wk-playback-account-loaded"));
    } finally {
      applyingRemote = false;
    }
  };

  const onLocalChange = () => {
    if (disposed || applyingRemote) return;
    const next = JSON.stringify(readShareablePlaybackPrefs());
    if (next === fingerprint) return;
    fingerprint = next;
    try {
      localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
    } catch {
      return;
    }
    save();
  };

  const hydrate = async () => {
    if (disposed) return;
    const expectedGeneration = generation;
    const { data, error } = await supabase.auth.getUser();
    if (disposed || generation !== expectedGeneration || error || !data.user) return;
    const accountId = data.user.id;
    const { data: { session } } = await supabase.auth.getSession();
    if (disposed || generation !== expectedGeneration ||
        session?.user?.id !== accountId) return;
    userId = accountId;

    const existingOwner = localStorage.getItem(OWNER_KEY);
    const rawCloud: unknown = data.user.user_metadata?.[CLOUD_KEY];
    const cloud = isRecord(rawCloud) ? rawCloud : null;
    const cloudTimestamp = cloud ? Number(cloud.updatedAt) || 0 : 0;
    const localTimestamp = Number(localStorage.getItem(TIMESTAMP_KEY)) || 0;

    // Never push person A's browser settings to person B on the same device.
    if (existingOwner && existingOwner !== accountId) {
      writeLocal(cloud ? fromRecord(cloud) : defaults, accountId, cloudTimestamp, true);
      if (!cloud) save();
      return;
    }

    if (cloud && (!existingOwner || cloudTimestamp >= localTimestamp)) {
      writeLocal(fromRecord(cloud), accountId, cloudTimestamp);
      return;
    }

    // The first account claims anonymous/device choices; afterwards only
    // that account can upload them, even across sign-out/sign-in cycles.
    localStorage.setItem(OWNER_KEY, accountId);
    if (!cloud || localTimestamp > cloudTimestamp) save();
  };

  const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      generation += 1;
      userId = null;
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED") {
      generation += 1;
      window.setTimeout(() => { void hydrate(); }, 0);
    }
  });

  const onFocus = () => { void hydrate(); };
  window.addEventListener("wk-playback-changed", onLocalChange);
  window.addEventListener("focus", onFocus);

  return () => {
    disposed = true;
    generation += 1;
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    subscription.subscription.unsubscribe();
    window.removeEventListener("wk-playback-changed", onLocalChange);
    window.removeEventListener("focus", onFocus);
  };
}

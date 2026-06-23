import { getAuthorizedMusicKit } from "@/services/appleMusicPlayback";

const LS_PLAYBACK = "wk-playback-v2";

export interface ApplePlaybackPrefsSnapshot {
  appleMusicConnected: boolean;
  appleMusicToken: string | null;
  preferApplePreviews: boolean;
}

export function getApplePlaybackPrefsSnapshot(): ApplePlaybackPrefsSnapshot {
  try {
    const raw = localStorage.getItem(LS_PLAYBACK);
    const prefs = raw ? JSON.parse(raw) : {};

    return {
      appleMusicConnected: prefs.appleMusicConnected === true,
      appleMusicToken: typeof prefs.appleMusicToken === "string" ? prefs.appleMusicToken : null,
      preferApplePreviews: prefs.preferApplePreviews === true,
    };
  } catch {
    return {
      appleMusicConnected: false,
      appleMusicToken: null,
      preferApplePreviews: false,
    };
  }
}

function writeApplePlaybackPrefs(userToken: string): ApplePlaybackPrefsSnapshot {
  const current = (() => {
    try {
      return JSON.parse(localStorage.getItem(LS_PLAYBACK) || "{}");
    } catch {
      return {};
    }
  })();

  const next = {
    ...current,
    appleMusicConnected: true,
    appleMusicToken: userToken,
    preferApplePreviews: true,
  };

  localStorage.setItem(LS_PLAYBACK, JSON.stringify(next));

  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent("wk-playback-changed", { detail: next }));
    window.dispatchEvent(new CustomEvent("wk-apple-music-connected", { detail: next }));
  }, 0);

  return {
    appleMusicConnected: true,
    appleMusicToken: userToken,
    preferApplePreviews: true,
  };
}

export async function connectAppleMusicForPlayback(): Promise<ApplePlaybackPrefsSnapshot> {
  const music = await getAuthorizedMusicKit();

  let userToken = typeof music.musicUserToken === "string" ? music.musicUserToken : null;

  if (!userToken && typeof music.authorize === "function") {
    userToken = await music.authorize();
  }

  if (!userToken) {
    throw new Error("Apple Music connected, but no user token was returned.");
  }

  return writeApplePlaybackPrefs(userToken);
}

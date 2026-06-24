import type { UserPlaybackPrefs } from "@/hooks/useUserSettings";

export const FULL_PLAYBACK_NOTICE_ID = "apple-music-full-playback";
export const FULL_PLAYBACK_NOTICE_DISMISSED_KEY = "wk-notice-dismissed:apple-music-full-playback";
export const FULL_PLAYBACK_NOTICE_EVENT = "wk-full-playback-notice-changed";

export function isAppleMusicPlaybackConnected(playback?: Partial<UserPlaybackPrefs> | null): boolean {
  return Boolean(playback?.appleMusicConnected || playback?.appleMusicToken);
}

export function isFullPlaybackNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FULL_PLAYBACK_NOTICE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissFullPlaybackNotice(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FULL_PLAYBACK_NOTICE_DISMISSED_KEY, "1");
  } catch {
    /* noop */
  }

  window.dispatchEvent(new CustomEvent(FULL_PLAYBACK_NOTICE_EVENT));
}

export function restoreFullPlaybackNotice(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FULL_PLAYBACK_NOTICE_DISMISSED_KEY);
  } catch {
    /* noop */
  }

  window.dispatchEvent(new CustomEvent(FULL_PLAYBACK_NOTICE_EVENT));
}

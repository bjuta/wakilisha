import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    MusicKit?: any;
  }
}

let scriptPromise: Promise<void> | null = null;
let developerTokenPromise: Promise<string> | null = null;
let configuredDeveloperToken: string | null = null;

function loadMusicKitScript(): Promise<void> {
  if (window.MusicKit) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src*="musickit"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load MusicKit JS")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load MusicKit JS"));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

async function getDeveloperToken(): Promise<string> {
  if (!developerTokenPromise) {
    developerTokenPromise = supabase.functions
      .invoke<{ developerToken?: string | null; configured?: boolean; error?: string }>("apple-music-token", {})
      .then(({ data, error }) => {
        if (error) throw new Error(error.message || "Failed to get Apple Music developer token");
        if (data?.configured === false) throw new Error(data.error || "Apple Music is not configured.");
        if (!data?.developerToken) throw new Error(data?.error || "No Apple Music developer token returned");
        return data.developerToken;
      });
  }

  return developerTokenPromise;
}

export async function getAuthorizedMusicKit(userToken?: string | null): Promise<any> {
  await loadMusicKitScript();

  const MusicKit = window.MusicKit;
  if (!MusicKit) throw new Error("MusicKit unavailable after script load");

  const developerToken = await getDeveloperToken();

  if (configuredDeveloperToken !== developerToken) {
    await MusicKit.configure({
      developerToken,
      app: {
        name: "WAKILISHA",
        build: "1.0.0",
      },
    });
    configuredDeveloperToken = developerToken;
  }

  const music = MusicKit.getInstance();

  if (userToken) {
    try {
      music.musicUserToken = userToken;
    } catch {
      // MusicKit may manage this internally after authorize().
    }
  }

  if (!music.musicUserToken && !music.isAuthorized) {
    await music.authorize();
  }

  return music;
}

export function getExistingMusicKit(): any | null {
  try {
    if (!window.MusicKit) return null;
    return window.MusicKit.getInstance?.() || null;
  } catch {
    return null;
  }
}

export async function playAppleMusicCatalogSong(catalogId: string, userToken?: string | null): Promise<void> {
  const music = await getAuthorizedMusicKit(userToken);

  try {
    await music.setQueue({ songs: [catalogId] });
  } catch {
    await music.setQueue({ song: catalogId });
  }

  await music.play();
}

export async function pauseAppleMusic(): Promise<void> {
  const music = getExistingMusicKit();
  if (music?.pause) await music.pause();
}

export async function resumeAppleMusic(): Promise<void> {
  const music = getExistingMusicKit();
  if (music?.play) await music.play();
}

export async function seekAppleMusic(seconds: number): Promise<void> {
  const music = getExistingMusicKit();
  if (music?.seekToTime) {
    await music.seekToTime(seconds);
  } else if (music?.player?.seekToTime) {
    await music.player.seekToTime(seconds);
  }
}

export function getAppleMusicPlaybackSnapshot(): {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
} | null {
  const music = getExistingMusicKit();
  if (!music) return null;

  const player = music.player || music;

  const currentTime = Number(
    music.currentPlaybackTime ??
    player.currentPlaybackTime ??
    0
  );

  const duration = Number(
    music.currentPlaybackDuration ??
    player.currentPlaybackDuration ??
    0
  );

  const isPlaying = Boolean(
    music.isPlaying ??
    player.isPlaying ??
    false
  );

  return { currentTime, duration, isPlaying };
}

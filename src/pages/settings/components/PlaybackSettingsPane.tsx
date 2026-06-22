import { useState } from "react";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import type { UserPlaybackPrefs } from "@/hooks/useUserSettings";
import { supabase } from "@/lib/supabase";

interface Props {
  playback: UserPlaybackPrefs;
  isSignedIn: boolean;
  updatePlayback: (patch: Partial<UserPlaybackPrefs>) => void;
}

interface AppleMusicTokenResponse {
  developerToken?: string | null;
  configured?: boolean;
  error?: string;
}

export function PlaybackSettingsPane({ playback, isSignedIn, updatePlayback }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnectAppleMusic = async () => {
    if (!isSignedIn) return;
    setConnecting(true);
    setConnectError(null);

    try {
      // Request a developer token from the edge function
      const { data, error } = await supabase.functions.invoke<AppleMusicTokenResponse>("apple-music-token", {});

      if (error) throw new Error(error.message || "Failed to get developer token");
      if (data?.configured === false) {
        throw new Error(data.error || "Apple Music is not configured yet.");
      }

      const devToken = data?.developerToken;
      if (!devToken) throw new Error(data?.error || "No developer token returned");

      // Initialize MusicKit on the client
      if (!(window as any).MusicKit) {
        // Load MusicKit JS dynamically
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
      if (!MusicKit) throw new Error("MusicKit not available after loading");

      // Configure MusicKit instance
      await MusicKit.configure({
        developerToken: devToken,
        app: {
          name: "WAKILISHA",
          build: "1.0.0",
        },
      });

      // Authorize the user
      const musicKitInstance = MusicKit.getInstance();
      const userToken = await musicKitInstance.authorize();

      if (userToken) {
        updatePlayback({
          appleMusicConnected: true,
          appleMusicToken: userToken,
          preferApplePreviews: true,
        });
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
    updatePlayback({
      appleMusicConnected: false,
      appleMusicToken: null,
      preferApplePreviews: false,
    });
  };

  return (
    <div>
      {/* Apple Music connection */}
      <div className="mb-7 p-5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--wk-surface-raised)]">
            <i className="ri-apple-fill text-xl text-[var(--wk-text)]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[var(--wk-text)]">Apple Music</h3>
            <p className="text-[11px] text-[var(--wk-text-muted)]">
              {playback.appleMusicConnected
                ? "Your Apple Music account is connected. Full track playback is enabled."
                : "Connect your Apple Music account for full-length track playback across the platform."}
            </p>
          </div>
        </div>

        {playback.appleMusicConnected ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-success)]">
              <i className="ri-checkbox-circle-fill text-sm" /> Connected
            </span>
            <button
              onClick={handleDisconnectAppleMusic}
              className="text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-danger)] cursor-pointer transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={handleConnectAppleMusic}
              disabled={connecting || !isSignedIn}
              className="inline-flex items-center gap-2 h-[38px] px-5 rounded-lg text-xs font-bold bg-[var(--wk-brand)] text-[var(--wk-brand-on)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? (
                <>
                  <i className="ri-loader-4-line animate-spin" /> Connecting...
                </>
              ) : (
                <>
                  <i className="ri-apple-fill" /> Connect Apple Music
                </>
              )}
            </button>
            {connectError && <p className="text-[11px] text-[var(--wk-danger)] mt-2">{connectError}</p>}
            {!isSignedIn && (
              <p className="text-[11px] text-[var(--wk-text-faint)] mt-2">Sign in to connect your Apple Music account.</p>
            )}
          </div>
        )}
      </div>

      {/* Playback options */}
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)]">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Autoplay next track</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Continue through chart editions and playlist queues automatically.</div>
        </div>
        <WakilishaToggle value={playback.autoplay} onChange={(v) => updatePlayback({ autoplay: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)]">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Explicit content filter</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Hide tracks marked explicit from public or family-safe modes.</div>
        </div>
        <WakilishaToggle value={playback.explicitFilter} onChange={(v) => updatePlayback({ explicitFilter: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Prefer Apple Music previews</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">When connected, prioritize full Apple Music playback over YouTube embeds for better quality.</div>
        </div>
        <WakilishaToggle value={playback.preferApplePreviews} onChange={(v) => updatePlayback({ preferApplePreviews: v })} />
      </div>

      {/* Playback quality */}
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Playback quality</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">
            Choose the default stream quality for embedded and source playback.
          </div>
        </div>
        <select
          className="h-[38px] px-4 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text)] text-sm font-bold focus:outline-none focus:border-[var(--wk-brand)] cursor-pointer shrink-0"
          value={playback.playbackQuality}
          onChange={(e) => updatePlayback({ playbackQuality: e.target.value as UserPlaybackPrefs["playbackQuality"] })}
        >
          <option>Auto</option>
          <option>High</option>
          <option>Data saver</option>
        </select>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  dismissFullPlaybackNotice,
  FULL_PLAYBACK_NOTICE_EVENT,
  isAppleMusicPlaybackConnected,
  isFullPlaybackNoticeDismissed,
} from "@/services/playback/fullPlaybackNotice";

export function PlaybackAccessNotice({
  hasApplePlayback,
  className = "",
  compact = false,
}: {
  hasApplePlayback: boolean;
  className?: string;
  compact?: boolean;
}) {
  const { playback } = useUserSettings();
  const [dismissed, setDismissed] = useState(() => isFullPlaybackNoticeDismissed());

  useEffect(() => {
    const sync = () => setDismissed(isFullPlaybackNoticeDismissed());
    window.addEventListener(FULL_PLAYBACK_NOTICE_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("wk-playback-changed", sync);
    window.addEventListener("wk-apple-music-connected", sync);

    return () => {
      window.removeEventListener(FULL_PLAYBACK_NOTICE_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("wk-playback-changed", sync);
      window.removeEventListener("wk-apple-music-connected", sync);
    };
  }, []);

  if (!hasApplePlayback || dismissed || isAppleMusicPlaybackConnected(playback)) return null;

  return (
    <div
      className={[
        "relative rounded-2xl border border-[var(--wk-brand)]/25 bg-[var(--wk-brand)]/10 text-[var(--wk-text-soft)]",
        compact ? "px-3 py-2.5 text-[11px]" : "px-4 py-3 text-[12px]",
        className,
      ].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)]/15 text-[var(--wk-brand)]">
          <WkIcon name="Music" size={14} />
        </span>
        <div className="min-w-0">
          <div className="font-black text-[var(--wk-brand)]">Full tracks available</div>
          <div className="mt-0.5 font-semibold leading-snug">
            Connect Apple Music from the player when you want full playback. This will stay available in Alerts.
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={dismissFullPlaybackNotice}
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface)] hover:text-[var(--wk-text)]"
        aria-label="Hide full playback notice"
        title="Hide notice"
      >
        <WkIcon name="X" size={14} />
      </button>
    </div>
  );
}

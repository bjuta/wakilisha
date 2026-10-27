import { useCallback, useEffect, useState } from "react";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import { WkSlider } from "@/components/design-system/primitives/Slider";
import type { UserPlaybackPrefs } from "@/hooks/useUserSettings";

export type PlaybackControlPrefs = Pick<
  UserPlaybackPrefs,
  "autoplay" | "crossfade" | "crossfadeSeconds" | "keepAlbumsGapless"
>;

export const PLAYBACK_CONTROL_DEFAULTS: PlaybackControlPrefs = {
  autoplay: true,
  crossfade: false,
  crossfadeSeconds: 6,
  keepAlbumsGapless: true,
};

const STORAGE_KEY = "wk-playback-v2";

export function readPlaybackControls(): PlaybackControlPrefs {
  if (typeof window === "undefined") return PLAYBACK_CONTROL_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return PLAYBACK_CONTROL_DEFAULTS;
    const stored = JSON.parse(raw) as Partial<PlaybackControlPrefs>;
    return {
      autoplay: stored.autoplay !== false,
      crossfade: stored.crossfade === true,
      crossfadeSeconds: Number.isFinite(stored.crossfadeSeconds)
        ? Math.max(3, Math.min(12, Math.round(stored.crossfadeSeconds!))) : 6,
      keepAlbumsGapless: stored.keepAlbumsGapless !== false,
    };
  } catch {
    return PLAYBACK_CONTROL_DEFAULTS;
  }
}

export function updatePlaybackControls(patch: Partial<PlaybackControlPrefs>): void {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    const saved = existing ? JSON.parse(existing) : {};
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...saved,
      ...readPlaybackControls(),
      ...patch,
    }));
    window.dispatchEvent(new CustomEvent("wk-playback-changed"));
  } catch {
    // Keep playback usable when local storage is unavailable.
  }
}

export function usePlaybackControls() {
  const [playback, setPlayback] = useState(readPlaybackControls);
  useEffect(() => {
    const sync = () => setPlayback(readPlaybackControls());
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync();
    };
    window.addEventListener("wk-playback-changed", sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("wk-playback-changed", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const updatePlayback = useCallback((patch: Partial<PlaybackControlPrefs>) => {
    updatePlaybackControls(patch);
    setPlayback(readPlaybackControls());
  }, []);
  return { playback, updatePlayback };
}

function clampFade(seconds: number): number {
  return Math.max(3, Math.min(12, Math.round(seconds)));
}

function PlaybackToggleRow({
  label, detail, checked, disabled, onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-4 border-b border-[var(--wk-divider)] py-3.5 ${disabled ? "opacity-40" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-[var(--wk-text)]">{label}</div>
        {detail && <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">{detail}</div>}
      </div>
      <span className={disabled ? "pointer-events-none" : ""}>
        <WakilishaToggle
          value={checked}
          disabled={disabled}
          ariaLabel={label}
          onChange={onChange}
        />
      </span>
    </div>
  );
}

export function PlaybackSettingsControls({
  playback,
  updatePlayback,
}: {
  playback: PlaybackControlPrefs;
  updatePlayback: (patch: Partial<PlaybackControlPrefs>) => void;
}) {
  return (
    <div aria-label="Listening" className="space-y-0">
      <div className="pt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-muted)]">Listening</div>
      <PlaybackToggleRow
        label="Continuous playback"
        detail="Keep playing tracks in the current collection."
        checked={playback.autoplay}
        onChange={(autoplay) => updatePlayback({ autoplay })}
      />
      <PlaybackToggleRow
        label="Crossfade"
        detail="Fade between tracks when supported."
        checked={playback.crossfade}
        onChange={(crossfade) => updatePlayback({ crossfade, ...(crossfade ? { keepAlbumsGapless: false } : {}) })}
      />
      <div className={`border-b border-[var(--wk-divider)] py-4 ${!playback.crossfade ? "opacity-40" : ""}`}>
        <div className="flex items-center justify-between gap-3 text-[13px] font-bold text-[var(--wk-text)]">
          <span>Crossfade duration</span>
          <span className="tabular-nums">{clampFade(playback.crossfadeSeconds)} seconds</span>
        </div>
        <WkSlider
          value={clampFade(playback.crossfadeSeconds)}
          onChange={(crossfadeSeconds) => updatePlayback({ crossfadeSeconds })}
          min={3}
          max={12}
          step={1}
          disabled={!playback.crossfade}
          ariaLabel="Crossfade duration"
          showValueLabel={false}
          className="mt-3"
          formatValue={(value) => `${value} seconds`}
        />
        <div className="mt-1 flex justify-between text-[10px] text-[var(--wk-text-muted)]">
          <span>3 sec</span><span>6</span><span>9</span><span>12 sec</span>
        </div>
      </div>
      <PlaybackToggleRow
        label="Keep albums gapless"
        detail="No crossfade on albums or EPs played in order."
        checked={playback.keepAlbumsGapless}
        onChange={(keepAlbumsGapless) => updatePlayback({ keepAlbumsGapless })}
      />
      <div className="border-b border-[var(--wk-divider)] py-3.5">
        <div className="text-[14px] font-bold text-[var(--wk-text)]">Next after queue</div>
        <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Playback stops at the end unless Repeat is on.</div>
      </div>
    </div>
  );
}

export function PlaybackMoreControls({
  playback,
  updatePlayback,
  unavailableReason,
}: {
  playback: PlaybackControlPrefs;
  updatePlayback: (patch: Partial<PlaybackControlPrefs>) => void;
  unavailableReason?: string | null;
}) {
  const unavailable = Boolean(unavailableReason);
  const step = (change: number) =>
    updatePlayback({ crossfadeSeconds: clampFade(playback.crossfadeSeconds + change) });
  return (
    <div aria-label="Playback" className="space-y-0">
      <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-muted)]">Playback</div>
      <PlaybackToggleRow
        label="Continuous playback"
        checked={playback.autoplay}
        onChange={(autoplay) => updatePlayback({ autoplay })}
      />
      <PlaybackToggleRow
        label="Crossfade"
        detail={unavailableReason || (playback.keepAlbumsGapless ? "Albums and EPs play gaplessly in order." : undefined)}
        checked={playback.crossfade}
        disabled={unavailable}
        onChange={(crossfade) => updatePlayback({ crossfade, ...(crossfade ? { keepAlbumsGapless: false } : {}) })}
      />
      <div className={`flex items-center justify-end gap-3 py-2 ${!playback.crossfade || unavailable ? "opacity-40" : ""}`}>
        <button type="button" aria-label="Reduce crossfade" onClick={() => step(-1)}
          disabled={!playback.crossfade || unavailable || playback.crossfadeSeconds <= 3}
          className="h-9 w-9 rounded-full border border-[var(--wk-border)] text-[var(--wk-text)] disabled:cursor-not-allowed">−</button>
        <span className="min-w-12 text-center text-[13px] font-bold tabular-nums text-[var(--wk-text)]">{clampFade(playback.crossfadeSeconds)} s</span>
        <button type="button" aria-label="Increase crossfade" onClick={() => step(1)}
          disabled={!playback.crossfade || unavailable || playback.crossfadeSeconds >= 12}
          className="h-9 w-9 rounded-full border border-[var(--wk-border)] text-[var(--wk-text)] disabled:cursor-not-allowed">+</button>
      </div>
      <PlaybackToggleRow
        label="Keep albums gapless"
        detail="No crossfade on albums or EPs played in order."
        checked={playback.keepAlbumsGapless}
        onChange={(keepAlbumsGapless) => updatePlayback({ keepAlbumsGapless })}
      />
    </div>
  );
}

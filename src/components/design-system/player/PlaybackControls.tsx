import { useCallback, useEffect, useState } from "react";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import { WkSlider } from "@/components/design-system/primitives/Slider";
import type { UserPlaybackPrefs } from "@/hooks/useUserSettings";
import { WkIcon } from "@/components/design-system/Icon";

export type PlaybackControlPrefs = Pick<
  UserPlaybackPrefs,
  "autoplay" | "crossfade" | "crossfadeSeconds" | "smartMix"
>;

export const PLAYBACK_CONTROL_DEFAULTS: PlaybackControlPrefs = {
  autoplay: true,
  crossfade: false,
  crossfadeSeconds: 6,
  smartMix: false,
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
      smartMix: stored.crossfade === true && stored.smartMix === true,
    };
  } catch {
    return PLAYBACK_CONTROL_DEFAULTS;
  }
}

export function updatePlaybackControls(patch: Partial<PlaybackControlPrefs>): void {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    const saved = existing ? JSON.parse(existing) : {};
    const { keepAlbumsGapless: legacy, ...rest } = saved;
    void legacy;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...rest, ...readPlaybackControls(), ...patch,
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


type TransitionMode = "off" | "crossfade" | "smart";
function getMode(playback: PlaybackControlPrefs): TransitionMode {
  return !playback.crossfade ? "off" : playback.smartMix ? "smart" : "crossfade";
}
function modeLabel(playback: PlaybackControlPrefs): string {
  const mode = getMode(playback);
  return mode === "off" ? "Off" : mode === "smart" ? "Smart Mix" : `Crossfade · ${clampFade(playback.crossfadeSeconds)} s`;
}
function setMode(mode: TransitionMode, update: (v: Partial<PlaybackControlPrefs>) => void) {
  update({ crossfade: mode !== "off", smartMix: mode === "smart" });
}
function HelpTip({ label, text }: { label: string; text: string }) {
  return (
    <details className="group relative inline-flex align-middle">
      <summary aria-label={`About ${label}`} className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-[var(--wk-text-muted)] focus-visible:outline focus-visible:outline-2">
        <WkIcon name="Info" size={16} aria-hidden="true" />
      </summary>
      <span role="note" className="absolute bottom-full right-0 z-50 mb-2 w-[min(75vw,255px)] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[12px] font-normal leading-relaxed text-[var(--wk-text)] shadow-lg">
        {text}
      </span>
    </details>
  );
}
function TransitionOptions({ playback, updatePlayback, unavailableReason }: {
  playback: PlaybackControlPrefs;
  updatePlayback: (patch: Partial<PlaybackControlPrefs>) => void;
  unavailableReason?: string | null;
}) {
  const mode = getMode(playback);
  const choices: { key: TransitionMode; label: string; description: string }[] = [
    { key: "off", label: "Off", description: "Play recordings as they are." },
    { key: "crossfade", label: "Crossfade", description: "Overlap tracks for a set duration." },
    { key: "smart", label: "Smart Mix", description: "Match compatible rhythms; otherwise blend naturally." },
  ];
  return (
    <div className="border-b border-[var(--wk-divider)] px-1 pb-4">
      <div role="radiogroup" aria-label="Transitions" className="space-y-1 py-2">
        {choices.map((choice) => (
          <button key={choice.key} type="button" role="radio" aria-checked={mode === choice.key}
            disabled={Boolean(unavailableReason) && choice.key !== "off"}
            onClick={() => setMode(choice.key, updatePlayback)}
            className="flex min-h-12 w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-[var(--wk-bg-subtle)] focus-visible:outline focus-visible:outline-2 disabled:opacity-40">
            <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)]">
              {mode === choice.key && <span className="h-2 w-2 rounded-full bg-[var(--wk-brand)]" />}
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold text-[var(--wk-text)]">
              {choice.label}
              {choice.key === "smart" && <HelpTip label="Smart Mix" text="Matches nearby tempos when analysis is reliable; otherwise uses a natural blend." />}
              <span className="block text-[12px] font-normal text-[var(--wk-text-muted)]">{choice.description}</span>
            </span>
          </button>
        ))}
      </div>
      {unavailableReason && <span className="text-[12px] text-[var(--wk-text-muted)]">{unavailableReason}</span>}
      {mode === "crossfade" && !unavailableReason && (
        <div className="px-2 pt-3">
          <div className="flex items-center justify-between text-[13px] font-bold text-[var(--wk-text)]">
            <span>Crossfade duration</span>
            <span className="tabular-nums">{clampFade(playback.crossfadeSeconds)} seconds</span>
          </div>
          <WkSlider value={clampFade(playback.crossfadeSeconds)}
            onChange={(crossfadeSeconds) => updatePlayback({ crossfadeSeconds })}
            min={3} max={12} step={1} ariaLabel="Crossfade duration"
            showValueLabel={false} className="mt-3" formatValue={(value) => `${value} seconds`} />
          <div className="flex justify-between text-[10px] text-[var(--wk-text-muted)]">
            <span>3 sec</span><span>6</span><span>9</span><span>12 sec</span>
          </div>
        </div>
      )}
    </div>
  );
}
function TransitionDisclosure({ playback, updatePlayback, unavailableReason, id }: {
  playback: PlaybackControlPrefs;
  updatePlayback: (patch: Partial<PlaybackControlPrefs>) => void;
  unavailableReason?: string | null; id: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={expanded} aria-controls={id}
        onClick={() => setExpanded((previous) => !previous)}
        className="flex min-h-14 w-full items-center justify-between border-b border-[var(--wk-divider)] py-3 text-left text-[14px] font-bold text-[var(--wk-text)]">
        <span>Transitions</span>
        <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          {modeLabel(playback)}
          <WkIcon name={expanded ? "ChevronDown" : "ChevronRight"} size={18} aria-hidden="true" />
        </span>
      </button>
      {expanded && <div id={id}><TransitionOptions playback={playback} updatePlayback={updatePlayback} unavailableReason={unavailableReason} /></div>}
    </div>
  );
}
export function PlaybackSettingsControls({ playback, updatePlayback }: {
  playback: PlaybackControlPrefs;
  updatePlayback: (patch: Partial<PlaybackControlPrefs>) => void;
}) {
  const [queueExpanded, setQueueExpanded] = useState(false);
  return (
    <div aria-label="Listening" className="space-y-0">
      <div className="pt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-muted)]">Listening</div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center text-[14px] font-bold text-[var(--wk-text)]">
            Continuous playback
            <HelpTip label="Continuous playback" text="Keep playing tracks in the current collection." />
          </div>
        </div>
        <WakilishaToggle value={playback.autoplay} ariaLabel="Continuous playback" onChange={(autoplay) => updatePlayback({ autoplay })} />
      </div>
      <TransitionDisclosure playback={playback} updatePlayback={updatePlayback} id="wk-setting-transitions" />
      <button type="button" aria-expanded={queueExpanded} aria-controls="wk-setting-queue"
        onClick={() => setQueueExpanded((previous) => !previous)}
        className="flex min-h-14 w-full items-center justify-between border-b border-[var(--wk-divider)] py-3 text-left text-[14px] font-bold text-[var(--wk-text)]">
        <span>Queue</span>
        <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          Stop at end <WkIcon name={queueExpanded ? "ChevronDown" : "ChevronRight"} size={18} aria-hidden="true" />
        </span>
      </button>
      {queueExpanded && <p id="wk-setting-queue" className="border-b border-[var(--wk-divider)] py-3 text-[12px] text-[var(--wk-text-muted)]">Playback stops at the end of the queue unless Repeat is on.</p>}
    </div>
  );
}
export function PlaybackMoreControls({ playback, updatePlayback, unavailableReason }: {
  playback: PlaybackControlPrefs;
  updatePlayback: (patch: Partial<PlaybackControlPrefs>) => void;
  unavailableReason?: string | null;
}) {
  return (
    <div aria-label="Playback" className="space-y-0">
      <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-muted)]">Playback</div>
      <PlaybackToggleRow label="Continuous playback" checked={playback.autoplay}
        onChange={(autoplay) => updatePlayback({ autoplay })} />
      <TransitionDisclosure playback={playback} updatePlayback={updatePlayback}
        unavailableReason={unavailableReason} id="wk-more-transitions" />
    </div>
  );
}

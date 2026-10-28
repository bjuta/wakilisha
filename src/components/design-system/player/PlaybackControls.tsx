import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
/** A bounded, dismissible popover. Portalled outside transformed mobile sheets. */
function HelpTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 248 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const positionInsideViewport = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const view = window.visualViewport;
      const leftEdge = view?.offsetLeft ?? 0;
      const topEdge = view?.offsetTop ?? 0;
      const widthAvailable = view?.width ?? window.innerWidth;
      const heightAvailable = view?.height ?? window.innerHeight;
      const width = Math.min(260, Math.max(120, widthAvailable - 24));
      const tooltipHeight = popupRef.current?.getBoundingClientRect().height ?? 100;
      const left = Math.min(leftEdge + widthAvailable - width - 12,
        Math.max(leftEdge + 12, rect.left + rect.width / 2 - width / 2));
      const above = rect.top - tooltipHeight - 10;
      const top = above >= topEdge + 12 ? above
        : Math.min(topEdge + heightAvailable - tooltipHeight - 12, rect.bottom + 10);
      setPosition({ left: Math.round(left), top: Math.round(Math.max(topEdge + 12, top)), width });
    };
    positionInsideViewport();
    const onOutsideClick = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node) ||
          popupRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onOutsideClick, true);
    document.addEventListener("keydown", onEscape, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", positionInsideViewport);
    window.visualViewport?.addEventListener("resize", positionInsideViewport);
    return () => {
      document.removeEventListener("pointerdown", onOutsideClick, true);
      document.removeEventListener("keydown", onEscape, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", positionInsideViewport);
      window.visualViewport?.removeEventListener("resize", positionInsideViewport);
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" aria-label={`About ${label}`}
        aria-expanded={open} aria-controls={open ? tooltipId : undefined}
        onClick={(event) => { event.stopPropagation(); setOpen((previous) => !previous); }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-muted)] focus-visible:outline focus-visible:outline-2">
        <WkIcon name="Info" size={17} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={popupRef} id={tooltipId} role="note"
          style={{ position: "fixed", left: position.left, top: position.top,
            width: position.width, maxHeight: "min(200px, calc(100dvh - 24px))",
            overflowY: "auto", zIndex: 2147483000 }}
          className="box-border rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-left text-[12px] font-normal leading-relaxed text-[var(--wk-text)] shadow-lg">
          {text}
        </div>, document.body)}
    </>
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
          <div key={choice.key} className={`min-w-0 rounded-xl ${
            mode === choice.key ? "bg-[var(--wk-bg-subtle)]" : "hover:bg-[var(--wk-bg-subtle)]"
          }`}>
            <div className="flex min-w-0 items-center">
              <button type="button" role="radio" aria-checked={mode === choice.key}
                disabled={Boolean(unavailableReason) && choice.key !== "off"}
                onClick={() => setMode(choice.key, updatePlayback)}
                className="flex min-h-12 min-w-0 flex-1 items-start gap-3 rounded-lg p-2 text-left focus-visible:outline focus-visible:outline-2 disabled:opacity-40">
                <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)]">
                  {mode === choice.key && <span className="h-2 w-2 rounded-full bg-[var(--wk-brand)]" />}
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-bold text-[var(--wk-text)]">
                  {choice.label}
                  <span className="block text-[12px] font-normal text-[var(--wk-text-muted)]">{choice.description}</span>
                </span>
              </button>
              {choice.key === "smart" && <HelpTip label="Smart Mix" text="Matches nearby tempos when analysis is reliable; otherwise uses a natural blend." />}
            </div>
            {choice.key === "crossfade" && mode === "crossfade" && !unavailableReason && (
              <div role="group" aria-label="Crossfade duration settings" className="pb-3 pl-9 pr-3 pt-1">
                <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-[var(--wk-text)]">
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
        ))}
      </div>
      {unavailableReason && <span className="text-[12px] text-[var(--wk-text-muted)]">{unavailableReason}</span>}
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

import { WkIcon } from "@/components/design-system/Icon";

export function formatMediaTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

export function MediaTransport({
  playing,
  currentTime,
  duration,
  playbackRate,
  onToggle,
  onSeekBy,
  onPlaybackRateChange,
}: {
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onToggle: () => void;
  onSeekBy: (deltaSeconds: number) => void;
  onPlaybackRateChange: (rate: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-wk-border bg-wk-bg px-3 py-2">
      <button type="button" onClick={() => onSeekBy(-10)} className="wk-button wk-button-ghost wk-button-sm" aria-label="Back 10 seconds">
        <WkIcon name="RotateCcw" size={14} />10
      </button>
      <button type="button" onClick={onToggle} className="flex h-9 w-9 items-center justify-center rounded-full bg-wk-brand text-white" aria-label={playing ? "Pause" : "Play"}>
        <WkIcon name={playing ? "Pause" : "Play"} size={16} />
      </button>
      <button type="button" onClick={() => onSeekBy(10)} className="wk-button wk-button-ghost wk-button-sm" aria-label="Forward 10 seconds">
        10<WkIcon name="RotateCw" size={14} />
      </button>
      <span className="font-mono text-xs font-bold text-wk-text">
        {formatMediaTime(currentTime)}<span className="mx-1 text-wk-text-faint">/</span>{formatMediaTime(duration)}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
          <button key={rate} type="button" onClick={() => onPlaybackRateChange(rate)} className={`rounded-md px-2 py-1 text-[10px] font-black ${playbackRate === rate ? "bg-wk-brand-soft text-wk-brand" : "text-wk-text-muted hover:bg-wk-surface-raised"}`}>
            {rate}x
          </button>
        ))}
      </div>
    </div>
  );
}

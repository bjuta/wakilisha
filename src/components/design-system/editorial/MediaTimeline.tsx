import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatMediaTime } from "./MediaTransport";

export type TimelineAnchor =
  | { kind: "time_point"; startSeconds: number; endSeconds: null }
  | { kind: "time_range"; startSeconds: number; endSeconds: number };

export interface TimelineMarker {
  id: string;
  timeSeconds: number;
  label: string;
  status?: "open" | "resolved";
}

export interface TimelineChapter {
  id: string;
  timeSeconds: number;
  label: string;
}

interface WaveformPayload {
  version: number;
  duration_seconds: number | null;
  sample_rate: number;
  channels: number;
  peak_count: number;
  peaks: number[];
}

function downsample(values: number[], target = 280): number[] {
  if (values.length <= target) return values;
  return Array.from({ length: target }, (_, index) => {
    const start = Math.floor((index * values.length) / target);
    const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / target));
    return Math.max(...values.slice(start, end));
  });
}

export function MediaTimeline({
  waveformUrl,
  durationSeconds,
  currentTime,
  anchor,
  markers = [],
  chapters = [],
  interactive = true,
  onSeek,
  onAnchorChange,
}: {
  waveformUrl?: string | null;
  durationSeconds?: number | null;
  currentTime: number;
  anchor?: TimelineAnchor | null;
  markers?: TimelineMarker[];
  chapters?: TimelineChapter[];
  interactive?: boolean;
  onSeek?: (seconds: number) => void;
  onAnchorChange?: (anchor: TimelineAnchor) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [waveform, setWaveform] = useState<WaveformPayload | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [draftAnchor, setDraftAnchor] = useState<TimelineAnchor | null>(null);

  useEffect(() => {
    let alive = true;
    if (!waveformUrl) {
      setWaveform(null);
      return;
    }
    fetch(waveformUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Waveform could not load");
        return response.json() as Promise<WaveformPayload>;
      })
      .then((payload) => {
        if (alive) setWaveform(payload);
      })
      .catch(() => {
        if (alive) setWaveform(null);
      });
    return () => {
      alive = false;
    };
  }, [waveformUrl]);

  const peaks = useMemo(() => downsample(waveform?.peaks ?? []), [waveform?.peaks]);
  const duration = Math.max(Number(durationSeconds ?? waveform?.duration_seconds ?? 0), 0);
  const position = (seconds: number) => duration > 0
    ? `${Math.min(100, Math.max(0, (seconds / duration) * 100))}%`
    : "0%";

  const timeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const commitAnchor = (startSeconds: number, endSeconds: number) => {
    const low = Math.min(startSeconds, endSeconds);
    const high = Math.max(startSeconds, endSeconds);
    const next: TimelineAnchor = high - low >= 0.25
      ? { kind: "time_range", startSeconds: low, endSeconds: high }
      : { kind: "time_point", startSeconds: low, endSeconds: null };
    setDraftAnchor(null);
    onAnchorChange?.(next);
    onSeek?.(next.startSeconds);
  };

  const displayedAnchor = draftAnchor ?? anchor ?? null;

  return (
    <div className="space-y-2">
      <div
        ref={railRef}
        className={`relative h-36 overflow-hidden rounded-xl border border-wk-border bg-wk-bg ${interactive ? "cursor-crosshair touch-none" : ""}`}
        onPointerDown={(event) => {
          if (!interactive || duration <= 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const time = timeFromPointer(event);
          setDragStart(time);
          setDraftAnchor({ kind: "time_point", startSeconds: time, endSeconds: null });
        }}
        onPointerMove={(event) => {
          if (!interactive || dragStart === null) return;
          const time = timeFromPointer(event);
          const low = Math.min(dragStart, time);
          const high = Math.max(dragStart, time);
          setDraftAnchor(high - low >= 0.25
            ? { kind: "time_range", startSeconds: low, endSeconds: high }
            : { kind: "time_point", startSeconds: low, endSeconds: null });
        }}
        onPointerUp={(event) => {
          if (!interactive || dragStart === null) return;
          commitAnchor(dragStart, timeFromPointer(event));
          setDragStart(null);
        }}
      >
        <div className="absolute inset-x-3 bottom-7 top-3 flex items-end gap-[1px]">
          {peaks.length ? peaks.map((peak, index) => (
            <span
              key={index}
              className="min-w-[1px] flex-1 rounded-t bg-wk-brand/55"
              style={{ height: `${Math.max(4, Math.round(peak * 100))}%` }}
            />
          )) : (
            <div className="m-auto text-xs text-wk-text-muted">
              {waveformUrl ? "Waveform preview unavailable." : "No canonical waveform yet."}
            </div>
          )}
        </div>

        {displayedAnchor?.kind === "time_range" ? (
          <div
            className="absolute bottom-6 top-2 rounded bg-wk-brand/20 ring-1 ring-wk-brand/50"
            style={{
              left: position(displayedAnchor.startSeconds),
              width: `${Math.max(0.3, ((displayedAnchor.endSeconds - displayedAnchor.startSeconds) / Math.max(duration, 1)) * 100)}%`,
            }}
          />
        ) : displayedAnchor ? (
          <div className="absolute bottom-6 top-2 w-0.5 bg-wk-brand" style={{ left: position(displayedAnchor.startSeconds) }} />
        ) : null}

        {chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="absolute bottom-0 top-2 w-px bg-wk-warning/60"
            style={{ left: position(chapter.timeSeconds) }}
            title={`${chapter.label} · ${formatMediaTime(chapter.timeSeconds)}`}
          >
            <span className="absolute bottom-1 left-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-wk-warning" />
          </div>
        ))}

        {markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSeek?.(marker.timeSeconds);
            }}
            className={`absolute top-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-wk-bg ${marker.status === "resolved" ? "bg-wk-success" : "bg-wk-brand"}`}
            style={{ left: position(marker.timeSeconds) }}
            title={`${marker.label} · ${formatMediaTime(marker.timeSeconds)}`}
          />
        ))}

        <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-wk-text" style={{ left: position(currentTime) }} />
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold text-wk-text-faint">
        <span>0:00</span>
        {displayedAnchor ? (
          <span className="text-wk-brand">
            {displayedAnchor.kind === "time_range"
              ? `${formatMediaTime(displayedAnchor.startSeconds)}–${formatMediaTime(displayedAnchor.endSeconds)}`
              : `At ${formatMediaTime(displayedAnchor.startSeconds)}`}
          </span>
        ) : (
          <span>{interactive ? "Click for a point · drag for a range" : "Canonical waveform"}</span>
        )}
        <span>{formatMediaTime(duration)}</span>
      </div>
    </div>
  );
}

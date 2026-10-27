/** Workbook Chapter 25. A transition must be eligible before the audio engine schedules it. */
export interface PreviewCrossfadeRequest {
  enabled: boolean;
  continuousPlayback: boolean;
  selectedSeconds: number;
  sourceEntityType?: string | null;
  shuffled: boolean;
  repeatOne: boolean;
  automatic: boolean;
  backend: "audio" | "apple" | "youtube" | "soundcloud";
  nextPrefersApple: boolean;
  currentPreviewUrl?: string | null;
  nextPreviewUrl?: string | null;
  currentDuration: number;
  nextDuration: number;
}

/** 0 means a clean, non-overlapping transition. */
export function resolvePreviewCrossfadeSeconds(req: PreviewCrossfadeRequest): number {
  if (!req.enabled || !req.continuousPlayback || !req.automatic || req.repeatOne) return 0;
  if (req.backend !== "audio" || req.nextPrefersApple) return 0;
  if (!req.currentPreviewUrl || !req.nextPreviewUrl) return 0;
  if (!Number.isFinite(req.currentDuration) || !Number.isFinite(req.nextDuration)) return 0;
  if (req.currentDuration <= 0 || req.nextDuration <= 0) return 0;
  const quarterOfShorter = Math.floor(Math.min(req.currentDuration, req.nextDuration) / 4);
  const selected = Number.isFinite(req.selectedSeconds)
    ? Math.min(12, Math.max(3, Math.round(req.selectedSeconds))) : 6;
  return Math.max(0, Math.min(selected, quarterOfShorter));
}

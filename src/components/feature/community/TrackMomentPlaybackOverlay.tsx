import { useEffect, useMemo, useRef, useState } from "react";
import {
  getOrCreateThread,
  getThreadByEntity,
  getTrackMomentComments,
  type CommunityComment,
  type CommunityEntity,
} from "@/services/community";
import type { PlayerTrack } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";

type PlaybackMoment = {
  id: string;
  anchorTimeMs: number;
  anchorLabel: string;
  bodyPreview: string;
  authorName: string;
  score: number;
  reactionCount: number;
  replyCount: number;
};

function formatMomentTimeFromMs(ms: number): string {
  const safe = Math.max(0, Math.floor((ms || 0) / 1000));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function truncateMoment(text: string, max = 86): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function stableTrackSlug(track: PlayerTrack): string {
  const slug = String(track.trackSlug || track.id || "").trim();

  if (!slug) return "";
  if (slug.startsWith("chart-entry-")) return "";

  return slug;
}

function buildTrackEntity(track: PlayerTrack): CommunityEntity | null {
  const trackSlug = stableTrackSlug(track);
  if (!trackSlug) return null;

  const url = track.artistSlug
    ? `/tracks/${track.artistSlug}/${trackSlug}`
    : `/tracks/${trackSlug}`;

  return {
    type: "track",
    id: trackSlug,
    slug: trackSlug,
    url,
    title: track.title,
    subtitle: track.artist,
    imageUrl: track.artworkUrl || null,
  };
}

function commentRank(comment: CommunityComment): number {
  return (
    Number(comment.score || 0) * 2 +
    Number(comment.reactionCount || 0) * 2 +
    Number(comment.replyCount || 0) +
    Number(comment.upvoteCount || 0) +
    (comment.isEditorPick ? 20 : 0) +
    (comment.isPinned ? 12 : 0)
  );
}

function commentToMoment(comment: CommunityComment): PlaybackMoment | null {
  if (comment.anchorTimeMs == null) return null;

  const body = comment.bodyPlain || comment.bodyMarkdown || "";
  if (!body.trim()) return null;

  return {
    id: comment.id,
    anchorTimeMs: Math.max(0, Number(comment.anchorTimeMs) || 0),
    anchorLabel: comment.anchorLabel || formatMomentTimeFromMs(comment.anchorTimeMs),
    bodyPreview: truncateMoment(body),
    authorName: comment.author?.displayName || comment.author?.username || "Community",
    score: commentRank(comment),
    reactionCount: Number(comment.reactionCount || 0),
    replyCount: Number(comment.replyCount || 0),
  };
}

function selectPlaybackMoments(comments: CommunityComment[], limit: number): PlaybackMoment[] {
  const bestByBucket = new Map<number, PlaybackMoment>();

  for (const comment of comments) {
    const moment = commentToMoment(comment);
    if (!moment) continue;

    const bucket = Math.floor(moment.anchorTimeMs / 5000) * 5000;
    const existing = bestByBucket.get(bucket);

    if (!existing || moment.score > existing.score) {
      bestByBucket.set(bucket, moment);
    }
  }

  return Array.from(bestByBucket.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.anchorTimeMs - b.anchorTimeMs;
    })
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .sort((a, b) => a.anchorTimeMs - b.anchorTimeMs);
}

export function TrackMomentPlaybackOverlay({
  track,
  currentTime,
  duration,
  isPlaying,
  enabled,
  limit = 10,
  onOpenMoment,
}: {
  track: PlayerTrack | null;
  currentTime: number;
  duration?: number;
  isPlaying: boolean;
  enabled: boolean;
  limit?: number;
  onOpenMoment: (anchorTimeMs: number) => void;
}) {
  const [moments, setMoments] = useState<PlaybackMoment[]>([]);
  const [activeMoment, setActiveMoment] = useState<PlaybackMoment | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(() => new Set());
  const clearTimerRef = useRef<number | null>(null);

  const trackKey = useMemo(() => {
    if (!track) return "";
    return [track.id, track.trackSlug, track.artistSlug, track.title].filter(Boolean).join(":");
  }, [track]);

  useEffect(() => {
    setMoments([]);
    setActiveMoment(null);
    setShownIds(new Set());

    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, [trackKey]);

  useEffect(() => {
    if (!enabled || !track || !trackKey) return;

    let cancelled = false;

    async function loadMoments() {
      try {
        const entity = buildTrackEntity(track);
        if (!entity) {
          setMoments([]);
          return;
        }

        const existingThread = await getThreadByEntity(entity.type, entity.id || undefined, entity.slug || undefined);
        const thread = existingThread || (await getOrCreateThread(entity)).thread;
        const comments = await getTrackMomentComments(thread.id, null, 0, 60);
        if (cancelled) return;

        setMoments(selectPlaybackMoments(comments, limit));
      } catch (err) {
        if (!cancelled) {
          console.warn("Could not load playback moments", err);
          setMoments([]);
        }
      }
    }

    loadMoments();

    return () => {
      cancelled = true;
    };
  }, [enabled, track, trackKey, limit]);

  useEffect(() => {
    if (!enabled || !isPlaying || moments.length === 0) return;

    const nowMs = Math.max(0, Math.round((currentTime || 0) * 1000));
    const nextMoment = moments.find((moment) => {
      if (shownIds.has(moment.id)) return false;
      return nowMs >= moment.anchorTimeMs - 750 && nowMs <= moment.anchorTimeMs + 2500;
    });

    if (!nextMoment) return;

    setActiveMoment(nextMoment);
    setShownIds((prev) => {
      const next = new Set(prev);
      next.add(nextMoment.id);
      return next;
    });

    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setActiveMoment((current) => current?.id === nextMoment.id ? null : current);
      clearTimerRef.current = null;
    }, 5200);
  }, [enabled, isPlaying, currentTime, moments, shownIds]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  if (!enabled || moments.length === 0) return null;

  const safeDurationMs = Math.max(1, Math.round((duration || track?.duration || 0) * 1000));
  const activePct = activeMoment
    ? Math.max(8, Math.min(92, (activeMoment.anchorTimeMs / safeDurationMs) * 100))
    : 50;

  return (
    <div className="relative mb-2 h-[58px]">
      <div className="absolute left-0 right-0 top-[31px] h-1 rounded-full bg-[var(--wk-surface-raised)]/80">
        {moments.slice(0, 10).map((moment) => {
          const pct = Math.max(2, Math.min(98, (moment.anchorTimeMs / safeDurationMs) * 100));
          return (
            <span
              key={moment.id}
              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--wk-brand)]/55"
              style={{ left: `${pct}%` }}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {activeMoment && (
        <button
          type="button"
          className="absolute top-0 max-w-[82%] -translate-x-1/2 rounded-2xl border border-[var(--wk-brand)]/20 bg-[var(--wk-bg)] px-3.5 py-2 text-left shadow-xl shadow-black/10 transition-transform active:scale-[0.98]"
          style={{ left: `${activePct}%` }}
          onClick={() => onOpenMoment(activeMoment.anchorTimeMs)}
          aria-label={`Open community moment at ${activeMoment.anchorLabel}`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-brand)]">
            <WkIcon name="MessageCircle" size={11} />
            <span>{activeMoment.anchorLabel}</span>
            <span className="text-[var(--wk-text-faint)]">·</span>
            <span className="max-w-[90px] truncate text-[var(--wk-text-muted)] normal-case tracking-normal">
              {activeMoment.authorName}
            </span>
          </div>
          <div className="mt-0.5 line-clamp-1 text-[12px] font-bold leading-snug text-[var(--wk-text)]">
            {activeMoment.bodyPreview}
          </div>
        </button>
      )}
    </div>
  );
}

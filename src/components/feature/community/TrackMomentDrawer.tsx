import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useCommunityThread } from "@/hooks/useCommunityThread";
import { useCommentActions } from "@/hooks/useCommunityActions";
import { buildVerifyEmailUrl } from "@/services/auth/accountVerification";
import {
  createTrackMomentComment,
  getTrackMomentComments,
  getTrackMomentSummary,
  getOrCreateThread,
  hydrateCommentsWithUserState,
  type CommunityComment,
  type CommunityEntity,
  type ReactionType,
  type TrackMomentSummaryItem,
} from "@/services/community";
import {
  playerTrackIdentity,
  type PlayerTrack,
} from "@/context/PlayerContext";
import { CommentCard } from "@/components/feature/community/CommentCard";
import { CommentComposer, LoginToComment } from "@/components/feature/community/CommentComposer";
import { WkIcon } from "@/components/design-system/Icon";

function formatMomentTimeFromSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatMomentTimeFromMs(ms: number): string {
  return formatMomentTimeFromSeconds(Math.floor((ms || 0) / 1000));
}

function buildTrackEntity(track: PlayerTrack): CommunityEntity {
  const trackSlug = track.trackSlug || track.id;
  const trackIdentity =
    playerTrackIdentity(track);
  const url = track.artistSlug && trackSlug
    ? `/tracks/${track.artistSlug}/${trackSlug}`
    : `/tracks/${trackSlug}`;

  return {
    type: "track",
    id: trackIdentity,
    slug: trackSlug,
    url,
    title: track.title,
    subtitle: track.artist,
    imageUrl: track.artworkUrl || null,
  };
}

export function TrackMomentDrawer({
  open,
  onClose,
  track,
  currentTime,
  duration,
  onSeek,
  initialTimeMs,
}: {
  open: boolean;
  onClose: () => void;
  track: PlayerTrack;
  currentTime: number;
  duration?: number;
  onSeek?: (time: number) => void;
  initialTimeMs?: number | null;
}) {
  const user = useAuthUser();
  const userId = user.id || undefined;
  const isLoggedIn = Boolean(userId);
  const entity = useMemo(
    () => buildTrackEntity(track),
    [
      track.id,
      track.trackSlug,
      track.artistSlug,
      track.title,
      track.artist,
      track.artworkUrl,
    ],
  );
  const {
    thread,
    postComment,
    loadReplies,
    refresh,
  } = useCommunityThread(entity, userId);

  const { vote, react } = useCommentActions(userId);
  const seededOpenRef = useRef(false);
  const loadSeqRef = useRef(0);
  const resolveSelectedTimeMs = useCallback(() => {
    const seeded = typeof initialTimeMs === "number" && Number.isFinite(initialTimeMs)
      ? initialTimeMs
      : currentTime * 1000;

    return Math.max(0, Math.round(seeded));
  }, [currentTime, initialTimeMs]);
  const [selectedTimeMs, setSelectedTimeMs] = useState(resolveSelectedTimeMs);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLabel = formatMomentTimeFromMs(selectedTimeMs);
  const totalDurationMs = Math.max(0, Math.round((duration || track.duration || 0) * 1000));

  useEffect(() => {
    if (!open) {
      seededOpenRef.current = false;
      return;
    }

    if (seededOpenRef.current) return;

    seededOpenRef.current = true;
    setSelectedTimeMs(resolveSelectedTimeMs());
  }, [open, resolveSelectedTimeMs]);

  const loadMomentComments = useCallback(async (options?: { quiet?: boolean }) => {
    if (!thread?.id) return;

    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;

    if (!options?.quiet) setLoading(true);
    setError(null);

    try {
      const raw = await getTrackMomentComments(thread.id, selectedTimeMs, 3000, 30);
      const hydrated = await hydrateCommentsWithUserState(raw, userId);

      if (loadSeqRef.current !== seq) return;

      setComments(hydrated);
      setHasLoadedOnce(true);
    } catch (err) {
      if (loadSeqRef.current !== seq) return;

      console.error("Could not load moment comments", err);
      setError(err instanceof Error ? err.message : "Could not load comments for this moment.");
    } finally {
      if (loadSeqRef.current === seq) setLoading(false);
    }
  }, [thread?.id, selectedTimeMs, userId]);

  useEffect(() => {
    if (!open) return;
    loadMomentComments({ quiet: hasLoadedOnce });
  }, [open, loadMomentComments, hasLoadedOnce]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const handlePostMoment = useCallback(
    async (body: string) => {
      if (!thread?.id) return null;
      if (!userId || user.loading) return null;

      if (!user.isEmailVerified) {
        window.location.assign(buildVerifyEmailUrl(undefined, user.email));
        return null;
      }

      const result = await createTrackMomentComment({
        threadId: thread.id,
        bodyMarkdown: body,
        bodyPlain: body,
        anchorTimeMs: selectedTimeMs,
        anchorLabel: selectedLabel,
      });

      await loadMomentComments({ quiet: true });
      refresh();
      return result.comment;
    },
    [
      thread?.id,
      userId,
      user.loading,
      user.isEmailVerified,
      user.email,
      selectedTimeMs,
      selectedLabel,
      loadMomentComments,
      refresh,
    ],
  );

  const handleReply = useCallback(
    async (commentId: string, body: string) => {
      await postComment(body, commentId);
      await loadMomentComments({ quiet: true });
    },
    [postComment, loadMomentComments],
  );

  const handleVote = useCallback(
    async (commentId: string, value: number) => vote(commentId, value),
    [vote],
  );

  const handleReact = useCallback(
    async (commentId: string, reactionType: ReactionType) => react(commentId, reactionType),
    [react],
  );

  const handleLoadReplies = useCallback(
    async (commentId: string) => loadReplies(commentId),
    [loadReplies],
  );

  if (!open) return null;

  if (typeof document === "undefined") return null;

  const pct = totalDurationMs > 0
    ? Math.max(0, Math.min(100, (selectedTimeMs / totalDurationMs) * 100))
    : 0;

  const drawer = (
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close moment comments"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[30px] border border-[var(--wk-border)] bg-[var(--wk-bg)] shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-[var(--wk-border)] bg-[var(--wk-bg)]/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--wk-border)]" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
                <WkIcon name="MessageCircle" size={12} />
                Moment comments
              </div>
              <h2 className="mt-2 text-[22px] font-black leading-none tracking-[-0.04em] text-[var(--wk-text)]">
                {selectedLabel} in {track.title}
              </h2>
              <p className="mt-1 truncate text-[12px] font-semibold text-[var(--wk-text-muted)]">
                {track.artist}
              </p>
            </div>

            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)]"
              onClick={onClose}
              aria-label="Close"
            >
              <WkIcon name="X" size={18} />
            </button>
          </div>

          {totalDurationMs > 0 && (
            <div className="mt-4">
              <div
                className="relative h-2 cursor-pointer overflow-hidden rounded-full bg-[var(--wk-surface-raised)]"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nextPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const nextMs = Math.round(totalDurationMs * nextPct);
                  setSelectedTimeMs(nextMs);
                  onSeek?.(nextMs / 1000);
                }}
              >
                <div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${pct}%` }} />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--wk-bg)] bg-[var(--wk-brand)]"
                  style={{ left: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-bold text-[var(--wk-text-faint)]">
                <span>0:00</span>
                <span>{formatMomentTimeFromMs(totalDurationMs)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 px-5 py-5">
          {isLoggedIn && user.id ? (
            <CommentComposer
              user={user}
              onSubmit={handlePostMoment}
              placeholder={`Say something about ${selectedLabel}...`}
            />
          ) : (
            <LoginToComment
              onSignIn={() => {
                window.location.href = "/auth";
              }}
            />
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] font-bold text-red-500">
              {error}
            </div>
          )}

          {loading && !hasLoadedOnce ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-2xl bg-[var(--wk-surface)]" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                <WkIcon name="Clock3" size={20} />
              </div>
              <p className="text-[14px] font-black text-[var(--wk-text)]">No comments at this moment yet</p>
              <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
                Start the conversation around the exact part of the song people should hear.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  currentUserId={userId}
                  onVote={handleVote}
                  onReact={handleReact}
                  onReply={handleReply}
                  onLoadReplies={handleLoadReplies}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}

export function TrackMomentSummary({
  entity,
  onSelectMoment,
}: {
  entity: CommunityEntity;
  onSelectMoment?: (anchorTimeMs: number) => void;
}) {
  const [moments, setMoments] = useState<TrackMomentSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    setLoading(true);
    getOrCreateThread(entity)
      .then(({ thread }) => getTrackMomentSummary(thread.id, 6))
      .then((items) => {
        if (alive) setMoments(items);
      })
      .catch((err) => {
        console.warn("Could not load track moment summary", err);
        if (alive) setMoments([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [entity.id, entity.slug, entity.title, entity.url]);

  if (loading || moments.length === 0) return null;

  return (
    <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="MessageCircle" size={12} />
            Most discussed moments
          </div>
          <p className="mt-2 text-[13px] font-semibold text-[var(--wk-text-muted)]">
            Timestamped comments from listeners.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {moments.map((moment) => (
          <button
            key={`${moment.anchorTimeMs}-${moment.anchorLabel}`}
            type="button"
            onClick={() => onSelectMoment?.(moment.anchorTimeMs)}
            className="group rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--wk-brand)]/35 hover:bg-[var(--wk-surface-raised)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[22px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                {moment.anchorLabel || formatMomentTimeFromMs(moment.anchorTimeMs)}
              </span>
              <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--wk-brand)]">
                {moment.commentCount}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
              {moment.commentCount} comment{moment.commentCount === 1 ? "" : "s"}
              {moment.reactionCount > 0 ? ` · ${moment.reactionCount} reactions` : ""}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

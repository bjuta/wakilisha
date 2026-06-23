import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useCommunityThread } from "@/hooks/useCommunityThread";
import { useCommentActions } from "@/hooks/useCommunityActions";
import { buildVerifyEmailUrl } from "@/services/auth/accountVerification";
import {
  createContextAnchorComment,
  getContextAnchorComments,
  getContextAnchorSummary,
  getOrCreateThread,
  hydrateCommentsWithUserState,
  type CommentAnchorType,
  type CommunityComment,
  type CommunityEntity,
  type ContextAnchorSummaryItem,
  type ReactionType,
} from "@/services/community";
import { CommentCard } from "@/components/feature/community/CommentCard";
import { CommentComposer, LoginToComment } from "@/components/feature/community/CommentComposer";
import { WkIcon } from "@/components/design-system/Icon";

type SupportedAnchor = Extract<CommentAnchorType, "release_track" | "chart_entry">;

export interface ContextAnchorTarget {
  anchorType: SupportedAnchor;
  contextEntityType: string;
  contextEntityId?: string | null;
  contextEntitySlug?: string | null;
  contextLabel: string;
  anchorLabel?: string | null;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  placeholder?: string;
}

export function ContextAnchorCommentDrawer({
  open,
  onClose,
  entity,
  target,
}: {
  open: boolean;
  onClose: () => void;
  entity: CommunityEntity;
  target: ContextAnchorTarget | null;
}) {
  const user = useAuthUser();
  const userId = user.id || undefined;
  const isLoggedIn = Boolean(userId);
  const {
    thread,
    postComment,
    loadReplies,
    refresh,
  } = useCommunityThread(entity, userId);

  const { vote, react } = useCommentActions(userId);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnchorComments = useCallback(async () => {
    if (!thread?.id || !target) return;

    setLoading(true);
    setError(null);
    try {
      const raw = await getContextAnchorComments({
        threadId: thread.id,
        anchorType: target.anchorType,
        contextEntityType: target.contextEntityType,
        contextEntityId: target.contextEntityId,
        contextEntitySlug: target.contextEntitySlug,
        limit: 40,
      });
      const hydrated = await hydrateCommentsWithUserState(raw, userId);
      setComments(hydrated);
    } catch (err) {
      console.error("Could not load anchored comments", err);
      setError(err instanceof Error ? err.message : "Could not load this discussion.");
    } finally {
      setLoading(false);
    }
  }, [thread?.id, target, userId]);

  useEffect(() => {
    if (!open) return;
    loadAnchorComments();
  }, [open, loadAnchorComments]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const handlePost = useCallback(
    async (body: string) => {
      if (!thread?.id || !target) return null;
      if (!userId || user.loading) return null;

      if (!user.isEmailVerified) {
        window.location.assign(buildVerifyEmailUrl(undefined, user.email));
        return null;
      }

      const result = await createContextAnchorComment({
        threadId: thread.id,
        bodyMarkdown: body,
        bodyPlain: body,
        anchorType: target.anchorType,
        contextEntityType: target.contextEntityType,
        contextEntityId: target.contextEntityId,
        contextEntitySlug: target.contextEntitySlug,
        contextLabel: target.contextLabel,
        anchorLabel: target.anchorLabel || target.contextLabel,
      });

      await Promise.all([loadAnchorComments(), refresh()]);
      window.dispatchEvent(new CustomEvent("wk-context-anchor-comments-changed"));
      return result.comment;
    },
    [
      thread?.id,
      target,
      userId,
      user.loading,
      user.isEmailVerified,
      user.email,
      loadAnchorComments,
      refresh,
    ],
  );

  const handleReply = useCallback(
    async (commentId: string, body: string) => {
      await postComment(body, commentId);
      await loadAnchorComments();
      window.dispatchEvent(new CustomEvent("wk-context-anchor-comments-changed"));
    },
    [postComment, loadAnchorComments],
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

  if (!open || !target) return null;

  const eyebrow = target.anchorType === "release_track" ? "Release track discussion" : "Chart entry discussion";

  if (typeof document === "undefined") return null;

  const drawer = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close discussion"
        onClick={onClose}
      />

      <div
        className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[30px] border border-[var(--wk-border)] bg-[var(--wk-bg)] shadow-2xl md:max-h-[82dvh] md:max-w-[720px] md:rounded-[30px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-[var(--wk-border)] bg-[var(--wk-bg)]/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--wk-border)] md:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--wk-surface-raised)]">
                {target.imageUrl ? (
                  <img src={target.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--wk-brand)]">
                    <WkIcon name={target.anchorType === "release_track" ? "Disc3" : "BarChart3"} size={22} />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
                  <WkIcon name="MessageCircle" size={12} />
                  {eyebrow}
                </div>
                <h2 className="mt-2 text-[22px] font-black leading-none tracking-[-0.04em] text-[var(--wk-text)]">
                  {target.title}
                </h2>
                {target.subtitle && (
                  <p className="mt-1 truncate text-[12px] font-semibold text-[var(--wk-text-muted)]">
                    {target.subtitle}
                  </p>
                )}
              </div>
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
        </div>

        <div className="space-y-6 px-5 py-5">
          {isLoggedIn && user.id ? (
            <CommentComposer
              user={user}
              onSubmit={handlePost}
              placeholder={target.placeholder || `Talk about ${target.contextLabel}...`}
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

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-2xl bg-[var(--wk-surface)]" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                <WkIcon name="MessageCircle" size={20} />
              </div>
              <p className="text-[14px] font-black text-[var(--wk-text)]">No discussion here yet</p>
              <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
                Start a focused thread around this exact release track or chart entry.
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

export function ContextAnchorSummary({
  entity,
  anchorType,
  eyebrow,
  title,
  subtitle,
  emptyLabel,
  onSelect,
}: {
  entity: CommunityEntity;
  anchorType: SupportedAnchor;
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyLabel?: string;
  onSelect: (item: ContextAnchorSummaryItem) => void;
}) {
  const [items, setItems] = useState<ContextAnchorSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let alive = true;

    setLoading(true);
    getOrCreateThread(entity)
      .then(({ thread }) => getContextAnchorSummary(thread.id, anchorType, 8))
      .then((next) => {
        if (alive) setItems(next);
      })
      .catch((err) => {
        console.warn("Could not load anchored discussion summary", err);
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [entity.id, entity.slug, entity.title, entity.url, anchorType]);

  useEffect(() => {
    const cleanup = load();
    const refresh = () => load();
    window.addEventListener("wk-context-anchor-comments-changed", refresh);
    return () => {
      cleanup();
      window.removeEventListener("wk-context-anchor-comments-changed", refresh);
    };
  }, [load]);

  if (loading || items.length === 0) return null;

  return (
    <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="MessageCircle" size={12} />
            {eyebrow}
          </div>
          <h2 className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
            {title}
          </h2>
          <p className="mt-1 text-[13px] font-semibold text-[var(--wk-text-muted)]">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            key={`${item.anchorType}-${item.contextEntitySlug || item.contextEntityId}-${item.contextLabel}`}
            type="button"
            onClick={() => onSelect(item)}
            className="group rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--wk-brand)]/35 hover:bg-[var(--wk-surface-raised)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="line-clamp-1 text-[15px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
                {item.contextLabel || item.anchorLabel || emptyLabel || "Discussion"}
              </span>
              <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--wk-brand)]">
                {item.commentCount}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
              {item.commentCount} comment{item.commentCount === 1 ? "" : "s"}
              {item.reactionCount > 0 ? ` · ${item.reactionCount} reactions` : ""}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

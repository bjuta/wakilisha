import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import type { CommunityEntity, CommunityComment, SortMode, ReactionType } from "@/services/community";
import { useCommunityThread } from "@/hooks/useCommunityThread";
import { useCommentActions } from "@/hooks/useCommunityActions";
import type { AuthUser } from "@/hooks/useAuthUser";
import { CommentCard } from "@/components/feature/community/CommentCard";
import { CommentComposer, LoginToComment } from "@/components/feature/community/CommentComposer";
import { ContributionSheet } from "@/components/feature/community/ContributionSheet";

interface CommunitySectionProps {
  entity: CommunityEntity;
  user?: AuthUser | null;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_replied", label: "Most Replied" },
  { value: "editor_picks", label: "Editor Picks" },
];

function isWholeEntityComment(comment: CommunityComment): boolean {
  return !comment.anchorType || comment.anchorType === "whole_record";
}

export function CommunitySection({ entity, user }: CommunitySectionProps) {
  const userId = user?.id || (user && !user.loading ? user.id : undefined);
  const isLoggedIn = !!userId && userId.length > 0;

  const {
    thread,
    comments,
    loading,
    error,
    sortBy,
    setSortBy,
    refresh,
    postComment,
    loadReplies,
    commentCount,
  } = useCommunityThread(entity, userId);

  const { vote, react, votingCommentId, reactingCommentId } = useCommentActions(userId);
  const visibleComments = useMemo(
    () => comments.filter(isWholeRecordComment),
    [comments]
  );
  const visibleCommentCount = visibleComments.length;
  const [contributionOpen, setContributionOpen] = useState(false);
  const [contribSourceCommentId, setContribSourceCommentId] = useState<string | undefined>(undefined);

  const handlePostComment = useCallback(
    async (body: string) => {
      await postComment(body);
    },
    [postComment]
  );

  const handleReply = useCallback(
    async (commentId: string, body: string) => {
      await postComment(body, commentId);
    },
    [postComment]
  );

  const handleVote = useCallback(
    async (commentId: string, value: number) => {
      return vote(commentId, value);
    },
    [vote]
  );

  const handleReact = useCallback(
    async (commentId: string, reactionType: ReactionType) => {
      return react(commentId, reactionType);
    },
    [react]
  );

  const handleLoadReplies = useCallback(
    async (commentId: string) => {
      return loadReplies(commentId);
    },
    [loadReplies]
  );

  const handleSuggestCorrection = useCallback(
    (commentId: string) => {
      setContribSourceCommentId(commentId);
      setContributionOpen(true);
    },
    []
  );

  const handleCloseContribution = useCallback(() => {
    setContributionOpen(false);
    setContribSourceCommentId(undefined);
  }, []);

  const handleSortChange = useCallback(
    (newSort: SortMode) => {
      setSortBy(newSort);
    },
    [setSortBy]
  );

  const loadingSkeleton = useMemo(
    () => (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-7 h-4 rounded bg-[var(--wk-surface-strong)]" />
              <div className="w-5 h-4 rounded bg-[var(--wk-surface-strong)]" />
              <div className="w-7 h-4 rounded bg-[var(--wk-surface-strong)]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--wk-surface-strong)]" />
                <div className="w-20 h-3 rounded bg-[var(--wk-surface-strong)]" />
                <div className="w-12 h-3 rounded bg-[var(--wk-surface-strong)]" />
              </div>
              <div className="space-y-1.5">
                <div className="w-full h-3 rounded bg-[var(--wk-surface-strong)]" />
                <div className="w-3/4 h-3 rounded bg-[var(--wk-surface-strong)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
    []
  );

  const emptyState = useMemo(
    () => (
      <div className="text-center py-10">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--wk-surface-strong)] flex items-center justify-center">
          <i className="ri-chat-3-line text-[22px] text-[var(--wk-text-faint)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--wk-text)] mb-1">No comments yet</p>
        <p className="text-[13px] text-[var(--wk-text-muted)] max-w-xs mx-auto">
          Be the first to share your thoughts on this.
        </p>
      </div>
    ),
    []
  );

  const errorState = useMemo(
    () => (
      <div className="text-center py-10">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--wk-danger-soft)] flex items-center justify-center">
          <i className="ri-error-warning-line text-[22px] text-[var(--wk-danger)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--wk-text)] mb-1">Couldn't load comments</p>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">
          {error?.message || "Something went wrong. Try again."}
        </p>
        <button
          onClick={refresh}
          className="h-9 px-5 rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border-2)] text-[12px] font-bold text-[var(--wk-text)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-refresh-line mr-1.5" />
          Try Again
        </button>
      </div>
    ),
    [error, refresh]
  );

  return (
    <section id="community-section" className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
      <div className="max-w-[740px] mx-auto px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 shrink-0">
            <h2 className="text-[20px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
              Community
            </h2>
            {!loading && (
              <span className="text-[12px] font-bold text-[var(--wk-text-muted)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
                {visibleCommentCount} {visibleCommentCount === 1 ? "comment" : "comments"}
              </span>
            )}
          </div>

          {/* Sort selector */}
          {!loading && visibleComments.length > 0 && (
            <div className="flex items-center gap-1 bg-[var(--wk-surface)] border border-[var(--wk-border)] rounded-full p-1 overflow-x-auto max-w-full">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    sortBy === opt.value
                      ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                      : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Composer or login prompt */}
        <div className="mb-8">
          {isLoggedIn && user ? (
            <CommentComposer
              user={user}
              onSubmit={handlePostComment}
              placeholder="Share your thoughts..."
            />
          ) : (
            <LoginToComment
              onSignIn={() => {
                window.location.href = "/auth";
              }}
            />
          )}
        </div>

        {/* Comments */}
        {loading ? (
          loadingSkeleton
        ) : error ? (
          errorState
        ) : visibleComments.length === 0 ? (
          emptyState
        ) : (
          <div className="space-y-1">
            {visibleComments.map((comment) => (
              <div
                key={comment.id}
                className="py-3"
              >
                <CommentCard
                  comment={comment}
                  currentUserId={userId}
                  onVote={handleVote}
                  onReact={handleReact}
                  onReply={handleReply}
                  onLoadReplies={handleLoadReplies}
                  onSuggestCorrection={handleSuggestCorrection}
                  depth={0}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contribution sheet */}
      <ContributionSheet
        entity={entity}
        open={contributionOpen}
        onClose={handleCloseContribution}
        userId={userId}
        sourceCommentId={contribSourceCommentId}
      />
    </section>
  );
}
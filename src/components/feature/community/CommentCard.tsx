import { useState, useCallback, useRef } from "react";
import type { CommunityComment, CommunityProfile, ReactionType } from "@/services/community";

interface CommentCardProps {
  comment: CommunityComment;
  currentUserId?: string;
  onVote: (commentId: string, value: number) => Promise<unknown>;
  onReact: (commentId: string, type: ReactionType) => Promise<unknown>;
  onReply: (commentId: string, body: string) => Promise<unknown>;
  onLoadReplies: (commentId: string) => Promise<unknown>;
  onSuggestCorrection?: (commentId: string) => void;
  depth?: number;
}

const REACTIONS: { type: ReactionType; icon: string; label: string }[] = [
  { type: "signal", icon: "ri-flashlight-line", label: "Signal" },
  { type: "memory", icon: "ri-time-line", label: "Memory" },
  { type: "context", icon: "ri-lightbulb-line", label: "Context" },
  { type: "fire", icon: "ri-fire-line", label: "Fire" },
  { type: "agree", icon: "ri-thumb-up-line", label: "Agree" },
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatAnchorTime(ms?: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  const safeSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getCommentAnchorBadge(comment: CommunityComment): { label: string; icon: string } | null {
  if (!comment.anchorType || comment.anchorType === "whole_record") return null;

  if (comment.anchorType === "timestamp" || comment.anchorType === "time_range") {
    const start = formatAnchorTime(comment.anchorTimeMs);
    const end = formatAnchorTime(comment.anchorEndTimeMs);

    if (!start) return null;

    return {
      label: comment.anchorType === "time_range" && end ? `${start}-${end}` : start,
      icon: "ri-time-line",
    };
  }

  if (comment.anchorType === "release_track") {
    return {
      label: comment.contextLabel || comment.anchorLabel || "Release track",
      icon: "ri-album-line",
    };
  }

  if (comment.anchorType === "chart_entry") {
    return {
      label: comment.contextLabel || comment.anchorLabel || "Chart entry",
      icon: "ri-bar-chart-grouped-line",
    };
  }

  return null;
}

export function CommentCard({
  comment,
  currentUserId,
  onVote,
  onReact,
  onReply,
  onLoadReplies,
  onSuggestCorrection,
  depth = 0,
}: CommentCardProps) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [optimisticVote, setOptimisticVote] = useState<number | null>(null);
  const [optimisticReactions, setOptimisticReactions] = useState<string[]>([]);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const author = comment.author;
  const userVote = optimisticVote ?? comment.userVote;
  const voteScore = comment.upvoteCount - comment.downvoteCount + (optimisticVote !== null ? optimisticVote - (comment.userVote ?? 0) : 0);
  const activeReactions = [...new Set([...comment.userReactions, ...optimisticReactions])];
  const anchorBadge = getCommentAnchorBadge(comment);

  const handleVote = useCallback(
    async (value: number) => {
      if (!currentUserId) return;
      const newValue = userVote === value ? 0 : value;
      setOptimisticVote(newValue);
      try {
        await onVote(comment.id, value);
      } catch {
        setOptimisticVote(comment.userVote ?? null);
      }
    },
    [currentUserId, comment.id, comment.userVote, userVote, onVote]
  );

  const handleReact = useCallback(
    async (type: ReactionType) => {
      if (!currentUserId) return;
      const hasReacted = activeReactions.includes(type);
      setOptimisticReactions((prev) =>
        hasReacted ? prev.filter((r) => r !== type) : [...prev, type]
      );
      setShowReactions(false);
      try {
        await onReact(comment.id, type);
      } catch {
        setOptimisticReactions([]);
      }
    },
    [currentUserId, comment.id, activeReactions, onReact]
  );

  const handleSubmitReply = useCallback(async () => {
    if (!replyText.trim() || !currentUserId) return;
    setPosting(true);
    try {
      await onReply(comment.id, replyText.trim());
      setReplyText("");
      setShowReplyBox(false);
    } catch {
      // keep text on error
    } finally {
      setPosting(false);
    }
  }, [replyText, currentUserId, comment.id, onReply]);

  const handleLoadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      await onLoadReplies(comment.id);
      setExpandedReplies(true);
    } finally {
      setLoadingReplies(false);
    }
  }, [comment.id, onLoadReplies]);

  const hasChildren = (comment.children?.length ?? 0) > 0;
  const hasMoreReplies = comment.replyCount > (comment.children?.length ?? 0);

  return (
    <div id={`comment-${comment.id}`} className={`${depth > 0 ? "ml-3 sm:ml-6 pl-2 sm:pl-4 border-l-2 border-[var(--wk-border)]" : ""}`}>
      <div className="group">
        <div className="flex gap-3">
          {/* Vote column */}
          <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
            <button
              onClick={() => handleVote(1)}
              disabled={!currentUserId}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer ${
                userVote === 1
                  ? "text-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                  : "text-[var(--wk-text-faint)] hover:text-[var(--wk-brand)] hover:bg-[var(--wk-surface)]"
              } ${!currentUserId ? "opacity-40 cursor-not-allowed" : ""}`}
              aria-label="Upvote"
            >
              <i className="ri-arrow-up-s-line text-[15px]" />
            </button>
            <span className={`text-[12px] font-bold tabular-nums leading-none py-0.5 ${
              voteScore > 0 ? "text-[var(--wk-brand)]" : voteScore < 0 ? "text-[var(--wk-danger)]" : "text-[var(--wk-text-muted)]"
            }`}>
              {formatCount(voteScore)}
            </span>
            <button
              onClick={() => handleVote(-1)}
              disabled={!currentUserId}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer ${
                userVote === -1
                  ? "text-[var(--wk-danger)] bg-[var(--wk-danger-soft)]"
                  : "text-[var(--wk-text-faint)] hover:text-[var(--wk-danger)] hover:bg-[var(--wk-surface)]"
              } ${!currentUserId ? "opacity-40 cursor-not-allowed" : ""}`}
              aria-label="Downvote"
            >
              <i className="ri-arrow-down-s-line text-[15px]" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="w-6 h-6 rounded-full bg-[var(--wk-surface-strong)] flex items-center justify-center overflow-hidden shrink-0">
                {author?.avatarUrl ? (
                  <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="ri-user-line text-[11px] text-[var(--wk-text-faint)]" />
                )}
              </div>
              <span className="text-[12px] font-bold text-[var(--wk-text)] truncate">
                {author?.displayName || author?.username || "Anonymous"}
              </span>
              {author?.roleLabels?.includes("moderator") && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                  MOD
                </span>
              )}
              {comment.isEditorPick && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">
                  Editor Pick
                </span>
              )}
              <span className="text-[11px] text-[var(--wk-text-faint)]">{timeAgo(comment.createdAt)}</span>
              {anchorBadge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--wk-brand)]">
                  <i className={`${anchorBadge.icon} text-[11px]`} />
                  {anchorBadge.label}
                </span>
              )}
              {comment.editedAt && (
                <span className="text-[10px] text-[var(--wk-text-faint)] italic">(edited)</span>
              )}
            </div>

            {/* Body */}
            <div className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] whitespace-pre-wrap break-words">
              {comment.bodyMarkdown}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-1 mt-2 -ml-1 flex-wrap">
              <button
                onClick={() => {
                  setShowReplyBox(!showReplyBox);
                  if (!showReplyBox) {
                    setTimeout(() => replyRef.current?.focus(), 100);
                  }
                }}
                disabled={!currentUserId}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  !currentUserId
                    ? "text-[var(--wk-text-faint)] cursor-not-allowed"
                    : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface)]"
                }`}
              >
                <i className="ri-reply-line text-[13px]" />
                Reply
              </button>

              {/* Reactions toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  disabled={!currentUserId}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    !currentUserId
                      ? "text-[var(--wk-text-faint)] cursor-not-allowed"
                      : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface)]"
                  }`}
                >
                  <i className={`${activeReactions.length > 0 ? "ri-emotion-happy-fill text-[var(--wk-brand)]" : "ri-emotion-happy-line"} text-[13px]`} />
                  {activeReactions.length > 0 && (
                    <span className="text-[11px] font-bold text-[var(--wk-brand)]">{activeReactions.length}</span>
                  )}
                </button>
                {showReactions && (
                  <div className="absolute top-full left-0 mt-1 bg-[var(--wk-surface)] border border-[var(--wk-border-2)] rounded-xl p-1.5 flex gap-0.5 shadow-lg z-30 max-w-full flex-wrap">
                    {REACTIONS.map((r) => (
                      <button
                        key={r.type}
                        onClick={() => handleReact(r.type)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          activeReactions.includes(r.type)
                            ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                            : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                        }`}
                        title={r.label}
                      >
                        <i className={`${r.icon} text-[13px]`} />
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {comment.reportCount > 0 && comment.reportCount >= 3 && (
                <span className="text-[10px] text-[var(--wk-warning)] px-1.5">⚠ Reported</span>
              )}

              {onSuggestCorrection && currentUserId && (
                <button
                  onClick={() => onSuggestCorrection(comment.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-edit-line text-[12px]" />
                  Suggest Correction
                </button>
              )}
            </div>

            {/* Active reactions display */}
            {comment.reactionCount > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                {Object.entries(
                  (() => {
                    // We approximate from the user reactions since we don't have full breakdown
                    const map: Record<string, number> = {};
                    comment.userReactions?.forEach((r) => { map[r] = 1; });
                    return map;
                  })()
                ).length > 0 && (
                  <div className="flex items-center gap-1">
                    {[...new Set(comment.userReactions || [])].slice(0, 3).map((r) => {
                      const def = REACTIONS.find((x) => x.type === r);
                      return def ? (
                        <span key={r} className="text-[11px] text-[var(--wk-text-muted)]">
                          <i className={`${def.icon} text-[12px]`} />
                        </span>
                      ) : null;
                    })}
                    <span className="text-[11px] text-[var(--wk-text-faint)]">{comment.reactionCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reply composer */}
            {showReplyBox && (
              <div className="mt-3">
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  maxLength={2000}
                  className="w-full bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-lg px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] resize-none focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
                />
                <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                  <span className="text-[10px] text-[var(--wk-text-faint)]">{replyText.length}/2000</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setShowReplyBox(false); setReplyText(""); }}
                      className="h-8 px-3 rounded-full text-[11px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReply}
                      disabled={!replyText.trim() || posting}
                      className="h-8 px-4 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[11px] font-bold cursor-pointer whitespace-nowrap transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {posting ? "Posting..." : "Reply"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Replies section */}
        {hasChildren && (
          <div className="mt-3">
            {comment.children!.map((child) => (
              <CommentCard
                key={child.id}
                comment={child}
                currentUserId={currentUserId}
                onVote={onVote}
                onReact={onReact}
                onReply={onReply}
                onLoadReplies={onLoadReplies}
                depth={depth + 1}
              />
            ))}
          </div>
        )}

        {/* Load more replies */}
        {(hasMoreReplies && !expandedReplies) && (
          <button
            onClick={handleLoadReplies}
            disabled={loadingReplies}
            className="ml-10 sm:ml-12 mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--wk-brand)] hover:underline cursor-pointer whitespace-nowrap"
          >
            {loadingReplies ? (
              <>
                <i className="ri-loader-4-line animate-spin text-[13px]" />
                Loading...
              </>
            ) : (
              <>
                <i className="ri-arrow-down-s-line text-[14px]" />
                Show {comment.replyCount - (comment.children?.length ?? 0)} {comment.replyCount - (comment.children?.length ?? 0) === 1 ? "reply" : "replies"}
              </>
            )}
          </button>
        )}

        {/* Show "hide replies" if expanded */}
        {(hasMoreReplies && expandedReplies && hasChildren) && (
          <button
            onClick={() => setExpandedReplies(false)}
            className="ml-10 sm:ml-12 mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-up-s-line text-[14px]" />
            Hide replies
          </button>
        )}
      </div>
    </div>
  );
}
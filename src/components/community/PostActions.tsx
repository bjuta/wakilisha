import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import {
  CommunityReactionPicker,
  getReactionGlyph,
} from "@/components/feature/community/CommunityReactionPicker";
import {
  ShareSheet,
  type ShareObject,
} from "@/components/design-system/share/ShareSheet";
import { PostQuoteDialog } from "@/components/community/PostQuoteDialog";
import { PostEditDialog } from "@/components/community/PostEditDialog";
import { PostDeleteDialog } from "@/components/community/PostDeleteDialog";
import { PostReportDialog } from "@/components/community/PostReportDialog";
import {
  withdrawPost,
  type CommunityPost,
  type PostActor,
  type PostRepostState,
} from "@/services/community/posts";
import type {
  CommunityPublicReactionState,
  ReactionType,
  ReportReason,
} from "@/services/community";

const PUBLIC_ORIGIN = "https://wakilisha.africa";

export function PostActions({
  post,
  actionActor = null,
  saved = false,
  saving = false,
  reactionState,
  reacting = false,
  repostState,
  reposting = false,
  followed,
  following = false,
  blocked = false,
  blocking = false,
  reporting = false,
  canManage = false,
  onToggleSave,
  onToggleFollow,
  onReact,
  onToggleRepost,
  onToggleBlock,
  onReport,
  onWithdrawn,
}: {
  post: CommunityPost;
  actionActor?: PostActor | null;
  saved?: boolean;
  saving?: boolean;
  reactionState?: CommunityPublicReactionState;
  reacting?: boolean;
  repostState?: PostRepostState;
  reposting?: boolean;
  followed?: boolean;
  following?: boolean;
  blocked?: boolean;
  blocking?: boolean;
  reporting?: boolean;
  canManage?: boolean;
  onToggleSave?: () => void;
  onToggleFollow?: () => void;
  onReact?: (reactionType: ReactionType) => void;
  onToggleRepost?: () => void;
  onToggleBlock?: () => void;
  onReport?: (reason: ReportReason) => Promise<void> | void;
  onWithdrawn?: (postId: string) => void;
}) {
  const navigate = useNavigate();
  const [reactionOpen, setReactionOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const reactionTriggerRef = useRef<HTMLButtonElement | null>(null);

  const activeReactions =
    reactionState?.reactions.filter((reaction) => reaction.viewerReacted).map((reaction) => reaction.reactionType) ?? [];
  const visibleReactions =
    reactionState?.reactions.filter((reaction) => reaction.count > 0).slice(0, 3) ?? [];
  const reactionCount = reactionState?.reactionCount ?? 0;
  const repostCount = repostState?.repostCount ?? 0;
  const viewerReposted = repostState?.viewerReposted ?? false;

  const shareItem = useMemo<ShareObject>(() => ({
    title: `Post from ${post.actor.name}`,
    subtitle: post.actor.name,
    description: post.body,
    imageUrl: post.imageUrl,
    url: new URL(post.canonicalPath, PUBLIC_ORIGIN).toString(),
    type: "post",
  }), [post]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await withdrawPost(post.id);
      setDeleteOpen(false);
      onWithdrawn?.(post.id);
    } catch {
      setDeleteError("We couldn't delete this Post. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareItem.url);
      setLinkCopied(true);
      window.setTimeout(() => {
        setLinkCopied(false);
        setMenuOpen(false);
      }, 700);
    } catch {
      setMenuOpen(false);
      setShareOpen(true);
    }
  }

  function handleBlock() {
    if (!onToggleBlock) return;
    if (!blocked) {
      const confirmed = window.confirm(
        `Block ${post.actor.name}? You will unfollow them, and their Posts will stop appearing in your Following feed.`,
      );
      if (!confirmed) return;
    }
    setMenuOpen(false);
    onToggleBlock();
  }

  const showRepost = Boolean(actionActor && onToggleRepost);
  const showMenu =
    canManage ||
    (typeof followed === "boolean" && Boolean(onToggleFollow)) ||
    Boolean(actionActor && (onToggleBlock || onReport));

  return (
    <>
      <div data-post-actions className="mt-4 flex flex-wrap items-center gap-1 border-t border-[var(--wk-divider)] pt-2">
        <Link
          to={`${post.canonicalPath}#community-section`}
          title="Reply"
          aria-label="Reply"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
        >
          <i className="ri-chat-3-line text-[18px]" aria-hidden="true" />
          <span className="sr-only">Reply</span>
        </Link>

        {onToggleSave && (
          <button
            type="button"
            disabled={saving}
            onClick={onToggleSave}
            title={saved ? "Remove Bookmark" : "Bookmark"}
            aria-label={saved ? "Remove Bookmark" : "Bookmark"}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
              saved
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            } disabled:opacity-55`}
          >
            <i
              className={saved ? "ri-bookmark-fill text-[17px]" : "ri-bookmark-line text-[17px]"}
              aria-hidden="true"
            />
            <span className="sr-only">
              {saved ? "Bookmarked" : "Bookmark"}
            </span>
          </button>
        )}

        {onReact && (
          <div className="relative">
            <button
              ref={reactionTriggerRef}
              type="button"
              disabled={reacting}
              onClick={() => setReactionOpen((current) => !current)}
              title={
                activeReactions.length > 0
                  ? "Manage Reactions"
                  : "React"
              }
              className={`inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2 ${
                activeReactions.length > 0
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              } disabled:opacity-55`}
              aria-label={
                reactionCount > 0
                  ? `${reactionCount} reactions. Add or remove a reaction.`
                  : "React to this Post"
              }
              aria-expanded={reactionOpen}
            >
              {visibleReactions.length > 0 ? (
                <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                  {visibleReactions.map((reaction) => (
                    <span key={reaction.reactionType} className="text-[16px] leading-none">
                      {getReactionGlyph(reaction.reactionType)}
                    </span>
                  ))}
                </span>
              ) : (
                <i className="ri-emotion-happy-line text-[17px]" aria-hidden="true" />
              )}
              {reactionCount > 0 && (
                <span className="text-[10px] font-black tabular-nums">
                  {reactionCount}
                </span>
              )}
              <span className="sr-only">React</span>
            </button>

            {reactionOpen && (
              <CommunityReactionPicker
                activeReactions={activeReactions}
                anchorRef={reactionTriggerRef}
                onSelect={(reactionType) => {
                  setReactionOpen(false);
                  onReact(reactionType);
                }}
                onClose={() => setReactionOpen(false)}
              />
            )}
          </div>
        )}

        {showRepost && (
          <div className="relative">
            <button
              type="button"
              disabled={reposting}
              onClick={() => setRepostOpen((current) => !current)}
              aria-expanded={repostOpen}
              aria-label={viewerReposted ? "Reposted. Open Repost options." : "Open Repost options"}
              title={viewerReposted ? "Repost Options" : "Repost"}
              className={`inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2 ${
                viewerReposted
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              } disabled:opacity-55`}
            >
              <i className="ri-repeat-2-line text-[17px]" aria-hidden="true" />
              {repostCount > 0 && (
                <span className="text-[10px] font-black tabular-nums">
                  {repostCount}
                </span>
              )}
              <span className="sr-only">Repost</span>
            </button>

            {repostOpen && (
              <div className="absolute bottom-12 left-0 z-40 min-w-[190px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1.5 shadow-xl">
                <button
                  type="button"
                  disabled={reposting}
                  onClick={() => {
                    setRepostOpen(false);
                    onToggleRepost?.();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)] disabled:opacity-50"
                >
                  <i className="ri-repeat-2-line text-[17px]" aria-hidden="true" />
                  {viewerReposted ? "Undo Repost" : "Repost"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRepostOpen(false);
                    setQuoteOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)]"
                >
                  <i className="ri-double-quotes-l text-[17px]" aria-hidden="true" />
                  Quote Post
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          title="Share"
          aria-label="Share"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
        >
          <i className="ri-share-forward-line text-[18px]" aria-hidden="true" />
          <span className="sr-only">Share</span>
        </button>

        {showMenu && (
          <div className="relative ml-auto">
            <button
              type="button"
              aria-label="More Post actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-more-line text-[19px]" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div className="absolute bottom-12 right-0 z-40 min-w-[230px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(post.canonicalPath);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)]"
                >
                  <i className="ri-external-link-line text-[17px]" aria-hidden="true" />
                  Open Post
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)]"
                >
                  <i className="ri-link text-[17px]" aria-hidden="true" />
                  {linkCopied ? "Link Copied" : "Copy Link"}
                </button>

                <div className="my-1 border-t border-[var(--wk-divider)]" />

                {canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditOpen(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)]"
                    >
                      <i className="ri-edit-line text-[17px]" aria-hidden="true" />
                      Edit Post
                    </button>

                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => {
                        setMenuOpen(false);
                        setDeleteError(null);
                        setDeleteOpen(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] disabled:opacity-50"
                    >
                      <i className="ri-delete-bin-line text-[17px]" aria-hidden="true" />
                      Delete Post
                    </button>
                  </>
                ) : (
                  <>
                    {typeof followed === "boolean" && onToggleFollow && (
                      <button
                        type="button"
                        disabled={following}
                        onClick={() => {
                          setMenuOpen(false);
                          onToggleFollow();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)] disabled:opacity-50"
                      >
                        <i
                          className={followed ? "ri-user-unfollow-line text-[17px]" : "ri-user-follow-line text-[17px]"}
                          aria-hidden="true"
                        />
                        {followed ? `Unfollow ${post.actor.name}` : `Follow ${post.actor.name}`}
                      </button>
                    )}

                    {actionActor && onToggleBlock && (
                      <button
                        type="button"
                        disabled={blocking}
                        onClick={handleBlock}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)] disabled:opacity-50"
                      >
                        <i
                          className={blocked ? "ri-forbid-2-line text-[17px]" : "ri-forbid-line text-[17px]"}
                          aria-hidden="true"
                        />
                        {blocked ? `Unblock ${post.actor.name}` : `Block ${post.actor.name}`}
                      </button>
                    )}

                    {actionActor && onReport && (
                      <button
                        type="button"
                        disabled={reporting}
                        onClick={() => {
                          setMenuOpen(false);
                          setReportOpen(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] disabled:opacity-50"
                      >
                        <i className="ri-flag-line text-[17px]" aria-hidden="true" />
                        Report Post
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} item={shareItem} />

      <PostEditDialog
        open={editOpen}
        post={post}
        onClose={() => setEditOpen(false)}
        onEdited={() => navigate(0)}
      />

      <PostDeleteDialog
        open={deleteOpen}
        deleting={deleting}
        error={deleteError}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
      />

      {actionActor && (
        <PostQuoteDialog
          open={quoteOpen}
          actor={actionActor}
          post={post}
          onClose={() => setQuoteOpen(false)}
          onQuoted={(quote) => navigate(quote.canonicalPath)}
        />
      )}

      {onReport && (
        <PostReportDialog
          open={reportOpen}
          postAuthorName={post.actor.name}
          reporting={reporting}
          onClose={() => setReportOpen(false)}
          onReport={onReport}
        />
      )}
    </>
  );
}

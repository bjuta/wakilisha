import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CommunityReactionPicker,
  getReactionGlyph,
} from "@/components/feature/community/CommunityReactionPicker";
import { ShareSheet, type ShareObject } from "@/components/design-system/share/ShareSheet";
import { withdrawPost, type CommunityPost } from "@/services/community/posts";
import type { CommunityPublicReactionState, ReactionType } from "@/services/community";

const PUBLIC_ORIGIN = "https://wakilisha.africa";

export function PostActions({
  post,
  saved = false,
  saving = false,
  reactionState,
  reacting = false,
  followed,
  following = false,
  canManage = false,
  onToggleSave,
  onToggleFollow,
  onReact,
  onWithdrawn,
}: {
  post: CommunityPost;
  saved?: boolean;
  saving?: boolean;
  reactionState?: CommunityPublicReactionState;
  reacting?: boolean;
  followed?: boolean;
  following?: boolean;
  canManage?: boolean;
  onToggleSave?: () => void;
  onToggleFollow?: () => void;
  onReact?: (reactionType: ReactionType) => void;
  onWithdrawn?: (postId: string) => void;
}) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const reactionTriggerRef = useRef<HTMLButtonElement | null>(null);

  const activeReactions = reactionState?.reactions.filter((reaction) => reaction.viewerReacted).map((reaction) => reaction.reactionType) ?? [];
  const visibleReactions = reactionState?.reactions.filter((reaction) => reaction.count > 0).slice(0, 3) ?? [];
  const reactionCount = reactionState?.reactionCount ?? 0;

  const shareItem = useMemo<ShareObject>(() => ({
    title: `Post from ${post.actor.name}`,
    subtitle: post.actor.name,
    description: post.body,
    imageUrl: post.imageUrl,
    url: new URL(post.canonicalPath, PUBLIC_ORIGIN).toString(),
    type: "post",
  }), [post]);

  async function handleDelete() {
    const reason = window.prompt("Why are you deleting this Post?");
    if (!reason || reason.trim().length < 3) return;
    setDeleting(true);
    try {
      await withdrawPost(post.id, reason.trim());
      setMenuOpen(false);
      onWithdrawn?.(post.id);
    } finally {
      setDeleting(false);
    }
  }

  const showMenu = canManage || (typeof followed === "boolean" && Boolean(onToggleFollow));

  return (
    <>
      <div data-post-actions className="mt-4 flex flex-wrap items-center gap-1 border-t border-[var(--wk-divider)] pt-2">
        <Link
          to={`${post.canonicalPath}#community-section`}
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[11px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
        >
          <i className="ri-chat-3-line text-[17px]" aria-hidden="true" />
          Reply
        </Link>

        {onToggleSave && (
          <button
            type="button"
            disabled={saving}
            onClick={onToggleSave}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[11px] font-bold ${saved ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"} disabled:opacity-55`}
          >
            <i className={saved ? "ri-bookmark-fill text-[17px]" : "ri-bookmark-line text-[17px]"} aria-hidden="true" />
            {saved ? "Bookmarked" : "Bookmark"}
          </button>
        )}

        {onReact && (
          <div className="relative">
            <button
              ref={reactionTriggerRef}
              type="button"
              disabled={reacting}
              onClick={() => setReactionOpen((current) => !current)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[11px] font-bold ${activeReactions.length > 0 ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"} disabled:opacity-55`}
              aria-label={reactionCount > 0 ? `${reactionCount} reactions. Add or remove a reaction.` : "React to this Post"}
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
              <span>{reactionCount > 0 ? reactionCount : "React"}</span>
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

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[11px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
        >
          <i className="ri-share-forward-line text-[17px]" aria-hidden="true" />
          Share
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
              <div className="absolute bottom-12 right-0 z-40 min-w-[220px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1.5 shadow-xl">
                {canManage ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] disabled:opacity-50"
                  >
                    <i className="ri-delete-bin-line text-[17px]" aria-hidden="true" />
                    {deleting ? "Deleting..." : "Delete Post"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={following}
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleFollow?.();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-bg)] disabled:opacity-50"
                  >
                    <i className={followed ? "ri-user-unfollow-line text-[17px]" : "ri-user-follow-line text-[17px]"} aria-hidden="true" />
                    {followed ? `Unfollow ${post.actor.name}` : `Follow ${post.actor.name}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} item={shareItem} />
    </>
  );
}

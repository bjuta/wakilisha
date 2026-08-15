import { Link, useNavigate } from "react-router-dom";
import { PostActions } from "@/components/community/PostActions";
import { CommunitySection } from "@/pages/magazine/article/components/CommunitySection";
import { useAuthUser } from "@/hooks/useAuthUser";
import { usePostInteractionState } from "@/hooks/usePostInteractionState";
import type { CommunityPost } from "@/services/community/posts";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function PostDetailSurface({ post }: { post: CommunityPost }) {
  const navigate = useNavigate();
  const user = useAuthUser();
  const interaction = usePostInteractionState([post]);
  const key = `${post.actor.type}:${post.actor.id}`;

  return (
    <>
      <article className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-0 md:py-12">
        <header className="flex items-center gap-3">
          <Link to={post.actor.canonicalPath} className="shrink-0" aria-label={post.actor.name}>
            {post.actor.imageUrl ? (
              <img src={post.actor.imageUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[13px] font-black text-[var(--wk-brand)]">
                {post.actor.name[0]?.toUpperCase() || "W"}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={post.actor.canonicalPath} className="truncate text-[15px] font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]">
              {post.actor.name}
            </Link>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)]">
              {post.actor.official && <><span>Official Artist</span><span aria-hidden="true">·</span></>}
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </div>
          </div>
        </header>

        <p className="mt-6 whitespace-pre-wrap text-[21px] font-semibold leading-[1.55] tracking-[-0.015em] text-[var(--wk-text)] md:text-[25px]">
          {post.body}
        </p>

        {post.imageUrl && (
          <div className="mt-5 overflow-hidden rounded-[28px] bg-[var(--wk-surface-raised)]">
            <img src={post.imageUrl} alt="" className="max-h-[760px] w-full object-cover" />
          </div>
        )}

        {post.linkUrl && (
          <a href={post.linkUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 py-2.5 text-[12px] font-black text-[var(--wk-text)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">
            {post.linkLabel || "Open Link"}
            <i className="ri-external-link-line" aria-hidden="true" />
          </a>
        )}

        <PostActions
          post={post}
          saved={interaction.savedPostIds.has(post.id)}
          saving={interaction.savingPostIds.has(post.id)}
          reactionState={interaction.reactionStates.get(post.id)}
          reacting={interaction.reactingPostIds.has(post.id)}
          followed={interaction.followedActorKeys.has(key)}
          following={interaction.followingActorKeys.has(key)}
          canManage={interaction.manageableActorKeys.has(key)}
          onToggleSave={() => void interaction.toggleSave(post)}
          onToggleFollow={() => void interaction.toggleFollow(post.actor)}
          onReact={(reactionType) => void interaction.toggleReaction(post, reactionType)}
          onWithdrawn={() => navigate(post.actor.canonicalPath)}
        />
      </article>

      <CommunitySection
        entity={{
          type: "post",
          id: post.id,
          url: post.canonicalPath,
          title: `Post from ${post.actor.name}`,
          description: post.body,
          imageUrl: post.imageUrl,
        }}
        user={user}
      />
    </>
  );
}

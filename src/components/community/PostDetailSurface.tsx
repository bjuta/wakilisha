import { Link, useNavigate } from "react-router-dom";
import { PostActions } from "@/components/community/PostActions";
import { QuotedPostCard } from "@/components/community/QuotedPostCard";
import { PostTrackAttachment } from "@/components/community/PostTrackAttachment";
import { PostLinkAttachment } from "@/components/community/PostLinkAttachment";
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

        {post.body ? (
          <p className="mt-6 whitespace-pre-wrap text-[21px] font-semibold leading-[1.55] tracking-[-0.015em] text-[var(--wk-text)] md:text-[25px]">
            {post.body}
          </p>
        ) : null}

        {post.track ? (
          <PostTrackAttachment
            track={post.track}
            className="mt-5"
          />
        ) : null}

        {post.imageUrl && (
          <div className="mt-5 overflow-hidden rounded-[28px] bg-[var(--wk-surface-raised)]">
            <img src={post.imageUrl} alt="" className="max-h-[760px] w-full object-cover" />
          </div>
        )}

        {post.linkUrl ? (
          <PostLinkAttachment
            linkUrl={post.linkUrl}
            linkLabel={post.linkLabel}
            className="mt-5 block"
          />
        ) : null}


        {post.quotedPost && (
          <QuotedPostCard
            quotedPost={post.quotedPost}
            className="mt-5"
          />
        )}

        <PostActions
          post={post}
          saved={interaction.savedPostIds.has(post.id)}
          saving={interaction.savingPostIds.has(post.id)}
          reactionState={interaction.reactionStates.get(post.id)}
          reacting={interaction.reactingPostIds.has(post.id)}
          actionActor={interaction.viewerActor}
          followed={interaction.followedActorKeys.has(key)}
          following={interaction.followingActorKeys.has(key)}
          repostState={interaction.repostStates.get(post.id)}
          reposting={interaction.repostingPostIds.has(post.id)}
          blocked={interaction.blockedActorKeys.has(key)}
          blocking={interaction.blockingActorKeys.has(key)}
          reporting={interaction.reportingPostIds.has(post.id)}
          canManage={interaction.manageableActorKeys.has(key)}
          onToggleSave={() => void interaction.toggleSave(post)}
          onToggleFollow={() => void interaction.toggleFollow(post.actor)}
          onReact={(reactionType) => void interaction.toggleReaction(post, reactionType)}
          onToggleRepost={() => void interaction.toggleRepost(post)}
          onToggleBlock={() => void interaction.toggleBlock(post.actor)}
          onReport={(reason) => interaction.submitReport(post, reason)}
          onWithdrawn={() => navigate(post.actor.canonicalPath)}
        />
      </article>

      <CommunitySection
        entity={{
          type: "post",
          id: post.id,
          url: post.canonicalPath,
          title: `Post from ${post.actor.name}`,
          description:
            post.body ||
            (post.track
              ? `${post.track.title}${post.track.artistName ? ` by ${post.track.artistName}` : ""}`
              : ""),
          imageUrl: post.imageUrl || post.track?.artworkUrl || null,
        }}
        user={user}
        mode="post"
      />
    </>
  );
}

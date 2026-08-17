import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PostActions } from "@/components/community/PostActions";
import { QuotedPostCard } from "@/components/community/QuotedPostCard";
import { PostTrackAttachment } from "@/components/community/PostTrackAttachment";
import { PostLinkAttachment } from "@/components/community/PostLinkAttachment";
import { CommunitySection } from "@/pages/magazine/article/components/CommunitySection";
import { useAuthUser } from "@/hooks/useAuthUser";
import { usePostInteractionState } from "@/hooks/usePostInteractionState";
import {
  getPostThread,
  getPostThreadContext,
} from "@/services/community/postDrafts";
import type { CommunityPost } from "@/services/community/posts";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PostDetailSurface({ post }: { post: CommunityPost }) {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [threadPosts, setThreadPosts] = useState<CommunityPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const context = await getPostThreadContext(post.id);
        if (!context) {
          if (!cancelled) setThreadPosts(null);
          return;
        }

        const thread = await getPostThread(context.threadId);
        if (
          !thread ||
          !thread.items.some((item) => item.id === post.id)
        ) {
          if (!cancelled) setThreadPosts(null);
          return;
        }

        if (!cancelled) setThreadPosts(thread.items);
      } catch {
        if (!cancelled) setThreadPosts(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [post.id]);

  const visiblePosts = useMemo(
    () => threadPosts && threadPosts.length > 1 ? threadPosts : [post],
    [post, threadPosts],
  );

  const interaction = usePostInteractionState(visiblePosts);
  const isThread = visiblePosts.length > 1;

  return (
    <>
      <section className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-0 md:py-12">
        {isThread ? (
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
            <span>Thread</span>
            <span aria-hidden="true">·</span>
            <span>{visiblePosts.length} Posts</span>
          </div>
        ) : null}

        {visiblePosts.map((item, index) => {
          const key = `${item.actor.type}:${item.actor.id}`;
          const isLast = index === visiblePosts.length - 1;
          const isCurrent = item.id === post.id;

          return (
            <article
              key={item.id}
              aria-current={isCurrent ? "true" : undefined}
              className={`relative ${index > 0 ? "pt-7" : "pt-4"} ${
                !isLast ? "pb-7" : "pb-2"
              }`}
            >
              {isThread && !isLast ? (
                <div
                  aria-hidden="true"
                  className="absolute left-[23px] top-[64px] bottom-[-12px] w-px bg-[var(--wk-border)]"
                />
              ) : null}

              <header className="relative flex items-center gap-3">
                <Link
                  to={item.actor.canonicalPath}
                  className="relative z-[1] shrink-0"
                  aria-label={item.actor.name}
                >
                  {item.actor.imageUrl ? (
                    <img
                      src={item.actor.imageUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[13px] font-black text-[var(--wk-brand)]">
                      {item.actor.name[0]?.toUpperCase() || "W"}
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={item.actor.canonicalPath}
                    className="truncate text-[15px] font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
                  >
                    {item.actor.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)]">
                    {item.actor.official ? (
                      <>
                        <span>Official Artist</span>
                        <span aria-hidden="true">·</span>
                      </>
                    ) : null}
                    <time dateTime={item.publishedAt}>
                      {formatDate(item.publishedAt)}
                    </time>
                    {isCurrent && isThread ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Post {index + 1} of {visiblePosts.length}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="ml-[60px]">
                {item.body ? (
                  <p className="mt-5 whitespace-pre-wrap text-[19px] font-semibold leading-[1.55] tracking-[-0.015em] text-[var(--wk-text)] md:text-[22px]">
                    {item.body}
                  </p>
                ) : null}

                {item.track ? (
                  <PostTrackAttachment
                    track={item.track}
                    className="mt-5"
                  />
                ) : null}

                {item.imageUrl ? (
                  <div className="mt-5 overflow-hidden rounded-[28px] bg-[var(--wk-surface-raised)]">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="max-h-[760px] w-full object-cover"
                    />
                  </div>
                ) : null}

                {item.linkUrl ? (
                  <PostLinkAttachment
                    linkUrl={item.linkUrl}
                    linkLabel={item.linkLabel}
                    className="mt-5 block"
                  />
                ) : null}

                {item.quotedPost ? (
                  <QuotedPostCard
                    quotedPost={item.quotedPost}
                    className="mt-5"
                  />
                ) : null}

                <PostActions
                  post={item}
                  saved={interaction.savedPostIds.has(item.id)}
                  saving={interaction.savingPostIds.has(item.id)}
                  reactionState={interaction.reactionStates.get(item.id)}
                  reacting={interaction.reactingPostIds.has(item.id)}
                  actionActor={interaction.viewerActor}
                  followed={interaction.followedActorKeys.has(key)}
                  following={interaction.followingActorKeys.has(key)}
                  repostState={interaction.repostStates.get(item.id)}
                  reposting={interaction.repostingPostIds.has(item.id)}
                  blocked={interaction.blockedActorKeys.has(key)}
                  blocking={interaction.blockingActorKeys.has(key)}
                  reporting={interaction.reportingPostIds.has(item.id)}
                  canManage={interaction.manageableActorKeys.has(key)}
                  onToggleSave={() => void interaction.toggleSave(item)}
                  onToggleFollow={() => void interaction.toggleFollow(item.actor)}
                  onReact={(reactionType) => void interaction.toggleReaction(item, reactionType)}
                  onToggleRepost={() => void interaction.toggleRepost(item)}
                  onToggleBlock={() => void interaction.toggleBlock(item.actor)}
                  onReport={(reason) => interaction.submitReport(item, reason)}
                  onWithdrawn={() => navigate(item.actor.canonicalPath)}
                />
              </div>
            </article>
          );
        })}
      </section>

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

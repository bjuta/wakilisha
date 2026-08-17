import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import { PostActions } from "@/components/community/PostActions";
import { QuotedPostCard } from "@/components/community/QuotedPostCard";
import { PostLinkAttachment } from "@/components/community/PostLinkAttachment";
import { PostTrackAttachment } from "@/components/community/PostTrackAttachment";
import { usePostInteractionState } from "@/hooks/usePostInteractionState";
import {
  listArtistPosts,
  type CommunityPost,
} from "@/services/community/posts";

function formatPostDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "numeric",
      month: "short",
      year:
        date.getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    },
  ).format(date);
}

export function ArtistPostsTimeline({
  artistId,
  artistName,
  artistImageUrl,
  revision = 0,
}: {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
  revision?: number;
}) {
  const [
    posts,
    setPosts,
  ] =
    useState<CommunityPost[]>([]);
  const [
    loading,
    setLoading,
  ] = useState(true);

  const interaction = usePostInteractionState(posts);

  useEffect(
    () => {
      let alive = true;

      setLoading(true);

      listArtistPosts(
        artistId,
        20,
      )
        .then(
          (items) => {
            if (alive) {
              setPosts(items);
            }
          },
        )
        .catch(
          () => {
            if (alive) {
              setPosts([]);
            }
          },
        )
        .finally(
          () => {
            if (alive) {
              setLoading(false);
            }
          },
        );

      return () => {
        alive = false;
      };
    },
    [
      artistId,
      revision,
    ],
  );

  if (
    !loading &&
    posts.length === 0
  ) {
    return null;
  }

  return (
    <section
      aria-label={`${artistName} Posts`}
      className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]"
    >
      <div className="wk-container px-6 py-6 md:py-8">
        <div className="max-w-[760px]">
          {loading ? (
            <div className="space-y-4">
              {Array.from({
                length: 2,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="animate-pulse border-b border-[var(--wk-divider)] pb-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[var(--wk-surface-raised)]" />
                      <div className="space-y-2">
                        <div className="h-3 w-32 rounded bg-[var(--wk-surface-raised)]" />
                        <div className="h-2.5 w-20 rounded bg-[var(--wk-surface-raised)]" />
                      </div>
                    </div>
                    <div className="mt-4 h-5 w-4/5 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                ),
              )}
            </div>
          ) : (
            <div>
              {posts.map(
                (post) => (
                  <article
                    key={post.id}
                    className="border-b border-[var(--wk-divider)] py-6 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        to={post.actor.canonicalPath}
                        className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]"
                        aria-label={post.actor.name}
                      >
                        {post.actor.imageUrl ||
                        artistImageUrl ? (
                          <img
                            src={
                              post.actor.imageUrl ||
                              artistImageUrl ||
                              ""
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[13px] font-black text-[var(--wk-brand)]">
                            {artistName
                              .slice(
                                0,
                                1,
                              )
                              .toUpperCase()}
                          </span>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          to={post.actor.canonicalPath}
                          className="truncate text-[13px] font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
                        >
                          {post.actor.name}
                        </Link>
                        <div className="mt-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">
                          {formatPostDate(
                            post.publishedAt,
                          )}
                        </div>
                      </div>
                    </div>

                    {post.body ? (
                      <p className="mt-4 whitespace-pre-wrap text-[16px] font-semibold leading-[1.55] tracking-[-0.01em] text-[var(--wk-text)] md:text-[18px]">
                        {post.body}
                      </p>
                    ) : null}

                    {post.track ? (
                      <PostTrackAttachment
                        track={post.track}
                        className="mt-4"
                      />
                    ) : null}

                    {post.imageUrl ? (
                      <Link
                        to={post.canonicalPath}
                        className="mt-4 block overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]"
                      >
                        <img
                          src={post.imageUrl}
                          alt=""
                          loading="lazy"
                          className="max-h-[560px] w-full object-cover"
                        />
                      </Link>
                    ) : null}

                    {post.linkUrl ? (
                      <PostLinkAttachment
                        linkUrl={post.linkUrl}
                        linkLabel={post.linkLabel}
                        className="mt-4 block"
                      />
                    ) : null}


                    {post.quotedPost && (
                      <QuotedPostCard
                        quotedPost={post.quotedPost}
                        className="mt-4"
                      />
                    )}

                    <PostActions
                      post={post}
                      saved={interaction.savedPostIds.has(post.id)}
                      saving={interaction.savingPostIds.has(post.id)}
                      reactionState={interaction.reactionStates.get(post.id)}
                      reacting={interaction.reactingPostIds.has(post.id)}
                      actionActor={interaction.viewerActor}
                      followed={interaction.followedActorKeys.has(`${post.actor.type}:${post.actor.id}`)}
                      following={interaction.followingActorKeys.has(`${post.actor.type}:${post.actor.id}`)}
                      repostState={interaction.repostStates.get(post.id)}
                      reposting={interaction.repostingPostIds.has(post.id)}
                      blocked={interaction.blockedActorKeys.has(`${post.actor.type}:${post.actor.id}`)}
                      blocking={interaction.blockingActorKeys.has(`${post.actor.type}:${post.actor.id}`)}
                      reporting={interaction.reportingPostIds.has(post.id)}
                      canManage={interaction.manageableActorKeys.has(`${post.actor.type}:${post.actor.id}`)}
                      onToggleSave={() => void interaction.toggleSave(post)}
                      onToggleFollow={() => void interaction.toggleFollow(post.actor)}
                      onReact={(reactionType) => void interaction.toggleReaction(post, reactionType)}
                      onToggleRepost={() => void interaction.toggleRepost(post)}
                      onToggleBlock={() => void interaction.toggleBlock(post.actor)}
                      onReport={(reason) => interaction.submitReport(post, reason)}
                      onWithdrawn={(postId) => setPosts((current) => current.filter((item) => item.id !== postId))}
                    />
                  </article>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import {
  Link,
} from "react-router-dom";
import { PostBody } from "@/components/community/PostBody";
import { PostTrackAttachment } from "@/components/community/PostTrackAttachment";
import { PostLinkAttachment } from "@/components/community/PostLinkAttachment";
import type {
  CommunityQuotedPost,
} from "@/services/community/posts";

export function QuotedPostCard({
  quotedPost,
  className = "",
}: {
  quotedPost: CommunityQuotedPost;
  className?: string;
}) {
  if (!quotedPost.available) {
    return (
      <div
        data-quoted-post="unavailable"
        className={`rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--wk-text-muted)]">
          <i
            className="ri-file-warning-line text-[16px]"
            aria-hidden="true"
          />
          {quotedPost.unavailableReason === "blocked"
            ? quotedPost.actorType === "artist"
              ? "You blocked this Artist. Unblock them to view the original Post."
              : "You blocked this Person. Unblock them to view the original Post."
            : "The original Post is unavailable."}
        </div>
      </div>
    );
  }

  const actor =
    quotedPost.actor;

  if (!actor || !quotedPost.canonicalPath) {
    return null;
  }

  return (
    <div
      data-quoted-post="available"
      className={`overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] ${className}`}
    >
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <Link
            to={actor.canonicalPath}
            className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--wk-brand-soft)]"
            aria-label={actor.name}
          >
            {actor.imageUrl ? (
              <img
                src={actor.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-[var(--wk-brand)]">
                {actor.name[0]?.toUpperCase() || "W"}
              </div>
            )}
          </Link>

          <div className="min-w-0">
            <Link
              to={actor.canonicalPath}
              className="truncate text-[12px] font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
            >
              {actor.name}
            </Link>
            <div className="truncate text-[10px] font-semibold text-[var(--wk-text-faint)]">
              @{actor.slug}
            </div>
          </div>
        </div>

        {quotedPost.body ? (
          <div className="relative mt-3">
            <Link
              to={quotedPost.canonicalPath}
              aria-label={`View Post from ${actor.name}`}
              className="absolute inset-0 z-0"
            />
            <PostBody
              body={quotedPost.body}
              mentions={quotedPost.mentions}
              className="pointer-events-none relative z-[1] line-clamp-4 whitespace-pre-wrap text-[13px] font-semibold leading-[1.5] text-[var(--wk-text)] [&_a]:pointer-events-auto"
            />
          </div>
        ) : null}

        {quotedPost.track ? (
          <PostTrackAttachment
            track={quotedPost.track}
            compact
            showActions={false}
            className="mt-3"
          />
        ) : null}
      </div>

      {quotedPost.imageUrl && (
        <Link to={quotedPost.canonicalPath} className="block border-t border-[var(--wk-border)]">
          <img
            src={quotedPost.imageUrl}
            alt=""
            loading="lazy"
            className="max-h-[360px] w-full object-cover"
          />
        </Link>
      )}

      {quotedPost.linkUrl ? (
        <div className="border-t border-[var(--wk-border)] p-3">
          <PostLinkAttachment
            linkUrl={quotedPost.linkUrl}
            linkLabel={quotedPost.linkLabel}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}

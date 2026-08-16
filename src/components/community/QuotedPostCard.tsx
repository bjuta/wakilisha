import {
  Link,
} from "react-router-dom";
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
              : "You blocked this person. Unblock them to view the original Post."
            : "The original Post is unavailable."}
        </div>
      </div>
    );
  }

  const actor =
    quotedPost.actor;

  if (
    !actor ||
    !quotedPost.canonicalPath ||
    !quotedPost.body
  ) {
    return null;
  }

  return (
    <Link
      data-quoted-post="available"
      to={quotedPost.canonicalPath}
      className={`block overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] transition-colors hover:border-[var(--wk-brand)]/45 ${className}`}
    >
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--wk-brand-soft)]">
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
          </div>

          <div className="min-w-0">
            <div className="truncate text-[12px] font-black text-[var(--wk-text)]">
              {actor.name}
            </div>
            <div className="truncate text-[10px] font-semibold text-[var(--wk-text-faint)]">
              @{actor.slug}
            </div>
          </div>
        </div>

        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[13px] font-semibold leading-[1.5] text-[var(--wk-text)]">
          {quotedPost.body}
        </p>
      </div>

      {quotedPost.imageUrl && (
        <img
          src={quotedPost.imageUrl}
          alt=""
          loading="lazy"
          className="max-h-[360px] w-full border-t border-[var(--wk-border)] object-cover"
        />
      )}
    </Link>
  );
}

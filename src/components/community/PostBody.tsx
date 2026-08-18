import { Fragment } from "react";
import { Link } from "react-router-dom";
import {
  tokenizePostBodyMentions,
} from "@/services/community/postBodyMentions";
import type {
  PostMention,
} from "@/services/community/posts";

export function PostBody({
  body,
  mentions,
  className = "",
  canonicalPath = null,
  openLabel = "Open Post",
}: {
  body: string;
  mentions: readonly PostMention[];
  className?: string;
  canonicalPath?: string | null;
  openLabel?: string;
}) {
  const tokens =
    tokenizePostBodyMentions(
      body,
      mentions,
    );

  const content = (
    <p
      className={`${
        canonicalPath
          ? "pointer-events-none relative z-[1] [&_a]:pointer-events-auto"
          : ""
      } ${className}`.trim()}
    >
      {tokens.map((token, index) => {
        if (token.type === "mention") {
          return (
            <Link
              key={`${token.personId}:${index}`}
              to={token.canonicalPath}
              data-post-mention-person-id={token.personId}
              className="text-[var(--wk-brand)] underline-offset-2 hover:underline focus-visible:underline"
            >
              {token.value}
            </Link>
          );
        }

        return (
          <Fragment key={`text:${index}`}>
            {token.value}
          </Fragment>
        );
      })}
    </p>
  );

  if (!canonicalPath) {
    return content;
  }

  return (
    <div className="relative">
      <Link
        to={canonicalPath}
        aria-label={openLabel}
        className="absolute inset-0 z-0 rounded-[inherit]"
      />
      {content}
    </div>
  );
}

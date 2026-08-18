export type PostMentionComposerQuery = {
  query: string;
  start: number;
  end: number;
};

export function findPostMentionComposerQuery(
  body: string,
  caret: number | null,
): PostMentionComposerQuery | null {
  if (caret == null) return null;

  const safeCaret =
    Math.min(Math.max(caret, 0), body.length);
  const before = body.slice(0, safeCaret);
  const match =
    /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,30})$/.exec(before);

  if (!match) return null;

  const authored = match[2] ?? "";
  const start = safeCaret - authored.length - 1;
  const tokenBoundary = Math.max(
    before.lastIndexOf(" ", start - 1),
    before.lastIndexOf("\n", start - 1),
    before.lastIndexOf("\t", start - 1),
  );
  const containingToken =
    before.slice(tokenBoundary + 1, safeCaret);

  if (
    /^https?:\/\//i.test(containingToken) ||
    containingToken.includes("://")
  ) {
    return null;
  }

  return {
    query: authored.toLowerCase(),
    start,
    end: safeCaret,
  };
}

export function applyPostMentionSuggestion(
  body: string,
  activeQuery: PostMentionComposerQuery,
  handle: string,
): {
  body: string;
  caret: number;
} {
  const cleanHandle =
    handle.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(cleanHandle)) {
    return {
      body,
      caret: activeQuery.end,
    };
  }

  const suffix = body.slice(activeQuery.end);
  const needsSpace =
    suffix.length === 0 ||
    /^[A-Za-z0-9_@]/.test(suffix);
  const inserted =
    `@${cleanHandle}${needsSpace ? " " : ""}`;
  const nextBody =
    `${body.slice(0, activeQuery.start)}${inserted}${suffix}`;

  return {
    body: nextBody,
    caret: activeQuery.start + inserted.length,
  };
}

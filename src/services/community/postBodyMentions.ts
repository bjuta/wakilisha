import type { PostMention } from "@/services/community/posts";

export type PostBodyToken =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "mention";
      value: string;
      handle: string;
      personId: string;
      canonicalPath: string;
    };

function appendText(
  tokens: PostBodyToken[],
  value: string,
) {
  if (!value) return;

  const previous = tokens[tokens.length - 1];

  if (previous?.type === "text") {
    previous.value += value;
    return;
  }

  tokens.push({
    type: "text",
    value,
  });
}

function tokenizePlainText(
  value: string,
  mentionsByHandle: Map<string, PostMention>,
  tokens: PostBodyToken[],
) {
  const mentionPattern =
    /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,30})(?=$|[^A-Za-z0-9_])/g;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(value)) !== null) {
    const prefix = match[1] ?? "";
    const authoredHandle = match[2] ?? "";
    const mentionStart = match.index + prefix.length;
    const mentionEnd =
      mentionStart + authoredHandle.length + 1;
    const confirmed =
      mentionsByHandle.get(
        authoredHandle.toLowerCase(),
      );

    appendText(
      tokens,
      value.slice(cursor, mentionStart),
    );

    if (confirmed) {
      tokens.push({
        type: "mention",
        value: value.slice(
          mentionStart,
          mentionEnd,
        ),
        handle: confirmed.handle,
        personId: confirmed.personId,
        canonicalPath:
          confirmed.canonicalPath,
      });
    } else {
      appendText(
        tokens,
        value.slice(
          mentionStart,
          mentionEnd,
        ),
      );
    }

    cursor = mentionEnd;
  }

  appendText(tokens, value.slice(cursor));
}

export function tokenizePostBodyMentions(
  body: string,
  mentions: readonly PostMention[],
): PostBodyToken[] {
  const mentionsByHandle =
    new Map<string, PostMention>();

  mentions.forEach((mention) => {
    const handle =
      mention.handle.trim().toLowerCase();

    if (
      !handle ||
      !mention.canonicalPath.startsWith(
        "/people/",
      ) ||
      mentionsByHandle.has(handle)
    ) {
      return;
    }

    mentionsByHandle.set(
      handle,
      mention,
    );
  });

  if (
    !body ||
    mentionsByHandle.size === 0
  ) {
    return body
      ? [{ type: "text", value: body }]
      : [];
  }

  const tokens: PostBodyToken[] = [];
  const urlPattern =
    /https?:\/\/[^\s]+/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(body)) !== null) {
    tokenizePlainText(
      body.slice(cursor, match.index),
      mentionsByHandle,
      tokens,
    );

    appendText(tokens, match[0]);
    cursor = match.index + match[0].length;
  }

  tokenizePlainText(
    body.slice(cursor),
    mentionsByHandle,
    tokens,
  );

  return tokens;
}

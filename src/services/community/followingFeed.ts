import { supabase } from "@/lib/supabase";
import {
  mapPostActor,
  type PostActor,
} from "@/services/community/posts";

export type FollowingFeedSubjectType =
  | "person"
  | "artist";

export type FollowingFeedItemType =
  | "article"
  | "playlist"
  | "release"
  | "artist_update"
  | "post";

export type FollowingFeedReason = {
  targetType: FollowingFeedSubjectType;
  targetId: string;
  targetSlug: string | null;
  followedAt: string;
};

export type FollowingFeedItem = {
  itemType: FollowingFeedItemType;
  itemId: string;
  itemKey: string;
  canonicalPath: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  publishedAt: string;
  matchedFollows: FollowingFeedReason[];
};

export type FollowingFeedCursor = {
  publishedAt: string;
  itemKey: string;
};

export type FollowingFeedResponse = {
  mode: "current_interest";
  subjectTypes: ["person", "artist"];
  recentWindowDays: number;
  perSubjectRecentLimit: number;
  viewerActor: PostActor | null;
  items: FollowingFeedItem[];
};

type FollowingFeedQuery = {
  limit?: number;
  cursor?: FollowingFeedCursor | null;
};

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();

  return clean || null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return value;
}

function isSubjectType(
  value: string,
): value is FollowingFeedSubjectType {
  return value === "person" || value === "artist";
}

function isItemType(
  value: string,
): value is FollowingFeedItemType {
  return (
    value === "article" ||
    value === "playlist" ||
    value === "release" ||
    value === "artist_update" ||
    value === "post"
  );
}

function decodeReason(
  value: unknown,
): FollowingFeedReason | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const targetType =
    readString(record, "target_type");
  const targetId =
    readString(record, "target_id");
  const followedAt =
    readString(record, "followed_at");

  if (
    !targetType ||
    !isSubjectType(targetType) ||
    !targetId ||
    !followedAt
  ) {
    return null;
  }

  return {
    targetType,
    targetId,
    targetSlug:
      readString(record, "target_slug"),
    followedAt,
  };
}

function decodeItem(
  value: unknown,
): FollowingFeedItem | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const itemType =
    readString(record, "item_type");
  const itemId =
    readString(record, "item_id");
  const itemKey =
    readString(record, "item_key");
  const canonicalPath =
    readString(record, "canonical_path");
  const title =
    readString(record, "title");
  const publishedAt =
    readString(record, "published_at");

  if (
    !itemType ||
    !isItemType(itemType) ||
    !itemId ||
    !itemKey ||
    !canonicalPath ||
    !canonicalPath.startsWith("/") ||
    !title ||
    !publishedAt
  ) {
    return null;
  }

  const rawReasons =
    Array.isArray(record.matched_follows)
      ? record.matched_follows
      : [];

  const matchedFollows =
    rawReasons.flatMap((reason) => {
      const decoded = decodeReason(reason);
      return decoded ? [decoded] : [];
    });

  if (matchedFollows.length === 0) {
    return null;
  }

  return {
    itemType,
    itemId,
    itemKey,
    canonicalPath,
    title,
    summary:
      readString(record, "summary"),
    imageUrl:
      readString(record, "image_url"),
    linkUrl:
      readString(record, "link_url"),
    linkLabel:
      readString(record, "link_label"),
    publishedAt,
    matchedFollows,
  };
}

export function decodeFollowingFeed(
  value: unknown,
): FollowingFeedResponse {
  const record = asRecord(value);

  if (!record) {
    throw new Error(
      "Following feed returned an invalid response.",
    );
  }

  const mode =
    readString(record, "mode");
  const recentWindowDays =
    readNumber(record, "recent_window_days");
  const perSubjectRecentLimit =
    readNumber(record, "per_subject_recent_limit");
  const rawSubjectTypes =
    Array.isArray(record.subject_types)
      ? record.subject_types
      : [];

  if (
    mode !== "current_interest" ||
    rawSubjectTypes.length !== 2 ||
    rawSubjectTypes[0] !== "person" ||
    rawSubjectTypes[1] !== "artist" ||
    recentWindowDays !== 180 ||
    perSubjectRecentLimit !== 3
  ) {
    throw new Error(
      "Following feed contract does not match this WAKILISHA client.",
    );
  }

  const viewerActor =
    record.viewer_actor == null
      ? null
      : mapPostActor(
          record.viewer_actor,
        );

  if (
    record.viewer_actor != null &&
    !viewerActor
  ) {
    throw new Error(
      "Following returned an invalid viewer Post actor.",
    );
  }

  const rawItems =
    Array.isArray(record.items)
      ? record.items
      : [];

  const items =
    rawItems.flatMap((item) => {
      const decoded =
        decodeItem(item);

      return decoded
        ? [decoded]
        : [];
    });

  return {
    mode,
    subjectTypes: [
      "person",
      "artist",
    ],
    recentWindowDays,
    perSubjectRecentLimit,
    viewerActor,
    items,
  };
}

export async function getFollowingFeed(
  query: FollowingFeedQuery = {},
): Promise<FollowingFeedResponse> {
  const requestedLimit =
    query.limit ?? 12;
  const limit =
    Math.min(
      50,
      Math.max(
        1,
        Math.round(requestedLimit),
      ),
    );

  const { data, error } =
    await supabase.rpc(
      "community_get_social_feed",
      {
        p_limit: limit,
        p_before_published_at:
          query.cursor?.publishedAt ?? null,
        p_before_item_key:
          query.cursor?.itemKey ?? null,
      },
    );

  if (error) {
    throw error;
  }

  return decodeFollowingFeed(data);
}

export function followingFeedCursorFrom(
  items: FollowingFeedItem[],
): FollowingFeedCursor | null {
  const last =
    items[items.length - 1];

  if (!last) {
    return null;
  }

  return {
    publishedAt: last.publishedAt,
    itemKey: last.itemKey,
  };
}

import { supabase } from "@/lib/supabase";

export type PostActorType = "person" | "artist";

export type PostActor = {
  type: PostActorType;
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  canonicalPath: string;
  official: boolean;
};

export type PostTrack = {
  id: string;
  title: string;
  artistName: string | null;
  artistSlug: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  trackSlug: string | null;
  releaseId: string | null;
  releaseTitle: string | null;
  releaseSlug: string | null;
  canonicalPath: string | null;
};

export type CommunityQuotedPost = {
  id: string;
  available: boolean;
  unavailableReason: "blocked" | "unavailable" | null;
  actorType: PostActorType | null;
  actor: PostActor | null;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  track: PostTrack | null;
  publishedAt: string | null;
  canonicalPath: string | null;
};

export type CommunityPost = {
  id: string;
  actorType: PostActorType;
  actorId: string;
  actor: PostActor;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  track: PostTrack | null;
  status: "published" | "withdrawn";
  publishedAt: string;
  withdrawnAt: string | null;
  updatedAt: string;
  quotedPostId: string | null;
  quotedPost: CommunityQuotedPost | null;
  canonicalPath: string;
};

export type PostRepostState = {
  postId: string;
  repostCount: number;
  viewerReposted: boolean;
  viewerRepostId: string | null;
};

export type PostBlockState = {
  blocked: boolean;
  blockId: string | null;
  targetType: PostActorType;
  targetId: string;
  targetSlug: string | null;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function readString(record: JsonRecord | null, key: string): string | null {
  const value = record?.[key];
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean || null;
}

function readBody(record: JsonRecord | null): string | null {
  const value = record?.body;
  return typeof value === "string" ? value.trim() : null;
}

function readNumber(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function isActorType(value: string): value is PostActorType {
  return value === "person" || value === "artist";
}

export function mapPostTrack(value: unknown): PostTrack | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const title = readString(record, "title");
  const canonicalPath = readString(record, "canonical_path");

  if (!record || !id || !title) {
    return null;
  }

  if (canonicalPath && !canonicalPath.startsWith("/")) {
    return null;
  }

  return {
    id,
    title,
    artistName: readString(record, "artist_name"),
    artistSlug: readString(record, "artist_slug"),
    artworkUrl: readString(record, "artwork_url"),
    previewUrl: readString(record, "preview_url"),
    durationMs: readNumber(record, "duration_ms"),
    trackSlug: readString(record, "track_slug"),
    releaseId: readString(record, "release_id"),
    releaseTitle: readString(record, "release_title"),
    releaseSlug: readString(record, "release_slug"),
    canonicalPath,
  };
}

export function mapPostActor(value: unknown): PostActor | null {
  const record = asRecord(value);
  const type = readString(record, "type");
  const id = readString(record, "id");
  const slug = readString(record, "slug");
  const name = readString(record, "name");
  const canonicalPath = readString(record, "canonical_path");

  if (
    !record || !type || !isActorType(type) || !id || !slug ||
    !name || !canonicalPath || !canonicalPath.startsWith("/")
  ) {
    return null;
  }

  return {
    type,
    id,
    slug,
    name,
    imageUrl: readString(record, "image_url"),
    canonicalPath,
    official: record.official === true,
  };
}

export function mapCommunityQuotedPost(
  value: unknown,
): CommunityQuotedPost | null {
  const record = asRecord(value);
  const id = readString(record, "id");

  if (!record || !id || typeof record.available !== "boolean") {
    return null;
  }

  if (!record.available) {
    const unavailableReason =
      readString(record, "unavailable_reason") === "blocked"
        ? "blocked"
        : "unavailable";

    const rawActorType =
      readString(record, "actor_type");

    const actorType =
      rawActorType === "person" ||
      rawActorType === "artist"
        ? rawActorType
        : null;

    return {
      id,
      available: false,
      unavailableReason,
      actorType,
      actor: null,
      body: null,
      imageUrl: null,
      linkUrl: null,
      linkLabel: null,
      track: null,
      publishedAt: null,
      canonicalPath: null,
    };
  }

  const actor = mapPostActor(record.actor);
  const body = readBody(record);
  const imageUrl = readString(record, "image_url");
  const linkUrl = readString(record, "link_url");
  const track = record.track == null
    ? null
    : mapPostTrack(record.track);
  const publishedAt = readString(record, "published_at");
  const canonicalPath = readString(record, "canonical_path");

  if (
    !actor ||
    body == null ||
    !publishedAt ||
    !canonicalPath ||
    (record.track != null && !track) ||
    !(body.trim() || imageUrl || linkUrl || track)
  ) {
    return null;
  }

  return {
    id,
    available: true,
    unavailableReason: null,
    actorType: actor.type,
    actor,
    body,
    imageUrl,
    linkUrl,
    linkLabel: readString(record, "link_label"),
    track,
    publishedAt,
    canonicalPath,
  };
}

export function mapCommunityPost(value: unknown): CommunityPost | null {
  const record = asRecord(value);
  const actor = mapPostActor(record?.actor);
  const id = readString(record, "id");
  const actorType = readString(record, "actor_type");
  const actorId = readString(record, "actor_id");
  const body = readBody(record);
  const imageUrl = readString(record, "image_url");
  const linkUrl = readString(record, "link_url");
  const track = record?.track == null
    ? null
    : mapPostTrack(record.track);
  const status = readString(record, "status");
  const publishedAt = readString(record, "published_at");
  const updatedAt = readString(record, "updated_at");
  const canonicalPath = readString(record, "canonical_path");

  if (
    !record || !actor || !id || !actorType || !isActorType(actorType) ||
    !actorId || body == null ||
    (record.track != null && !track) ||
    !(body.trim() || imageUrl || linkUrl || track) ||
    (status !== "published" && status !== "withdrawn") ||
    !publishedAt || !updatedAt || !canonicalPath
  ) {
    return null;
  }

  const quotedPostId =
    readString(record, "quoted_post_id");
  const quotedPost =
    record?.quoted_post == null
      ? null
      : mapCommunityQuotedPost(
          record.quoted_post,
        );

  if (
    quotedPostId &&
    !quotedPost
  ) {
    return null;
  }

  return {
    id,
    actorType,
    actorId,
    actor,
    body,
    imageUrl,
    linkUrl,
    linkLabel: readString(record, "link_label"),
    track,
    status,
    publishedAt,
    withdrawnAt: readString(record, "withdrawn_at"),
    updatedAt,
    quotedPostId,
    quotedPost,
    canonicalPath,
  };
}

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    parameters?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;

  const { data, error } = await invoke(name, args);
  if (error) throw new Error(error.message || `${name} failed`);
  return data;
}

export async function publishPost(input: {
  actor: PostActor;
  body: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  registryTrackId?: string | null;
}): Promise<CommunityPost> {
  const data = await rpc("community_publish_post", {
    p_actor_type: input.actor.type,
    p_actor_id: input.actor.id,
    p_body: input.body,
    p_image_url: input.imageUrl || null,
    p_link_url: input.linkUrl || null,
    p_link_label: input.linkLabel || null,
    p_registry_track_id: input.registryTrackId || null,
  });
  const post = mapCommunityPost(data);
  if (!post) throw new Error("Post returned an invalid publish response.");
  return post;
}

export async function quotePost(input: {
  actor: PostActor;
  quotedPostId: string;
  body: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  registryTrackId?: string | null;
}): Promise<CommunityPost> {
  const data = await rpc("community_quote_post", {
    p_actor_type: input.actor.type,
    p_actor_id: input.actor.id,
    p_quoted_post_id: input.quotedPostId,
    p_body: input.body,
    p_image_url: input.imageUrl || null,
    p_link_url: input.linkUrl || null,
    p_link_label: input.linkLabel || null,
    p_registry_track_id: input.registryTrackId || null,
  });
  const post = mapCommunityPost(data);
  if (!post) throw new Error("Post returned an invalid Quote Post response.");
  return post;
}

export async function setPostRepostState(input: {
  actor: PostActor;
  postId: string;
  reposted: boolean;
}): Promise<{
  reposted: boolean;
  repostId: string | null;
  changed: boolean;
}> {
  const data = asRecord(
    await rpc("community_set_post_repost_state", {
      p_actor_type: input.actor.type,
      p_actor_id: input.actor.id,
      p_post_id: input.postId,
      p_reposted: input.reposted,
    }),
  );

  if (!data || typeof data.reposted !== "boolean") {
    throw new Error("Repost returned an invalid response.");
  }

  return {
    reposted: data.reposted,
    repostId: readString(data, "repost_id"),
    changed: data.changed === true,
  };
}

export async function getActorRepostState(
  actor: PostActor,
  postIds: string[],
): Promise<PostRepostState[]> {
  if (postIds.length === 0) return [];

  const data = await rpc("community_get_actor_repost_state", {
    p_actor_type: actor.type,
    p_actor_id: actor.id,
    p_post_ids: Array.from(new Set(postIds)).slice(0, 100),
  });

  if (!Array.isArray(data)) {
    throw new Error("Repost state returned an invalid response.");
  }

  return data.flatMap((value) => {
    const record = asRecord(value);
    const postId = readString(record, "post_id");
    const repostCount = record?.repost_count;
    const viewerReposted = record?.viewer_reposted;

    if (
      !postId ||
      typeof repostCount !== "number" ||
      !Number.isFinite(repostCount) ||
      typeof viewerReposted !== "boolean"
    ) {
      return [];
    }

    return [{
      postId,
      repostCount: Math.max(0, Math.floor(repostCount)),
      viewerReposted,
      viewerRepostId: readString(record, "viewer_repost_id"),
    }];
  });
}

export async function setBlockState(
  actor: PostActor,
  blocked: boolean,
): Promise<PostBlockState> {
  const data = asRecord(
    await rpc("community_set_block_state", {
      p_target_type: actor.type,
      p_target_id: actor.id,
      p_target_slug: actor.slug,
      p_blocked: blocked,
    }),
  );

  const targetType = readString(data, "target_type");
  const targetId = readString(data, "target_id");

  if (
    !data ||
    typeof data.blocked !== "boolean" ||
    !targetType ||
    !isActorType(targetType) ||
    !targetId
  ) {
    throw new Error("Block returned an invalid response.");
  }

  return {
    blocked: data.blocked,
    blockId: readString(data, "block_id"),
    targetType,
    targetId,
    targetSlug: readString(data, "target_slug"),
  };
}

export async function getBlockState(
  actor: PostActor,
): Promise<PostBlockState> {
  const data = asRecord(
    await rpc("community_get_block_state", {
      p_target_type: actor.type,
      p_target_id: actor.id,
      p_target_slug: actor.slug,
    }),
  );

  const targetType = readString(data, "target_type");
  const targetId = readString(data, "target_id");

  if (
    !data ||
    typeof data.blocked !== "boolean" ||
    !targetType ||
    !isActorType(targetType) ||
    !targetId
  ) {
    throw new Error("Block state returned an invalid response.");
  }

  return {
    blocked: data.blocked,
    blockId: readString(data, "block_id"),
    targetType,
    targetId,
    targetSlug: readString(data, "target_slug"),
  };
}

export async function reportPost(input: {
  postId: string;
  reason:
    | "spam"
    | "harassment"
    | "hate_or_abuse"
    | "misinformation"
    | "privacy"
    | "copyright"
    | "off_topic"
    | "other";
  details?: string;
}): Promise<{ created: boolean; reportCount: number }> {
  const data = asRecord(
    await rpc("community_report_post", {
      p_post_id: input.postId,
      p_reason: input.reason,
      p_details: input.details || "",
    }),
  );

  if (
    !data ||
    typeof data.created !== "boolean" ||
    typeof data.report_count !== "number" ||
    !Number.isFinite(data.report_count)
  ) {
    throw new Error("Post Report returned an invalid response.");
  }

  return {
    created: data.created,
    reportCount: Math.max(0, Math.floor(data.report_count)),
  };
}

export async function editPost(input: {
  postId: string;
  body: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  registryTrackId?: string | null;
}): Promise<CommunityPost> {
  const data = await rpc("community_edit_post", {
    p_post_id: input.postId,
    p_body: input.body,
    p_image_url: input.imageUrl || null,
    p_link_url: input.linkUrl || null,
    p_link_label: input.linkLabel || null,
    p_registry_track_id: input.registryTrackId || null,
  });
  const post = mapCommunityPost(data);
  if (!post) throw new Error("Post returned an invalid edit response.");
  return post;
}

export async function withdrawPost(postId: string, reason: string): Promise<void> {
  await rpc("community_withdraw_post", {
    p_post_id: postId,
    p_reason: reason,
  });
}

export async function getPost(postId: string): Promise<CommunityPost> {
  const post = mapCommunityPost(
    await rpc("community_get_post", { p_post_id: postId }),
  );
  if (!post) throw new Error("Post was not found.");
  return post;
}

export async function listArtistPosts(
  artistId: string,
  limit = 20,
): Promise<CommunityPost[]> {
  const data =
    await rpc(
      "community_list_artist_posts",
      {
        p_artist_id: artistId,
        p_limit:
          Math.min(
            50,
            Math.max(
              1,
              Math.round(limit),
            ),
          ),
      },
    );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap(
    (value) => {
      const post =
        mapCommunityPost(value);

      if (
        !post ||
        post.actorType !== "artist" ||
        post.actorId !== artistId ||
        post.status !== "published"
      ) {
        return [];
      }

      return [post];
    },
  );
}

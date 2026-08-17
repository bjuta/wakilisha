import { supabase } from "@/lib/supabase";
import {
  mapCommunityPost,
  mapPostTrack,
  type CommunityPost,
  type PostActor,
  type PostActorType,
  type PostTrack,
} from "@/services/community/posts";

type JsonRecord = Record<string, unknown>;

export type CommunityPostDraft = {
  id: string;
  draftGroupId: string;
  position: number;
  actorType: PostActorType;
  actorId: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  track: PostTrack | null;
  quotedPostId: string | null;
  quotedPost: CommunityPost | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunityPostThread = {
  id: string;
  actorType: PostActorType;
  actorId: string;
  publishedAt: string;
  items: CommunityPost[];
};

export type CommunityPostThreadContext = {
  threadId: string;
  position: number;
  itemCount: number;
};

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

function readNumber(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function readBody(record: JsonRecord | null): string | null {
  const value = record?.body;
  return typeof value === "string" ? value : null;
}

function isActorType(value: string | null): value is PostActorType {
  return value === "person" || value === "artist";
}

async function rpc(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    parameters?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;

  const { data, error } = await invoke(name, args);
  if (error) throw new Error(error.message || `${name} failed`);
  return data;
}

export function mapCommunityPostDraft(value: unknown): CommunityPostDraft | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const draftGroupId = readString(record, "draft_group_id");
  const actorType = readString(record, "actor_type");
  const actorId = readString(record, "actor_id");
  const position = readNumber(record, "position");
  const body = readBody(record);
  const createdAt = readString(record, "created_at");
  const updatedAt = readString(record, "updated_at");
  const track = record?.track == null ? null : mapPostTrack(record.track);
  const quotedPost = record?.quoted_post == null
    ? null
    : mapCommunityPost(record.quoted_post);

  if (
    !record || !id || !draftGroupId || !isActorType(actorType) || !actorId ||
    position == null || position < 1 || body == null || !createdAt || !updatedAt ||
    (record.track != null && !track) ||
    (record.quoted_post != null && !quotedPost)
  ) {
    return null;
  }

  return {
    id,
    draftGroupId,
    position: Math.floor(position),
    actorType,
    actorId,
    body,
    imageUrl: readString(record, "image_url"),
    linkUrl: readString(record, "link_url"),
    linkLabel: readString(record, "link_label"),
    track,
    quotedPostId: readString(record, "quoted_post_id"),
    quotedPost,
    createdAt,
    updatedAt,
  };
}

export async function savePostDraft(input: {
  draftId?: string | null;
  draftGroupId?: string | null;
  position?: number | null;
  actor: PostActor;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  registryTrackId?: string | null;
  quotedPostId?: string | null;
}): Promise<CommunityPostDraft> {
  const draft = mapCommunityPostDraft(
    await rpc("community_save_post_draft", {
      p_draft_id: input.draftId ?? null,
      p_draft_group_id: input.draftGroupId ?? null,
      p_position: input.position ?? null,
      p_actor_type: input.actor.type,
      p_actor_id: input.actor.id,
      p_body: input.body,
      p_image_url: input.imageUrl || null,
      p_link_url: input.linkUrl || null,
      p_link_label: input.linkLabel || null,
      p_registry_track_id: input.registryTrackId || null,
      p_quoted_post_id: input.quotedPostId || null,
    }),
  );

  if (!draft) throw new Error("Post Draft returned an invalid save response.");
  return draft;
}

export async function listPostDrafts(
  actor: PostActor,
): Promise<CommunityPostDraft[]> {
  const data = await rpc("community_get_post_drafts", {
    p_actor_type: actor.type,
    p_actor_id: actor.id,
  });

  if (!Array.isArray(data)) {
    throw new Error("Post Drafts returned an invalid response.");
  }

  return data.flatMap((value) => {
    const draft = mapCommunityPostDraft(value);
    return draft ? [draft] : [];
  });
}

export async function deletePostDraft(draftId: string): Promise<void> {
  await rpc("community_delete_post_draft", { p_draft_id: draftId });
}

export async function reorderPostDraftGroup(
  draftGroupId: string,
  orderedDraftIds: string[],
): Promise<void> {
  await rpc("community_reorder_post_draft_group", {
    p_draft_group_id: draftGroupId,
    p_draft_ids: orderedDraftIds,
  });
}

export async function publishPostDraftGroup(
  draftGroupId: string,
): Promise<{
  draftGroupId: string;
  threadId: string | null;
  postCount: number;
  posts: CommunityPost[];
}> {
  const data = asRecord(
    await rpc("community_publish_post_draft_group", {
      p_draft_group_id: draftGroupId,
    }),
  );

  const returnedGroupId = readString(data, "draft_group_id");
  const postCount = readNumber(data, "post_count");
  const rawPosts = data?.posts;
  if (!data || !returnedGroupId || postCount == null || !Array.isArray(rawPosts)) {
    throw new Error("Post Draft publication returned an invalid response.");
  }

  const posts = rawPosts.flatMap((value) => {
    const post = mapCommunityPost(value);
    return post ? [post] : [];
  });

  if (posts.length !== Math.floor(postCount)) {
    throw new Error("Post Draft publication returned incomplete Posts.");
  }

  return {
    draftGroupId: returnedGroupId,
    threadId: readString(data, "thread_id"),
    postCount: posts.length,
    posts,
  };
}

export async function getPostThread(
  threadId: string,
): Promise<CommunityPostThread | null> {
  const data = asRecord(
    await rpc("community_get_thread", { p_thread_id: threadId }),
  );
  if (!data) return null;

  const id = readString(data, "id");
  const actorType = readString(data, "actor_type");
  const actorId = readString(data, "actor_id");
  const publishedAt = readString(data, "published_at");
  const rawItems = data.items;

  if (!id || !isActorType(actorType) || !actorId || !publishedAt || !Array.isArray(rawItems)) {
    throw new Error("Post Thread returned an invalid response.");
  }

  const items = rawItems.flatMap((value) => {
    const post = mapCommunityPost(value);
    return post ? [post] : [];
  });

  if (items.length !== rawItems.length || items.length < 2) {
    throw new Error("Post Thread returned incomplete Posts.");
  }

  return { id, actorType, actorId, publishedAt, items };
}

export async function getPostThreadContext(
  postId: string,
): Promise<CommunityPostThreadContext | null> {
  const data = asRecord(
    await rpc("community_get_post_thread_context", { p_post_id: postId }),
  );
  if (!data) return null;

  const threadId = readString(data, "thread_id");
  const position = readNumber(data, "position");
  const itemCount = readNumber(data, "item_count");

  if (!threadId || position == null || itemCount == null || position < 1 || itemCount < 2) {
    throw new Error("Post Thread context returned an invalid response.");
  }

  return {
    threadId,
    position: Math.floor(position),
    itemCount: Math.floor(itemCount),
  };
}

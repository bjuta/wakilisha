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

export type CommunityPost = {
  id: string;
  actorType: PostActorType;
  actorId: string;
  actor: PostActor;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  status: "published" | "withdrawn";
  publishedAt: string;
  withdrawnAt: string | null;
  updatedAt: string;
  canonicalPath: string;
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

function isActorType(value: string): value is PostActorType {
  return value === "person" || value === "artist";
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

export function mapCommunityPost(value: unknown): CommunityPost | null {
  const record = asRecord(value);
  const actor = mapPostActor(record?.actor);
  const id = readString(record, "id");
  const actorType = readString(record, "actor_type");
  const actorId = readString(record, "actor_id");
  const body = readString(record, "body");
  const status = readString(record, "status");
  const publishedAt = readString(record, "published_at");
  const updatedAt = readString(record, "updated_at");
  const canonicalPath = readString(record, "canonical_path");

  if (
    !record || !actor || !id || !actorType || !isActorType(actorType) ||
    !actorId || !body || (status !== "published" && status !== "withdrawn") ||
    !publishedAt || !updatedAt || !canonicalPath
  ) {
    return null;
  }

  return {
    id,
    actorType,
    actorId,
    actor,
    body,
    imageUrl: readString(record, "image_url"),
    linkUrl: readString(record, "link_url"),
    linkLabel: readString(record, "link_label"),
    status,
    publishedAt,
    withdrawnAt: readString(record, "withdrawn_at"),
    updatedAt,
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
}): Promise<CommunityPost> {
  const data = await rpc("community_publish_post", {
    p_actor_type: input.actor.type,
    p_actor_id: input.actor.id,
    p_body: input.body,
    p_image_url: input.imageUrl || null,
    p_link_url: input.linkUrl || null,
    p_link_label: input.linkLabel || null,
  });
  const post = mapCommunityPost(data);
  if (!post) throw new Error("Post returned an invalid publish response.");
  return post;
}

export async function editPost(input: {
  postId: string;
  body: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
}): Promise<CommunityPost> {
  const data = await rpc("community_edit_post", {
    p_post_id: input.postId,
    p_body: input.body,
    p_image_url: input.imageUrl || null,
    p_link_url: input.linkUrl || null,
    p_link_label: input.linkLabel || null,
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

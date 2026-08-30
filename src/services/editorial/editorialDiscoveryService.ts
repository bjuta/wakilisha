import { supabase } from "@/lib/supabase";
import type {
  EditorialDiscoveryDraft,
  EditorialDiscoveryValue,
  EditorialDiscoveryVersionType,
  EditorialTaxonomy,
  EditorialTaxonomyTerm,
} from "@/types/editorialDiscovery";

type JsonObject = Record<string, unknown>;

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

function rpc(): (
  name: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult> {
  return supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult>;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function term(value: unknown): EditorialTaxonomyTerm | null {
  const row = object(value);
  const id = text(row.id);
  const slug = text(row.slug);
  const name = text(row.name);
  if (!id || !slug || !name) return null;
  return { id, slug, name };
}

function parseDiscovery(value: unknown): EditorialDiscoveryValue {
  const row = object(value);
  const seo = object(row.seo);
  const targetVersionType = text(row.target_version_type);
  if (
    targetVersionType !== "playlist_version" &&
    targetVersionType !== "audio_publication_version" &&
    targetVersionType !== "video_publication_version"
  ) {
    throw new Error("Discovery returned an unsupported version type.");
  }

  return {
    targetVersionType,
    targetVersionId: text(row.target_version_id),
    resourceId: text(row.resource_id),
    resourceKind: text(row.resource_kind),
    metadataRevision: numberValue(row.metadata_revision, 1),
    categories: array(row.categories)
      .map(term)
      .filter((value): value is EditorialTaxonomyTerm => Boolean(value)),
    tags: array(row.tags)
      .map(term)
      .filter((value): value is EditorialTaxonomyTerm => Boolean(value)),
    seo: {
      title: text(seo.title),
      description: text(seo.description),
      keywords: array(seo.keywords).map(String).filter(Boolean),
      focusKeyword: text(seo.focus_keyword),
    },
  };
}

function idempotencyKey(): string {
  return `editorial:discovery:${crypto.randomUUID()}`;
}

export async function fetchEditorialDiscovery(
  targetVersionType: EditorialDiscoveryVersionType,
  targetVersionId: string,
): Promise<EditorialDiscoveryValue> {
  const { data, error } = await rpc()(
    "get_resource_version_editorial_metadata",
    {
      p_target_version_type: targetVersionType,
      p_target_version_id: targetVersionId,
    },
  );

  if (error) {
    throw new Error(error.message || "Discovery could not load.");
  }

  return parseDiscovery(data);
}

export async function searchEditorialTaxonomyTerms(
  taxonomy: EditorialTaxonomy,
  query: string,
): Promise<EditorialTaxonomyTerm[]> {
  const { data, error } = await rpc()("get_taxonomy_terms", {
    p_taxonomy: taxonomy,
    p_search: query.trim() || null,
    p_page: 1,
    p_page_size: 30,
  });

  if (error) {
    throw new Error(error.message || "Taxonomy terms could not load.");
  }

  return array(data)
    .map(term)
    .filter((value): value is EditorialTaxonomyTerm => Boolean(value));
}

export async function createEditorialTaxonomyTerm(
  taxonomy: EditorialTaxonomy,
  name: string,
): Promise<EditorialTaxonomyTerm> {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) throw new Error("Enter a valid taxonomy term name.");

  const { data, error } = await rpc()("create_taxonomy_term", {
    p_taxonomy: taxonomy,
    p_slug: slug,
    p_name: name.trim(),
    p_description: null,
    p_seo_title: null,
    p_seo_description: null,
    p_seo_keywords: null,
  });

  if (error) {
    throw new Error(error.message || "Taxonomy term could not be created.");
  }

  const created = array(data).map(term).find(Boolean);
  if (!created) {
    throw new Error("Taxonomy term creation returned no Registry term.");
  }

  return created;
}

export async function saveEditorialDiscovery(
  current: EditorialDiscoveryValue,
  draft: EditorialDiscoveryDraft,
): Promise<EditorialDiscoveryValue> {
  const { data, error } = await rpc()(
    "save_resource_version_editorial_metadata",
    {
      p_target_version_type: current.targetVersionType,
      p_target_version_id: current.targetVersionId,
      p_expected_metadata_revision: current.metadataRevision,
      p_category_ids: draft.categories.map((item) => item.id),
      p_tag_ids: draft.tags.map((item) => item.id),
      p_seo_title: draft.seo.title.trim() || null,
      p_seo_description: draft.seo.description.trim() || null,
      p_seo_keywords: draft.seo.keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      p_focus_keyword: draft.seo.focusKeyword.trim() || null,
      p_idempotency_key: idempotencyKey(),
      p_correlation_id: crypto.randomUUID(),
    },
  );

  if (error) {
    throw new Error(error.message || "Discovery could not be saved.");
  }

  const row = object(Array.isArray(data) ? data[0] : data);
  if (text(row.receipt_status) === "rejected") {
    throw new Error(
      text(row.error_message) ||
        "Discovery changed before this save could be completed.",
    );
  }

  const targetVersionId = text(row.target_version_id);
  if (!targetVersionId) {
    throw new Error("Discovery save returned no working version.");
  }

  return {
    ...current,
    targetVersionId,
    metadataRevision: numberValue(
      row.metadata_revision,
      current.metadataRevision + 1,
    ),
    categories: draft.categories,
    tags: draft.tags,
    seo: draft.seo,
  };
}

import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database.types";
import type {
  ListOptions,
  ListResult,
  MediaAsset,
  ReferencedEntity,
} from "@/services/mediaService";

export interface AdminMediaAsset extends MediaAsset {
  canonical_asset_id?: string | null;
  canonical_lifecycle_state?: string | null;
  authority_revision?: number | null;
  current_revision_id?: string | null;
  current_governance_version_id?: string | null;
  consent_status?: string | null;
  sensitivity?: string | null;
  public_safety_state?: string | null;
  active_usage_count?: number;
  references: ReferencedEntity[];
}

export interface AdminMediaReadQuery {
  assetIds?: string[];
  urls?: string[];
  sourceKeys?: string[];
  search?: string;
  mediaKind?: string;
  fileKind?: string;
  assetPurpose?: string;
  folderId?: string;
  rightsStatus?: string;
  sourceKind?: string;
  status?: string;
  missingAltOnly?: boolean;
  uploadedFrom?: string;
  uploadedTo?: string;
  contentFrom?: string;
  contentTo?: string;
  orderBy?: "created_at" | "updated_at" | "title" | "content_date";
  ascending?: boolean;
  limit?: number;
  offset?: number;
  includeReferences?: boolean;
}

export interface AdminMediaReadResult {
  assets: AdminMediaAsset[];
  total: number;
}

type RpcError = {
  message: string;
};

type RpcResponse = {
  data: Json | null;
  error: RpcError | null;
};

function objectValue(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(String);
}

function referencesFrom(
  value: unknown,
): ReferencedEntity[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const row = objectValue(entry);
    if (!row) return [];

    const table = nullableString(row.table);
    const column = nullableString(row.column);
    const entityId = nullableString(row.entity_id);

    if (!table || !column || !entityId) return [];

    return [{
      table,
      column,
      entity_id: entityId,
      label: nullableString(row.label) ?? undefined,
    }];
  });
}

function toAdminMediaAsset(
  value: unknown,
): AdminMediaAsset | null {
  const row = objectValue(value);
  if (!row?.id) return null;

  return {
    id: String(row.id),
    slug: nullableString(row.slug),
    title: nullableString(row.title),
    url: nullableString(row.url),
    mime_type: nullableString(row.mime_type),
    media_kind: nullableString(row.media_kind),
    status: nullableString(row.status),
    source_kind: nullableString(row.source_kind),
    source_entity: nullableString(row.source_entity),
    source_record_id: nullableString(row.source_record_id),
    source_staging_record_id:
      nullableString(row.source_staging_record_id),
    storage_bucket: nullableString(row.storage_bucket),
    storage_path: nullableString(row.storage_path),
    folder_id: nullableString(row.folder_id),
    file_kind: nullableString(row.file_kind),
    asset_purpose: nullableString(row.asset_purpose),
    display_filename:
      nullableString(row.display_filename),
    original_filename:
      nullableString(row.original_filename),
    file_extension:
      nullableString(row.file_extension),
    file_size_bytes:
      nullableNumber(row.file_size_bytes),
    content_date: nullableString(row.content_date),
    rights_status: nullableString(row.rights_status),
    credit_text: nullableString(row.credit_text),
    country_code: nullableString(row.country_code),
    language_code: nullableString(row.language_code),
    tags: stringArray(row.tags),
    internal_notes: nullableString(row.internal_notes),
    metadata: objectValue(row.metadata),
    created_at: nullableString(row.created_at),
    updated_at: nullableString(row.updated_at),
    canonical_asset_id:
      nullableString(row.canonical_asset_id),
    canonical_lifecycle_state:
      nullableString(row.canonical_lifecycle_state),
    authority_revision:
      nullableNumber(row.authority_revision),
    current_revision_id:
      nullableString(row.current_revision_id),
    current_governance_version_id:
      nullableString(row.current_governance_version_id),
    consent_status: nullableString(row.consent_status),
    sensitivity: nullableString(row.sensitivity),
    public_safety_state:
      nullableString(row.public_safety_state),
    active_usage_count:
      nullableNumber(row.active_usage_count) ?? 0,
    references: referencesFrom(row.references),
  };
}

function buildPayload(
  query: AdminMediaReadQuery,
): Record<string, Json> {
  const payload: Record<string, Json> = {};

  const put = (
    key: string,
    value: Json | undefined,
  ) => {
    if (value === undefined) return;
    if (typeof value === "string" && !value.trim()) return;
    payload[key] = value;
  };

  put("asset_ids", query.assetIds);
  put("urls", query.urls);
  put("source_keys", query.sourceKeys);
  put("search", query.search);
  put("media_kind", query.mediaKind);
  put("file_kind", query.fileKind);
  put("asset_purpose", query.assetPurpose);
  put("folder_id", query.folderId);
  put("rights_status", query.rightsStatus);
  put("source_kind", query.sourceKind);
  put("status", query.status);
  put("missing_alt_only", query.missingAltOnly);
  put("uploaded_from", query.uploadedFrom);
  put("uploaded_to", query.uploadedTo);
  put("content_from", query.contentFrom);
  put("content_to", query.contentTo);
  put("order_by", query.orderBy);
  put("ascending", query.ascending);
  put("limit", query.limit);
  put("offset", query.offset);
  put("include_references", query.includeReferences);

  return payload;
}

async function invokeAdminRead(
  payload: Record<string, Json>,
): Promise<RpcResponse> {
  const client = supabase as unknown as {
    rpc: (
      functionName: string,
      args: Record<string, Json>,
    ) => PromiseLike<RpcResponse>;
  };

  return client.rpc(
    "read_media_assets_admin_v2",
    {
      p_query: payload,
    },
  );
}

export async function readAdminMediaAssets(
  query: AdminMediaReadQuery = {},
): Promise<AdminMediaReadResult> {
  const { data, error } = await invokeAdminRead(
    buildPayload(query),
  );

  if (error) {
    throw new Error(
      `Failed to read administrative Media: ${error.message}`,
    );
  }

  const response = objectValue(data);
  const items = Array.isArray(response?.items)
    ? response.items
    : [];

  return {
    assets: items.flatMap((item) => {
      const asset = toAdminMediaAsset(item);
      return asset ? [asset] : [];
    }),
    total: nullableNumber(response?.total) ?? 0,
  };
}

export async function getAdminMediaAssetById(
  assetId: string,
  includeReferences = false,
): Promise<AdminMediaAsset | null> {
  if (!assetId) return null;

  const result = await readAdminMediaAssets({
    assetIds: [assetId],
    includeReferences,
    limit: 1,
  });

  return result.assets[0] ?? null;
}

export async function getAdminMediaAssetByUrl(
  url: string,
): Promise<AdminMediaAsset | null> {
  if (!url) return null;

  const result = await readAdminMediaAssets({
    urls: [url],
    limit: 1,
  });

  return result.assets[0] ?? null;
}

export async function getAdminMediaAssetsByIds(
  assetIds: string[],
): Promise<Map<string, AdminMediaAsset>> {
  const unique = [...new Set(assetIds.filter(Boolean))];
  if (!unique.length) return new Map();

  const result = await readAdminMediaAssets({
    assetIds: unique,
    limit: Math.min(unique.length, 200),
  });

  return new Map(
    result.assets.map((asset) => [asset.id, asset]),
  );
}

export async function getAdminMediaAssetsBySourceKeys(
  sourceKeys: string[],
): Promise<AdminMediaAsset[]> {
  const unique = [...new Set(sourceKeys.filter(Boolean))];
  if (!unique.length) return [];

  const result = await readAdminMediaAssets({
    sourceKeys: unique,
    status: "active",
    limit: 50,
  });

  return result.assets;
}

function activeFilter(value: string | undefined): string | undefined {
  if (!value || value === "all") return undefined;
  return value;
}

export async function listAdminMediaAssets(
  options: ListOptions = {},
): Promise<ListResult> {
  const page = options.page ?? 0;
  const pageSize = options.pageSize ?? 60;

  const result = await readAdminMediaAssets({
    search: options.search,
    mediaKind: activeFilter(options.mediaKind),
    fileKind: activeFilter(options.fileKind),
    assetPurpose:
      activeFilter(options.assetPurpose),
    folderId: activeFilter(options.folderId),
    rightsStatus:
      activeFilter(options.rightsStatus),
    sourceKind: activeFilter(options.sourceKind),
    status: activeFilter(options.status),
    missingAltOnly: options.missingAltOnly,
    uploadedFrom: options.uploadedFrom
      ? `${options.uploadedFrom}T00:00:00.000Z`
      : undefined,
    uploadedTo: options.uploadedTo
      ? `${options.uploadedTo}T23:59:59.999Z`
      : undefined,
    contentFrom: options.contentFrom,
    contentTo: options.contentTo,
    orderBy: options.orderBy,
    ascending: options.ascending,
    limit: pageSize,
    offset: page * pageSize,
  });

  return {
    assets: result.assets,
    total: result.total,
  };
}

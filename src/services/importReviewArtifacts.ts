import { supabase } from "@/lib/supabase";

export type ReviewArtifactType =
  | "entity_relationships"
  | "custom_fields"
  | "artist_relationships"
  | "track_artists"
  | "release_tracks"
  | "release_labels"
  | "artist_genres"
  | "chart_entry_links"
  | "media_assets"
  | "artists"
  | string;

export type ReviewArtifactBucket = {
  key: ReviewArtifactType;
  label: string;
  description: string;
  count: number;
  status: "preserved" | "staged" | "needs_resolver" | "empty";
  nextAction: string;
};

export type ReviewArtifactSample = {
  id: string;
  artifact_type: string;
  title: string | null;
  source_kind: string | null;
  source_record_id: string | null;
  review_status: string | null;
  raw_record: Record<string, unknown> | null;
  mapped_record: Record<string, unknown> | null;
  notes: string | null;
  created_at?: string | null;
};

export type StagingBucket = {
  target_entity: string;
  ready: number;
  needs_review: number;
  blocked: number;
  total: number;
};

export type ImportRunLite = {
  id: string;
  source_name: string | null;
  source_kind: string | null;
  status: string | null;
  imported_counts: Record<string, unknown> | null;
  created_at: string | null;
  finished_at: string | null;
};

export type ReviewArtifactDashboard = {
  totalReviewArtifacts: number;
  totalStagingRecords: number;
  reviewBuckets: ReviewArtifactBucket[];
  stagingBuckets: StagingBucket[];
  samples: ReviewArtifactSample[];
  latestRuns: ImportRunLite[];
  activeFilter?: {
    target?: string;
    status?: string;
    artifactType?: string;
  };
};

export type ReviewArtifactFilters = {
  target?: string | null;
  status?: string | null;
  artifactType?: string | null;
};

const REVIEW_BUCKETS: Array<Omit<ReviewArtifactBucket, "count" | "status">> = [
  {
    key: "entity_relationships",
    label: "Entity relationships",
    description: "WP term links, chart/entity links, and unresolved graph edges preserved for resolver review.",
    nextAction: "Build source/target resolver and promote approved links into live relationship tables.",
  },
  {
    key: "custom_fields",
    label: "Custom fields / postmeta",
    description: "WordPress postmeta and ACF-style fields preserved before field policy classification.",
    nextAction: "Classify field keys into media, SEO, editorial metadata, registry metadata, layout junk, or ignore.",
  },
  {
    key: "artist_relationships",
    label: "Artist-to-artist relationships",
    description: "Collaborator/related artist graph records from WAKILISHA plugin relationship tables.",
    nextAction: "Promote into a live artist relationship graph after artist IDs are resolved.",
  },
  {
    key: "media_assets",
    label: "Media assets",
    description: "WordPress attachment records and imported image URLs awaiting attachment to public surfaces.",
    nextAction: "Resolve hero/profile/cover/logo roles and write public image fields.",
  },
  {
    key: "artists",
    label: "Artist records needing review",
    description: "Artist CPT/plugin records that need merge, enrichment, or creation decisions.",
    nextAction: "Compare against registry_artists and send low-confidence matches to merge review.",
  },
];

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function exactCount(table: string, filters: Record<string, string> = {}): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function loadStagingSummary(): Promise<StagingBucket[]> {
  const { data, error } = await supabase
    .from("wk_import_staging_summary")
    .select("target_entity, ready, needs_review, blocked, total")
    .order("total", { ascending: false });
  if (error) return [];
  return ((data ?? []) as StagingBucket[]).filter((bucket) => asNumber(bucket.total) > 0);
}

function stagingCount(staging: StagingBucket[], target: string): number {
  const row = staging.find((bucket) => bucket.target_entity === target);
  return asNumber(row?.total);
}

function filteredStaging(staging: StagingBucket[], filters: ReviewArtifactFilters): StagingBucket[] {
  let rows = staging;
  if (filters.target) rows = rows.filter((bucket) => bucket.target_entity === filters.target);
  if (filters.status === "ready") rows = rows.filter((bucket) => asNumber(bucket.ready) > 0);
  if (filters.status === "needs_review") rows = rows.filter((bucket) => asNumber(bucket.needs_review) > 0);
  if (filters.status === "blocked") rows = rows.filter((bucket) => asNumber(bucket.blocked) > 0);
  return rows.sort((a, b) => asNumber(b.total) - asNumber(a.total));
}

function artifactTypeForTarget(target?: string | null): string | null {
  if (!target) return null;
  if (["entity_relationships", "custom_fields"].includes(target)) return target;
  return null;
}

async function loadSamples(filters: ReviewArtifactFilters): Promise<ReviewArtifactSample[]> {
  const artifactType = filters.artifactType || artifactTypeForTarget(filters.target);
  let query = supabase
    .from("wk_import_review_artifacts")
    .select("id, artifact_type, title, source_kind, source_record_id, review_status, notes, raw_record, mapped_record, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (artifactType) query = query.eq("artifact_type", artifactType);
  if (filters.status && ["needs_review", "ready", "blocked"].includes(filters.status)) {
    const artifactStatus = filters.status === "ready" ? "resolved" : filters.status;
    if (artifactType) query = query.eq("review_status", artifactStatus);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as ReviewArtifactSample[];
}

export async function loadImportReviewArtifactDashboard(filters: ReviewArtifactFilters = {}): Promise<ReviewArtifactDashboard> {
  const activeFilter = {
    target: filters.target || undefined,
    status: filters.status || undefined,
    artifactType: filters.artifactType || undefined,
  };

  const [totalReviewArtifacts, stagingSummary, sampleResult, runsResult, entityRelationshipArtifacts, customFieldArtifacts] = await Promise.all([
    exactCount("wk_import_review_artifacts"),
    loadStagingSummary(),
    loadSamples(filters),
    supabase
      .from("wk_ingestion_runs")
      .select("id, source_name, source_kind, status, imported_counts, created_at, finished_at")
      .order("created_at", { ascending: false })
      .limit(5),
    exactCount("wk_import_review_artifacts", { artifact_type: "entity_relationships" }),
    exactCount("wk_import_review_artifacts", { artifact_type: "custom_fields" }),
  ]);

  const totalStagingRecords = stagingSummary.reduce((sum, bucket) => sum + asNumber(bucket.total), 0);
  const reviewBuckets = REVIEW_BUCKETS.map((bucket) => {
    const count = bucket.key === "entity_relationships"
      ? entityRelationshipArtifacts
      : bucket.key === "custom_fields"
      ? customFieldArtifacts
      : stagingCount(stagingSummary, bucket.key);
    return {
      ...bucket,
      count,
      status: count > 0 ? (bucket.key === "entity_relationships" || bucket.key === "custom_fields" ? "preserved" as const : "staged" as const) : "empty" as const,
    };
  });

  return {
    totalReviewArtifacts,
    totalStagingRecords,
    reviewBuckets,
    stagingBuckets: filteredStaging(stagingSummary, filters),
    samples: sampleResult,
    latestRuns: ((runsResult.data ?? []) as ImportRunLite[]).map((run) => ({
      ...run,
      imported_counts: run.imported_counts && typeof run.imported_counts === "object" ? run.imported_counts : null,
    })),
    activeFilter,
  };
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(asNumber(value));
}

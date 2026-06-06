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
  notes: string | null;
  raw_record: Record<string, unknown> | null;
  mapped_record: Record<string, unknown> | null;
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

const STAGING_TARGETS = [
  "articles",
  "pages",
  "authors",
  "taxonomy_terms",
  "artist_taxonomy_terms",
  "media_assets",
  "artists",
  "tracks",
  "releases",
  "labels",
  "genres",
  "chart_series",
  "chart_editions",
  "chart_entries",
  "track_artists",
  "release_tracks",
  "release_labels",
  "artist_genres",
  "artist_relationships",
  "entity_relationships",
  "chart_entry_links",
  "custom_fields",
  "ignored_post_types",
];

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function exactCount(table: string, filters: Record<string, string> = {}): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function artifactTypeCount(artifactType: string): Promise<number> {
  return exactCount("wk_import_review_artifacts", { artifact_type: artifactType });
}

async function stagingStatusCount(targetEntity: string, targetStatus: "ready" | "needs_review" | "blocked"): Promise<number> {
  return exactCount("wk_import_staging_records", { target_entity: targetEntity, target_status: targetStatus });
}

export async function loadImportReviewArtifactDashboard(): Promise<ReviewArtifactDashboard> {
  const [totalReviewArtifacts, totalStagingRecords, sampleResult, runsResult] = await Promise.all([
    exactCount("wk_import_review_artifacts"),
    exactCount("wk_import_staging_records"),
    supabase
      .from("wk_import_review_artifacts")
      .select("id, artifact_type, title, source_kind, source_record_id, review_status, notes, raw_record, mapped_record, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("wk_ingestion_runs")
      .select("id, source_name, source_kind, status, imported_counts, created_at, finished_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const reviewBuckets = await Promise.all(
    REVIEW_BUCKETS.map(async (bucket) => {
      const count = await artifactTypeCount(bucket.key);
      return {
        ...bucket,
        count,
        status: count > 0 ? "preserved" as const : "empty" as const,
      };
    }),
  );

  const stagingBucketsRaw = await Promise.all(
    STAGING_TARGETS.map(async (target) => {
      const [ready, needsReview, blocked] = await Promise.all([
        stagingStatusCount(target, "ready"),
        stagingStatusCount(target, "needs_review"),
        stagingStatusCount(target, "blocked"),
      ]);
      return { target_entity: target, ready, needs_review: needsReview, blocked, total: ready + needsReview + blocked };
    }),
  );

  return {
    totalReviewArtifacts,
    totalStagingRecords,
    reviewBuckets,
    stagingBuckets: stagingBucketsRaw.filter((bucket) => bucket.total > 0).sort((a, b) => b.total - a.total),
    samples: ((sampleResult.data ?? []) as ReviewArtifactSample[]),
    latestRuns: ((runsResult.data ?? []) as ImportRunLite[]).map((run) => ({
      ...run,
      imported_counts: run.imported_counts && typeof run.imported_counts === "object" ? run.imported_counts : null,
    })),
  };
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(asNumber(value));
}

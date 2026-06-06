import { supabase } from "@/lib/supabase";

export type ReviewWorkstreamKey =
  | "entity_resolution"
  | "import_artifacts"
  | "media_assets"
  | "postmeta"
  | "staging"
  | "promotion_events";

export type ReviewWorkstream = {
  key: ReviewWorkstreamKey;
  label: string;
  description: string;
  count: number;
  severity: "danger" | "warning" | "brand" | "neutral" | "success";
  path?: string;
  nextAction: string;
};

export type ReviewDecisionSample = {
  id: string;
  entity_type: string | null;
  source_title: string | null;
  source_slug: string | null;
  target_title: string | null;
  target_slug: string | null;
  confidence_score: number | null;
  decision: string | null;
  status: string | null;
  review_required: boolean | null;
  reason: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReviewArtifactSample = {
  id: string;
  artifact_type: string | null;
  title: string | null;
  source_kind: string | null;
  source_record_id: string | null;
  review_status: string | null;
  notes: string | null;
  created_at: string | null;
};

export type FieldDictionaryRow = {
  id: string;
  meta_key: string;
  field_group: string;
  promotion_policy: string;
  confidence: number | null;
  occurrence_count: number | null;
  object_count: number | null;
  reason: string | null;
  approved_policy: string | null;
  updated_at: string | null;
};

export type MediaReviewRow = {
  id: string;
  entity_type: string | null;
  entity_slug: string | null;
  role: string | null;
  url: string | null;
  source: string | null;
  status: string | null;
  updated_at: string | null;
};

export type PromotionEventRow = {
  id: string;
  target_table: string | null;
  target_record_id: string | null;
  event_type: string | null;
  message: string | null;
  created_at: string | null;
};

export type StagingSummaryRow = {
  target_entity: string;
  ready: number;
  needs_review: number;
  blocked: number;
  total: number;
};

export type ReviewCommandCenterData = {
  totals: {
    openDecisions: number;
    reviewArtifacts: number;
    unresolvedMedia: number;
    unknownFields: number;
    stagingNeedsReview: number;
    blockedStaging: number;
    promotionEvents: number;
  };
  workstreams: ReviewWorkstream[];
  decisionSamples: ReviewDecisionSample[];
  artifactSamples: ReviewArtifactSample[];
  fieldDictionary: FieldDictionaryRow[];
  mediaRows: MediaReviewRow[];
  promotionEvents: PromotionEventRow[];
  stagingSummary: StagingSummaryRow[];
};

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

async function exactCount(table: string, filters: Record<string, string | boolean> = {}): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function statusCount(targetEntity: string, targetStatus: "ready" | "needs_review" | "blocked"): Promise<number> {
  return exactCount("wk_import_staging_records", { target_entity: targetEntity, target_status: targetStatus });
}

async function loadStagingSummary(): Promise<StagingSummaryRow[]> {
  const rows = await Promise.all(
    STAGING_TARGETS.map(async (target) => {
      const [ready, needsReview, blocked] = await Promise.all([
        statusCount(target, "ready"),
        statusCount(target, "needs_review"),
        statusCount(target, "blocked"),
      ]);
      return { target_entity: target, ready, needs_review: needsReview, blocked, total: ready + needsReview + blocked };
    }),
  );
  return rows.filter((row) => row.total > 0).sort((a, b) => (b.needs_review + b.blocked) - (a.needs_review + a.blocked));
}

async function loadSamples<T>(table: string, select: string, orderColumn = "created_at", limit = 12): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select).order(orderColumn, { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []) as T[];
}

export async function loadReviewCommandCenter(): Promise<ReviewCommandCenterData> {
  const [
    openDecisions,
    reviewArtifacts,
    unresolvedMedia,
    unknownFields,
    promotionEventsCount,
    decisionSamples,
    artifactSamples,
    fieldDictionary,
    mediaRows,
    promotionEvents,
    stagingSummary,
  ] = await Promise.all([
    exactCount("entity_resolution_decisions", { review_required: true, status: "open" }),
    exactCount("wk_import_review_artifacts"),
    exactCount("entity_resolution_decisions", { entity_type: "media_asset", review_required: true, status: "open" }),
    exactCount("wp_postmeta_field_dictionary", { promotion_policy: "review" }),
    exactCount("wk_import_promotion_events"),
    loadSamples<ReviewDecisionSample>("entity_resolution_decisions", "id, entity_type, source_title, source_slug, target_title, target_slug, confidence_score, decision, status, review_required, reason, created_at, updated_at", "updated_at", 16),
    loadSamples<ReviewArtifactSample>("wk_import_review_artifacts", "id, artifact_type, title, source_kind, source_record_id, review_status, notes, created_at", "created_at", 10),
    loadSamples<FieldDictionaryRow>("wp_postmeta_field_dictionary", "id, meta_key, field_group, promotion_policy, confidence, occurrence_count, object_count, reason, approved_policy, updated_at", "occurrence_count", 12),
    loadSamples<MediaReviewRow>("wk_media_assets", "id, entity_type, entity_slug, role, url, source, status, updated_at", "updated_at", 10),
    loadSamples<PromotionEventRow>("wk_import_promotion_events", "id, target_table, target_record_id, event_type, message, created_at", "created_at", 10),
    loadStagingSummary(),
  ]);

  const stagingNeedsReview = stagingSummary.reduce((sum, row) => sum + row.needs_review, 0);
  const blockedStaging = stagingSummary.reduce((sum, row) => sum + row.blocked, 0);

  const workstreams: ReviewWorkstream[] = [
    {
      key: "entity_resolution",
      label: "Resolution decisions",
      description: "Artist merges, relationship endpoints, media candidates, custom fields, and term links waiting for human judgment.",
      count: openDecisions,
      severity: openDecisions > 0 ? "danger" : "success",
      nextAction: "Review open decisions by entity type and close the highest-risk identity or media items first.",
    },
    {
      key: "import_artifacts",
      label: "Import review artifacts",
      description: "Preserved migration evidence from relationships, custom fields, media, and unresolved source rows.",
      count: reviewArtifacts,
      severity: reviewArtifacts > 0 ? "warning" : "success",
      path: "/admin/imports/review-artifacts",
      nextAction: "Inspect artifact buckets, confirm what has been resolved, and move unresolved classes into dedicated resolver passes.",
    },
    {
      key: "media_assets",
      label: "Media review",
      description: "Unresolved or newly operationalized WordPress images that need attachment/role checks.",
      count: unresolvedMedia,
      severity: unresolvedMedia > 0 ? "warning" : "success",
      path: "/admin/media/library",
      nextAction: "Check unresolved media candidates, then verify hero/profile/artwork/logo roles in the media library.",
    },
    {
      key: "postmeta",
      label: "Postmeta dictionary",
      description: "Custom-field keys grouped into media, SEO, editorial, registry, layout junk, sensitive, or unknown.",
      count: unknownFields,
      severity: unknownFields > 0 ? "warning" : "success",
      nextAction: "Approve or reclassify high-frequency unknown fields before applying additional safe metadata.",
    },
    {
      key: "staging",
      label: "Staging exceptions",
      description: "Rows still marked needs_review or blocked in wk_import_staging_records.",
      count: stagingNeedsReview + blockedStaging,
      severity: blockedStaging > 0 ? "danger" : stagingNeedsReview > 0 ? "warning" : "success",
      path: "/admin/imports/review-artifacts",
      nextAction: "Start with blocked rows, then work down the highest-volume needs_review target entities.",
    },
    {
      key: "promotion_events",
      label: "Promotion events",
      description: "Audit trail of records promoted or resolved by Phases 1–7.",
      count: promotionEventsCount,
      severity: "neutral",
      nextAction: "Use the latest promotion events to verify which resolver phases actually changed live operational tables.",
    },
  ];

  return {
    totals: { openDecisions, reviewArtifacts, unresolvedMedia, unknownFields, stagingNeedsReview, blockedStaging, promotionEvents: promotionEventsCount },
    workstreams,
    decisionSamples,
    artifactSamples,
    fieldDictionary,
    mediaRows,
    promotionEvents,
    stagingSummary,
  };
}

export function formatReviewCount(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

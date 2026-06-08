import { supabase } from "@/lib/supabase";

export type ReviewWorkstreamKey =
  | "phase0_artifacts"
  | "phase1_staging"
  | "phase2_artists"
  | "phase2b_registry_review"
  | "phase3_artist_relationships"
  | "phase4_entity_relationships"
  | "phase5_postmeta"
  | "phase6_media"
  | "blocked_noise";

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

export type RegistryReviewItemRow = {
  id: string;
  review_key: string | null;
  entity_type: string | null;
  entity_id: string | null;
  review_type: string | null;
  priority: string | null;
  status: string | null;
  title: string | null;
  summary: string | null;
  source_table: string | null;
  source_id: string | null;
  source_payload: Record<string, unknown> | null;
  candidate_payload: Record<string, unknown> | null;
  resolution_payload?: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RegistryReviewSummaryRow = {
  status: string;
  review_type: string;
  count: number;
};

export type RegistryReviewFilters = {
  search?: string;
  status?: string;
  reviewType?: string;
  priority?: string;
  entityType?: string;
  offset?: number;
  limit?: number;
};

export type RegistryReviewPage = {
  rows: RegistryReviewItemRow[];
  total: number;
  limit: number;
  offset: number;
};

export type RegistryDecisionType =
  | "approve_primary_artist"
  | "approve_featured_artist_split"
  | "needs_more_research"
  | "reject_bad_metadata"
  | "duplicate_or_bad_source";

export type RegistryReviewDecisionInput = {
  item: RegistryReviewItemRow;
  decisionType: RegistryDecisionType;
  notes: string;
  resolutionPayload?: Record<string, unknown>;
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
    registryReviewItems: number;
    highPriorityRegistryReviewItems: number;
  };
  workstreams: ReviewWorkstream[];
  decisionSamples: ReviewDecisionSample[];
  artifactSamples: ReviewArtifactSample[];
  fieldDictionary: FieldDictionaryRow[];
  mediaRows: MediaReviewRow[];
  promotionEvents: PromotionEventRow[];
  stagingSummary: StagingSummaryRow[];
  registryReviewItems: RegistryReviewItemRow[];
  registryReviewSummary: RegistryReviewSummaryRow[];
};

const registryReviewSelect = "id, review_key, entity_type, entity_id, review_type, priority, status, title, summary, source_table, source_id, source_payload, candidate_payload, resolution_payload, created_at, updated_at";

async function exactCount(table: string, filters: Record<string, string | boolean> = {}): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function loadStagingSummary(): Promise<StagingSummaryRow[]> {
  const { data, error } = await supabase
    .from("wk_import_staging_summary")
    .select("target_entity, ready, needs_review, blocked, total")
    .order("needs_review", { ascending: false });

  if (error) return [];
  return ((data ?? []) as StagingSummaryRow[])
    .filter((row) => Number(row.total ?? 0) > 0)
    .sort((a, b) => (Number(b.needs_review ?? 0) + Number(b.blocked ?? 0)) - (Number(a.needs_review ?? 0) + Number(a.blocked ?? 0)));
}

async function loadSamples<T>(table: string, select: string, orderColumn = "created_at", limit = 12): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select).order(orderColumn, { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []) as T[];
}

async function loadRegistryReviewSummary(): Promise<RegistryReviewSummaryRow[]> {
  const { data, error } = await supabase
    .from("registry_review_items")
    .select("status, review_type")
    .order("review_type", { ascending: true });

  if (error) return [];

  const counts = new Map<string, RegistryReviewSummaryRow>();
  for (const row of (data ?? []) as Array<{ status: string | null; review_type: string | null }>) {
    const status = row.status || "unknown";
    const reviewType = row.review_type || "unknown";
    const key = `${status}::${reviewType}`;
    const current = counts.get(key) ?? { status, review_type: reviewType, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.review_type.localeCompare(b.review_type));
}

export async function loadRegistryReviewItems(filters: RegistryReviewFilters = {}): Promise<RegistryReviewPage> {
  const limit = Math.max(1, Math.min(Number(filters.limit ?? 18), 100));
  const offset = Math.max(0, Number(filters.offset ?? 0));
  let query = supabase
    .from("registry_review_items")
    .select(registryReviewSelect, { count: "exact" })
    .order("updated_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.reviewType) query = query.eq("review_type", filters.reviewType);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.search?.trim()) {
    const search = filters.search.trim().replace(/[%_]/g, "");
    query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,review_key.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  return { rows: (data ?? []) as RegistryReviewItemRow[], total: count ?? 0, limit, offset };
}

function row(summary: StagingSummaryRow[], target: string): StagingSummaryRow {
  return summary.find((item) => item.target_entity === target) ?? { target_entity: target, ready: 0, needs_review: 0, blocked: 0, total: 0 };
}

function needs(summary: StagingSummaryRow[], target: string): number {
  return Number(row(summary, target).needs_review ?? 0);
}

function ready(summary: StagingSummaryRow[], target: string): number {
  return Number(row(summary, target).ready ?? 0);
}

function blocked(summary: StagingSummaryRow[], target: string): number {
  return Number(row(summary, target).blocked ?? 0);
}

export async function loadReviewCommandCenter(): Promise<ReviewCommandCenterData> {
  const [
    openDecisions,
    reviewArtifacts,
    unresolvedMedia,
    unknownFields,
    promotionEventsCount,
    registryReviewItemsCount,
    highPriorityRegistryReviewItems,
    decisionSamples,
    artifactSamples,
    fieldDictionary,
    mediaRows,
    promotionEvents,
    stagingSummary,
    registryReviewPage,
    registryReviewSummary,
  ] = await Promise.all([
    exactCount("entity_resolution_decisions", { review_required: true, status: "open" }),
    exactCount("wk_import_review_artifacts"),
    exactCount("entity_resolution_decisions", { entity_type: "media_asset", review_required: true, status: "open" }),
    exactCount("wp_postmeta_field_dictionary", { promotion_policy: "review" }),
    exactCount("wk_import_promotion_events"),
    exactCount("registry_review_items", { status: "open" }),
    exactCount("registry_review_items", { status: "open", priority: "high" }),
    loadSamples<ReviewDecisionSample>("entity_resolution_decisions", "id, entity_type, source_title, source_slug, target_title, target_slug, confidence_score, decision, status, review_required, reason, created_at, updated_at", "updated_at", 16),
    loadSamples<ReviewArtifactSample>("wk_import_review_artifacts", "id, artifact_type, title, source_kind, source_record_id, review_status, notes, created_at", "created_at", 10),
    loadSamples<FieldDictionaryRow>("wp_postmeta_field_dictionary", "id, meta_key, field_group, promotion_policy, confidence, occurrence_count, object_count, reason, approved_policy, updated_at", "occurrence_count", 12),
    loadSamples<MediaReviewRow>("wk_media_assets", "id, entity_type, entity_slug, role, url, source, status, updated_at", "updated_at", 10),
    loadSamples<PromotionEventRow>("wk_import_promotion_events", "id, target_table, target_record_id, event_type, message, created_at", "created_at", 10),
    loadStagingSummary(),
    loadRegistryReviewItems({ limit: 18 }),
    loadRegistryReviewSummary(),
  ]);

  const stagingNeedsReview = stagingSummary.reduce((sum, item) => sum + Number(item.needs_review ?? 0), 0);
  const blockedStaging = stagingSummary.reduce((sum, item) => sum + Number(item.blocked ?? 0), 0);

  const phase2Artists = needs(stagingSummary, "artists");
  const phase3ArtistRelationships = ready(stagingSummary, "artist_relationships");
  const phase4EntityRelationships = needs(stagingSummary, "entity_relationships") + needs(stagingSummary, "chart_entry_links");
  const phase5Postmeta = needs(stagingSummary, "custom_fields") || unknownFields;
  const phase6Media = needs(stagingSummary, "media_assets");
  const blockedNoise = blocked(stagingSummary, "ignored_post_types");
  const promotionReady = stagingSummary.reduce((sum, item) => sum + Number(item.ready ?? 0), 0);

  const workstreams: ReviewWorkstream[] = [
    { key: "phase2b_registry_review", label: "Phase 2B — Registry credit review queue", description: "Ambiguous and missing release/track artist credits staged from the Phase 1 shadow relationship layer.", count: registryReviewItemsCount, severity: registryReviewItemsCount > 0 ? "danger" : "success", path: "/admin/review/queue", nextAction: "Resolve primary/featured artist roles in the registry panel before canonical relationship writes are enabled." },
    { key: "phase0_artifacts", label: "Phase 0 — Preserved import artifacts", description: "Raw evidence retained from the migration review layer. Current hard buckets are entity relationships and custom fields.", count: reviewArtifacts, severity: reviewArtifacts > 0 ? "warning" : "success", path: "/admin/imports/review-artifacts", nextAction: "Use this as the audit source of truth before adding resolver write actions." },
    { key: "phase1_staging", label: "Phase 1 — Promotion-ready staging records", description: "Rows already classified as ready across tracks, chart entries, artists, release links, terms, labels, genres, and authors.", count: promotionReady, severity: promotionReady > 0 ? "brand" : "neutral", path: "/admin/imports/review-artifacts", nextAction: "Verify ready counts against live production tables before the next promotion pass." },
    { key: "phase2_artists", label: "Phase 2 — Artist records needing review", description: "Wakilisha artist rows that could not be safely promoted without human identity/metadata checks.", count: phase2Artists, severity: phase2Artists > 0 ? "danger" : "success", path: "/admin/imports/review-artifacts", nextAction: "Prioritize artist rows by completeness, duplicates, aliases, country/genre confidence, and image availability." },
    { key: "phase3_artist_relationships", label: "Phase 3 — Artist-to-artist relationships", description: "Rich artist relationship data that is already promotion-ready, including shared tracks/scores/feature context.", count: phase3ArtistRelationships, severity: phase3ArtistRelationships > 0 ? "brand" : "neutral", path: "/admin/imports/review-artifacts", nextAction: "Validate that the public graph and artist detail pages can actually display this relationship data." },
    { key: "phase4_entity_relationships", label: "Phase 4 — WP/entity relationship review", description: "WP term links, entity links, and chart entry links that need mapping policy before promotion.", count: phase4EntityRelationships, severity: phase4EntityRelationships > 0 ? "danger" : "success", path: "/admin/imports/review-artifacts", nextAction: "Split WP term links from chart/entity links, then approve deterministic mappings in batches." },
    { key: "phase5_postmeta", label: "Phase 5 — Postmeta/custom-field policy", description: "Custom fields requiring classification into useful metadata, media hints, SEO/editorial fields, sensitive fields, or layout junk.", count: phase5Postmeta, severity: phase5Postmeta > 0 ? "warning" : "success", nextAction: "Classify high-frequency keys first so useful metadata can be promoted while junk stays blocked." },
    { key: "phase6_media", label: "Phase 6 — Media assets operationalization", description: "WordPress media URLs and image candidates that need entity attachment, role assignment, and fallback behavior.", count: phase6Media || unresolvedMedia, severity: phase6Media > 0 || unresolvedMedia > 0 ? "warning" : "success", path: "/admin/media/library", nextAction: "Map real WP image URLs to artist, track, release, label, article, and chart surfaces." },
    { key: "blocked_noise", label: "Blocked noise — Ignored post types", description: "Legacy WordPress post types intentionally blocked from promotion unless a later product decision says otherwise.", count: blockedNoise, severity: blockedNoise > 0 ? "neutral" : "success", nextAction: "Keep blocked unless a specific UI/product surface needs one of these old post types." },
  ];

  return {
    totals: { openDecisions, reviewArtifacts, unresolvedMedia, unknownFields, stagingNeedsReview, blockedStaging, promotionEvents: promotionEventsCount, registryReviewItems: registryReviewItemsCount, highPriorityRegistryReviewItems },
    workstreams,
    decisionSamples,
    artifactSamples,
    fieldDictionary,
    mediaRows,
    promotionEvents,
    stagingSummary,
    registryReviewItems: registryReviewPage.rows,
    registryReviewSummary,
  };
}

export async function recordRegistryReviewDecision(input: RegistryReviewDecisionInput): Promise<void> {
  const item = input.item;
  const notes = input.notes.trim();
  const resolutionPayload = { decisionType: input.decisionType, notes, ...(input.resolutionPayload ?? {}) };
  const { data: userData } = await supabase.auth.getUser();
  const decidedBy = userData.user?.id ?? null;

  const { error: insertError } = await supabase.from("registry_canonicalization_decisions").insert({
    review_item_id: item.id,
    decision_type: input.decisionType,
    entity_type: item.entity_type || "registry_review_item",
    entity_id: item.entity_id,
    before_payload: { reviewKey: item.review_key, reviewType: item.review_type, sourceTable: item.source_table, sourceId: item.source_id, sourcePayload: item.source_payload ?? {}, candidatePayload: item.candidate_payload ?? {} },
    after_payload: resolutionPayload,
    decision_notes: notes || null,
    decided_by: decidedBy,
    status: "recorded",
    metadata: { phase: "phase2b_admin_review", canonicalEntitiesChanged: false, publicApiChanged: false, publicRenderingChanged: false },
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("registry_review_items")
    .update({ status: "resolved", resolution_payload: resolutionPayload, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", item.id);
  if (updateError) throw updateError;
}

export function formatReviewCount(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

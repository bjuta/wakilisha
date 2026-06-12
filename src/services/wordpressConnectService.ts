import { supabase } from "@/lib/supabase";

// ---- Types ----

export type WizardStep = "connect" | "map" | "stage" | "finalize";

export type WpPingResult = {
  accessible: boolean;
  siteUrl: string;
  results: Record<string, { accessible: boolean; status?: number; error?: string; latency?: number }>;
  message: string;
};

export type WpDiscoveredPostType = {
  name: string;
  description: string;
  restBase: string;
  hierarchical: boolean;
  hasArchive: boolean;
};

export type WpSampleItem = {
  id: number;
  title: string;
  slug: string;
  date?: string;
  status?: string;
  type?: string;
  link?: string;
  name?: string;
};

export type WpDiscoveryResult = {
  siteUrl: string;
  discoveredAt: string;
  postTypes: Record<string, WpDiscoveredPostType>;
  taxonomies: Record<string, { name: string; description: string; restBase: string; types: string[] }>;
  counts: Record<string, number>;
  samples: Record<string, WpSampleItem[]>;
  siteInfo: Record<string, unknown> | null;
};

export type EntityMapping = {
  id: string;
  sourceType: string;
  sourceLabel: string;
  targetTable: string;
  targetLabel: string;
  confidence: number;
  status: "auto_matched" | "needs_review" | "ignored";
  reason: string;
  exampleCount: number;
};

export type WizardRun = {
  id: string;
  source_name: string;
  source_kind: string;
  status: string;
  source_manifest: Record<string, unknown> | null;
  created_at: string;
  imported_counts: Record<string, number> | null;
};

// ---- Preset mappings from WP post types to canonical target entities ----
// SYNCHRONIZED with scripts/imports/wakilisha-cpt-map.ts (authoritative)

const WP_TYPE_TO_TARGET: Record<string, { table: string; label: string; confidence: number; reason: string }> = {
  // Standard WordPress types
  post: { table: "articles", label: "Articles", confidence: 0.92, reason: "Standard WordPress posts map to editorial articles." },
  page: { table: "pages", label: "Pages", confidence: 0.90, reason: "WordPress pages map to site pages." },
  attachment: { table: "media_assets", label: "Media Assets", confidence: 0.88, reason: "Attachments map to the media library." },

  // === WAKILISHA CPT Map (authoritative — from wakilisha-cpt-map.ts) ===
  wakilisha_artist: { table: "artists", label: "Artists", confidence: 0.95, reason: "WAKILISHA custom post type wakilisha_artist maps to artist registry." },
  wk_registry_track: { table: "tracks", label: "Tracks", confidence: 0.95, reason: "WAKILISHA custom post type wk_registry_track maps to track registry." },
  wk_registry_release: { table: "releases", label: "Releases", confidence: 0.95, reason: "WAKILISHA custom post type wk_registry_release maps to release registry." },
  wk_registry_label: { table: "labels", label: "Labels", confidence: 0.95, reason: "WAKILISHA custom post type wk_registry_label maps to label registry." },
  wk_genre_page: { table: "genres", label: "Genres", confidence: 0.95, reason: "WAKILISHA custom post type wk_genre_page maps to genre registry." },
  wk_field_guide: { table: "guides", label: "Field Guides", confidence: 0.93, reason: "WAKILISHA custom post type wk_field_guide maps to field guides." },
  wk_chart_series: { table: "chart_series", label: "Chart Series", confidence: 0.92, reason: "WAKILISHA custom post type wk_chart_series maps to chart series." },
  wk_chart_edition: { table: "chart_editions", label: "Chart Editions", confidence: 0.92, reason: "WAKILISHA custom post type wk_chart_edition maps to chart editions." },

  // === Surface / page types (needs_review by default) ===
  wk_top10_surface: { table: "chart_surfaces", label: "Top 10 Surface", confidence: 0.60, reason: "Surface/page type — review for target mapping." },
  wk_correction_page: { table: "corrections", label: "Correction Page", confidence: 0.60, reason: "Surface/page type — review for target mapping." },
  wk_settings_surface: { table: "settings_surfaces", label: "Settings Surface", confidence: 0.60, reason: "Surface/page type — review for target mapping." },
  wk_labels_surface: { table: "label_surfaces", label: "Labels Surface", confidence: 0.60, reason: "Surface/page type — review for target mapping." },
  wk_magazine_surface: { table: "magazine_surfaces", label: "Magazine Surface", confidence: 0.60, reason: "Surface/page type — review for target mapping." },
  wk_profile_surface: { table: "profile_surfaces", label: "Profile Surface", confidence: 0.60, reason: "Surface/page type — review for target mapping." },
  wk_methodology: { table: "methodologies", label: "Methodology", confidence: 0.60, reason: "Surface/page type — review for target mapping." },
  wk_play_surface: { table: "play_surfaces", label: "Play Surface", confidence: 0.60, reason: "Surface/page type — review for target mapping." },

  // Legacy/alternate WP post type names
  wk_artist: { table: "artists", label: "Artists", confidence: 0.95, reason: "Custom post type wk_artist maps to the artist registry." },
  wk_track: { table: "tracks", label: "Tracks", confidence: 0.95, reason: "Custom post type wk_track maps to the track registry." },
  wk_release: { table: "releases", label: "Releases", confidence: 0.95, reason: "Custom post type wk_release maps to the release registry." },
  wk_label: { table: "labels", label: "Labels", confidence: 0.95, reason: "Custom post type wk_label maps to the label registry." },
  wk_genre: { table: "genres", label: "Genres", confidence: 0.95, reason: "Custom post type wk_genre maps to the genre registry." },
  wk_guide: { table: "guides", label: "Guides", confidence: 0.93, reason: "Custom post type wk_guide maps to guides." },
  wk_chart: { table: "chart_programs", label: "Chart Programs", confidence: 0.90, reason: "Custom post type wk_chart maps to chart programs." },
  wk_media: { table: "media_assets", label: "Media Assets", confidence: 0.93, reason: "Custom post type wk_media maps to media assets." },
  wk_issue: { table: "magazine_issues", label: "Magazine Issues", confidence: 0.95, reason: "Custom post type wk_issue maps to magazine issues." },
};

const WP_TAXONOMY_TO_TARGET: Record<string, { table: string; label: string; confidence: number; reason: string }> = {
  category: { table: "taxonomy", label: "Categories", confidence: 0.88, reason: "Standard WordPress categories become editorial taxonomy." },
  post_tag: { table: "taxonomy", label: "Tags", confidence: 0.85, reason: "Standard WordPress tags become content tags." },
  wk_artist_genre: { table: "taxonomy", label: "Artist Genres", confidence: 0.90, reason: "Custom taxonomy for artist genres." },
};

// ---- API calls through the edge function ----

async function callProxy(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("wp-connect-proxy", {
    body: { action, ...payload },
  });

  if (error) {
    // Try to extract the actual response body from the error for diagnostics
    let detail = error.message;
    if (typeof (error as Record<string, unknown>).context === "object" && (error as Record<string, unknown>).context) {
      const ctx = (error as Record<string, unknown>).context as Record<string, unknown>;
      if (ctx.responseBody) {
        detail = String(ctx.responseBody);
      } else if (ctx.status) {
        detail = `HTTP ${ctx.status} — ${error.message}`;
      }
    }
    throw new Error(detail);
  }

  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    const d = data as Record<string, unknown>;
    throw new Error(`Edge function: ${String(d.error)}${d.detail ? ` — ${String(d.detail)}` : ""}`);
  }

  return data;
}

export async function pingWordPress(siteUrl: string): Promise<WpPingResult> {
  return callProxy("ping", { siteUrl }) as Promise<WpPingResult>;
}

export async function discoverWordPress(siteUrl: string): Promise<WpDiscoveryResult> {
  return callProxy("discover", { siteUrl }) as Promise<WpDiscoveryResult>;
}

// ---- Mapping logic ----

export function generateMappings(discovery: WpDiscoveryResult): EntityMapping[] {
  const mappings: EntityMapping[] = [];
  let id = 0;

  // Map post types
  for (const [wpType, count] of Object.entries(discovery.counts)) {
    if (wpType === "users") continue; // handled separately
    if (count === 0) continue;

    const preset = WP_TYPE_TO_TARGET[wpType];
    if (preset) {
      mappings.push({
        id: `m-${++id}`,
        sourceType: wpType,
        sourceLabel: discovery.postTypes[wpType]?.name || wpType,
        targetTable: preset.table,
        targetLabel: preset.label,
        confidence: preset.confidence,
        status: preset.confidence >= 0.9 ? "auto_matched" : "needs_review",
        reason: preset.reason,
        exampleCount: count,
      });
    } else {
      mappings.push({
        id: `m-${++id}`,
        sourceType: wpType,
        sourceLabel: discovery.postTypes[wpType]?.name || wpType,
        targetTable: "custom_content",
        targetLabel: `Custom: ${wpType}`,
        confidence: 0.4,
        status: "needs_review",
        reason: `Unknown post type "${wpType}". Needs manual mapping.`,
        exampleCount: count,
      });
    }
  }

  // Map taxonomies
  for (const [taxSlug, taxInfo] of Object.entries(discovery.taxonomies)) {
    const preset = WP_TAXONOMY_TO_TARGET[taxSlug];
    if (preset) {
      mappings.push({
        id: `m-${++id}`,
        sourceType: `taxonomy:${taxSlug}`,
        sourceLabel: taxInfo.name,
        targetTable: preset.table,
        targetLabel: preset.label,
        confidence: preset.confidence,
        status: preset.confidence >= 0.9 ? "auto_matched" : "needs_review",
        reason: preset.reason,
        exampleCount: 0,
      });
    }
  }

  // Map users
  if ((discovery.counts["users"] ?? 0) > 0) {
    mappings.push({
      id: `m-${++id}`,
      sourceType: "users",
      sourceLabel: "Users / Authors",
      targetTable: "authors",
      targetLabel: "Author Profiles",
      confidence: 0.86,
      status: "auto_matched",
      reason: "WordPress users map to author profiles.",
      exampleCount: discovery.counts["users"] || 0,
    });
  }

  return mappings;
}

// ---- Ingestion run management ----

export async function createIngestionRun(
  siteUrl: string,
  discovery: WpDiscoveryResult,
  mappings: EntityMapping[],
): Promise<WizardRun> {
  const totalItems = Object.values(discovery.counts).reduce((sum, c) => sum + (typeof c === "number" ? c : 0), 0);

  const manifest = {
    connection_type: "wordpress_rest_api",
    site_url: siteUrl,
    discovered_at: discovery.discoveredAt,
    scan: {
      archive: { file_count: 0 },
      counts: discovery.counts,
      detected: Object.keys(discovery.postTypes),
      evidence: {
        post_types: discovery.postTypes,
        taxonomies: discovery.taxonomies,
        samples: discovery.samples,
        site_info: discovery.siteInfo,
      },
      generated_at: new Date().toISOString(),
    },
    mappings: {
      processor: "wakilisha-cpt-map",
      summary: {
        total: mappings.length,
        auto_matched: mappings.filter((m) => m.status === "auto_matched").length,
        needs_review: mappings.filter((m) => m.status === "needs_review").length,
      },
      candidates: mappings.map((m) => ({
        id: m.id,
        source: { entity: m.sourceType, field: "*" },
        target: { entity: m.targetTable, field: "*" },
        confidence: m.confidence,
        status: m.status,
        reason: m.reason,
        example_count: m.exampleCount,
      })),
    },
    staging_plan: {
      mode: "wordpress_rest_api",
      scan_summary: {
        count_groups: Object.keys(discovery.counts).length,
        total_items: totalItems,
      },
      mapping_summary: {
        total_candidates: mappings.length,
        auto_matched: mappings.filter((m) => m.status === "auto_matched").length,
        needs_review: mappings.filter((m) => m.status === "needs_review").length,
      },
      buckets: mappings.filter((m) => m.status === "auto_matched").map((m) => ({
        target_entity: m.targetTable,
        candidate_count: m.exampleCount,
        auto_matched: 1,
        needs_review: 0,
        blocked: false,
        blocker_reasons: [] as string[],
        source_files: [m.sourceType],
        candidate_ids: [m.id],
      })),
      readiness: {
        ready_bucket_count: mappings.filter((m) => m.status === "auto_matched").length,
        blocked_bucket_count: mappings.filter((m) => m.status === "needs_review").length,
        can_stage_anything: mappings.some((m) => m.status === "auto_matched"),
        can_import_to_production: false,
        reason: "WordPress REST API connection established. Ready for staging.",
      },
    },
  };

  const { data, error } = await supabase
    .from("wk_ingestion_runs")
    .insert({
      source_name: siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
      source_kind: "wordpress_rest_api",
      source_manifest: manifest,
      status: "scanned",
      imported_counts: {},
      warnings: [],
      errors: [],
    })
    .select("id, source_name, source_kind, source_manifest, status, created_at, imported_counts")
    .single();

  if (error) throw new Error(`Failed to create ingestion run: ${error.message}`);

  return data as WizardRun;
}

export type TypeDiagnostic = {
  expectedTotal: number;
  fetchedCount: number;
  stagedCount: number;
  draftCount: number;
  pagesFetched: number;
  apiOk: boolean;
  errorMessage?: string;
  isAggregateCpt: boolean;
  warning?: string;
};

export async function stageIngestionRun(runId: string, maxItems = 500): Promise<{ success: boolean; stats: Record<string, number>; entityCounts: Record<string, number>; draftCounts: Record<string, number>; typeDiagnostics: Record<string, TypeDiagnostic> }> {
  const { data, error } = await supabase.functions.invoke("process-wp-import", {
    body: { runId, maxItems },
  });

  if (error) {
    // Still update the run status so user can see the attempt
    await supabase.from("wk_ingestion_runs").update({
      status: "failed",
      errors: [error.message],
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
    throw new Error(`Staging failed: ${error.message}`);
  }

  const result = data as { success: boolean; runId: string; stats: Record<string, number>; entityCounts: Record<string, number>; draftCounts: Record<string, number>; errorCount: number };

  if (!result.success) {
    throw new Error("Staging returned failure status.");
  }

  return result;
}

export async function finalizeIngestionRun(runId: string): Promise<{ success: boolean; summary: Record<string, number>; totalFinalized: number; skipped: number }> {
  const { data, error } = await supabase.functions.invoke("finalize-wp-staging", {
    body: { runId },
  });

  if (error) {
    await supabase.from("wk_ingestion_runs").update({
      status: "failed",
      errors: [error.message],
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
    throw new Error(`Finalization failed: ${error.message}`);
  }

  const result = data as { success: boolean; summary: Record<string, number>; totalFinalized: number; skipped: number };

  if (!result.success) {
    throw new Error("Finalization returned failure status.");
  }

  return result;
}

// ----
// WordPress Database Direct Connect
// ----

export interface WpDbCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  prefix: string;
}

export interface WpDbTestResult {
  success: boolean;
  accessible: boolean;
  message: string;
  error?: string;
  scan?: {
    counts: Record<string, number>;
    postTypeCounts: Record<string, number>;
    postTypeStatuses: Record<string, Record<string, number>>;
  };
}

export interface WpDbStageResult {
  success: boolean;
  runId: string;
  stats: {
    total: number;
    staged: number;
    ready: number;
    needs_review: number;
    drafts: number;
    blocked: number;
    failed: number;
  };
  entityCounts: Record<string, number>;
}

export async function testWordPressDatabase(credentials: WpDbCredentials): Promise<WpDbTestResult> {
  const { data, error } = await supabase.functions.invoke("wp-db-stage", {
    body: { action: "test", credentials },
  });

  if (error) {
    // Try to dig the real error out of the response context
    let detail = error.message;
    if (typeof (error as Record<string, unknown>).context === "object" && (error as Record<string, unknown>).context) {
      const ctx = (error as Record<string, unknown>).context as Record<string, unknown>;
      if (ctx.responseBody) {
        try {
          const parsed = JSON.parse(String(ctx.responseBody));
          if (parsed.error) detail = parsed.error;
          if (parsed.hint) detail += ` — ${parsed.hint}`;
        } catch {
          detail = String(ctx.responseBody);
        }
      } else if (ctx.status) {
        detail = `HTTP ${ctx.status} — ${error.message}`;
      }
    }
    return { success: false, accessible: false, message: detail, error: detail };
  }

  return data as WpDbTestResult;
}

export async function createDatabaseRun(
  credentials: WpDbCredentials,
): Promise<{ runId: string; message: string }> {
  const { data, error } = await supabase.functions.invoke("create-wp-run", {
    body: credentials,
  });

  if (error) {
    let detail = error.message;
    // Try to extract the actual JSON response body from the error context
    if (typeof (error as Record<string, unknown>).context === "object" && (error as Record<string, unknown>).context) {
      const ctx = (error as Record<string, unknown>).context as Record<string, unknown>;
      if (typeof ctx.responseBody === "string") {
        try {
          const parsed = JSON.parse(ctx.responseBody);
          if (parsed.error) detail = parsed.error;
          if (parsed.details) detail += ` — ${parsed.details}`;
          if (parsed.hint) detail += ` — ${parsed.hint}`;
          if (parsed.code) detail += ` [${parsed.code}]`;
        } catch {
          detail = ctx.responseBody;
        }
      } else if (ctx.status) {
        detail = `HTTP ${ctx.status} — ${error.message}`;
      }
    }
    throw new Error(`Failed to create run: ${detail}`);
  }

  const result = data as { success: boolean; runId: string; error?: string };
  if (!result.success) {
    throw new Error(result.error || "Failed to create run.");
  }

  return { runId: result.runId, message: "Run created. Run the CLI command on your WordPress server." };
}

export async function stageWordPressDatabase(credentials: WpDbCredentials, runId?: string): Promise<WpDbStageResult> {
  const { data, error } = await supabase.functions.invoke("wp-db-stage", {
    body: { action: "stage", credentials, runId },
  });

  if (error) {
    let detail = error.message;
    if (typeof (error as Record<string, unknown>).context === "object" && (error as Record<string, unknown>).context) {
      const ctx = (error as Record<string, unknown>).context as Record<string, unknown>;
      if (ctx.responseBody) {
        try {
          const parsed = JSON.parse(String(ctx.responseBody));
          if (parsed.error) detail = parsed.error;
          if (parsed.hint) detail += ` — ${parsed.hint}`;
        } catch {
          detail = String(ctx.responseBody);
        }
      } else if (ctx.status) {
        detail = `HTTP ${ctx.status} — ${error.message}`;
      }
    }
    throw new Error(detail);
  }

  const result = data as WpDbStageResult;
  if (!result.success) {
    throw new Error("Database staging returned failure status.");
  }

  return result;
}

// ----
// Existing database state check
// ----

export async function getExistingEntityCounts(): Promise<Record<string, number>> {
  const tables: Record<string, string> = {
    tracks: "registry_tracks",
    artists: "registry_artists",
    releases: "registry_releases",
    labels: "registry_labels",
    genres: "registry_genres",
    articles: "wk_articles",
    pages: "wk_guides",
    guides: "wk_guides",
    chart_series: "wk_chart_series_v2",
    chart_editions: "wk_chart_editions_v2",
  };

  const counts: Record<string, number> = {};
  for (const [key, table] of Object.entries(tables)) {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
    counts[key] = count ?? 0;
  }
  return counts;
}
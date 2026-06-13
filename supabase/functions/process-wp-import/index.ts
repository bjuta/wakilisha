import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_PAGE_SIZE = 50;
const BATCH_SIZE = 100;

const CPT_MAP: Record<string, { target_entity: string; canonical_kind: string; ready_policy: string }> = {
  post: { target_entity: "articles", canonical_kind: "article", ready_policy: "published_only" },
  page: { target_entity: "pages", canonical_kind: "page", ready_policy: "published_only" },
  wakilisha_artist: { target_entity: "artists", canonical_kind: "artist", ready_policy: "published_only" },
  wk_registry_track: { target_entity: "tracks", canonical_kind: "track", ready_policy: "published_only" },
  wk_registry_release: { target_entity: "releases", canonical_kind: "release", ready_policy: "published_only" },
  wk_registry_label: { target_entity: "labels", canonical_kind: "label", ready_policy: "published_only" },
  wk_genre_page: { target_entity: "genres", canonical_kind: "genre", ready_policy: "published_only" },
  wk_field_guide: { target_entity: "guides", canonical_kind: "guide", ready_policy: "published_only" },
  wk_chart_series: { target_entity: "chart_series", canonical_kind: "chart_series", ready_policy: "published_only" },
  wk_chart_edition: { target_entity: "chart_editions", canonical_kind: "chart_edition", ready_policy: "published_only" },
  wk_top10_surface: { target_entity: "chart_surfaces", canonical_kind: "chart_surface", ready_policy: "needs_review" },
  wk_magazine_surface: { target_entity: "magazine_surfaces", canonical_kind: "magazine_surface", ready_policy: "needs_review" },
  wk_methodology: { target_entity: "methodologies", canonical_kind: "methodology", ready_policy: "published_only" },
  wk_correction_page: { target_entity: "corrections", canonical_kind: "correction", ready_policy: "needs_review" },
  wk_play_surface: { target_entity: "play_surfaces", canonical_kind: "play_surface", ready_policy: "needs_review" },
  wk_labels_surface: { target_entity: "label_surfaces", canonical_kind: "label_surface", ready_policy: "needs_review" },
  wk_settings_surface: { target_entity: "settings_surfaces", canonical_kind: "settings_surface", ready_policy: "needs_review" },
  wk_profile_surface: { target_entity: "profile_surfaces", canonical_kind: "profile_surface", ready_policy: "needs_review" },
  wk_genre: { target_entity: "genres", canonical_kind: "genre", ready_policy: "published_only" },
  wk_artist: { target_entity: "artists", canonical_kind: "artist", ready_policy: "published_only" },
  wk_track: { target_entity: "tracks", canonical_kind: "track", ready_policy: "published_only" },
  wk_release: { target_entity: "releases", canonical_kind: "release", ready_policy: "published_only" },
  wk_label: { target_entity: "labels", canonical_kind: "label", ready_policy: "published_only" },
  wk_guide: { target_entity: "guides", canonical_kind: "guide", ready_policy: "published_only" },
  wk_chart: { target_entity: "chart_programs", canonical_kind: "chart_program", ready_policy: "published_only" },
  wk_media: { target_entity: "media_assets", canonical_kind: "media_asset", ready_policy: "needs_review" },
  wk_issue: { target_entity: "magazine_issues", canonical_kind: "magazine_issue", ready_policy: "published_only" },
  attachment: { target_entity: "media_assets", canonical_kind: "media_asset", ready_policy: "needs_review" },
};

const KNOWN_AGGREGATE_CPTS = new Set([
  "wk_registry_track", "wk_track",
  "wk_registry_release", "wk_release",
  "wk_registry_label", "wk_label",
]);

function decodeVcRawHtml(encoded: string): string {
  try {
    const raw = atob(encoded.trim());
    const decoded = decodeURIComponent(raw);
    if (/^\s*\[/.test(decoded)) return "";
    return decoded;
  } catch {
    return "";
  }
}

function sanitizeVcShortcodes(html: string): string {
  if (!html || typeof html !== "string") return html;
  let result = html;
  result = result.replace(/\[vc_raw_html\]([\s\S]*?)\[\/vc_raw_html\]/gi, (_: string, encoded: string) => decodeVcRawHtml(encoded));
  result = result.replace(/\[vc_[^\]]*?\/\]/gi, "");
  result = result.replace(/\[vc_[^\]]*?\]/gi, "");
  result = result.replace(/\[\/vc_[^\]]*?\]/gi, "");
  result = result.replace(/\[uncode_[^\]]*?\][\s\S]*?\[\/uncode_[^\]]*?\]/gi, "");
  result = result.replace(/\[uncode_[^\]]*?\/?\]/gi, "");
  result = result.replace(/\[\/uncode_[^\]]*?\]/gi, "");
  result = result.replace(/\[caption[^\]]*?\]([\s\S]*?)\[\/caption\]/gi, "$1");
  result = result.replace(/\[gallery[^\]]*?\]/gi, "");
  result = result.replace(/\[playlist[^\]]*?\]/gi, "");
  result = result.replace(/\[audio[^\]]*?\]/gi, "");
  result = result.replace(/\[video[^\]]*?\]/gi, "");
  result = result.replace(/\s*uncode_shortcode_id="[^"]*"/gi, "");
  result = result.replace(/(\n\s*){3,}/g, "\n\n");
  return result;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/, "").slice(0, 200);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function cptEntry(postType: string) {
  return CPT_MAP[postType] || null;
}

function targetEntityForPostType(postType: string): string {
  return cptEntry(postType)?.target_entity ?? (postType === "post" ? "articles" : postType === "page" ? "pages" : postType === "attachment" ? "media_assets" : "content_entities");
}

function shouldReady(postType: string, status: string, title: string): boolean {
  const entry = cptEntry(postType);
  if (!title || !["publish", "published"].includes(status.toLowerCase())) return false;
  if (!entry) return postType === "post" || postType === "page";
  return entry.ready_policy === "published_only";
}

function mapTargetStatus(postType: string, wpStatus: string, title: string): string {
  if (shouldReady(postType, wpStatus, title)) return "ready";
  if (title || cptEntry(postType)) return "needs_review";
  return "blocked";
}

function extractFeaturedImage(embedded: Record<string, unknown> | undefined): { url: string; alt: string } | null {
  if (!embedded || !embedded["wp:featuredmedia"]) return null;
  const media = (embedded["wp:featuredmedia"] as Array<Record<string, unknown>>)?.[0];
  if (!media) return null;
  const sourceUrl = media.source_url as string || "";
  const altText = (media.alt_text as string) || "";
  const sizes = media.media_details as Record<string, unknown> | undefined;
  const large = sizes?.sizes as Record<string, { source_url: string }> | undefined;
  const largeUrl = large?.large?.source_url || large?.full?.source_url || sourceUrl;
  return { url: largeUrl || sourceUrl, alt: altText };
}

function extractTerms(embedded: Record<string, unknown> | undefined): Array<{ taxonomy: string; slug: string; name: string }> {
  if (!embedded || !embedded["wp:term"]) return [];
  const terms: Array<{ taxonomy: string; slug: string; name: string }> = [];
  const termGroups = embedded["wp:term"] as Array<Array<Record<string, unknown>>>;
  for (const group of termGroups) {
    for (const term of group) {
      terms.push({
        taxonomy: String(term.taxonomy ?? ""),
        slug: String(term.slug ?? ""),
        name: String(term.name ?? ""),
      });
    }
  }
  return terms;
}

function extractAuthor(item: Record<string, unknown>): { authorId: string; authorName: string } {
  const authorId = item.author != null ? String(item.author) : "";
  const embedded = item._embedded as Record<string, unknown> | undefined;
  const authorArr = embedded?.author;
  let authorName = "";
  if (Array.isArray(authorArr) && authorArr.length > 0) {
    authorName = String((authorArr[0] as Record<string, unknown>).name || "");
  }
  return { authorId, authorName };
}

function getTitle(item: Record<string, unknown>): string {
  if (typeof item.title === "object" && item.title) {
    return (item.title as Record<string, string>).rendered || "";
  }
  return String(item.id ?? "");
}

function getContent(item: Record<string, unknown>): string {
  if (typeof item.content === "object" && item.content) {
    return (item.content as Record<string, string>).rendered || "";
  }
  return "";
}

function getExcerpt(item: Record<string, unknown>): string {
  if (typeof item.excerpt === "object" && item.excerpt) {
    return (item.excerpt as Record<string, string>).rendered || "";
  }
  return "";
}

function buildStageRecord(
  runId: string,
  item: Record<string, unknown>,
  postType: string,
  sourceFile: string,
): Record<string, unknown> {
  const wpId = String(item.id ?? "unknown");
  const wpStatus = String(item.status ?? "publish");
  const title = getTitle(item);
  const rawContent = getContent(item);
  const rawExcerpt = getExcerpt(item);

  const cleanContent = sanitizeVcShortcodes(rawContent);
  const cleanExcerpt = stripHtml(rawExcerpt).slice(0, 500);

  const postName = String(item.slug ?? "");
  const slug = postName || slugify(title || wpId);
  const targetEntity = targetEntityForPostType(postType);
  const targetStatus = mapTargetStatus(postType, wpStatus, title);
  const entry = cptEntry(postType);
  const embedded = item._embedded as Record<string, unknown> | undefined;
  const featuredImage = extractFeaturedImage(embedded);
  const terms = extractTerms(embedded);
  const wpMeta = (item.meta as Record<string, unknown>) || {};
  const date = String(item.date ?? "");
  const modified = String(item.modified ?? "");

  const { authorId, authorName } = extractAuthor(item);

  const warnings: string[] = [];
  if (!title) warnings.push("Missing title.");
  if (entry && targetStatus !== "ready") {
    warnings.push(`WAKILISHA CPT ${postType} mapped to ${targetEntity}; review metadata/relationships before finalization.`);
  }
  if (wpStatus !== "publish") {
    warnings.push(`Post status "${wpStatus}" preserved — will remain draft on promotion.`);
  }

  const vcCleaned = cleanContent !== rawContent;

  const rawRecord = {
    wp_id: wpId,
    wp_type: postType,
    wp_link: String(item.link ?? ""),
    wp_status: wpStatus,
    date,
    modified,
    title: stripHtml(title),
    content: cleanContent,
    content_import_cleaned: vcCleaned,
    excerpt: rawExcerpt,
    slug,
    featured_image: featuredImage,
    terms,
    meta: wpMeta,
    post_author: authorId || null,
    author_name: authorName || null,
  };

  const mappedRecord = {
    title: stripHtml(title),
    body: cleanContent,
    excerpt: cleanExcerpt,
    slug,
    source_status: wpStatus,
    post_type: postType,
    canonical_kind: entry?.canonical_kind ?? postType,
    wakilisha_cpt: Boolean(entry),
    published_at: parseDate(date),
    modified_at: parseDate(modified),
    featured_image_url: featuredImage?.url || null,
    featured_image_alt: featuredImage?.alt || null,
    terms_count: terms.length,
    wp_custom_fields_count: Object.keys(wpMeta).length,
    vc_shortcodes_cleaned: vcCleaned,
    post_author: authorId || null,
    author_name: authorName || null,
  };

  return {
    ingestion_run_id: runId,
    source_kind: "wordpress_rest_api",
    source_file: sourceFile,
    source_entity: `wp_api.${postType}`,
    source_record_id: wpId || null,
    source_slug: postName || null,
    target_entity: targetEntity,
    target_status: targetStatus,
    target_slug: slug || null,
    title: stripHtml(title) || null,
    body: cleanContent || null,
    excerpt: cleanExcerpt || null,
    published_at: parseDate(date),
    author_name: authorName || null,
    source_url: String(item.link ?? "") || null,
    raw_record: rawRecord,
    mapped_record: mappedRecord,
    mapping_candidate_ids: entry ? [`wakilisha-cpt-${postType}`] : [postType === "post" ? "wp-post" : postType === "page" ? "wp-page" : `wp-${postType}`],
    warnings,
    errors: targetStatus === "blocked" ? ["Cannot stage as ready without a title or recognized post type."] : [],
  };
}

async function insertBatch(supabase: ReturnType<typeof createClient>, records: Record<string, unknown>[]) {
  const { error } = await supabase.from("wk_import_staging_records").insert(records);
  if (error) throw new Error(`Staging insert failed: ${error.message}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { runId, maxItems = 500 } = body;
    if (!runId) {
      return new Response(JSON.stringify({ error: "runId is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run, error: runErr } = await supabase
      .from("wk_ingestion_runs").select("*").eq("id", runId).maybeSingle();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Ingestion run not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const manifest = run.source_manifest ?? {};
    const siteUrl = (manifest as Record<string, unknown>).site_url as string || "";
    const stagingPlan = (manifest as Record<string, unknown>).staging_plan as Record<string, unknown> | undefined;
    const buckets = (stagingPlan?.buckets ?? []) as Array<Record<string, unknown>>;

    if (!siteUrl) {
      return new Response(JSON.stringify({ error: "No site_url in source_manifest." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("wk_ingestion_runs").update({
      status: "staging", started_at: new Date().toISOString(), errors: [],
    }).eq("id", runId);

    await supabase.from("wk_import_staging_records").delete().eq("ingestion_run_id", runId);
    await supabase.from("wk_import_staging_failures").delete().eq("ingestion_run_id", runId);

    const stats = { total: 0, staged: 0, failed: 0, skipped: 0, drafts: 0, vcCleaned: 0, authorsFound: 0 };
    const errors: string[] = [];
    const warnings: string[] = [];
    const entityCounts: Record<string, number> = {};
    const draftCounts: Record<string, number> = {};
    const allRecords: Record<string, unknown>[] = [];
    const allFailures: Record<string, unknown>[] = [];

    const typeDiags: Record<string, {
      expectedTotal: number;
      fetchedCount: number;
      stagedCount: number;
      draftCount: number;
      pagesFetched: number;
      apiOk: boolean;
      errorMessage?: string;
      isAggregateCpt: boolean;
      warning?: string;
    }> = {};

    let typesToFetch: string[] = [];
    if (buckets.length > 0) {
      for (const bucket of buckets) {
        const sourceFiles = bucket.source_files as string[] | undefined;
        if (sourceFiles && sourceFiles.length > 0) {
          typesToFetch.push(...sourceFiles);
        }
      }
      typesToFetch = [...new Set(typesToFetch)];
    } else {
      const scan = (manifest as Record<string, unknown>).scan as Record<string, unknown> | undefined;
      const evidence = scan?.evidence as Record<string, unknown> | undefined;
      const postTypes = evidence?.post_types as Record<string, unknown> | undefined;
      if (postTypes) {
        typesToFetch = Object.keys(postTypes).filter((k) => k !== "__error");
      }
    }

    if (typesToFetch.length === 0) {
      typesToFetch = ["posts", "pages"];
    }

    const fetched: Set<string> = new Set();

    for (const postType of typesToFetch) {
      if (fetched.has(postType)) continue;
      const entry = cptEntry(postType);
      const targetEntity = targetEntityForPostType(postType);
      const restBase = (manifest as Record<string, unknown>).scan?.evidence?.post_types?.[postType]?.restBase || postType;
      const isAggregate = KNOWN_AGGREGATE_CPTS.has(postType);

      typeDiags[postType] = {
        expectedTotal: 0,
        fetchedCount: 0,
        stagedCount: 0,
        draftCount: 0,
        pagesFetched: 0,
        apiOk: false,
        isAggregateCpt: isAggregate,
      };

      let totalItems = 0;
      try {
        const countRes = await fetch(`${siteUrl}/wp-json/wp/v2/${restBase}?per_page=1&_embed`, {
          headers: { "Accept": "application/json", "User-Agent": "Wakilisha/1.0" },
        });
        if (countRes.ok) {
          totalItems = parseInt(countRes.headers.get("X-WP-Total") || "0", 10);
          typeDiags[postType].expectedTotal = totalItems;
          typeDiags[postType].apiOk = true;
        } else {
          typeDiags[postType].errorMessage = `HTTP ${countRes.status}`;
        }
      } catch (err) {
        typeDiags[postType].errorMessage = err instanceof Error ? err.message : "Connection failed";
      }

      if (totalItems === 0 && typeDiags[postType].errorMessage) {
        stats.skipped++;
        if (isAggregate) {
          typeDiags[postType].warning = `This post type is known to store data in postmeta, not as individual CPT posts. REST API only sees ${totalItems} items. Use the MySQL direct-connect pipeline (scripts/imports/stage-wordpress-database-records.ts) to import its postmeta data.`;
        }
        continue;
      }

      if (totalItems === 0) {
        stats.skipped++;
        continue;
      }

      if (isAggregate && totalItems <= 5) {
        typeDiags[postType].warning = `REST API only exposes ${totalItems} items for this post type. However, the actual track/release/label data is stored in WordPress postmeta, not as individual CPT posts. The MySQL direct-connect pipeline (scripts/imports/stage-wordpress-database-records.ts) can import postmeta data — the REST API cannot.`;
      }

      const limit = Math.min(totalItems, maxItems);
      const pages = Math.ceil(limit / API_PAGE_SIZE);
      typeDiags[postType].pagesFetched = pages;

      for (let page = 1; page <= pages; page++) {
        try {
          const wpRes = await fetch(
            `${siteUrl}/wp-json/wp/v2/${restBase}?per_page=${API_PAGE_SIZE}&page=${page}&orderby=date&order=desc&_embed`,
            { headers: { "Accept": "application/json", "User-Agent": "Wakilisha/1.0" } }
          );

          if (!wpRes.ok) {
            allFailures.push({
              ingestion_run_id: runId,
              source_file: `wp_api.${postType}`,
              source_entity: postType,
              failure_stage: "fetch",
              message: `HTTP ${wpRes.status} on page ${page}`,
              raw_record: { postType, page },
            });
            stats.failed++;
            continue;
          }

          const items = await wpRes.json() as Array<Record<string, unknown>>;
          stats.total += items.length;
          typeDiags[postType].fetchedCount += items.length;

          for (const item of items) {
            const wpStatus = String(item.status ?? "publish");
            const stageRecord = buildStageRecord(runId, item, postType, `wp_api.${postType}`);

            allRecords.push(stageRecord);

            const targetEnt = stageRecord.target_entity as string;
            entityCounts[targetEnt] = (entityCounts[targetEnt] || 0) + 1;

            const wasCleaned = stageRecord.raw_record as Record<string, unknown> | undefined;
            if (wasCleaned?.content_import_cleaned === true) {
              stats.vcCleaned++;
            }

            if (stageRecord.author_name && String(stageRecord.author_name).length > 0) {
              stats.authorsFound++;
            }

            if (wpStatus !== "publish") {
              stats.drafts++;
              draftCounts[targetEnt] = (draftCounts[targetEnt] || 0) + 1;
              typeDiags[postType].draftCount++;
            }

            if (stageRecord.target_status === "ready") {
              stats.staged++;
              typeDiags[postType].stagedCount++;
            }
          }
        } catch (pageErr) {
          const msg = pageErr instanceof Error ? pageErr.message : "network error";
          allFailures.push({
            ingestion_run_id: runId,
            source_file: `wp_api.${postType}`,
            source_entity: postType,
            failure_stage: "fetch",
            message: msg,
            raw_record: { postType, page },
          });
          if (errors.length < 100) errors.push(`Fetch ${postType} page ${page}: ${msg}`);
          stats.failed++;
        }
      }

      fetched.add(postType);
    }

    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      try {
        await insertBatch(supabase, batch);
      } catch (batchErr) {
        const msg = batchErr instanceof Error ? batchErr.message : "insert error";
        errors.push(`Batch insert ${i}-${i + batch.length}: ${msg}`);
      }
    }

    if (allFailures.length > 0) {
      for (let i = 0; i < allFailures.length; i += BATCH_SIZE) {
        const batch = allFailures.slice(i, i + BATCH_SIZE);
        try {
          await supabase.from("wk_import_staging_failures").insert(batch);
        } catch { /* non-fatal */ }
      }
    }

    const aggregateWarnings: string[] = [];
    for (const [pt, diag] of Object.entries(typeDiags)) {
      if (diag.warning) {
        aggregateWarnings.push(`[${pt}] ${diag.warning}`);
      }
    }

    const stagingSummary = {
      staged_at: new Date().toISOString(),
      processor: "process-wp-import-v4",
      version: "4.0.0",
      records: allRecords.length,
      failures: allFailures.length,
      counts_by_target_entity: entityCounts,
      draft_counts: draftCounts,
      vc_shortcodes_cleaned: stats.vcCleaned,
      authors_found: stats.authorsFound,
      wakilisha_cpt_map_enabled: true,
      production_import_enabled: false,
      type_diagnostics: typeDiags,
      aggregate_cpt_warnings: aggregateWarnings,
    };

    const updatedManifest = {
      ...(manifest as Record<string, unknown>),
      staging: stagingSummary,
    };

    const vcMsg = stats.vcCleaned > 0
      ? `${stats.vcCleaned} record(s) had VC/WPBakery shortcodes stripped at import time.`
      : "No VC/WPBakery shortcodes detected in imported content.";

    const authorMsg = stats.authorsFound > 0
      ? `${stats.authorsFound} record(s) had post_author data captured from _embedded.author.`
      : "No author data found in _embedded responses.";

    const updatedWarnings = Array.from(new Set([
      ...(run.warnings ?? []),
      "v4: Records staged via WordPress REST API with post_author extraction from _embedded.author.",
      vcMsg,
      authorMsg,
      allFailures.length > 0 ? `${allFailures.length} staging failure(s) recorded.` : "",
      stats.drafts > 0 ? `${stats.drafts} draft-status items preserved as draft.` : "",
      ...aggregateWarnings,
    ])).filter(Boolean);

    await supabase.from("wk_ingestion_runs").update({
      status: "staged",
      finished_at: new Date().toISOString(),
      imported_counts: entityCounts,
      source_manifest: updatedManifest,
      warnings: updatedWarnings,
      errors: errors.slice(0, 200),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true,
      runId,
      stats: {
        total: stats.total,
        staged: allRecords.length,
        ready: stats.staged,
        drafts: stats.drafts,
        failed: allFailures.length,
        vcShortcodesCleaned: stats.vcCleaned,
        authorsFound: stats.authorsFound,
      },
      entityCounts,
      draftCounts,
      errorCount: errors.length,
      typeDiagnostics: typeDiags,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

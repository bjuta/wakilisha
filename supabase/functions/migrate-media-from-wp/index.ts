import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const BATCH_SIZE = 25;
const STORAGE_BUCKET = "cms-media";
const OLD_DOMAIN = "wakilisha.africa";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Exact WordPress table names from the old database
const WP_TABLES = {
  posts: "wp_posts",
  postmeta: "wp_postmeta",
  users: "wp_users",
  terms: "wp_terms",
  termTaxonomy: "wp_term_taxonomy",
  termRelationships: "wp_term_relationships",
  wkchartsArtists: "wp_wkcharts_artists",
  wkchartsTracks: "wp_wkcharts_tracks",
  wkchartsReleases: "wp_wkcharts_releases",
  wkchartsLabels: "wp_wkcharts_labels",
  wkchartsGenres: "wp_wkcharts_genres",
  wkchartsEditions: "wp_wkcharts_editions",
  wkchartsEditionItems: "wp_wkcharts_edition_items",
  wkchartsTrackArtists: "wp_wkcharts_track_artists",
  wkchartsReleaseTracks: "wp_wkcharts_release_tracks",
} as const;

interface MySQLCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  prefix?: string;
}

interface WordPressAttachment {
  ID: number;
  post_title: string;
  post_name: string;
  post_status: string;
  post_mime_type: string;
  guid: string;
  post_date: string;
  post_date_gmt: string;
  post_content: string;
  post_excerpt: string;
  post_author: number;
  meta: Record<string, string>;
}

function getStoragePath(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace("/wp-content/uploads/", "");
    return `wp-migrated/${pathname.replace(/^\//, "")}`;
  } catch {
    const filename = url.split("/").pop()?.split("?")[0] || "unknown";
    return `wp-migrated/misc/${filename}`;
  }
}

function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  };
  return map[ext] || "image/jpeg";
}

async function downloadImage(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "WakilishaMediaMigrator/1.0" },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    const buffer = await blob.arrayBuffer();
    return {
      data: new Uint8Array(buffer),
      contentType: response.headers.get("content-type") || getContentType(url),
    };
  } catch {
    return null;
  }
}

async function connectToMySQL(credentials: MySQLCredentials): Promise<Client> {
  const client = new Client();
  await client.connect({
    hostname: credentials.host,
    port: credentials.port,
    username: credentials.user,
    password: credentials.password,
    db: credentials.database,
    connectTimeout: 15000,
  });
  return client;
}

async function fetchAttachmentsFromWP(
  client: Client,
  prefix: string,
  offset: number,
  limit: number,
): Promise<WordPressAttachment[]> {
  const postsTable = `${prefix}posts`;
  const postmetaTable = `${prefix}postmeta`;

  const postsResult = await client.execute(
    `SELECT ID, post_title, post_name, post_status, post_mime_type, guid, post_date, post_date_gmt, post_content, post_excerpt, post_author
     FROM \`${postsTable}\`
     WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%'
     ORDER BY ID ASC
     LIMIT ${limit} OFFSET ${offset}`
  );

  const posts = postsResult.rows as Array<Record<string, unknown>>;
  if (!posts.length) return [];

  const postIds = posts.map((p) => p.ID).join(",");

  const metaResult = await client.execute(
    `SELECT post_id, meta_key, meta_value
     FROM \`${postmetaTable}\`
     WHERE post_id IN (${postIds})`
  );

  const metaRows = metaResult.rows as Array<{ post_id: number; meta_key: string; meta_value: string }>;
  const metaMap: Record<number, Record<string, string>> = {};
  for (const row of metaRows) {
    if (!metaMap[row.post_id]) metaMap[row.post_id] = {};
    metaMap[row.post_id][row.meta_key] = row.meta_value;
  }

  return posts.map((post) => ({
    ID: Number(post.ID),
    post_title: String(post.post_title || ""),
    post_name: String(post.post_name || ""),
    post_status: String(post.post_status || ""),
    post_mime_type: String(post.post_mime_type || ""),
    guid: String(post.guid || ""),
    post_date: String(post.post_date || ""),
    post_date_gmt: String(post.post_date_gmt || ""),
    post_content: String(post.post_content || ""),
    post_excerpt: String(post.post_excerpt || ""),
    post_author: Number(post.post_author || 0),
    meta: metaMap[Number(post.ID)] || {},
  }));
}

async function fetchWPTableStats(client: Client, prefix: string): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  const postsResult = await client.execute(
    `SELECT COUNT(*) as count FROM \`${prefix}posts\` WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%'`
  );
  stats[`${prefix}posts_attachments`] = Number((postsResult.rows as Array<{ count: number }>)[0]?.count || 0);

  const metaResult = await client.execute(
    `SELECT COUNT(*) as count FROM \`${prefix}postmeta\``
  );
  stats[`${prefix}postmeta_total`] = Number((metaResult.rows as Array<{ count: number }>)[0]?.count || 0);

  const termsResult = await client.execute(
    `SELECT COUNT(*) as count FROM \`${prefix}terms\``
  );
  stats[`${prefix}terms`] = Number((termsResult.rows as Array<{ count: number }>)[0]?.count || 0);

  const usersResult = await client.execute(
    `SELECT COUNT(*) as count FROM \`${prefix}users\``
  );
  stats[`${prefix}users`] = Number((usersResult.rows as Array<{ count: number }>)[0]?.count || 0);

  const wkchartsTables = [
    "wkcharts_artists", "wkcharts_tracks", "wkcharts_releases", "wkcharts_labels",
    "wkcharts_genres", "wkcharts_editions", "wkcharts_edition_items",
    "wkcharts_track_artists", "wkcharts_release_tracks",
  ];

  for (const table of wkchartsTables) {
    try {
      const result = await client.execute(
        `SELECT COUNT(*) as count FROM \`${prefix}${table}\``
      );
      stats[`${prefix}${table}`] = Number((result.rows as Array<{ count: number }>)[0]?.count || 0);
    } catch {
      stats[`${prefix}${table}`] = 0;
    }
  }

  return stats;
}

async function migrateOneAttachment(
  supabase: ReturnType<typeof createClient>,
  attachment: WordPressAttachment,
  prefix: string,
): Promise<{
  wpId: number; oldUrl: string; newUrl: string | null; error: string | null;
  title: string; slug: string; metaKeys: string[];
}> {
  const oldUrl = attachment.guid;
  if (!oldUrl) {
    return { wpId: attachment.ID, oldUrl: "", newUrl: null, error: "Missing guid URL",
      title: attachment.post_title, slug: attachment.post_name, metaKeys: Object.keys(attachment.meta) };
  }

  const { data: existing } = await supabase
    .from("registry_media_assets")
    .select("id, url")
    .eq("source_record_id", String(attachment.ID))
    .eq("source_entity", "mysql.attachment")
    .maybeSingle();

  if (existing && existing.url.includes("supabase")) {
    return { wpId: attachment.ID, oldUrl, newUrl: existing.url, error: null,
      title: attachment.post_title, slug: attachment.post_name, metaKeys: Object.keys(attachment.meta) };
  }

  const downloaded = await downloadImage(oldUrl);
  if (!downloaded) {
    return { wpId: attachment.ID, oldUrl, newUrl: null, error: "Download failed",
      title: attachment.post_title, slug: attachment.post_name, metaKeys: Object.keys(attachment.meta) };
  }

  const storagePath = getStoragePath(oldUrl);
  const contentType = attachment.post_mime_type || downloaded.contentType;

  let { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, downloaded.data, { contentType, upsert: true });

  let finalPath = storagePath;
  if (uploadError) {
    finalPath = storagePath.replace(/(\.[^.]+)$/, `-${Date.now()}$1`);
    const { error: altError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(finalPath, downloaded.data, { contentType, upsert: true });
    if (altError) {
      return { wpId: attachment.ID, oldUrl, newUrl: null, error: `Upload: ${altError.message}`,
        title: attachment.post_title, slug: attachment.post_name, metaKeys: Object.keys(attachment.meta) };
    }
  }

  const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(finalPath);
  const newUrl = publicData.publicUrl;

  const { error: upsertError } = await supabase
    .from("registry_media_assets")
    .upsert({
      slug: attachment.post_name || `wp-${attachment.ID}`,
      title: attachment.post_title || null,
      url: newUrl,
      mime_type: contentType,
      media_kind: "image",
      status: "active",
      source_kind: "migrated_from_wp",
      source_entity: "mysql.attachment",
      source_record_id: String(attachment.ID),
      metadata: {
        wp_post: {
          ID: attachment.ID,
          post_title: attachment.post_title,
          post_name: attachment.post_name,
          post_status: attachment.post_status,
          post_mime_type: attachment.post_mime_type,
          post_date: attachment.post_date,
          post_date_gmt: attachment.post_date_gmt,
          post_content: attachment.post_content,
          post_excerpt: attachment.post_excerpt,
          post_author: attachment.post_author,
        },
        wp_postmeta: attachment.meta,
        migration: {
          migrated_at: new Date().toISOString(),
          source_url: oldUrl,
          source_tables: [`${prefix}posts`, `${prefix}postmeta`],
        },
      },
    }, { onConflict: "source_record_id,source_entity" });

  if (upsertError) {
    return { wpId: attachment.ID, oldUrl, newUrl, error: `DB upsert: ${upsertError.message}`,
      title: attachment.post_title, slug: attachment.post_name, metaKeys: Object.keys(attachment.meta) };
  }

  await supabase
    .from("registry_artists")
    .update({ public_image_url: newUrl })
    .eq("public_image_url", oldUrl);

  return { wpId: attachment.ID, oldUrl, newUrl, error: null,
    title: attachment.post_title, slug: attachment.post_name, metaKeys: Object.keys(attachment.meta) };
}

async function migrateStagingAsset(
  supabase: ReturnType<typeof createClient>,
  asset: { id: string; slug: string; url: string; mime_type: string; metadata: unknown },
): Promise<{ id: string; oldUrl: string; newUrl: string | null; error: string | null; title: string; slug: string }> {
  const oldUrl = asset.url;

  if (oldUrl.includes("supabase")) {
    await supabase.from("registry_media_assets")
      .update({ source_kind: "migrated_from_wp" })
      .eq("id", asset.id);
    return { id: asset.id, oldUrl, newUrl: oldUrl, error: null, title: "", slug: asset.slug };
  }

  const downloaded = await downloadImage(oldUrl);
  if (!downloaded) {
    return { id: asset.id, oldUrl, newUrl: null, error: "Download failed", title: "", slug: asset.slug };
  }

  const storagePath = getStoragePath(oldUrl);
  const contentType = asset.mime_type || downloaded.contentType;

  let { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, downloaded.data, { contentType, upsert: true });

  let finalPath = storagePath;
  if (uploadError) {
    finalPath = storagePath.replace(/(\.[^.]+)$/, `-${Date.now()}$1`);
    const { error: altError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(finalPath, downloaded.data, { contentType, upsert: true });
    if (altError) {
      return { id: asset.id, oldUrl, newUrl: null, error: `Upload: ${altError.message}`, title: "", slug: asset.slug };
    }
  }

  const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(finalPath);
  const newUrl = publicData.publicUrl;

  const { error: updateError } = await supabase
    .from("registry_media_assets")
    .update({ url: newUrl, source_kind: "migrated_from_wp" })
    .eq("id", asset.id);

  if (updateError) {
    return { id: asset.id, oldUrl, newUrl, error: `DB update: ${updateError.message}`, title: "", slug: asset.slug };
  }

  await supabase
    .from("registry_artists")
    .update({ public_image_url: newUrl })
    .eq("public_image_url", oldUrl);

  return { id: asset.id, oldUrl, newUrl, error: null, title: "", slug: asset.slug };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase credentials" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action, credentials, offset = 0 } = body;

    const mysqlCredentials: MySQLCredentials = credentials || {
      host: "",
      port: 3306,
      user: "",
      password: "",
      database: "",
      prefix: "wp_",
    };

    // ---- STATS: Direct from WordPress DB ----
    if (action === "wp_stats") {
      if (!mysqlCredentials.host || !mysqlCredentials.user || !mysqlCredentials.password || !mysqlCredentials.database) {
        return new Response(JSON.stringify({ error: "MySQL credentials required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let client: Client;
      try {
        client = await connectToMySQL(mysqlCredentials);
      } catch (connectErr) {
        return new Response(JSON.stringify({
          error: "MySQL connection failed",
          detail: connectErr instanceof Error ? connectErr.message : "Unknown error",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const stats = await fetchWPTableStats(client, mysqlCredentials.prefix || "wp_");
      await client.close();

      return new Response(JSON.stringify({
        success: true,
        tables: stats,
        source: "mysql_direct",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- STATS: From Supabase staging ----
    if (action === "stats") {
      const { count: wpTotal } = await supabase
        .from("registry_media_assets")
        .select("*", { count: "exact", head: true })
        .eq("media_kind", "image")
        .eq("source_kind", "wordpress_database");

      const { count: alreadyMigrated } = await supabase
        .from("registry_media_assets")
        .select("*", { count: "exact", head: true })
        .eq("media_kind", "image")
        .eq("source_kind", "migrated_from_wp");

      const { count: artistImages } = await supabase
        .from("registry_artists")
        .select("*", { count: "exact", head: true })
        .not("public_image_url", "is", null)
        .like("public_image_url", `%${OLD_DOMAIN}%`);

      return new Response(JSON.stringify({
        wpTotal: wpTotal ?? 0,
        alreadyMigrated: alreadyMigrated ?? 0,
        remaining: (wpTotal ?? 0) - (alreadyMigrated ?? 0),
        artistImagesOnOldDomain: artistImages ?? 0,
        sourceTables: [
          "wp_posts (attachment records)",
          "wp_postmeta (attachment metadata)",
          "wp_terms (taxonomy terms)",
          "wp_term_taxonomy (taxonomy types)",
          "wp_term_relationships (taxonomy links)",
          "wp_users (authors)",
        ],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- LIST ATTACHMENTS: Browse from WordPress DB ----
    if (action === "list_attachments") {
      if (!mysqlCredentials.host || !mysqlCredentials.user || !mysqlCredentials.password || !mysqlCredentials.database) {
        return new Response(JSON.stringify({ error: "MySQL credentials required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let client: Client;
      try {
        client = await connectToMySQL(mysqlCredentials);
      } catch (connectErr) {
        return new Response(JSON.stringify({
          error: "MySQL connection failed",
          detail: connectErr instanceof Error ? connectErr.message : "Unknown error",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const prefix = mysqlCredentials.prefix || "wp_";
      const postsTable = `${prefix}posts`;
      const search = body.search || "";
      const listOffset = body.list_offset || 0;
      const listLimit = body.list_limit || 50;

      let whereClause = `post_type = 'attachment' AND post_mime_type LIKE 'image/%'`;
      if (search) {
        const escaped = search.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
        whereClause += ` AND (post_title LIKE '%${escaped}%' OR post_name LIKE '%${escaped}%' OR guid LIKE '%${escaped}%')`;
      }

      const [countResult, rowsResult] = await Promise.all([
        client.execute(`SELECT COUNT(*) as total FROM \`${postsTable}\` WHERE ${whereClause}`),
        client.execute(
          `SELECT ID, post_title, post_name, post_mime_type, guid, post_date, post_status
           FROM \`${postsTable}\`
           WHERE ${whereClause}
           ORDER BY ID ASC
           LIMIT ${listLimit} OFFSET ${listOffset}`
        ),
      ]);

      const total = Number((countResult.rows as Array<{ total: number }>)[0]?.total || 0);
      const attachments = (rowsResult.rows as Array<Record<string, unknown>>).map((row) => ({
        id: Number(row.ID),
        post_title: String(row.post_title || ""),
        post_name: String(row.post_name || ""),
        post_mime_type: String(row.post_mime_type || ""),
        guid: String(row.guid || ""),
        post_date: String(row.post_date || ""),
        post_status: String(row.post_status || ""),
      }));

      await client.close();

      return new Response(JSON.stringify({
        total,
        offset: listOffset,
        limit: listLimit,
        attachments,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- LIST FROM STAGING: Browse Supabase-staged images ----
    if (action === "list_staging") {
      const search = body.search || "";
      const listOffset = body.list_offset || 0;
      const listLimit = body.list_limit || 50;

      let query = supabase
        .from("registry_media_assets")
        .select("id, slug, title, url, mime_type, metadata, source_record_id, created_at", { count: "exact" })
        .eq("media_kind", "image")
        .eq("source_kind", "wordpress_database")
        .order("id", { ascending: true })
        .range(listOffset, listOffset + listLimit - 1);

      if (search) {
        query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%,url.ilike.%${search}%`);
      }

      const { data: assets, count, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const attachments = (assets || []).map((a) => ({
        id: a.id,
        post_title: a.title || "",
        post_name: a.slug || "",
        post_mime_type: a.mime_type || "",
        guid: a.url || "",
        post_date: a.created_at || "",
        post_status: "staged",
        source_record_id: a.source_record_id,
      }));

      return new Response(JSON.stringify({
        total: count ?? 0,
        offset: listOffset,
        limit: listLimit,
        attachments,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- MIGRATE SELECTED: From WordPress DB ----
    if (action === "migrate_selected") {
      const selectedIds: number[] = body.selected_ids || [];
      if (selectedIds.length === 0) {
        return new Response(JSON.stringify({
          error: "No attachment IDs provided",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!mysqlCredentials.host || !mysqlCredentials.user || !mysqlCredentials.password || !mysqlCredentials.database) {
        return new Response(JSON.stringify({ error: "MySQL credentials required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let client: Client;
      try {
        client = await connectToMySQL(mysqlCredentials);
      } catch (connectErr) {
        return new Response(JSON.stringify({
          error: "MySQL connection failed",
          detail: connectErr instanceof Error ? connectErr.message : "Unknown error",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const prefix = mysqlCredentials.prefix || "wp_";
      const postsTable = `${prefix}posts`;
      const postmetaTable = `${prefix}postmeta`;
      const selectedList = selectedIds.join(",");

      const postsResult = await client.execute(
        `SELECT ID, post_title, post_name, post_status, post_mime_type, guid, post_date, post_date_gmt, post_content, post_excerpt, post_author
         FROM \`${postsTable}\`
         WHERE ID IN (${selectedList})
         ORDER BY ID ASC`
      );

      const posts = postsResult.rows as Array<Record<string, unknown>>;
      if (!posts.length) {
        await client.close();
        return new Response(JSON.stringify({
          done: true, processed: 0, succeeded: 0, failed: 0, results: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const metaResult = await client.execute(
        `SELECT post_id, meta_key, meta_value
         FROM \`${postmetaTable}\`
         WHERE post_id IN (${selectedList})`
      );

      const metaRows = metaResult.rows as Array<{ post_id: number; meta_key: string; meta_value: string }>;
      const metaMap: Record<number, Record<string, string>> = {};
      for (const row of metaRows) {
        if (!metaMap[row.post_id]) metaMap[row.post_id] = {};
        metaMap[row.post_id][row.meta_key] = row.meta_value;
      }

      const attachments: WordPressAttachment[] = posts.map((post) => ({
        ID: Number(post.ID),
        post_title: String(post.post_title || ""),
        post_name: String(post.post_name || ""),
        post_status: String(post.post_status || ""),
        post_mime_type: String(post.post_mime_type || ""),
        guid: String(post.guid || ""),
        post_date: String(post.post_date || ""),
        post_date_gmt: String(post.post_date_gmt || ""),
        post_content: String(post.post_content || ""),
        post_excerpt: String(post.post_excerpt || ""),
        post_author: Number(post.post_author || 0),
        meta: metaMap[Number(post.ID)] || {},
      }));

      await client.close();

      const results: Array<{
        wpId: number; oldUrl: string; newUrl: string | null; error: string | null;
        title: string; slug: string; metaKeys: string[];
      }> = [];

      for (const attachment of attachments) {
        const result = await migrateOneAttachment(supabase, attachment, prefix);
        results.push(result);
      }

      const succeeded = results.filter((r) => r.newUrl && !r.error).length;
      const failed = results.filter((r) => r.error).length;

      return new Response(JSON.stringify({
        done: true,
        processed: results.length,
        succeeded,
        failed,
        results,
        sourceTables: [`${prefix}posts`, `${prefix}postmeta`],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- MIGRATE SELECTED: From Supabase Staging ----
    if (action === "migrate_selected_staging") {
      const selectedIds: string[] = body.selected_ids || [];
      if (selectedIds.length === 0) {
        return new Response(JSON.stringify({
          error: "No asset IDs provided",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: assets, error } = await supabase
        .from("registry_media_assets")
        .select("id, slug, url, mime_type, metadata")
        .in("id", selectedIds);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!assets || assets.length === 0) {
        return new Response(JSON.stringify({
          done: true, processed: 0, succeeded: 0, failed: 0, results: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const results: Array<{
        id: string; oldUrl: string; newUrl: string | null; error: string | null; title: string; slug: string;
      }> = [];

      for (const asset of assets) {
        const result = await migrateStagingAsset(supabase, asset as {
          id: string; slug: string; url: string; mime_type: string; metadata: unknown;
        });
        results.push(result);
      }

      const succeeded = results.filter((r) => r.newUrl && !r.error).length;
      const failed = results.filter((r) => r.error).length;

      return new Response(JSON.stringify({
        done: true,
        processed: results.length,
        succeeded,
        failed,
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- MIGRATE FROM WORDPRESS DB (bulk, sequential) ----
    if (action === "migrate_from_wp") {
      if (!mysqlCredentials.host || !mysqlCredentials.user || !mysqlCredentials.password || !mysqlCredentials.database) {
        return new Response(JSON.stringify({ error: "MySQL credentials required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let client: Client;
      try {
        client = await connectToMySQL(mysqlCredentials);
      } catch (connectErr) {
        return new Response(JSON.stringify({
          error: "MySQL connection failed",
          detail: connectErr instanceof Error ? connectErr.message : "Unknown error",
          hint: "Ensure the WordPress database host is reachable from Supabase. If the host is a private IP (e.g., 172.26.x.x), use a bastion host or run this from the WordPress server.",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const prefix = mysqlCredentials.prefix || "wp_";
      const attachments = await fetchAttachmentsFromWP(client, prefix, offset, BATCH_SIZE);
      await client.close();

      if (attachments.length === 0) {
        return new Response(JSON.stringify({
          done: true, processed: 0, succeeded: 0, failed: 0, results: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const results: Array<{
        wpId: number; oldUrl: string; newUrl: string | null; error: string | null;
        title: string; slug: string; metaKeys: string[];
      }> = [];

      for (const attachment of attachments) {
        const result = await migrateOneAttachment(supabase, attachment, prefix);
        results.push(result);
      }

      const succeeded = results.filter((r) => r.newUrl && !r.error).length;
      const failed = results.filter((r) => r.error).length;

      return new Response(JSON.stringify({
        done: attachments.length < BATCH_SIZE,
        offset,
        processed: results.length,
        succeeded,
        failed,
        results,
        sourceTables: [`${prefix}posts`, `${prefix}postmeta`],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- MIGRATE FROM SUPABASE STAGING (bulk, sequential) ----
    if (action === "migrate_batch") {
      const { data: assets, error } = await supabase
        .from("registry_media_assets")
        .select("id, slug, url, mime_type, metadata")
        .eq("media_kind", "image")
        .eq("source_kind", "wordpress_database")
        .order("id", { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!assets || assets.length === 0) {
        return new Response(JSON.stringify({
          done: true, processed: 0, succeeded: 0, failed: 0, results: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const results: Array<{
        id: string; oldUrl: string; newUrl: string | null; error: string | null; title: string; slug: string;
      }> = [];

      for (const asset of assets) {
        const result = await migrateStagingAsset(supabase, asset as {
          id: string; slug: string; url: string; mime_type: string; metadata: unknown;
        });
        results.push(result);
      }

      const succeeded = results.filter((r) => r.newUrl && !r.error).length;
      const failed = results.filter((r) => r.error).length;

      return new Response(JSON.stringify({
        done: assets.length < BATCH_SIZE,
        offset,
        processed: results.length,
        succeeded,
        failed,
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_BASE_URL = (Deno.env.get("SITE_BASE_URL") || "https://wakilisha.africa").replace(/\/+$/, "");
const PRO_API_URL = Deno.env.get("PRO_SITEMAPS_API_URL") || "";
const PRO_API_KEY = Deno.env.get("PRO_SITEMAPS_API_KEY") || "";
const PRO_SITE_ID = Deno.env.get("PRO_SITEMAPS_SITE_ID") || "";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".wakilisha.africa")
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function xml(data: string, headers: Record<string, string>, status = 200) {
  return new Response(data, {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function hasCapability(db: ReturnType<typeof createClient>, userId: string, capability: string) {
  const { data: roles } = await db
    .from("user_role_assignments")
    .select("role_key,role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", userId)
    .eq("status", "active")
    .or("expires_at.is.null,expires_at.gt.now()");

  if (!roles?.length) return false;
  if (roles.some((role: any) => role.role_key === "administrator")) return true;

  const caps = new Set<string>();
  for (const role of roles as any[]) {
    for (const cap of role.role_definitions?.role_capabilities ?? []) {
      caps.add(String(cap.capability_key));
    }
  }
  return caps.has(capability);
}

function normalizePath(path: string) {
  const clean = String(path || "").trim();
  if (!clean) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeUrl(path: string) {
  return `${SITE_BASE_URL}${normalizePath(path)}`;
}

function dateOnly(value: unknown) {
  if (!value) return undefined;
  const raw = String(value);
  return raw.includes("T") ? raw : new Date(raw).toISOString();
}

type SitemapItem = {
  loc: string;
  lastmod?: string;
  url_type: string;
  source_table?: string;
  source_id?: string;
};

function uniqByLoc(items: SitemapItem[]) {
  const seen = new Set<string>();
  const out: SitemapItem[] = [];

  for (const item of items) {
    if (!item.loc.startsWith("https://")) continue;
    if (item.loc.includes("/admin")) continue;
    if (item.loc.includes("/preview/")) continue;
    if (item.loc.includes("/auth")) continue;
    if (item.loc.includes("/settings")) continue;
    if (seen.has(item.loc)) continue;
    seen.add(item.loc);
    out.push(item);
  }

  return out.sort((a, b) => a.loc.localeCompare(b.loc));
}

function buildXml(items: SitemapItem[]) {
  const rows = items.map((item) => {
    const lastmod = item.lastmod ? `\n    <lastmod>${escapeXml(item.lastmod)}</lastmod>` : "";
    return `  <url>\n    <loc>${escapeXml(item.loc)}</loc>${lastmod}\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildInternalItems(db: ReturnType<typeof createClient>): Promise<SitemapItem[]> {
  const items: SitemapItem[] = [
    { loc: makeUrl("/"), url_type: "static" },
    { loc: makeUrl("/charts"), url_type: "static" },
    { loc: makeUrl("/artists"), url_type: "static" },
    { loc: makeUrl("/releases"), url_type: "static" },
    { loc: makeUrl("/genres"), url_type: "static" },
    { loc: makeUrl("/labels"), url_type: "static" },
    { loc: makeUrl("/guides"), url_type: "static" },
    { loc: makeUrl("/categories"), url_type: "static" },
    { loc: makeUrl("/tags"), url_type: "static" },
    { loc: makeUrl("/authors"), url_type: "static" },
    { loc: makeUrl("/about"), url_type: "static" },
    { loc: makeUrl("/contact"), url_type: "static" },
    { loc: makeUrl("/faqs"), url_type: "static" },
    { loc: makeUrl("/privacy"), url_type: "static" },
    { loc: makeUrl("/terms"), url_type: "static" },
  ];

  const [
    articles,
    artists,
    releases,
    tracks,
    genres,
    labels,
    guides,
    authors,
    chartPrograms,
  ] = await Promise.all([
    db.from("wk_articles").select("id, slug, modified_at, published_at").eq("wp_status", "publish").limit(5000),
    db.from("registry_artists").select("id, slug, updated_at").eq("status", "active").limit(5000),
    db.from("registry_releases").select("id, slug, updated_at, metadata").in("status", ["active", "draft"]).limit(5000),
    db.from("registry_tracks").select("id, slug, updated_at, metadata").eq("status", "active").limit(5000),
    db.from("registry_genres").select("id, slug, updated_at").limit(1000),
    db.from("registry_labels").select("id, slug, updated_at").limit(1000),
    db.from("wk_guides").select("id, slug, updated_at, status").eq("status", "published").limit(2000),
    db.from("registry_authors").select("id, slug, updated_at").limit(2000),
    db.from("wk_chart_programs_v2").select("id, public_slug, market_slug, updated_at").limit(500),
  ]);

  for (const row of articles.data ?? []) {
    items.push({
      loc: makeUrl(`/magazine/${row.slug}`),
      lastmod: dateOnly(row.modified_at || row.published_at),
      url_type: "article",
      source_table: "wk_articles",
      source_id: String(row.id),
    });
  }

  for (const row of artists.data ?? []) {
    items.push({
      loc: makeUrl(`/artists/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "artist",
      source_table: "registry_artists",
      source_id: String(row.id),
    });
  }

  for (const row of releases.data ?? []) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const artistSlug = String(meta.primary_artist_slug || meta.artist_slug || "").trim();
    if (!artistSlug) continue;
    items.push({
      loc: makeUrl(`/releases/${artistSlug}/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "release",
      source_table: "registry_releases",
      source_id: String(row.id),
    });
  }

  for (const row of tracks.data ?? []) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const artistSlug = String(meta.primary_artist_slug || meta.artist_slug || "").trim();
    const path = artistSlug ? `/tracks/${artistSlug}/${row.slug}` : `/tracks/${row.slug}`;
    items.push({
      loc: makeUrl(path),
      lastmod: dateOnly(row.updated_at),
      url_type: "track",
      source_table: "registry_tracks",
      source_id: String(row.id),
    });
  }

  for (const row of genres.data ?? []) {
    items.push({
      loc: makeUrl(`/genres/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "genre",
      source_table: "registry_genres",
      source_id: String(row.id),
    });
  }

  for (const row of labels.data ?? []) {
    items.push({
      loc: makeUrl(`/labels/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "label",
      source_table: "registry_labels",
      source_id: String(row.id),
    });
  }

  for (const row of guides.data ?? []) {
    items.push({
      loc: makeUrl(`/guides/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "guide",
      source_table: "wk_guides",
      source_id: String(row.id),
    });
  }

  for (const row of authors.data ?? []) {
    items.push({
      loc: makeUrl(`/authors/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "author",
      source_table: "registry_authors",
      source_id: String(row.id),
    });
  }

  for (const program of chartPrograms.data ?? []) {
    const programSlug = String(program.public_slug || "").trim();
    const marketSlug = String(program.market_slug || "").trim();
    if (!programSlug) continue;

    items.push({
      loc: makeUrl(marketSlug ? `/charts/${programSlug}/${marketSlug}/latest` : `/charts/${programSlug}/latest`),
      lastmod: dateOnly(program.updated_at),
      url_type: "chart",
      source_table: "wk_chart_programs_v2",
      source_id: String(program.id),
    });
  }

  return uniqByLoc(items);
}

async function triggerProSitemaps(method: string) {
  if (!PRO_API_URL || !PRO_API_KEY || !PRO_SITE_ID) {
    return { configured: false, message: "Pro-Sitemaps secrets are not fully configured." };
  }

  const body = new URLSearchParams();
  body.set("method", method);
  body.set("api_key", PRO_API_KEY);
  body.set("site_id", PRO_SITE_ID);

  const response = await fetch(PRO_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await response.text();

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep raw text
  }

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    method,
    result: parsed,
  };
}

async function latestSnapshot(db: ReturnType<typeof createClient>) {
  const { data, error } = await db
    .from("seo_sitemap_snapshots")
    .select("*")
    .in("status", ["published", "generated"])
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  const headers = cors(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  if (req.method === "GET" && action === "xml") {
    const snapshot = await latestSnapshot(db);
    if (!snapshot?.xml_content) {
      const items = await buildInternalItems(db);
      return xml(buildXml(items), headers);
    }
    return xml(String(snapshot.xml_content), headers);
  }

  const user = await getUser(req);
  if (!user) return json({ ok: false, error: "Unauthorized" }, headers, 401);

  const allowed = await hasCapability(db, user.id, "manage_settings");
  if (!allowed) return json({ ok: false, error: "Insufficient privilege" }, headers, 403);

  if (req.method === "GET") {
    const snapshot = await latestSnapshot(db);
    return json({ ok: true, data: { snapshot } }, headers);
  }

  const body = await req.json().catch(() => ({}));
  const requestedAction = String(body.action || "generate");

  if (requestedAction === "pro_update") {
    const result = await triggerProSitemaps("update_sitemap");
    return json({ ok: true, data: result }, headers);
  }

  const items = await buildInternalItems(db);
  const xmlContent = buildXml(items);
  const hash = await sha256(xmlContent);
  const proResult = requestedAction === "generate_and_pro_update"
    ? await triggerProSitemaps("update_sitemap")
    : {};

  const { data: snapshot, error } = await db
    .from("seo_sitemap_snapshots")
    .insert({
      status: "generated",
      source: requestedAction === "generate_and_pro_update" ? "mixed" : "internal",
      base_url: SITE_BASE_URL,
      url_count: items.length,
      xml_content: xmlContent,
      xml_sha256: hash,
      pro_sitemaps_site_id: PRO_SITE_ID || null,
      pro_sitemaps_result_json: proResult,
      generated_by: user.id,
    })
    .select("*")
    .single();

  if (error) return json({ ok: false, error: error.message }, headers, 500);

  const rows = items.map((item) => ({
    snapshot_id: snapshot.id,
    loc: item.loc,
    lastmod: item.lastmod ?? null,
    url_type: item.url_type,
    source_table: item.source_table ?? null,
    source_id: item.source_id ?? null,
    included: true,
  }));

  if (rows.length > 0) {
    await db.from("seo_sitemap_url_items").insert(rows);
  }

  return json({
    ok: true,
    data: {
      snapshot,
      urlCount: items.length,
      proResult,
    },
  }, headers);
});

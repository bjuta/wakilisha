import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE = "https://wakilisha.africa";
const MAGAZINE_PATH = /^\/magazine\/([a-z0-9]+(?:[-_][a-z0-9]+)*)$/;
const SHELL_TIMEOUT_MS = 4000;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeHttps(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

function publicError(status: number, message: string): Response {
  return new Response(message, {
    status, headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

function publishedSeoHtml(row: Record<string, unknown>, baseHtml: string): string {
  const slug = String(row.slug || "");
  if (!MAGAZINE_PATH.test("/magazine/" + slug)) throw Error("Invalid published route");
  const canonical = SITE + "/magazine/" + slug;
  const seo = row.seo && typeof row.seo === "object" && !Array.isArray(row.seo)
    ? row.seo as Record<string, unknown> : {};
  const headline = String(row.title || "").trim();
  if (!headline || !baseHtml.includes("</head>") || !baseHtml.includes("</body>")) {
    throw Error("Article identity or frontend shell invalid");
  }
  const seoTitle = String(seo.title || headline).trim();
  const title = seoTitle.endsWith(" | WAKILISHA") ? seoTitle : seoTitle + " | WAKILISHA";
  const summary = String(seo.description || row.excerpt || "").trim();
  const image = safeHttps(row.hero_image_url);
  if (row.hero_image_url && !image) throw Error("Invalid published hero image URL");
  const author = String(row.author || "WAKILISHA Editorial").trim();
  const published = String(row.published_at || "");
  const modified = String(row.modified_at || published);
  if (!Number.isFinite(Date.parse(published)) || !Number.isFinite(Date.parse(modified))) {
    throw Error("Invalid published dates");
  }

  // Remove homepage SEO from the *existing app shell*; do not disturb Vite
  // assets, React mounting, browser routing, styling, or app state.
  let html = baseHtml
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b[^>]*(?:name\s*=\s*["'](?:description|robots|twitter:[^"']+)["']|property\s*=\s*["']og:[^"']+["'])[^>]*>/gi, "")
    .replace(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, "")
    .replace(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*data-wakilisha-lcp-preload\b[^>]*>/gi, "");

  const tags = [
    "<title>" + escapeHtml(title) + "</title>",
    '<meta name="description" content="' + escapeHtml(summary) + '">',
    '<meta name="robots" content="index, follow">',
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">',
    '<meta property="og:site_name" content="WAKILISHA">',
    '<meta property="og:type" content="article">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(summary) + '">',
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(summary) + '">',
  ];
  if (image) {
    tags.push(
      '<meta property="og:image" content="' + escapeHtml(image) + '">',
      '<meta property="og:image:secure_url" content="' + escapeHtml(image) + '">',
      '<meta property="og:image:alt" content="' + escapeHtml(headline) + '">',
      '<meta name="twitter:image" content="' + escapeHtml(image) + '">',
      '<meta name="twitter:image:alt" content="' + escapeHtml(headline) + '">',
    );
  }
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": canonical + "#article",
    url: canonical,
    mainEntityOfPage: canonical,
    headline,
    description: summary,
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: "WAKILISHA", url: SITE },
    datePublished: published,
    dateModified: modified,
  };
  if (image) jsonLd.image = [image];
  tags.push('<script id="wk-jsonld-primary" type="application/ld+json">' +
    JSON.stringify(jsonLd).replace(/</g, "\\u003c") + "</script>");

  html = html.replace("</head>", tags.join("\n") + "\n</head>");
  return html;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return publicError(405, "Method not allowed");
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/functions\/v1\/seo-article-html/, "").replace(/\/$/, "");
  const match = MAGAZINE_PATH.exec(path);
  if (!match) return publicError(404, "Not found");
  if (!SUPABASE_URL || !SERVICE_KEY) return publicError(503, "Temporarily unavailable");

  // Exactly one published snapshot lookup. No bulk SEO manifest generation,
  // artist/release/track queries, mutation RPC, or publication scheduling.
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.from("wk_article_publication_snapshots")
    .select("id, slug, title, excerpt, author, seo, hero_image_url, published_at, modified_at, is_active, wp_status")
    .eq("slug", match[1]).eq("is_active", true).eq("wp_status", "publish")
    .limit(2);
  if (error) {
    console.error("Public Article SEO source read unavailable", error.code || "unknown");
    return publicError(503, "Temporarily unavailable");
  }
  if (!data?.length) return publicError(404, "Article not published");
  if (data.length !== 1) {
    console.error("Public Article SEO snapshot identity conflict");
    return publicError(503, "Temporarily unavailable");
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SHELL_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(SITE + "/", {
        method: "GET",
        headers: { Accept: "text/html", "User-Agent": "WAKILISHA-SEO-Article-Renderer/1" },
        signal: controller.signal,
      });
    } finally { clearTimeout(timer); }
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) {
      throw Error("Canonical frontend shell unavailable");
    }
    const shell = await response.text();
    if (shell.length < 500 || shell.length > 2_000_000) throw Error("Frontend shell size invalid");
    const html = publishedSeoHtml(data[0], shell);
    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Wakilisha-SEO-Source": "published-snapshot",
        "X-Wakilisha-SEO-Renderer": "isolated-article-v1",
      },
    });
  } catch (error) {
    console.error("Public Article SEO shell failure", String(error));
    return publicError(503, "Temporarily unavailable");
  }
});

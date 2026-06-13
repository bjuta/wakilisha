
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;
const DELAY_MS = 150;
const BUCKET = "article-media";

function sanitizeFilename(name: string): string {
  return name
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function getStoragePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = safeDecodeURIComponent(urlObj.pathname);
    const cleanPath = pathname.replace("/wp-content/uploads/", "");
    const parts = cleanPath.split("/");
    if (parts.length >= 3) {
      const filename = parts.pop() || "";
      const sanitized = sanitizeFilename(filename);
      return `wp-import/${parts.join("/")}/${sanitized}`;
    }
    const filename = parts.pop() || cleanPath;
    return `wp-import/misc/${sanitizeFilename(filename)}`;
  } catch {
    return `wp-import/misc/${url.split("/").pop() || "unknown"}`;
  }
}

function getContentTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  };
  return map[ext] || "image/jpeg";
}

async function downloadImage(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WakilishaBot/1.0)" },
      redirect: "follow",
    });
    if (!response.ok) {
      console.error(`[download] HTTP ${response.status} for ${url}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      console.error(`[download] Empty body for ${url}`);
      return null;
    }
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.error(`[download] Exception for ${url}:`, err);
    return null;
  }
}

async function uploadToStorage(
  supabaseClient: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  data: Uint8Array,
  contentType: string,
): Promise<string | null> {
  let storageBucket;
  try {
    storageBucket = supabaseClient.storage.from(bucket);
  } catch (err) {
    console.error(`[upload] Failed to access bucket "${bucket}":`, err);
    return null;
  }

  if (!storageBucket) {
    console.error(`[upload] storage.from("${bucket}") returned undefined/null`);
    return null;
  }

  // Upload
  let uploadResult;
  try {
    uploadResult = await storageBucket.upload(path, data, {
      contentType,
      upsert: true,
    });
  } catch (err) {
    console.error(`[upload] Upload threw for ${path}:`, err);
    return null;
  }

  if (!uploadResult) {
    console.error(`[upload] Upload returned undefined for ${path}`);
    return null;
  }

  const uploadError = (uploadResult as any).error;
  if (uploadError) {
    console.error(`[upload] Upload error for ${path}: ${uploadError.message || String(uploadError)}`);
    return null;
  }

  // Get public URL
  let urlResult;
  try {
    urlResult = storageBucket.getPublicUrl(path);
  } catch (err) {
    console.error(`[upload] getPublicUrl threw for ${path}:`, err);
    return null;
  }

  if (!urlResult) {
    console.error(`[upload] getPublicUrl returned undefined for ${path}`);
    return null;
  }

  const urlData = (urlResult as any).data;
  if (!urlData) {
    console.error(`[upload] getPublicUrl had no data for ${path}`);
    return null;
  }

  const publicUrl = urlData.publicUrl;
  if (!publicUrl || typeof publicUrl !== "string") {
    console.error(`[upload] getPublicUrl returned no publicUrl for ${path}`);
    return null;
  }

  return publicUrl;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error("[init] createClient threw:", err);
    return new Response(JSON.stringify({ error: "Failed to create Supabase client." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[fetch] Querying wk_articles for WP hero images...");

    let queryResult;
    try {
      queryResult = await supabase
        .from("wk_articles")
        .select("id, slug, title, hero_image_url")
        .not("hero_image_url", "is", null)
        .neq("hero_image_url", "")
        .like("hero_image_url", "%wakilisha.africa/wp-content/uploads/%");
    } catch (err) {
      console.error("[fetch] Query threw:", err);
      return new Response(JSON.stringify({ error: "Database query failed." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!queryResult) {
      console.error("[fetch] Query returned undefined");
      return new Response(JSON.stringify({ error: "Query returned no result." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fetchErr = (queryResult as any).error;
    if (fetchErr) {
      console.error("[fetch] Query error:", fetchErr.message || String(fetchErr));
      return new Response(JSON.stringify({ error: fetchErr.message || String(fetchErr) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const articles = (queryResult as any).data;
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      console.log("[fetch] No articles with WP hero images found");
      return new Response(JSON.stringify({
        message: "No WP hero images to migrate.",
        summary: { total: 0, migrated: 0, failed: 0 }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[fetch] Found ${articles.length} articles`);

    const urlMap = new Map<string, { storagePath: string; contentType: string }>();
    for (const a of articles) {
      const url = a && typeof a === "object" ? (a as any).hero_image_url : null;
      if (!url || typeof url !== "string" || urlMap.has(url)) continue;
      const storagePath = getStoragePathFromUrl(url);
      const contentType = getContentTypeFromPath(storagePath);
      urlMap.set(url, { storagePath, contentType });
    }

    const uniqueUrls = Array.from(urlMap.entries());
    console.log(`[dedup] ${uniqueUrls.length} unique URLs`);

    const results: Array<{ url: string; status: string; storagePath: string }> = [];
    let migrated = 0;
    let failed = 0;

    for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
      const batch = uniqueUrls.slice(i, i + BATCH_SIZE);

      for (const [url, { storagePath, contentType }] of batch) {
        let resultEntry: { url: string; status: string; storagePath: string };

        const imageData = await downloadImage(url);
        if (!imageData) {
          resultEntry = { url, status: "download_failed", storagePath };
          results.push(resultEntry);
          failed++;
          continue;
        }

        const newUrl = await uploadToStorage(supabase, BUCKET, storagePath, imageData, contentType);
        if (!newUrl) {
          resultEntry = { url, status: "upload_failed", storagePath };
          results.push(resultEntry);
          failed++;
          continue;
        }

        resultEntry = { url, status: "migrated", storagePath };
        results.push(resultEntry);
        migrated++;
      }

      if (i + BATCH_SIZE < uniqueUrls.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log(`[done] migrated=${migrated} failed=${failed}`);

    return new Response(JSON.stringify({
      summary: { total: uniqueUrls.length, migrated, failed },
      articleCount: articles.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[fatal]", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

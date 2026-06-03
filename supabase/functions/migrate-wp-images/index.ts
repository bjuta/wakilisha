import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface MigrateRequest {
  urls: string[];
  dryRun?: boolean;
}

interface MigrateResult {
  oldUrl: string;
  newUrl: string | null;
  error: string | null;
  path: string | null;
}

function getStoragePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Remove /wp-content/uploads/ prefix
    const cleanPath = pathname.replace("/wp-content/uploads/", "");
    // Ensure it starts with year/month
    const parts = cleanPath.split("/");
    if (parts.length >= 3) {
      // Keep year/month/filename structure
      return `wp-import/${cleanPath}`;
    }
    return `wp-import/misc/${cleanPath}`;
  } catch {
    return `wp-import/misc/${url.split("/").pop() || "unknown"}`;
  }
}

function getContentTypeFromExtension(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext] || "image/jpeg";
}

async function downloadImage(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WakilishaBot/1.0)",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      console.error(`Failed to download ${url}: ${response.status}`);
      return null;
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      console.error(`Empty image from ${url}`);
      return null;
    }
    return new Uint8Array(await blob.arrayBuffer());
  } catch (err) {
    console.error(`Error downloading ${url}:`, err);
    return null;
  }
}

async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  data: Uint8Array,
  contentType: string
): Promise<string | null> {
  try {
    const { data: uploadData, error } = await supabase.storage
      .from(bucket)
      .upload(path, data, {
        contentType,
        upsert: true,
      });
    if (error) {
      console.error(`Upload error for ${path}:`, error.message);
      return null;
    }
    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  } catch (err) {
    console.error(`Error uploading ${path}:`, err);
    return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as MigrateRequest;
    const urls = body.urls || [];
    const dryRun = body.dryRun || false;

    if (!urls.length) {
      return new Response(
        JSON.stringify({ error: "No URLs provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: MigrateResult[] = [];

    for (const url of urls) {
      const path = getStoragePathFromUrl(url);
      const contentType = getContentTypeFromExtension(path);

      if (dryRun) {
        results.push({
          oldUrl: url,
          newUrl: `dry-run/${path}`,
          error: null,
          path,
        });
        continue;
      }

      // Download image
      const imageData = await downloadImage(url);
      if (!imageData) {
        results.push({
          oldUrl: url,
          newUrl: null,
          error: "Failed to download image",
          path,
        });
        continue;
      }

      // Upload to storage
      const newUrl = await uploadToStorage(
        supabase,
        "article-media",
        path,
        imageData,
        contentType
      );

      if (!newUrl) {
        results.push({
          oldUrl: url,
          newUrl: null,
          error: "Failed to upload image",
          path,
        });
        continue;
      }

      results.push({
        oldUrl: url,
        newUrl,
        error: null,
        path,
      });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        succeeded: results.filter((r) => r.newUrl).length,
        failed: results.filter((r) => r.error).length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
});

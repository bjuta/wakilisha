import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT}ms`);
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Parse body safely
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (parseErr) {
    return new Response(
      JSON.stringify({
        error: "Invalid JSON body",
        detail: parseErr instanceof Error ? parseErr.message : "Could not parse request body",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { action, siteUrl, path } = body;

  if (!siteUrl || typeof siteUrl !== "string") {
    return new Response(
      JSON.stringify({
        error: "siteUrl is required",
        received: typeof siteUrl,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const baseUrl = siteUrl.replace(/\/+$/, "");

  if (action === "ping") {
    const urls = [
      `${baseUrl}/wp-json/`,
      `${baseUrl}/wp-json/wp/v2/types`,
    ];

    const results: Record<string, { accessible: boolean; status?: number; error?: string; latency?: number }> = {};
    let allAccessible = true;

    for (const url of urls) {
      const start = Date.now();
      try {
        const res = await fetchWithTimeout(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Wakilisha-WP-Connect/1.0",
          },
          redirect: "follow",
        });
        const latency = Date.now() - start;
        const ok = res.ok;
        results[url] = { accessible: ok, status: res.status, latency };
        if (!ok) {
          results[url].error = `HTTP ${res.status}`;
          allAccessible = false;
        }
      } catch (e) {
        const latency = Date.now() - start;
        results[url] = {
          accessible: false,
          error: e instanceof Error ? e.message : "Connection failed",
          latency,
        };
        allAccessible = false;
      }
    }

    return new Response(
      JSON.stringify({
        accessible: allAccessible,
        siteUrl: baseUrl,
        results,
        message: allAccessible
          ? "WordPress REST API is accessible."
          : "WordPress REST API is not fully accessible. Check the site URL and ensure the REST API is enabled.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "discover") {
    const discovery: Record<string, unknown> = {
      siteUrl: baseUrl,
      discoveredAt: new Date().toISOString(),
      postTypes: {},
      taxonomies: {},
      counts: {},
      samples: {},
      siteInfo: null,
    };

    // Get site info
    try {
      const siteRes = await fetchWithTimeout(`${baseUrl}/wp-json/`, {
        headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
        redirect: "follow",
      });
      if (siteRes.ok) {
        discovery.siteInfo = await siteRes.json();
      } else {
        discovery.siteInfo = { error: `HTTP ${siteRes.status}`, note: "REST API root may be blocked or disabled." };
      }
    } catch (e) {
      discovery.siteInfo = { error: e instanceof Error ? e.message : "Connection failed", note: "Could not reach REST API root." };
    }

    // Get post types
    try {
      const typesRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/types`, {
        headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
        redirect: "follow",
      });
      if (typesRes.ok) {
        const types = await typesRes.json();
        const typeMap: Record<string, unknown> = {};
        for (const [slug, info] of Object.entries(types)) {
          const typedInfo = info as Record<string, unknown>;
          typeMap[slug] = {
            name: typedInfo.name || slug,
            description: typedInfo.description || "",
            restBase: typedInfo.rest_base || slug,
            hierarchical: typedInfo.hierarchical || false,
            hasArchive: typedInfo.has_archive || false,
          };
        }
        discovery.postTypes = typeMap;
      } else {
        discovery.postTypes = { __error: `HTTP ${typesRes.status}` };
      }
    } catch (e) {
      discovery.postTypes = { __error: e instanceof Error ? e.message : "Connection failed" };
    }

    // Get taxonomies
    try {
      const taxRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/taxonomies`, {
        headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
        redirect: "follow",
      });
      if (taxRes.ok) {
        const taxonomies = await taxRes.json();
        const taxMap: Record<string, unknown> = {};
        for (const [slug, info] of Object.entries(taxonomies)) {
          const typedInfo = info as Record<string, unknown>;
          taxMap[slug] = {
            name: typedInfo.name || slug,
            description: typedInfo.description || "",
            restBase: typedInfo.rest_base || slug,
            types: typedInfo.types || [],
          };
        }
        discovery.taxonomies = taxMap;
      } else {
        discovery.taxonomies = { __error: `HTTP ${taxRes.status}` };
      }
    } catch (e) {
      discovery.taxonomies = { __error: e instanceof Error ? e.message : "Connection failed" };
    }

    // For each post type, get count and sample
    const postTypes = Object.keys(discovery.postTypes as Record<string, unknown>);
    const typesToFetch = postTypes.length > 0 && !postTypes.includes("__error")
      ? postTypes
      : ["posts", "pages", "media"];

    for (const type of typesToFetch) {
      if (type === "__error") continue;
      const restBase = ((discovery.postTypes as Record<string, { restBase?: string }>)[type]?.restBase) || type;

      try {
        const res = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/${restBase}?per_page=1`, {
          headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
          redirect: "follow",
        });

        if (res.ok) {
          const totalHeader = res.headers.get("X-WP-Total");
          const totalPages = res.headers.get("X-WP-TotalPages");
          (discovery.counts as Record<string, number>)[type] = totalHeader ? parseInt(totalHeader, 10) : 0;

          // Get sample items (up to 3)
          const sampleRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/${restBase}?per_page=3&orderby=date&order=desc`, {
            headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
            redirect: "follow",
          });

          if (sampleRes.ok) {
            const sampleData = await sampleRes.json();
            (discovery.samples as Record<string, unknown[]>)[type] = (sampleData as unknown[]).map((item: unknown) => {
              const typed = item as Record<string, unknown>;
              return {
                id: typed.id,
                title: typeof typed.title === "object" && typed.title
                  ? (typed.title as Record<string, string>).rendered || String(typed.id)
                  : String(typed.id),
                slug: typed.slug,
                date: typed.date,
                status: typed.status,
                type: typed.type,
                link: typed.link,
              };
            });
          }
        } else {
          (discovery.counts as Record<string, number>)[type] = 0;
        }
      } catch {
        (discovery.counts as Record<string, number>)[type] = 0;
      }
    }

    // Get users count
    try {
      const usersRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/users?per_page=1`, {
        headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
        redirect: "follow",
      });
      if (usersRes.ok) {
        const totalHeader = usersRes.headers.get("X-WP-Total");
        (discovery.counts as Record<string, number>)["users"] = totalHeader ? parseInt(totalHeader, 10) : 0;

        const sampleUsersRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/users?per_page=3`, {
          headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
          redirect: "follow",
        });
        if (sampleUsersRes.ok) {
          const sampleUsers = await sampleUsersRes.json();
          (discovery.samples as Record<string, unknown[]>)["users"] = (sampleUsers as unknown[]).map((u: unknown) => {
            const typed = u as Record<string, unknown>;
            return {
              id: typed.id,
              name: typed.name,
              slug: typed.slug,
            };
          });
        }
      }
    } catch {
      // Non-fatal
    }

    return new Response(
      JSON.stringify(discovery),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "proxy") {
    if (!path || typeof path !== "string") {
      return new Response(
        JSON.stringify({ error: "path is required for proxy action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUrl = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const res = await fetchWithTimeout(targetUrl, {
        headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Connect/1.0" },
        redirect: "follow",
      });
      const body = await res.text();

      const proxyHeaders: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };
      if (res.headers.get("X-WP-Total")) {
        proxyHeaders["X-WP-Total"] = res.headers.get("X-WP-Total")!;
      }
      if (res.headers.get("X-WP-TotalPages")) {
        proxyHeaders["X-WP-TotalPages"] = res.headers.get("X-WP-TotalPages")!;
      }

      return new Response(body, { status: res.status, headers: proxyHeaders });
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "Proxy request failed",
          detail: e instanceof Error ? e.message : "Unknown error",
          targetUrl,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: `Unknown action: ${action}` }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

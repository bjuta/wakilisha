import fs from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const OUTPUT_PATH = path.join(DIST_DIR, "sitemap.xml");
const SITE_HOST = "wakilisha.africa";
const FETCH_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.SEO_SITEMAP_REFRESH_TIMEOUT_MS || 30000),
);
const RETRY_COUNT = Math.max(
  1,
  Number(process.env.SEO_SITEMAP_REFRESH_RETRY_COUNT || 3),
);

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateXml(xml) {
  const trimmed = String(xml || "").trim();

  if (!trimmed.startsWith("<?xml")) {
    throw new Error("Canonical sitemap response is not XML.");
  }

  if (!trimmed.includes("<urlset") || !trimmed.includes("</urlset>")) {
    throw new Error("Canonical sitemap response is missing urlset.");
  }

  const locs = [...trimmed.matchAll(/<loc>(.*?)<\/loc>/gims)]
    .map((match) => String(match[1] || "").trim())
    .filter(Boolean);

  if (locs.length < 100) {
    throw new Error(
      `Canonical sitemap returned only ${locs.length} URL(s); refusing to replace production sitemap.`,
    );
  }

  const seen = new Set();

  for (const loc of locs) {
    let parsed;

    try {
      parsed = new URL(loc);
    } catch {
      throw new Error(`Canonical sitemap contains an invalid URL: ${loc}`);
    }

    if (parsed.hostname !== SITE_HOST) {
      throw new Error(
        `Canonical sitemap contains a foreign host: ${parsed.hostname}`,
      );
    }

    if (
      parsed.pathname.includes("/admin") ||
      parsed.pathname.includes("/auth") ||
      parsed.pathname.includes("/preview")
    ) {
      throw new Error(
        `Canonical sitemap contains a private route: ${parsed.pathname}`,
      );
    }

    if (seen.has(loc)) {
      throw new Error(`Canonical sitemap contains duplicate URL: ${loc}`);
    }

    seen.add(loc);
  }

  return {
    xml: trimmed + "\n",
    count: locs.length,
    releaseCount: locs.filter((loc) =>
      new URL(loc).pathname.startsWith("/releases/"),
    ).length,
    trackCount: locs.filter((loc) =>
      new URL(loc).pathname.startsWith("/tracks/"),
    ).length,
  };
}

async function fetchCanonicalSitemap() {
  const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl) {
    throw new Error(
      "VITE_PUBLIC_SUPABASE_URL is required to refresh the canonical public sitemap.",
    );
  }

  const endpoint =
    `${supabaseUrl}/functions/v1/seo-sitemap-admin?action=xml_live`;

  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/xml",
          ...(anonKey
            ? {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
              }
            : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `seo-sitemap-admin xml_live returned ${response.status} ${response.statusText}`,
        );
      }

      return validateXml(await response.text());
    } catch (error) {
      lastError = error;

      if (attempt < RETRY_COUNT) {
        await sleep(attempt * 1000);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    `Could not refresh canonical public sitemap after ${RETRY_COUNT} attempt(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error("dist was not found. Run vite build before sitemap refresh.");
  }

  const result = await fetchCanonicalSitemap();

  fs.writeFileSync(OUTPUT_PATH, result.xml);

  console.log(
    `Canonical public sitemap refreshed: ${result.count.toLocaleString()} URLs (${result.releaseCount.toLocaleString()} release-scoped, ${result.trackCount.toLocaleString()} track-scoped).`,
  );
  console.log(`Canonical public sitemap written: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

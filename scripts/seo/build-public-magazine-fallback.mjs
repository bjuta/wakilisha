import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");
const fallbackPath = path.join(distDir, "public-magazine-fallback.json");

function fail(message) {
  throw new Error(`[public-magazine-fallback] ${message}`);
}

function readEnvFileValue(key) {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.resolve(fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [name, ...rest] = trimmed.split("=");
      if (name.trim() !== key) continue;

      return rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }

  return "";
}

function envValue(key) {
  return process.env[key] || readEnvFileValue(key) || "";
}

function cleanStory(story) {
  return {
    id: String(story?.id || ""),
    slug: String(story?.slug || ""),
    title: String(story?.title || ""),
    section: String(story?.section || "Article"),
    dek: String(story?.dek || ""),
    author: String(story?.author || "WAKILISHA Editorial"),
    authorSlug: String(story?.authorSlug || ""),
    date: String(story?.date || ""),
    readingTime: Number(story?.readingTime || 3),
    heroUrl: String(story?.heroUrl || ""),
    tags: Array.isArray(story?.tags) ? story.tags.map(String).slice(0, 12) : [],
  };
}

if (!fs.existsSync(indexPath)) {
  fail(`Missing homepage HTML: ${indexPath}`);
}

const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");

if (!supabaseUrl || !anonKey) {
  fail("Missing VITE_PUBLIC_SUPABASE_URL or VITE_PUBLIC_SUPABASE_ANON_KEY.");
}

const endpoint = `${supabaseUrl}/functions/v1/public-content-read/magazine?limit=24`;

const response = await fetch(endpoint, {
  headers: {
    Accept: "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
});

if (!response.ok) {
  fail(`Magazine fallback API failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
const stories = (payload?.data?.stories || payload?.stories || [])
  .map(cleanStory)
  .filter((story) => story.id && story.slug && story.title);

if (stories.length === 0) {
  fail("Magazine fallback API returned zero stories.");
}

const fallback = {
  generatedAt: new Date().toISOString(),
  stories,
};

const fallbackJson = JSON.stringify(fallback);
fs.writeFileSync(fallbackPath, JSON.stringify(fallback, null, 2) + "\n");

const safeInlineJson = fallbackJson.replace(/</g, "\\u003c");
const inlineScript = `<script id="wk-magazine-fallback" type="application/json">${safeInlineJson}</script>`;

let indexHtml = fs.readFileSync(indexPath, "utf8");
indexHtml = indexHtml.replace(/\s*<script id="wk-magazine-fallback" type="application\/json">[\s\S]*?<\/script>/g, "");

if (!indexHtml.includes("</body>")) {
  fail("dist/index.html is missing </body>.");
}

indexHtml = indexHtml.replace("</body>", `  ${inlineScript}\n</body>`);
fs.writeFileSync(indexPath, indexHtml);

console.log(`Magazine fallback generated: ${fallbackPath}`);
console.log(`Magazine fallback stories: ${stories.length}`);

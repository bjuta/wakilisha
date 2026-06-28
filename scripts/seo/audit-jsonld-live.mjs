import fs from "node:fs";
import path from "node:path";

const SITE_URL = "https://wakilisha.africa";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const REPORT_JSON = path.resolve("reports/seo-jsonld-live-audit.json");
const REPORT_MD = path.resolve("reports/seo-jsonld-live-audit.md");

function stripTags(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function cleanUrl(value) {
  return String(value || "").trim();
}

function typeOfNode(node) {
  const type = node?.["@type"];
  return Array.isArray(type) ? type.join(",") : String(type || "");
}

function graphNodes(jsonld) {
  if (!jsonld || typeof jsonld !== "object") return [];
  if (Array.isArray(jsonld)) return jsonld.flatMap(graphNodes);
  if (Array.isArray(jsonld["@graph"])) return jsonld["@graph"];
  return [jsonld];
}

function findFirst(nodes, wantedType) {
  return nodes.find((node) => {
    const type = node?.["@type"];
    return Array.isArray(type) ? type.includes(wantedType) : type === wantedType;
  });
}

function findByTypeIncludes(nodes, wantedType) {
  return nodes.find((node) => typeOfNode(node).includes(wantedType));
}

function requiredCheck(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return String(value || "").trim().length > 0;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 compatible; WakilishaJsonLdAudit/1.0",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "manual",
  });

  const text = await response.text().catch(() => "");

  return {
    url,
    status: response.status,
    redirected: response.status >= 300 && response.status < 400,
    location: response.headers.get("location") || "",
    contentType: response.headers.get("content-type") || "",
    text,
  };
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();

    try {
      blocks.push({
        ok: true,
        raw,
        json: JSON.parse(raw),
        error: "",
      });
    } catch (error) {
      blocks.push({
        ok: false,
        raw,
        json: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return blocks;
}

function extractTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return stripTags(match?.[1] || "");
}

function attrValue(tag, attrName) {
  const pattern = new RegExp(`\\b${attrName}=["']([^"']*)["']`, "i");
  return tag.match(pattern)?.[1] || "";
}

function extractMeta(html, nameOrProperty) {
  const wanted = String(nameOrProperty || "").toLowerCase();
  const tags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const key = attrValue(tag, "name") || attrValue(tag, "property");
    if (key.toLowerCase() !== wanted) continue;

    return attrValue(tag, "content");
  }

  return "";
}

function extractCanonical(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];

  for (const tag of tags) {
    if (attrValue(tag, "rel").toLowerCase() !== "canonical") continue;

    return attrValue(tag, "href");
  }

  return "";
}

function collectTypes(blocks) {
  const types = [];

  for (const block of blocks) {
    for (const node of graphNodes(block.json)) {
      const type = typeOfNode(node);
      if (type) types.push(type);
    }
  }

  return Array.from(new Set(types));
}

function evaluate(pageType, url, html, blocks) {
  const title = extractTitle(html);
  const description = extractMeta(html, "description");
  const canonical = extractCanonical(html);
  const allNodes = blocks.flatMap((block) => graphNodes(block.json));
  const types = collectTypes(blocks);

  const baseChecks = [
    ["has one JSON-LD block", blocks.length === 1],
    ["JSON-LD parses", blocks.length > 0 && blocks.every((block) => block.ok)],
    ["has Organization", Boolean(findFirst(allNodes, "Organization"))],
    ["has WebSite", Boolean(findFirst(allNodes, "WebSite"))],
    ["has BreadcrumbList", Boolean(findFirst(allNodes, "BreadcrumbList"))],
    ["has title", requiredCheck(title)],
    ["has meta description", requiredCheck(description)],
    ["has canonical", requiredCheck(canonical)],
    ["canonical matches URL", canonical === url],
  ];

  const pageChecks = [];

  if (pageType === "home") {
    const website = findFirst(allNodes, "WebSite");
    pageChecks.push(["home has SearchAction", Boolean(website?.potentialAction?.["@type"] === "SearchAction")]);
    pageChecks.push(["home has WebPage", Boolean(findFirst(allNodes, "WebPage"))]);
  }

  if (pageType === "article") {
    const article = findFirst(allNodes, "Article");
    pageChecks.push(["article has Article", Boolean(article)]);
    pageChecks.push(["article has headline", requiredCheck(article?.headline)]);
    pageChecks.push(["article has image", requiredCheck(article?.image)]);
    pageChecks.push(["article has author", requiredCheck(article?.author)]);
    pageChecks.push(["article has datePublished", requiredCheck(article?.datePublished)]);
    pageChecks.push(["article has publisher", requiredCheck(article?.publisher)]);
  }

  if (pageType === "artist") {
    const profile = findFirst(allNodes, "ProfilePage");
    const musicGroup = findByTypeIncludes(allNodes, "MusicGroup") || profile?.about;
    pageChecks.push(["artist has ProfilePage", Boolean(profile)]);
    pageChecks.push(["artist has MusicGroup", Boolean(musicGroup?.["@type"] === "MusicGroup")]);
    pageChecks.push(["artist has image", requiredCheck(musicGroup?.image || profile?.image)]);
    pageChecks.push(["artist has sameAs", requiredCheck(musicGroup?.sameAs || profile?.sameAs)]);
  }

  if (pageType === "release") {
    const musicAlbum = findByTypeIncludes(allNodes, "MusicAlbum") || allNodes.find((node) => node?.about?.["@type"] === "MusicAlbum")?.about;
    pageChecks.push(["release has MusicAlbum", Boolean(musicAlbum)]);
    pageChecks.push(["release has byArtist", requiredCheck(musicAlbum?.byArtist)]);
    pageChecks.push(["release has image", requiredCheck(musicAlbum?.image)]);
    pageChecks.push(["release has datePublished", requiredCheck(musicAlbum?.datePublished)]);
    pageChecks.push(["release has track", requiredCheck(musicAlbum?.track)]);
  }

  if (pageType === "track") {
    const musicRecording = findByTypeIncludes(allNodes, "MusicRecording") || allNodes.find((node) => node?.about?.["@type"] === "MusicRecording")?.about;
    pageChecks.push(["track has MusicRecording", Boolean(musicRecording)]);
    pageChecks.push(["track has byArtist", requiredCheck(musicRecording?.byArtist)]);
    pageChecks.push(["track has image", requiredCheck(musicRecording?.image)]);
    pageChecks.push(["track has inAlbum", requiredCheck(musicRecording?.inAlbum)]);
    pageChecks.push(["track has duration", requiredCheck(musicRecording?.duration)]);
  }

  if (pageType === "chart") {
    const collection = findFirst(allNodes, "CollectionPage");
    const itemList = findFirst(allNodes, "ItemList");
    pageChecks.push(["chart has CollectionPage", Boolean(collection)]);
    pageChecks.push(["chart has ItemList", Boolean(itemList)]);
    pageChecks.push(["chart has itemListElement", requiredCheck(itemList?.itemListElement)]);
  }

  const checks = [...baseChecks, ...pageChecks];
  const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);

  return {
    pageType,
    url,
    status: 200,
    title,
    descriptionLength: description.length,
    canonical,
    jsonLdBlockCount: blocks.length,
    types,
    checks: checks.map(([label, ok]) => ({ label, ok })),
    failed,
  };
}

function pickFirst(urls, predicate, fallback = "") {
  return urls.find(predicate) || fallback;
}

async function main() {
  const sitemapResponse = await fetchText(SITEMAP_URL);
  if (sitemapResponse.status !== 200) {
    throw new Error(`Could not fetch sitemap: ${sitemapResponse.status}`);
  }

  const urls = Array.from(sitemapResponse.text.matchAll(/<loc>(.*?)<\/loc>/g))
    .map((match) => cleanUrl(match[1]))
    .filter(Boolean);

  const sampleUrls = {
    home: `${SITE_URL}/`,
    article: pickFirst(urls, (url) => url.includes("/magazine/") && !url.endsWith("/magazine")),
    artist: pickFirst(urls, (url) => /\/artists\/[^/]+$/.test(url)),
    release: pickFirst(urls, (url) => /\/releases\/[^/]+\/[^/]+$/.test(url)),
    track: pickFirst(urls, (url) => /\/tracks\/[^/]+\/[^/]+$/.test(url)),
    chart: pickFirst(urls, (url) => url.includes("/charts/"), `${SITE_URL}/charts`),
  };

  const results = [];

  for (const [pageType, url] of Object.entries(sampleUrls)) {
    if (!url) {
      results.push({
        pageType,
        url: "",
        status: 0,
        error: "No sample URL found in sitemap.",
      });
      continue;
    }

    const page = await fetchText(url);
    const blocks = extractJsonLdBlocks(page.text);

    if (page.status !== 200) {
      results.push({
        pageType,
        url,
        status: page.status,
        redirected: page.redirected,
        location: page.location,
        error: `Unexpected HTTP status ${page.status}`,
      });
      continue;
    }

    const result = evaluate(pageType, url, page.text, blocks);
    results.push(result);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    sitemapUrl: SITEMAP_URL,
    sampleUrls,
    results,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2) + "\n");

  const lines = [];
  lines.push("# WAKILISHA JSON-LD Live Audit");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Sitemap: ${SITEMAP_URL}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Page type | URL | JSON-LD types | Failed checks |");
  lines.push("|---|---|---|---|");

  for (const result of results) {
    const types = result.types?.join(", ") || "none";
    const failed = result.failed?.length ? result.failed.join("; ") : "none";
    lines.push(`| ${result.pageType} | ${result.url || "missing"} | ${types} | ${failed} |`);
  }

  lines.push("");
  lines.push("## Detail");
  lines.push("");

  for (const result of results) {
    lines.push(`### ${result.pageType}: ${result.url || "missing"}`);
    lines.push("");
    if (result.error) {
      lines.push(`Error: ${result.error}`);
      lines.push("");
      continue;
    }

    lines.push(`Status: ${result.status}`);
    lines.push(`Title: ${result.title}`);
    lines.push(`Canonical: ${result.canonical}`);
    lines.push(`JSON-LD blocks: ${result.jsonLdBlockCount}`);
    lines.push(`Types: ${(result.types || []).join(", ") || "none"}`);
    lines.push("");
    lines.push("| Check | Result |");
    lines.push("|---|---|");
    for (const check of result.checks || []) {
      lines.push(`| ${check.label} | ${check.ok ? "PASS" : "FAIL"} |`);
    }
    lines.push("");
  }

  fs.writeFileSync(REPORT_MD, lines.join("\n") + "\n");

  console.log(`JSON report: ${REPORT_JSON}`);
  console.log(`Markdown report: ${REPORT_MD}`);
  console.log("");
  console.log(lines.slice(0, 18).join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

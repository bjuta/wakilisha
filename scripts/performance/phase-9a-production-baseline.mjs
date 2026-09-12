#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium, devices, webkit } from "@playwright/test";

const BASE_URL = (process.env.WAKILISHA_PHASE9A_BASE_URL || "https://wakilisha.africa").replace(/\/$/, "");
const RUNTIME_SHA = process.env.WAKILISHA_PHASE9A_RUNTIME_SHA || "unknown";
const OUTPUT_DIR = process.env.WAKILISHA_PHASE9A_OUTPUT_DIR || "/tmp/wakilisha-phase-9a-baseline";
const SETTLE_MS = Number(process.env.WAKILISHA_PHASE9A_SETTLE_MS || 4500);
const NAV_TIMEOUT_MS = Number(process.env.WAKILISHA_PHASE9A_NAV_TIMEOUT_MS || 30000);

const routeSeeds = [
  { key: "home", path: "/" },
  { key: "magazine", path: "/magazine" },
  { key: "search", path: "/search?q=nairobi" },
];

function sameOrigin(url) {
  try {
    return new URL(url).origin === new URL(BASE_URL).origin;
  } catch {
    return false;
  }
}

function cleanPath(href) {
  try {
    const url = new URL(href, BASE_URL);
    if (url.origin !== new URL(BASE_URL).origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function hash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function installObservers(page) {
  await page.addInitScript(() => {
    window.__WK_PHASE9A_PERF = {
      cls: 0,
      lcp: null,
      longTasks: [],
      paints: {},
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__WK_PHASE9A_PERF.cls += entry.value || 0;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          window.__WK_PHASE9A_PERF.lcp = {
            startTime: last.startTime,
            size: last.size,
            url: last.url || null,
            element: last.element
              ? {
                  tag: last.element.tagName,
                  id: last.element.id || null,
                  className: typeof last.element.className === "string" ? last.element.className : null,
                }
              : null,
          };
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__WK_PHASE9A_PERF.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__WK_PHASE9A_PERF.paints[entry.name] = entry.startTime;
        }
      }).observe({ type: "paint", buffered: true });
    } catch {}
  });
}

async function discoverPath(page, seedPath, patterns) {
  await page.goto(`${BASE_URL}${seedPath}`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await page.locator("main").waitFor({ state: "attached", timeout: NAV_TIMEOUT_MS }).catch(() => {});
  await page.waitForTimeout(1600);

  const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href")).filter(Boolean),
  );

  const candidates = hrefs.map(cleanPath).filter(Boolean);
  return candidates.find((candidate) => patterns.some((pattern) => pattern.test(candidate))) || null;
}

async function resolveRepresentativeRoutes(browser) {
  const context = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await context.newPage();
  const discovered = [];

  const article = await discoverPath(page, "/magazine", [/^\/magazine\/[^/?#]+$/]);
  if (article) discovered.push({ key: "article", path: article });

  const artist = await discoverPath(page, "/artists", [/^\/artists\/[^/?#]+$/]);
  if (artist) discovered.push({ key: "artist", path: artist });

  const release = await discoverPath(page, "/releases", [/^\/releases\/[^/?#]+\/[^/?#]+$/]);
  if (release) {
    discovered.push({ key: "release", path: release });
  } else {
    const track = await discoverPath(page, "/", [/^\/tracks\/[^/?#]+\/[^/?#]+$/]);
    if (track) discovered.push({ key: "track", path: track });
  }

  const video = await discoverPath(page, "/video", [/^\/video\/[^/?#]+$/]);
  if (video) {
    discovered.push({ key: "video", path: video });
  } else {
    const episode = await discoverPath(page, "/shows", [/^\/shows\/[^/?#]+\/[^/?#]+$/]);
    if (episode) discovered.push({ key: "show-episode", path: episode });
  }

  await context.close();
  return [...routeSeeds, ...discovered];
}

async function readVisualState(page) {
  return await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const elementDescriptor = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        id: el.id || null,
        className: typeof el.className === "string" ? el.className.slice(0, 240) : null,
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        opacity: style.opacity,
        visibility: style.visibility,
        display: style.display,
        pointerEvents: style.pointerEvents,
      };
    };

    const hitTestInvisible = [];
    const elements = Array.from(document.querySelectorAll("main *"));
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 12) continue;
      if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth) continue;
      const style = getComputedStyle(el);
      const opacity = Number(style.opacity);
      const invisible = style.visibility === "hidden" || style.display === "none" || opacity <= 0.01;
      if (!invisible || style.pointerEvents === "none") continue;

      const x = Math.min(viewportWidth - 1, Math.max(0, rect.left + Math.min(rect.width / 2, 8)));
      const y = Math.min(viewportHeight - 1, Math.max(0, rect.top + Math.min(rect.height / 2, 8)));
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) {
        hitTestInvisible.push(elementDescriptor(el));
        if (hitTestInvisible.length >= 30) break;
      }
    }

    const main = document.querySelector("main");
    const mainStyle = main ? getComputedStyle(main) : null;
    const mainRect = main?.getBoundingClientRect();

    const images = Array.from(document.images)
      .map((img) => {
        const rect = img.getBoundingClientRect();
        return {
          src: img.currentSrc || img.src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          renderedWidth: Math.round(rect.width),
          renderedHeight: Math.round(rect.height),
          loading: img.loading || null,
          fetchPriority: img.fetchPriority || null,
          complete: img.complete,
        };
      })
      .filter((img) => img.renderedWidth > 0 && img.renderedHeight > 0);

    return {
      title: document.title,
      main: main && mainStyle && mainRect
        ? {
            display: mainStyle.display,
            visibility: mainStyle.visibility,
            opacity: mainStyle.opacity,
            rect: {
              x: Math.round(mainRect.x),
              y: Math.round(mainRect.y),
              width: Math.round(mainRect.width),
              height: Math.round(mainRect.height),
            },
          }
        : null,
      hitTestInvisible,
      imageCount: images.length,
      images: images.slice(0, 80),
      bodyHeight: Math.round(document.body.getBoundingClientRect().height),
    };
  });
}

async function collectPageMetrics(page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const perf = window.__WK_PHASE9A_PERF || {};
    const resources = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      startTime: entry.startTime,
      duration: entry.duration,
      transferSize: entry.transferSize || 0,
      encodedBodySize: entry.encodedBodySize || 0,
      decodedBodySize: entry.decodedBodySize || 0,
    }));

    return {
      navigation: nav
        ? {
            startTime: nav.startTime,
            responseStart: nav.responseStart,
            domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
            loadEventEnd: nav.loadEventEnd,
            transferSize: nav.transferSize || 0,
            encodedBodySize: nav.encodedBodySize || 0,
            decodedBodySize: nav.decodedBodySize || 0,
          }
        : null,
      firstContentfulPaint: perf.paints?.["first-contentful-paint"] ?? null,
      firstPaint: perf.paints?.["first-paint"] ?? null,
      largestContentfulPaint: perf.lcp ?? null,
      cumulativeLayoutShift: perf.cls ?? 0,
      longTasks: perf.longTasks ?? [],
      resources,
    };
  });
}

async function auditRoute(browser, browserName, route) {
  const context = await browser.newContext({
    ...(browserName === "webkit" ? devices["iPhone 13"] : devices["Pixel 5"]),
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  await installObservers(page);

  const requests = [];
  const failures = [];
  const consoleErrors = [];

  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      sameOrigin: sameOrigin(request.url()),
    });
  });
  page.on("requestfailed", (request) => {
    failures.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText || "unknown",
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  const target = `${BASE_URL}${route.path}`;
  const startedAt = Date.now();
  let navigationError = null;
  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    await page.locator("main").waitFor({ state: "attached", timeout: NAV_TIMEOUT_MS }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}",
  }).catch(() => {});
  await page.waitForTimeout(250);

  const beforeVisual = await readVisualState(page).catch(() => null);
  const beforeScreenshot = await page.screenshot({ fullPage: false });
  await page.mouse.move(1, 1).catch(() => {});
  await page.waitForTimeout(250);
  const afterVisual = await readVisualState(page).catch(() => null);
  const afterScreenshot = await page.screenshot({ fullPage: false });
  const metrics = await collectPageMetrics(page).catch(() => null);

  const preflights = requests.filter((request) => request.method === "OPTIONS");
  const publicContentRequests = requests.filter((request) =>
    request.url.includes("/functions/v1/public-content-read") || request.url.includes("/functions/v1/wakilisha-public-api"),
  );

  const result = {
    key: route.key,
    path: route.path,
    url: page.url(),
    browser: browserName,
    runtimeSha: RUNTIME_SHA,
    navigationDurationMs: Date.now() - startedAt,
    navigationError,
    metrics,
    requests: {
      count: requests.length,
      byType: Object.fromEntries(
        Object.entries(
          requests.reduce((acc, request) => {
            acc[request.resourceType] = (acc[request.resourceType] || 0) + 1;
            return acc;
          }, {}),
        ).sort(),
      ),
      preflights,
      publicContentRequests,
      crossOriginCount: requests.filter((request) => !request.sameOrigin).length,
    },
    failures,
    consoleErrors,
    visual: {
      before: beforeVisual,
      afterPointer: afterVisual,
      screenshotBeforeSha256: hash(beforeScreenshot),
      screenshotAfterPointerSha256: hash(afterScreenshot),
      screenshotChangedAfterPointer: hash(beforeScreenshot) !== hash(afterScreenshot),
    },
  };

  const safeName = `${browserName}-${route.key}`.replace(/[^a-z0-9_-]+/gi, "-");
  await fs.writeFile(path.join(OUTPUT_DIR, `${safeName}-before.png`), beforeScreenshot);
  await fs.writeFile(path.join(OUTPUT_DIR, `${safeName}-after-pointer.png`), afterScreenshot);

  await context.close();
  return result;
}

function summarize(results) {
  const lines = [
    "# Phase 9A Production Before-State",
    "",
    `- base URL: ${BASE_URL}`,
    `- runtime SHA: ${RUNTIME_SHA}`,
    `- captured at: ${new Date().toISOString()}`,
    "",
    "| Browser | Route | FCP ms | LCP ms | CLS | Requests | OPTIONS | Failures | Invisible hit targets | Screenshot changed after pointer |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.browser} | ${result.key} | ${Math.round(result.metrics?.firstContentfulPaint ?? 0) || "-"} | ${Math.round(result.metrics?.largestContentfulPaint?.startTime ?? 0) || "-"} | ${(result.metrics?.cumulativeLayoutShift ?? 0).toFixed(3)} | ${result.requests.count} | ${result.requests.preflights.length} | ${result.failures.length} | ${result.visual.before?.hitTestInvisible?.length ?? "-"} | ${result.visual.screenshotChangedAfterPointer ? "yes" : "no"} |`,
    );
  }

  lines.push("", "Raw JSON and paired viewport screenshots are authoritative for diagnosis; this table is only an index.", "");
  return lines.join("\n");
}

await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const discoveryBrowser = await chromium.launch({ headless: true });
const routes = await resolveRepresentativeRoutes(discoveryBrowser);
await discoveryBrowser.close();

const requiredKeys = ["home", "magazine", "search", "article", "artist"];
for (const key of requiredKeys) {
  if (!routes.some((route) => route.key === key)) {
    throw new Error(`Phase 9A baseline could not discover required representative route: ${key}`);
  }
}
if (!routes.some((route) => route.key === "release" || route.key === "track")) {
  throw new Error("Phase 9A baseline could not discover a Release or Track representative route.");
}
if (!routes.some((route) => route.key === "video" || route.key === "show-episode")) {
  throw new Error("Phase 9A baseline could not discover a public Video or Show Episode representative route.");
}

const results = [];
for (const [browserName, launcher] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await launcher.launch({ headless: true });
  try {
    for (const route of routes) {
      console.log(`[phase-9a-baseline] ${browserName} ${route.key} ${route.path}`);
      results.push(await auditRoute(browser, browserName, route));
    }
  } finally {
    await browser.close();
  }
}

const report = {
  schemaVersion: 1,
  baseUrl: BASE_URL,
  runtimeSha: RUNTIME_SHA,
  capturedAt: new Date().toISOString(),
  settleMs: SETTLE_MS,
  routes,
  results,
};

await fs.writeFile(path.join(OUTPUT_DIR, "baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(path.join(OUTPUT_DIR, "README.md"), `${summarize(results)}\n`);

console.log(`PHASE_9A_BASELINE_OUTPUT=${OUTPUT_DIR}`);
console.log(`PHASE_9A_BASELINE_ROUTES=${routes.map((route) => `${route.key}:${route.path}`).join(",")}`);
console.log("PHASE_9A_BASELINE=PASS");

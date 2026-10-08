import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const targets = [
  "https://wakilisha.africa/",
  "https://wakilisha.africa/magazine",
  "https://wakilisha.africa/artists/lil-maina",
  "https://wakilisha.africa/releases/munishi/munishi-vol-3",
];
// Recheck Production Release after Edge v100 and validated 12-track aggregate.
const browser = await chromium.launch({ headless: true });
const output = [];
for (const url of targets) {
  for (const profile of ["desktop", "mobile"]) {
    const context = await browser.newContext({
      viewport: profile === "mobile" ? { width: 390, height: 844 } : { width: 1365, height: 768 },
      deviceScaleFactor: profile === "mobile" ? 2 : 1,
      isMobile: profile === "mobile",
      hasTouch: profile === "mobile",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const responses = [];
    const failures = [];
    const runtimeErrors = [];
    const snapshots = [];
    page.on("pageerror", (e) => runtimeErrors.push(String(e).slice(0, 500)));
    page.on("console", (msg) => { if (msg.type() === "error") runtimeErrors.push(msg.text().slice(0, 500)); });
    page.on("response", (r) => {
      if (r.url().includes("wakilisha.africa") || r.url().includes("supabase.co")) {
        responses.push({ status: r.status(), url: r.url().slice(0, 240), resourceType: r.request().resourceType() });
      }
    });
    page.on("requestfailed", (r) => failures.push({ url: r.url().slice(0, 240), failure: r.failure() }));
    const releaseNetwork = [];
    if (url.includes("/releases/")) {
      page.on("request", (request) => {
        if (!request.url().includes("/functions/v1/public-content-read/releases/")) return;
        releaseNetwork.push({ endpoint: new URL(request.url()).pathname, startAt: Date.now(), status: null, responseAt: null, doneAt: null });
      });
      page.on("response", (response) => {
        if (!response.url().includes("/functions/v1/public-content-read/releases/")) return;
        const record = [...releaseNetwork].reverse().find((item) => item.status === null);
        if (record) { record.status = response.status(); record.responseAt = Date.now(); }
      });
      page.on("requestfinished", (request) => {
        if (!request.url().includes("/functions/v1/public-content-read/releases/")) return;
        const record = [...releaseNetwork].reverse().find((item) => item.doneAt === null);
        if (record) record.doneAt = Date.now();
      });
    }
    const releasePaintSnapshots = [];
    const takeReleaseSnapshot = async (label) => {
      if (!url.includes("/releases/")) return;
      releasePaintSnapshots.push(await page.evaluate((label) => ({
        label, at: Math.round(performance.now()),
        rootChars: document.querySelector("#root")?.innerText?.length || 0,
        releaseTitleVisible: (document.querySelector("#root")?.innerText || "").includes("Munishi, Vol. 3"),
        releaseLoadingVisible: /Opening release|LOADING RELEASE/i.test(document.querySelector("#root")?.innerText || ""),
        trackListVisible: (document.querySelector("#root")?.innerText || "").includes("12 tracks"),
      }), label));
    };
    await page.addInitScript(() => {
      window.__wkPerf = { lcp: [], longTasks: [] };
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__wkPerf.lcp.push({ startTime: e.startTime, url: e.url || null });
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__wkPerf.longTasks.push(e.duration);
        }).observe({ type: "longtask", buffered: true });
      } catch {}
    });
    let error = null;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);
      await takeReleaseSnapshot("first");
      snapshots.push(await page.evaluate(() => ({ at: Math.round(performance.now()), text: (document.querySelector("#root")?.innerText || "").slice(0, 220), len: document.querySelector("#root")?.innerText?.length || 0 })));
      await page.waitForTimeout(2000);
      snapshots.push(await page.evaluate(() => ({ at: Math.round(performance.now()), text: (document.querySelector("#root")?.innerText || "").slice(0, 220), len: document.querySelector("#root")?.innerText?.length || 0 })));
      await takeReleaseSnapshot("second");
      if (snapshots.at(-1)?.len < 300) {
        await page.waitForTimeout(4000);
        await takeReleaseSnapshot("extended");
        snapshots.push(await page.evaluate(() => ({ at: Math.round(performance.now()), text: (document.querySelector("#root")?.innerText || "").slice(0, 220), len: document.querySelector("#root")?.innerText?.length || 0 })));
      }
    } catch (e) { error = String(e); }
    const timings = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const paints = performance.getEntriesByType("paint");
      const fcp = paints.find((p) => p.name === "first-contentful-paint");
      const lcp = window.__wkPerf?.lcp?.at(-1);
      const resources = performance.getEntriesByType("resource");
      const byType = {};
      for (const r of resources) {
        const k = r.initiatorType || "other";
        byType[k] = (byType[k] || 0) + 1;
      }
      const slowResources = resources.filter((r) => /supabase\\.co|wakilisha\\.africa/.test(r.name)).map((r) => ({ path: (() => { try { const u = new URL(r.name); return u.host + u.pathname; } catch { return r.name.slice(0, 100); } })(), ms: Math.round(r.duration), start: Math.round(r.startTime), type: r.initiatorType })).sort((a, b) => b.ms - a.ms).slice(0, 12);
      return {
        slowResources,
        ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
        responseEnd: nav ? Math.round(nav.responseEnd) : null,
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        fcp: fcp ? Math.round(fcp.startTime) : null,
        lcp: lcp ? Math.round(lcp.startTime) : null,
        lcpUrl: lcp?.url || null,
        longTaskTotal: Math.round((window.__wkPerf?.longTasks || []).reduce((a, b) => a + b, 0)),
        resourceCount: resources.length,
        resourcesByType: byType,
        rootTextLength: document.getElementById("root")?.innerText?.length || 0,
      };
    }).catch(() => ({}));
    const result = { url, profile, error, snapshots, releaseNetwork: releaseNetwork.map((r) => ({ ...r, totalMs: r.doneAt && r.startAt ? r.doneAt - r.startAt : null })), releasePaintSnapshots, runtimeErrors: runtimeErrors.slice(0, 10), ...timings, failingRequests: failures.slice(0, 10),
      httpErrors: responses.filter((r) => r.status >= 400).slice(0, 10),
      apiResponses: responses.filter((r) => /supabase.co|\/api\//.test(r.url)).slice(0, 15) };
    output.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
}
await browser.close();
fs.mkdirSync("artifacts/performance", { recursive: true });
fs.writeFileSync(path.join("artifacts/performance", "production-first-render.json"), JSON.stringify(output, null, 2));

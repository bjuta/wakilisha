#!/usr/bin/env node
import process from "node:process";
import { chromium } from "@playwright/test";

const baseURL = (
  process.env.WAKILISHA_PUBLIC_BASE_URL
  || "https://wakilisha.africa"
).replace(/\/$/, "");

const seeds = [
  "/",
  "/magazine",
  "/charts",
  "/playlists",
  "/shows",
  "/audio",
  "/video",
  "/artists",
  "/releases",
  "/genres",
  "/labels",
  "/categories",
  "/tags",
  "/search",
  "/music",
  "/briefings",
  "/about",
  "/contact",
  "/faqs",
  "/privacy",
  "/terms",
  "/api-docs",
];

const discoverablePath =
  /^\/(?:magazine|charts|playlists|shows|audio|video|artists|tracks|releases|genres|labels|categories|tags|guides|people|organizations|u)(?:\/|$)/;

const fatalConsolePattern =
  /(?:ReferenceError|TypeError|RangeError|SyntaxError|\bis not defined\b|Cannot read properties of|Invalid hook call|Maximum update depth|Minified React error)/i;

function normalizePath(value) {
  try {
    const url = new URL(value, baseURL);
    const expected = new URL(baseURL);

    if (url.origin !== expected.origin) {
      return null;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

const browser = await chromium.launch({
  headless: true,
});

const context = await browser.newContext({
  serviceWorkers: "block",
});

const page = await context.newPage();
const failures = [];
const discovered = new Set();
let activeRoute = "";

page.on("pageerror", (error) => {
  failures.push(
    `${activeRoute} pageerror: ${error.name}: ${error.message}`,
  );
});

page.on("console", (message) => {
  if (
    message.type() === "error"
    && fatalConsolePattern.test(message.text())
  ) {
    failures.push(
      `${activeRoute} console.error: ${message.text()}`,
    );
  }
});

async function probe(route, discover = false) {
  activeRoute = route;
  const before = failures.length;
  let response;

  try {
    response = await page.goto(
      `${baseURL}${route}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      },
    );

    if (!response) {
      failures.push(
        `${route} missing main-document response`,
      );
    } else if (response.status() >= 500) {
      failures.push(
        `${route} document status ${response.status()}`,
      );
    }

    await page.waitForTimeout(650);

    const rootState = await page.evaluate(() => {
      const root = document.querySelector("#root");
      return {
        exists: Boolean(root),
        children: root?.childElementCount ?? 0,
        bodyHeight: document.body.scrollHeight,
      };
    });

    if (
      !rootState.exists
      || rootState.children === 0
      || rootState.bodyHeight < 8
    ) {
      failures.push(
        `${route} blank application surface ${JSON.stringify(rootState)}`,
      );
    }

    if (discover) {
      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((anchors) =>
          anchors
            .map((anchor) =>
              anchor.getAttribute("href"),
            )
            .filter(Boolean),
        );

      for (const href of hrefs) {
        const normalized = normalizePath(href);
        if (
          normalized
          && discoverablePath.test(
            new URL(normalized, baseURL).pathname,
          )
        ) {
          discovered.add(normalized);
        }
      }
    }
  } catch (error) {
    failures.push(
      `${route} navigation: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  const added = failures.length - before;
  console.log(
    `PUBLIC_RUNTIME_PROBE route=${route} failures=${added}`,
  );
}

try {
  for (const seed of seeds) {
    await probe(seed, true);
  }

  const liveRoutes = Array
    .from(discovered)
    .filter((route) => !seeds.includes(route))
    .slice(0, 80);

  console.log(
    `PUBLIC_RUNTIME_DISCOVERED=${liveRoutes.length}`,
  );

  for (const route of liveRoutes) {
    await probe(route, false);
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(
    `PUBLIC_BROWSER_RUNTIME_WATCH=FAIL count=${failures.length}`,
  );

  for (const failure of failures) {
    console.error(failure);
  }

  process.exit(1);
}

console.log("PUBLIC_BROWSER_RUNTIME_WATCH=PASS");

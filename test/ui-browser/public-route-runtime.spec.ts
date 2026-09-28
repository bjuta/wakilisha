import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const routerSource = readFileSync(
  "src/router/config.tsx",
  "utf8",
);

const publicPatterns = Array.from(
  routerSource.matchAll(
    /\{\s*path:\s*"([^"]+)"\s*,\s*element:\s*<([^\n]+?)\/>\s*\}/g,
  ),
)
  .filter((match) => {
    const route = match[1];
    const element = match[2];

    return (
      route.startsWith("/")
      && !route.startsWith("/admin")
      && !element.includes("NotFound")
    );
  })
  .map((match) => match[1]);

function materialize(pattern: string): string {
  const values: Record<string, string> = {
    artistSlug: "runtime-smoke-artist",
    trackSlug: "runtime-smoke-track",
    releaseSlug: "runtime-smoke-release",
    showSlug: "runtime-smoke-show",
    episodeSlug: "runtime-smoke-episode",
    series: "runtime-smoke-series",
    market: "ke",
    edition: "2026-09-28",
    username: "runtime-smoke-user",
    playlistSlug: "runtime-smoke-playlist",
    updateId: "00000000-0000-4000-8000-000000000001",
    postId: "00000000-0000-4000-8000-000000000002",
    issueId: "00000000-0000-4000-8000-000000000003",
    nonce: "runtime-smoke",
    slug: "runtime-smoke",
  };

  return pattern.replace(
    /:([A-Za-z0-9_]+)/g,
    (_, key: string) => values[key] ?? "runtime-smoke",
  );
}

const fatalConsolePattern =
  /(?:ReferenceError|TypeError|RangeError|SyntaxError|\bis not defined\b|Cannot read properties of|Invalid hook call|Maximum update depth|Minified React error)/i;

test("every declared public route mounts without an uncaught runtime crash", async ({
  page,
}) => {
  const failures: string[] = [];

  for (const pattern of publicPatterns) {
    const route = materialize(pattern);
    const routeErrors: string[] = [];

    const onPageError = (error: Error) => {
      routeErrors.push(
        `pageerror: ${error.name}: ${error.message}`,
      );
    };
    const onConsole = (
      message: import("@playwright/test").ConsoleMessage,
    ) => {
      if (
        message.type() === "error"
        && fatalConsolePattern.test(message.text())
      ) {
        routeErrors.push(
          `console.error: ${message.text()}`,
        );
      }
    };

    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    try {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });

      if (response && response.status() >= 500) {
        routeErrors.push(
          `document status: ${response.status()}`,
        );
      }

      await page.waitForTimeout(250);

      const rootChildren = await page
        .locator("#root")
        .evaluate(
          (root) => root.childElementCount,
        )
        .catch(() => 0);

      if (rootChildren === 0) {
        routeErrors.push(
          "application root is empty after route mount",
        );
      }
    } catch (error) {
      routeErrors.push(
        `navigation: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    } finally {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }

    if (routeErrors.length > 0) {
      failures.push(
        `${pattern} -> ${route}\n  ${routeErrors.join("\n  ")}`,
      );
    }
  }

  expect(
    failures,
    failures.join("\n\n"),
  ).toEqual([]);
});

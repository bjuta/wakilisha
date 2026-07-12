import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const fail = (message) => {
  console.error(`GA4 audit failed: ${message}`);
  process.exit(1);
};

const injector = read(
  "src/components/analytics/GtagInjector.tsx",
);
const bootstrap = read(
  "src/lib/analytics/ga4Bootstrap.ts",
);
const main = read("src/main.tsx");
const index = read("index.html");
const edge = read(
  "supabase/functions/ga4-measurement-protocol/index.ts",
);
const packageJson = JSON.parse(read("package.json"));

if (injector.includes("sendServerGa4PageView")) {
  fail(
    "browser route tracking still calls the server page-view bridge",
  );
}

if (!injector.includes('"event",')) {
  fail("manual browser event delivery was not found");
}

if (!injector.includes('"page_view",')) {
  fail("manual browser page_view event was not found");
}

if (
  index.includes("googletagmanager.com/gtag/js") ||
  index.includes("ga4-bootstrap.js")
) {
  fail("index.html still loads mutable analytics JavaScript");
}

if (
  fs.existsSync(
    "public/assets/analytics/ga4-bootstrap.js",
  )
) {
  fail("legacy mutable GA4 bootstrap still exists");
}

if (
  !main.includes(
    'from "@/lib/analytics/ga4Bootstrap"',
  ) ||
  !main.includes("initializeGa4Bootstrap();")
) {
  fail(
    "the hashed application entry does not initialize GA4",
  );
}

if (!bootstrap.includes("send_page_view: false")) {
  fail("bootstrap does not disable automatic page views");
}

if (
  !bootstrap.includes(
    "import.meta.env.VITE_GA_MEASUREMENT_ID",
  )
) {
  fail(
    "bootstrap does not read the production GA4 measurement ID from Vite environment configuration",
  );
}

if (
  !bootstrap.includes(
    'window.location.pathname.startsWith("/admin")',
  )
) {
  fail(
    "bootstrap still permits Google Analytics inside Admin Studio",
  );
}

if (
  !bootstrap.includes(
    "window.__WAKILISHA_LOAD_GA4__ = loadGa4",
  )
) {
  fail("bootstrap does not expose the lazy GA4 loader");
}

if (
  !injector.includes(
    "window.__WAKILISHA_LOAD_GA4__?.()",
  )
) {
  fail(
    "public SPA navigation cannot activate the GA4 loader",
  );
}

if (
  !bootstrap.includes(
    "data-wakilisha-ga4-loader",
  )
) {
  fail(
    "bootstrap does not prevent duplicate script injection",
  );
}

if (!bootstrap.includes("push(arguments)")) {
  fail(
    "bootstrap does not use the canonical gtag command queue",
  );
}

if (
  bootstrap.includes("push(args)") ||
  bootstrap.includes("push(_args)")
) {
  fail(
    "bootstrap pushes a rest array instead of the canonical arguments object",
  );
}

if (
  bootstrap.includes('"localhost"') ||
  bootstrap.includes('"127.0.0.1"')
) {
  fail(
    "bootstrap still permits local development traffic",
  );
}

if (
  edge.includes('"localhost"') ||
  edge.includes('"127.0.0.1"')
) {
  fail("Measurement Protocol still permits local hosts");
}

if (!edge.includes('eventName === "page_view"')) {
  fail("Measurement Protocol does not block page_view");
}

if (!edge.includes("Server authorization required.")) {
  fail(
    "Measurement Protocol is not restricted to trusted server callers",
  );
}

if (edge.includes('?? "page_view"')) {
  fail(
    "Measurement Protocol still defaults missing event names to page_view",
  );
}

if (
  !packageJson.scripts?.build?.includes(
    "npm run analytics:audit",
  ) ||
  !packageJson.scripts?.build?.includes(
    "npm run analytics:audit:dist",
  )
) {
  fail(
    "the production build does not enforce both analytics audits",
  );
}

if (
  fs.existsSync("src/services/ga4ServerAnalytics.ts")
) {
  fail(
    "legacy browser-to-server page-view service still exists",
  );
}

console.log("GA4 implementation audit passed.");

import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error(`GA4 audit failed: ${message}`);
  process.exit(1);
};

const injector = read("src/components/analytics/GtagInjector.tsx");
const bootstrap = read("public/assets/analytics/ga4-bootstrap.js");
const index = read("index.html");
const edge = read("supabase/functions/ga4-measurement-protocol/index.ts");
const packageJson = JSON.parse(read("package.json"));

if (injector.includes("sendServerGa4PageView")) {
  fail("browser route tracking still calls the server page-view bridge");
}

if (!injector.includes('"event", "page_view"')) {
  fail("manual browser page_view event was not found");
}

if (index.includes("googletagmanager.com/gtag/js")) {
  fail("index.html still loads gtag directly");
}

if (!bootstrap.includes("send_page_view: false")) {
  fail("bootstrap does not disable automatic page views");
}

if (!bootstrap.includes('window.location.pathname.indexOf("/admin") === 0')) {
  fail("bootstrap still loads Google Analytics inside Admin Studio");
}

if (!bootstrap.includes("window.__WAKILISHA_LOAD_GA4__ = loadGa4")) {
  fail("bootstrap does not expose the lazy GA4 loader");
}

if (!injector.includes("window.__WAKILISHA_LOAD_GA4__?.()")) {
  fail("public SPA navigation cannot activate the lazy GA4 loader");
}

if (!bootstrap.includes('data-wakilisha-ga4-loader="true"')) {
  fail("bootstrap does not guard against duplicate GA4 script injection");
}

if (
  bootstrap.includes('"localhost"') ||
  bootstrap.includes('"127.0.0.1"')
) {
  fail("bootstrap still permits local development traffic");
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
  fail("Measurement Protocol is not restricted to trusted server callers");
}

if (edge.includes('?? "page_view"')) {
  fail("Measurement Protocol still defaults missing event names to page_view");
}

if (!packageJson.scripts?.build?.includes("npm run analytics:audit")) {
  fail("the production build does not enforce the analytics audit");
}

if (fs.existsSync("src/services/ga4ServerAnalytics.ts")) {
  fail("legacy browser-to-server page-view service still exists");
}

console.log("GA4 implementation audit passed.");

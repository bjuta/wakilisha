#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function fail(message) {
  console.error(`WAKILISHA_VIEWPORT_INTEGRITY_FAIL: ${message}`);
  process.exit(1);
}

const index = read("index.html");
const browserFixture = read(
  "test/ui-browser/fixtures/interaction.html",
);
const tokens = read("src/design-system/wakilisha.tokens.css");
const integrityCss = read("src/design-system/wakilisha.viewport-integrity.css");
const app = read("src/App.tsx");
const main = read("src/main.tsx");
const messagesLegalPanel = read(
  "src/pages/admin/messages/MessagesLegalPanel.tsx",
);
const observer = read("src/lib/viewport/viewportIntegrity.ts");
const config = read("playwright.config.ts");
const workflow = read(".github/workflows/critical-control-plane.yml");

const viewportMatch = index.match(
  /<meta\s+name="viewport"\s+content="([^"]+)"\s*\/?>/,
);

if (!viewportMatch) {
  fail("viewport meta is missing");
}

const viewport = viewportMatch[1];

const fixtureViewportMatch = browserFixture.match(
  /<meta\s+name="viewport"\s+content="([^"]+)"\s*\/?>/,
);

if (!fixtureViewportMatch) {
  fail("browser fixture viewport meta is missing");
}

const fixtureViewport = fixtureViewportMatch[1];

if (fixtureViewport !== viewport) {
  fail(
    "browser fixture viewport meta diverges from production index.html",
  );
}

for (const required of [
  "width=device-width",
  "initial-scale=1.0",
  "viewport-fit=cover",
]) {
  if (!viewport.includes(required)) {
    fail(`viewport meta is missing ${required}`);
  }
}

for (const forbidden of [
  "user-scalable=no",
  "maximum-scale=1",
  "maximum-scale=1.0",
]) {
  if (viewport.includes(forbidden)) {
    fail(`viewport meta disables user zoom with ${forbidden}`);
  }
}

if (!tokens.includes("--wk-mobile-editable-font-size:16px;")) {
  fail("16px mobile editable token is missing");
}

for (const required of [
  "-webkit-text-size-adjust: 100%;",
  "text-size-adjust: 100%;",
  'input:not([type="button"])',
  "textarea,",
  "select,",
  '[contenteditable="true"]',
  "font-size: var(--wk-mobile-editable-font-size) !important;",
  ".wk-identity-wrap {",
  "overflow-wrap: anywhere;",
  "word-break: normal;",
]) {
  if (!integrityCss.includes(required)) {
    fail(`viewport CSS is missing ${required}`);
  }
}

if (/overflow-x\s*:/.test(integrityCss)) {
  fail("viewport integrity must not hide horizontal overflow");
}

if (
  /user-scalable\s*:\s*no|maximum-scale|touch-action\s*:\s*none/.test(
    integrityCss,
  )
) {
  fail("viewport CSS suppresses user-controlled zoom");
}

for (const required of [
  'grid-cols-[minmax(0,1fr)]',
  'className="min-h-[520px] min-w-0 overflow-hidden',
  'className="min-h-[520px] min-w-0 rounded-2xl',
  'className="min-w-0 space-y-5"',
  'className="wk-identity-wrap text-[16px] font-black text-wk-text"',
  'grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]',
  'className="min-w-0 space-y-2"',
  'className={`min-w-0 w-full rounded-xl border p-3 text-left',
  'className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"',
  'className="wk-identity-wrap text-[11px] font-black text-wk-text"',
  'className="shrink-0 self-start"',
  'className="min-h-[220px] min-w-0 rounded-xl',
]) {
  if (!messagesLegalPanel.includes(required)) {
    fail(
      `Legal mobile intrinsic-size containment is missing ${required}`,
    );
  }
}

if (
  !app.includes(
    'import "./design-system/wakilisha.viewport-integrity.css";',
  )
) {
  fail("viewport integrity CSS is not globally loaded");
}

if (!main.includes("initializeViewportIntegrityObserver();")) {
  fail("viewport integrity observer is not initialized");
}

for (const required of [
  '"wk_viewport_integrity_violation"',
  '"focus-scale-shift"',
  '"small-editable-font"',
  '"document-overflow"',
  "window.visualViewport",
]) {
  if (!observer.includes(required)) {
    fail(`observer contract is missing ${required}`);
  }
}

if (!config.includes('name: "webkit-mobile"')) {
  fail("targeted mobile WebKit project is missing");
}

if (!config.includes('devices["iPhone 13"]')) {
  fail("mobile WebKit project lacks iPhone device profile");
}

if (
  !config.includes('testMatch: "**/viewport-integrity.spec.ts"')
) {
  fail("mobile WebKit project is not scoped to viewport integrity");
}

if (
  !workflow.includes(
    "npx playwright install --with-deps chromium webkit",
  )
) {
  fail("critical CI does not install Chromium and WebKit");
}

console.log(
  "PASS: WAKILISHA viewport integrity is structurally enforced.",
);

import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const fail = (message) => {
  console.error(
    `Home delivery audit failed: ${message}`,
  );
  process.exit(1);
};

const index = read("index.html");

const main = read(
  "src/main.tsx",
);

const remixiconCompat = read(
  "src/styles/wakilisha-remixicon-compat.css",
);

const publicDocs = read(
  "src/pages/api-docs/page.tsx",
);

const adminDocs = read(
  "src/pages/admin/api-docs/page.tsx",
);

const publicClient = read(
  "src/services/publicContent/client.ts",
);

const publicRoutes = read("src/router/config.tsx");

const magazine = read(
  "src/pages/magazine/page.tsx",
);

const mobileMagazine = read(
  "src/pages/mobile/magazine/page.tsx",
);

const magazineCard = read(
  "src/pages/magazine/components/MagazineCard.tsx",
);

const magazineFallbackBuilder = read(
  "scripts/seo/build-public-magazine-fallback.mjs",
);

const magazineArticles = read(
  "src/services/magazineArticles.ts",
);

const notificationBell = read(
  "src/components/feature/community/NotificationBell.tsx",
);

const notificationsPage = read(
  "src/pages/notifications/page.tsx",
);

const mobileAppLayout = read(
  "src/components/mobile/MobileAppLayout.tsx",
);

const canonicalNavigation = read(
  "src/components/navigation/wakilishaNavigation.ts",
);

const mobileSidebar = read(
  "src/components/mobile/MobileAccountDrawer.tsx",
);

const mobileCss = read(
  "src/styles/wakilisha-mobile-workbook-v4.css",
);

const appShell = read(
  "src/App.tsx",
);

const adminShell = read(
  "src/pages/admin/AdminShell.tsx",
);

const communityThreadHook = read(
  "src/hooks/useCommunityThread.ts",
);

const trackMomentDrawer = read(
  "src/components/feature/community/TrackMomentDrawer.tsx",
);

const contextAnchorDrawer = read(
  "src/components/feature/community/ContextAnchorCommentDrawer.tsx",
);

const playbackMoments = read(
  "src/components/feature/community/TrackMomentPlaybackOverlay.tsx",
);

const mobileTopBar = read(
  "src/components/mobile/MobileTopBar.tsx",
);

const publicPageCss = read(
  "src/styles/wakilisha-pages-35-46.css",
);

if (index.includes("font-awesome")) {
  fail("Font Awesome still loads globally");
}

if (
  index.includes(
    "redoc.standalone.js",
  )
) {
  fail("Redoc still loads globally");
}

if (
  index.includes(
    "cdnjs.cloudflare.com",
  )
  || index.includes(
    "remixicon.min.css",
  )
) {
  fail(
    "third-party Remixicon/CDN authority still loads globally",
  );
}

if (
  !main.includes(
    'import "./styles/wakilisha-remixicon-compat.css";',
  )
  || !remixiconCompat.includes(
    "Generated WAKILISHA compatibility layer for legacy ri-* callsites.",
  )
  || !remixiconCompat.includes(
    '[class^="ri-"],[class*=" ri-"]',
  )
) {
  fail(
    "legacy ri-* callsites are not owned by the generated WAKILISHA compatibility layer",
  );
}

for (const [name, source] of [
  ["public API docs", publicDocs],
  ["admin API docs", adminDocs],
]) {
  if (
    !source.includes(
      'from "@/lib/redocLoader"',
    )
  ) {
    fail(
      `${name} does not load Redoc on demand`,
    );
  }
}

if (
  !publicClient.includes(
    "listMagazineStories(limit = 500)",
  ) ||
  !publicClient.includes(
    "`/magazine?limit=${safeLimit}`",
  )
) {
  fail(
    "magazine requests do not support a bounded limit",
  );
}

// The actual root route is Magazine on both breakpoints. Old home
// components and their generated-artwork UI are retired, not alternate
// rendering authorities. Preserve the Magazine LCP/priority checks below.
if (
  !publicRoutes.includes(
    '{ path: "/", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> }',
  )
) {
  fail("the real / route must use the accepted responsive Magazine entry");
}
for (const file of [
  "src/pages/home/page.tsx",
  "src/pages/mobile/home/page.tsx",
  "src/pages/home/components/HomeHero.tsx",
  "src/pages/home/components/HomeExplore.tsx",
  "src/pages/home/components/HomeRightNow.tsx",
  "src/pages/home/components/HomeMarquee.tsx",
  "src/pages/home/components/HomeMission.tsx",
  "src/pages/home/components/HomeNav.tsx",
]) {
  if (fs.existsSync(file)) {
    fail("retired unrouted homepage implementation still exists: " + file);
  }
}

if (
  !mobileMagazine.includes(
    "useMagazineArticles(24)",
  )
) {
  fail(
    "the mobile magazine homepage still requests the full archive",
  );
}

for (const [name, source] of [
  ["desktop Magazine", magazine],
  ["mobile Magazine", mobileMagazine],
]) {
  if (
    !source.includes(
      'const status: "loading" | "ready" | "error" =',
    )
    || source.includes(
      "setStatus(",
    )
    || !source.includes(
      'data-wakilisha-magazine-hero="true"',
    )
  ) {
    fail(
      `${name} does not render inline fallback hero authority on the first client render`,
    );
  }
}

for (const marker of [
  'const magazineIndexPath = path.join(',
  'const MAGAZINE_FALLBACK_TIMEOUT_MS = Math.max(',
  'const MAGAZINE_FALLBACK_RETRY_COUNT = Math.max(',
  'await fetchWithTimeout(',
  'data-wakilisha-lcp-preload="magazine"',
  'data-wakilisha-lcp-path="/magazine"',
  "Magazine prerender first-visual authority: inline fallback + route-specific hero preload.",
]) {
  if (
    !magazineFallbackBuilder.includes(
      marker,
    )
  ) {
    fail(
      `Magazine fallback builder is missing ${marker}`,
    );
  }
}

if (
  !magazineArticles.includes(
    "listMagazineArticles(limit = 500)",
  ) ||
  !magazineArticles.includes(
    "listMagazineStories(limit)",
  ) ||
  !magazineArticles.includes(
    "useMagazineArticles(limit = 500)",
  ) ||
  !magazineArticles.includes(
    "listMagazineArticles(limit)",
  )
) {
  fail(
    "the magazine hook does not forward its bounded limit",
  );
}

if (
  !mobileMagazine.includes(
    'aria-labelledby="wk-mobile-magazine-hero-title"',
  )
) {
  fail(
    "mobile magazine hero lacks a visible-title accessible name",
  );
}

// The cover image lives in MobileMagazine; all secondary story images
// live in the shared MagazineCard used by that route. Verify both halves.
if (
  !mobileMagazine.includes(
    'fetchPriority="high"',
  ) ||
  !mobileMagazine.includes(
    'import { MagazineCard } from "@/pages/magazine/components/MagazineCard";',
  ) ||
  !mobileMagazine.includes(
    "<MagazineCard",
  ) ||
  !magazineCard.includes(
    'fetchPriority="low"',
  )
) {
  fail(
    "mobile magazine image priorities are incomplete",
  );
}

if (mobileMagazine.includes("<h4")) {
  fail(
    "mobile magazine still skips heading levels with h4",
  );
}

// The workbook replaces the old text footer with exactly one genuine,
// theme-aware newsletter after all editorial sections. Verify that final
// component uses readable muted text rather than recreating retired UI.
if (
  !mobileMagazine.includes(
    '<MobileNewsletterCTA />',
  )
  || !mobileMagazine.includes(
    'data-wk-magazine-newsletter',
  )
  || !mobileMagazine.includes(
    'text-[13px] text-[var(--wk-text-muted)]',
  )
) {
  fail(
    "mobile magazine final newsletter lacks workbook contrast authority",
  );
}

if (
  !notificationBell.includes(
    'to="/notifications"',
  ) ||
  !notificationBell.includes(
    "aria-label={`Notifications",
  ) ||
  !/<h1[^>]*>\s*Notifications\s*<\/h1>/m.test(
    notificationsPage,
  ) ||
  !mobileSidebar.includes('{ to: "/notifications", icon: "Bell"') ||
  !mobileSidebar.includes("available: signedIn") ||
  !canonicalNavigation.includes('{ label: "Home", to: "/", icon: "Home" }') ||
  !mobileSidebar.includes("visibleWakilishaNavigation") ||
  !mobileSidebar.includes('aria-label="Your WAKILISHA"') ||
  mobileTopBar.includes("<NotificationBell") ||
  !mobileTopBar.includes('aria-label="Open WAKILISHA menu"')
) {
  fail(
    "Notifications destination, visible label, or accessible name is incomplete",
  );
}

if (
  mobileAppLayout.includes("MobileBottomNav") ||
  mobileCss.includes(".phn-nav--compact") ||
  mobileCss.includes(".phn-nav-primary-core") ||
  !mobileAppLayout.includes("<MobileTopBar") ||
  !mobileSidebar.includes('aria-label={browseOpen ? "Browse more" : youOpen ? "You" : "WAKILISHA Menu"}') ||
  !mobileSidebar.includes('aria-label="WAKILISHA places"') ||
  !mobileSidebar.includes('aria-label="More WAKILISHA destinations"') ||
  !mobileSidebar.includes('aria-label="Back to You"')
) {
  fail(
    "Workbook v4 must render one accessible mobile sidebar and no legacy bottom navigation",
  );
}

if (
  appShell.includes(
    "adminDesignSystemLayout.css",
  )
  || !adminShell.includes(
    "adminDesignSystemLayout.css",
  )
) {
  fail(
    "Admin layout CSS is still owned by the anonymous public entry",
  );
}

if (
  !communityThreadHook.includes(
    "getThreadByEntity(",
  )
  || !communityThreadHook.includes(
    "const ensureThread = useCallback",
  )
  || trackMomentDrawer.includes(
    "getOrCreateThread(entity)",
  )
  || contextAnchorDrawer.includes(
    "getOrCreateThread(entity)",
  )
  || playbackMoments.includes(
    "getOrCreateThread",
  )
) {
  fail(
    "ordinary Community reads can still create thread state",
  );
}

for (const [name, sourceText] of [
  ["mobile top bar", mobileTopBar],
  ["mobile app shell", mobileAppLayout],
]) {
  if (
    sourceText.includes("translateZ(0)")
    || sourceText.includes("visibility 0.28s")
  ) {
    fail(
      `${name} still forces a layer or animates visibility`,
    );
  }
}

if (
  !publicPageCss.includes(
    ".reveal-up{opacity:1;transform:none}",
  )
  || publicPageCss.includes(
    ".reveal-up{opacity:0}",
  )
) {
  fail(
    "public reveal motion still owns whether content is painted",
  );
}

console.log(
  "Home delivery audit passed.",
);

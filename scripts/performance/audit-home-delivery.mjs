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

const home = read("src/pages/home/page.tsx");

const mobileHome = read(
  "src/pages/mobile/home/page.tsx",
);

const homeHero = read(
  "src/pages/home/components/HomeHero.tsx",
);

const mobileMagazine = read(
  "src/pages/mobile/magazine/page.tsx",
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

const mobileCss = read(
  "src/styles/wakilisha-mobile-ch53-75.css",
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

if (
  !home.includes(
    "listMagazineStories(24)",
  ) ||
  !mobileHome.includes(
    "listMagazineStories(24)",
  )
) {
  fail(
    "home still requests the full magazine archive",
  );
}

if (
  !homeHero.includes(
    'fetchPriority="high"',
  ) ||
  !homeHero.includes(
    'loading="eager"',
  )
) {
  fail(
    "homepage hero is not prioritized",
  );
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

if (
  !mobileMagazine.includes(
    'fetchPriority="high"',
  ) ||
  !mobileMagazine.includes(
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

if (
  !mobileMagazine.includes(
    'className="mt-2 text-[11px] text-[var(--wk-text-muted)]"',
  )
) {
  fail(
    "mobile magazine footer contrast was not raised",
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
  !mobileAppLayout.includes(
    '{ label: "Notifications", to: "/notifications", icon: "Bell" }',
  )
) {
  fail(
    "Notifications destination, visible label, or accessible name is incomplete",
  );
}

if (
  !mobileCss.includes(
    "color:var(--wk-text-muted);position:relative;",
  )
) {
  fail(
    "inactive mobile navigation still uses faint text",
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
  ["mobile bottom navigation", mobileAppLayout],
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

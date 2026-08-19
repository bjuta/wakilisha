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

if (!index.includes("remixicon")) {
  fail(
    "Remixicon was removed while the application still uses it",
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

console.log(
  "Home delivery audit passed.",
);

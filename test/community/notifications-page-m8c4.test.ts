import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const page = readFileSync(
  "src/pages/notifications/page.tsx",
  "utf8",
);
const bell = readFileSync(
  "src/components/feature/community/NotificationBell.tsx",
  "utf8",
);
const mobile = readFileSync(
  "src/components/mobile/MobileAppLayout.tsx",
  "utf8",
);
const router = readFileSync(
  "src/router/config.tsx",
  "utf8",
);
const lazy = readFileSync(
  "src/router/lazyPublic.tsx",
  "utf8",
);
const settings = readFileSync(
  "src/pages/settings/page.tsx",
  "utf8",
);
const mobileSettings = readFileSync(
  "src/pages/mobile/settings/page.tsx",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/critical-control-plane.yml",
  "utf8",
);

describe(
  "WAKILISHA M8C.4-M3 dedicated Notifications page",
  () => {
    it("gives Notifications a first-class authenticated route", () => {
      expect(lazy).toContain(
        "NotificationsPage",
      );
      expect(router).toContain(
        'path: "/notifications"',
      );
      expect(page).toContain(
        'to="/auth?returnTo=%2Fnotifications"',
      );
    });

    it("uses All and Mentions as the first timeline filters", () => {
      expect(page).toContain(
        '["all", "All"]',
      );
      expect(page).toContain(
        '["mentions", "Mentions"]',
      );
      expect(page).toMatch(
        /notification\.notificationType\s*===\s*"post_mention"/,
      );
    });

    it("keeps unread treatment and read actions on the durable feed", () => {
      expect(page).toContain(
        "markNotificationRead",
      );
      expect(page).toContain(
        "markAllNotificationsRead",
      );
      expect(page).toContain(
        'aria-label="Unread"',
      );
    });

    it("turns the global bell into navigation instead of another modal", () => {
      expect(bell).toContain(
        'to="/notifications"',
      );
      expect(bell).not.toContain(
        "Portal",
      );
      expect(bell).not.toContain(
        "setOpen",
      );
      expect(bell).not.toContain(
        "Full playback is available",
      );
    });

    it("puts Notifications directly in signed-in mobile navigation", () => {
      expect(mobile).toContain(
        '{ label: "Notifications", to: "/notifications", icon: "Bell" }',
      );
      expect(mobile).toContain(
        'to="/artists"',
      );
      expect(mobile).not.toContain(
        "<NotificationBell",
      );
    });

    it("deep-links notification settings to the existing preferences pane", () => {
      expect(page).toContain(
        'to="/settings?section=Notifications"',
      );
      expect(settings).toContain(
        'searchParams.get("section")',
      );
      expect(mobileSettings).toContain(
        'searchParams.get("section")',
      );
    });

    it("protects the Notifications contract in Critical Control Plane", () => {
      expect(workflow).toContain(
        "Enforce dedicated Notifications product UI",
      );
      expect(workflow).toContain(
        "test/community/notifications-page-m8c4.test.ts",
      );
    });

    it("keeps the accepted Notifications empty state and active tab treatment", () => {
      expect(page).toContain(
        "Nothing here yet.",
      );
      expect(page).toContain(
        "No mentions yet.",
      );
      expect(page).toContain(
        "min-h-[calc(100dvh-6rem)]",
      );
      expect(page).toContain(
        "w-14 -translate-x-1/2",
      );
      expect(page).not.toContain(
        "inset-x-[22%]",
      );
      expect(page).not.toContain(
        "Nothing Here Yet",
      );
      expect(page).not.toContain(
        "No Mentions Yet",
      );
    });

    it("keeps new Notifications runtime copy free of sentence-break dashes", () => {
      expect(
        `${page}\n${bell}`,
      ).not.toMatch(
        /[\u2013\u2014]/,
      );
    });
  },
);

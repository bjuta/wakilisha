import { describe, expect, it } from "vitest";
import {
  WAKILISHA_NAVIGATION,
  WAKILISHA_FOOT_LINKS,
  WAKILISHA_MORE_DESTINATIONS,
  visibleWakilishaNavigation,
} from "@/components/navigation/wakilishaNavigation";

const urls = (signedIn: boolean, messagesVisible: boolean) =>
  visibleWakilishaNavigation({ signedIn, messagesVisible })
    .flatMap(group => group.items.map(item => item.to));

describe("Workbook places and private You navigation", () => {
  it("shows eight places to guests, nine to signed-in listeners", () => {
    expect(urls(false, false)).toEqual([
      "/", "/music", "/video", "/audio", "/magazine", "/artists", "/charts", "/credits",
    ]);
    expect(urls(true, false)).toEqual([
      "/", "/following", "/music", "/video", "/audio", "/magazine", "/artists", "/charts", "/credits",
    ]);
    expect(urls(false, true)).toEqual(urls(false, false));
  });

  it("keeps private destinations outside the public places map", () => {
    for (const path of ["/messages", "/notifications", "/settings", "/artist-studio", "/field"]) {
      expect(urls(false, false)).not.toContain(path);
      expect(urls(true, true)).not.toContain(path);
    }
    expect(WAKILISHA_NAVIGATION).toHaveLength(1);
  });

  it("hides signed-out Settings in both sidebar presentations", async () => {
    const { readFileSync } = await import("node:fs");
    const desktop = readFileSync("src/components/music/MusicDesktopShell.tsx", "utf8");
    const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
    expect(desktop).not.toContain('<Link to="/settings"');
    expect(drawer).not.toContain('<Link to="/settings"');
    expect(drawer).toContain('{ to: "/settings", icon: "Settings" as const, label: "Settings", available: signedIn }');
    expect(drawer).toContain('{appearanceControls}');
  });

  it("gives signed-in Browse more its own compact grouped panel instead of expanding the You sidebar", async () => {
    const { readFileSync } = await import("node:fs");
    const drawer = readFileSync("src/components/mobile/MobileAccountDrawer.tsx", "utf8");
    expect(drawer).toContain('aria-label="Browse more"');
    expect(drawer).toContain("setBrowseOpen(true)");
    expect(drawer).toContain('data-wk-browse-more-panel');
    expect(drawer).toContain('aria-label="More WAKILISHA destinations"');
    expect(drawer).toContain('heading: "Music and culture", items: WAKILISHA_MORE_DESTINATIONS');
    expect(drawer).toContain('heading: "About WAKILISHA", items: WAKILISHA_FOOT_LINKS');
    expect(drawer).toContain('grid grid-cols-2 gap-2');
    expect(drawer).toContain('aria-label="Back to You"');
    expect(drawer).toContain("browseTriggerRef.current?.focus()");
    expect(drawer).toContain("aria-current={isWakilishaNavCurrent(location.pathname, item.to)");
    expect(drawer).not.toContain("WkDisclosure");
    expect([...WAKILISHA_MORE_DESTINATIONS, ...WAKILISHA_FOOT_LINKS].map(item => item.to).length).toBe(12);
  });

  it("retains existing secondary destinations and legal links", () => {
    const more = WAKILISHA_MORE_DESTINATIONS.map(item => item.to);
    for (const path of ["/shows", "/releases", "/playlists", "/genres", "/labels", "/guides", "/field"]) {
      expect(more).toContain(path);
    }
    expect(WAKILISHA_FOOT_LINKS.map(item => item.to)).toEqual([
      "/about", "/contact", "/faqs", "/privacy", "/terms",
    ]);
  });
});

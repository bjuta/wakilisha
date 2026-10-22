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

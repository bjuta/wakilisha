import { describe, expect, it } from "vitest";
import {
  WAKILISHA_NAVIGATION,
  visibleWakilishaNavigation,
} from "@/components/navigation/wakilishaNavigation";

const urls = (signedIn: boolean, messagesVisible: boolean) =>
  visibleWakilishaNavigation({ signedIn, messagesVisible })
    .flatMap((group) => group.items.map((item) => item.to));

describe("WAKILISHA viewer-specific navigation", () => {
  it("hides private destinations from anonymous visitors on both shells", () => {
    const guest = urls(false, false);
    expect(guest).toContain("/magazine");
    expect(guest).toContain("/artists");
    expect(guest).toContain("/following");
    expect(guest).not.toContain("/messages");
    expect(guest).not.toContain("/notifications");
    // Never trust a stale access state if the viewer has signed out.
    expect(urls(false, true)).toEqual(guest);
  });

  it("only advertises Messages after granted viewer access", () => {
    const signedInWithoutAccess = urls(true, false);
    expect(signedInWithoutAccess).toContain("/notifications");
    expect(signedInWithoutAccess).not.toContain("/messages");

    const eligible = urls(true, true);
    expect(eligible).toContain("/notifications");
    expect(eligible).toContain("/messages");
  });

  it("keeps the canonical route order and does not mutate the shared map", () => {
    const before = WAKILISHA_NAVIGATION.flatMap((group) => group.items.map((item) => item.to));
    urls(false, false);
    urls(true, true);
    const after = WAKILISHA_NAVIGATION.flatMap((group) => group.items.map((item) => item.to));
    expect(after).toEqual(before);
  });
});

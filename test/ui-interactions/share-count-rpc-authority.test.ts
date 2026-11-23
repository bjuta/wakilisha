import { beforeEach, describe, expect, it, vi } from "vitest";
import { incrementShareCount } from "@/services/shareTracking";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

describe("share counts must reflect persisted RPC acknowledgement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the existing four-parameter RPC for Instagram and returns the authoritative count", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 12, error: null } as never);
    const count = await incrementShareCount(
      "https://wakilisha.africa/magazine/album-review-alusa-continua?utm_source=ig",
      "instagram_story", "album-review-alusa-continua", "Album Review: Alusa Continua",
    );
    expect(count).toBe(12);
    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("increment_share_count", {
      p_page_url: "https://wakilisha.africa/magazine/album-review-alusa-continua",
      p_platform: "instagram_story",
      p_article_slug: "album-review-alusa-continua",
      p_article_title: "Album Review: Alusa Continua",
    });
  });

  it("rejects an unsupported platform response rather than inventing a local share", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null, error: { message: "Invalid share event" },
    } as never);
    await expect(incrementShareCount(
      "https://wakilisha.africa/magazine/not-a-posted-story",
      "instagram_story", "not-a-posted-story", "Story",
    )).rejects.toThrow("Invalid share event");
  });

  it("rejects a malformed successful response rather than showing zero or a fake increment", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    await expect(incrementShareCount(
      "https://wakilisha.africa/magazine/invalid-rpc-return",
      "instagram_story", "invalid-rpc-return", "Story",
    )).rejects.toThrow("Share count response was invalid");
  });
});

// @vitest-environment jsdom
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SharePopover, ShareSheet, canShareArticleStory, sharePlatformsForItem, type ShareObject } from "@/components/design-system/share/ShareSheet";
import { renderArticleStoryImage } from "@/components/design-system/share/articleStoryImage";
import { incrementShareCount } from "@/services/shareTracking";

vi.mock("@/components/base/Portal", () => ({
  Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/services/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/services/shareTracking", () => ({
  getShareCounts: vi.fn().mockResolvedValue({}),
  getTotalShareCount: vi.fn().mockReturnValue(0),
  incrementShareCount: vi.fn().mockResolvedValue(1),
}));
vi.mock("@/components/design-system/share/articleStoryImage", () => ({
  renderArticleStoryImage: vi.fn().mockResolvedValue(new Blob(["jpeg-data"], { type: "image/jpeg" })),
}));

const article: ShareObject = {
  type: "article",
  title: "Album Review: Alusa Continua",
  subtitle: "Hafare Segelan",
  url: "https://wakilisha.africa/magazine/album-review-alusa-continua",
  imageUrl: "https://media.wakilisha.africa/uploads/alusa.webp",
  publishedSnapshotId: "cfbcb1a2-f9e7-4d6c-8db9-aa0b2ffed343",
  articleStory: { author: "Hafare Segelan", section: "Album Reviews", readingTime: 6 },
};

describe("unified sharing destination grid for Instagram Story", () => {
  const createUrl = vi.fn(() => "blob:wakilisha-story-test");
  const revokeUrl = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
  });
  afterEach(() => cleanup());

  it("shows Instagram only for eligible published Articles, never draft previews or other content", () => {
    expect(canShareArticleStory(article)).toBe(true);
    expect(sharePlatformsForItem(article).map((p) => p.key))
      .toEqual(["copy", "instagram_story", "x", "whatsapp", "facebook", "telegram", "linkedin", "reddit", "pinterest", "email"]);
    const missingSnapshot = { ...article, publishedSnapshotId: null };
    expect(canShareArticleStory(missingSnapshot)).toBe(false);
    expect(sharePlatformsForItem(missingSnapshot).some((p) => p.key === "instagram_story")).toBe(false);
    expect(canShareArticleStory({ ...article, type: "track" })).toBe(false);
    expect(canShareArticleStory({ ...article, articleStory: null })).toBe(false);
    expect(canShareArticleStory({ ...article, articleStory: { ...article.articleStory!, readingTime: 0 } })).toBe(false);
  });

  it("opens a native Story detail from the same mobile share grid and returns without a separate banner", async () => {
    const { rerender } = render(<ShareSheet item={article} open onClose={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Instagram Story" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Instagram Story" }).querySelector("svg path")).toBeTruthy();
    expect(screen.queryByText("Share Image")).toBeNull();
    expect(renderArticleStoryImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    expect(screen.queryByRole("button", { name: "Instagram Story" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to share options" })).toBeTruthy();
    // Exactly as for X/WhatsApp, choosing a destination starts the count
    // while the browser is still foregrounded, before any OS handoff.
    expect(incrementShareCount).toHaveBeenCalledExactlyOnceWith(
      article.url, "instagram_story", "album-review-alusa-continua", article.title,
    );

    await screen.findByRole("button", { name: "Share Image" });
    expect(renderArticleStoryImage).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Save Image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy Article Link" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to share options" }));
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith("blob:wakilisha-story-test"));
    expect(screen.getByRole("button", { name: "Instagram Story" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    rerender(<ShareSheet item={article} open={false} onClose={vi.fn()} />);
    rerender(<ShareSheet item={article} open onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Instagram Story" })).toBeTruthy();
  });

  it("sends the persisted count BEFORE iOS native sharing can suspend the page, without counting twice", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
    render(<ShareSheet item={article} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    expect(incrementShareCount).toHaveBeenCalledExactlyOnceWith(
      article.url, "instagram_story", "album-review-alusa-continua", article.title,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Share Image" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(vi.mocked(incrementShareCount).mock.invocationCallOrder[0])
      .toBeLessThan(share.mock.invocationCallOrder[0]);
    expect(incrementShareCount).toHaveBeenCalledTimes(1);
  });


  it("records a Story image save in the same persisted Instagram counter and shows it back in the grid", async () => {
    const save = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      render(<ShareSheet item={article} open onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
      expect(incrementShareCount).toHaveBeenCalledExactlyOnceWith(
        article.url, "instagram_story", "album-review-alusa-continua", article.title,
      );
      fireEvent.click(await screen.findByRole("button", { name: "Save Image" }));
      expect(save).toHaveBeenCalledOnce();
      // The Save Image action must not double-count the already recorded
      // share intent or depend on a request after iOS starts downloading.
      expect(incrementShareCount).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "Back to share options" }));
      const destination = screen.getByRole("button", { name: "Instagram Story" });
      await waitFor(() => expect(destination.querySelector(".share-grid-badge")?.textContent).toBe("1"));
    } finally {
      save.mockRestore();
    }
  });

  it("counts once on selecting Instagram, not again on link copy or cancelling the OS chooser", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("User cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboardWrite } });

    render(<ShareSheet item={article} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    expect(incrementShareCount).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole("button", { name: "Copy Article Link" }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledOnce());
    expect(incrementShareCount).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Share Image" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(incrementShareCount).toHaveBeenCalledTimes(1);
  });


  it("shows a visible count error rather than masking a failed RPC on the Instagram detail", async () => {
    vi.mocked(incrementShareCount).mockRejectedValueOnce(new Error("Network interrupted"));
    render(<ShareSheet item={article} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    expect(incrementShareCount).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("We couldn't update the share count. You can still share the image.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Save Image" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to share options" }));
    expect(screen.queryByText("We couldn't update the share count. You can still share the image.")).toBeNull();
  });

  it("keeps the same early Instagram count in the desktop popover", async () => {
    const triggerRef = { current: document.createElement("button") };
    render(<SharePopover item={article} open onClose={vi.fn()} triggerRef={triggerRef} />);
    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    expect(incrementShareCount).toHaveBeenCalledExactlyOnceWith(
      article.url, "instagram_story", "album-review-alusa-continua", article.title,
    );
    await screen.findByRole("button", { name: "Save Image" });
    fireEvent.click(screen.getByRole("button", { name: "Back to share options" }));
    expect(incrementShareCount).toHaveBeenCalledTimes(1);
  });

  it("covers the exact original database allowlist and never weakens other share validation", () => {
    const original = readFileSync("supabase/migrations/20261113203121_public_registry_rpc_community_write_security_20261113.sql", "utf8");
    const repair = readFileSync("supabase/migrations/20261123062500_share_instagram_story_platform_v1.sql", "utf8");
    const name = "CREATE OR REPLACE FUNCTION public.increment_share_count(p_page_url text, p_platform text, p_article_slug text DEFAULT NULL::text, p_article_title text DEFAULT NULL::text)";
    const def = (sql: string) => {
      const start = sql.indexOf(name);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = sql.indexOf("\n$function$;", start);
      expect(end).toBeGreaterThan(start);
      return sql.slice(start, end + "\n$function$;".length);
    };
    const oldAllow = "p_platform NOT IN ('copy','x','whatsapp','facebook','telegram','linkedin','reddit','pinterest','messenger','email')";
    const newAllow = "p_platform NOT IN ('copy','instagram_story','x','whatsapp','facebook','telegram','linkedin','reddit','pinterest','messenger','email')";
    expect(def(original).split(oldAllow)).toHaveLength(2);
    expect(def(repair)).toBe(def(original).replace(oldAllow, newAllow));
    expect(repair).toContain("b4224a4d955f79a41f3be148f81be669");
    expect(repair).toContain("STOP: share counter authority drift");
    expect(repair).toContain("STOP: share counter security definer or search path changed");
    expect(repair.match(/CREATE OR REPLACE FUNCTION /g)).toHaveLength(1);
    expect(repair).not.toContain("DROP FUNCTION");
    expect(repair).not.toContain("GRANT EXECUTE");
    expect(repair).not.toContain("UPDATE public.share_counts");
  });

  it("uses the same grid destination and reversible detail in the desktop popover", async () => {
    const triggerRef = { current: document.createElement("button") };
    render(<SharePopover item={article} open onClose={vi.fn()} triggerRef={triggerRef} />);
    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    await screen.findByRole("button", { name: "Share Image" });
    fireEvent.click(screen.getByRole("button", { name: "Back to share options" }));
    expect(screen.getByRole("button", { name: "Instagram Story" })).toBeTruthy();
  });
});

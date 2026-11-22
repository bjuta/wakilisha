// @vitest-environment jsdom
import type { ReactNode } from "react";
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
    expect(incrementShareCount).not.toHaveBeenCalled();

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

  it("counts only a completed native image handoff, never simply opening Instagram", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
    render(<ShareSheet item={article} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Instagram Story" }));
    expect(incrementShareCount).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Share Image" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    await waitFor(() => expect(incrementShareCount).toHaveBeenCalledWith(
      article.url, "instagram_story", "album-review-alusa-continua", article.title,
    ));
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

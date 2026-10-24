// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResponsiveAppLayout } from "@/components/mobile/ResponsiveAppLayout";

const state = vi.hoisted(() => ({ mobile: true, open: false }));

vi.mock("@/context/PlayerContext", () => ({
  usePlayer: () => ({ isFullPlayerOpen: state.open, closeFullPlayer: () => { state.open = false; } }),
}));
vi.mock("@/hooks/useMobileDetect", () => ({
  useMobileDetect: () => state.mobile,
}));
vi.mock("@/components/auth/RegistryOnboardingGate", () => ({
  RegistryOnboardingGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/mobile/MobileAppLayout", () => ({
  MobileAppLayout: () => <main><input aria-label="Retained mobile page input" data-testid="mobile-route" /></main>,
}));
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: () => (
    <div className="wk-music-app-shell">
      <aside aria-label="Persistent desktop sidebar" />
      <main><input aria-label="Retained desktop page input" data-testid="desktop-route" /></main>
    </div>
  ),
}));
vi.mock("@/components/design-system/player/PlayerCompactSurface", () => ({
  PlayerCompactSurface: () => state.open ? null : <div data-testid="mini-player" />,
}));
vi.mock("@/components/design-system/player/PlayerFullSurface", () => ({
  PlayerFullSurface: ({ mode }: { mode: string }) => <div data-testid={`full-${mode}`}>Now Playing</div>,
}));

beforeAll(() => {
  class Observation {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", Observation);
});
beforeEach(() => {
  state.mobile = true;
  state.open = false;
});

describe("WAKILISHA player presentation lifecycle", () => {
  it("portals Now Playing outside the article and restores the document scroll state", async () => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousOverscroll = root.style.overscrollBehaviorY;
    root.style.overflow = "scroll";
    root.style.overscrollBehaviorY = "auto";
    root.scrollTop = 720;
    const { rerender, unmount } = render(<ResponsiveAppLayout />);
    const article = screen.getByTestId("mobile-route");

    state.open = true;
    rerender(<ResponsiveAppLayout />);
    await screen.findByTestId("full-mobile");
    const overlay = screen.getByRole("region", { name: "Now Playing" });
    expect(overlay).toHaveAttribute("data-wk-player-overlay");
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.className).toContain("overflow-y-auto");
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.overscrollBehaviorY).toBe("none");
    expect(root.scrollTop).toBe(720);
    expect(screen.getByTestId("mobile-route")).toBe(article);

    state.open = false;
    rerender(<ResponsiveAppLayout />);
    expect(screen.queryByRole("region", { name: "Now Playing" })).not.toBeInTheDocument();
    expect(root.style.overflow).toBe("scroll");
    expect(root.style.overscrollBehaviorY).toBe("auto");
    expect(root.scrollTop).toBe(720);
    unmount();
    root.style.overflow = previousOverflow;
    root.style.overscrollBehaviorY = previousOverscroll;
  });

  it("keeps mobile route DOM and local input state through repeated mini/full switches", async () => {
    const { rerender } = render(<ResponsiveAppLayout />);
    const pageInput = screen.getByTestId("mobile-route") as HTMLInputElement;
    fireEvent.change(pageInput, { target: { value: "Keep this page" } });

    state.open = true;
    rerender(<ResponsiveAppLayout />);
    await screen.findByTestId("full-mobile");
    expect(screen.getByTestId("mobile-route")).toBe(pageInput);
    expect(pageInput).toHaveValue("Keep this page");
    expect(screen.queryByTestId("mini-player")).not.toBeInTheDocument();

    state.open = false;
    rerender(<ResponsiveAppLayout />);
    expect(screen.queryByTestId("full-mobile")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-route")).toBe(pageInput);
    expect(pageInput).toHaveValue("Keep this page");

    state.open = true;
    rerender(<ResponsiveAppLayout />);
    await screen.findByTestId("full-mobile");
    expect(screen.getByTestId("mobile-route")).toBe(pageInput);
  });

  it("preserves the desktop sidebar and active route while Now Playing opens", async () => {
    state.mobile = false;
    const { rerender } = render(<ResponsiveAppLayout />);
    const pageInput = screen.getByTestId("desktop-route") as HTMLInputElement;
    fireEvent.change(pageInput, { target: { value: "No route remount" } });

    state.open = true;
    rerender(<ResponsiveAppLayout />);
    await screen.findByTestId("full-desktop");
    expect(screen.getByLabelText("Persistent desktop sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-route")).toBe(pageInput);

    state.open = false;
    rerender(<ResponsiveAppLayout />);
    expect(pageInput).toHaveValue("No route remount");
    expect(screen.getByTestId("desktop-route")).toBe(pageInput);
  });
});

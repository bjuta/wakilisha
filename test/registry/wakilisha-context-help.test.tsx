// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { WkContextHelp } from "../../src/components/design-system/primitives/ContextHelp";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function HelpFixture() {
  return <WkContextHelp label="How Decisions Work" title="Recording a Decision">
    A review decision does not change a canonical Track.
  </WkContextHelp>;
}

describe("WAKILISHA contextual help", () => {
  it("keeps general guidance hidden until activated and closes with the explicit action", () => {
    render(<HelpFixture />);
    const trigger = screen.getByRole("button", { name: "How Decisions Work" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/does not change a canonical Track/)).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Recording a Decision" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close help" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses with Escape and restores keyboard focus", () => {
    render(<HelpFixture />);
    const trigger = screen.getByRole("button", { name: "How Decisions Work" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Recording a Decision" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses when the operator clicks outside", () => {
    render(<div><HelpFixture /><button type="button">Outside</button></div>);
    fireEvent.click(screen.getByRole("button", { name: "How Decisions Work" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("region", { name: "Recording a Decision" })).toBeNull();
  });

  it("portals mobile help next to its trigger and flips ABOVE a low trigger", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 640 });
    let triggerTop = 540;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("wk-context-help-trigger")) {
        return { top: triggerTop, bottom: triggerTop + 40, left: 230, right: 370,
          width: 140, height: 40, x: 230, y: triggerTop, toJSON: () => ({}) } as DOMRect;
      }
      return { top: 0, bottom: 180, left: 0, right: 320,
        width: 320, height: 180, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });

    render(<HelpFixture />);
    const trigger = screen.getByRole("button", { name: "How Decisions Work" });
    fireEvent.click(trigger);
    const panel = screen.getByRole("region", { name: "Recording a Decision" });
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.top).toBe("352px");
    expect(panel.style.left).toBe("56px");
    expect(panel.style.bottom).toBe("auto");
    expect(panel.style.visibility).toBe("visible");

    // Scrolling changes the trigger's viewport coordinates; the note tracks it.
    triggerTop = 90;
    fireEvent.scroll(window);
    expect(panel.style.top).toBe("138px");
    fireEvent.pointerDown(panel);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes portalled help when clicking outside, never when clicking its own panel", () => {
    render(<div><HelpFixture /><button type="button">Outside</button></div>);
    const trigger = screen.getByRole("button", { name: "How Decisions Work" });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("region", { name: "Recording a Decision" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("region", { name: "Recording a Decision" })).toBeNull();
  });

  it("keeps source values, conflict reasons and governed restrictions persistently visible", () => {
    const queue = readFileSync("src/pages/admin/review/queue/page.tsx", "utf8");
    const cores = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    const brief = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const roots = readFileSync("src/pages/admin/review/mizizi/MiziziReviewRoots.tsx", "utf8");
    expect(queue).toContain("Current Release Slug");
    expect(queue).toContain("Proposed Release Slug (Not Approved)");
    expect(queue).toContain("Recorded Conflict Reasons");
    expect(queue).toContain("This review stays open. The generic decision form cannot resolve it.");
    expect(queue).toContain('label="How Decisions Work"');
    expect(queue).toContain('label="About This Group"');
    expect(brief).toContain('label="How Focused Reviews Work"');
    expect(roots).toContain('label="About the Roots"');
    expect(cores).toContain('label="About This Status"');
    expect(cores).toContain("exactDecision.summary");
    expect(queue).not.toContain("wk-review-desk-metric-note");
  });
});

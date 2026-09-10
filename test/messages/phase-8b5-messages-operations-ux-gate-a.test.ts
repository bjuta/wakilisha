import fs from "node:fs";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  "src/pages/admin/messages/page.tsx",
  "utf8",
);
const shell = fs.readFileSync(
  "src/pages/admin/messages/MessagesOperationsShell.tsx",
  "utf8",
);
const searchable = fs.readFileSync(
  "src/components/design-system/primitives/SearchableSelect.tsx",
  "utf8",
);
const dateTime = fs.readFileSync(
  "src/components/design-system/primitives/DateTimePicker.tsx",
  "utf8",
);
const workflow = fs.readFileSync(
  "src/components/design-system/primitives/WorkflowRail.tsx",
  "utf8",
);
const commandSheet = fs.readFileSync(
  "src/components/design-system/primitives/CommandSheet.tsx",
  "utf8",
);

describe("Phase 8B.5 Messages Operations UX Gate A", () => {
  it("establishes the accepted seven-workspace Messages Operations shell", () => {
    for (const label of [
      "Overview",
      "Conversations",
      "Safety",
      "Legal",
      "Agents",
      "System Actors",
      "Controls",
    ]) {
      expect(shell).toContain(`label: "${label}"`);
    }

    expect(shell).toContain('role="tablist"');
    expect(shell).toContain('role="tabpanel"');
    expect(page).toContain("<MessagesOperationsShell");
  });

  it("moves Safety and Legal out of the permanently stacked page", () => {
    expect(page).toContain(
      'workspace === "safety" ? <MessagesSafetyPanel /> : null',
    );
    expect(page).toContain(
      'workspace === "legal" ? <MessagesLegalPanel /> : null',
    );
    expect(page).not.toContain(
      "\n      <MessagesSafetyPanel />\n      <MessagesLegalPanel />",
    );
  });

  it("moves Runtime Audience and Private Content Boundary into Controls", () => {
    expect(page).toContain('workspace === "controls"');
    expect(page).toContain("Runtime audience");
    expect(page).toContain("Private-content boundary");

    const overviewStart = page.indexOf('workspace === "overview"');
    const conversationsStart = page.indexOf('workspace === "conversations"');
    const overviewBlock = page.slice(overviewStart, conversationsStart);

    expect(overviewBlock).not.toContain("Runtime audience");
    expect(overviewBlock).not.toContain("Private-content boundary");
  });

  it("moves System Actors into their own workspace", () => {
    expect(page).toContain('workspace === "system-actors"');
    expect(page).toContain("System Actors in Messages");
  });

  it("keeps Agent Reviews & Updates as a bounded workspace without fake authority", () => {
    expect(page).toContain('workspace === "agents"');
    expect(page).toContain("Agent Reviews &amp; Updates");
    expect(page).toContain("Gate A adds no parallel agent authority or fake queue data.");
  });

  it("makes the shared searchable picker generic and keyboard-addressable", () => {
    expect(searchable).toContain('emptyLabel = "No options found"');
    expect(searchable).not.toContain("No countries found");
    expect(searchable).toContain('role="combobox"');
    expect(searchable).toContain('role="listbox"');
    expect(searchable).toContain("aria-activedescendant");
    expect(searchable).toContain('event.key === "ArrowDown"');
    expect(searchable).toContain('event.key === "ArrowUp"');
    expect(searchable).toContain('event.key === "Enter"');
    expect(searchable).toContain('event.key === "Escape"');
  });

  it("provides a WAKILISHA-owned date-time picker with no native date chrome", () => {
    expect(dateTime).toContain("WkDateTimePicker");
    expect(dateTime).toContain("SearchableSelect");
    expect(dateTime).not.toContain('type="date"');
    expect(dateTime).not.toContain('type="time"');
    expect(dateTime).not.toContain('type="datetime-local"');
  });

  it("provides reusable governed workflow and command primitives", () => {
    expect(workflow).toContain("WkWorkflowRail");
    expect(workflow).toContain('aria-current={step.state === "current" ? "step" : undefined}');
    expect(commandSheet).toContain("WkCommandSheet");
    expect(commandSheet).toContain('<Sheet open={open} onClose={onClose} title={title} side="right">');
  });

  it("does not introduce native selection/date chrome into Gate A surfaces", () => {
    const gateASurface = `${page}\n${shell}\n${dateTime}\n${workflow}\n${commandSheet}`;
    expect(gateASurface).not.toMatch(/<select\b/);
    expect(gateASurface).not.toContain('type="datetime-local"');
    expect(gateASurface).not.toContain('type="date"');
    expect(gateASurface).not.toContain('type="time"');
  });
});

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
const tabs = fs.readFileSync(
  "src/components/design-system/primitives/Tabs.tsx",
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
const sheet = fs.readFileSync(
  "src/components/design-system/primitives/Sheet.tsx",
  "utf8",
);
const controlsWorkspace = fs.readFileSync(
  "src/pages/admin/messages/MessagesControlsWorkspace.tsx",
  "utf8",
);
const systemActorsWorkspace = fs.readFileSync(
  "src/pages/admin/messages/MessagesSystemActorsWorkspace.tsx",
  "utf8",
);
const agentsWorkspace = fs.readFileSync(
  "src/pages/admin/messages/MessagesAgentsWorkspace.tsx",
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

    expect(shell).toContain("WkTabs");
    expect(shell).not.toContain("tabRefs");
    expect(shell).not.toContain("handleTabKeyDown");
    expect(tabs).toContain("AriaTabs");
    expect(tabs).toContain("TabList");
    expect(tabs).toContain("TabPanels");
    expect(tabs).toContain("TabPanel");
    expect(tabs).toContain('keyboardActivation="automatic"');
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
    expect(page).toContain("<MessagesControlsWorkspace status={status} />");
    expect(controlsWorkspace).toContain("Runtime Audience");
    expect(controlsWorkspace).toContain("Private Content Boundary");

    const overviewStart = page.indexOf('workspace === "overview"');
    const conversationsStart = page.indexOf('workspace === "conversations"');
    const overviewBlock = page.slice(overviewStart, conversationsStart);

    expect(overviewBlock).not.toContain("Runtime Audience");
    expect(overviewBlock).not.toContain("Private Content Boundary");
  });

  it("moves System Actors into their own workspace", () => {
    expect(page).toContain('workspace === "system-actors"');
    expect(page).toContain("<MessagesSystemActorsWorkspace");
    expect(systemActorsWorkspace).toContain("System Actors");
    expect(systemActorsWorkspace).toContain("Messages participation");
  });

  it("keeps Agent Reviews & Updates as a bounded workspace without fake authority", () => {
    expect(page).toContain('workspace === "agents"');
    expect(page).toContain("<MessagesAgentsWorkspace />");
    expect(agentsWorkspace).toContain("Agent Reviews &amp; Updates");
    expect(agentsWorkspace).toContain("without fabricating queue counts");
    expect(agentsWorkspace).toContain("Existing domain-specific review authorities remain canonical.");
  });

  it("makes the shared searchable picker generic and headless-behavior owned", () => {
    expect(searchable).toContain('emptyLabel = "No options found"');
    expect(searchable).not.toContain("No countries found");
    expect(searchable).toContain("ComboBox");
    expect(searchable).toContain("Input");
    expect(searchable).toContain("Popover");
    expect(searchable).toContain("ListBox");
    expect(searchable).toContain("ListBoxItem");
    expect(searchable).toContain('menuTrigger="focus"');
    expect(searchable).toContain("shouldFocusWrap");
    expect(searchable).toContain("allowsEmptyCollection");
    expect(searchable).toContain("disabledKeys={disabledKeys}");
    expect(searchable).toContain("selectedKey={value || null}");
    expect(searchable).toContain("onSelectionChange={(nextValue) =>");
    expect(searchable).toContain(
      "bg-wk-brand-soft text-wk-text ring-2 ring-inset ring-wk-brand",
    );
    expect(searchable).not.toContain("document.addEventListener");
    expect(searchable).not.toContain("activeIndex");
    expect(searchable).not.toContain("moveActive");
    expect(searchable).not.toContain("onKeyDownCapture");
    expect(searchable).not.toContain("triggerRef.current?.focus()");
  });

  it("provides a WAKILISHA-owned date-time picker with no native date chrome", () => {
    expect(dateTime).toContain("WkDateTimePicker");
    expect(dateTime).toContain("SearchableSelect");
    expect(dateTime).not.toContain('type="date"');
    expect(dateTime).not.toContain('type="time"');
    expect(dateTime).not.toContain('type="datetime-local"');
  });

  it("provides reusable governed workflow and visible command primitives", () => {
    expect(workflow).toContain("WkWorkflowRail");
    expect(workflow).toContain('aria-current={step.state === "current" ? "step" : undefined}');
    expect(commandSheet).toContain("WkCommandSheet");
    expect(commandSheet).toContain('<Sheet open={open} onClose={onClose} title={title} side="right">');

    expect(sheet).toContain("ModalOverlay");
    expect(sheet).toContain("<Modal");
    expect(sheet).toContain("<Dialog");
    expect(sheet).toContain("isDismissable");
    expect(sheet).toContain('slot="close"');
    expect(sheet).toContain('"items-end justify-center"');
    expect(sheet).toContain('"items-stretch justify-end"');
    expect(sheet).toContain(
      '"h-full w-full max-w-sm overflow-y-auto',
    );
    expect(sheet).not.toContain("document.addEventListener");
    expect(sheet).not.toContain("previousFocusRef");
    expect(sheet).not.toContain("querySelectorAll<HTMLElement>");
    expect(sheet).not.toContain("nestedPopupOpen");
    expect(sheet).not.toContain("<Portal>");
  });

  it("keeps Gate E keyboard focus owned by canonical headless primitives", () => {
    expect(tabs).toContain('keyboardActivation="automatic"');
    expect(searchable).toContain("<ComboBox");
    expect(searchable).toContain("<Popover");
    expect(sheet).toContain("<ModalOverlay");
    expect(sheet).toContain("<Dialog");
    expect(shell).not.toContain("handleTabKeyDown");
    expect(searchable).not.toContain("handlePickerKeyDown");
    expect(sheet).not.toContain("handleKey");
  });

  it("does not introduce native selection/date chrome into Gate A surfaces", () => {
    const gateASurface = `${page}\n${shell}\n${tabs}\n${dateTime}\n${workflow}\n${commandSheet}\n${sheet}`;
    expect(gateASurface).not.toMatch(/<select\b/);
    expect(gateASurface).not.toContain('type="datetime-local"');
    expect(gateASurface).not.toContain('type="date"');
    expect(gateASurface).not.toContain('type="time"');
  });
});

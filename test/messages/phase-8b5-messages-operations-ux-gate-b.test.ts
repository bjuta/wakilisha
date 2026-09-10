import fs from "node:fs";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  "src/pages/admin/messages/page.tsx",
  "utf8",
);
const entityPicker = fs.readFileSync(
  "src/components/design-system/primitives/EntityPicker.tsx",
  "utf8",
);
const inspector = fs.readFileSync(
  "src/components/design-system/primitives/Inspector.tsx",
  "utf8",
);
const auditTimeline = fs.readFileSync(
  "src/components/design-system/primitives/AuditTimeline.tsx",
  "utf8",
);
const stateBadge = fs.readFileSync(
  "src/components/design-system/primitives/StateBadge.tsx",
  "utf8",
);
const toggle = fs.readFileSync(
  "src/components/design-system/primitives/WakilishaToggle.tsx",
  "utf8",
);
const actors = fs.readFileSync(
  "src/pages/admin/messages/MessagesSystemActorsWorkspace.tsx",
  "utf8",
);
const controls = fs.readFileSync(
  "src/pages/admin/messages/MessagesControlsWorkspace.tsx",
  "utf8",
);
const agents = fs.readFileSync(
  "src/pages/admin/messages/MessagesAgentsWorkspace.tsx",
  "utf8",
);

describe("Phase 8B.5 Messages Operations UX Gate B", () => {
  it("provides the missing shared picker, inspection, audit, and state primitives", () => {
    expect(entityPicker).toContain("WkEntityPicker");
    expect(entityPicker).toContain("SearchableSelect");
    expect(inspector).toContain("WkInspector");
    expect(inspector).toContain('advancedLabel = "Advanced detail"');
    expect(auditTimeline).toContain("WkAuditTimeline");
    expect(stateBadge).toContain("WkStateBadge");
  });

  it("makes the visible toggle a semantic WAKILISHA switch", () => {
    expect(toggle).toContain('role="switch"');
    expect(toggle).toContain("aria-checked={value}");
    expect(toggle).toContain("ariaLabel");
  });

  it("turns System Actors into a list-detail workspace", () => {
    expect(actors).toContain("Actor roster");
    expect(actors).toContain("Messages participation");
    expect(actors).toContain("Permitted purposes");
    expect(actors).toContain("Recipient scope");
    expect(actors).toContain("Human reply policy");
    expect(actors).toContain("Latest Messages activity");
    expect(actors).toContain("<WakilishaToggle");
    expect(actors).toContain("Domain authority is unchanged");
  });

  it("keeps Runtime Audience and Private Content Boundary inside Controls", () => {
    expect(controls).toContain("Runtime Audience");
    expect(controls).toContain("Private Content Boundary");
    expect(controls).toContain("Super Administration");
    expect(controls).toContain("Gate B does not invent a new audience writer.");
    expect(page).toContain("<MessagesControlsWorkspace status={status} />");
  });

  it("keeps Agents distinct without fabricating a unified queue", () => {
    expect(agents).toContain("Agent Reviews &amp; Updates");
    expect(agents).toContain("Reviews & approvals");
    expect(agents).toContain("Updates");
    expect(agents).toContain("Escalations");
    expect(agents).toContain("Failures");
    expect(agents).toContain("without fabricating queue counts");
    expect(page).toContain("<MessagesAgentsWorkspace />");
  });

  it("removes inline System Actor and Controls implementation from the page", () => {
    expect(page).toContain("<MessagesSystemActorsWorkspace");
    expect(page).toContain("<MessagesControlsWorkspace");
    expect(page).not.toContain("System Actors in Messages");
    expect(page).not.toContain("Runtime audience");
    expect(page).not.toContain("Private-content boundary");
  });

  it("does not introduce native browser selection/date chrome", () => {
    const gateB = [
      page,
      entityPicker,
      inspector,
      auditTimeline,
      actors,
      controls,
      agents,
    ].join("\n");

    expect(gateB).not.toMatch(/<select\b/);
    expect(gateB).not.toContain('type="date"');
    expect(gateB).not.toContain('type="time"');
    expect(gateB).not.toContain('type="datetime-local"');
  });

  it("keeps private content as an authority concept rather than ambient data", () => {
    expect(controls).toContain("safe metadata only");
    expect(controls).toContain("purpose-audited inspection");
    expect(controls).toContain(
      "Super Admin access does not create ambient Conversation content access.",
    );
  });
});

import fs from "node:fs";
import { describe, expect, it } from "vitest";

const panel = fs.readFileSync(
  "src/pages/admin/messages/MessagesLegalPanel.tsx",
  "utf8",
);
const service = fs.readFileSync(
  "src/services/messages.ts",
  "utf8",
);
const authority = fs.readFileSync(
  "docs/engineering/messages-operations-ux-gate-c-picker-read-authority.md",
  "utf8",
);

describe("Phase 8B.5 Messages Operations UX Gate C Legal workbench", () => {
  it("projects the accepted Request-to-Closure workflow from backend state", () => {
    for (const stage of [
      "Request",
      "Review",
      "Scope",
      "Evidence",
      "Disclosure",
      "Approval",
      "Generation",
      "Release",
      "Delivery",
      "Closure",
    ]) {
      expect(authority).toContain(stage);
      expect(panel).toContain(`label: "${stage}"`);
    }

    expect(panel).toContain("<WkWorkflowRail");
    expect(panel).toContain("Next governed action");
    expect(panel).toContain("buildWorkflowSteps");
    expect(panel).toContain("nextGovernedAction");
  });

  it("uses only the two accepted case-bound discovery RPCs", () => {
    expect(service).toContain(
      "export async function searchMessagesLegalScopeTargets(",
    );
    expect(service).toContain(
      '"search_messages_legal_scope_targets_v1"',
    );
    expect(service).toContain(
      "export async function searchMessagesLegalReviewers(",
    );
    expect(service).toContain(
      '"search_messages_legal_reviewers_v1"',
    );
    expect(service).toContain("p_case_id: caseId");
    expect(service).toContain(
      "p_limit: Math.min(Math.max(limit, 1), 20)",
    );
    expect(service).toContain(
      "if (normalizedQuery.length < 3) return [];",
    );
    expect(service).toContain(
      "if (normalizedQuery.length < 2) return [];",
    );

    expect(panel).toContain("searchMessagesLegalScopeTargets(");
    expect(panel).toContain("searchMessagesLegalReviewers(");
    expect(panel).toContain("SCOPE_TARGET_KIND[scopeForm.scopeKind]");
    expect(panel).toContain("detail.case.id,");
    expect(panel).toContain("reviewerSearchQuery,");
    expect(panel).toContain(
      "Search is case-bound, deliberate, and capped at 20 safe metadata results.",
    );
  });

  it("removes routine raw identifier entry and browser-native workflow chrome", () => {
    expect(panel).not.toMatch(/<select\b/);
    expect(panel).not.toContain('type="datetime-local"');
    expect(panel).not.toContain('type="date"');
    expect(panel).not.toContain('type="time"');
    expect(panel).not.toContain('type="checkbox"');

    for (const legacyLabel of [
      "Message UUID",
      "Conversation UUID",
      "Media file object UUID",
      "Resource Version UUID",
      "Assigned user UUID",
    ]) {
      expect(panel).not.toContain(legacyLabel);
    }

    expect(panel).toContain("<SearchableSelect");
    expect(panel).toContain("<WkDateTimePicker");
    expect(panel).toContain("<WkEntityPicker");
    expect(panel).toContain("assignedUserId: null");
  });

  it("keeps evidence and machine package detail deliberate and non-ambient", () => {
    expect(panel).toContain("<WkInspector");
    expect(panel).toContain(
      'advancedLabel="Reveal inspected private evidence"',
    );
    expect(panel).toContain(
      'advancedLabel="Reveal hashes, fingerprints, paths, and manifest"',
    );
    expect(panel).toContain("It is not rendered in the normal case");
    expect(panel).toContain("Inspect Package");
    expect(panel).toContain("Purpose-audited evidence");
  });

  it("uses custom package selection and contextual audit history", () => {
    expect(panel).toContain('role="checkbox"');
    expect(panel).toContain("aria-checked={selected}");
    expect(panel).toContain("<WkAuditTimeline");
    expect(panel).toContain('ariaLabel="Legal Request Case activity"');
    expect(panel).toContain("<WkStateBadge");
  });

  it("uses governed command sheets for reason-bearing Legal actions", () => {
    expect(panel).toContain("<WkCommandSheet");
    expect(panel).toContain('eyebrow="Governed Legal action"');
    expect(panel).toContain('eyebrow="Human response decision"');
    expect(panel).toContain('eyebrow="Purpose-audited inspection"');
    expect(panel).toContain('eyebrow="Controlled package delivery"');
    expect(panel).toContain(
      "Expected revisions, approval fingerprints, idempotency, and release prerequisites remain server-enforced.",
    );
  });

  it("polls only selected worker-backed package states and stops at non-worker state", () => {
    expect(panel).toContain('["queued", "generating"].includes(');
    expect(panel).toContain("window.setInterval");
    expect(panel).toContain("window.clearInterval");
    expect(panel).toContain("selectedPackageId");
    expect(panel).toContain("selectedCaseId");
    expect(panel).toContain("polls only");
    expect(panel).toContain("while this package remains selected");
  });

  it("preserves every Candidate C governed command and same-context delivery", () => {
    for (const command of [
      "openMessagesLegalRequestCase",
      "startMessagesLegalReview",
      "updateMessagesLegalScope",
      "materializeMessagesLegalPreservation",
      "releaseMessagesLegalPreservation",
      "classifyMessagesLegalObject",
      "inspectMessagesLegalEvidence",
      "prepareMessagesLegalDisclosure",
      "updateMessagesLegalDisclosureApproval",
      "submitMessagesLegalDisclosureGeneration",
      "releaseMessagesLegalDisclosure",
      "voidMessagesLegalDisclosure",
      "closeMessagesLegalRequestCase",
      "createMessagesLegalDisclosureDelivery",
    ]) {
      expect(panel).toContain(command);
    }

    expect(panel).toContain("window.location.assign(target.url)");
    expect(panel).not.toContain('target="_blank"');
    expect(panel).not.toContain("window.open(");
  });

  it("keeps the case queue aligned with case-status transitions and blocks premature closure", () => {
    expect(panel).toContain(
      'if (action.kind === "start_review") {',
    );
    expect(panel).toContain(
      'setStatusFilter("under_review");',
    );
    expect(panel).toContain(
      '} else if (action.kind === "close_case") {',
    );
    expect(panel).toContain(
      'setStatusFilter("closed");',
    );
    expect(panel).toContain(
      'step.id === "closure"',
    );
    expect(panel).toContain(
      'step.state === "available"',
    );
    expect(panel).toContain(
      'disabled={busy || !closureAvailable}',
    );
    expect(panel).toContain(
      "Release active scope, held objects, and in-flight generation before closure.",
    );
  });

  it("wraps deliberate machine detail inside the package Inspector", () => {
    expect(panel).toContain(
      'className="space-y-2 break-all text-[9px] font-bold text-wk-text-muted"',
    );
    expect(panel).toContain(
      'advancedLabel="Reveal hashes, fingerprints, paths, and manifest"',
    );
  });

  it("does not create another backend or runtime authority in frontend convergence", () => {
    expect(panel).not.toContain("service_role");
    expect(panel).not.toContain("platform_private.");
    expect(panel).not.toContain("supabase.functions.invoke");
    expect(panel).not.toMatch(/\.from\([^\n]+\)\.(insert|update|delete)\(/);
  });
});

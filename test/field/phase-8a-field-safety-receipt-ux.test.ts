import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const page = read("src/pages/field/page.tsx");
const service = read("src/services/fieldIntakeService.ts");

describe("Phase 8A.5 Field safety and receipt UX", () => {
  it("launches the contributor questions collapsed", () => {
    expect(page).not.toContain("DURABILITY_PROOF_DECLARATIONS");
    expect(page).toContain("DisclosureCard");
    expect(page).toMatch(
      /showRightsQuestion,\s*setShowRightsQuestion\]\s*=\s*useState\(false\)/,
    );
    expect(page).toMatch(
      /showPermissionQuestion,\s*setShowPermissionQuestion\][\s\S]*useState\(false\)/,
    );
    expect(page).toContain(
      "setShowProtectionOptions(false)",
    );
    expect(page).toContain(
      'title="Can You Share This Video With Us?"',
    );
    expect(page).toContain(
      'title="Are People in It Okay With You Sending It?"',
    );
    expect(page).toContain('title="More Options"');
    expect(page).toContain("Choose an answer");
  });

  it("uses short contributor language instead of internal governance copy", () => {
    for (const expected of [
      "Two Quick Questions",
      "It’s Mine to Share",
      "I Have Permission",
      "I’m Not Sure",
      "Permission Isn’t Needed",
      "More Options",
      "Your Details",
      "Public Credit",
      "Follow-Up",
      "Extra Care",
      "Hold Until",
      "Location",
    ]) {
      expect(page).toContain(expected);
    }

    for (const removed of [
      "Tell Us What You Know",
      "Who Controls This Video?",
      "What Do You Know About Permission?",
      "How Sensitive Is This?",
      "Who Should See Source Details?",
      "Should We Hold This Video?",
      "They do not approve it for publication.",
      "Your account stays attached to this submission.",
      "Avoid an exact address if that could put someone at risk.",
    ]) {
      expect(page).not.toContain(removed);
    }
  });

  it("preserves exact declaration values behind calmer choices", () => {
    for (const value of [
      "owns_or_controls",
      "authorized_by_rights_holder",
      "uncertain",
      "other",
      "granted",
      "not_required",
      "not_obtained",
      "standard",
      "restricted",
      "internal",
      "confidential",
      "do_not_name",
      "may_name",
      "account_contact",
      "no_follow_up",
      "none",
      "moderate",
      "extreme",
      "until_review",
      "until_time",
      "not_collected",
      "coarse_text",
    ]) {
      expect(page).toContain(`"${value}"`);
    }
  });

  it("keeps visible form chrome inside the WAKILISHA control system", () => {
    expect(page).not.toContain("<select");
    expect(page).toContain('type="datetime-local"');
    expect(page).toContain(
      'className="absolute inset-0 h-full w-full cursor-pointer opacity-0"',
    );
    expect(page).toContain(
      "relative mt-2 block box-border w-full min-w-0 max-w-full overflow-hidden rounded-2xl",
    );
    expect(page).toContain(
      "mt-2 box-border w-full min-w-0 max-w-full rounded-2xl",
    );
    expect(page).toContain("formatHoldTime");
    expect(page).toContain("ri-calendar-line");
  });

  it("keeps location optional and coarse", () => {
    expect(page).toContain('"not_collected"');
    expect(page).toContain('"coarse_text"');
    expect(page).toContain("No Location");
    expect(page).toContain("Add a Broad Location");
    expect(page).toContain("City, area, or landmark");

    expect(page).not.toContain("navigator.geolocation");
    expect(page).not.toContain("latitude");
    expect(page).not.toContain("longitude");
  });

  it("renders a short safe contributor receipt", () => {
    expect(page).toContain("type FieldReceipt");
    expect(page).toContain("setReceipt(nextReceipt)");
    expect(page).toContain("Video Received");
    expect(page).toContain(
      "We got it. We’ll review it before anything goes public.",
    );
    expect(page).toContain("receipt.submissionReference");
    expect(page).toContain(
      "receipt.receiptIssuedAt ?? receipt.submittedAt",
    );
    expect(page).toContain(
      "Keep this if you need to follow up.",
    );

    const receiptInterface =
      service.match(
        /export interface FieldReceipt \{([\s\S]*?)\n\}/,
      )?.[1] ?? "";

    expect(receiptInterface).toContain("submissionReference: string");
    expect(receiptInterface).toContain("submittedAt: string | null");
    expect(receiptInterface).toContain("receiptIssuedAt: string | null");
    expect(receiptInterface).not.toContain("storage");
    expect(receiptInterface).not.toContain("capability");
    expect(receiptInterface).not.toContain("reviewer");
  });

  it("keeps accepted upload and recovery authority unchanged", () => {
    expect(service).toContain(
      'invokeRpc("finalize_field_submission_v1"',
    );
    expect(page).toContain("resumeFieldQueue");
    expect(page).toContain("queueSnapshot: pending");
    expect(page).toContain("Waiting for network");
    expect(page).toContain("Choose original video");
    expect(page).toContain(
      "Keep this page open while the upload is active.",
    );

    expect(page).not.toContain("—");
  });
});

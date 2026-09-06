import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const page = read("src/pages/field/page.tsx");
const service = read("src/services/fieldIntakeService.ts");

describe("Phase 8A.5 Field safety and receipt UX", () => {
  it("replaces the durability prototype with real contributor choices", () => {
    expect(page).not.toContain("DURABILITY_PROOF_DECLARATIONS");
    expect(page).toContain("INITIAL_DECLARATION_DRAFT");
    expect(page).toContain("buildFieldDeclarations");
    expect(page).toContain('rightsDeclaration: ""');
    expect(page).toContain('consentDeclaration: ""');
    expect(page).toContain("Before You Send");
    expect(page).toContain("Tell Us What You Know");
  });

  it("requires explicit rights and permission declarations", () => {
    for (const value of [
      "owns_or_controls",
      "authorized_by_rights_holder",
      "uncertain",
      "other",
      "granted",
      "not_required",
      "not_obtained",
    ]) {
      expect(page).toContain(`"${value}"`);
    }

    expect(page).toContain("Who Controls This Video?");
    expect(page).toContain("What Do You Know About Permission?");
    expect(page).toContain(
      "Tell us what you know about the rights to this video.",
    );
    expect(page).toContain(
      "Tell us what you know about permission from people shown.",
    );
    expect(page).toContain(
      "They do not approve it for publication.",
    );
  });

  it("keeps authenticated disclosure choices clear without promising anonymity", () => {
    for (const value of [
      "standard",
      "restricted",
      "may_name",
      "do_not_name",
      "account_contact",
      "no_follow_up",
    ]) {
      expect(page).toContain(`"${value}"`);
    }

    expect(page).toContain("How Should We Handle Your Name?");
    expect(page).toContain(
      "Your account stays attached to this submission.",
    );
    expect(page).toContain("Can WAKILISHA Name You Publicly?");
    expect(page).toContain("Can We Contact You About This?");
    expect(page).not.toContain("anonymous");
  });

  it("offers sensitivity, source protection, and hold choices", () => {
    for (const value of [
      "none",
      "low",
      "moderate",
      "high",
      "extreme",
      "internal",
      "restricted",
      "confidential",
      "until_review",
      "until_time",
    ]) {
      expect(page).toContain(`"${value}"`);
    }

    expect(page).toContain("How Sensitive Is This?");
    expect(page).toContain("Who Should See Source Details?");
    expect(page).toContain("Should We Hold This Video?");
    expect(page).toContain("Choose a future date and time for the hold.");
  });

  it("minimizes location to an optional broad text value", () => {
    expect(page).toContain('"not_collected"');
    expect(page).toContain('"coarse_text"');
    expect(page).toContain("Add a Broad Location?");
    expect(page).toContain("City, area, or landmark");
    expect(page).toMatch(
      /Avoid an exact address if that\s+could put someone at risk\./,
    );

    expect(page).not.toContain("navigator.geolocation");
    expect(page).not.toContain("latitude");
    expect(page).not.toContain("longitude");
  });

  it("renders only the safe contributor receipt returned by finalization", () => {
    expect(page).toContain("type FieldReceipt");
    expect(page).toContain("setReceipt(nextReceipt)");
    expect(page).toContain("Submission Received");
    expect(page).toContain("receipt.receiptMessage");
    expect(page).toContain("receipt.submissionReference");
    expect(page).toContain(
      "receipt.receiptIssuedAt ?? receipt.submittedAt",
    );
    expect(page).toContain(
      "It does not mean the video is",
    );
    expect(page).toContain(
      "Keep this reference if you contact WAKILISHA",
    );

    const receiptInterface =
      service.match(
        /export interface FieldReceipt \{([\s\S]*?)\n\}/,
      )?.[1] ?? "";

    expect(receiptInterface).toContain("submissionReference: string");
    expect(receiptInterface).toContain("submittedAt: string | null");
    expect(receiptInterface).toContain("receiptIssuedAt: string | null");
    expect(receiptInterface).toContain("receiptMessage: string");
    expect(receiptInterface).not.toContain("storage");
    expect(receiptInterface).not.toContain("capability");
    expect(receiptInterface).not.toContain("reviewer");
  });

  it("keeps the accepted upload and recovery path intact", () => {
    expect(service).toContain(
      'invokeRpc("finalize_field_submission_v1"',
    );
    expect(page).toContain("resumeFieldQueue");
    expect(page).toContain("queueSnapshot: pending");
    expect(page).toContain("Waiting for network");
    expect(page).toContain("Choose original video");
    expect(page).toContain("Keep this page open while the upload is active.");

    expect(page).not.toContain("—");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectRecordedCaseSubject } from "../../src/services/miziziRecordedCaseSubject";

describe("MIZIZI source-bound case identity", () => {
  it("shows DESIRE from actual canonical title and matching recorded peer", () => {
    expect(projectRecordedCaseSubject({
      evidence: {
        canonicalTitleSlug: "desire",
        peers: [{
          id: "afbe3f47-62af-4b68-8d54-527f04987ebe",
          title: "DESIRE",
          slug: "desire-2a895a",
          sharedPrimaryArtistSlug: "lil-maina",
        }],
      },
    }, "MIZIZI needs recording identity review")).toEqual({
      title: "DESIRE",
      artistReference: "lil-maina",
      specific: true,
    });
  });

  it("never asserts an artist or contradictory title from an unrelated peer", () => {
    expect(projectRecordedCaseSubject({
      evidence: {
        canonicalTitleSlug: "ficha",
        peers: [{ title: "Different Recording", sharedPrimaryArtistSlug: "unverified-artist" }],
      },
    }, "Recording needs review")).toEqual({
      title: "Ficha",
      artistReference: null,
      specific: true,
    });
  });

  it("keeps original review title when claim-specific evidence is absent", () => {
    expect(projectRecordedCaseSubject({
      evidence: { peers: [{ title: "Uncorroborated", sharedPrimaryArtistSlug: "incorrect" }] },
    }, "Original case title")).toEqual({
      title: "Original case title",
      artistReference: null,
      specific: false,
    });
    expect(projectRecordedCaseSubject(null, "Original case title").specific).toBe(false);
  });

  it("never uses long or invalid arbitrary payload text as a display title", () => {
    expect(projectRecordedCaseSubject({
      evidence: { canonicalTitleSlug: "x".repeat(200) },
    }, "Original case title").title).toBe("Original case title");
  });
});

describe("Cores bounded read-only evidence projection", () => {
  it("enriches only selected page items and rejects unknown or changed records", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx","utf8");
    expect(source).toContain('const pageKey = selection.items.map((item) => item.id).join(",")');
    expect(source).toContain('.select("id,title,source_payload")');
    expect(source).toContain('.in("id", pageIds)');
    expect(source).toContain('new Set(pageIds)');
    expect(source).toContain('row.title !== review.title');
    expect(source).toContain("projectRecordedCaseSubject(row.source_payload, review.title)");
    expect(source).toContain('detail.value?.id === selected?.id');
    expect(source).toContain("detailIsLoading");
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/);
  });
  it("only calls exact #1094 receipt verifier for known records", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx","utf8");
    expect(source).toContain("ISSUE_1094_CASES.some");
    expect(source).toContain("loadIssue1094Brief()");
    expect(source).toContain("Human decision recorded · Blocked");
    expect(source).toContain("archived-credit blocker");
    expect(source).toContain('status: "unverified"');
  });
});



describe("MIZIZI recorded Release public identity references", () => {
  it("shows a recorded public-identity slug without inventing a Release title", () => {
    expect(projectRecordedCaseSubject({
      fieldName: "public_identity",
      currentValue: "roses-feat-tellaman-remix",
      ruleId: "single_public_identity_conflict",
    }, "MIZIZI found a Single public-identity conflict")).toEqual({
      title: "Public identity · roses-feat-tellaman-remix",
      artistReference: null,
      specific: true,
    });
  });

  it("does not display unverified or unsafe public identity values", () => {
    for (const payload of [
      { fieldName: "recording_identity", currentValue: "roses-feat-tellaman-remix" },
      { fieldName: "public_identity", currentValue: "https://example.com/unknown" },
      { fieldName: "public_identity", currentValue: "x".repeat(200) },
    ]) {
      expect(projectRecordedCaseSubject(payload, "Original review").title).toBe("Original review");
    }
  });
});

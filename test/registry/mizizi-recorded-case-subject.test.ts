import { describe, expect, it } from "vitest";
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

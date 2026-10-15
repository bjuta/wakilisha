import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reviewJobDisplay } from "@/services/reviewJobDisplay";
import type { QueueReviewV2 } from "@/services/miziziHeadquartersBrief";
import type { CaseSubject } from "@/services/miziziCaseField";

const review: QueueReviewV2 = {
  id: "2b8b2d52-6c5e-4397-914d-60c8bf0e34d2",
  title: "MIZIZI needs recording identity review",
  workstream: "mizizi_data_hygiene",
  workstreamLabel: "Music Identity and Credits",
  subjectType: "track",
  status: "open",
  sourceStatus: "open",
  updatedAt: null,
};
const recorded: CaseSubject = {
  reviewId: review.id,
  sourceId: "f30846f0-8cf1-4df6-8875-38fa7a763e7b",
  kind: "track",
  title: "DESIRE",
  isrc: "QZ57J2384681",
  status: "open",
  workstream: "mizizi_data_hygiene",
  artists: [
    { id: "a", name: "Lilmaina", status: "active", slug: "lil-maina" },
    { id: "b", name: "Another artist", status: "archived", slug: "another-artist" },
    { id: "a", name: "Lilmaina", status: "active", slug: "lil-maina" },
  ],
};

describe("MIZIZI job-first, source-bound review presentation", () => {
  it("makes source names the primary content of sessions, recent work, roots, and governed modal", () => {
    const brief = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const roots = readFileSync("src/pages/admin/review/mizizi/MiziziReviewRoots.tsx", "utf8");
    const queue = readFileSync("src/pages/admin/review/queue/page.tsx", "utf8");
    expect(brief).toContain("loadMiziziCaseSubjects(queue)");
    expect(brief).toContain("{job?.title}");
    expect(brief).toContain("Recorded artist credits:");
    expect(brief).toContain("What Needs Review");
    expect(brief).toContain("subjects={caseSubjects}");
    expect(brief).not.toContain("<strong>{current.workstreamLabel}</strong>");
    expect(roots).toContain("reviewJobDisplay(selectedReview, subjects.get(selectedReview.id)).title");
    expect(roots).toContain("reviewJobDisplay(review, subjects.get(review.id)).title");
    expect(queue).toContain("const recordedSubject = projectRecordedCaseSubject(item.source_payload, item.title ??");
    expect(queue).toContain("title={jobTitle}");
    expect(queue).toContain("Source IDs and Recorded Data");
    expect(queue).toContain('useCanonicalReviewTitle(item)');
    expect(queue).toContain('supabase.from("registry_tracks")');
    expect(queue).toContain('.select("id,title").eq("id", sourceId).maybeSingle()');
    expect(queue).toContain('supabase.from("registry_releases")');
    expect(queue).toContain('.select("id,title").eq("id", sourceId).maybeSingle()');
    expect(queue).toContain("What Needs Review");
    expect(queue).not.toContain('<FieldPill label="Review type"');
  });

  it("leads with the actual authorised Track title and recorded credits, not the workstream", () => {
    expect(reviewJobDisplay(review, recorded)).toEqual({
      title: "DESIRE",
      type: "Recording",
      credits: ["Lilmaina"],
      isrc: "QZ57J2384681",
      issue: "MIZIZI needs recording identity review",
      sourced: true,
    });
  });

  it("accepts only the exact review ID and matching source type", () => {
    const wrongReview = { ...recorded, reviewId: "other-id" };
    const wrongType = { ...recorded, kind: "release" as const };
    for (const item of [wrongReview, wrongType]) {
      const view = reviewJobDisplay(review, item);
      expect(view.title).toBe("Recording name unavailable");
      expect(view.sourced).toBe(false);
      expect(view.credits).toEqual([]);
      expect(view.issue).toBe(review.title);
    }
  });

  it("never invents a Release name from unrelated matching peer credits", () => {
    const releaseReview = { ...review, subjectType: "release" };
    const result = reviewJobDisplay(releaseReview, undefined);
    expect(result.title).toBe("Release name unavailable");
    expect(result.sourced).toBe(false);
  });

  it("preserves recorded genuine Release titles without inventing artist credits", () => {
    const releaseReview = { ...review, subjectType: "release" };
    const release: CaseSubject = { ...recorded, kind: "release", title: "Roses", isrc: null, artists: [] };
    expect(reviewJobDisplay(releaseReview, release)).toMatchObject({
      title: "Roses", type: "Release", credits: [], sourced: true,
    });
  });
});

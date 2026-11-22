// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { deriveArticleEditorialGate, currentArticleReviewProof, type ArticleEditorialGateInput } from "@/services/articles/articleEditorialGate";
import { ArticleReviewDecisionWorkspace } from "@/pages/admin/content/articles/detail/components/ArticleReviewDecisionWorkspace";
import fs from "node:fs";
import path from "node:path";

const approved = "approved-fingerprint", changed = "changed-fingerprint";
const oldSubmission = "00000000-0000-4000-8000-000000000030";
const newSubmission = "00000000-0000-4000-8000-000000000033";
function gate(overrides: Partial<ArticleEditorialGateInput> = {}) {
  const base: ArticleEditorialGateInput = {
    wpStatus: "pending", latestReviewAction: "approved",
    latestApprovedVersionNumber: 31, latestSubmittedVersionId: oldSubmission,
    reviewTargetVersionId: oldSubmission, isDirty: false,
    canEdit: true, canReview: true, canPublish: true, allowSubmitForReview: true,
    proof: { latestVersionNumber: 32, latestContentFingerprint: changed,
      approvedVersionNumber: 31, approvedContentFingerprint: approved,
      submittedVersionNumber: 30, submittedContentFingerprint: approved },
  };
  return deriveArticleEditorialGate({ ...base, ...overrides });
}

describe("permanent Article editorial lifecycle authority", () => {
  beforeEach(() => cleanup());

  it("recovers actual Alusa Continua state: pending + approved v31 + changed v32", () => {
    const decision = gate();
    expect(decision.canSubmitWorkingVersion).toBe(true);
    expect(decision.canApproveSubmittedVersion).toBe(false);
    expect(decision.canRequestChanges).toBe(false);
    expect(decision.canPublishApprovedVersion).toBe(false);
    expect(decision.editorialStatusLabel).toBe("Changes Need Review");
    expect(decision.publishDisabledReason).toMatch(/Resubmit/);
  });

  it("after resubmitting current v32 as immutable v33 only the exact submission can be reviewed", () => {
    const proof = { latestVersionNumber: 33, latestContentFingerprint: changed,
      approvedVersionNumber: 31, approvedContentFingerprint: approved,
      submittedVersionNumber: 33, submittedContentFingerprint: changed };
    const waiting = gate({ latestReviewAction: "submitted",
      latestSubmittedVersionId: newSubmission, reviewTargetVersionId: newSubmission, proof });
    expect(waiting.canSubmitWorkingVersion).toBe(false);
    expect(waiting.canApproveSubmittedVersion).toBe(true);
    expect(waiting.canRequestChanges).toBe(true);
    expect(waiting.editorialStatusLabel).toBe("Pending Review");
    expect(waiting.canPublishApprovedVersion).toBe(false);
    expect(gate({ latestReviewAction: "submitted", latestSubmittedVersionId: newSubmission,
      reviewTargetVersionId: oldSubmission, proof }).canApproveSubmittedVersion).toBe(false);
  });

  it("approved new v34 is publishable even if the historic wp_status is still pending", () => {
    const same = { latestVersionNumber: 34, latestContentFingerprint: changed,
      approvedVersionNumber: 34, approvedContentFingerprint: changed,
      submittedVersionNumber: 33, submittedContentFingerprint: changed };
    const accepted = gate({ latestApprovedVersionNumber: 34, proof: same });
    expect(accepted.editorialStatusLabel).toBe("Approved for Publication");
    expect(accepted.canPublishApprovedVersion).toBe(true);
    expect(accepted.publishDisabledReason).toBeNull();
    expect(accepted.canSubmitWorkingVersion).toBe(false);
  });

  it("never reuses an async approval proof after a save, Article switch or new decision", () => {
    const lease = {
      articleId: "article-one", draftVersion: 31,
      approvedVersionNumber: 31, submittedVersionNumber: 30,
      proof: { latestVersionNumber: 31, latestContentFingerprint: approved,
        approvedVersionNumber: 31, approvedContentFingerprint: approved,
        submittedVersionNumber: 30, submittedContentFingerprint: approved },
    };
    const current = {
      articleId: "article-one", draftVersion: 31,
      approvedVersionNumber: 31, submittedVersionNumber: 30,
    };
    expect(currentArticleReviewProof(current, lease)).toEqual(lease.proof);
    expect(currentArticleReviewProof({ ...current, draftVersion: 32 }, lease)).toBeNull();
    expect(currentArticleReviewProof({ ...current, articleId: "article-two" }, lease)).toBeNull();
    expect(currentArticleReviewProof({ ...current, approvedVersionNumber: 34 }, lease)).toBeNull();
    expect(currentArticleReviewProof({ ...current, submittedVersionNumber: 33 }, lease)).toBeNull();
  });

  it("does not revoke an unchanged approved snapshot merely because a no-op save made a new version", () => {
    const proof = { latestVersionNumber: 32, latestContentFingerprint: approved,
      approvedVersionNumber: 31, approvedContentFingerprint: approved,
      submittedVersionNumber: 30, submittedContentFingerprint: approved };
    expect(gate({ proof }).canPublishApprovedVersion).toBe(true);
    expect(gate({ proof }).canSubmitWorkingVersion).toBe(false);
  });

  it("supersedes an old pending submission after real working changes instead of approving the stale target", () => {
    const proof = { latestVersionNumber: 35, latestContentFingerprint: changed,
      approvedVersionNumber: null, approvedContentFingerprint: null,
      submittedVersionNumber: 33, submittedContentFingerprint: approved };
    const state = gate({ latestReviewAction: "submitted", latestApprovedVersionNumber: null,
      latestSubmittedVersionId: newSubmission, reviewTargetVersionId: newSubmission, proof });
    expect(state.canSubmitWorkingVersion).toBe(true);
    expect(state.canApproveSubmittedVersion).toBe(false);
    expect(state.workingChangesNeedReview).toBe(true);
  });

  it("never assumes missing or stale evidence means approval", () => {
    expect(gate({ proof: null }).canPublishApprovedVersion).toBe(false);
    expect(gate({ proof: null }).canSubmitWorkingVersion).toBe(false);
    expect(gate({ proof: null }).editorialStatusLabel).toBe("Review Verification Required");
    expect(gate({ latestReviewAction: "submitted", proof: null }).canApproveSubmittedVersion).toBe(false);
  });

  it("review-only and publisher-only roles retain immutable version authority", () => {
    const nonEditor = gate({
      canEdit: false, latestReviewAction: "submitted", latestApprovedVersionNumber: null,
      latestSubmittedVersionId: newSubmission, reviewTargetVersionId: newSubmission,
      proof: null, canReview: true, canPublish: false,
    });
    expect(nonEditor.canApproveSubmittedVersion).toBe(true);
    expect(nonEditor.canRequestChanges).toBe(true);
    expect(nonEditor.canSubmitWorkingVersion).toBe(false);
    const publisher = gate({ canEdit: false, proof: null });
    expect(publisher.canPublishApprovedVersion).toBe(true);
    expect(publisher.canSubmitWorkingVersion).toBe(false);
    expect(gate({ canEdit: false, proof: null, latestApprovedVersionNumber: null })
      .canPublishApprovedVersion).toBe(false);
  });

  it("preserves review and publish permissions and hides submission for live Articles", () => {
    expect(gate({ canEdit: false }).canSubmitWorkingVersion).toBe(false);
    expect(gate({ canPublish: false }).canPublishApprovedVersion).toBe(false);
    expect(gate({ wpStatus: "publish" }).canSubmitWorkingVersion).toBe(false);
    expect(gate({ allowSubmitForReview: false }).canSubmitWorkingVersion).toBe(false);
  });

  it("offers a working-version submission in the actual review decision component", () => {
    const callback = vi.fn();
    render(<ArticleReviewDecisionWorkspace title="Album Review: Alusa Continua"
      status="Changes Need Review" submittedVersionNumber={30} workingVersionNumber={32}
      latestApprovedVersionNumber={31} canResubmitWorkingVersion
      onResubmitWorkingVersion={callback} note="" onNoteChange={() => {}}
      canRequestChanges={false} canApprove={false} busy={false} events={[]} />);
    expect(screen.getByText(/Approved v31 remains preserved/)).toBeTruthy();
    expect(screen.getByText(/working v32 needs review/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resubmit Current Version for Review" }));
    expect(callback).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Approve Version" })).toBeNull();
  });

  it("displays the active approved identity, never the historical submitted version as current", () => {
    render(<ArticleReviewDecisionWorkspace title="Album Review: Alusa Continua"
      status="Approved for Publication" submittedVersionNumber={30} workingVersionNumber={31}
      latestApprovedVersionNumber={31} canResubmitWorkingVersion={false}
      onResubmitWorkingVersion={() => {}} note="" onNoteChange={() => {}}
      canRequestChanges={false} canApprove={false} busy={false} events={[]} />);
    expect(screen.getByText(/approved v31/)).toBeTruthy();
    expect(screen.queryByText(/submitted v30/)).toBeNull();
  });

  it("wires the same state machine to editor, meta review, review screen and publish guard", () => {
    const src = fs.readFileSync(path.join(process.cwd(),
      "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx"), "utf8");
    expect(src).toContain("deriveArticleEditorialGate({");
    expect(src).toContain("currentArticleReviewProof({");
    expect(src).toContain("canSubmitCurrentArticleForReview = reviewGate.canSubmitWorkingVersion");
    expect(src).toContain("canPublishApprovedArticleVersion = reviewGate.canPublishApprovedVersion");
    expect(src).toContain("hasChangesAfterApproval={reviewGate.workingChangesNeedReview}");
    expect(src).toContain("onResubmitWorkingVersion={handleSubmitForReview}");
    expect(src).not.toContain("!isPendingReview &&");
  });
});

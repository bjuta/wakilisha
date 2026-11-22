// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { deriveArticleEditorialGate, canPublishArticleWithCapability, currentArticleReviewProof, type ArticleEditorialGateInput } from "@/services/articles/articleEditorialGate";
import { ArticleReviewDecisionWorkspace } from "@/pages/admin/content/articles/detail/components/ArticleReviewDecisionWorkspace";
import { hasActiveArticleReviewRound } from "@/pages/admin/content/articles/detail/hooks/useArticleDocumentModeState";
import fs from "node:fs";
import path from "node:path";

const approved = "approved-fingerprint", changed = "changed-fingerprint";
const oldSubmission = "00000000-0000-4000-8000-000000000030";
const newSubmission = "00000000-0000-4000-8000-000000000033";
function gate(overrides: Partial<ArticleEditorialGateInput> = {}) {
  const base: ArticleEditorialGateInput = {
    wpStatus: "pending", latestReviewAction: "approved",
    latestApprovedVersionNumber: 31, latestPublishedVersionNumber: null, latestSubmittedVersionId: oldSubmission,
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

  it("matches SQL publish_articles global capability even for a non-owner Article", () => {
    expect(canPublishArticleWithCapability({
      isInstituteMode: false, isAdmin: false, userCanPublish: true,
    })).toBe(true);
    expect(canPublishArticleWithCapability({
      isInstituteMode: false, isAdmin: true, userCanPublish: false,
    })).toBe(true);
    expect(canPublishArticleWithCapability({
      isInstituteMode: false, isAdmin: false, userCanPublish: false,
    })).toBe(false);
    expect(canPublishArticleWithCapability({
      isInstituteMode: true, isAdmin: true, userCanPublish: true,
    })).toBe(false);
    const src = fs.readFileSync(path.join(process.cwd(),
      "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx"), "utf8");
    expect(src).toContain("canPublishArticleWithCapability({");
    expect(src).not.toContain("(isOwner && userCanPublish)");
  });

  it("reports actual capability denial rather than a fake approved-version verification error", () => {
    const proof = {
      latestVersionNumber: 36, latestContentFingerprint: changed,
      approvedVersionNumber: 35, approvedContentFingerprint: changed,
      submittedVersionNumber: 34, submittedContentFingerprint: changed,
    };
    const decision = gate({ latestApprovedVersionNumber: 35, proof, canPublish: false });
    expect(decision.editorialStatusLabel).toBe("Approved for Publication");
    expect(decision.canPublishApprovedVersion).toBe(false);
    expect(decision.publishDisabledReason).toMatch(/does not have permission/);
    const eligible = gate({ latestApprovedVersionNumber: 35, proof, canPublish: true });
    expect(eligible.canPublishApprovedVersion).toBe(true);
    expect(eligible.publishDisabledReason).toBeNull();
  });

  it("preserves review and publish permissions and hides submission for live Articles", () => {
    expect(gate({ canEdit: false }).canSubmitWorkingVersion).toBe(false);
    expect(gate({ canPublish: false }).canPublishApprovedVersion).toBe(false);
    expect(gate({ wpStatus: "publish", latestReviewAction: "published", latestPublishedVersionNumber: 37,
      proof: { latestVersionNumber: 37, latestContentFingerprint: approved,
        approvedVersionNumber: 31, approvedContentFingerprint: approved,
        submittedVersionNumber: 30, submittedContentFingerprint: approved },
    }).canSubmitWorkingVersion).toBe(false);
    expect(gate({ allowSubmitForReview: false }).canSubmitWorkingVersion).toBe(false);
  });

  it("allows a newer saved working version of a published Article to be reviewed without withdrawing the live snapshot", () => {
    const live = gate({
      wpStatus: "publish", latestReviewAction: "published",
      latestApprovedVersionNumber: 35, latestPublishedVersionNumber: 37,
      proof: { latestVersionNumber: 39, latestContentFingerprint: changed,
        approvedVersionNumber: 35, approvedContentFingerprint: approved,
        submittedVersionNumber: 34, submittedContentFingerprint: approved },
    });
    expect(live.canSubmitWorkingVersion).toBe(true);
    expect(live.canApproveSubmittedVersion).toBe(false);
    expect(live.canPublishApprovedVersion).toBe(false);
    expect(live.editorialStatusLabel).toBe("Published · Changes Need Review");
    expect(live.publishDisabledReason).toContain("remains live");
    const absent = gate({ wpStatus: "publish", latestReviewAction: "published",
      latestPublishedVersionNumber: 37, proof: null });
    expect(absent.canSubmitWorkingVersion).toBe(false);
    const scheduled = gate({ wpStatus: "future", latestReviewAction: "published",
      latestPublishedVersionNumber: 37 });
    expect(scheduled.canSubmitWorkingVersion).toBe(false);
  });

  it("loads only the exact new published revision for review and never the old submitted Article", () => {
    expect(hasActiveArticleReviewRound("publish","published")).toBe(false);
    expect(hasActiveArticleReviewRound("publish","submitted")).toBe(true);
    expect(hasActiveArticleReviewRound("publish","approved")).toBe(false);
    expect(hasActiveArticleReviewRound("publish","changes_requested")).toBe(false);
    expect(hasActiveArticleReviewRound("pending","submitted")).toBe(true);
    expect(hasActiveArticleReviewRound("future","submitted")).toBe(false);
    const editor=fs.readFileSync(path.join(process.cwd(),
      "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx"),"utf8");
    expect(editor).toContain("latestReviewAction,\n      draftVersion:");
  });

  it("reviews a new published correction while retaining live status, then allows explicit publication", () => {
    const reviewed = "00000000-0000-4000-8000-000000000041";
    const proof = { latestVersionNumber: 41, latestContentFingerprint: changed,
      approvedVersionNumber: 35, approvedContentFingerprint: approved,
      submittedVersionNumber: 41, submittedContentFingerprint: changed };
    const pending = gate({
      wpStatus: "publish", latestReviewAction: "submitted",
      latestPublishedVersionNumber: 37,
      latestApprovedVersionNumber: 35, latestSubmittedVersionId: reviewed,
      reviewTargetVersionId: reviewed, proof,
    });
    expect(pending.canApproveSubmittedVersion).toBe(true);
    expect(pending.canRequestChanges).toBe(true);
    expect(pending.canPublishApprovedVersion).toBe(false);
    expect(pending.editorialStatusLabel).toBe("Published · In Review");
    expect(gate({wpStatus:"publish",latestReviewAction:"submitted",
      latestPublishedVersionNumber:37,latestSubmittedVersionId:reviewed,
      reviewTargetVersionId:oldSubmission,proof}).canApproveSubmittedVersion).toBe(false);
    const approvedRevision=gate({
      wpStatus:"publish",latestReviewAction:"approved",
      latestPublishedVersionNumber:37,latestApprovedVersionNumber:42,
      proof:{...proof,approvedVersionNumber:42,approvedContentFingerprint:changed},
    });
    expect(approvedRevision.canPublishApprovedVersion).toBe(true);
    expect(approvedRevision.editorialStatusLabel).toBe("Published · Update Approved");
  });

  it("shows a direct Edit Article action in published Review, without an unsavable decision note", () => {
    const edit = vi.fn();
    render(<ArticleReviewDecisionWorkspace title="Album Review: Alusa Continua"
      status="Published" submittedVersionNumber={34} workingVersionNumber={39}
      latestApprovedVersionNumber={35} latestPublishedVersionNumber={37}
      isPublished canEditArticle onEditArticle={edit}
      canResubmitWorkingVersion={false} onResubmitWorkingVersion={()=>{}}
      note="" onNoteChange={()=>{}} canRequestChanges={false} canApprove={false}
      busy={false} events={[]} onRequestChanges={()=>{}} onApprove={()=>{}} />);
    expect(screen.getByText(/published v37/)).toBeTruthy();
    expect(screen.getByText(/stays published while you edit/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Edit Article"}));
    expect(edit).toHaveBeenCalledOnce();
  });

  it("allows submitting updated live text without reapproving the prior published version", () => {
    const submitted=vi.fn();
    render(<ArticleReviewDecisionWorkspace title="Album Review: Alusa Continua"
      status="Published · Changes Need Review" submittedVersionNumber={34} workingVersionNumber={39}
      latestApprovedVersionNumber={35} latestPublishedVersionNumber={37}
      isPublished canEditArticle onEditArticle={()=>{}}
      canResubmitWorkingVersion onResubmitWorkingVersion={submitted}
      note="Corrected the text" onNoteChange={()=>{}} canRequestChanges={false} canApprove={false}
      busy={false} events={[]} onRequestChanges={()=>{}} onApprove={()=>{}} />);
    fireEvent.click(screen.getByRole("button",{name:"Submit Updated Article for Review"}));
    expect(submitted).toHaveBeenCalledWith("Corrected the text");
    expect(screen.queryByRole("button",{name:"Approve Version"})).toBeNull();
  });

  it("offers a working-version submission in the actual review decision component", () => {
    const callback = vi.fn();
    render(<ArticleReviewDecisionWorkspace title="Album Review: Alusa Continua"
      status="Changes Need Review" submittedVersionNumber={30} workingVersionNumber={32}
      latestApprovedVersionNumber={31} canResubmitWorkingVersion
      onResubmitWorkingVersion={callback} note="Edited body after approval" onNoteChange={() => {}}
      canRequestChanges={false} canApprove={false} busy={false} events={[]} />);
    expect(screen.getByText(/Approved v31 remains preserved/)).toBeTruthy();
    expect(screen.getByText(/working v32 needs review/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resubmit Current Version for Review" }));
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith("Edited body after approval");
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

  it("preserves the public Article and published pointer in all three review lifecycle SQL commands", () => {
    const sql = fs.readFileSync(path.join(process.cwd(),
      "supabase/migrations/20261122120000_article_published_revision_preserve_live_v1.sql"), "utf8");
    expect(sql.match(/CREATE OR REPLACE FUNCTION public\./gi)).toHaveLength(3);
    expect(sql).toContain("public.submit_article_for_review");
    expect(sql).toContain("public.request_article_changes");
    expect(sql).toContain("public.approve_article_version");
    expect(sql.match(/v_preserve_live := v_article.wp_status = 'publish'/g)).toHaveLength(3);
    expect(sql.match(/snap\.version_id = v_resource\.current_published_version_id/g)).toHaveLength(3);
    expect(sql).toContain("Save a newer working Article version before submitting a published revision");
    expect(sql).toContain("Published Article revision is not the current submitted version");
    expect(sql.match(/visibility = case when v_preserve_live then 'public' else 'private' end/g))
      .toHaveLength(3);
    expect(sql).toContain("wp_status = case when v_preserve_live then 'publish' else 'pending' end");
    expect(sql).toContain("wp_status = case when v_preserve_live then 'publish' else 'draft' end");
    expect(sql).not.toMatch(/update public\.wk_article_publication_snapshots/i);
    expect(sql).not.toMatch(/delete from public\.wk_article_publication_snapshots/i);
    expect(sql).not.toMatch(/current_published_version_id\s*=/i);
    expect(sql).toContain("STOP: submit_article_for_review definition drift");
    expect(sql).toContain("STOP: approve_article_version definition drift");
    expect(sql).toContain("STOP: request_article_changes definition drift");
  });

  it("qualifies the live published Version number without changing the submission RPC authority", () => {
    const migrations = path.join(process.cwd(), "supabase/migrations");
    const original = fs.readFileSync(path.join(migrations,
      "20261122120000_article_published_revision_preserve_live_v1.sql"), "utf8");
    const forwardFix = fs.readFileSync(path.join(migrations,
      "20261122190013_article_published_revision_qualify_version_number_v1.sql"), "utf8");
    const functionName = "CREATE OR REPLACE FUNCTION public.submit_article_for_review(";
    const extract = (sql: string) => {
      const start = sql.indexOf(functionName);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = sql.indexOf("\n$function$;", start);
      expect(end).toBeGreaterThan(start);
      return sql.slice(start, end + "\n$function$;".length);
    };
    const ambiguous = "select version_number from editorial.article_versions where id = v_resource.current_published_version_id";
    const qualified = "select published_version.version_number from editorial.article_versions as published_version where published_version.id = v_resource.current_published_version_id";
    expect(extract(original).split(ambiguous)).toHaveLength(2);
    expect(extract(forwardFix)).toBe(extract(original).replace(ambiguous, qualified));
    expect(extract(forwardFix)).not.toContain(ambiguous);
    expect(forwardFix).toContain("476e81ba62ef40f866728380e6a4027b");
    expect(forwardFix).toContain("STOP: published revision submit RPC definition drift");
    expect(forwardFix).toContain("STOP: published revision submit qualification not installed");
    expect(forwardFix.match(/CREATE OR REPLACE FUNCTION /g)).toHaveLength(1);
    expect(forwardFix).not.toMatch(/(?:UPDATE|DELETE FROM|INSERT INTO)\s+(?:public\.wk_articles|editorial\.resources|public\.wk_article_publication_snapshots)\b/i);
    expect(forwardFix).not.toMatch(/\b(?:GRANT|REVOKE|DROP FUNCTION)\b/i);
  });

  it("wires the same state machine to editor, meta review, review screen and publish guard", () => {
    const src = fs.readFileSync(path.join(process.cwd(),
      "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx"), "utf8");
    expect(src).toContain("deriveArticleEditorialGate({");
    expect(src).toContain("currentArticleReviewProof({");
    expect(src).toContain("canSubmitCurrentArticleForReview = reviewGate.canSubmitWorkingVersion");
    expect(src).toContain("canPublishApprovedArticleVersion = reviewGate.canPublishApprovedVersion");
    expect(src).toContain("hasChangesAfterApproval={reviewGate.workingChangesNeedReview}");
    expect(src).toContain("onResubmitWorkingVersion={(note) => void handleSubmitForReview(note)}");
    expect(src).not.toContain("!isPendingReview &&");
  });
});

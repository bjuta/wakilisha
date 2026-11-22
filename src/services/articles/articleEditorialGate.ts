/**
 * Article editorial authority is version-bound, never inferred from wp_status.
 * wp_status can legitimately stay "pending" after an approved immutable version
 * while the writer saves a newer working version.
 *
 * All transitions fail closed when review/version evidence is not yet loaded.
 * This model drives both the inline editor controls and the Review workspace.
 */
/**
 * Publish authority is global capability-based at the database boundary:
 * editorial.current_user_can_publish_article() permits an administrator OR
 * publish_articles capability. Article ownership is not part of that check.
 * Keep the UI aligned with the canonical SQL permission contract.
 */
export function canPublishArticleWithCapability(input: {
  isInstituteMode: boolean;
  isAdmin: boolean;
  userCanPublish: boolean;
}): boolean {
  return !input.isInstituteMode && (input.isAdmin || input.userCanPublish);
}

export interface ArticleReviewVersionProof {
  latestVersionNumber: number | null;
  latestContentFingerprint: string | null;
  approvedVersionNumber: number | null;
  approvedContentFingerprint: string | null;
  submittedVersionNumber: number | null;
  submittedContentFingerprint: string | null;
}

export interface ArticleEditorialGateInput {
  wpStatus: string | null;
  latestReviewAction: string | null;
  latestApprovedVersionNumber: number | null;
  latestPublishedVersionNumber: number | null;
  latestSubmittedVersionId: string | null;
  reviewTargetVersionId: string | null;
  isDirty: boolean;
  canEdit: boolean;
  allowSubmitForReview: boolean;
  canReview: boolean;
  canPublish: boolean;
  proof: ArticleReviewVersionProof | null;
}

export interface ArticleEditorialGate {
  canSubmitWorkingVersion: boolean;
  canApproveSubmittedVersion: boolean;
  canRequestChanges: boolean;
  canPublishApprovedVersion: boolean;
  workingChangesNeedReview: boolean;
  hasChangesAfterApproval: boolean;
  editorialStatusLabel: string;
  editorialStatusColorKey: string;
  publishDisabledReason: string | null;
}

export interface ArticleReviewProofLease {
  articleId: string;
  draftVersion: number;
  approvedVersionNumber: number | null;
  submittedVersionNumber: number | null;
  proof: ArticleReviewVersionProof;
}

/**
 * A previous async version-list result must never authorize publication of a
 * newer save, a different Article or a newly submitted/approved lifecycle.
 */
export function currentArticleReviewProof(
  current: {
    articleId: string | null;
    draftVersion: number | null;
    approvedVersionNumber: number | null;
    submittedVersionNumber: number | null;
  },
  lease: ArticleReviewProofLease | null,
): ArticleReviewVersionProof | null {
  if (!lease || !current.articleId || current.draftVersion == null ||
      current.articleId !== lease.articleId ||
      current.draftVersion !== lease.draftVersion ||
      current.approvedVersionNumber !== lease.approvedVersionNumber ||
      current.submittedVersionNumber !== lease.submittedVersionNumber) {
    return null;
  }
  return lease.proof;
}

function sameFingerprint(a: string | null | undefined, b: string | null | undefined): boolean | null {
  if (!a || !b) return null; // No authority to assume equivalence.
  return a === b;
}

export function deriveArticleEditorialGate(input: ArticleEditorialGateInput): ArticleEditorialGate {
  const {
    wpStatus, latestReviewAction, latestApprovedVersionNumber, latestPublishedVersionNumber,
    latestSubmittedVersionId, reviewTargetVersionId,
    isDirty, canEdit, allowSubmitForReview, canReview, canPublish, proof,
  } = input;
  const published = wpStatus === "publish";
  const approvalMatchesWorking = sameFingerprint(
    proof?.latestContentFingerprint, proof?.approvedContentFingerprint,
  );
  const submissionMatchesWorking = sameFingerprint(
    proof?.latestContentFingerprint, proof?.submittedContentFingerprint,
  );
  const approvedProofCurrent = Boolean(
    latestApprovedVersionNumber &&
    proof?.approvedVersionNumber === latestApprovedVersionNumber &&
    approvalMatchesWorking === true,
  );
  const approvalChanged = Boolean(
    latestApprovedVersionNumber &&
    (isDirty || (approvalMatchesWorking === false &&
      proof?.approvedVersionNumber === latestApprovedVersionNumber)),
  );
  const submissionChanged = isDirty || submissionMatchesWorking === false;
  const submittedTargetCurrent = Boolean(
    latestSubmittedVersionId &&
    reviewTargetVersionId === latestSubmittedVersionId &&
    !isDirty &&
    // Review-only roles cannot call the editor-only version listing RPC;
    // their exact immutable submitted target remains reviewable.
    (submissionMatchesWorking === true || !canEdit),
  );
  const awaitingReview = latestReviewAction === "submitted";
  // A live Article retains its active public snapshot while a new working
  // version is prepared. Require loaded, immutable version evidence.
  const workingAfterPublication = Boolean(
    published && proof && latestPublishedVersionNumber != null &&
    proof.latestVersionNumber != null &&
    (proof.latestVersionNumber > latestPublishedVersionNumber || isDirty)
  );
  const canSubmitWorkingVersion = Boolean(
    canEdit && allowSubmitForReview && wpStatus !== "future" &&
    (published
      ? (
        (latestReviewAction === "published" && workingAfterPublication) ||
        (latestReviewAction === "approved" && approvalChanged) ||
        (awaitingReview && submissionChanged) ||
        latestReviewAction === "changes_requested"
      )
      : (
        (latestReviewAction === "approved" && approvalChanged) ||
        (awaitingReview && submissionChanged) ||
        latestReviewAction === "changes_requested" ||
        ((!latestReviewAction || latestReviewAction === "draft") &&
          (wpStatus === "draft" || !wpStatus))
      )
    ),
  );
  const canDecideSubmittedVersion = Boolean(
    canReview && (wpStatus === "pending" || published) && awaitingReview &&
    submittedTargetCurrent,
  );
  const canPublishApprovedVersion = Boolean(
    canPublish && !isDirty && latestReviewAction === "approved" &&
    (approvedProofCurrent || (!canEdit && Boolean(latestApprovedVersionNumber))),
  );
  const workingChangesNeedReview = Boolean(
    (latestReviewAction === "approved" && approvalChanged) ||
    (awaitingReview && submissionChanged) ||
    (latestReviewAction === "published" && workingAfterPublication) ||
    (published && latestReviewAction === "changes_requested"),
  );
  let editorialStatusLabel: string;
  let editorialStatusColorKey: string;
  if (published) {
    editorialStatusLabel = workingChangesNeedReview
      ? "Published · Changes Need Review"
      : awaitingReview ? "Published · In Review"
      : latestReviewAction === "approved" && canPublishApprovedVersion
        ? "Published · Update Approved"
        : "Published";
    editorialStatusColorKey = "publish";
  } else if (wpStatus === "future") {
    editorialStatusLabel = "Scheduled";
    editorialStatusColorKey = "future";
  } else if (wpStatus === "trash") {
    editorialStatusLabel = "Archived";
    editorialStatusColorKey = "trash";
  } else if (workingChangesNeedReview) {
    editorialStatusLabel = "Changes Need Review";
    editorialStatusColorKey = "changes_requested";
  } else if (latestReviewAction === "approved" &&
    (approvedProofCurrent || (!canEdit && Boolean(latestApprovedVersionNumber)))) {
    editorialStatusLabel = "Approved for Publication";
    editorialStatusColorKey = "approved";
  } else if (latestReviewAction === "changes_requested") {
    editorialStatusLabel = "Changes Requested";
    editorialStatusColorKey = "changes_requested";
  } else if (awaitingReview && submittedTargetCurrent) {
    editorialStatusLabel = "Pending Review";
    editorialStatusColorKey = "pending";
  } else if (latestReviewAction === "approved" || awaitingReview || wpStatus === "pending") {
    editorialStatusLabel = "Review Verification Required";
    editorialStatusColorKey = "pending";
  } else {
    editorialStatusLabel = "Draft";
    editorialStatusColorKey = "draft";
  }

  let publishDisabledReason: string | null = null;
  if (!canPublishApprovedVersion) {
    if (!canPublish) {
      publishDisabledReason = "Your account does not have permission to publish Articles.";
    } else if (isDirty) {
      publishDisabledReason = "Save your current changes before publishing the approved Article version.";
    } else if (workingChangesNeedReview) {
      publishDisabledReason =
        "The working Article changed since its last reviewed version. Submit the updated version for approval; the current publication remains live.";
    } else if (awaitingReview) {
      publishDisabledReason = "The submitted Article version is awaiting a new review decision.";
    } else if (latestReviewAction === "approved") {
      publishDisabledReason = "Verifying the exact approved Article version. Refresh if this persists.";
    } else if (latestReviewAction === "changes_requested") {
      publishDisabledReason = "Submit the revised Article version for editorial review.";
    } else {
      publishDisabledReason = "Submit and approve an Article version before publishing.";
    }
  }
  return {
    canSubmitWorkingVersion,
    canApproveSubmittedVersion: canDecideSubmittedVersion,
    canRequestChanges: canDecideSubmittedVersion,
    canPublishApprovedVersion,
    workingChangesNeedReview,
    hasChangesAfterApproval: approvalChanged,
    editorialStatusLabel,
    editorialStatusColorKey,
    publishDisabledReason,
  };
}

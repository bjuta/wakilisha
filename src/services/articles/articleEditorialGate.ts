/**
 * Article editorial authority is version-bound, never inferred from wp_status.
 * wp_status can legitimately stay "pending" after an approved immutable version
 * while the writer saves a newer working version.
 *
 * All transitions fail closed when review/version evidence is not yet loaded.
 * This model drives both the inline editor controls and the Review workspace.
 */
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

function sameFingerprint(a: string | null | undefined, b: string | null | undefined): boolean | null {
  if (!a || !b) return null; // No authority to assume equivalence.
  return a === b;
}

export function deriveArticleEditorialGate(input: ArticleEditorialGateInput): ArticleEditorialGate {
  const {
    wpStatus, latestReviewAction, latestApprovedVersionNumber,
    latestSubmittedVersionId, reviewTargetVersionId,
    isDirty, canEdit, allowSubmitForReview, canReview, canPublish, proof,
  } = input;
  const live = wpStatus === "publish" || wpStatus === "future";
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
    submissionMatchesWorking === true &&
    !isDirty,
  );
  const awaitingReview = latestReviewAction === "submitted";
  const canSubmitWorkingVersion = Boolean(
    canEdit && allowSubmitForReview && !live &&
    (
      (latestReviewAction === "approved" && approvalChanged) ||
      (awaitingReview && submissionChanged) ||
      latestReviewAction === "changes_requested" ||
      ((!latestReviewAction || latestReviewAction === "draft") &&
        (wpStatus === "draft" || !wpStatus))
    ),
  );
  const canDecideSubmittedVersion = Boolean(
    canReview && wpStatus === "pending" && awaitingReview &&
    submittedTargetCurrent,
  );
  const canPublishApprovedVersion = Boolean(
    canPublish && !isDirty && latestReviewAction === "approved" &&
    approvedProofCurrent,
  );
  const workingChangesNeedReview = Boolean(
    (latestReviewAction === "approved" && approvalChanged) ||
    (awaitingReview && submissionChanged),
  );
  let editorialStatusLabel: string;
  let editorialStatusColorKey: string;
  if (wpStatus === "publish") {
    editorialStatusLabel = "Published";
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
  } else if (latestReviewAction === "approved" && approvedProofCurrent) {
    editorialStatusLabel = "Approved for Publication";
    editorialStatusColorKey = "approved";
  } else if (latestReviewAction === "changes_requested") {
    editorialStatusLabel = "Changes Requested";
    editorialStatusColorKey = "changes_requested";
  } else if (awaitingReview && submissionMatchesWorking === true) {
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
    if (workingChangesNeedReview) {
      publishDisabledReason =
        "The working Article changed since its last reviewed version. Resubmit the current version for approval.";
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

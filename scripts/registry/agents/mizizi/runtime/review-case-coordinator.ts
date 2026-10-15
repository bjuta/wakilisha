/**
 * MIZIZI Headquarters Slice 1: trusted, resumable review-to-case convergence.
 *
 * Stage 1: the EXISTING narrow Registry review broker materializes or finds an
 * eligible human review under its own approved role.
 * Stage 2: the separately authorized case runtime admits its stable DB02 case.
 * Stage 3: DB02 links the existing review through immutable typed receipts.
 *
 * There is intentionally no new queue, browser writer, job, Registry mutation,
 * new authority grant, or fake cross-database atomic transaction. Stage 1 can
 * commit before Stage 2/3. Failures retain the review ID and MUST be retried
 * with the same finding, existing broker and authorized case scope.
 */
import { findingToCaseCandidateV1 } from "./case-adapter";
import { admitMiziziFindingCaseV1, type CaseAdmissionResultV1, type CaseDbPoolV1 } from "./case-journal";
import { attachExistingMiziziReviewV1, type ReviewReceiptResultV1 } from "./case-review-receipt";
import type { MiziziFinding } from "../core";

export const REVIEW_CASE_COORDINATOR_CONTRACT = "mizizi.review_case_coordinator.v1" as const;
export type ExistingReviewBrokerLaneV1 =
  | "queue_registry_review_v1"
  | "queue_public_music_identity_review_v1";

/** The existing, separately authorized review broker is injected, not reimplemented. */
export type ExistingReviewBrokerV1 = Readonly<{
  materializeReview: (
    lane: ExistingReviewBrokerLaneV1,
    finding: Readonly<MiziziFinding>,
  ) => Promise<string>;
}>;

export type ReviewCaseConvergenceStageV1 =
  | "review_broker"
  | "case_admission"
  | "receipt_link"
  | "manual_reopen";

export class ReviewCaseConvergenceErrorV1 extends Error {
  readonly contract = REVIEW_CASE_COORDINATOR_CONTRACT;
  readonly stage: ReviewCaseConvergenceStageV1;
  readonly reviewItemId: string | null;
  readonly caseId: string | null;
  override readonly cause: unknown;

  constructor(stage: ReviewCaseConvergenceStageV1, reviewItemId: string | null,
    caseId: string | null, cause: unknown) {
    super(`MIZIZI review/case convergence blocked during ${stage}. Replay the same accepted finding after correcting the cause.`);
    this.name = "ReviewCaseConvergenceErrorV1";
    this.stage = stage;
    this.reviewItemId = reviewItemId;
    this.caseId = caseId;
    this.cause = cause;
  }
}

const REVIEW_UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * These are the EXACT currently accepted review-broker contracts, not all
 * MIZIZI findings or all Registry categories. Provenance attestations,
 * chart-link reviews and chart-label reviews retain their own authorities.
 */
export function existingMiziziReviewBrokerLaneV1(
  finding: Readonly<MiziziFinding>,
): ExistingReviewBrokerLaneV1 {
  if (finding.disposition !== "review" || !REVIEW_UUID.test(finding.entityId)) {
    throw new TypeError("MIZIZI case coordinator: no eligible bounded human-review finding");
  }
  if (finding.entityType === "track" &&
      finding.ruleId === "track_slug_identity_noise" &&
      (finding.ruleVersion === "1.1.0" || finding.ruleVersion === "1.2.0")) {
    return "queue_registry_review_v1";
  }
  if (finding.entityType === "release" &&
      finding.ruleId === "release_slug_provider_packaging" &&
      finding.ruleVersion === "1.2.0") {
    return "queue_registry_review_v1";
  }
  if (finding.entityType === "track" &&
      (finding.ruleId === "track_slug_credit_evidence_gap" ||
        finding.ruleId === "track_recording_identity_conflict") &&
      finding.ruleVersion === "1.3.0") {
    return "queue_public_music_identity_review_v1";
  }
  throw new TypeError("MIZIZI case coordinator: finding lacks an approved existing review broker lane");
}

export type ReviewCaseConvergenceInputV1 = Readonly<{
  workspaceId: string;
  policyRulesetVersion: string;
  finding: Readonly<MiziziFinding>;
}>;

export type ReviewCaseConvergenceResultV1 = Readonly<{
  contract: typeof REVIEW_CASE_COORDINATOR_CONTRACT;
  reviewItemId: string;
  caseAdmission: CaseAdmissionResultV1;
  receipt: ReviewReceiptResultV1;
  state: "review_case_linked";
}>;

export async function convergeExistingMiziziReviewCaseV1(
  runtime: Readonly<{
    existingReviewBroker: ExistingReviewBrokerV1;
    authorizedCasePool: CaseDbPoolV1;
  }>,
  input: ReviewCaseConvergenceInputV1,
): Promise<ReviewCaseConvergenceResultV1> {
  // Must fail before contacting a broker if the claim/rule/workspace is outside
  // the DB02 adapter and the exact existing broker allowlist.
  const lane = existingMiziziReviewBrokerLaneV1(input.finding);
  findingToCaseCandidateV1(input);

  let reviewItemId: string;
  try {
    reviewItemId = await runtime.existingReviewBroker.materializeReview(lane, input.finding);
    if (typeof reviewItemId !== "string" || !REVIEW_UUID.test(reviewItemId)) {
      throw new Error("Existing review broker did not return one valid review UUID");
    }
  } catch (cause) {
    throw new ReviewCaseConvergenceErrorV1("review_broker", null, null, cause);
  }

  let caseAdmission: CaseAdmissionResultV1;
  try {
    caseAdmission = await admitMiziziFindingCaseV1(runtime.authorizedCasePool, input);
  } catch (cause) {
    throw new ReviewCaseConvergenceErrorV1("case_admission", reviewItemId, null, cause);
  }
  if (caseAdmission.status === "requires_manual_reopen") {
    throw new ReviewCaseConvergenceErrorV1(
      "manual_reopen", reviewItemId, caseAdmission.caseId,
      new Error("Existing case requires an independently authorized human reopening"),
    );
  }

  let receipt: ReviewReceiptResultV1;
  try {
    receipt = await attachExistingMiziziReviewV1(runtime.authorizedCasePool, {
      ...input, admission: caseAdmission, reviewItemId,
    });
    if (receipt.caseId !== caseAdmission.caseId || receipt.reviewItemId !== reviewItemId) {
      throw new Error("Case review receipt identity does not match accepted broker and case");
    }
  } catch (cause) {
    throw new ReviewCaseConvergenceErrorV1("receipt_link", reviewItemId, caseAdmission.caseId, cause);
  }

  return {
    contract: REVIEW_CASE_COORDINATOR_CONTRACT,
    reviewItemId, caseAdmission, receipt, state: "review_case_linked",
  };
}

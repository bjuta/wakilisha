/**
 * Slice 1 trusted research admission, on the existing mizizi_executor JIT session.
 *
 * Stage A reuses the real Registry review broker and DB02 case/receipt gateway.
 * Stage B reuses the shared typed jobs/receipt/outbox gateway.
 *
 * The two commands are NOT one transaction. On interruption, repeat the same
 * finding and reason. No human decision, case-stage promotion, Registry write,
 * credential minting, worker claim, new queue or browser action lives here.
 */
import type { MiziziFinding } from "../core";
import { findingToCaseCandidateV1 } from "./case-adapter";
import { existingMiziziReviewBrokerLaneV1 } from "./review-case-coordinator";
import {
  admitReviewedFindingViaTrustedGatewayV1,
  type ExistingJitExecutorQueryV1,
  type TrustedCaseGatewayResultV1,
} from "./trusted-review-case-gateway";
import {
  admitResearchJobViaTrustedGatewayV1,
  fingerprintHeadquartersResearchRequestV1,
  type TrustedResearchJobReceiptV1,
} from "./shared-job-adapter";

export const REVIEW_CASE_RESEARCH_FLOW_CONTRACT = "mizizi.review_case_research_flow.v1" as const;

export type ReviewCaseResearchFlowInputV1 = Readonly<{
  workspaceId: string;
  policyRulesetVersion: string;
  finding: Readonly<MiziziFinding>;
  /** The system may request a job only after a separate authorized case transition. */
  action: "review_case_only" | "admit_ready_research";
  researchReason: string;
}>;

export type ReviewCaseResearchFlowReceiptV1 = Readonly<{
  contract: typeof REVIEW_CASE_RESEARCH_FLOW_CONTRACT;
  review: TrustedCaseGatewayResultV1;
  job: TrustedResearchJobReceiptV1 | null;
  state: "review_case_admitted" | "research_job_admitted";
}>;

export type ReviewCaseResearchFlowStageV1 = "review_case" | "research_job";

export class ReviewCaseResearchFlowErrorV1 extends Error {
  readonly contract = REVIEW_CASE_RESEARCH_FLOW_CONTRACT;
  readonly stage: ReviewCaseResearchFlowStageV1;
  readonly reviewItemId: string | null;
  readonly caseId: string | null;
  readonly receiptLinkId: string | null;
  override readonly cause: unknown;

  constructor(stage: ReviewCaseResearchFlowStageV1,
    review: TrustedCaseGatewayResultV1 | null, cause: unknown) {
    super(stage === "review_case"
      ? "MIZIZI review/case admission failed. Correct the source and retry the same finding."
      : "MIZIZI case is recorded, but research admission failed. Preserve the case and retry the same request after correcting the cause.");
    this.name = "ReviewCaseResearchFlowErrorV1";
    this.stage = stage;
    this.reviewItemId = review?.reviewItemId ?? null;
    this.caseId = review?.caseId ?? null;
    this.receiptLinkId = review?.receiptLinkId ?? null;
    this.cause = cause;
  }
}

/** Stable across restarts. A changed reason conflicts at the SQL fingerprint gate. */
export function caseResearchIdempotencyKeyV1(caseId: string, revision: number): string {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(caseId) ||
      !Number.isSafeInteger(revision) || revision < 1) {
    throw new TypeError("MIZIZI_RESEARCH_INVALID_IDEMPOTENCY_IDENTITY");
  }
  return `mizizi.case_research_v1.${caseId.toLowerCase()}.${revision}`;
}

/**
 * Existing SQL gateways independently verify the exact JIT session, live
 * subject, case revision, stage, binding and typed job command. A new case is
 * in triage, so the caller must use review_case_only until an authorized
 * operator transition to research has actually committed.
 */
export async function admitReviewedCaseResearchV1(
  executor: ExistingJitExecutorQueryV1,
  input: ReviewCaseResearchFlowInputV1,
): Promise<ReviewCaseResearchFlowReceiptV1> {
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("MIZIZI_RESEARCH_TRUSTED_EXECUTOR_REQUIRED");
  }
  existingMiziziReviewBrokerLaneV1(input?.finding);
  findingToCaseCandidateV1(input);
  if (input.action !== "review_case_only" && input.action !== "admit_ready_research") {
    throw new TypeError("MIZIZI_RESEARCH_INVALID_ACTION");
  }
  const reason = input.researchReason?.trim();
  if (typeof reason !== "string" || reason.length < 8 || reason.length > 2000) {
    throw new TypeError("MIZIZI_RESEARCH_INVALID_REASON");
  }

  let review: TrustedCaseGatewayResultV1;
  try {
    review = await admitReviewedFindingViaTrustedGatewayV1(executor, {
      workspaceId: input.workspaceId,
      policyRulesetVersion: input.policyRulesetVersion,
      finding: input.finding,
    });
  } catch (cause) {
    throw new ReviewCaseResearchFlowErrorV1("review_case", null, cause);
  }

  if (input.action === "review_case_only") {
    return Object.freeze({contract: REVIEW_CASE_RESEARCH_FLOW_CONTRACT,
      review, job: null, state: "review_case_admitted"});
  }

  const jobRequest = {
    caseId: review.caseId,
    workspaceId: input.workspaceId,
    expectedRevision: review.caseRevision,
    principalKey: "system:mizizi" as const,
    operation: "read_only_research" as const,
    reason,
    idempotencyKey: caseResearchIdempotencyKeyV1(review.caseId, review.caseRevision),
    requestFingerprint: fingerprintHeadquartersResearchRequestV1({
      caseId: review.caseId, workspaceId: input.workspaceId,
      expectedRevision: review.caseRevision, reason,
    }),
  };

  try {
    const job = await admitResearchJobViaTrustedGatewayV1(executor, jobRequest);
    if (job.caseId !== review.caseId.toLowerCase() ||
        job.workspaceId !== input.workspaceId.toLowerCase() ||
        job.caseRevision !== review.caseRevision) {
      throw new Error("MIZIZI_RESEARCH_INCONSISTENT_CASE_JOB_RECEIPT");
    }
    return Object.freeze({contract: REVIEW_CASE_RESEARCH_FLOW_CONTRACT,
      review, job, state: "research_job_admitted"});
  } catch (cause) {
    throw new ReviewCaseResearchFlowErrorV1("research_job", review, cause);
  }
}

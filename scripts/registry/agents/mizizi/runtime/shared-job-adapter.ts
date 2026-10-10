/**
 * Headquarters-to-platform-private jobs compatibility boundary.
 *
 * A MIZIZI case UUID is NOT an editorial resource by itself. The SQL admission
 * gateway must first establish a typed, immutable case/resource binding.
 * This module is a pure, fail-closed command planner; it never inserts rows,
 * grants capabilities, claims a lease, or starts a canonical mutation.
 */

export const MIZIZI_CASE_COMMAND = "mizizi.case_research_v1" as const;
export const MIZIZI_CASE_JOB = "mizizi.case_research_v1" as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const ACTOR = /^system:[a-z][a-z0-9_.:-]{1,99}$/;

export type HeadquartersJobBinding = Readonly<{
  caseId: string;
  workspaceId: string;
  resourceId: string;
  resourceKind: "mizizi_case";
  boundCaseId: string;
  boundWorkspaceId: string;
  currentCaseRevision: number;
  expectedCaseRevision: number;
  caseState: "open" | "held" | "done_for_now" | "closed";
  currentStage: string;
  activeWriteHold: boolean;
  bindingVerifiedAt: string;
}>;

export type HeadquartersJobRequest = Readonly<{
  principalKey: string;
  idempotencyKey: string;
  requestFingerprint: string;
  caseId: string;
  workspaceId: string;
  expectedRevision: number;
  operation: "read_only_research";
  reason: string;
}>;

export type HeadquartersSharedJobPlan = Readonly<{
  commandType: typeof MIZIZI_CASE_COMMAND;
  jobType: typeof MIZIZI_CASE_JOB;
  resourceId: string;
  principalKey: string;
  idempotencyKey: string;
  requestFingerprint: string;
  jobKey: string;
  inputPayload: Readonly<{
    case_id: string;
    workspace_id: string;
    expected_case_revision: number;
    operation: "read_only_research";
    reason: string;
  }>;
}>;

/**
 * Not an authorization mechanism: calling code must acquire the verified
 * binding from a trusted SQL gateway in the same admission transaction.
 * A Hold Writes flag does not block read-only research. The database must
 * recheck admission/revision and serialize any subsequent write operation.
 */
export function planHeadquartersSharedJob(
  request: HeadquartersJobRequest,
  binding: HeadquartersJobBinding,
): HeadquartersSharedJobPlan {
  if (!UUID.test(request.caseId) || !UUID.test(request.workspaceId) ||
      !UUID.test(binding.caseId) || !UUID.test(binding.workspaceId) ||
      !UUID.test(binding.resourceId) || !UUID.test(binding.boundCaseId) ||
      !UUID.test(binding.boundWorkspaceId)) {
    throw new Error("MIZIZI_JOB_INVALID_IDENTITY");
  }
  if (binding.resourceKind !== "mizizi_case" ||
      request.caseId.toLowerCase() !== binding.caseId.toLowerCase() ||
      request.caseId.toLowerCase() !== binding.boundCaseId.toLowerCase() ||
      request.caseId.toLowerCase() !== binding.resourceId.toLowerCase() ||
      request.workspaceId.toLowerCase() !== binding.workspaceId.toLowerCase() ||
      request.workspaceId.toLowerCase() !== binding.boundWorkspaceId.toLowerCase()) {
    throw new Error("MIZIZI_JOB_UNBOUND_RESOURCE");
  }
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1 ||
      !Number.isSafeInteger(binding.currentCaseRevision) ||
      binding.currentCaseRevision !== request.expectedRevision ||
      binding.expectedCaseRevision !== request.expectedRevision) {
    throw new Error("MIZIZI_JOB_STALE_CASE_REVISION");
  }
  if (binding.caseState !== "open" || binding.currentStage !== "research") {
    throw new Error("MIZIZI_JOB_CASE_NOT_ADMISSIBLE");
  }
  if (request.operation !== "read_only_research" || !ACTOR.test(request.principalKey) ||
      !KEY.test(request.idempotencyKey) || !SHA256.test(request.requestFingerprint) ||
      typeof request.reason !== "string" || request.reason.trim().length < 8 ||
      request.reason.length > 2000 ||
      !Number.isFinite(Date.parse(binding.bindingVerifiedAt))) {
    throw new Error("MIZIZI_JOB_INVALID_COMMAND");
  }

  return Object.freeze({
    commandType: MIZIZI_CASE_COMMAND,
    jobType: MIZIZI_CASE_JOB,
    resourceId: binding.resourceId.toLowerCase(),
    principalKey: request.principalKey,
    idempotencyKey: request.idempotencyKey,
    requestFingerprint: request.requestFingerprint,
    jobKey: `research:${request.expectedRevision}`,
    inputPayload: Object.freeze({
      case_id: request.caseId.toLowerCase(),
      workspace_id: request.workspaceId.toLowerCase(),
      expected_case_revision: request.expectedRevision,
      operation: "read_only_research" as const,
      reason: request.reason.trim(),
    }),
  });
}

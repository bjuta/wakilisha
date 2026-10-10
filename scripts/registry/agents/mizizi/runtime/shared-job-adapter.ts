import { createHash } from "node:crypto";

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


export type HeadquartersJobBinding = Readonly<{
  caseId: string;
  workspaceId: string;
  resourceId: string;
  resourceKind: "mizizi_case";
  boundCaseId: string;
  boundWorkspaceId: string;
  currentCaseRevision: number;
  expectedCaseRevision: number;
  caseState: "open" | "in_progress" | "held" | "done_for_now" | "closed";
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

/** PostgreSQL gateway recomputes these same UTF-8 bytes independently. */
export function fingerprintHeadquartersResearchRequestV1(
  request: Pick<HeadquartersJobRequest, "caseId" | "workspaceId" | "expectedRevision" | "reason">,
): string {
  if (!request || !UUID.test(request.caseId) || !UUID.test(request.workspaceId) ||
      !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1 ||
      typeof request.reason !== "string" || request.reason.trim().length < 8 ||
      request.reason.length > 2000) {
    throw new Error("MIZIZI_JOB_INVALID_FINGERPRINT_INPUT");
  }
  const canonical = [request.caseId.toLowerCase(), request.workspaceId.toLowerCase(),
    String(request.expectedRevision), "read_only_research", request.reason.trim()].join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

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
  if (!["open", "in_progress"].includes(binding.caseState) || binding.currentStage !== "research") {
    throw new Error("MIZIZI_JOB_CASE_NOT_ADMISSIBLE");
  }
  if (request.operation !== "read_only_research" || request.principalKey !== "system:mizizi" ||
      !KEY.test(request.idempotencyKey) || !SHA256.test(request.requestFingerprint) ||
      typeof request.reason !== "string" || request.reason.trim().length < 8 ||
      request.reason.length > 2000 ||
      !Number.isFinite(Date.parse(binding.bindingVerifiedAt))) {
    throw new Error("MIZIZI_JOB_INVALID_COMMAND");
  }
  if (request.requestFingerprint !== fingerprintHeadquartersResearchRequestV1(request)) {
    throw new Error("MIZIZI_JOB_FINGERPRINT_MISMATCH");
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


/**
 * Trusted execution seam for a case research job. No long-lived connection,
 * browser exposure, table DML, or privileged credential issuance lives here.
 * The SQL gateway, once installed by a replay-proven migration, must lock the
 * case, establish its exact editorial resource binding, verify the request
 * fingerprint, and atomically write the shared receipt/job/outbox rows.
 *
 * IMPORTANT: This caller does not make the RPC available by itself.
 */
export type TrustedResearchJobExecutorV1 = Readonly<{
  query: <T = Record<string, unknown>>(
    sql: string, values: readonly unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}>;

type ResearchJobGatewayRowV1 = {
  case_id: string;
  workspace_id: string;
  resource_id: string;
  case_revision: number;
  command_receipt_id: string;
  job_id: string;
  job_status: string;
  outcome: string;
};

export type TrustedResearchJobReceiptV1 = Readonly<{
  caseId: string;
  workspaceId: string;
  resourceId: string;
  caseRevision: number;
  commandReceiptId: string;
  jobId: string;
  jobStatus: "queued" | "running" | "retry_wait" | "succeeded";
  outcome: "created" | "replayed";
}>;

function validateResearchJobRequestV1(request: HeadquartersJobRequest): void {
  if (!request ||
      !UUID.test(request.caseId) || !UUID.test(request.workspaceId) ||
      !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1 ||
      request.operation !== "read_only_research" ||
      request.principalKey !== "system:mizizi" ||
      !KEY.test(request.idempotencyKey) ||
      !SHA256.test(request.requestFingerprint) ||
      typeof request.reason !== "string" ||
      request.reason.trim().length < 8 || request.reason.length > 2000) {
    throw new Error("MIZIZI_JOB_INVALID_COMMAND");
  }
  if (request.requestFingerprint !== fingerprintHeadquartersResearchRequestV1(request)) {
    throw new Error("MIZIZI_JOB_FINGERPRINT_MISMATCH");
  }
}

export async function admitResearchJobViaTrustedGatewayV1(
  executor: TrustedResearchJobExecutorV1,
  request: HeadquartersJobRequest,
): Promise<TrustedResearchJobReceiptV1> {
  validateResearchJobRequestV1(request);
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("Approved JIT research-job executor connection is required");
  }
  const result = await executor.query<ResearchJobGatewayRowV1>(
    `select case_id::text, workspace_id::text, resource_id::text,
            case_revision, command_receipt_id::text, job_id::text,
            job_status, outcome
       from mizizi_private.admit_case_research_job_v1(
            $1::uuid, $2::uuid, $3::integer,
            $4::text, $5::text, $6::text, $7::text)`,
    [request.caseId, request.workspaceId, request.expectedRevision,
      request.principalKey, request.idempotencyKey,
      request.requestFingerprint, request.reason.trim()],
  );
  if (result.rowCount !== 1 || result.rows.length !== 1) {
    throw new Error("MIZIZI_JOB_GATEWAY_INCOMPLETE_RECEIPT");
  }
  const row = result.rows[0];
  if (!row || !UUID.test(row.case_id) || !UUID.test(row.workspace_id) ||
      !UUID.test(row.resource_id) ||
      !UUID.test(row.command_receipt_id) || !UUID.test(row.job_id) ||
      row.case_id.toLowerCase() !== request.caseId.toLowerCase() ||
      row.workspace_id.toLowerCase() !== request.workspaceId.toLowerCase() ||
      row.resource_id.toLowerCase() !== request.caseId.toLowerCase() ||
      row.case_revision !== request.expectedRevision ||
      !["queued", "running", "retry_wait", "succeeded"].includes(row.job_status) ||
      !["created", "replayed"].includes(row.outcome)) {
    throw new Error("MIZIZI_JOB_GATEWAY_UNTRUSTED_RESULT");
  }
  return Object.freeze({
    caseId: row.case_id.toLowerCase(),
    workspaceId: row.workspace_id.toLowerCase(),
    resourceId: row.resource_id.toLowerCase(),
    caseRevision: row.case_revision,
    commandReceiptId: row.command_receipt_id.toLowerCase(),
    jobId: row.job_id.toLowerCase(),
    jobStatus: row.job_status as TrustedResearchJobReceiptV1["jobStatus"],
    outcome: row.outcome as TrustedResearchJobReceiptV1["outcome"],
  });
}

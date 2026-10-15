/**
 * MIZIZI Headquarters Slice 1: narrow SQL gateway caller.
 *
 * The ONLY backed command path for a trusted mizizi_executor JIT session.
 * This does not mint a credential, execute human decisions, create jobs,
 * authorize a browser, or access the private case table directly.
 * It is intentionally NOT wired to the legacy CLI until the gateway
 * passes Preview SQL, exact-role, and real rollback acceptance.
 */
import { findingToCaseCandidateV1 } from "./case-adapter";
import { existingMiziziReviewBrokerLaneV1 } from "./review-case-coordinator";
import type { MiziziFinding } from "../core";

export const TRUSTED_CASE_GATEWAY_CONTRACT = "mizizi.trusted_review_case_gateway.v1" as const;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type ExistingJitExecutorQueryV1 = Readonly<{
  query: <T = Record<string, unknown>>(
    sql: string, values: readonly unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}>;

type GatewayRowV1 = {
  review_item_id: string;
  headquarters_case_id: string;
  headquarters_case_revision: number;
  receipt_link_id: string;
  outcome: string;
};

export type TrustedCaseGatewayResultV1 = Readonly<{
  contract: typeof TRUSTED_CASE_GATEWAY_CONTRACT;
  reviewItemId: string;
  caseId: string;
  caseRevision: number;
  receiptLinkId: string;
  outcome: "created" | "unchanged" | "observation_recorded";
}>;

export async function admitReviewedFindingViaTrustedGatewayV1(
  executor: ExistingJitExecutorQueryV1,
  input: Readonly<{
    workspaceId: string;
    policyRulesetVersion: string;
    finding: Readonly<MiziziFinding>;
  }>,
): Promise<TrustedCaseGatewayResultV1> {
  // Validate exact existing broker lane and DB02 persistence identity BEFORE SQL.
  existingMiziziReviewBrokerLaneV1(input.finding);
  const candidate = findingToCaseCandidateV1(input);
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("Approved JIT executor connection is required");
  }

  const response = await executor.query<GatewayRowV1>(
    `select review_item_id::text,headquarters_case_id::text,
      headquarters_case_revision,receipt_link_id::text,outcome
     from mizizi_private.admit_review_case_gateway_v1($1::uuid,$2::text,$3::jsonb)`,
    [candidate.persistence.workspace_id, candidate.persistence.policy_ruleset_version,
      JSON.stringify(input.finding)],
  );
  if (response.rowCount !== 1 || response.rows.length !== 1) {
    throw new Error("MIZIZI gateway did not return exactly one receipt-backed case");
  }
  const row = response.rows[0];
  if (!UUID.test(row.review_item_id) || !UUID.test(row.headquarters_case_id) ||
      !UUID.test(row.receipt_link_id) ||
      !Number.isSafeInteger(row.headquarters_case_revision) ||
      row.headquarters_case_revision < 1 ||
      !["created", "unchanged", "observation_recorded"].includes(row.outcome)) {
    throw new Error("MIZIZI gateway returned an invalid command receipt contract");
  }
  return {
    contract: TRUSTED_CASE_GATEWAY_CONTRACT,
    reviewItemId: row.review_item_id,
    caseId: row.headquarters_case_id,
    caseRevision: row.headquarters_case_revision,
    receiptLinkId: row.receipt_link_id,
    outcome: row.outcome as TrustedCaseGatewayResultV1["outcome"],
  };
}

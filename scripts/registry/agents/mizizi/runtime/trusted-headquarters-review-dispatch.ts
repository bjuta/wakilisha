/**
 * Narrow opt-in MIZIZI agent entry to the existing DB02 trusted review-case gateway.
 * No new broker, credential, canonical mutation, case writer or job claim.
 * This is restricted to the real, short-lived mizizi_executor login.
 */
import type { MiziziFinding } from "../core";
import { existingMiziziReviewBrokerLaneV1 } from "./review-case-coordinator";
import { admitReviewedFindingViaTrustedGatewayV1 } from "./trusted-review-case-gateway";

export type TrustedHeadquartersQueryV1 = (
  sql:string, values:readonly unknown[],
)=>Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function createTrustedHeadquartersReviewDispatcherV1(
  query:TrustedHeadquartersQueryV1,
  workspaceId:string,
  policyRulesetVersion:string,
):Promise<(finding:Readonly<MiziziFinding>,extraEvidence:Record<string,unknown>) =>
  Promise<Readonly<{reviewItemId:string;caseId:string;receiptLinkId:string;caseRevision:number}>>> {
  if(typeof query!=="function"||!UUID.test(workspaceId)||
     !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(policyRulesetVersion))
    throw new TypeError("MIZIZI_HEADQUARTERS_INVALID_JIT_DISPATCH_AUTHORITY");
  const session=await query("select session_user::text as login_role",[]);
  if(session.rowCount!==1||session.rows?.length!==1||
     session.rows[0]?.login_role!=="mizizi_executor")
    throw new Error("MIZIZI_HEADQUARTERS_REAL_JIT_EXECUTOR_REQUIRED");

  // Convert the existing pg Pool response to the generic trusted SQL contract.
  // The returned row is validated by the established gateway before use.
  const executor={
    query:async <T = Record<string,unknown>>(
      sql:string,values:readonly unknown[],
    ):Promise<{rows:T[];rowCount:number|null}>=>{
      const data=await query(sql,values);
      return {rows:data.rows as T[],rowCount:data.rowCount};
    },
  };
  return async (finding,extraEvidence)=>{
    existingMiziziReviewBrokerLaneV1(finding);
    if(!extraEvidence||Array.isArray(extraEvidence)||
       typeof extraEvidence!=="object")
      throw new TypeError("MIZIZI_HEADQUARTERS_INVALID_EXTRA_EVIDENCE");
    const joinedFinding:Readonly<MiziziFinding>={
      ...finding,evidence:{...finding.evidence,...extraEvidence},
    };
    const result=await admitReviewedFindingViaTrustedGatewayV1(executor,{
      workspaceId,policyRulesetVersion,finding:joinedFinding,
    });
    return Object.freeze({
      reviewItemId:result.reviewItemId,
      caseId:result.caseId,
      receiptLinkId:result.receiptLinkId,
      caseRevision:result.caseRevision,
    });
  };
}

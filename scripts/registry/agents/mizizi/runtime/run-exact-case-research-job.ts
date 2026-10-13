/**
 * Exact-case, JIT-only command for an already human-transitioned research case.
 * Does not mint executor credentials, alter Registry, decide reviews, or claim jobs.
 * The canonical SQL gateway locks/rechecks the case and writes shared receipts.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createRegistryPool } from "../../../phase1-db";
import {
  fingerprintHeadquartersResearchRequestV1,
  admitResearchJobViaTrustedGatewayV1,
  type TrustedResearchJobReceiptV1,
} from "./shared-job-adapter";
import {caseResearchIdempotencyKeyV1} from "./review-case-research-flow";

export type ExactResearchQueryV1=(sql:string,values:readonly unknown[])=>
  Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;
export type ExactResearchCommandV1=Readonly<{
 caseId:string;workspaceId:string;expectedRevision:number;reason:string;
}>;

export async function admitExactCaseResearchJobV1(
 query:ExactResearchQueryV1,input:ExactResearchCommandV1,
):Promise<TrustedResearchJobReceiptV1>{
 if(typeof query!=="function")throw new TypeError("MIZIZI_RESEARCH_JIT_QUERY_REQUIRED");
 const command={
  ...input,
  reason:input?.reason?.trim(),
 };
 const request={
  caseId:command.caseId,
  workspaceId:command.workspaceId,
  expectedRevision:command.expectedRevision,
  reason:command.reason,
  operation:"read_only_research" as const,
  principalKey:"system:mizizi" as const,
  idempotencyKey:caseResearchIdempotencyKeyV1(command.caseId,command.expectedRevision),
  requestFingerprint:fingerprintHeadquartersResearchRequestV1(command),
 };
 const login=await query("select session_user::text as login_role",[]);
 if(login.rowCount!==1||login.rows.length!==1||
    login.rows[0]?.login_role!=="mizizi_executor")
   throw new Error("MIZIZI_RESEARCH_REAL_JIT_LOGIN_REQUIRED");
 const executor={
   query:async <T = Record<string,unknown>>(
     sql:string,values:readonly unknown[],
   ):Promise<{rows:T[];rowCount:number|null}>=>{
     const response=await query(sql,values);
     return {rows:response.rows as T[],rowCount:response.rowCount};
   },
 };
 return admitResearchJobViaTrustedGatewayV1(executor,request);
}

export function parseExactResearchArgsV1(args:readonly string[]):ExactResearchCommandV1{
 const names=new Set(["case-id","workspace-id","revision","reason","confirm"]);
 const values=new Map<string,string>();
 for(const arg of args){
   const eq=arg.indexOf("=");
   if(!arg.startsWith("--")||eq<3)throw new TypeError("MIZIZI_RESEARCH_ARG_FORMAT");
   const name=arg.slice(2,eq),value=arg.slice(eq+1);
   if(!names.has(name)||values.has(name)||!value)throw new TypeError("MIZIZI_RESEARCH_ARG_UNREVIEWED");
   values.set(name,value);
 }
 if(values.size!==names.size||
    values.get("confirm")!=="MIZIZI_JIT_READ_ONLY_CASE_RESEARCH")
   throw new TypeError("MIZIZI_RESEARCH_EXPLICIT_CONFIRMATION_REQUIRED");
 const revisionString=values.get("revision")!;
 if(!/^[1-9][0-9]{0,8}$/.test(revisionString))
   throw new TypeError("MIZIZI_RESEARCH_REVISION_INVALID");
 const command={
   caseId:values.get("case-id")!,
   workspaceId:values.get("workspace-id")!,
   expectedRevision:Number(revisionString),
   reason:values.get("reason")!.trim(),
 };
 if(command.reason.length<12||command.reason.length>1000)
   throw new TypeError("MIZIZI_RESEARCH_REASON_INVALID");
 // Validates strictly before connecting to any privileged database.
 caseResearchIdempotencyKeyV1(command.caseId,command.expectedRevision);
 fingerprintHeadquartersResearchRequestV1(command);
 return Object.freeze(command);
}

async function main():Promise<void>{
 const command=parseExactResearchArgsV1(process.argv.slice(2));
 const pool=createRegistryPool();
 try {
   const receipt=await admitExactCaseResearchJobV1(
     async (sql,values)=>{
       const r=await pool.query(sql,[...values]);
       return {rows:r.rows,rowCount:r.rowCount};
     },
     command,
   );
   console.log("MIZIZI_EXACT_CASE_RESEARCH_JOB_RECEIPT="+JSON.stringify(receipt));
   console.log("MIZIZI_EXACT_CASE_RESEARCH_JOB_ADMISSION=PASS");
 } finally {
   await pool.end();
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{
   // Do not log input credentials or environment secrets.
   const code=typeof error==="object"&&error&&"code" in error
      ? String((error as {code:unknown}).code)
      : error instanceof Error ? error.message : "unknown";
   console.error("MIZIZI_EXACT_CASE_RESEARCH_JOB_ADMISSION=STOP_"+code);
   process.exitCode=1;
 });
}

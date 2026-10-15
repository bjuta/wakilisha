/**
 * Independently authorized JIT-only review -> durable Headquarters case command.
 * Historical production MIZIZI run.ts is SHA-pinned by two accepted control
 * planes and deliberately NOT modified. No new queue or direct DB DML.
 *
 * Input is a separately prepared finding from the approved MIZIZI analyzer.
 * The existing Registry broker rechecks live subject/evidence in the database.
 * Never interpret a JSON file alone as a source-of-truth or an approval.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRegistryPool } from "../../../phase1-db";
import { openMiziziJitSession } from "../../../../control-plane/mizizi-production-jit-runtime.mjs";
import type { MiziziFinding } from "../core";
import { createTrustedHeadquartersReviewDispatcherV1 } from "./trusted-headquarters-review-dispatch";

export const APPROVED_HEADQUARTERS_FINDING_INPUT_V1="mizizi.agent_review_finding.v1" as const;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function parseReviewCaseAdmissionArgsV1(args:readonly string[]):Readonly<{
 workspaceId:string;rulesetVersion:string;findingFile:string;jitProjectRef:string|null;
}> {
 const names=new Set(["workspace-id","ruleset-version","finding-file","confirm","jit-project-ref"]);
 const values=new Map<string,string>();
 for(const arg of args){
   const i=arg.indexOf("=");
   if(!arg.startsWith("--")||i<=2)throw new TypeError("MIZIZI_CASE_ADMISSION_INVALID_ARG");
   const name=arg.slice(2,i),value=arg.slice(i+1);
   if(!names.has(name)||!value||values.has(name))
      throw new TypeError("MIZIZI_CASE_ADMISSION_UNREVIEWED_ARG");
   values.set(name,value);
 }
 if((values.size!==4 && values.size!==5)||
   !["workspace-id","ruleset-version","finding-file","confirm"].every(k=>values.has(k))||
   values.get("confirm")!=="MIZIZI_JIT_REVIEW_CASE_ONLY")
    throw new TypeError("MIZIZI_CASE_ADMISSION_EXPLICIT_CONFIRMATION_REQUIRED");
 const workspaceId=values.get("workspace-id")!;
 const rulesetVersion=values.get("ruleset-version")!;
 const findingFile=values.get("finding-file")!;
 const jitProjectRef=values.get("jit-project-ref")||null;
 if(jitProjectRef!==null && !/^[a-z]{20}$/.test(jitProjectRef))
   throw new TypeError("MIZIZI_CASE_ADMISSION_INVALID_JIT_PROJECT");
 if(!UUID.test(workspaceId)||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(rulesetVersion)||
    !findingFile.startsWith("/")||
    findingFile.includes("\n")||findingFile.includes("\0"))
    throw new TypeError("MIZIZI_CASE_ADMISSION_INVALID_AUTHORITY");
 return Object.freeze({workspaceId,rulesetVersion,findingFile,jitProjectRef});
}

export function loadReviewedMiziziFindingV1(filename:string):Readonly<MiziziFinding>{
 const size=statSync(filename).size;
 if(!Number.isSafeInteger(size)||size<16||size>24576)
   throw new TypeError("MIZIZI_CASE_ADMISSION_INVALID_EVIDENCE_SIZE");
 const value:unknown=JSON.parse(readFileSync(filename,"utf8"));
 if(value===null||typeof value!=="object"||Array.isArray(value))
    throw new TypeError("MIZIZI_CASE_ADMISSION_INVALID_EVIDENCE_RECORD");
 const envelope=value as Record<string,unknown>;
 if(envelope.contract!==APPROVED_HEADQUARTERS_FINDING_INPUT_V1||
    envelope.finding===null||typeof envelope.finding!=="object"||
    Array.isArray(envelope.finding))
    throw new TypeError("MIZIZI_CASE_ADMISSION_UNAPPROVED_FINDING_FORMAT");
 const finding=envelope.finding as MiziziFinding;
 if(!finding.evidence||typeof finding.evidence!=="object"||
    Array.isArray(finding.evidence)||finding.disposition!=="review")
    throw new TypeError("MIZIZI_CASE_ADMISSION_INVALID_FINDING_EVIDENCE");
 return finding;
}

/**
 * Stage C-only JIT admission. The existing helper authenticates the caller,
 * opens a real mizizi_executor pool, then restores original mapping/state.
 * An RPC rejection MUST also trigger cleanup. No new grant/Registry write.
 */
export async function admitReviewViaManagedJitV1(
 input:Readonly<{
   projectRef:string;token:string;workspaceId:string;
   rulesetVersion:string;finding:Readonly<MiziziFinding>;
 }>,
 openSession:typeof openMiziziJitSession=openMiziziJitSession,
):Promise<Readonly<{reviewItemId:string;caseId:string;receiptLinkId:string;caseRevision:number}>>{
 if(!/^[a-z]{20}$/.test(input.projectRef)||!input.token)
   throw new TypeError("MIZIZI_JIT_AUTHORITY_REQUIRED");
 const session=await openSession({projectRef:input.projectRef,token:input.token});
 try{
   const dispatch=await createTrustedHeadquartersReviewDispatcherV1(
     async (sql,values)=>{
       const r=await session.pool.query(sql,[...values]);
       return {rows:r.rows,rowCount:r.rowCount};
     },input.workspaceId,input.rulesetVersion,
   );
   return await dispatch(input.finding,{});
 }finally{
   // Cleanup failures are deliberately fatal: never claim admission success
   // while the Production temporary-access restore is unconfirmed.
   await session.restore();
 }
}

async function main():Promise<void>{
 const args=parseReviewCaseAdmissionArgsV1(process.argv.slice(2));
 const finding=loadReviewedMiziziFindingV1(args.findingFile);
 if(args.jitProjectRef){
   const token=process.env.SUPABASE_ACCESS_TOKEN||"";
   if(!token)throw new TypeError("MIZIZI_JIT_TOKEN_REQUIRED");
   const receipt=await admitReviewViaManagedJitV1({
     projectRef:args.jitProjectRef,token,workspaceId:args.workspaceId,
     rulesetVersion:args.rulesetVersion,finding,
   });
   console.log("MIZIZI_REVIEW_CASE_RECEIPT="+JSON.stringify(receipt));
   console.log("MIZIZI_REVIEW_CASE_ADMISSION=PASS");
   return;
 }
 // Preserve the established separately provisioned executor path in
 // disposable CI. The trusted dispatcher still rejects non-JIT login roles.
 const pool=createRegistryPool();
 try{
   const dispatch=await createTrustedHeadquartersReviewDispatcherV1(
     async (sql,values)=>{
       const r=await pool.query(sql,[...values]);
       return {rows:r.rows,rowCount:r.rowCount};
     },args.workspaceId,args.rulesetVersion,
   );
   const receipt=await dispatch(finding,{});
   console.log("MIZIZI_REVIEW_CASE_RECEIPT="+JSON.stringify(receipt));
   console.log("MIZIZI_REVIEW_CASE_ADMISSION=PASS");
 }finally{await pool.end();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(err=>{
   const code=typeof err==="object"&&err&&"code" in err
     ? String((err as {code:unknown}).code)
     : err instanceof Error?err.message:"unknown";
   console.error("MIZIZI_REVIEW_CASE_ADMISSION=STOP_"+code);
   process.exitCode=1;
 });
}

/** Genuine public-source Preview JIT admission, without Registry writes.
 * Executes only from owner-controlled CI after exact DB05 authority proof.
 * JIT mapping must be restored even on partial case/job failure.
 */
import {createHash} from "node:crypto";
import {
 openMiziziJitSession,queryViaManagementReadOnly
} from "../control-plane/mizizi-production-jit-runtime.mjs";
import {createWikidataInvestigationReaderV1}
 from "../registry/agents/mizizi/runtime/wikidata-investigation-reader-v1.ts";
import {admitExactCaseResearchJobV1}
 from "../registry/agents/mizizi/runtime/run-exact-case-research-job.ts";

const PREVIEW="nkgfoppunmnkcumalxqp";
const PRODUCTION="pgzizndxdyhqmtyywjmt";
const QID="Q97652493";
const QUESTION='What original evidence distinguishes "Jerusalema" (Wikidata Q97652493) as a musical work from similarly titled films, recordings, versions and rights claims?';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function main(){
 const project=process.env.MIZIZI_PREVIEW_PROJECT_REF||"";
 const token=process.env.SUPABASE_ACCESS_TOKEN||"";
 if(project!==PREVIEW||project===PRODUCTION||!token)
  throw new Error("STOP_APPROVED_PREVIEW_MANAGEMENT_AUTHORITY_REQUIRED");
 if(process.env.SUPABASE_PROJECT_REF===PRODUCTION||
    process.env.DATABASE_URL||process.env.DIRECT_URL)
  throw new Error("STOP_AMBIENT_DATABASE_CREDENTIALS_FORBIDDEN");
 const baseline=await queryViaManagementReadOnly({projectRef:PREVIEW,token,
  sql:"select (select count(*)::integer from supabase_migrations.schema_migrations) as migrations,"+
      "(select max(version) from supabase_migrations.schema_migrations) as migration_head,"+
      "(select id::text from mizizi_private.workspaces where workspace_key='wakilisha-internal'"+
      " and workspace_kind='internal' and status='active' limit 1) as workspace_id,"+
      "(select count(*)::integer from public.registry_tracks) as canonical_tracks"});
 if(baseline.migrations!==233||baseline.migration_head!=="20261016092731"||
    !UUID.test(String(baseline.workspace_id||""))||baseline.canonical_tracks!==0)
  throw new Error("STOP_SOURCE_FIRST_PREVIEW_BASELINE_CHANGED");
 const identity={caseId:"00000000-0000-4000-8000-000000000001",
  workspaceId:String(baseline.workspace_id),openingQuestion:QUESTION};
 const reader=createWikidataInvestigationReaderV1({
  authorizePublicQuery:async()=>true
 });
 const evidence=await reader(identity,QUESTION,[]);
 const target=evidence.find(x=>x.source.originKey.startsWith("wikidata:"+QID+":revision:"));
 if(!target||target.source.useBasis!=="open_license"||
   target.source.authorityRef!=="https://www.wikidata.org/wiki/Wikidata:Licensing"||
   target.source.privateResearchAllowed!==true||
   target.source.externalModelProcessingAllowed!==true||
   target.source.privateEvidenceRetentionAllowed!==true)
  throw new Error("STOP_ORIGINAL_CC0_SOURCE_NOT_CONFIRMED");
 const revision=Number(target.source.originKey.split(":").at(-1));
 const parsed=JSON.parse(target.excerpt);
 if(parsed.entityId!==QID||typeof parsed.label!=="string"||
   parsed.label.toLowerCase()!=="jerusalema"||
   !Number.isSafeInteger(revision)||revision<1)
  throw new Error("STOP_ENTITY_IDENTITY_OR_REVISION_MISMATCH");
 const hash=createHash("sha256").update(target.excerpt,"utf8").digest("hex");
 if(hash!==target.source.fingerprint)
  throw new Error("STOP_ORIGINAL_EVIDENCE_HASH_MISMATCH");
 console.log("MIZIZI_AUTHENTIC_CC0_ORIGINAL_SOURCE="+JSON.stringify({
   qid:QID,revision,sourceId:target.source.sourceId,
   payloadFingerprint:hash,licensingPolicy:target.source.authorityRef,
   evidenceLineage:target.source.lineageKey
 }));
 const session=await openMiziziJitSession({projectRef:PREVIEW,
   managementProjectRef:PRODUCTION,token,branchOnly:true});
 try{
  const args=[identity.workspaceId,QID,revision,hash,QUESTION];
  const c=await session.pool.query(
   "select case_id::text,workspace_id::text,case_revision,outcome"+
   " from mizizi_private.admit_external_wikidata_research_v1("+
   "$1::uuid,$2::text,$3::bigint,$4::text,$5::text)",args);
  if(c.rowCount!==1||!UUID.test(c.rows[0]?.case_id)||
    c.rows[0]?.workspace_id!==identity.workspaceId||
    c.rows[0]?.case_revision!==1||
    !["created","replayed"].includes(c.rows[0]?.outcome))
   throw new Error("STOP_EXTERNAL_CASE_RECEIPT_UNVERIFIED");
  console.log("MIZIZI_AUTHENTIC_RESEARCH_CASE="+JSON.stringify(c.rows[0]));
  const receipt=await admitExactCaseResearchJobV1(
   async(sql,values)=>{
    const r=await session.pool.query(sql,[...values]);
    return {rows:r.rows,rowCount:r.rowCount};
   },
   {caseId:c.rows[0].case_id,workspaceId:identity.workspaceId,
    expectedRevision:1,reason:"PUBLIC_CC0_RESEARCH: "+QUESTION});
  if(!["queued","running","succeeded"].includes(receipt.jobStatus))
   throw new Error("STOP_RESEARCH_JOB_RECEIPT_UNEXPECTED");
  console.log("MIZIZI_AUTHENTIC_SOURCE_BOUND_JOB="+JSON.stringify({
   caseId:receipt.caseId,jobId:receipt.jobId,
   commandReceiptId:receipt.commandReceiptId,
   revision:receipt.caseRevision,jobStatus:receipt.jobStatus,
   admissionOutcome:receipt.outcome
  }));
 }finally{
  await session.restore();
 }
 console.log("MIZIZI_PREVIEW_REAL_CASE_AND_JOB_ADMISSION=PASS");
}
main().catch(e=>{
 console.error("MIZIZI_PREVIEW_REAL_CASE_ADMISSION=STOP_"+
  (e instanceof Error?e.message:"unclassified"));
 process.exitCode=1;
});

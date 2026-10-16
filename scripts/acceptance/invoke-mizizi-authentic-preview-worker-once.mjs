/** Ephemeral, protected Preview worker invocation for ONE original queued case.
 * No key leaves the CI process; no new case, Registry write or grant.
 */
import fs from "node:fs";
const PREVIEW="nkgfoppunmnkcumalxqp";
const CASE="84203e1c-8d3b-4565-b2b9-aef0495fbcf0";
const JOB="27bf6fbf-7298-4004-8b66-301f52380ad5";
const RECEIPT="36b96c78-0bc2-4739-8b85-5ab173d40141";
const SHA="1d70a028a5ebab1898d3069e54ad59ec61e96c39d89af9bcefa511edea3a33d4";
function stop(reason){throw Error("MIZIZI_STOP_"+reason);}
async function inspect(token){
 const query="select "+
 "(select count(*)::int from supabase_migrations.schema_migrations) migrations,"+
 "(select max(version) from supabase_migrations.schema_migrations) migration_head,"+
 "(select count(*)::int from public.registry_tracks) tracks,"+
 "(select count(*)::int from mizizi_private.cases) cases,"+
 "(select count(*)::int from platform_private.jobs where command_type='mizizi.case_research_v1') jobs,"+
 "(select count(*)::int from mizizi_private.research_passes) passes,"+
 "(select row_to_json(j) from (select id::text,resource_id::text,status,attempt_count,command_receipt_id::text "+
 "from platform_private.jobs where id='"+JOB+"'::uuid) j) job,"+
 "(select row_to_json(c) from (select id::text,revision,subject_type,current_stage,policy_ruleset_version,"+
 "last_observation_fingerprint from mizizi_private.cases where id='"+CASE+"'::uuid) c) case_record";
 const r=await fetch("https://api.supabase.com/v1/projects/"+PREVIEW+"/database/query/read-only",{
  method:"POST",redirect:"error",
  headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({query}),signal:AbortSignal.timeout(18000)});
 if(!r.ok)stop("PREVIEW_READ_STATUS_"+r.status);
 let body;try{body=await r.json();}catch{stop("PREVIEW_READ_INVALID_JSON");}
 const rows=Array.isArray(body)?body:(body.result||body.data);
 if(!Array.isArray(rows)||rows.length!==1)stop("PREVIEW_READ_NOT_SINGLE_ROW");
 return rows[0];
}
function serviceKey(value){
 const a=Array.isArray(value)?value:(value?.result||value?.data||[]);
 if(!Array.isArray(a))stop("KEY_INVENTORY_NOT_AN_ARRAY");
 const selected=a.filter(x=>x?.name==="service_role"||x?.role==="service_role"||x?.type==="service_role");
 if(selected.length!==1)stop("EXACT_EXISTING_SERVICE_ROLE_NOT_FOUND");
 const key=selected[0].api_key??selected[0].key??selected[0].value;
 if(typeof key!=="string"||!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))
  stop("PREVIEW_LEGACY_SERVICE_JWT_NOT_AVAILABLE");
 let p;try{p=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString("utf8"));}
 catch{stop("SERVICE_JWT_PAYLOAD_INVALID");}
 if(p.role!=="service_role"||(p.exp&&p.exp*1000<=Date.now()))
  stop("SERVICE_JWT_ROLE_OR_EXPIRY_INVALID");
 return key;
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=="true"||
    process.env.GITHUB_REPOSITORY!=="bjuta/wakilisha"||
    process.env.GITHUB_HEAD_REF!=="feat/mizizi-slice2-adaptive-multipass-investigation"||
    process.env.MIZIZI_PREVIEW_PROJECT_REF!==PREVIEW)
  stop("PREVIEW_ONLY_REPOSITORY_CI_REQUIRED");
 const token=process.env.SUPABASE_ACCESS_TOKEN;
 if(!token)stop("MANAGEMENT_TOKEN_MISSING");
 const before=await inspect(token);
 if(Number(before.migrations)!==233||before.migration_head!=="20261016092731"||
    Number(before.tracks)!==0||Number(before.cases)!==1||Number(before.jobs)!==1||
    Number(before.passes)!==0||before.job?.id!==JOB||before.job?.resource_id!==CASE||
    before.job?.status!=="queued"||Number(before.job?.attempt_count)!==0||
    before.job?.command_receipt_id!==RECEIPT||
    before.case_record?.id!==CASE||before.case_record?.subject_type!=="work"||
    before.case_record?.current_stage!=="research"||
    before.case_record?.policy_ruleset_version!=="mizizi.wikidata_research_only.v1"||
    before.case_record?.last_observation_fingerprint!==SHA)
  stop("ORIGINAL_QUEUED_CASE_RECEIPT_DRIFT");
 console.log("MIZIZI_EXACT_PREVIEW_QUEUED_CASE_AND_JOB=PASS");
 const file=process.argv[2];
 if(!file||!process.env.RUNNER_TEMP||!file.startsWith(process.env.RUNNER_TEMP+"/"))
  stop("EPHEMERAL_KEY_INVENTORY_REQUIRED");
 let raw;
 try{raw=JSON.parse(fs.readFileSync(file,"utf8"));}
 finally{fs.rmSync(file,{force:true});}
 const key=serviceKey(raw);
 process.stdout.write("::add-mask::"+key+"\n");
 let res;
 try{res=await fetch("https://"+PREVIEW+".supabase.co/functions/v1/mizizi-research-runner",{
   method:"POST",redirect:"error",
   headers:{Authorization:"Bearer "+key,apikey:key,"Content-Type":"application/json"},
   body:JSON.stringify({action:"run_one_system"}),
   signal:AbortSignal.timeout(170000)
 });}catch{stop("PROTECTED_WORKER_HTTP_UNCONFIRMED");}
 let out;try{out=await res.json();}catch{stop("PROTECTED_WORKER_NON_JSON");}
 console.log("MIZIZI_PREVIEW_WORKER_HTTP_STATUS="+res.status);
 if(!res.ok||out?.ok!==true){
  const code=typeof out?.error==="string"&&/^[a-z0-9_]{1,80}$/.test(out.error)?out.error:"unknown";
  stop("PROTECTED_WORKER_HTTP_"+res.status+"_"+code);
 }
 if(out.claimed!==1||out.succeeded!==1||out.failed!==0||
    out.registryMutations!==0||out.independentTruthClaimed!==false)
  stop("SINGLE_JOB_WORKER_COUNTS_NOT_ACCEPTED");
 const after=await inspect(token);
 if(after.job?.id!==JOB||after.job.status!=="succeeded"||
    Number(after.passes)<1||Number(after.tracks)!==0||
    Number(after.cases)!==1||Number(after.jobs)!==1)
  stop("DURABLE_RESULT_RECEIPTS_NOT_VERIFIED");
 console.log("MIZIZI_AUTHENTIC_PREVIEW_WORKER="+JSON.stringify({
   jobStatus:after.job.status,passes:after.passes,tracks:after.tracks,
   cases:after.cases,independentTruthClaimed:false}));
 console.log("MIZIZI_AUTHENTIC_MULTI_PASS_INVESTIGATION_LIVE_WORKER=PASS");
}
main().catch(e=>{
 const m=e instanceof Error?e.message:"MIZIZI_STOP_UNKNOWN";
 console.error(/^MIZIZI_STOP_[A-Z0-9_]+$/.test(m)?m:"MIZIZI_STOP_UNCLASSIFIED");
 process.exitCode=1;
});

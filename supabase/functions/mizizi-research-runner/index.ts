/** MIZIZI Slice 2 first authentic preview researcher, not a public AI API.
 * The existing worker owns leases, receipts, recovery and retries.
 * Only the known isolated Preview may execute this function.
 * Production Registry and review decisions are never modified here.
 */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {runAnthropicAdaptiveResearchWorkerCycleV1}
 from "../../../scripts/registry/agents/mizizi/runtime/adaptive-research-worker-handler-v1.ts";
import {createLeasedResearchPassStoreV1}
 from "../../../scripts/registry/agents/mizizi/runtime/leased-research-pass-store-v1.ts";
import {createWikidataInvestigationReaderV1}
 from "../../../scripts/registry/agents/mizizi/runtime/wikidata-investigation-reader-v1.ts";
import {resolveInstituteAnthropicConfigurationV1}
 from "../../../scripts/registry/agents/mizizi/runtime/anthropic-investigation-analyst-v1.ts";
import type {WorkerRpc,ResearchSourceVerifierV1,ResearchJobV1,VerifiedResearchSourceV1}
 from "../../../scripts/registry/agents/mizizi/runtime/research-worker-cycle-v1.ts";
import type {InvestigationIdentityV1}
 from "../../../scripts/registry/agents/mizizi/runtime/adaptive-investigation-v1.ts";
const PREVIEW="nkgfoppunmnkcumalxqp";
const RPCS=new Set([
 "mizizi_recover_expired_case_research_jobs_v1",
 "mizizi_claim_case_research_jobs_v1",
 "mizizi_fail_case_research_job_v1",
 "mizizi_complete_case_research_job_v1",
 "mizizi_read_research_passes_v1",
 "mizizi_append_research_pass_v1"
]);
const allowOrigin=new Set(["https://wakilisha.africa",
 "https://www.wakilisha.africa","https://staging.wakilisha.africa"]);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ENTITY_REV=/^wikidata:Q[1-9][0-9]{0,11}:revision:[1-9][0-9]*$/;
const SOURCE_POLICY="https://www.wikidata.org/wiki/Wikidata:Licensing";
function cors(req:Request){
 const origin=req.headers.get("Origin")||"";
 const allowed=allowOrigin.has(origin)?origin:"https://wakilisha.africa";
 return {"Access-Control-Allow-Origin":allowed,
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Vary":"Origin"};
}
function respond(req:Request,code:number,body:Record<string,unknown>){
 return new Response(JSON.stringify(body),{status:code,
  headers:{...cors(req),"Content-Type":"application/json",
   "Cache-Control":"no-store"}});
}
async function verifiedFromPass(
 job:ResearchJobV1,receipt:{
  sourceId:string;originKey:string;lineageKey:string;
  payloadFingerprint:string;authorityRef:string;useBasis:string;
  observedAt:string;excerpt:string
 }):Promise<VerifiedResearchSourceV1>{
 if(!UUID.test(receipt.sourceId)||!ENTITY_REV.test(receipt.originKey)||
  receipt.lineageKey!=="wikidata:community-structured-data"||
  receipt.authorityRef!==SOURCE_POLICY||
  receipt.useBasis!=="open_license"||
  typeof receipt.excerpt!=="string"||receipt.excerpt.length>5500||
  receipt.payloadFingerprint.length!==64)
  throw new Error("MIZIZI_PREVIEW_SOURCE_PROVENANCE_INVALID");
 const hashBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(receipt.excerpt));
 const digest=Array.from(new Uint8Array(hashBytes),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==receipt.payloadFingerprint)
  throw new Error('MIZIZI_PREVIEW_SOURCE_SNAPSHOT_HASH_MISMATCH');
 return {sourceId:receipt.sourceId,caseId:job.caseId,
  workspaceId:job.workspaceId,sourceUseBasis:"open_license",
  permissionAuthorityRef:SOURCE_POLICY,privateResearchAllowed:true,
  sourceOriginRef:receipt.originKey,lineageKey:receipt.lineageKey,
  sourcePayloadFingerprint:receipt.payloadFingerprint,
  observedAt:receipt.observedAt,validUntil:null,revokedAt:null};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return respond(req,405,{error:"method_not_allowed"});
 const url=Deno.env.get("SUPABASE_URL")||"";
 const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 // Hard-stop before creating clients if this code ever reaches Production.
 if(url!=="https://"+PREVIEW+".supabase.co"||!anon||!service)
  return respond(req,503,{error:"preview_runtime_not_authorized"});
 const token=req.headers.get("Authorization")||"";
 // Platform verify_jwt=true validates a genuine JWT before this handler.
 // The pre-existing Preview service_role key is already authorized to use
 // the shared worker lease RPCs. A system invocation does not impersonate
 // a Headquarters user and cannot perform any new case admission.
 // Do not compare the presented JWT with a separate Edge environment
 // value: Preview Management's current service key may legitimately differ.
 // Instead validate its actual service-role authority against PREVIEW Auth.
 // Supabase Edge verify_jwt=true runs before this handler.
 let serviceCaller=false;
 if(token.startsWith("Bearer ")&&token.length<4096){
  const callerJwt=token.slice(7);
  try{
   const authorityClient=createClient(url,callerJwt,{
    auth:{persistSession:false,autoRefreshToken:false}
   });
   const check=await authorityClient.auth.admin.listUsers({page:1,perPage:1});
   serviceCaller=check.error===null&&Array.isArray(check.data?.users);
  }catch{serviceCaller=false;}
 }
 let request:unknown;
 try{request=await req.json();}catch{return respond(req,400,{error:"invalid_json"});}
 if(!request||typeof request!=="object"||Array.isArray(request)||
  Object.keys(request as object).length!==1)
  return respond(req,400,{error:"expected_single_research_action"});
 const action=(request as {action?:unknown}).action;
 if(action!=="run_one"&&action!=="run_one_system"&&action!=="provider_health_system")
  return respond(req,400,{error:"research_action_not_supported"});
 if(action==="run_one_system"||action==="provider_health_system"){
  if(!serviceCaller)
   return respond(req,403,{error:"authorized_system_worker_required"});
 }else{
  if(serviceCaller||!token.startsWith("Bearer "))
   return respond(req,401,{error:"authenticated_operator_required"});
  const client=createClient(url,anon,{
   global:{headers:{Authorization:token}},
   auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:{user},error:authError}=await client.auth.getUser(token.slice(7));
  if(authError||!user)return respond(req,401,{error:"invalid_session"});
  // The existing signed-in Headquarters role and capability remain required.
  const [role,cases]=await Promise.all([
   client.rpc("current_user_has_capability",{required_capability:"manage_registry"}),
   client.rpc("admin_mizizi_cases_v1",{p_limit:1})
  ]);
  if(role.error||role.data!==true||cases.error)
   return respond(req,403,{error:"headquarters_operator_authority_required"});
 }
 const db=createClient(url,service,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
 let config:Awaited<ReturnType<typeof resolveInstituteAnthropicConfigurationV1>>;
 try{
  config=await resolveInstituteAnthropicConfigurationV1({
   readEnvironment:name=>Deno.env.get(name),
   readAdminSetting:async key=>{
    const result=await db.from("admin_settings_secrets")
     .select("setting_value").eq("setting_key",key).maybeSingle();
    if(result.error)throw new Error("MIZIZI_PREVIEW_PROVIDER_CONFIG_UNAVAILABLE");
    return typeof result.data?.setting_value==="string"?
     result.data.setting_value:null;
   }
  });
 }catch{
  return respond(req,503,{error:"existing_anthropic_provider_not_configured_in_preview"});
 }
 if(action==="provider_health_system"){
  // No case lease, prompt, or user material. This only tests whether the
  // EXISTING server-only key is authorized to access the chosen model.
  let status=0;
  try{
   const check=await fetch("https://api.anthropic.com/v1/models/"+
    encodeURIComponent(config.model),{
    method:"GET",redirect:"error",
    headers:{"x-api-key":config.apiKey,"anthropic-version":"2023-06-01"},
    signal:AbortSignal.timeout(10000)
   });
   status=check.status;
  }catch{
   return respond(req,503,{error:"provider_health_transport_unconfirmed"});
  }
  return respond(req,200,{ok:true,model:config.model,
   providerHttpStatus:status,providerAccessConfirmed:status===200,
   caseClaimed:false,registryMutations:0});
 }
 const rpc:WorkerRpc=async(fn,args)=>{
  if(!RPCS.has(fn))throw new Error("MIZIZI_PREVIEW_RPC_NOT_AUTHORIZED");
  const value=await db.rpc(fn,args);
  return {data:value.data,error:value.error?{message:"RPC_FAILED"}:null};
 };
 const workerId="mizizi-preview:"+crypto.randomUUID();
 const approved=new Map<string,string>();
 const reader=createWikidataInvestigationReaderV1({
  authorizePublicQuery:async(identity:InvestigationIdentityV1,question:string)=>{
   const opening=approved.get(identity.caseId);
   // Follow-up questions may use only previous licensed Wikidata data.
   return typeof opening==="string"&&opening.length>=12&&
    question.length<=500&&!/[\u0000-\u001f]/.test(question);
  }
 });
 const verifySources:ResearchSourceVerifierV1=async(job,ids)=>{
  const store=createLeasedResearchPassStoreV1(rpc,job,workerId);
  const passes=await store.read({
   caseId:job.caseId,workspaceId:job.workspaceId,
   openingQuestion:approved.get(job.caseId)||"Public licensed research question"
  });
  const receipts=passes.flatMap(p=>p.sourceReceipts)
   .filter(r=>ids.includes(r.sourceId));
  const byId=new Map(receipts.map(r=>[r.sourceId,r]));
  if(byId.size!==ids.length)
   throw new Error("MIZIZI_PREVIEW_SOURCE_RECEIPT_MISSING");
  return Promise.all(ids.map(id=>verifiedFromPass(job,byId.get(id)!)));
 };
 try{
  const result=await runAnthropicAdaptiveResearchWorkerCycleV1({
   rpc,workerId,anthropic:config,limit:1,leaseSeconds:300,
   maxNewPasses:2,maxTotalPasses:20,costBudgetUnits:20,
   openingQuestion:async(job)=>{
    if(job.publicSourceSearchApproved!==true||!job.researchQuestion)
     throw new Error("MIZIZI_PREVIEW_PUBLIC_RESEARCH_NOT_ADMITTED");
    approved.set(job.caseId,job.researchQuestion);
    return job.researchQuestion;
   },
   readSources:async(identity,question,history)=>{
    const collected=await reader(identity,question,history);
    return collected;
   },
   verifyFinding:async()=>({verified:false,verificationRef:null}),
   verifySources
  });
  return respond(req,200,{ok:true,contract:result.contract,
   recovered:result.recovered,claimed:result.claimed,
   succeeded:result.succeeded,failed:result.failed,
   independentTruthClaimed:false,registryMutations:0});
 }catch{
  return respond(req,503,{error:"research_cycle_not_confirmed",
   note:"Inspect protected worker receipts and server logs. Do not replay admission."});
 }
});

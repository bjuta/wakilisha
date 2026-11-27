/** Preview-only executable binding for the existing chart calibration flow.
 * Credentials are supplied by an independently authorized runtime, not
 * retrieved, issued or rotated here. All durable policy checks still apply.
 * Local checkpoints contain private case coordinates, never credentials.
 */
import {createHash} from "node:crypto";
import {open,readFile,stat} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
import pg from "pg";
import {prepareChartCalibrationV1,admitChartCalibrationV1,beginChartCalibrationCaseV1,
 dispatchChartCalibrationCaseV1,runChartCalibrationJobV1,type ChartCalibrationAdmissionV1}
 from "./chart-calibration-flow-v1.ts";
import {discoverAnthropicResearchModelV1} from "./anthropic-investigation-analyst-v1.ts";
import {createDockerDeskBrowserHostV1} from "./desk-docker-browser-host-v1.mjs";
import {qualifyDeskPublicDiscoveryProviderV1,type DeskDiscoveryConfigurationV1} from "./desk-research-gateway-v1.ts";
import {selectCostEffectiveDeskModelV1,type DeskModelCandidateV1} from "./desk-anthropic-tool-loop-v1.ts";
import type {WorkerRpc} from "./research-worker-cycle-v1.ts";

const REF="ehkmjrjjhzyjkxdfsqdc",ROOT="https://"+REF+".supabase.co";
const ACK="I authorize read-only investigation of this chart recording hypothesis.";
const SHA=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hash=(b:string|Uint8Array)=>createHash("sha256").update(b).digest("hex");
const fail=(s:string):never=>{throw Error("MIZIZI_PREVIEW_CALIBRATION_"+s);};
const text=(s:unknown,min=8,max=500):s is string=>typeof s==="string"&&s.length>=min&&s.length<=max&&s.trim()===s&&!/[\p{Cc}\p{Cf}]/u.test(s);
const live=(expiry:string)=>Number.isFinite(Date.parse(expiry))&&Date.parse(expiry)>Date.now();
const env=(name:string)=>{const v=process.env[name];if(!v||v.trim()!==v)fail("RUNTIME_INPUT_REQUIRED");return v!;};
type Target={title:string;artist:string|null};
type Manifest=Readonly<{
 contract:"mizizi-preview-calibration-runtime/v1";projectRef:typeof REF;inputSha256:string;
 operatorUserId:string;workspaceId:string;validUntil:string;targets:readonly Target[];
 case?:Readonly<{caseId:string;membershipSha256:string;admissionSha256:string;question:string;
  policyReviewRef:string;sourceReviewRef:string;financeReviewRef:string;runtimeReviewRef:string;
  model:DeskModelCandidateV1;credentialSha256:string;nativeAccountFingerprint:string;
  maximumCostMicrousd:number;costBudgetUnits:number;maxTotalPasses:number;
  executorHost:string;discovery?:DeskDiscoveryConfigurationV1;
  browser?:Readonly<{imageId:string;accountFingerprint:string;qualificationRef:string;validUntil:string;captureVisual:boolean}>;
 }>;
}>;
type Transition=Awaited<ReturnType<typeof beginChartCalibrationCaseV1>>;
type Mode="admit"|"execute"|"resume";
async function exactFile(path:string,digest:string,max=2000000){
 if(!SHA.test(digest))fail("REVIEW_DIGEST_REQUIRED");
 const s=await stat(path);if(!s.isFile()||s.size<2||s.size>max||(s.mode&0o077)!==0)fail("PRIVATE_FILE_REQUIRED");
 const b=await readFile(path);if(hash(b)!==digest)fail("REVIEW_DIGEST_MISMATCH");
 return JSON.parse(b.toString("utf8"));
}
export async function readPreviewCalibrationManifestV1(path:string,digest:string,mode:Mode):Promise<Manifest>{
 const m=await exactFile(path,digest,64000) as Manifest;
 if(!m||m.contract!=="mizizi-preview-calibration-runtime/v1"||m.projectRef!==REF||
  !SHA.test(m.inputSha256)||!UUID.test(m.operatorUserId)||!UUID.test(m.workspaceId)||!live(m.validUntil)||
  !Array.isArray(m.targets)||m.targets.length<1||m.targets.length>20||
  m.targets.some(t=>!t||!text(t.title,1,300)||(t.artist!==null&&!text(t.artist,1,300))))fail("MANIFEST_SCOPE");
 if(mode!=="admit"){
  const c=m.case;
  if(!c||!UUID.test(c.caseId)||!SHA.test(c.membershipSha256)||!SHA.test(c.admissionSha256)||
   !text(c.question,8,1000)||![c.policyReviewRef,c.sourceReviewRef,c.financeReviewRef,c.runtimeReviewRef].every(x=>text(x))||
   !SHA.test(c.credentialSha256)||!SHA.test(c.nativeAccountFingerprint)||
   !Number.isSafeInteger(c.maximumCostMicrousd)||c.maximumCostMicrousd<1||c.maximumCostMicrousd>600000||
   !Number.isSafeInteger(c.costBudgetUnits)||c.costBudgetUnits<1||c.costBudgetUnits>1000||
   !Number.isSafeInteger(c.maxTotalPasses)||c.maxTotalPasses<1||c.maxTotalPasses>3||
   !/^[a-z0-9.-]+\.supabase\.co$/.test(c.executorHost))fail("CASE_RUNTIME_SCOPE");
  if(!c.model||c.model.batchEligible===true||c.model.family!=="haiku"||
   !Number.isSafeInteger(c.model.maxInputTokens)||c.model.maxInputTokens<1||c.model.maxInputTokens>1000000)
   fail("MODEL_REVIEW_REQUIRED");
  selectCostEffectiveDeskModelV1([c.model],{
   tier:"routine",needsVision:c.browser?.captureVisual===true,inputTokenCeiling:c.model.maxInputTokens,
   maximumCostMicrousd:c.maximumCostMicrousd,assessmentRef:c.runtimeReviewRef},Date.now());
  if(c.browser&&(!/^sha256:[a-f0-9]{64}$/.test(c.browser.imageId)||
    !SHA.test(c.browser.accountFingerprint)||!text(c.browser.qualificationRef)||
    !live(c.browser.validUntil)||Date.parse(c.browser.validUntil)>Date.parse(m.validUntil)||
    typeof c.browser.captureVisual!=="boolean"))fail("BROWSER_REVIEW_REQUIRED");
  if(c.discovery)for(const [op,provider] of Object.entries(c.discovery)){
   if(op!=="search_web"&&op!=="search_news")fail("DISCOVERY_SCOPE");
   qualifyDeskPublicDiscoveryProviderV1(provider,op);
  }
 }
 return m;
}
function validateLegacyKey(key:string,role:string){
 try{const p=key.split(".");if(p.length!==3)fail("KEY_SCOPE");
  const claims=JSON.parse(Buffer.from(p[1],"base64url").toString("utf8"));
  if(claims.role!==role||claims.ref!==REF)fail("KEY_SCOPE");
 }catch{fail("KEY_SCOPE");}
}
const clientOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
function rpcOf(client:ReturnType<typeof createClient>):WorkerRpc{
 return async(fn,args)=>{const result=await client.rpc(fn,args);
  return {data:result.data,error:result.error?{message:"RPC_REJECTED"}:null};};
}
async function requireOperator(m:Manifest){
 const anon=env("MIZIZI_PREVIEW_ANON_KEY"),jwt=env("MIZIZI_PREVIEW_OPERATOR_JWT");
 validateLegacyKey(anon,"anon");
 const client=createClient(ROOT,anon,{...clientOptions,global:{headers:{Authorization:"Bearer "+jwt}}});
 const {data,error}=await client.auth.getUser(jwt);
 if(error||data.user?.id!==m.operatorUserId)fail("OPERATOR_SCOPE");
 const rpc=rpcOf(client);
 for(const [cap,expected] of [["manage_registry",true],["manage_charts",true],["manage_users",false],["publish_charts",false]] as const){
  const r=await rpc("current_user_has_capability",{required_capability:cap});
  if(r.error||r.data!==expected)fail("OPERATOR_CAPABILITY");
 }
 return rpc;
}
async function checkpoint(path:string,receipt:unknown){
 const b=Buffer.from(JSON.stringify(receipt)+"\n"),file=await open(path,"wx",0o600);
 try{await file.writeFile(b);await file.sync();}finally{await file.close();}
 return hash(b);
}
export async function runPreviewCalibrationCommandV1(args:readonly string[]){
 const [mode,manifestPath,digest,outputPrefix,admissionPath,transitionPath,transitionSha]=args;
 if(!["admit","execute","resume"].includes(mode)||!manifestPath||!digest||!outputPrefix||
  (mode==="admit"&&args.length!==4)||(mode==="execute"&&args.length!==5)||(mode==="resume"&&args.length!==7))
  fail("ARGUMENTS");
 const m=await readPreviewCalibrationManifestV1(manifestPath,digest,mode as Mode);
 const key=env("MIZIZI_PREVIEW_SERVICE_ROLE_KEY");validateLegacyKey(key,"service_role");
 const service=createClient(ROOT,key,clientOptions),serviceRpc=rpcOf(service);
 const plan=await prepareChartCalibrationV1({serviceRpc,expectedInputSha256:m.inputSha256,targets:m.targets});
 if(mode==="admit"){
  const operatorRpc=await requireOperator(m);
  const receipt=await admitChartCalibrationV1(operatorRpc,plan);
  const sha=await checkpoint(outputPrefix+".admission.json",receipt);
  return {stage:"admitted",created:receipt.created,replayed:receipt.replayed,admissionSha256:sha,
   selectedCases:plan.selectedGroupIndices.map(i=>receipt.cases[i])};
 }
 const c=m.case!;
 const admission=await exactFile(admissionPath,c.admissionSha256) as ChartCalibrationAdmissionV1;
 if(admission.inputSha256!==plan.inputSha256||admission.cases?.length!==plan.groups.length)fail("ADMISSION_SCOPE");
 const candidate=admission.cases.find(x=>x.caseId===c.caseId);
 if(!candidate||candidate.membershipSha256!==c.membershipSha256||
  !plan.selectedGroupIndices.some(i=>admission.cases[i]?.caseId===c.caseId)||
  candidate.disposition!=="research")fail("SELECTED_CASE_SCOPE");
 const apiKey=env("MIZIZI_PREVIEW_ANTHROPIC_API_KEY"),workspaceId=process.env.MIZIZI_PREVIEW_ANTHROPIC_WORKSPACE_ID;
 if(hash(JSON.stringify(["mizizi:anthropic:credential:v1",workspaceId??null,apiKey]))!==c.credentialSha256)
  fail("MODEL_CREDENTIAL_SCOPE");
 const modelConfig={apiKey,workspaceId,model:c.model.model};
 const readModelInventory=async()=>{
  if(!live(m.validUntil)||!live(c.model.validUntil))fail("MODEL_REVIEW_EXPIRED");
  const r=await discoverAnthropicResearchModelV1(modelConfig);
  if(!r.ok||!r.preferenceMatched||r.model!==c.model.model)fail("MODEL_INVENTORY_UNCONFIRMED");
  return [c.model];
 };
 await readModelInventory();
 // New finance readback must exist on the actual target, without creating a reservation.
 const noReservation=await serviceRpc("mizizi_read_desk_resource_encumbrance_v1",{
  p_reservation_id:"00000000-0000-4000-8000-000000000000",p_request_sha256:"0".repeat(64),
  p_account_fingerprint:c.credentialSha256});
 if(noReservation.error||noReservation.data!==null)fail("METER_SCHEMA_UNCONFIRMED");
 const browser=c.browser;
 const localBrowser=browser?await createDockerDeskBrowserHostV1({
  imageId:browser.imageId,accountFingerprint:browser.accountFingerprint,
  dependenciesDirectory:resolve("node_modules"),captureVisual:browser.captureVisual,
  authorizeHost:async(binding:{scope:{caseId:string;workspaceId:string;leaseExpiresAt:string};accountFingerprint:string;mode:string;reserveSeconds:number},requestSha256:string)=>{
   if(!live(m.validUntil)||!live(browser.validUntil)||binding.scope.caseId!==c.caseId||
    binding.scope.workspaceId!==m.workspaceId||binding.accountFingerprint!==browser.accountFingerprint||
    binding.mode!=="interactive"||binding.reserveSeconds!==120||hash(JSON.stringify(binding))!==requestSha256)return null;
   return {requestSha256,policyRef:browser.qualificationRef,
    validUntil:new Date(Math.min(Date.parse(m.validUntil),Date.parse(browser.validUntil),Date.parse(binding.scope.leaseExpiresAt))).toISOString(),
    egressIsolationVerified:true as const,localCapacityVerified:true as const,zeroIncrementalSpendAllowed:true as const};
  }}):undefined;
 const dsn=env("MIZIZI_PREVIEW_JIT_DATABASE_URL"),url=new URL(dsn);
 if(!["postgres:","postgresql:"].includes(url.protocol)||url.hostname!==c.executorHost||
  url.username!=="mizizi_executor"||url.pathname!=="/postgres"||url.search||url.hash||!url.password)
  fail("JIT_ENDPOINT_SCOPE");
 // The reviewed exact host is required; no guessed port, role switching,
 // disabled TLS verification or fallback to a management connection.
 const pool=new pg.Pool({connectionString:dsn,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:10000,query_timeout:30000,statement_timeout:30000});
 try{
  const query=async(sql:string,values:readonly unknown[])=>{
   const r=await pool.query(sql,[...values]);return {rows:r.rows,rowCount:r.rowCount};};
  const login=await query("select session_user::text as login_role",[]);
  if(login.rowCount!==1||login.rows[0].login_role!=="mizizi_executor")fail("JIT_IDENTITY");
  let transition:Transition;
  if(mode==="execute"){
   const operatorRpc=await requireOperator(m);
   if(!live(m.validUntil))fail("REVIEW_EXPIRED");
   transition=await beginChartCalibrationCaseV1({operatorRpc,admission,caseId:c.caseId,workspaceId:m.workspaceId,acknowledgement:ACK});
   await checkpoint(outputPrefix+".transition.json",transition);
  }else{
   transition=await exactFile(transitionPath,transitionSha) as Transition;
   if(transition.caseId!==c.caseId||transition.workspaceId!==m.workspaceId||
    transition.expectedRevision!==candidate.revision+1)fail("TRANSITION_SCOPE");
  }
  if(!live(m.validUntil))fail("REVIEW_EXPIRED");
  const job=await dispatchChartCalibrationCaseV1(query,transition);
  await checkpoint(outputPrefix+".dispatch.json",job);
  if(job.jobStatus==="running"||job.jobStatus==="succeeded")return {stage:job.jobStatus,jobId:job.jobId};
  const result=await runChartCalibrationJobV1({receipt:job,serviceRpc,storage:service.storage,
   registryClient:service,preflight:async r=>live(m.validUntil)&&r.caseId===c.caseId&&r.workspaceId===m.workspaceId&&
    r.caseRevision===transition.expectedRevision,
   runtime:{credentials:{anthropic:{apiKey,workspaceId},nativeAccountFingerprint:c.nativeAccountFingerprint,discovery:c.discovery},
    localBrowser,readModelInventory,assessRequirement:async()=>({tier:"routine",needsVision:browser?.captureVisual===true,
     inputTokenCeiling:c.model.maxInputTokens,maximumCostMicrousd:c.maximumCostMicrousd,assessmentRef:c.runtimeReviewRef}),
    openingQuestion:async j=>{if(j.caseId!==c.caseId||j.workspaceId!==m.workspaceId||
     j.chartContext?.membershipSha256!==c.membershipSha256)fail("QUESTION_SCOPE");return c.question;},
    // Calibration gathers hypotheses; human adjudication remains separate.
    // Never mark a model's finding verified merely because it cited sources.
    verifyFinding:async()=>({verified:false,verificationRef:null}),
    maxTotalPasses:c.maxTotalPasses,costBudgetUnits:c.costBudgetUnits,leaseSeconds:300}});
  await checkpoint(outputPrefix+".worker.json",result);
  return {stage:"worker_returned",jobId:job.jobId,result};
 }finally{await pool.end();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runPreviewCalibrationCommandV1(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(e=>{
  const message=String(e?.message??"");
  console.error(/^MIZIZI_[A-Z0-9_]+$/.test(message)?message:"MIZIZI_PREVIEW_CALIBRATION_UNCONFIRMED");
  process.exitCode=1;
 });
}

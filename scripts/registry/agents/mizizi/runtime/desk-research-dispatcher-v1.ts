/** First actual desk-tool dispatcher: durable Brave discovery -> opaque lead
 * -> pinned native acquisition -> bounded interpretation -> private excerpt
 * custody -> independent readback. The model cannot supply a URL, source
 * authority, result receipt, network transport or budget. Deliberately no
 * browser/visual/Registry tool claims in this first composed path.
 */
import {createHash,randomUUID} from "node:crypto";
import {isIP} from "node:net";
import {createDurableDeskSearchGatewayV1,type DeskSearchScopeV1} from "./desk-research-gateway-v1.ts";
import {createDeskNativeReaderV1} from "./desk-native-reader-v1.ts";
import {createDeskSourceInterpreterV1} from "./desk-source-interpreter-v1.mjs";
import {createDeskResourceBudgetV1} from "./desk-resource-budget-v1.ts";
import {verifyInvestigationSourceV1,type SourceAuthorityV1,type SourceExcerptV1} from "./adaptive-investigation-v1.ts";
import type {DeskAnthropicOptionsV1,DeskToolCallV1,DeskToolLeadV1,DeskToolResultV1} from "./desk-anthropic-tool-loop-v1.ts";
import type {WorkerRpc,ResearchSourceVerifierV1} from "./research-worker-cycle-v1.ts";
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SEARCH_HOST="api.search.brave.com";
const scopeKeys=["jobId","caseId","workspaceId","expectedRevision","workerId","leaseExpiresAt"] as const;
const TOOLS=["search_web","search_news","read_page"] as const;
const hash=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
const fail=(code:string):never=>{throw Error("MIZIZI_DESK_DISPATCH_"+code);};
type NativeOptions=Parameters<typeof createDeskNativeReaderV1>[0];
type CustodyPolicy=Readonly<{
 host:string;revision:number;sourceFamily:"brave_discovery"|"public_web";authorityRef:string;
 originKey:string;lineageKey:string;useBasis:SourceAuthorityV1["useBasis"];
 privateResearchAllowed:true;metadataRetentionAllowed:true;excerptRetentionAllowed:boolean;
 externalModelProcessingAllowed:true;validUntil:string;
}>;
type StoredReceipt=Readonly<{receiptId:string;callSha256:string;resultSha256:string;resultText:string;provenance:unknown}>;
type StoredLead=Readonly<{id:string;url:string;kind:"reference";label:string;receiptId:string}>;
type Options=Readonly<{
 scope:DeskSearchScopeV1;rpc:WorkerRpc;braveApiKey:string;nativeAccountFingerprint:string;
 /** Separate independent current URL/egress/access/terms authority. Custody
  * approval is not access permission. These must be real trusted checks. */
 authorizeAcquisition:NativeOptions["authorize"];
 authorizeExamination:(scope:DeskSearchScopeV1,binding:Readonly<Record<string,unknown>>)=>Promise<boolean>;
 /** Test seams; fixed native/provider defaults in actual server composition. */
 searchTransport?:typeof fetch;
 nativeTestSeams?:Pick<NativeOptions,"resolve4"|"readPinned">;
 now?:()=>number;
}>;
function urlOf(value:unknown):URL{
 if(typeof value!=="string"||value.length>2048||/[\p{Cc}\p{Cf}\\]/u.test(value))fail("LEAD_URL_DENIED");
 let u:URL;try{u=new URL(value);}catch{fail("LEAD_URL_DENIED");}
 if(u.href!==value||u.protocol!=="https:"||u.username||u.password||u.port||u.hash||isIP(u.hostname)||
  !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(u.hostname)||
  /(?:^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$/i.test(u.hostname))
   fail("LEAD_URL_DENIED");
 for(const k of u.searchParams.keys())if(/token|signature|password|passwd|secret|credential|session|api[-_]?key|authorization|^sig$|^auth$|^key$|^x-amz-|^x-goog-/i.test(k))
  fail("LEAD_URL_DENIED");
 return u;
}
function text(v:unknown,max:number,min=1):v is string{
 return typeof v==="string"&&v.trim()===v&&v.length>=min&&v.length<=max&&!/[\p{Cc}\p{Cf}]/u.test(v);
}
function boundedLabel(v:unknown){
 return typeof v==="string"?v.replace(/[\p{Cc}\p{Cf}]/gu," ").replace(/\s+/g," ").trim().slice(0,500).trim():"";
}
function bodyOf(result:DeskToolResultV1){
 if(result.visual)fail("VISUAL_NOT_COMPOSED");
 return JSON.stringify({receiptId:result.receiptId,leads:result.leads,sources:result.sources,visual:null});
}
export function createDeskResearchDispatcherV1(options:Options){
 const now=options?.now??Date.now,s=options?.scope;
 if(!s||![s.jobId,s.caseId,s.workspaceId].every(x=>UUID.test(x))||
  !Number.isSafeInteger(s.expectedRevision)||s.expectedRevision<1||
  !/^mizizi-chart:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s.workerId)||
  !Number.isFinite(Date.parse(s.leaseExpiresAt))||Date.parse(s.leaseExpiresAt)<=now()||
  typeof options.rpc!=="function"||!SHA.test(options.nativeAccountFingerprint)||
  typeof options.authorizeAcquisition!=="function"||typeof options.authorizeExamination!=="function")
  fail("TRUSTED_CONFIGURATION_REQUIRED");
 const scope=Object.freeze({...s});
 const identity={caseId:scope.caseId,workspaceId:scope.workspaceId,openingQuestion:"Receipt-bound chart research."};
 const live=()=>{if(now()>=Date.parse(scope.leaseExpiresAt))fail("LEASE_EXPIRED");};
 const assertScope=(candidate:DeskSearchScopeV1)=>{
  live();if(!candidate||scopeKeys.some(k=>candidate[k]!==scope[k]))fail("CROSS_SCOPE_DENIED");
 };
 async function rpc(fn:string,args:Record<string,unknown>){
  const result=await options.rpc(fn,args);live();
  if(!result||result.error)fail("CUSTODY_RPC_UNCONFIRMED");
  return result.data;
 }
 async function policy(host:string):Promise<CustodyPolicy|null>{
  const raw=await rpc("mizizi_read_desk_custody_policy_v1",{p_scope:scope,p_host:host});
  if(raw===null)return null;
  const p=raw as CustodyPolicy;
  if(!p||p.host!==host||!Number.isSafeInteger(p.revision)||p.revision<1||
   p.sourceFamily!==(host===SEARCH_HOST?"brave_discovery":"public_web")||
   !["first_party","documented_consent","documented_contract","open_license"].includes(p.useBasis)||
   ![p.authorityRef,p.originKey,p.lineageKey].every(x=>text(x,500,8))||
   p.privateResearchAllowed!==true||p.metadataRetentionAllowed!==true||
   p.externalModelProcessingAllowed!==true||typeof p.excerptRetentionAllowed!=="boolean"||
   typeof p.validUntil!=="string"||!Number.isFinite(Date.parse(p.validUntil))||Date.parse(p.validUntil)<=now())
   fail("CUSTODY_POLICY_UNCONFIRMED");
  return Object.freeze({...p});
 }
 const search=createDurableDeskSearchGatewayV1({apiKey:options.braveApiKey,rpc:options.rpc,
  transport:options.searchTransport,now});
 const budget=createDeskResourceBudgetV1({rpc:options.rpc,now});
 const native=createDeskNativeReaderV1({
  ...options.nativeTestSeams,now,
  precharge:budget.nativePrecharge(options.nativeAccountFingerprint),
  authorize:async(candidate,url)=>{
   assertScope(candidate);
   const p=await policy(urlOf(url).hostname);
   if(!p||p.sourceFamily!=="public_web")return null;
   return options.authorizeAcquisition(candidate,url);
  }
 });
 const interpret=createDeskSourceInterpreterV1({
  now,authorize:async(candidate:DeskSearchScopeV1,binding:Readonly<Record<string,unknown>>)=>{
   assertScope(candidate);
   const p=await policy(urlOf(binding.finalUrl).hostname);
   return !!p&&p.sourceFamily==="public_web"&&await options.authorizeExamination(candidate,binding)===true;
  }
 });
 async function readReceipt(id:string):Promise<{row:StoredReceipt;result:DeskToolResultV1}|null>{
  if(!UUID.test(id))fail("RECEIPT_ID_DENIED");
  const raw=await rpc("mizizi_read_desk_tool_receipt_v1",{p_scope:scope,p_receipt_id:id});
  if(raw===null)return null;
  const row=raw as StoredReceipt;
  if(!row||row.receiptId!==id||!SHA.test(row.callSha256)||!SHA.test(row.resultSha256)||
   typeof row.resultText!=="string"||Buffer.byteLength(row.resultText)>30000||hash(row.resultText)!==row.resultSha256)
   fail("CUSTODY_READBACK_UNCONFIRMED");
  let parsed;try{parsed=JSON.parse(row.resultText);}catch{fail("CUSTODY_READBACK_UNCONFIRMED");}
  if(parsed?.receiptId!==id||!Array.isArray(parsed.leads)||!Array.isArray(parsed.sources)||
   parsed.visual!==null||bodyOf(parsed)!==row.resultText)fail("CUSTODY_READBACK_UNCONFIRMED");
  return {row,result:parsed};
 }
 function leadsFrom(rows:readonly {url:unknown;label:unknown}[]){
  const seen=new Set<string>(),leads:DeskToolLeadV1[]=[],bindings:{id:string;url:string}[]=[];
  for(const row of rows){
   if(leads.length>=8)break;
   let url:string;try{url=urlOf(row.url).href;}catch{continue;}
   const label=boundedLabel(row.label);
   if(!label||seen.has(url))continue;
   seen.add(url);
   const id=randomUUID();
   leads.push(Object.freeze({id,kind:"reference",label}));
   bindings.push({id,url});
  }
  return {leads:Object.freeze(leads),bindings};
 }
 async function append(callText:string,callSha256:string,result:DeskToolResultV1,
  p:CustodyPolicy,provenance:Record<string,unknown>,bindings:readonly {id:string;url:string}[]){
  const resultText=bodyOf(result),resultSha256=hash(resultText);
  if(Buffer.byteLength(resultText)>30000)fail("CUSTODY_PROJECTION_BOUND");
  const raw=await rpc("mizizi_record_desk_tool_receipt_v1",{p_call_text:callText,p_call_sha256:callSha256,
   p_result_text:resultText,p_result_sha256:resultSha256,p_host:p.host,p_policy_revision:p.revision,
   p_provenance:provenance,p_lead_bindings:bindings}) as {receiptId?:string;resultSha256?:string;outcome?:string}|null;
  if(!raw||raw.receiptId!==result.receiptId||raw.resultSha256!==resultSha256||
   !["created","replayed"].includes(raw.outcome??""))fail("CUSTODY_APPEND_DENIED");
  const read=await readReceipt(result.receiptId);
  if(!read||read.row.callSha256!==callSha256||read.row.resultSha256!==resultSha256||read.row.resultText!==resultText)
   fail("CUSTODY_READBACK_UNCONFIRMED");
  return result;
 }
 const executeTool:DeskAnthropicOptionsV1["executeTool"]=async(candidate,call,callSha256)=>{
  assertScope(candidate);
  const callText=JSON.stringify({scope:candidate,call});
  if(!SHA.test(callSha256)||hash(callText)!==callSha256||!TOOLS.some(t=>t===call.name)||
   !call.input||Object.keys(call.input).length!==1)fail("TOOL_CALL_DENIED");
  if(call.name==="search_web"||call.name==="search_news"){
   const query=call.input.query;
   if(!text(query,300,3))fail("QUERY_DENIED");
   const p=await policy(SEARCH_HOST);
   if(!p)fail("SEARCH_CUSTODY_DENIED");
   const request={scope:{jobId:scope.jobId,caseId:scope.caseId,workspaceId:scope.workspaceId,
    expectedRevision:scope.expectedRevision,workerId:scope.workerId,leaseExpiresAt:scope.leaseExpiresAt},
    operation:call.name,query,count:5} as const;
   const requestText=JSON.stringify(request),reply=await search(request);
   if(reply.requestSha256!==hash(requestText)||reply.operation!==call.name||reply.provider!=="brave"||
    !UUID.test(reply.reservationId)||reply.identityVerified!==false)fail("SEARCH_RECEIPT_DENIED");
   const {leads,bindings}=leadsFrom(reply.leads.map(l=>({url:l.url,label:l.title})));
   return append(callText,callSha256,{receiptId:randomUUID(),leads,sources:[]},p,
    {reservationId:reply.reservationId,requestSha256:reply.requestSha256,requestText},bindings);
  }
  const id=call.input.lead_id;
  if(typeof id!=="string"||!UUID.test(id))fail("LEAD_ID_DENIED");
  const raw=await rpc("mizizi_resolve_desk_reference_lead_v1",{p_scope:scope,p_lead_id:id}) as StoredLead|null;
  if(!raw||raw.id!==id||raw.kind!=="reference"||!UUID.test(raw.receiptId)||!text(raw.label,500))
   fail("LEAD_NOT_AVAILABLE");
  const parent=await readReceipt(raw.receiptId);
  if(!parent||!parent.result.leads.some(l=>l.id===id&&l.kind===raw.kind&&l.label===raw.label))
   fail("LEAD_CUSTODY_UNCONFIRMED");
  const url=urlOf(raw.url).href,receipt=await native({scope,url});
  const p=await policy(urlOf(receipt.finalUrl).hostname);
  if(!p||p.sourceFamily!=="public_web")fail("SOURCE_CUSTODY_DENIED");
  const interpreted=await interpret({scope,receipt});
  if(interpreted.source.sha256!==receipt.sha256||interpreted.source.finalUrl!==receipt.finalUrl||
   interpreted.source.representation!=="native_response_bytes"||
   hash(receipt.body)!==receipt.sha256||interpreted.projectionSha256!==hash(JSON.stringify(interpreted.projection)))
   fail("SOURCE_PROJECTION_UNCONFIRMED");
  const projection=interpreted.projection;
  const {leads,bindings}=leadsFrom(projection.links.map((l:{url:string;label:string|null})=>({url:l.url,label:l.label})));
  const receiptId=randomUUID(),sources:SourceExcerptV1[]=[];
  const segment=projection.segments.find((seg:{text:string})=>typeof seg.text==="string"&&seg.text.trim());
  const locator=segment?.locator??"no_text";
  // Only a bounded excerpt is retained. Raw HTML/PDF and full normalized
  // projection remain transient. Citation locator is derived, not a quote
  // position in original source bytes. No inferred source independence.
  if(segment&&p.excerptRetentionAllowed){
   const citation=receipt.finalUrl+"#"+locator;
   if(!text(citation,1000,8))fail("SOURCE_CITATION_BOUND");
   const source:SourceAuthorityV1={sourceId:receiptId,caseId:scope.caseId,workspaceId:scope.workspaceId,
    originKey:p.originKey,lineageKey:p.lineageKey,fingerprint:receipt.sha256,authorityRef:p.authorityRef,
    useBasis:p.useBasis,observedAt:receipt.retrievedAt,expiresAt:p.validUntil,revokedAt:null,
    privateResearchAllowed:true,externalModelProcessingAllowed:true,privateEvidenceRetentionAllowed:true};
   verifyInvestigationSourceV1(source,identity,now());
   sources.push({source,excerpt:segment.text.trim().slice(0,4000).trim(),citation});
  }
  return append(callText,callSha256,{receiptId,leads,sources},p,{
   requestedUrl:receipt.requestedUrl,finalUrl:receipt.finalUrl,sourceSha256:receipt.sha256,
   projectionSha256:interpreted.projectionSha256,contentType:receipt.contentType,
   retrievedAt:receipt.retrievedAt,byteLength:receipt.byteLength,hopSha256:receipt.hopSha256,locator
  },bindings);
 };
 const verifyToolReceipt:DeskAnthropicOptionsV1["verifyToolReceipt"]=async(candidate,binding,result)=>{
  assertScope(candidate);
  const read=await readReceipt(binding.receiptId);
  return !!read&&read.row.callSha256===binding.callSha256&&read.row.resultSha256===binding.resultSha256&&
   read.row.resultText===bodyOf(result);
 };
 async function currentSource(source:SourceAuthorityV1,excerpt?:SourceExcerptV1){
  verifyInvestigationSourceV1(source,identity,now());
  const read=await readReceipt(source.sourceId);
  return !!read&&read.result.sources.some(s=>JSON.stringify(s.source)===JSON.stringify(source)&&
   (!excerpt||(s.excerpt===excerpt.excerpt&&s.citation===excerpt.citation)));
 }
 const authorizeSource:DeskAnthropicOptionsV1["authorizeSource"]=async(id,_question,source)=>{
  if(id.caseId!==scope.caseId||id.workspaceId!==scope.workspaceId)return false;
  return currentSource(source.source,source);
 };
 const authorizeModelProcessing=async(id:{caseId:string;workspaceId:string},_question:string,source:SourceAuthorityV1)=>{
  if(id.caseId!==scope.caseId||id.workspaceId!==scope.workspaceId)return false;
  return currentSource(source);
 };
 const verifySources:ResearchSourceVerifierV1=async(job,refs)=>{
  assertScope({jobId:job.jobId,caseId:job.caseId,workspaceId:job.workspaceId,
   expectedRevision:job.expectedRevision,workerId:scope.workerId,leaseExpiresAt:job.leaseExpiresAt});
  const verified=[];
  for(const id of refs){
   const read=await readReceipt(id);
   const s=read?.result.sources.find(s=>s.source.sourceId===id);
   if(!s||!await currentSource(s.source,s))fail("SOURCE_CUSTODY_UNCONFIRMED");
   verified.push({sourceId:id,caseId:scope.caseId,workspaceId:scope.workspaceId,
    sourceUseBasis:s.source.useBasis,permissionAuthorityRef:s.source.authorityRef,
    privateResearchAllowed:s.source.privateResearchAllowed,sourceOriginRef:s.source.originKey,
    lineageKey:s.source.lineageKey,sourcePayloadFingerprint:s.source.fingerprint,
    observedAt:s.source.observedAt,validUntil:s.source.expiresAt,revokedAt:s.source.revokedAt});
  }
  return verified;
 };
 return Object.freeze({enabledTools:TOOLS,executeTool,verifyToolReceipt,authorizeSource,authorizeModelProcessing,verifySources});
}

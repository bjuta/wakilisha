/** First actual desk-tool dispatcher: durable Brave discovery -> opaque lead
 * -> pinned native acquisition -> bounded interpretation -> private excerpt
 * custody -> independent readback. The model cannot supply a URL, source
 * authority, result receipt, network transport or budget. Follow-up source
 * bytes are bounded transient same-lease material, not persisted originals.
 */
import {createHash,randomUUID} from "node:crypto";
import {isIP} from "node:net";
import {createDurableDeskSearchGatewayV1,createDurableDeskPublicDiscoveryGatewayV1,
 qualifyDeskPublicDiscoveryProviderV1,type DeskSearchScopeV1,type DeskDiscoveryConfigurationV1,
 type DeskSearchRequestV1} from "./desk-research-gateway-v1.ts";
import {createDeskNativeReaderV1,createDeskBrowserResourceReaderV1,createDeskPublicMethodGateV1,type DeskBrowserResourceBindingV1} from "./desk-native-reader-v1.ts";
import {createDeskSourceInterpreterV1,createDeskPdfVisualReaderV1,deskRenderedProcessingRestrictedV1} from "./desk-source-interpreter-v1.mjs";
import {createCloudflareBrowserTransportV1,createDeskBrowserReaderV1,createDurableLocalDeskBrowserV1} from "./desk-browser-reader-v1.mjs";
import {createDeskResourceBudgetV1} from "./desk-resource-budget-v1.ts";
import {verifyInvestigationHistoryV1,verifyInvestigationSourceV1,type SourceAuthorityV1,type SourceExcerptV1,type InvestigationPassV1,type DeskConsultationRefV1} from "./adaptive-investigation-v1.ts";
import {serializeDeskToolResultV1,isDeskUnavailableOutcomeV1,validDeskTransientConsultationV1,deskConsultationRefV1,type DeskTransientConsultationV1,type DeskAnthropicOptionsV1,type DeskToolCallV1,type DeskToolLeadV1,type DeskToolResultV1} from "./desk-anthropic-tool-loop-v1.ts";
import type {WorkerRpc,ResearchSourceVerifierV1} from "./research-worker-cycle-v1.ts";
import {readDeskFactualNotesV1,factualNoteReferencesCurrentV1,type DeskFactualNoteSubjectV1} from "./desk-factual-note-readback-v1.ts";
export {readDeskFactualNotesV1,type DeskFactualNoteV1} from "./desk-factual-note-readback-v1.ts";
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SEARCH_HOST="api.search.brave.com";
const scopeKeys=["jobId","caseId","workspaceId","expectedRevision","workerId","leaseExpiresAt"] as const;
const BASE_TOOLS=["search_web","search_news","read_page","read_document","inspect_visual"] as const;
const hash=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
const fail=(code:string):never=>{throw Error("MIZIZI_DESK_DISPATCH_"+code);};
type NativeOptions=Parameters<typeof createDeskNativeReaderV1>[0];
type CustodyPolicy=Readonly<{
 host:string;revision:number;sourceFamily:"brave_discovery"|"public_web";authorityRef:string;
 originKey:string;lineageKey:string;useBasis:SourceAuthorityV1["useBasis"];
 privateResearchAllowed:true;metadataRetentionAllowed:true;excerptRetentionAllowed:boolean;
 externalModelProcessingAllowed:true;browserRenderAllowed?:boolean;visualProcessingAllowed?:boolean;validUntil:string;
 transientProviderCredentialSha256?:string|null;transientProviderProcessingRef?:string|null;
}>;
type StoredReceipt=Readonly<{receiptId:string;callSha256:string;resultSha256:string;resultText:string;provenance:unknown}>;
type StoredLead=Readonly<{id:string;url:string;kind:DeskToolLeadV1["kind"];label:string;receiptId:string}>;
type BrowserOptions=Readonly<{
 accountId:string;apiToken:string;captureVisual?:boolean;
 authorize:NonNullable<Parameters<typeof createDeskBrowserReaderV1>[0]>["authorize"];
 authorizeRequest:NonNullable<Parameters<typeof createDeskBrowserReaderV1>[0]>["authorizeRequest"];
}>;
type LocalHostBinding=Readonly<{scope:DeskSearchScopeV1;accountFingerprint:string;reserveSeconds:number;mode:string}>;
type LocalBrowserAuthority=Readonly<{requestSha256:string;policyRef:string;validUntil:string;
 egressIsolationVerified:true;localCapacityVerified:true;zeroIncrementalSpendAllowed:true}>;
export type DeskLocalBrowserHostV1=Readonly<{
 accountFingerprint:string;captureVisual?:boolean;
 /** Independent host qualification, not a policy inferred from a successful
  * browser launch. The actual isolated host must enforce abort and deadline. */
 authorizeHost:(binding:LocalHostBinding,digest:string)=>Promise<LocalBrowserAuthority|null>;
 open:(binding:LocalHostBinding,sessionId:string,signal:AbortSignal)=>Promise<unknown>;
 close:(sessionId:string,signal:AbortSignal)=>Promise<boolean>;
}>;
type LocalBrowserOptions=DeskLocalBrowserHostV1&Readonly<{
 authorizeAccess:(scope:DeskSearchScopeV1,url:string,operation:string)=>Promise<boolean>;
 authorizeQuery:(scope:DeskSearchScopeV1,query:string,url:string)=>Promise<boolean>;
}>;
type Options=Readonly<{
 scope:DeskSearchScopeV1;rpc:WorkerRpc;braveApiKey?:string;discovery?:DeskDiscoveryConfigurationV1;nativeAccountFingerprint:string;
 /** Separate independent current URL/egress/access/terms authority. Custody
  * approval is not access permission. These must be real trusted checks. */
 authorizeAcquisition:NativeOptions["authorize"];
 authorizeExamination:(scope:DeskSearchScopeV1,binding:Readonly<Record<string,unknown>>)=>Promise<boolean>;
 /** Test seams; fixed native/provider defaults in actual server composition. */
 browser?:BrowserOptions;
 localBrowser?:LocalBrowserOptions;
 authorizeInteractiveCall?:DeskAnthropicOptionsV1["authorizeTool"];
 localBrowserResourceTestSeams?:Parameters<typeof createDeskBrowserResourceReaderV1>[0] extends infer T?Pick<NonNullable<T>,"resolve4"|"readPinned">:never;
 /** Test-only provider seams; never forwarded by the leased worker factory. */
 browserTestSeams?:Pick<NonNullable<Parameters<typeof createCloudflareBrowserTransportV1>[0]>,"transport"|"connect">;
 searchTransport?:typeof fetch;
 discoveryTestSeams?:Parameters<typeof createDurableDeskPublicDiscoveryGatewayV1>[0]["resourceTestSeams"];
 nativeTestSeams?:Pick<NativeOptions,"resolve4"|"readPinned">;
 /** Only operational composition enables lookup of separately authorized shared native fields. */
 sharedNativeReuse?:boolean;
 sharedNativeSearch?:boolean;
 /** Explicit standing authority only; availability independently restored from journal. */
 allowSameCaseRecall?:boolean;
 factualNoteSubject?:DeskFactualNoteSubjectV1;
 allowTransientModelConsultation?:()=>boolean;
 transientProviderCredentialSha256?:string;
 requirePublicMethodEligibility?:boolean;
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
const bodyOf=serializeDeskToolResultV1;
type NativeReceipt=Awaited<ReturnType<ReturnType<typeof createDeskNativeReaderV1>>>;
type BrowserReceipt=Awaited<ReturnType<ReturnType<typeof createDeskBrowserReaderV1>>>;
type TransientSource=Readonly<{receipt:NativeReceipt|BrowserReceipt;provenance:Record<string,unknown>}>;
function imageDescriptor(v:{body:Uint8Array;sha256:string;width:number;height:number;byteLength:number}){
 if(!(v?.body instanceof Uint8Array)||v.body.length!==v.byteLength||v.byteLength<33||v.byteLength>2000000||
  !SHA.test(v.sha256)||hash(v.body)!==v.sha256||!Number.isSafeInteger(v.width)||!Number.isSafeInteger(v.height)||
  v.width<1||v.height<1||v.width>1400||v.height>1400||v.width*v.height>1500000)fail("VISUAL_DIGEST_DENIED");
 const b=Buffer.from(v.body);
 if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||
  b.subarray(12,16).toString("ascii")!=="IHDR"||b.readUInt32BE(16)!==v.width||b.readUInt32BE(20)!==v.height)
   fail("VISUAL_DIGEST_DENIED");
 return {sha256:v.sha256,width:v.width,height:v.height,byteLength:v.byteLength};
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
   ((p.transientProviderCredentialSha256!=null||p.transientProviderProcessingRef!=null)&&
    (!SHA.test(p.transientProviderCredentialSha256??"")||!text(p.transientProviderProcessingRef,500,8)||p.excerptRetentionAllowed))||
   typeof p.validUntil!=="string"||!Number.isFinite(Date.parse(p.validUntil))||Date.parse(p.validUntil)<=now())
   fail("CUSTODY_POLICY_UNCONFIRMED");
  return Object.freeze({...p});
 }
 // The independent access RPC governs transient acquisition. Do not use
 // permission to retain or disclose source content as a second transport gate.
 // Custody remains mandatory when admitting any durable/disclosed result.
 // Descriptors are hashed and checked by the RPC, not persisted.
 const accessRevisions=new Map<string,string>();
 let activeCallSha256:string|null=null;
 async function accessGrant(operation:string,url:string,descriptor:Readonly<Record<string,unknown>>,hopSha256?:string){
  const canonical=urlOf(url).href;
  if(["native_acquire","browser_request","browser_render"].includes(operation)&&unavailableHosts.has(new URL(canonical).hostname))return null;
  const bindingText=JSON.stringify({url:canonical,descriptor,...(activeCallSha256?{callSha256:activeCallSha256}:{}),
   ...(hopSha256?{hopSha256}:{})}),bindingSha256=hash(bindingText);
  const result=await rpc("mizizi_authorize_desk_access_v1",{p_scope:scope,p_operation:operation,
   p_binding_text:bindingText,p_binding_sha256:bindingSha256});
  if(result===null)return null;
  const g=result as {operation:string;bindingSha256:string;urlSha256:string;policyRef:string;validUntil:string;allowed:boolean};
  const expiry=Date.parse(g?.validUntil);
  if(!g||g.allowed!==true||g.operation!==operation||g.bindingSha256!==bindingSha256||
   g.urlSha256!==hash(canonical)||typeof g.policyRef!=="string"||
   !/^[A-Za-z0-9._:/-]{8,200}$/.test(g.policyRef)||!Number.isFinite(expiry)||
   expiry<=now()||expiry>Date.parse(scope.leaseExpiresAt))return null;
  const key=operation+":"+hash(canonical),previous=accessRevisions.get(key);
  if(previous!==undefined&&previous!==g.policyRef)return null;
  if(previous===undefined&&accessRevisions.size>=512)return null;
  accessRevisions.set(key,g.policyRef);
  return g;
 }
 const brave=options.braveApiKey===undefined?null:createDurableDeskSearchGatewayV1({apiKey:options.braveApiKey,rpc:options.rpc,
  transport:options.searchTransport,now});
 const discovery=new Map<DeskSearchRequestV1["operation"],{host:string;provider:string;
  run:ReturnType<typeof createDurableDeskSearchGatewayV1>|ReturnType<typeof createDurableDeskPublicDiscoveryGatewayV1>}>();
 if(options.discovery!==undefined&&(!options.discovery||typeof options.discovery!=="object"||
  Array.isArray(options.discovery)||Object.keys(options.discovery).some(k=>!["search_web","search_news"].includes(k))))
  fail("DISCOVERY_CONFIGURATION_DENIED");
 for(const operation of ["search_web","search_news"] as const){
  const choice=options.discovery?.[operation];
  if(choice!==undefined){
   const configuration=qualifyDeskPublicDiscoveryProviderV1(choice,operation);
   discovery.set(operation,{host:configuration.host,provider:configuration.provider,
    run:createDurableDeskPublicDiscoveryGatewayV1({configuration,operation,rpc:options.rpc,now,
     resourceTestSeams:options.discoveryTestSeams})});
  }else if(brave)discovery.set(operation,{host:SEARCH_HOST,provider:"brave",run:brave});
 }
 if(!discovery.size)fail("DISCOVERY_CONFIGURATION_REQUIRED");
 const discoveryHosts=Object.freeze(Object.fromEntries([...discovery].map(([op,value])=>[op,value.host])));
 const unavailableHosts=new Set<string>();
 let recallCandidate:Readonly<{sourceReceiptId:string;sourceResultSha256:string;originLeadId?:string}>|null=null;
 if(options.localBrowser&&(options.browser||typeof options.authorizeInteractiveCall!=="function"||
  typeof options.localBrowser.authorizeAccess!=="function"||typeof options.localBrowser.authorizeQuery!=="function"))
  fail("LOCAL_BROWSER_CONFIGURATION_DENIED");
 const budget=createDeskResourceBudgetV1({rpc:options.rpc,now});
 const TOOLS:readonly DeskToolCallV1["name"][]=Object.freeze([...BASE_TOOLS.filter(n=>
  n!=="search_web"&&n!=="search_news"||discovery.has(n)),...(options.allowSameCaseRecall?["recall_evidence" as const]:[]),...(options.browser?["render_page" as const]:[]),...(options.localBrowser?["browse_page" as const]:[])]);
 const transient=new Map<string,TransientSource>();
 let transientBytes=0;
 function remember(id:string,receipt:TransientSource["receipt"],provenance:Record<string,unknown>){
  const bytes=receipt.byteLength+(receipt.contract==="mizizi.desk_browser_read.v1"?(receipt.visual?.byteLength??0):0);
  if(transient.size>=5||transientBytes+bytes>12000000)fail("TRANSIENT_SOURCE_BOUND");
  transient.set(id,{receipt,provenance});transientBytes+=bytes;
 }
 const browserProvider=options.browser?createCloudflareBrowserTransportV1({accountId:options.browser.accountId,apiToken:options.browser.apiToken,...options.browserTestSeams}):null;
 const browser=browserProvider&&options.browser?createDeskBrowserReaderV1({
  provider:browserProvider,...budget.browserFinance(browserProvider.accountFingerprint),now,
  authorize:async(binding:{scope:DeskSearchScopeV1;url:string;visual:boolean},digest:string)=>{
   assertScope(binding.scope);
   // Visual disclosure is not ordinary transient navigation.
   if(binding.visual){
    const p=await policy(urlOf(binding.url).hostname);
    if(!p||p.browserRenderAllowed!==true||p.visualProcessingAllowed!==true||!p.excerptRetentionAllowed)return null;
   }
   const grant=await accessGrant("browser_render",binding.url,binding);
   if(!grant)return null;
   const external=await options.browser!.authorize(binding,digest);
   if(!external)return null;
   const expiry=Math.min(Date.parse(grant.validUntil),Date.parse(external.validUntil));
   if(!Number.isFinite(expiry)||expiry<=now())return null;
   return {...external,validUntil:new Date(expiry).toISOString()};
  },
  authorizeRequest:async(binding,u,resourceType,policy)=>{
   assertScope(binding.scope);
   return !!await accessGrant("browser_request",u,{url:u,resourceType,parentUrl:binding.url})&&
    await options.browser!.authorizeRequest(binding,u,resourceType,policy)===true;
  }
 }):null;
 const nativePrecharge:NativeOptions["precharge"]=async(candidate,target,authority)=>{
  assertScope(candidate);
  if(!await accessGrant("native_acquire",target.url,{},hash(JSON.stringify({scope:candidate,target}))))return false;
  return budget.nativePrecharge(options.nativeAccountFingerprint)(candidate,target,authority);
 };
 const nativeAuthority:NativeOptions["authorize"]=async(candidate,url)=>{
  assertScope(candidate);
  // Acquisition is independently authorized per hop by the access RPC.
  // A source-content custody read is not an acquisition permission.
  const grant=await accessGrant("native_acquire",url,{});
  if(!grant)return null;
  const external=await options.authorizeAcquisition(candidate,url);
  if(!external||external.acquisitionAllowed!==true||external.zeroIncrementalSpendAllowed!==true)return null;
  const expiry=Math.min(Date.parse(grant.validUntil),Date.parse(external.validUntil));
  if(!Number.isFinite(expiry)||expiry<=now())return null;
  return {...external,validUntil:new Date(expiry).toISOString()};
 };
 const publicMethod=createDeskPublicMethodGateV1({scope,now,readRobots:async robots=>{
  // Exact /robots.txt only; do not follow redirect to another location.
  // Separate durable access and precharge for this additional network hop.
  const read=createDeskNativeReaderV1({...options.nativeTestSeams,now,precharge:nativePrecharge,
   authorize:(candidate,url)=>url===robots?nativeAuthority(candidate,url):Promise.resolve(null)});
  return read({scope,url:robots});
 }});
 const methodEligible=(url:string)=>options.requirePublicMethodEligibility===true?publicMethod(url):Promise.resolve(true);
 const native=createDeskNativeReaderV1({...options.nativeTestSeams,now,precharge:nativePrecharge,
  authorize:async(candidate,url)=>{
   const grant=await nativeAuthority(candidate,url);
   return grant&&await methodEligible(url)?grant:null;
  }});
 const examination=async(candidate:DeskSearchScopeV1,binding:Readonly<Record<string,unknown>>)=>{
  assertScope(candidate);
  if(["pdf_visual","browser_visual"].includes(String(binding.mode))){
   const p=await policy(urlOf(binding.finalUrl).hostname);
   if(p?(p.sourceFamily!=="public_web"||p.visualProcessingAllowed!==true||!p.excerptRetentionAllowed):!await operationRule(String(binding.mode),String(binding.finalUrl)))return false;
  }
  // Local text examination and protected evidence disclosure are distinct.
  return !!await accessGrant(binding.mode==="pdf_visual"?"pdf_visual":binding.mode==="browser_visual"?"browser_visual":
    binding.representation==="rendered_dom_not_original_response"?"browser_text":"native_text",String(binding.finalUrl),binding)&&
   await options.authorizeExamination(candidate,binding)===true;
 };
 const interpret=createDeskSourceInterpreterV1({now,authorize:examination});
 const pdfVisual=createDeskPdfVisualReaderV1({now,authorize:examination});
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
   (parsed.visual!==null&&(!parsed.visual||!UUID.test(parsed.visual.sourceId)||!SHA.test(parsed.visual.sha256)||parsed.visual.contentType!=="image/png"))||
   (parsed.unavailable!==undefined&&(!isDeskUnavailableOutcomeV1(parsed.unavailable)||parsed.leads.length||parsed.sources.length||parsed.visual!==null))||
   (parsed.consultation!==undefined&&(!validDeskTransientConsultationV1(parsed.consultation)||parsed.consultation.text!==undefined||parsed.consultation.receiptId!==id||parsed.sources.length||parsed.unavailable!==undefined||
     (parsed.visual!==null&&(parsed.visual.sourceId!==id||parsed.consultation.textSha256!==hash(visualText(parsed.visual.sha256))))))||
   bodyOf(parsed)!==row.resultText)fail("CUSTODY_READBACK_UNCONFIRMED");
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
 function makeExcerpt(id:string,p:CustodyPolicy,receipt:{sha256:string;retrievedAt:string;finalUrl:string},locator:string,excerpt:string):SourceExcerptV1{
  const citation=receipt.finalUrl+"#"+locator;
  if(!text(citation,1000,8))fail("SOURCE_CITATION_BOUND");
  const source:SourceAuthorityV1={sourceId:id,caseId:scope.caseId,workspaceId:scope.workspaceId,
   originKey:p.originKey,lineageKey:p.lineageKey,fingerprint:receipt.sha256,authorityRef:p.authorityRef,
   useBasis:p.useBasis,observedAt:receipt.retrievedAt,expiresAt:p.validUntil,revokedAt:null,
   privateResearchAllowed:true,externalModelProcessingAllowed:true,privateEvidenceRetentionAllowed:true};
  verifyInvestigationSourceV1(source,identity,now());
  return {source,excerpt:excerpt.trim().slice(0,4000).trim(),citation};
 }
 function makeConsultation(id:string,p:CustodyPolicy|null,receipt:{finalUrl:string;retrievedAt:string},locator:string,raw:string):DeskTransientConsultationV1|undefined{
  // Ordinary access alone is not permission to disclose publisher text.
  // This separate path uses independently reviewed model processing, while
  // keeping the normalized text in memory only.
  if(options.allowTransientModelConsultation?.()!==true||!p||p.excerptRetentionAllowed||!p.externalModelProcessingAllowed||
   !SHA.test(options.transientProviderCredentialSha256??"")||p.transientProviderCredentialSha256!==options.transientProviderCredentialSha256||
   !text(p.transientProviderProcessingRef,500,8))return undefined;
  return consultationContent(id,receipt,locator,raw);
 }
 function consultationContent(id:string,receipt:{finalUrl:string;retrievedAt:string},locator:string,raw:string):DeskTransientConsultationV1|undefined{
  const content=raw.replace(/[\p{Cc}\p{Cf}]/gu," ").replace(/\s+/g," ").trim().slice(0,4000).trim();
  if(!content||locator==="no_text")return undefined;
  const ref={receiptId:id,textSha256:hash(content),textBytes:Buffer.byteLength(content,"utf8"),
   citation:receipt.finalUrl+"#"+locator,observedAt:receipt.retrievedAt,text:content};
  if(!validDeskTransientConsultationV1(ref,true))fail("TRANSIENT_CONSULTATION_SHAPE");
  return Object.freeze(ref);
 }
 // One standing interpretation rule applies to permitted operations, not
 // a publisher or file format. The reviewed source-use reference and actual
 // provider-handling reference are independently issued; ordinary access,
 // missing negative directives and licence labels do not themselves grant use.
 async function operationRule(method:string,url:string){
  if(options.allowTransientModelConsultation?.()!==true||options.requirePublicMethodEligibility!==true||
   !SHA.test(options.transientProviderCredentialSha256??""))return null;
  urlOf(url);
  const current=await rpc("mizizi_read_desk_operational_policy_v1",{p_scope:scope}) as {
   revision:number;scope:DeskSearchScopeV1;credentialSha256:string;publicWebTransientAllowed:boolean;validUntil:string;
   operationInterpretationRule?:{kind:string;sourceUseRef:string;providerProcessingRef:string;credentialSha256:string;operations:string[]}|null
  }|null;
  const rule=current?.operationInterpretationRule,expiry=Date.parse(current?.validUntil??"");
  if(!current||!current.scope||scopeKeys.some(k=>current.scope[k]!==scope[k])||
   !Number.isSafeInteger(current.revision)||current.revision<1||current.publicWebTransientAllowed!==true||
   current.credentialSha256!==options.transientProviderCredentialSha256||
   !Number.isFinite(expiry)||expiry<=now()||expiry>Date.parse(scope.leaseExpiresAt)||
   !rule||Object.keys(rule).length!==5||rule.kind!=="bounded_public_research_v1"||
   rule.credentialSha256!==current.credentialSha256||
   !text(rule.sourceUseRef,500,8)||!text(rule.providerProcessingRef,500,8)||rule.sourceUseRef===rule.providerProcessingRef||
   !Array.isArray(rule.operations)||rule.operations.length<1||rule.operations.length>4||
   new Set(rule.operations).size!==rule.operations.length||
   rule.operations.some(op=>!["native_text","browser_text","pdf_visual","browser_visual"].includes(op))||
   !rule.operations.includes(method))return null;
  return {kind:rule.kind,standingRevision:current.revision,method,restrictionCheck:"no_known_directive"};
 }
 async function operationConsultation(id:string,method:string,receipt:{finalUrl:string;retrievedAt:string},locator:string,raw:string,restricted:boolean){
  if(restricted||!raw.trim())return null;
  const operationInterpretation=await operationRule(method,receipt.finalUrl);
  const consultation=operationInterpretation?consultationContent(id,receipt,locator,raw):undefined;
  return consultation?{consultation,operationInterpretation}:null;
 }
 const visualText=(sha:string)=>"Visual examination only; image SHA-256 "+sha+".";
 async function append(callText:string,callSha256:string,result:DeskToolResultV1,
  p:{host:string;revision:number|null},provenance:Record<string,unknown>,bindings:readonly {id:string;url:string}[]){
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
 // The same local browser lives across the actual model transcript, not
 // across unrelated cases. Its source receipts enter the existing ledger.
 type LocalSessionProof=NonNullable<Awaited<ReturnType<ReturnType<typeof budget.localBrowserFinance>["readSession"]>>>;
 const localConfig=options.localBrowser;
 const localGrant=async(operation:string,url:string,descriptor:Readonly<Record<string,unknown>>,hopSha256?:string)=>{
  if(!localConfig||!activeCallSha256||await localConfig.authorizeAccess(scope,url,operation)!==true)return null;
  if(operation==="browser_visual"||operation==="browser_render"&&descriptor.visual===true){
   const p=await policy(urlOf(url).hostname);
   if(p?(p.sourceFamily!=="public_web"||p.browserRenderAllowed!==true||p.visualProcessingAllowed!==true||!p.excerptRetentionAllowed):!await operationRule("browser_visual",url))return null;
  }
  return accessGrant(operation,url,descriptor,hopSha256);
 };
 const resolveLocalLead=async(candidate:DeskSearchScopeV1,id:string)=>{
  assertScope(candidate);
  if(!UUID.test(id))return null;
  const raw=await rpc("mizizi_resolve_desk_reference_lead_v1",{p_scope:scope,p_lead_id:id}) as StoredLead|null;
  if(!raw||raw.id!==id||!UUID.test(raw.receiptId)||!text(raw.label,500))return null;
  const parent=await readReceipt(raw.receiptId);
  if(!parent||!parent.result.leads.some(l=>l.id===id&&l.kind===raw.kind&&l.label===raw.label))return null;
  return {...raw,url:urlOf(raw.url).href};
 };
 const local=localConfig?createDurableLocalDeskBrowserV1({
  scope,host:localConfig,finance:budget.localBrowserFinance(localConfig.accountFingerprint),now,
  authorizeAction:async(b:Record<string,unknown>,digest:string)=>{
   assertScope(b.scope as DeskSearchScopeV1);
   if(!activeCallSha256||hash(JSON.stringify(b))!==digest)return false;
   if(b.operation==="open")return true;
   if(typeof b.url!=="string")return false;
   const visual=b.visual===true||typeof b.visualSha256==="string";
   if(!await localGrant("browser_render",b.url,{url:b.url,visual}))return false;
   if(typeof b.target==="string"&&!await localGrant("browser_render",b.target,{url:b.target,visual:false}))return false;
   return b.operation!=="search"||typeof b.query==="string"&&
    await localConfig.authorizeQuery(scope,b.query,b.url)===true;
  },
  authorizeRequest:async(b:DeskBrowserResourceBindingV1,digest:string)=>{
   assertScope(b.scope);
   return hash(JSON.stringify(b))===digest&&!!await localGrant("browser_request",b.url,
    {url:b.url,resourceType:b.resourceType,parentUrl:b.topLevelUrl})&&await methodEligible(b.url);
  },
  readResource:async(b:DeskBrowserResourceBindingV1,digest:string,signal:AbortSignal,session:LocalSessionProof)=>{
   assertScope(b.scope);
   const callHash=activeCallSha256;
   if(!callHash||hash(JSON.stringify(b))!==digest)fail("LOCAL_RESOURCE_SCOPE_DENIED");
   const descriptor={url:b.url,resourceType:b.resourceType,parentUrl:b.topLevelUrl};
   const matches=(candidate:DeskBrowserResourceBindingV1,sha:string)=>
    activeCallSha256===callHash&&sha===digest&&JSON.stringify(candidate)===JSON.stringify(b);
   const read=createDeskBrowserResourceReaderV1({...options.localBrowserResourceTestSeams,now,
    authorize:async(candidate,sha)=>{
     if(!matches(candidate,sha))return null;
     const g=await localGrant("browser_request",b.url,descriptor);
     if(!g||!await methodEligible(b.url))return null;
     const expiry=Math.min(Date.parse(g.validUntil),Date.parse(session.validUntil));
     return expiry>now()?{policyRef:g.policyRef,validUntil:new Date(expiry).toISOString(),
      acquisitionAllowed:true,zeroIncrementalSpendAllowed:true}:null;
    },
    precharge:async(candidate,target,_authority,sha)=>{
     if(!matches(candidate,sha))return false;
     const bound={scope,target,sessionId:session.sessionId,callSha256:callHash,resourceRequestSha256:digest};
     const hop=hash(JSON.stringify(bound));
     return !!await localGrant("browser_request",b.url,descriptor,hop)&&
      await budget.browserResourcePrecharge(options.nativeAccountFingerprint)(bound,hop)===true;
    }});
   return read(b,digest,signal);
  },
  routerOptions:(getSession:()=>Promise<LocalSessionProof>)=>({
   resolveReference:resolveLocalLead,authorizeCall:options.authorizeInteractiveCall!,
   authorizeQuery:localConfig.authorizeQuery,visualAllowed:localConfig.captureVisual===true,
   authorizeContentLabels:async(candidate:DeskSearchScopeV1,url:string)=>{
    assertScope(candidate);
    const p=await policy(urlOf(url).hostname);
    return !!p&&p.browserRenderAllowed===true&&p.excerptRetentionAllowed;
   },
   authorizeVisualLead:async(candidate:DeskSearchScopeV1,url:string,capture:{body:Uint8Array})=>{
    assertScope(candidate);
    const p=await policy(urlOf(url).hostname);
    return (p?p.visualProcessingAllowed===true&&p.excerptRetentionAllowed:
     !!await operationRule("browser_visual",url)&&!await deskRenderedProcessingRestrictedV1(capture.body,url))&&
     await localConfig.authorizeAccess(scope,url,"browser_visual")===true;
   },
   admitObservation:async(b:{
    scope:DeskSearchScopeV1;call:DeskToolCallV1;callSha256:string;receiptId:string;parentLeadId:string;action:string;
    observation:{url:string;generation:number;observationSha256:string};
    capture:{finalUrl:string;sha256:string;body:Uint8Array;visibleText:string;visibleTextSha256:string;
     visual:null|{body:Uint8Array;sha256:string;contentType:"image/png"}};
    leads:readonly DeskToolLeadV1[];actionBindings:readonly {id:string;url:string;action:string;generation:number;observationSha256:string}[];
   })=>{
    assertScope(b.scope);
    if(activeCallSha256!==b.callSha256||hash(JSON.stringify({scope:b.scope,call:b.call}))!==b.callSha256||
     b.parentLeadId!==b.call.input.lead_id||!UUID.test(b.receiptId)||
     b.observation.url!==b.capture.finalUrl||hash(b.capture.body)!==b.capture.sha256||
     hash(b.capture.visibleText)!==b.capture.visibleTextSha256)fail("LOCAL_CAPTURE_BINDING_DENIED");
    const session=await getSession(),parent=await resolveLocalLead(scope,b.parentLeadId);
    if(!parent)fail("LOCAL_PARENT_DENIED");
    const url=urlOf(b.capture.finalUrl).href,p=await policy(urlOf(url).hostname);
    const visual=b.action==="visual";
    if(p&&p.browserRenderAllowed!==true)fail("SOURCE_CUSTODY_DENIED");
    const restricted=!p&&await deskRenderedProcessingRestrictedV1(b.capture.body,url);
    const visualRule=!p&&!restricted?await operationRule("browser_visual",url):null;
    if(visual&&!p&&!visualRule)fail("SOURCE_CUSTODY_DENIED");
    if(!p?.excerptRetentionAllowed){
     // Non-retainable observations must carry no publisher action labels or visual content.
     const labels:Readonly<Record<string,string>>={expand:"Expand public section",search:"Search public page",follow:"Follow public reference",scroll_down:"Scroll down"};
     if(b.leads.some(l=>l.kind==="visual"?(!visualRule||l.label!=="Examine the current browser viewport"||!b.actionBindings.some(a=>a.id===l.id&&a.action==="visual")):l.kind!=="browser_action"||!b.actionBindings.some(a=>a.id===l.id&&labels[a.action]===l.label)))
      fail("TRANSIENT_BROWSER_LABEL_DENIED");
    }
    const descriptor=visual&&b.capture.visual?imageDescriptor({body:b.capture.visual.body,sha256:b.capture.visual.sha256,
     width:1280,height:900,byteLength:b.capture.visual.body.length}):null;
    if(visual!==!!descriptor)fail("VISUAL_DIGEST_DENIED");
    const examinationBinding=visual?{mode:"browser_visual",finalUrl:url,sha256:b.capture.sha256,
     visualSha256:descriptor!.sha256,pageNumber:1}:{representation:"rendered_dom_not_original_response",
     finalUrl:url,sha256:b.capture.sha256,pageStart:1,pageEnd:1};
    if(!await localGrant(visual?"browser_visual":"browser_text",url,examinationBinding)||
     await options.authorizeExamination(scope,examinationBinding)!==true)fail("LOCAL_EXAMINATION_DENIED");
    const excerpt=visual?"Visual derivative for examination; no textual claim is verified.":
     b.capture.visibleText.replace(/[\p{Cf}]/gu," ").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g," ").trim().slice(0,4000).trim();
    const capturedAt=new Date(now()).toISOString();
    const source={sha256:b.capture.sha256,retrievedAt:capturedAt,finalUrl:url};
    const permitted=!p?await operationConsultation(b.receiptId,visual?"browser_visual":"browser_text",source,
     visual?"browser_viewport:1":"browser_visible_text",visual?visualText(descriptor!.sha256):excerpt,restricted):null;
    if(visual&&!p&&!permitted)fail("VISUAL_AUTHORITY_DENIED");
    const consultation=permitted?.consultation??(!visual?makeConsultation(b.receiptId,p,source,"browser_visible_text",excerpt):undefined);
    const locator=visual?"browser_viewport:1":excerpt&&(p?.excerptRetentionAllowed||consultation)?"browser_visible_text":"no_text";
    const metadata={parentReceiptId:parent.receiptId,finalUrl:url,sourceSha256:b.capture.sha256,
     projectionSha256:descriptor?.sha256??b.capture.visibleTextSha256,contentType:"text/html",retrievedAt:capturedAt,
     byteLength:b.capture.body.length,locator,detail:{localBrowser:{reservationId:session.reservationId,
      requestSha256:session.requestSha256,sessionId:session.sessionId,observationSha256:b.observation.observationSha256,
      action:b.action,generation:b.observation.generation},visual:descriptor,
      actionBindings:b.actionBindings.map(x=>({id:x.id,action:x.action}))},
     ...(permitted?{operationInterpretation:permitted.operationInterpretation}:{})};
    const result:DeskToolResultV1={receiptId:b.receiptId,leads:b.leads,
     sources:excerpt&&p?.excerptRetentionAllowed?[makeExcerpt(b.receiptId,p,source,locator,excerpt)]:[],
     ...(consultation?{consultation}:{}),
     ...(descriptor&&b.capture.visual?{visual:{sourceId:b.receiptId,sha256:descriptor.sha256,
      contentType:"image/png" as const,body:Uint8Array.from(b.capture.visual.body)}}:{})};
    return append(JSON.stringify({scope:b.scope,call:b.call}),b.callSha256,result,p??{host:urlOf(url).hostname,revision:null},metadata,
     b.actionBindings.map(x=>({id:x.id,url:x.url})));
   }
  })
 }):null;
 const execute=async(candidate:Parameters<DeskAnthropicOptionsV1["executeTool"]>[0],
  call:Parameters<DeskAnthropicOptionsV1["executeTool"]>[1],callSha256:string,retainedOnly=false):Promise<DeskToolResultV1|null>=>{
  assertScope(candidate);
  const callText=JSON.stringify({scope:candidate,call});
  if(!SHA.test(callSha256)||hash(callText)!==callSha256||!TOOLS.some(t=>t===call.name)||
   !call.input||Object.keys(call.input).length!==(call.name==="read_document"?3:call.name==="inspect_visual"||call.name==="browse_page"?2:1))
   fail("TOOL_CALL_DENIED");
  if(activeCallSha256!==null)fail("CONCURRENT_TOOL_CALL_DENIED");
  activeCallSha256=callSha256;
  try{
  if(call.name==="browse_page"||call.name==="inspect_visual"&&local?.ownsLead(call.input.lead_id)){
   if(!local)fail("LOCAL_BROWSER_CONFIGURATION_DENIED");
   if(await options.authorizeInteractiveCall!(candidate,call,callSha256)!==true)fail("LOCAL_TOOL_AUTHORITY_DENIED");
   return await local.execute(candidate,call,callSha256);
  }
  if(call.name==="recall_evidence"){
   if(retainedOnly||!options.allowSameCaseRecall||call.input.query!=="case evidence"||!recallCandidate)
    fail("RECALL_AUTHORITY_DENIED");
   const origin=recallCandidate!;
   const prior=await readReceipt(origin.sourceReceiptId);
   if(!prior||prior.row.resultSha256!==origin.sourceResultSha256||prior.result.unavailable||prior.result.visual)
    fail("RECALL_ORIGIN_DENIED");
   const receiptId=randomUUID();
   let result:DeskToolResultV1;
   if(origin.originLeadId){
    const lead=prior!.result.leads.find(l=>l.id===origin.originLeadId&&l.kind==="reference");
    if(!lead||prior!.result.sources.length||!text(lead.label,500))fail("RECALL_LEAD_DENIED");
    result={receiptId,leads:[{id:randomUUID(),kind:"reference",label:lead!.label}],sources:[]};
   }else{
    if(prior!.result.sources.length!==1||prior!.result.sources[0].source.sourceId!==origin.sourceReceiptId)fail("RECALL_ORIGIN_DENIED");
    const entry=prior!.result.sources[0];
    verifyInvestigationSourceV1(entry.source,identity,now());
    if(!entry.source.externalModelProcessingAllowed)fail("RECALL_DISCLOSURE_DENIED");
    result={receiptId,leads:[],sources:[{source:{...entry.source,sourceId:receiptId},excerpt:entry.excerpt,citation:entry.citation}]};
   }
   const resultText=bodyOf(result),resultSha256=hash(resultText);
   const admitted=await rpc("mizizi_admit_desk_same_case_recall_v1",{p_call_text:callText,p_call_sha256:callSha256,
    p_receipt_id:receiptId,p_origin_id:origin.sourceReceiptId,p_result_text:resultText,p_result_sha256:resultSha256}) as
     {receiptId?:string;resultSha256?:string;outcome?:string}|null;
   if(!admitted||admitted.receiptId!==receiptId||admitted.resultSha256!==resultSha256||admitted.outcome!=="created")
    fail("RECALL_ADMISSION_DENIED");
   const stored=await readReceipt(receiptId);
   if(!stored||stored.row.callSha256!==callSha256||stored.row.resultSha256!==resultSha256||stored.row.resultText!==resultText)
    fail("RECALL_READBACK_DENIED");
   recallCandidate=null;
   return result;
  }
  if(call.name==="search_web"||call.name==="search_news"){
   const query=call.input.query;
   if(!text(query,300,3))fail("QUERY_DENIED");
   if(call.name==="search_web"&&options.sharedNativeSearch===true){
    const receiptId=randomUUID(),leadId=randomUUID();
    const result:DeskToolResultV1={receiptId,leads:[{id:leadId,kind:"reference",label:"Retained source candidate (unverified)"}],sources:[]};
    const resultText=bodyOf(result),resultSha256=hash(resultText);
    const shared=await rpc("mizizi_use_desk_shared_search_v1",{p_call_text:callText,p_call_sha256:callSha256,
     p_receipt_id:receiptId,p_lead_id:leadId,p_result_text:resultText,p_result_sha256:resultSha256}) as
      {receiptId?:string;resultSha256?:string;outcome?:string}|null;
    if(shared!==null){
     if(!shared||shared.receiptId!==receiptId||shared.resultSha256!==resultSha256||
      !["created","replayed"].includes(shared.outcome??""))fail("SHARED_SEARCH_ADMISSION_DENIED");
     const stored=await readReceipt(receiptId);
     if(!stored||stored.row.callSha256!==callSha256||stored.row.resultSha256!==resultSha256||stored.row.resultText!==resultText)
      fail("CUSTODY_READBACK_UNCONFIRMED");
     return result;
    }
   }
   if(retainedOnly)return null;
   const selected=discovery.get(call.name);
   if(!selected)fail("DISCOVERY_CONFIGURATION_DENIED");
   if(unavailableHosts.has(selected.host))fail("DISCOVERY_AVENUE_UNAVAILABLE");
   const p=await policy(selected.host);
   if(!p||p.sourceFamily!==(selected.provider==="brave"?"brave_discovery":"public_web"))fail("SEARCH_CUSTODY_DENIED");
   const request={scope:{jobId:scope.jobId,caseId:scope.caseId,workspaceId:scope.workspaceId,
    expectedRevision:scope.expectedRevision,workerId:scope.workerId,leaseExpiresAt:scope.leaseExpiresAt},
    operation:call.name,query,count:5} as const;
   const reply=await selected.run(request);
   const requestText=selected.provider==="brave"?JSON.stringify(request):
    JSON.stringify({...request,provider:selected.provider,providerHost:selected.host});
   if(reply.requestSha256!==hash(requestText)||reply.operation!==call.name||reply.provider!==selected.provider||
    ("providerHost" in reply&&reply.providerHost!==selected.host)||
    ("requestText" in reply&&reply.requestText!==requestText)||
    !UUID.test(reply.reservationId)||reply.identityVerified!==false)fail("SEARCH_RECEIPT_DENIED");
   const unavailable="unavailable" in reply?reply.unavailable:undefined;
   if(unavailable!==undefined&&(!isDeskUnavailableOutcomeV1(unavailable)||unavailable.host!==selected.host||reply.leads.length||
    selected.provider==="brave"))fail("UNAVAILABLE_OUTCOME_DENIED");
   const {leads,bindings}=leadsFrom(reply.leads.map(l=>({url:l.url,label:l.title})));
   const result=await append(callText,callSha256,{receiptId:randomUUID(),leads,sources:[],...(unavailable?{unavailable}:{})},p,
    {reservationId:reply.reservationId,requestSha256:reply.requestSha256,requestText},bindings);
   if(unavailable)unavailableHosts.add(unavailable.host);
   return result;
  }
  const id=call.input.lead_id;
  if(typeof id!=="string"||!UUID.test(id))fail("LEAD_ID_DENIED");
  const raw=await rpc("mizizi_resolve_desk_reference_lead_v1",{p_scope:scope,p_lead_id:id}) as StoredLead|null;
  if(!raw||raw.id!==id||!["reference","document","render","visual"].includes(raw.kind)||
   !UUID.test(raw.receiptId)||!text(raw.label,500))
   fail("LEAD_NOT_AVAILABLE");
  const parent=await readReceipt(raw.receiptId);
  if(!parent||!parent.result.leads.some(l=>l.id===id&&l.kind===raw.kind&&l.label===raw.label))
   fail("LEAD_CUSTODY_UNCONFIRMED");
  const url=urlOf(raw.url).href;
  if(call.name!=="read_page"){
   const cached=transient.get(raw.receiptId);
   if(!cached||cached.receipt.finalUrl!==url||hash(cached.receipt.body)!==cached.receipt.sha256||
     cached.receipt.scope.leaseExpiresAt!==scope.leaseExpiresAt||
     (parent.row.provenance as Record<string,unknown>)?.sourceSha256!==cached.receipt.sha256||
     (parent.row.provenance as Record<string,unknown>)?.projectionSha256!==cached.provenance.projectionSha256)
    fail("TRANSIENT_ORIGINAL_UNAVAILABLE");
   const p=await policy(urlOf(url).hostname);
   if(p&&p.sourceFamily!=="public_web")fail("SOURCE_CUSTODY_DENIED");
   const baseReceipt=cached.receipt,policyBinding=p??{host:urlOf(url).hostname,revision:null};
   const restricted=!p&&(baseReceipt.contract!=="mizizi.desk_native_read.v1"||baseReceipt.processingRestricted===true||cached.provenance.processingRestricted===true);
   const provenance={parentReceiptId:raw.receiptId,finalUrl:url,sourceSha256:baseReceipt.sha256,
    contentType:baseReceipt.contentType,retrievedAt:baseReceipt.retrievedAt,byteLength:baseReceipt.byteLength};
   const receiptId=randomUUID();
   if(call.name==="read_document"){
    const first=call.input.page_start,last=call.input.page_end,pages=cached.provenance.documentPages;
    if(raw.kind!=="document"||baseReceipt.contract!=="mizizi.desk_native_read.v1"||baseReceipt.contentType!=="application/pdf"||
     typeof first!=="number"||typeof last!=="number"||!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||
     first<1||last<first||last-first>9||typeof pages!=="number"||last>pages)fail("DOCUMENT_PAGE_DENIED");
    const interpreted=await interpret({scope,receipt:baseReceipt,pageStart:first,pageEnd:last});
    if(interpreted.source.sha256!==baseReceipt.sha256||interpreted.source.finalUrl!==url||
     interpreted.projectionSha256!==hash(JSON.stringify(interpreted.projection))||
     interpreted.projection.documentPages!==pages)fail("SOURCE_PROJECTION_UNCONFIRMED");
    const excerpt=interpreted.projection.segments.filter((seg:{text:string})=>seg.text.trim())
     .map((seg:{page:number;text:string})=>"Page "+seg.page+": "+seg.text).join("\n");
    const locator=excerpt?"pdf_pages:"+first+"-"+last:"no_text";
    const permitted=!p?await operationConsultation(receiptId,"native_text",baseReceipt,locator,excerpt,restricted):null;
    const consultation=permitted?.consultation??makeConsultation(receiptId,p,baseReceipt,locator,excerpt);
    return append(callText,callSha256,{receiptId,leads:[],sources:excerpt&&p?.excerptRetentionAllowed?
     [makeExcerpt(receiptId,p,baseReceipt,locator,excerpt)]:[],...(consultation?{consultation}:{})},policyBinding,
     {...provenance,projectionSha256:interpreted.projectionSha256,locator:p||permitted?locator:"no_text",detail:{pageStart:first,pageEnd:last},
      ...(permitted?{operationInterpretation:permitted.operationInterpretation}:{})},[]);
   }
   if(call.name==="inspect_visual"){
    const page=call.input.page;
    if((p?p.visualProcessingAllowed!==true||!p.excerptRetentionAllowed:restricted||!await operationRule("pdf_visual",url))||typeof page!=="number"||!Number.isSafeInteger(page)||page<1)
     fail("VISUAL_AUTHORITY_DENIED");
    let visual:{body:Uint8Array;sha256:string;width:number;height:number;byteLength:number},locator:string;
    if(raw.kind==="document"&&baseReceipt.contract==="mizizi.desk_native_read.v1"&&baseReceipt.contentType==="application/pdf"){
     if(typeof cached.provenance.documentPages!=="number"||page>cached.provenance.documentPages)fail("DOCUMENT_PAGE_DENIED");
     const rendered=await pdfVisual({scope,receipt:baseReceipt,pageNumber:page});
     if(rendered.source.sha256!==baseReceipt.sha256||rendered.pageNumber!==page)fail("VISUAL_DIGEST_DENIED");
     visual=rendered;locator="pdf_visual:"+page;
    }else if(raw.kind==="visual"&&baseReceipt.contract==="mizizi.desk_browser_read.v1"&&baseReceipt.visual&&page===1){
     const bound={mode:"browser_visual",finalUrl:url,sha256:baseReceipt.sha256,visualSha256:baseReceipt.visual.sha256,pageNumber:1};
     if(await examination(scope,bound)!==true)fail("VISUAL_AUTHORITY_DENIED");
     visual=baseReceipt.visual;locator="browser_viewport:1";
    }else fail("VISUAL_LEAD_DENIED");
    const descriptor=imageDescriptor(visual);
    const permitted=!p?await operationConsultation(receiptId,"pdf_visual",baseReceipt,locator,visualText(descriptor.sha256),restricted):null;
    if(!p&&!permitted)fail("VISUAL_AUTHORITY_DENIED");
    return append(callText,callSha256,{receiptId,leads:[],
     sources:p?[makeExcerpt(receiptId,p,baseReceipt,locator,"Visual derivative for examination; no textual claim is verified.")]:[],
     ...(permitted?{consultation:permitted.consultation}:{}),
     visual:{sourceId:receiptId,sha256:descriptor.sha256,contentType:"image/png",body:Uint8Array.from(visual.body)}},policyBinding,
     {...provenance,projectionSha256:descriptor.sha256,locator,detail:{page,visual:descriptor},
      ...(permitted?{operationInterpretation:permitted.operationInterpretation}:{})},[]);
   }
   if(call.name==="render_page"){
    if(raw.kind!=="render"||!browser||!browserProvider||!p||p.browserRenderAllowed!==true||
     baseReceipt.contract!=="mizizi.desk_native_read.v1"||cached.provenance.renderRequired!==true)
     fail("BROWSER_FALLBACK_DENIED");
    const visual=options.browser?.captureVisual===true&&p.visualProcessingAllowed===true&&p.excerptRetentionAllowed;
    const nativeOutcome={disposition:"render_required",finalUrl:url,sourceSha256:baseReceipt.sha256,
     projectionSha256:String(cached.provenance.projectionSha256)};
    const captured=await browser({scope,url,nativeOutcome,visual});
    const requestText=JSON.stringify({scope,url,hostname:urlOf(url).hostname,visual,
     sourceSha256:nativeOutcome.sourceSha256,projectionSha256:nativeOutcome.projectionSha256,
     accountFingerprint:browserProvider.accountFingerprint,reserveSeconds:120});
    if(captured.requestSha256!==hash(requestText)||captured.nativeSourceSha256!==baseReceipt.sha256||
     captured.nativeProjectionSha256!==nativeOutcome.projectionSha256||hash(captured.body)!==captured.sha256)
     fail("BROWSER_RECEIPT_DENIED");
    const interpreted=await interpret({scope,receipt:captured});
    if(interpreted.source.sha256!==captured.sha256||interpreted.source.representation!=="rendered_dom_not_original_response"||
     interpreted.source.finalUrl!==url||interpreted.projectionSha256!==hash(JSON.stringify(interpreted.projection)))
     fail("SOURCE_PROJECTION_UNCONFIRMED");
    const refs=leadsFrom(p.excerptRetentionAllowed?interpreted.projection.links.map((l:{url:string;label:string|null})=>({url:l.url,label:l.label})):
      interpreted.projection.links.filter((l:{url:string})=>!l.url.includes("?")).map((l:{url:string})=>({url:l.url,label:"Public reference (unverified)"})));
    const leads=[...refs.leads],bindings=[...refs.bindings];
    const descriptor=captured.visual?imageDescriptor(captured.visual):null;
    if(descriptor){
     const id=randomUUID();leads.push({id,kind:"visual",label:"Rendered viewport; available for visual examination"});
     bindings.push({id,url});
    }
    const segment=interpreted.projection.segments.find((seg:{text:string})=>seg.text.trim());
    const locator=segment?"article_text":"no_text";
    const consultation=segment?makeConsultation(receiptId,p,captured,locator,segment.text):undefined;
    const meta={parentReceiptId:raw.receiptId,finalUrl:url,sourceSha256:captured.sha256,
     projectionSha256:interpreted.projectionSha256,contentType:captured.contentType,retrievedAt:captured.retrievedAt,
     byteLength:captured.byteLength,locator,detail:{reservationId:captured.reservationId,
      requestSha256:captured.requestSha256,requestText,visual:descriptor}};
    const result=await append(callText,callSha256,{receiptId,leads,sources:segment&&p.excerptRetentionAllowed?
     [makeExcerpt(receiptId,p,captured,locator,segment.text)]:[],...(consultation?{consultation}:{})},p,meta,bindings);
    if(descriptor)remember(receiptId,captured,meta);
    return result;
   }
   fail("TOOL_CALL_DENIED");
  }
  if(raw.kind!=="reference")fail("LEAD_KIND_DENIED");
  if(options.sharedNativeReuse===true){
   const receiptId=randomUUID(),binding={p_call_text:callText,p_call_sha256:callSha256,p_receipt_id:receiptId};
   const offer=await rpc("mizizi_offer_desk_shared_source_v1",binding) as Record<string,unknown>|null;
   if(offer!==null){
    const o=offer as {contract:string;sourceReceiptId:string;sourceResultSha256:string;fieldKey:string;
     attributionRevision:number;spanSha256:string;finalUrl:string;parentReceiptId:string;result:Omit<DeskToolResultV1,"visual">&{visual:null}};
    const p=o?.result,entry=p?.sources?.[0],source=entry?.source;
    if(o.contract!=="mizizi.desk_shared_source_offer.v1"||!UUID.test(o.sourceReceiptId)||o.sourceReceiptId===receiptId||
     !SHA.test(o.sourceResultSha256)||!["recording_title","artist_credit","isrc","release_title","release_date","label","duration"].includes(o.fieldKey)||
     !Number.isSafeInteger(o.attributionRevision)||o.attributionRevision<1||!SHA.test(o.spanSha256)||
     o.finalUrl!==url||o.parentReceiptId!==raw.receiptId||p?.receiptId!==receiptId||
     !Array.isArray(p.leads)||p.leads.length!==0||!Array.isArray(p.sources)||p.sources.length!==1||p.visual!==null||
     !source||source.sourceId!==receiptId||source.externalModelProcessingAllowed!==true||!SHA.test(source.fingerprint)||
     typeof entry.excerpt!=="string"||!entry.excerpt.length||Array.from(entry.excerpt).length>1000||
     hash(entry.excerpt)!==o.spanSha256||![url+"#article_text",url+"#plain_text"].includes(entry.citation))
     fail("SHARED_SOURCE_OFFER_DENIED");
    verifyInvestigationSourceV1(source,identity,now());
    // This is examination of a retained native derivative, not acquisition
    // of new bytes. Bind the original fingerprint and exact attribution.
    if(await examination(scope,{finalUrl:url,sha256:source.fingerprint,representation:"native_response_bytes",
     pageStart:1,pageEnd:10,sharedSourceReceiptId:o.sourceReceiptId,sharedAttributionRevision:o.attributionRevision,
     spanSha256:o.spanSha256})!==true)fail("SHARED_SOURCE_EXAMINATION_DENIED");
    const result:DeskToolResultV1={receiptId,leads:[],sources:[{source,excerpt:entry.excerpt,citation:entry.citation}]};
    const resultText=bodyOf(result),resultSha256=hash(resultText);
    const admitted=await rpc("mizizi_admit_desk_shared_source_v1",{...binding,p_offer:offer,
     p_result_text:resultText,p_result_sha256:resultSha256}) as {receiptId?:string;resultSha256?:string;outcome?:string}|null;
    if(!admitted||admitted.receiptId!==receiptId||admitted.resultSha256!==resultSha256||
     !["created","replayed"].includes(admitted.outcome??""))fail("SHARED_SOURCE_ADMISSION_DENIED");
    const stored=await readReceipt(receiptId);
    if(!stored||stored.row.callSha256!==callSha256||stored.row.resultSha256!==resultSha256||stored.row.resultText!==resultText)
     fail("CUSTODY_READBACK_UNCONFIRMED");
    return result;
   }
  }
  if(retainedOnly)fail("SHARED_BATCH_READ_MISS");
  const receipt=await native({scope,url});
  const host=urlOf(receipt.finalUrl).hostname,p=await policy(host);
  if(p&&p.sourceFamily!=="public_web")fail("SOURCE_CUSTODY_DENIED");
  const interpreted=await interpret({scope,receipt});
  if(interpreted.source.sha256!==receipt.sha256||interpreted.source.finalUrl!==receipt.finalUrl||
   interpreted.source.representation!=="native_response_bytes"||
   hash(receipt.body)!==receipt.sha256||interpreted.projectionSha256!==hash(JSON.stringify(interpreted.projection)))
   fail("SOURCE_PROJECTION_UNCONFIRMED");
  const projection=interpreted.projection;
  if(!p){
   const refs=leadsFrom(projection.links.filter((l:{url:string})=>!l.url.includes("?"))
    .map((l:{url:string})=>({url:l.url,label:"Public reference (unverified)"})));
   const leads=[...refs.leads],bindings=[...refs.bindings],receiptId=randomUUID();
   const restricted=receipt.processingRestricted===true||projection.processingRestricted===true;
   const segment=projection.segments.find((seg:{text:string})=>typeof seg.text==="string"&&seg.text.trim());
   const permitted=segment?await operationConsultation(receiptId,"native_text",receipt,segment.locator,segment.text,restricted):null;
   const pages=receipt.contentType==="application/pdf"&&Number.isSafeInteger(projection.documentPages)&&
    projection.documentPages>0&&projection.documentPages<=10000?projection.documentPages:null;
   const documentPages=!restricted&&pages&&(await operationRule("native_text",receipt.finalUrl)||await operationRule("pdf_visual",receipt.finalUrl))?pages:null;
   if(documentPages!==null){
    const id=randomUUID();leads.push({id,kind:"document",label:"PDF document — "+documentPages+" pages"});
    bindings.push({id,url:receipt.finalUrl});
   }
   const meta={requestedUrl:receipt.requestedUrl,finalUrl:receipt.finalUrl,sourceSha256:receipt.sha256,
    projectionSha256:interpreted.projectionSha256,contentType:receipt.contentType,retrievedAt:receipt.retrievedAt,
    byteLength:receipt.byteLength,hopSha256:receipt.hopSha256,locator:permitted?segment.locator:"no_text",
    documentPages,renderRequired:false,...(permitted?{operationInterpretation:permitted.operationInterpretation}:{})};
   const result=await append(callText,callSha256,{receiptId,leads,sources:[],
    ...(permitted?{consultation:permitted.consultation}:{})},{host,revision:null},meta,bindings);
   if(documentPages!==null)remember(receiptId,receipt,{...meta,processingRestricted:restricted});
   return result;
  }
  const refs=leadsFrom(p.excerptRetentionAllowed?projection.links.map((l:{url:string;label:string|null})=>({url:l.url,label:l.label})):
   projection.links.filter((l:{url:string})=>!l.url.includes("?")).map((l:{url:string})=>({url:l.url,label:"Public reference (unverified)"})));
  const leads=[...refs.leads],bindings=[...refs.bindings];
  const receiptId=randomUUID(),sources:SourceExcerptV1[]=[];
  const segment=projection.segments.find((seg:{text:string})=>typeof seg.text==="string"&&seg.text.trim());
  const locator=segment?.locator??"no_text";
  // Only a bounded excerpt is retained. Raw HTML/PDF and full normalized
  // projection remain transient. Citation locator is derived, not a quote
  // position in original source bytes. No inferred source independence.
  if(segment&&p.excerptRetentionAllowed)sources.push(makeExcerpt(receiptId,p,receipt,locator,segment.text));
  const documentPages=receipt.contentType==="application/pdf"?projection.documentPages:null;
  const renderRequired=projection.kind==="html"&&projection.needsVisualReview===true&&!segment;
  if(typeof documentPages==="number"&&Number.isSafeInteger(documentPages)&&documentPages>0&&documentPages<=10000){
   const id=randomUUID();leads.push({id,kind:"document",label:"PDF document — "+documentPages+" pages"});
   bindings.push({id,url:receipt.finalUrl});
  }else if(renderRequired&&browser&&p.browserRenderAllowed===true){
   const id=randomUUID();leads.push({id,kind:"render",label:"Native extraction insufficient — rendering may help"});
   bindings.push({id,url:receipt.finalUrl});
  }
  const meta={requestedUrl:receipt.requestedUrl,finalUrl:receipt.finalUrl,sourceSha256:receipt.sha256,
   projectionSha256:interpreted.projectionSha256,contentType:receipt.contentType,
   retrievedAt:receipt.retrievedAt,byteLength:receipt.byteLength,hopSha256:receipt.hopSha256,locator,
   documentPages,renderRequired};
  const consultation=segment?makeConsultation(receiptId,p,receipt,locator,segment.text):undefined;
  const result=await append(callText,callSha256,{receiptId,leads,sources,...(consultation?{consultation}:{})},p,meta,bindings);
  if(leads.some(l=>l.kind==="document"||l.kind==="render"))remember(receiptId,receipt,meta);
  return result;
  }finally{activeCallSha256=null;}
 };
 const executeTool:DeskAnthropicOptionsV1["executeTool"]=async(candidate,call,callSha256)=>{
  const result=await execute(candidate,call,callSha256);
  if(!result)fail("TOOL_RESULT_UNCONFIRMED");
  return result!;
 };
 const readBatchDependencies=async(dependencies:NonNullable<InvestigationPassV1["deskToolReceipts"]>)=>{
  if(!Array.isArray(dependencies)||dependencies.length!==2)fail("BATCH_DEPENDENCY_SHAPE");
  const sources:SourceExcerptV1[]=[];
  for(const ref of dependencies){
   const read=await readReceipt(ref.receiptId);
   if(!read||read.row.callSha256!==ref.callSha256||read.row.resultSha256!==ref.resultSha256||(read.result.visual||read.result.unavailable))
    fail("BATCH_DEPENDENCY_CUSTODY_DENIED");
   sources.push(...read!.result.sources);
  }
  if(sources.length!==1||sources[0].source.useBasis!=="open_license"||sources[0].source.externalModelProcessingAllowed!==true)
   fail("BATCH_SOURCE_DENIED");
  verifyInvestigationSourceV1(sources[0].source,identity,now());
  return Object.freeze({dependencies:Object.freeze([...dependencies]),sources:Object.freeze(sources)});
 };
 // Independent deterministic calls use existing tool authority, not
 // manufactured model tool messages. A miss never contacts a provider.
 const tryRetainedBatch=async(query:string,authorizeTool:DeskAnthropicOptionsV1["authorizeTool"])=>{
  if(!options.sharedNativeSearch||!options.sharedNativeReuse)return null;
  const search={name:"search_web" as const,input:{query}};
  const sh=hash(JSON.stringify({scope,call:search}));
  if(await authorizeTool(scope,search,sh)!==true)return null;
  const found=await execute(scope,search,sh,true);
  if(!found)return null;
  if(found.leads.length!==1||found.leads[0].kind!=="reference"||found.sources.length||found.visual)
   fail("BATCH_SEARCH_RESULT_DENIED");
  const read={name:"read_page" as const,input:{lead_id:found.leads[0].id}};
  const rh=hash(JSON.stringify({scope,call:read}));
  if(await authorizeTool(scope,read,rh)!==true)fail("BATCH_READ_AUTHORITY_DENIED");
  const source=await execute(scope,read,rh,true);
  if(!source||source.sources.length!==1||source.leads.length||source.visual)fail("BATCH_SOURCE_DENIED");
  return readBatchDependencies([{receiptId:found.receiptId,callSha256:sh,resultSha256:hash(bodyOf(found))},
   {receiptId:source!.receiptId,callSha256:rh,resultSha256:hash(bodyOf(source!))}]);
 };
 const verifyToolReceipt:DeskAnthropicOptionsV1["verifyToolReceipt"]=async(candidate,binding,result)=>{
  assertScope(candidate);
  if(result.visual&&(!(result.visual.body instanceof Uint8Array)||hash(result.visual.body)!==result.visual.sha256))return false;
  if(result.consultation&&!validDeskTransientConsultationV1(result.consultation,true))return false;
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
 // Exact stored excerpts must match the current independent custody projection.
 const checkJournalPass=async(pass:InvestigationPassV1,failedHosts?:Set<string>):Promise<boolean>=>{
  if(pass.caseId!==scope.caseId||pass.workspaceId!==scope.workspaceId||
   !Array.isArray(pass.sourceReceipts)||pass.sourceReceipts.length>30)return false;
  if(pass.factualNoteReferences!==undefined){
   if(!options.factualNoteSubject||!factualNoteReferencesCurrentV1(pass.factualNoteReferences,
    await readDeskFactualNotesV1(options.rpc,scope,options.factualNoteSubject,now,pass.factualNoteReferences.map(r=>r.noteId))))return false;
  }
  const seen=new Set<string>();
  for(const ref of pass.sourceReceipts){
   if(!ref||!UUID.test(ref.sourceId)||seen.has(ref.sourceId)||ref.modelDisclosed!==true)return false;
   seen.add(ref.sourceId);
   const read=await readReceipt(ref.sourceId);
   const entry=read?.result.sources.find(s=>s.source.sourceId===ref.sourceId);
   if(!entry)return false;
   const a=entry.source;
   verifyInvestigationSourceV1(a,identity,now());
   if(ref.originKey!==a.originKey||ref.lineageKey!==a.lineageKey||
    ref.payloadFingerprint!==a.fingerprint||ref.useBasis!==a.useBasis||
    ref.authorityRef!==a.authorityRef||ref.observedAt!==a.observedAt||
    ref.citation!==entry.citation||ref.excerpt!==entry.excerpt)return false;
  }
  if(pass.deskToolReceipts!==undefined){
   if(!Array.isArray(pass.deskToolReceipts)||pass.deskToolReceipts.length>4)return false;
   const deps=new Set<string>(),depSources=new Set<string>(),unavailableCodes=new Set<string>();
   const consultationRefs:DeskConsultationRefV1[]=[];
   for(const ref of pass.deskToolReceipts){
    if(!ref||!UUID.test(ref.receiptId)||deps.has(ref.receiptId))return false;
    const read=await readReceipt(ref.receiptId);
    if(!read||read.row.callSha256!==ref.callSha256||read.row.resultSha256!==ref.resultSha256)return false;
    deps.add(ref.receiptId);
    if(read.result.unavailable){
     unavailableCodes.add(read.result.unavailable.code);
     failedHosts?.add(read.result.unavailable.host);
    }
    for(const s of read.result.sources)depSources.add(s.source.sourceId);
    if(read.result.consultation)consultationRefs.push(deskConsultationRefV1(read.result.consultation));
   }
   if(depSources.size!==seen.size||[...depSources].some(id=>!seen.has(id)))return false;
   if(JSON.stringify(consultationRefs)!==JSON.stringify(pass.deskConsultationReceipts??[]))return false;
   if(pass.costUnits===0&&pass.interruptionCode&&!unavailableCodes.has(pass.interruptionCode))return false;
  }
  return true;
 };
 const verifyJournalPass=(pass:InvestigationPassV1)=>checkJournalPass(pass);
 // A new dispatcher has no previous process memory. Reconstruct only the
 // negative discovery fence and optional opaque native recall candidate from
 // the exact current journal. Source content is not disclosed until a fresh
 // current-lease recall receipt is independently admitted and read back.
 const restoreJournalHistory=async(history:readonly InvestigationPassV1[])=>{
  recallCandidate=null;
  verifyInvestigationHistoryV1(identity,history);
  const failedHosts=new Set<string>();
  for(const pass of history)if(await checkJournalPass(pass,failedHosts)!==true)
   fail("HISTORY_CUSTODY_DENIED");
  live();
  if(options.allowSameCaseRecall&&history.length){
   const raw=await rpc("mizizi_read_desk_same_case_recall_candidate_v1",{p_scope:scope}) as
    {sourceReceiptId:string;sourceResultSha256:string;originLeadId?:string}|null;
   if(raw!==null){
    if(!raw||Object.keys(raw).sort().join(",")!==(raw.originLeadId===undefined?"sourceReceiptId,sourceResultSha256":"originLeadId,sourceReceiptId,sourceResultSha256")||
     !UUID.test(raw.sourceReceiptId)||!SHA.test(raw.sourceResultSha256)||(raw.originLeadId!==undefined&&!UUID.test(raw.originLeadId))||
     !history.some(p=>(raw.originLeadId!==undefined||p.sourceReceipts.some(s=>s.sourceId===raw.sourceReceiptId&&s.modelDisclosed===true))&&
      p.deskToolReceipts?.some(r=>r.receiptId===raw.sourceReceiptId&&r.resultSha256===raw.sourceResultSha256)))
     fail("RECALL_CANDIDATE_DENIED");
    if(raw.originLeadId!==undefined){
     const original=await readReceipt(raw.sourceReceiptId);
     if(!original||original.row.resultSha256!==raw.sourceResultSha256||original.result.sources.length||
      original.result.unavailable||original.result.visual||!original.result.leads.some(l=>l.id===raw.originLeadId&&l.kind==="reference"))
      fail("RECALL_CANDIDATE_DENIED");
    }
    recallCandidate=Object.freeze({...raw});
   }
  }
  live();
  // Apply only after the complete chain passed; the fence never grants access.
  for(const host of failedHosts)unavailableHosts.add(host);
  return Object.freeze(TOOLS.filter(tool=>{
   if(tool==="recall_evidence")return recallCandidate!==null;
   if(tool!=="search_web"&&tool!=="search_news")return true;
   const configured=discovery.get(tool);
   return !!configured&&!unavailableHosts.has(configured.host);
  }));
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
 return Object.freeze({enabledTools:TOOLS,discoveryHosts,executeTool,verifyToolReceipt,authorizeSource,authorizeModelProcessing,verifySources,verifyJournalPass,restoreJournalHistory,
  tryRetainedBatch,readBatchDependencies,
  closeInteractive:async()=>{if(local)await local.close();}});
}

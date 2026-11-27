/** MIZIZI desk research: bounded discovery transport, not a source or identity grant.
 * Trusted runtime must independently check current case/lease, disclosure scope,
 * provider entitlement and atomic account-wide budget. No default authority,
 * native model search, automatic retry, refund, or paid fallback exists.
 */
import {createHash} from "node:crypto";
import {isDeskAvailabilityFailureV1,type DeskAvailabilityFailureV1} from "./adaptive-investigation-v1.ts";
import {createDeskBrowserResourceReaderV1,createDeskTavilyDiscoveryReaderV1,DeskNativeHttpUnavailableV1} from "./desk-native-reader-v1.ts";
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{64}$/;
const MAX_BODY=256000;
const HOST="https://api.search.brave.com";
export type DeskSearchScopeV1=Readonly<{
 jobId:string;caseId:string;workspaceId:string;expectedRevision:number;
 workerId:string;leaseExpiresAt:string;
}>;
export type DeskSearchRequestV1=Readonly<{
 scope:DeskSearchScopeV1;operation:"search_web"|"search_news";query:string;count:number;
}>;
export type DeskSearchAuthorityV1=Readonly<{
 requestSha256:string;policyRef:string;validUntil:string;
 publicQueryAllowed:true;providerUseAllowed:true;zeroIncrementalSpendAllowed:true;
}>;
export type DeskSearchReservationV1=Readonly<{
 reservationId:string;requestSha256:string;provider:"brave";
 units:1;maximumIncrementalCostMicrousd:0;validUntil:string;
}>;
export type DeskSearchLeadV1=Readonly<{
 url:string;title:string;kind:"unverified_discovery_lead";
}>;
export type DeskSearchResultV1=Readonly<{
 contract:"mizizi.desk_search.v1";requestSha256:string;reservationId:string;
 provider:"brave";operation:DeskSearchRequestV1["operation"];retrievedAt:string;
 leads:readonly DeskSearchLeadV1[];identityVerified:false;
 sourceRetentionAuthorized:false;externalModelProcessingAuthorized:false;
}>;
export type DeskSearchGatewayOptionsV1=Readonly<{
 apiKey:string;
 /** Exact request plus digest; must consult current lease and independent
  * standing disclosure policy, not echo a model/user supplied flag. */
 authorize:(request:DeskSearchRequestV1,requestSha256:string)=>Promise<DeskSearchAuthorityV1|null>;
 /** Atomic durable precharge in the shared account ledger. Must check provider
  * entitlement, remaining shared allowance and case budget, deny uncertain
  * billing, and consume one unit even after a timeout/indeterminate response.
  * No in-memory counter or caller assertion qualifies for production. */
 reserve:(request:DeskSearchRequestV1,requestSha256:string,
  authority:DeskSearchAuthorityV1)=>Promise<DeskSearchReservationV1|null>;
 /** Confirm the exact reservation remains consumable once, against durable
  * account authority. Concurrent/replayed attempts must not both send. */
 consume:(reservation:DeskSearchReservationV1)=>Promise<boolean>;
 transport?:typeof fetch;now?:()=>number;
}>;
function fail(code:string):never{throw new Error("MIZIZI_DESK_"+code);}
function obj(x:unknown):Record<string,unknown>{
 if(!x||typeof x!=="object"||Array.isArray(x))fail("INVALID_RESPONSE");
 return x as Record<string,unknown>;
}
function expiry(value:unknown,now:number,lease:number):boolean{
 return typeof value==="string"&&Number.isFinite(Date.parse(value))&&
  Date.parse(value)>now&&Date.parse(value)<=lease;
}
function canonicalRequest(input:DeskSearchRequestV1,now:number):DeskSearchRequestV1{
 const s=input?.scope;
 if(!s||![s.jobId,s.caseId,s.workspaceId].every(id=>typeof id==="string"&&UUID.test(id))||
  !Number.isSafeInteger(s.expectedRevision)||s.expectedRevision<1||
  typeof s.workerId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(s.workerId)||
  typeof s.leaseExpiresAt!=="string"||!Number.isFinite(Date.parse(s.leaseExpiresAt))||
  Date.parse(s.leaseExpiresAt)<=now||
  !["search_web","search_news"].includes(input.operation)||
  typeof input.query!=="string"||input.query.trim()!==input.query||
  input.query.length<3||input.query.length>300||/[\p{Cc}\p{Cf}]/u.test(input.query)||
  !Number.isSafeInteger(input.count)||input.count<1||input.count>10)
  fail("INVALID_SEARCH_REQUEST");
 return Object.freeze({scope:Object.freeze({jobId:s.jobId,caseId:s.caseId,
  workspaceId:s.workspaceId,expectedRevision:s.expectedRevision,workerId:s.workerId,
  leaseExpiresAt:s.leaseExpiresAt}),operation:input.operation,query:input.query,count:input.count});
}
/** Search result URLs are ONLY leads. This does not establish DNS safety,
 * permission to fetch, or source rights. Actual retrieval needs a separate
 * validated egress path (including every redirect and subresource). */
function leadUrl(value:unknown):string|null{
 if(typeof value!=="string"||value.length>2048)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.port||
   !u.hostname.includes(".")||/^\d|\[|\]$/.test(u.hostname)||
   /(?:^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan)$/i.test(u.hostname))
   return null;
  u.hash="";return u.href;
 }catch{return null;}
}
async function readJson(response:Response):Promise<unknown>{
 const length=response.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY))
  fail("RESPONSE_TOO_LARGE");
 const reader=response.body?.getReader();
 if(!reader)fail("INVALID_RESPONSE");
 const chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){
   const next=await reader.read();
   if(next.done)break;
   size+=next.value.byteLength;
   if(size>MAX_BODY){await reader.cancel();fail("RESPONSE_TOO_LARGE");}
   chunks.push(next.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
 catch{fail("INVALID_RESPONSE");}
}
export function createDeskSearchGatewayV1(options:DeskSearchGatewayOptionsV1){
 if(typeof options?.apiKey!=="string"||options.apiKey.trim()!==options.apiKey||
  options.apiKey.length<12||typeof options.authorize!=="function"||
  typeof options.reserve!=="function"||typeof options.consume!=="function")
  fail("TRUSTED_CONFIGURATION_REQUIRED");
 const send=options.transport??fetch,now=options.now??Date.now;
 return async(input:DeskSearchRequestV1):Promise<DeskSearchResultV1>=>{
  const request=canonicalRequest(input,now()),lease=Date.parse(request.scope.leaseExpiresAt);
  const digest=createHash("sha256").update(JSON.stringify(request)).digest("hex");
  const approved=(a:DeskSearchAuthorityV1|null):a is DeskSearchAuthorityV1=>
   !!a&&a.requestSha256===digest&&typeof a.policyRef==="string"&&
   /^[A-Za-z0-9._:/-]{8,200}$/.test(a.policyRef)&&
   a.publicQueryAllowed===true&&a.providerUseAllowed===true&&
   a.zeroIncrementalSpendAllowed===true&&expiry(a.validUntil,now(),lease);
  const authority=await options.authorize(request,digest);
  if(!approved(authority))fail("QUERY_AUTHORITY_DENIED");
  const reservation=await options.reserve(request,digest,authority);
  if(!reservation||!UUID.test(reservation.reservationId)||
   reservation.requestSha256!==digest||!SHA.test(reservation.requestSha256)||
   reservation.provider!=="brave"||reservation.units!==1||
   reservation.maximumIncrementalCostMicrousd!==0||
   !expiry(reservation.validUntil,now(),lease))
   fail("ZERO_COST_BUDGET_UNAVAILABLE");
  // Revalidate after reservation; a revoked/changed policy may not send.
  const fresh=await options.authorize(request,digest);
  if(!approved(fresh)||fresh.policyRef!==authority.policyRef)
   fail("QUERY_AUTHORITY_CHANGED");
  if(await options.consume(reservation)!==true)fail("RESERVATION_NOT_CONSUMABLE");
  // An indeterminate transport result still consumes the precharged unit.
  if(!expiry(reservation.validUntil,now(),lease)||!approved(fresh))
   fail("RESERVATION_EXPIRED");
  const endpoint=new URL(request.operation==="search_web"?"/res/v1/web/search":"/res/v1/news/search",HOST);
  endpoint.searchParams.set("q",request.query);
  endpoint.searchParams.set("count",String(request.count));
  // Never forward source HTML, private case identifiers or credentials to
  // result URLs. No automatic navigation and no raw snippets in the receipt.
  let response:Response;
  try{
   response=await send(endpoint.href,{method:"GET",redirect:"error",
    headers:{"X-Subscription-Token":options.apiKey,Accept:"application/json"},
    signal:AbortSignal.timeout(Math.min(15000,Math.max(1,lease-now())))});
  }catch{fail("SEARCH_TRANSPORT_UNCONFIRMED");}
  if(response.status===429)fail("SEARCH_RATE_LIMITED");
  if(!response.ok||!/^application\/json\b/i.test(response.headers.get("content-type")??""))
   fail("SEARCH_PROVIDER_UNCONFIRMED");
  const payload=obj(await readJson(response));
  const results=request.operation==="search_web"
   ?(payload.web===undefined?[]:obj(payload.web).results):payload.results;
  if(!Array.isArray(results)||results.length>request.count)fail("INVALID_RESPONSE");
  const seen=new Set<string>(),leads:DeskSearchLeadV1[]=[];
  for(const value of results){
   const row=obj(value),url=leadUrl(row.url);
   if(!url||typeof row.title!=="string"||!row.title.trim()||row.title.length>500||
    /[\p{Cc}\p{Cf}]/u.test(row.title)||seen.has(url))continue;
   seen.add(url);leads.push(Object.freeze({url,title:row.title,kind:"unverified_discovery_lead"}));
  }
  if(now()>=lease)fail("LEASE_EXPIRED");
  const after=await options.authorize(request,digest);
  if(!approved(after)||after.policyRef!==authority.policyRef)fail("QUERY_AUTHORITY_CHANGED");
  return Object.freeze({contract:"mizizi.desk_search.v1",requestSha256:digest,
   reservationId:reservation.reservationId,provider:"brave",operation:request.operation,
   retrievedAt:new Date(now()).toISOString(),leads:Object.freeze(leads),
   identityVerified:false,sourceRetentionAuthorized:false,externalModelProcessingAuthorized:false});
 };
}


/** Production-facing composition of the existing service JWT RPC transport.
 * The key stays server-side; only a domain-separated credential fingerprint
 * reaches the private authority. No policy issuance or budget mutation outside
 * the three RPCs. Missing/unconfirmed authority fails closed.
 */
export function createDurableDeskSearchGatewayV1(options:Readonly<{
 apiKey:string;rpc:import("./research-worker-cycle-v1.ts").WorkerRpc;
 transport?:typeof fetch;now?:()=>number;
}>){
 if(typeof options?.rpc!=="function"||typeof options.apiKey!=="string"||
    options.apiKey.length<12||options.apiKey.trim()!==options.apiKey)
   fail("TRUSTED_CONFIGURATION_REQUIRED");
 const apiKey=options.apiKey;
 const fingerprint=createHash("sha256").update("mizizi:brave:credential:v1:"+apiKey).digest("hex");
 const rpc=options.rpc;
 const call=async(fn:string,args:Record<string,unknown>)=>{
  const result=await rpc(fn,{...args,p_account_fingerprint:fingerprint});
  if(!result||result.error)fail("DURABLE_AUTHORITY_UNCONFIRMED");
  return result.data;
 };
 return createDeskSearchGatewayV1({
  apiKey,transport:options.transport,now:options.now,
  authorize:async(request,digest)=>await call("mizizi_authorize_desk_search_v1",{
   p_request_text:JSON.stringify(request),p_request_sha256:digest
  }) as DeskSearchAuthorityV1|null,
  reserve:async(request,digest,authority)=>await call("mizizi_reserve_desk_search_v1",{
   p_request_text:JSON.stringify(request),p_request_sha256:digest,p_policy_ref:authority.policyRef
  }) as DeskSearchReservationV1|null,
  consume:async(reservation)=>await call("mizizi_consume_desk_search_v1",{
   p_reservation_id:reservation.reservationId,p_request_sha256:reservation.requestSha256
  })===true,
 });
}


/** Keyless specialist discovery, and a configured SearXNG instance.
 * Wikimedia covers its own index; GDELT covers monitored news. Neither
 * supplies universal web coverage. SearXNG needs a qualified deployment
 * and permitted upstream access. No automatic fallback or subscription. */
export type DeskPublicDiscoveryProviderV1=Readonly<{
 provider:"wikimedia"|"gdelt"|"searxng"|"tavily_keyless";host:string;allocationRef:string;
}>;
export type DeskDiscoveryConfigurationV1=Readonly<Partial<Record<
 DeskSearchRequestV1["operation"],DeskPublicDiscoveryProviderV1>>>;
type PublicDiscoveryRequestV1=DeskSearchRequestV1&Readonly<{
 provider:DeskPublicDiscoveryProviderV1["provider"];providerHost:string;
}>;
type PublicDiscoveryResultV1=Readonly<Omit<DeskSearchResultV1,"provider">&{
 provider:DeskPublicDiscoveryProviderV1["provider"];providerHost:string;requestText:string;
 unavailable?:Readonly<{code:DeskAvailabilityFailureV1;host:string}>;
}>;
const publicDiscoveryHost=(host:string)=>typeof host==="string"&&
 /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)&&
 !/(?:^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$/.test(host);
export function qualifyDeskPublicDiscoveryProviderV1(config:DeskPublicDiscoveryProviderV1,
 operation:DeskSearchRequestV1["operation"]):DeskPublicDiscoveryProviderV1{
 if(!config||Object.keys(config).sort().join(",")!=="allocationRef,host,provider"||
  !publicDiscoveryHost(config.host)||config.host===HOST.slice(8)||
  typeof config.allocationRef!=="string"||!/^[A-Za-z0-9._:/-]{8,200}$/.test(config.allocationRef)||
  !["search_web","search_news"].includes(operation)||
  !(config.provider==="wikimedia"&&/^[a-z][a-z0-9-]{1,19}\.wikipedia\.org$/.test(config.host)&&operation==="search_web"||
    config.provider==="gdelt"&&config.host==="api.gdeltproject.org"&&operation==="search_news"||
    config.provider==="tavily_keyless"&&config.host==="api.tavily.com"||
    config.provider==="searxng"&&!config.host.endsWith(".wikipedia.org")&&!["api.gdeltproject.org","api.tavily.com"].includes(config.host)))
  fail("DISCOVERY_PROVIDER_DENIED");
 return Object.freeze({...config});
}
export function deskPublicDiscoveryFingerprintV1(config:DeskPublicDiscoveryProviderV1){
 return createHash("sha256").update(JSON.stringify(["mizizi:public-discovery:allocation:v1",
  config.provider,config.host,config.allocationRef])).digest("hex");
}
function publicDiscoveryEndpoint(request:PublicDiscoveryRequestV1):URL{
 const url=new URL("https://"+request.providerHost);
 if(request.provider==="wikimedia"){
  url.pathname="/w/api.php";
  url.searchParams.set("action","query");url.searchParams.set("list","search");
  url.searchParams.set("srsearch",request.query);url.searchParams.set("srlimit",String(request.count));
  url.searchParams.set("srnamespace","0");url.searchParams.set("srprop","");
  url.searchParams.set("format","json");url.searchParams.set("formatversion","2");url.searchParams.set("maxlag","5");
 }else if(request.provider==="gdelt"){
  url.pathname="/api/v2/doc/doc";url.searchParams.set("query",request.query);
  url.searchParams.set("mode","artlist");url.searchParams.set("format","json");
  url.searchParams.set("maxrecords",String(request.count));
 }else if(request.provider==="tavily_keyless"){
  url.pathname="/search";
 }else{
  url.pathname="/search";url.searchParams.set("q",request.query);url.searchParams.set("format","json");
  url.searchParams.set("categories",request.operation==="search_news"?"news":"general");
 }
 return url;
}
function publicDiscoveryLeads(request:PublicDiscoveryRequestV1,body:Uint8Array):readonly DeskSearchLeadV1[]{
 if(body.byteLength<1||body.byteLength>MAX_BODY)fail("RESPONSE_TOO_LARGE");
 let value:unknown;
 try{value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(body));}catch{fail("INVALID_RESPONSE");}
 const payload=obj(value);
 if(Object.hasOwn(payload,"error")||Object.hasOwn(payload,"errors"))fail("SEARCH_PROVIDER_UNCONFIRMED");
 const results=request.provider==="wikimedia"?obj(payload.query).search:
  request.provider==="gdelt"?payload.articles:payload.results;
 if(!Array.isArray(results)||results.length>(request.provider==="searxng"?200:request.count))
  fail("INVALID_RESPONSE");
 if(request.provider==="searxng"&&results.length===0&&
  Array.isArray(payload.unresponsive_engines)&&payload.unresponsive_engines.length>0)fail("SEARCH_PROVIDER_UNCONFIRMED");
 const seen=new Set<string>(),leads:DeskSearchLeadV1[]=[];
 for(const raw of results){
  if(leads.length>=request.count)break;
  const row=obj(raw),title=row.title;
  if(typeof title!=="string"||!title.trim()||title.length>500||/[\p{Cc}\p{Cf}]/u.test(title))continue;
  let rawUrl:unknown=row.url;
  if(request.provider==="wikimedia"){
   if(!Number.isSafeInteger(row.pageid)||Number(row.pageid)<1||row.ns!==0)continue;
   rawUrl="https://"+request.providerHost+"/wiki/"+encodeURIComponent(title.replace(/ /g,"_"));
  }
  const url=leadUrl(rawUrl);if(!url||seen.has(url))continue;
  const u=new URL(url);
  if(!publicDiscoveryHost(u.hostname)||[...u.searchParams.keys()].some(k=>
   /token|signature|password|passwd|secret|credential|session|api[-_]?key|authorization|^sig$|^auth$|^key$|^x-amz-|^x-goog-/i.test(k)))continue;
  seen.add(url);leads.push(Object.freeze({url,title:title.trim(),kind:"unverified_discovery_lead"}));
 }
 return Object.freeze(leads);
}
/** The reviewed provider/host are bound into the existing durable budget.
 * The native resource reader consumes that reservation immediately before
 * its pinned TLS request, with independent authorization and no redirects. */
export function createDurableDeskPublicDiscoveryGatewayV1(options:Readonly<{
 configuration:DeskPublicDiscoveryProviderV1;operation:DeskSearchRequestV1["operation"];
 rpc:import("./research-worker-cycle-v1.ts").WorkerRpc;now?:()=>number;
 resourceTestSeams?:Pick<Parameters<typeof createDeskBrowserResourceReaderV1>[0],"resolve4"|"readPinned">;
}>){
 if(typeof options?.rpc!=="function")fail("TRUSTED_CONFIGURATION_REQUIRED");
 const config=qualifyDeskPublicDiscoveryProviderV1(options.configuration,options.operation);
 const fingerprint=deskPublicDiscoveryFingerprintV1(config),now=options.now??Date.now;
 async function rpc(fn:string,args:Record<string,unknown>){
  const response=await options.rpc(fn,{...args,p_account_fingerprint:fingerprint});
  if(!response||response.error)fail("DURABLE_AUTHORITY_UNCONFIRMED");
  return response.data;
 }
 return async(input:DeskSearchRequestV1):Promise<PublicDiscoveryResultV1>=>{
  const base=canonicalRequest(input,now()),lease=Date.parse(base.scope.leaseExpiresAt);
  if(base.operation!==options.operation)fail("DISCOVERY_OPERATION_DENIED");
  const request=Object.freeze({...base,provider:config.provider,providerHost:config.host});
  const requestText=JSON.stringify(request),requestSha256=createHash("sha256").update(requestText).digest("hex");
  const args={p_request_text:requestText,p_request_sha256:requestSha256};
  const approved=(raw:unknown):raw is DeskSearchAuthorityV1=>{
   const a=raw as DeskSearchAuthorityV1;
   return !!a&&a.requestSha256===requestSha256&&typeof a.policyRef==="string"&&
    /^[A-Za-z0-9._:/-]{8,200}$/.test(a.policyRef)&&a.publicQueryAllowed===true&&
    a.providerUseAllowed===true&&a.zeroIncrementalSpendAllowed===true&&expiry(a.validUntil,now(),lease);
  };
  const authority=await rpc("mizizi_authorize_desk_search_v1",args);
  if(!approved(authority))fail("QUERY_AUTHORITY_DENIED");
  const raw=await rpc("mizizi_reserve_desk_search_v1",{...args,p_policy_ref:authority.policyRef});
  const reservation=raw as Omit<DeskSearchReservationV1,"provider">&{provider:string;providerHost:string};
  if(!reservation||!UUID.test(reservation.reservationId)||reservation.requestSha256!==requestSha256||
   reservation.provider!==config.provider||reservation.providerHost!==config.host||
   reservation.units!==1||reservation.maximumIncrementalCostMicrousd!==0||
   !expiry(reservation.validUntil,now(),lease))fail("ZERO_COST_BUDGET_UNAVAILABLE");
  const url=publicDiscoveryEndpoint(request).href;
  const binding=Object.freeze({scope:base.scope,url,resourceType:"fetch",topLevelUrl:url});
  const bindingSha256=createHash("sha256").update(JSON.stringify(binding)).digest("hex");
  const sameBinding=(candidate:Parameters<ReturnType<typeof createDeskBrowserResourceReaderV1>>[0],sha:string)=>
   sha===bindingSha256&&JSON.stringify(candidate)===JSON.stringify(binding);
  let consumed=false;
  const readerOptions:Parameters<typeof createDeskBrowserResourceReaderV1>[0]={
   ...options.resourceTestSeams,now,
   authorize:async(candidate,sha)=>{
    if(!sameBinding(candidate,sha)||!expiry(reservation.validUntil,now(),lease))return null;
    const fresh=await rpc("mizizi_authorize_desk_search_v1",args);
    if(!approved(fresh)||fresh.policyRef!==authority.policyRef)return null;
    return {policyRef:fresh.policyRef,validUntil:new Date(Math.min(Date.parse(fresh.validUntil),
     Date.parse(reservation.validUntil))).toISOString(),acquisitionAllowed:true,zeroIncrementalSpendAllowed:true};
   },
   precharge:async(candidate,target,_grant,sha)=>{
    if(consumed||!sameBinding(candidate,sha)||target.url!==url||target.hostname!==config.host||
     !expiry(reservation.validUntil,now(),lease))return false;
    consumed=await rpc("mizizi_consume_desk_search_v1",{p_reservation_id:reservation.reservationId,
     p_request_sha256:requestSha256})===true;
    return consumed;
   }
  };
  const read=config.provider==="tavily_keyless"?createDeskTavilyDiscoveryReaderV1(readerOptions,request.query,request.count,request.operation):
   createDeskBrowserResourceReaderV1(readerOptions);
  let response:Awaited<ReturnType<typeof read>>;
  try{response=await read(binding,bindingSha256,AbortSignal.timeout(Math.min(20000,Math.max(1,lease-now()))));}
  catch(error){
   const code=error instanceof Error?error.message:null;
   if(!consumed||!(error instanceof DeskNativeHttpUnavailableV1)||!isDeskAvailabilityFailureV1(code)||now()>=lease)throw error;
   // No upstream response body is retained or disclosed. The exact consumed
   // reservation and the bounded transport diagnostic must enter custody.
   return Object.freeze({contract:"mizizi.desk_search.v1",requestSha256,reservationId:reservation.reservationId,
    provider:config.provider,providerHost:config.host,requestText,operation:base.operation,
    retrievedAt:new Date(now()).toISOString(),leads:[],identityVerified:false,sourceRetentionAuthorized:false,
    externalModelProcessingAuthorized:false,unavailable:Object.freeze({code,host:config.host})});
  }
  if(response.requestSha256!==bindingSha256||response.status!==200||
   !("body" in response)||!/^application\/json\b/i.test(response.contentType??"")||
   !response.body||createHash("sha256").update(response.body).digest("hex")!==response.sha256)
   fail("SEARCH_PROVIDER_UNCONFIRMED");
  const leads=publicDiscoveryLeads(request,response.body);
  if(now()>=lease)fail("LEASE_EXPIRED");
  return Object.freeze({contract:"mizizi.desk_search.v1",requestSha256,reservationId:reservation.reservationId,
   provider:config.provider,providerHost:config.host,requestText,operation:base.operation,
   retrievedAt:new Date(now()).toISOString(),leads,identityVerified:false,sourceRetentionAuthorized:false,
   externalModelProcessingAuthorized:false});
 };
}

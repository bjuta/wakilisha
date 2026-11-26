/** MIZIZI desk research: bounded discovery transport, not a source or identity grant.
 * Trusted runtime must independently check current case/lease, disclosure scope,
 * provider entitlement and atomic account-wide budget. No default authority,
 * native model search, automatic retry, refund, or paid fallback exists.
 */
import {createHash} from "node:crypto";
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

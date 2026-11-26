/** Native public HTTPS acquisition for MIZIZI. Node server only.
 * No browser execution, parser, persistence or model disclosure. Each redirect
 * is a new independently authorized, conservatively precharged acquisition.
 * The runtime must supply durable authority and a network-level egress fence.
 */
import {createHash} from "node:crypto";
import {Resolver} from "node:dns/promises";
import {request as httpsRequest} from "node:https";
import {isIP} from "node:net";
import {checkServerIdentity} from "node:tls";
import type {DeskSearchScopeV1} from "./desk-research-gateway-v1.ts";

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const MAX_BYTES=2_000_000;
const MAX_REDIRECTS=3;
const MAX_DURATION_MS=20_000;
type Target=Readonly<{url:string;hostname:string;address:string}>;
type HopResponse=Readonly<{status:number;location?:string;contentType?:string;
 body:Uint8Array;headers?:Readonly<Record<string,string>>}>;
type NativeReadRequest=Readonly<{scope:DeskSearchScopeV1;url:string}>;
type NativeReadAuthority=Readonly<{policyRef:string;validUntil:string;
 acquisitionAllowed:true;zeroIncrementalSpendAllowed:true}>;
type NativeReadOptions=Readonly<{
 /** Must validate exact URL against current lease and independently reviewed
  * source access policy (terms, robots, authorization). No blanket public grant. */
 authorize:(scope:DeskSearchScopeV1,url:string)=>Promise<NativeReadAuthority|null>;
 /** Atomic durable one-hop precharge/consume against current policy and
  * existing compute/egress limits. Includes failed/indeterminate requests. */
 precharge:(scope:DeskSearchScopeV1,target:Target,authority:NativeReadAuthority)=>Promise<boolean>;
 now?:()=>number;
 /** Test seams only. Production uses the native resolver and direct TLS path. */
 resolve4?:(hostname:string,signal:AbortSignal)=>Promise<readonly string[]>;
 readPinned?:(target:Target,signal:AbortSignal)=>Promise<HopResponse>;
}>;
function fail(code:string):never{throw Error("MIZIZI_DESK_NATIVE_"+code);}

/** Deliberately IPv4-only until equally strong IPv6 handling is proven.
 * Reject non-global, special-use, documentation, benchmarking and multicast
 * ranges. This is not a substitute for an environment-level egress ACL. */
export function isPublicDeskIpv4V1(address:string):boolean{
 if(isIP(address)!==4)return false;
 const [a,b,c]=address.split(".").map(Number);
 return !(a===0||a===10||a===127||a>=224||
  (a===100&&b>=64&&b<=127)||(a===169&&b===254)||
  (a===172&&b>=16&&b<=31)||(a===192&&b===168)||
  (a===192&&b===0&&(c===0||c===2))||(a===192&&b===88&&c===99)||
  (a===198&&(b===18||b===19))||(a===198&&b===51&&c===100)||
  (a===203&&b===0&&c===113));
}
function publicUrl(raw:string,base?:string):URL{
 if(typeof raw!=="string"||raw.length<1||raw.length>2048||/[\p{Cc}\p{Cf}\\]/u.test(raw))
  fail("URL_DENIED");
 let u:URL;
 try{u=new URL(raw,base);}catch{fail("URL_DENIED");}
 const h=u.hostname;
 if(u.protocol!=="https:"||u.username||u.password||u.port||
  isIP(h)||h.startsWith("[")||h.endsWith(".")||
  !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(h)||
  /(?:^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$/i.test(h))
  fail("URL_DENIED");
 // Never intentionally handle signed/private URLs or credentials in query.
 for(const key of u.searchParams.keys()){
  if(/(?:token|signature|password|passwd|secret|credential|session|api[-_]?key|authorization|^sig$|^auth$|^key$|^x-amz-|^x-goog-)/i.test(key))
   fail("URL_CREDENTIAL_DENIED");
 }
 u.hash="";
 return u;
}
async function resolveNative(hostname:string,signal:AbortSignal):Promise<string[]>{
 const resolver=new Resolver({timeout:3000,tries:1});
 const cancel=()=>resolver.cancel();
 if(signal.aborted)fail("DEADLINE");
 signal.addEventListener("abort",cancel,{once:true});
 try{return await resolver.resolve4(hostname);}
 catch{fail("DNS_UNCONFIRMED");}
 finally{signal.removeEventListener("abort",cancel);}
}
function contentType(value:unknown):string{
 if(typeof value!=="string")fail("CONTENT_TYPE_DENIED");
 const type=value.split(";")[0].trim().toLowerCase();
 if(!["text/html","application/xhtml+xml","text/plain","application/pdf"].includes(type))
  fail("CONTENT_TYPE_DENIED");
 return type;
}
/** Connect to the validated IP directly, retaining TLS SNI, certificate
 * hostname checking and the HTTP Host for the approved origin. No second
 * DNS lookup, pooled socket, credential forwarding or automatic redirects. */
const BROWSER_MIMES:Readonly<Record<string,readonly string[]>>=Object.freeze({
 document:["text/html","application/xhtml+xml"],
 script:["text/javascript","application/javascript","application/ecmascript","text/ecmascript"],
 stylesheet:["text/css"],
 image:["image/png","image/jpeg","image/webp","image/gif","image/svg+xml","image/avif","image/x-icon"],
 font:["font/woff","font/woff2","application/font-woff","application/octet-stream"],
 xhr:["application/json","text/plain","text/html","application/xml","text/xml"],
 fetch:["application/json","text/plain","text/html","application/xml","text/xml"],
});
const BROWSER_RESPONSE_HEADERS=["content-security-policy","content-security-policy-report-only","x-content-type-options",
 "x-frame-options","referrer-policy","cross-origin-resource-policy","cross-origin-opener-policy",
 "cross-origin-embedder-policy","access-control-allow-origin","access-control-allow-methods",
 "access-control-allow-headers","access-control-expose-headers","vary","permissions-policy"] as const;
function browserContentType(value:unknown,resourceType:string):string{
 if(typeof value!=="string"||value.length>200||/[\r\n\0]/.test(value)||
  !BROWSER_MIMES[resourceType]?.includes(value.split(";")[0].trim().toLowerCase()))
  fail("CONTENT_TYPE_DENIED");
 return value;
}
async function readNative(target:Target,signal:AbortSignal,browserType?:string):Promise<HopResponse>{
 const url=publicUrl(target.url);
 if(url.hostname!==target.hostname||!isPublicDeskIpv4V1(target.address))fail("PIN_DENIED");
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(err:Error|null,value?:HopResponse)=>{
   if(settled)return;
   settled=true;
   if(err)reject(err);else resolve(value!);
  };
  const req=httpsRequest({
   hostname:target.address,port:443,path:url.pathname+url.search,method:"GET",
   servername:target.hostname,agent:false,rejectUnauthorized:true,minVersion:"TLSv1.2",
   checkServerIdentity:(_name,cert)=>checkServerIdentity(target.hostname,cert),
   maxHeaderSize:16384,signal,
   headers:{Host:target.hostname,"User-Agent":"WAKILISHA-MIZIZI/1.0 (https://wakilisha.africa)",
    Accept:browserType?BROWSER_MIMES[browserType].join(","):"text/html,application/xhtml+xml,text/plain,application/pdf",
    "Accept-Encoding":"identity",Connection:"close"},
  },res=>{
   const stop=(code:string)=>{finish(Error("MIZIZI_DESK_NATIVE_"+code));res.destroy();req.destroy();};
   if(res.socket.remoteAddress!==target.address){stop("PEER_PIN_MISMATCH");return;}
   const status=res.statusCode??0;
   if([301,302,303,307,308].includes(status)){
    const location=res.headers.location;
    if(typeof location!=="string"){stop("REDIRECT_DENIED");return;}
    finish(null,{status,location,body:new Uint8Array()});res.destroy();req.destroy();return;
   }
   if(status!==200){finish(null,{status,body:new Uint8Array()});res.destroy();req.destroy();return;}
   if(res.headers["content-encoding"]&&res.headers["content-encoding"]!=="identity"){
    stop("CONTENT_ENCODING_DENIED");return;
   }
   const declared=res.headers["content-length"];
   if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES)){
    stop("RESPONSE_TOO_LARGE");return;
   }
   let type:string;
   try{type=browserType?browserContentType(res.headers["content-type"],browserType):contentType(res.headers["content-type"]);}catch{stop("CONTENT_TYPE_DENIED");return;}
   const headers:Record<string,string>={};
   if(browserType)for(const name of BROWSER_RESPONSE_HEADERS){
    const raw=res.headers[name];
    if(raw===undefined)continue;
    // Preserve security and CORS policy. Never forward Set-Cookie,
    // Location on 200, authentication or arbitrary upstream headers.
    if(typeof raw!=="string"||raw.length>16000||/[\r\n\0]/.test(raw)){
     stop("RESPONSE_HEADER_DENIED");return;
    }
    headers[name]=raw;
   }
   const chunks:Buffer[]=[];let size=0;
   res.on("data",(chunk:Buffer)=>{
    size+=chunk.length;
    if(size>MAX_BYTES){stop("RESPONSE_TOO_LARGE");return;}
    chunks.push(chunk);
   });
   res.once("aborted",()=>stop("BODY_UNCONFIRMED"));
   res.once("error",()=>stop("BODY_UNCONFIRMED"));
   res.once("end",()=>{
    if(!res.complete||(declared!==undefined&&size!==Number(declared))){stop("BODY_UNCONFIRMED");return;}
    finish(null,{status,contentType:type,body:Buffer.concat(chunks,size),...(browserType?{headers}:{} )});
   });
  });
  req.once("error",()=>finish(Error("MIZIZI_DESK_NATIVE_TRANSPORT_UNCONFIRMED")));
  req.end();
 });
}
export function createDeskNativeReaderV1(options:NativeReadOptions){
 if(typeof options?.authorize!=="function"||typeof options.precharge!=="function")
  fail("TRUSTED_AUTHORITY_REQUIRED");
 const now=options.now??Date.now,resolve4=options.resolve4??resolveNative,read=options.readPinned??readNative;
 return async(input:NativeReadRequest)=>{
  const s=input?.scope;
  if(!s||![s.jobId,s.caseId,s.workspaceId].every(id=>typeof id==="string"&&UUID.test(id))||
   !Number.isSafeInteger(s.expectedRevision)||s.expectedRevision<1||
   typeof s.workerId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(s.workerId)||
   typeof s.leaseExpiresAt!=="string"||!Number.isFinite(Date.parse(s.leaseExpiresAt))||
   Date.parse(s.leaseExpiresAt)<=now())fail("SCOPE_DENIED");
  const scope=Object.freeze({...s}),lease=Date.parse(scope.leaseExpiresAt);
  const end=Math.min(lease,now()+MAX_DURATION_MS);
  const signal=AbortSignal.timeout(Math.max(1,end-now()));
  const live=()=>{if(signal.aborted||now()>=end)fail("DEADLINE");};
  const approved=(a:NativeReadAuthority|null):a is NativeReadAuthority=>
   !!a&&a.acquisitionAllowed===true&&a.zeroIncrementalSpendAllowed===true&&
   typeof a.policyRef==="string"&&/^[A-Za-z0-9._:/-]{8,200}$/.test(a.policyRef)&&
   typeof a.validUntil==="string"&&Date.parse(a.validUntil)>now()&&Date.parse(a.validUntil)<=lease;
  let url=publicUrl(input.url),first=url.href;
  const seen=new Set<string>(),redirects:string[]=[],hopSha256:string[]=[];
  for(let hop=0;hop<=MAX_REDIRECTS;hop++){
   live();
   if(seen.has(url.href))fail("REDIRECT_LOOP");
   seen.add(url.href);
   const authority=await options.authorize(scope,url.href);
   live();if(!approved(authority))fail("ACQUISITION_DENIED");
   const addresses=await resolve4(url.hostname,signal);
   live();
   if(!Array.isArray(addresses)||addresses.length<1||addresses.length>32||
    addresses.some(address=>!isPublicDeskIpv4V1(address)))fail("DNS_ADDRESS_DENIED");
   const target=Object.freeze({url:url.href,hostname:url.hostname,address:addresses[0]});
   if(await options.precharge(scope,target,authority)!==true)fail("ZERO_COST_BUDGET_UNAVAILABLE");
   // Exact descriptor digest used by the durable native resource adapter.
   // It is not a grant or a claim that billing/response bytes are verified.
   hopSha256.push(createHash("sha256").update(JSON.stringify({scope,target})).digest("hex"));
   live();
   const fresh=await options.authorize(scope,url.href);
   live();if(!approved(fresh)||fresh.policyRef!==authority.policyRef||!approved(authority))
    fail("ACQUISITION_AUTHORITY_CHANGED");
   const response=await read(target,signal);
   live();
   if(!response||!(response.body instanceof Uint8Array)||response.body.byteLength>MAX_BYTES)
    fail("RESPONSE_TOO_LARGE");
   const after=await options.authorize(scope,url.href);
   live();if(!approved(after)||after.policyRef!==authority.policyRef)fail("ACQUISITION_AUTHORITY_CHANGED");
   if([301,302,303,307,308].includes(response.status)){
    if(hop===MAX_REDIRECTS||typeof response.location!=="string")fail("REDIRECT_DENIED");
    redirects.push(url.href);
    url=publicUrl(response.location,url.href);continue;
   }
   if(response.status!==200)fail("SOURCE_UNAVAILABLE");
   const type=contentType(response.contentType);
   const body=Uint8Array.from(response.body);
   if(body.length===0||(type==="application/pdf"&&new TextDecoder().decode(body.subarray(0,5))!=="%PDF-"))
    fail("BODY_UNCONFIRMED");
   return Object.freeze({contract:"mizizi.desk_native_read.v1" as const,scope,requestedUrl:first,
    finalUrl:url.href,redirects:Object.freeze(redirects),hopSha256:Object.freeze(hopSha256),
    retrievedAt:new Date(now()).toISOString(),
    contentType:type,byteLength:body.length,sha256:createHash("sha256").update(body).digest("hex"),
    body,sourceRetentionAuthorized:false as const,externalModelProcessingAuthorized:false as const,
    identityVerified:false as const});
  }
  fail("REDIRECT_DENIED");
 };
}


export type DeskBrowserResourceBindingV1=Readonly<{
 scope:DeskSearchScopeV1;url:string;resourceType:string;topLevelUrl:string;
}>;
type BrowserResourceReadOptionsV1=Readonly<{
 /** Must independently bind disclosure, source access, tool and session
  * permission to this exact request; no model-issued authority. */
 authorize:(binding:DeskBrowserResourceBindingV1,requestSha256:string)=>Promise<NativeReadAuthority|null>;
 /** Durable host acquisition reservation, including the selected IP and
  * exact browser binding. No refund for unknown/failed transmission. */
 precharge:(binding:DeskBrowserResourceBindingV1,target:Target,authority:NativeReadAuthority,
  requestSha256:string)=>Promise<boolean>;
 now?:()=>number;
 /** Tests only; the real composition must use the pinned TLS implementation. */
 resolve4?:NativeReadOptions["resolve4"];
 readPinned?:(target:Target,signal:AbortSignal,resourceType:string)=>Promise<HopResponse>;
}>;
/** One authorized browser resource hop, not a generic proxy. Shared native
 * TLS/DNS/byte boundary; no Chromium headers, credentials or direct network.
 * Never follow redirects here. Caller must separately authorize next hop.
 * No default policy, finance or host network-isolation claim.
 */
export function createDeskBrowserResourceReaderV1(options:BrowserResourceReadOptionsV1){
 if(typeof options?.authorize!=="function"||typeof options.precharge!=="function")
  fail("TRUSTED_AUTHORITY_REQUIRED");
 const now=options.now??Date.now,resolve4=options.resolve4??resolveNative,
  read=options.readPinned??readNative;
 return async(binding:DeskBrowserResourceBindingV1,requestSha256:string,parentSignal:AbortSignal)=>{
  const s=binding?.scope;
  if(!s||Object.keys(s).sort().join(",")!=="caseId,expectedRevision,jobId,leaseExpiresAt,workerId,workspaceId"||
   ![s.jobId,s.caseId,s.workspaceId].every(id=>typeof id==="string"&&UUID.test(id))||
   !Number.isSafeInteger(s.expectedRevision)||s.expectedRevision<1||
   typeof s.workerId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(s.workerId)||
   typeof s.leaseExpiresAt!=="string"||!Number.isFinite(Date.parse(s.leaseExpiresAt))||
   Date.parse(s.leaseExpiresAt)<=now())fail("SCOPE_DENIED");
  if(Object.keys(binding).sort().join(",")!=="resourceType,scope,topLevelUrl,url"||
   typeof binding.resourceType!=="string"||!Object.hasOwn(BROWSER_MIMES,binding.resourceType)||
   !/^[a-f0-9]{64}$/.test(requestSha256)||createHash("sha256").update(JSON.stringify(binding)).digest("hex")!==requestSha256||
   !(parentSignal instanceof AbortSignal))fail("BROWSER_BINDING_DENIED");
  const url=publicUrl(binding.url),top=publicUrl(binding.topLevelUrl);
  if(url.href!==binding.url||top.href!==binding.topLevelUrl||
   (binding.resourceType==="document"&&url.href!==top.href))fail("BROWSER_BINDING_DENIED");
  const exact=Object.freeze({...binding,scope:Object.freeze({...s})});
  const lease=Date.parse(s.leaseExpiresAt),end=Math.min(lease,now()+MAX_DURATION_MS);
  const signal=AbortSignal.any([parentSignal,AbortSignal.timeout(Math.max(1,end-now()))]);
  const live=()=>{if(signal.aborted||now()>=end)fail("DEADLINE");};
  const approved=(a:NativeReadAuthority|null):a is NativeReadAuthority=>
   !!a&&a.acquisitionAllowed===true&&a.zeroIncrementalSpendAllowed===true&&
   typeof a.policyRef==="string"&&/^[A-Za-z0-9._:/-]{8,200}$/.test(a.policyRef)&&
   typeof a.validUntil==="string"&&Date.parse(a.validUntil)>now()&&Date.parse(a.validUntil)<=lease;
  live();
  const authority=await options.authorize(exact,requestSha256);
  live();if(!approved(authority))fail("ACQUISITION_DENIED");
  const addresses=await resolve4(url.hostname,signal);
  live();
  if(!Array.isArray(addresses)||addresses.length<1||addresses.length>32||
   addresses.some(a=>!isPublicDeskIpv4V1(a)))fail("DNS_ADDRESS_DENIED");
  const target=Object.freeze({url:url.href,hostname:url.hostname,address:addresses[0]});
  if(await options.precharge(exact,target,authority,requestSha256)!==true)fail("ZERO_COST_BUDGET_UNAVAILABLE");
  live();
  const fresh=await options.authorize(exact,requestSha256);
  live();if(!approved(fresh)||fresh.policyRef!==authority.policyRef||!approved(authority))fail("ACQUISITION_AUTHORITY_CHANGED");
  const response=await read(target,signal,exact.resourceType);
  live();
  if(!response||!(response.body instanceof Uint8Array)||response.body.byteLength>MAX_BYTES)fail("RESPONSE_TOO_LARGE");
  const after=await options.authorize(exact,requestSha256);
  live();if(!approved(after)||after.policyRef!==authority.policyRef)fail("ACQUISITION_AUTHORITY_CHANGED");
  if([301,302,303,307,308].includes(response.status)){
   if(typeof response.location!=="string"||response.body.byteLength!==0)fail("REDIRECT_DENIED");
   const location=publicUrl(response.location,url.href).href;
   return Object.freeze({requestSha256,status:response.status,location});
  }
  if(response.status!==200)fail("SOURCE_UNAVAILABLE");
  const type=browserContentType(response.contentType,exact.resourceType),body=Uint8Array.from(response.body);
  if(body.length<1)fail("BODY_UNCONFIRMED");
  const headers:Record<string,string>={};
  for(const [name,value] of Object.entries(response.headers??{})){
   if(!(BROWSER_RESPONSE_HEADERS as readonly string[]).includes(name)||
    typeof value!=="string"||value.length>16000||/[\r\n\0]/.test(value))fail("RESPONSE_HEADER_DENIED");
   headers[name]=value;
  }
  return Object.freeze({requestSha256,status:200,contentType:type,body,
   sha256:createHash("sha256").update(body).digest("hex"),headers:Object.freeze(headers)});
 };
}

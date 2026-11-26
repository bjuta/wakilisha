/** Restricted Cloudflare Browser Run fallback. Never use Quick Actions:
 * provider session-level hostname guardrails are required. No model-authored
 * code, clicks, forms, credentials, arbitrary navigation or shared sessions.
 * Provider guardrails are hostname restrictions, NOT proof of public-IP egress.
 * Trusted runtime must supply independently verified remote network isolation,
 * exact disclosure/access authority and durable zero-cost account allocation.
 * No enabled implementation of those authorities is provided here.
 */
import {createHash} from "node:crypto";
import {isIP} from "node:net";
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{64}$/;
const MAX_DOM=2_000_000,MAX_PNG=2_000_000,MAX_DURATION=30_000,RESERVE_SECONDS=120;
const HOST="https://api.cloudflare.com";
const fail=code=>{throw Error("MIZIZI_DESK_BROWSER_"+code);};
const hash=value=>createHash("sha256").update(value).digest("hex");
function safeUrl(value){
 if(typeof value!=="string"||value.length>2048||/[\p{Cc}\p{Cf}\\]/u.test(value))fail("URL_DENIED");
 let u;try{u=new URL(value);}catch{fail("URL_DENIED");}
 if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash||isIP(u.hostname)||
  !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(u.hostname)||
  /(?:^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$/i.test(u.hostname))fail("URL_DENIED");
 for(const k of u.searchParams.keys())if(/token|signature|password|passwd|secret|credential|session|api[-_]?key|authorization|^sig$|^auth$|^key$|^x-amz-|^x-goog-/i.test(k))fail("URL_DENIED");
 return u;
}
function scopeOf(s,now){
 if(!s||![s.jobId,s.caseId,s.workspaceId].every(id=>typeof id==="string"&&UUID.test(id))||
  !Number.isSafeInteger(s.expectedRevision)||s.expectedRevision<1||
  typeof s.workerId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(s.workerId)||
  typeof s.leaseExpiresAt!=="string"||!Number.isFinite(Date.parse(s.leaseExpiresAt))||Date.parse(s.leaseExpiresAt)<=now)fail("SCOPE_DENIED");
 return Object.freeze({jobId:s.jobId,caseId:s.caseId,workspaceId:s.workspaceId,
  expectedRevision:s.expectedRevision,workerId:s.workerId,leaseExpiresAt:s.leaseExpiresAt});
}
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
function validPng(value){
 return value instanceof Uint8Array&&value.length>=33&&value.length<=MAX_PNG&&
  Buffer.from(value.subarray(0,8)).equals(pngSignature)&&
  Buffer.from(value.subarray(12,16)).toString("ascii")==="IHDR"&&
  Buffer.from(value).readUInt32BE(16)===1280&&Buffer.from(value).readUInt32BE(20)===900;
}
async function smallJson(response){
 if(!response.ok||!response.body)fail("PROVIDER_UNCONFIRMED");
 const stream=response.body.getReader();let size=0;const chunks=[];
 try{
  while(true){
   const next=await stream.read();if(next.done)break;
   size+=next.value.length;if(size>16000){await stream.cancel();fail("PROVIDER_RESPONSE_BOUND");}
   chunks.push(next.value);
  }
 }finally{stream.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks,size).toString("utf8"));}
 catch{fail("PROVIDER_RESPONSE_INVALID");}
}
/** Fixed transport, exact account, token is never sent to a webpage. */
export function createCloudflareBrowserTransportV1({accountId,apiToken,transport=fetch,connect}={}){
 if(typeof accountId!=="string"||!/^[a-f0-9]{32}$/.test(accountId)||
  typeof apiToken!=="string"||apiToken.length<20||apiToken.trim()!==apiToken)fail("SERVER_CREDENTIALS_REQUIRED");
 const base=HOST+"/client/v4/accounts/"+accountId+"/browser-run/devtools/browser";
 const headers={Authorization:"Bearer "+apiToken,"Content-Type":"application/json"};
 const open=async({hostname},signal)=>{
  // Do not use a wildcard, domain set, recording, outbound Worker or
  // keep-alive extension. Documented 60s idle timeout remains a backstop.
  const response=await transport(base,{method:"POST",headers,redirect:"error",
   body:JSON.stringify({guardrails:{allowedDomains:[hostname]}}),signal});
  const p=await smallJson(response);
  if(!p||typeof p.sessionId!=="string"||!UUID.test(p.sessionId))fail("SESSION_ID_UNCONFIRMED");
  // Do not follow provider-returned websocket URLs. Construct the fixed
  // account-scoped endpoint; lifecycle cleanup uses only the validated ID.
  return p.sessionId;
 };
 const close=async(sessionId,signal)=>{
  if(!UUID.test(sessionId))fail("SESSION_ID_UNCONFIRMED");
  const p=await smallJson(await transport(base+"/"+sessionId,{method:"DELETE",headers,redirect:"error",signal}));
  if(p?.status!=="closing"&&p?.status!=="closed")fail("CLOSE_UNCONFIRMED");
  return true; // Provider close acknowledgement, not measured final billing.
 };
 const capture=async(sessionId,{url,hostname,visual,authorizeRequest,remaining})=>{
  const endpoint=base.replace("https:","wss:")+"/"+sessionId;
  const connector=connect??(async(endpoint,opts)=>{
   const {chromium}=await import("@playwright/test");
   return chromium.connectOverCDP(endpoint,opts);
  });
  const timeout=()=>{const ms=remaining();if(ms<=0)fail("DEADLINE");return ms;};
  const browser=await connector(endpoint,{headers:{Authorization:"Bearer "+apiToken},timeout:timeout()});
  let context;
  try{
   context=await browser.newContext({acceptDownloads:false,serviceWorkers:"block",
    javaScriptEnabled:true,ignoreHTTPSErrors:false,viewport:{width:1280,height:900}});
   // Block websocket connections rather than passing them through. Remote
   // provider network isolation must still cover non-HTTP protocols and
   // DNS rebinding; Playwright interception alone is not an egress sandbox.
   await context.routeWebSocket("**/*",socket=>socket.close());
   let requestCount=0,denied=false;
   await context.route("**/*",async route=>{
    try{
     const req=route.request(),target=safeUrl(req.url());
     const main=req.isNavigationRequest();
     if(++requestCount>40||remaining()<=0||target.hostname!==hostname||
       req.method()!=="GET"||(main&&target.href!==url)||
       ["media","font","websocket","eventsource","manifest","ping"].includes(req.resourceType())||
       await authorizeRequest(target.href,req.resourceType())!==true){
      denied=true;await route.abort();return;
     }
     await route.continue();
    }catch{denied=true;try{await route.abort();}catch{}}
   });
   const page=await context.newPage();
   page.on("popup",p=>{denied=true;void p.close().catch(()=>{});});
   page.on("download",d=>{denied=true;void d.cancel().catch(()=>{});});
   const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:timeout()});
   if(!response||response.status()!==200||page.url()!==url||denied)fail("NAVIGATION_UNCONFIRMED");
   const contentType=(await response.headerValue("content-type")??"").split(";")[0].trim().toLowerCase();
   if(!["text/html","application/xhtml+xml"].includes(contentType))fail("CONTENT_TYPE_DENIED");
   // Fixed extraction only; no model supplied JavaScript. Capture bounded
   // rendered DOM, not original network bytes. Recheck final URL after capture.
   const html=await page.locator("html").evaluate(node=>{
    const value=node.outerHTML;
    return value.length<=2_000_000?value:null;
   },undefined,{timeout:timeout()});
   if(typeof html!=="string")fail("DOM_BOUND");
   const png=visual?await page.screenshot({type:"png",fullPage:false,animations:"disabled",timeout:timeout()}):null;
   if(denied||page.url()!==url||remaining()<=0)fail("NAVIGATION_UNCONFIRMED");
   return {finalUrl:page.url(),html,png};
  }finally{
   // Close the context to stop its requests, but leave the account-scoped
   // session termination to the independently acknowledged DELETE.
   if(context)await context.close().catch(()=>{});
   // Disconnecting CDP can close a session depending on provider/client.
   // Do not expose the browser or the endpoint. Caller always calls DELETE.
   await browser.close().catch(()=>{});
  }
 };
 return Object.freeze({accountFingerprint:hash("mizizi:cloudflare:credential:v1:"+accountId+":"+apiToken),open,close,capture});
}
/** Fallback only after an exact, independently verified native outcome:
 * content insufficient for reading, not a denial/paywall/quota error.
 * No default authority or free-tier claim. Budget is precharged for full
 * worst-case reservation, no refund on unknown open/close/billing result.
 */
export function createDeskBrowserReaderV1({provider,authorize,reserve,consume,authorizeRequest,
 recordLifecycle,now=Date.now}={}){
 if(!provider||!SHA.test(provider.accountFingerprint)||["open","capture","close"].some(k=>typeof provider[k]!=="function")||
  [authorize,reserve,consume,authorizeRequest,recordLifecycle].some(x=>typeof x!=="function"))fail("TRUSTED_CONFIGURATION_REQUIRED");
 return async({scope,url,nativeOutcome,visual=false})=>{
  const s=scopeOf(scope,now()),target=safeUrl(url),lease=Date.parse(s.leaseExpiresAt);
  if(target.href!==url||typeof visual!=="boolean"||
   nativeOutcome?.disposition!=="render_required"||nativeOutcome.finalUrl!==url||
   !SHA.test(nativeOutcome.sourceSha256)||!SHA.test(nativeOutcome.projectionSha256))
   fail("NATIVE_FALLBACK_REQUIRED");
  const binding=Object.freeze({scope:s,url,hostname:target.hostname,visual,
   sourceSha256:nativeOutcome.sourceSha256,projectionSha256:nativeOutcome.projectionSha256,
   accountFingerprint:provider.accountFingerprint,reserveSeconds:RESERVE_SECONDS});
  const requestSha256=hash(JSON.stringify(binding));
  const end=Math.min(lease,now()+MAX_DURATION);
  const remaining=()=>Math.max(0,end-now());
  const live=()=>{if(remaining()<=0)fail("DEADLINE");};
  const approved=a=>a?.requestSha256===requestSha256&&
   typeof a.policyRef==="string"&&/^[A-Za-z0-9._:/-]{8,200}$/.test(a.policyRef)&&
   a.publicAcquisitionAllowed===true&&a.nativeFallbackVerified===true&&
   a.remoteEgressIsolationVerified===true&&a.providerUseAllowed===true&&
   a.zeroIncrementalSpendAllowed===true&&a.visualAllowed===visual&&
   Date.parse(a.validUntil)>now()&&Date.parse(a.validUntil)<=lease;
  const policy=await authorize(binding,requestSha256);live();
  if(!approved(policy))fail("AUTHORITY_DENIED");
  const reservation=await reserve(binding,requestSha256,policy);live();
  if(!reservation||!UUID.test(reservation.reservationId)||reservation.requestSha256!==requestSha256||
   reservation.provider!=="cloudflare_browser_run"||reservation.seconds!==RESERVE_SECONDS||
   reservation.maximumIncrementalCostMicrousd!==0||Date.parse(reservation.validUntil)<=now()||
   Date.parse(reservation.validUntil)>lease||!Number.isFinite(Date.parse(reservation.validUntil)))
   fail("ZERO_COST_BUDGET_UNAVAILABLE");
  const fresh=await authorize(binding,requestSha256);live();
  if(!approved(fresh)||fresh.policyRef!==policy.policyRef)fail("AUTHORITY_CHANGED");
  if(await consume(reservation)!==true)fail("RESERVATION_NOT_CONSUMABLE");
  live();
  if(!approved(fresh)||Date.parse(reservation.validUntil)<=now())fail("RESERVATION_EXPIRED");
  let sessionId=null,closeAcknowledged=false,capture;
  // Durable journal must exist before any external request; never store
  // actual token, returned websocket URL, DOM or image in this lifecycle log.
  await recordLifecycle({reservationId:reservation.reservationId,requestSha256,state:"open_pending"});
  live();
  if(!approved(fresh)||Date.parse(reservation.validUntil)<=now())fail("RESERVATION_EXPIRED");
  try{
   sessionId=await provider.open({hostname:binding.hostname},AbortSignal.timeout(Math.max(1,remaining())));
   if(typeof sessionId!=="string"||!UUID.test(sessionId))fail("SESSION_ID_UNCONFIRMED");
   await recordLifecycle({reservationId:reservation.reservationId,requestSha256,sessionId,state:"opened"});
   live();
   capture=await provider.capture(sessionId,{url,hostname:binding.hostname,visual,remaining,
    authorizeRequest:async(u,resourceType)=>{
     if(remaining()<=0||!approved(fresh))return false;
     let candidate;try{candidate=safeUrl(u);}catch{return false;}
     return candidate.hostname===binding.hostname&&await authorizeRequest(binding,u,resourceType,policy)===true;
    }});
   live();
   if(capture?.finalUrl!==url||typeof capture.html!=="string"||
    Buffer.byteLength(capture.html,"utf8")<1||Buffer.byteLength(capture.html,"utf8")>MAX_DOM||
    (visual?!validPng(capture.png):capture.png!==null))fail("CAPTURE_UNCONFIRMED");
  }finally{
   // Separate cleanup window even if research deadline/lease was revoked.
   if(sessionId&&UUID.test(sessionId)){
    try{closeAcknowledged=await provider.close(sessionId,AbortSignal.timeout(5000))===true;}catch{}
   }
   await recordLifecycle({reservationId:reservation.reservationId,requestSha256,
    ...(sessionId&&UUID.test(sessionId)?{sessionId}:{}),state:closeAcknowledged?"close_acknowledged":"cleanup_unconfirmed"});
   if(!closeAcknowledged)fail("CLEANUP_UNCONFIRMED");
  }
  live();
  const after=await authorize(binding,requestSha256);live();
  if(!approved(after)||after.policyRef!==policy.policyRef)fail("AUTHORITY_CHANGED");
  const body=new TextEncoder().encode(capture.html),png=visual?Uint8Array.from(capture.png):null;
  return Object.freeze({contract:"mizizi.desk_browser_read.v1",scope:s,requestedUrl:url,finalUrl:url,
   retrievedAt:new Date(now()).toISOString(),contentType:"text/html",byteLength:body.length,sha256:hash(body),body,
   representation:"rendered_dom_not_original_response",nativeSourceSha256:binding.sourceSha256,
   nativeProjectionSha256:binding.projectionSha256,requestSha256,reservationId:reservation.reservationId,
   visual:png?Object.freeze({contentType:"image/png",width:1280,height:900,byteLength:png.length,sha256:hash(png),body:png}):null,
   identityVerified:false,sourceRetentionAuthorized:false,externalModelProcessingAuthorized:false});
 };
}

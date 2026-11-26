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
function within(promise,ms){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error("MIZIZI_DESK_BROWSER_DEADLINE")),Math.max(1,ms));
  Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});
 });
}
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
 const connected=new Map();
 const open=async({hostname},signal)=>{
  if(typeof hostname!=="string"||safeUrl("https://"+hostname+"/").hostname!==hostname)fail("HOST_DENIED");
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
  try{
   const p=await smallJson(await transport(base+"/"+sessionId,{method:"DELETE",headers,redirect:"error",signal}));
   if(p?.status!=="closing"&&p?.status!=="closed")fail("CLOSE_UNCONFIRMED");
   return true; // Provider close acknowledgement, not measured final billing.
  }finally{
   const browser=connected.get(sessionId);connected.delete(sessionId);
   if(browser)await within(browser.close(),1000).catch(()=>{});
  }
 };
 const capture=async(sessionId,{url,hostname,visual,authorizeRequest,remaining})=>{
  const endpoint=base.replace("https:","wss:")+"/"+sessionId;
  const connector=connect??(async(endpoint,opts)=>{
   const {chromium}=await import("@playwright/test");
   return chromium.connectOverCDP(endpoint,opts);
  });
  const timeout=()=>{const ms=remaining();if(ms<=0)fail("DEADLINE");return ms;};
  const browser=await connector(endpoint,{headers:{Authorization:"Bearer "+apiToken},timeout:timeout()});
  if(remaining()<=0){await within(browser.close(),1000).catch(()=>{});fail("DEADLINE");}
  connected.set(sessionId,browser);
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
       await authorizeRequest(target.href,req.resourceType())!==true||remaining()<=0){
      denied=true;await route.abort();return;
     }
     await route.continue();
    }catch{denied=true;try{await route.abort();}catch{}}
   });
   const page=await context.newPage();
   page.on("popup",p=>{denied=true;void p.close().catch(()=>{});});
   page.on("download",d=>{denied=true;void d.cancel().catch(()=>{});});
   const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:timeout()});
   if(!response||response.status()!==200||response.request().redirectedFrom()!==null||page.url()!==url||denied)fail("NAVIGATION_UNCONFIRMED");
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
   // Caller closes the account-scoped session before disconnecting the
   // Playwright client, avoiding ambiguity about which operation closed it.
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
   a.remoteEgressIsolationVerified===true&&a.remoteRequestPolicyVerified===true&&a.providerUseAllowed===true&&
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
   capture=await within(provider.capture(sessionId,{url,hostname:binding.hostname,visual,remaining,
    authorizeRequest:async(u,resourceType)=>{
     if(remaining()<=0||!approved(fresh))return false;
     let candidate;try{candidate=safeUrl(u);}catch{return false;}
     return candidate.hostname===binding.hostname&&await authorizeRequest(binding,u,resourceType,policy)===true;
    }}),remaining());
   live();
   if(capture?.finalUrl!==url||typeof capture.html!=="string"||
    Buffer.byteLength(capture.html,"utf8")<1||Buffer.byteLength(capture.html,"utf8")>MAX_DOM||
    (visual?!validPng(capture.png):capture.png!==null))fail("CAPTURE_UNCONFIRMED");
  }finally{
   // Separate cleanup window even if research deadline/lease was revoked.
   if(sessionId&&UUID.test(sessionId)){
    try{closeAcknowledged=await within(provider.close(sessionId,AbortSignal.timeout(5000)),5000)===true;}catch{}
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


/**
 * Provider-independent, read-only interactive Chromium session.
 *
 * The trusted host supplies an already isolated browser and an independent
 * resource acquisition boundary. Unlike route.continue(), route.fulfill()
 * cannot silently let Chromium follow a provider redirect outside our
 * request policy. Browser network access must independently be fenced:
 * Playwright routing and offline mode alone are NOT a network sandbox.
 * No API token, cookie, arbitrary JS, arbitrary selector, or request body is
 * passed to the model. This primitive does not issue durable grants, reserve
 * money, or append evidence; the caller MUST integrate those authorities
 * before exposing it to the operational worker.
 */
export async function withDeskInteractiveBrowserV1(options,work){
 const {browser,scope:rawScope,authorizeAction,authorizeRequest,readResource,now=Date.now}=options??{};
 if(!browser||typeof browser.newContext!=="function"||
  [authorizeAction,authorizeRequest,readResource,now,work].some(f=>typeof f!=="function"))
  fail("INTERACTIVE_CONFIGURATION_REQUIRED");
 const scope=scopeOf(rawScope,now());
 const end=Math.min(Date.parse(scope.leaseExpiresAt),now()+120000);
 const remaining=()=>Math.max(0,end-now());
 const live=()=>{if(remaining()<=0)fail("DEADLINE");};
 const bounded=async(promise)=>{live();return within(promise,remaining());};
 const actionLimit=24,requestLimit=240,byteLimit=12000000,maxResource=2000000;
 let context,page,active=true,busy=false,actionCount=0,requestCount=0,receivedBytes=0,
  blockedRequests=0,documentFailure=false,unexpectedNavigation=false,expectedNavigation=null,
  redirect=null,observation=null,refs=new Map(),generation=0;
 const bindings=[],redirectBindings=[];
 const sessionAbort=new AbortController();
 const cleanText=(value,max)=>typeof value==="string"?
  value.replace(/[\p{Cc}\p{Cf}]/gu," ").replace(/\s+/g," ").trim().slice(0,max):"";
 const actionGrant=async(operation,detail={})=>{
  live();
  const binding=Object.freeze({scope,operation,...detail});
  const sha256=hash(JSON.stringify(binding));
  if(await bounded(authorizeAction(binding,sha256))!==true)fail("INTERACTIVE_ACTION_DENIED");
  live();
  return sha256;
 };
 const allowedMime=(type,mime)=>{
  if(type==="document")return ["text/html","application/xhtml+xml"].includes(mime);
  if(type==="script")return ["text/javascript","application/javascript","application/ecmascript","text/ecmascript"].includes(mime);
  if(type==="stylesheet")return mime==="text/css";
  if(type==="image")return ["image/png","image/jpeg","image/webp","image/gif","image/svg+xml","image/avif","image/x-icon"].includes(mime);
  if(type==="font")return ["font/woff","font/woff2","application/font-woff","application/octet-stream"].includes(mime);
  if(type==="xhr"||type==="fetch")return ["application/json","text/plain","text/html","application/xml","text/xml"].includes(mime);
  return false;
 };
 const safeHeaders=new Set(["content-security-policy","content-security-policy-report-only","x-content-type-options",
  "x-frame-options","referrer-policy","cross-origin-resource-policy","cross-origin-opener-policy",
  "cross-origin-embedder-policy","access-control-allow-origin","access-control-allow-methods",
  "access-control-allow-headers","access-control-expose-headers","vary","permissions-policy"]);
 function currentUrl(){
  const raw=page.url(),u=safeUrl(raw);
  if(u.href!==raw)fail("INTERACTIVE_URL_UNCONFIRMED");
  return raw;
 }
 async function routeResource(route){
  const req=route.request(),type=req.resourceType(),isDocument=type==="document";
  const abort=async()=>{blockedRequests++;if(isDocument)documentFailure=true;await route.abort().catch(()=>{});};
  try{
   const url=safeUrl(req.url()).href;
   if(!active||++requestCount>requestLimit||remaining()<=0||req.method()!=="GET"||
    !["document","script","stylesheet","image","font","xhr","fetch"].includes(type)||
    (isDocument&&(url!==expectedNavigation||req.frame()!==page.mainFrame()))||
    req.redirectedFrom()!==null){await abort();return;}
   // No browser-provided headers, cookies or body leave this boundary.
   const binding=Object.freeze({scope,url,resourceType:type,
    topLevelUrl:expectedNavigation??currentUrl()});
   const requestSha256=hash(JSON.stringify(binding));
   if(await bounded(authorizeRequest(binding,requestSha256))!==true){await abort();return;}
   const response=await bounded(readResource(binding,requestSha256,AbortSignal.any([sessionAbort.signal,AbortSignal.timeout(Math.max(1,remaining()))])));
   // Independently check request binding and current authorization again
   // before disclosing the acquired bytes to the untrusted webpage.
   if(!response||response.requestSha256!==requestSha256||!active||
    await bounded(authorizeRequest(binding,requestSha256))!==true||!active){await abort();return;}
   if([301,302,303,307,308].includes(response.status)){
    // Never fulfill a 3xx: Playwright intercepts only the initial URL in
    // a redirect chain. Top-level redirects become separately authorized
    // navigation actions; unsupported subresource redirects are blocked.
    if(!isDocument||typeof response.location!=="string"){await abort();return;}
    const next=safeUrl(new URL(response.location,url).href).href;
    // Aborting a document navigation can commit Chromium's error page
    // asynchronously, racing the next goto. Commit an inert empty marker
    // instead, never a browser-followed 3xx. It is NOT acquired evidence.
    // No script, link, form, subresource or refresh is present in this marker.
    redirect={from:url,to:next,requestSha256,status:response.status};
    await route.fulfill({status:200,headers:{"content-type":"text/html; charset=utf-8",
     "cache-control":"no-store","content-security-policy":"default-src 'none'; base-uri 'none'; form-action 'none'"},
     body:"<!doctype html><html><head></head><body></body></html>"});
    return;
   }
   const body=response.body,mime=typeof response.contentType==="string"?
    response.contentType.split(";")[0].trim().toLowerCase():"";
   if(response.status!==200||!(body instanceof Uint8Array)||body.byteLength<1||
    body.byteLength>maxResource||receivedBytes+body.byteLength>byteLimit||
    !SHA.test(response.sha256??"")||hash(body)!==response.sha256||!allowedMime(type,mime)){
    await abort();return;
   }
   const headers={"content-type":response.contentType,"cache-control":"no-store"};
   if(response.headers!==undefined){
    if(!response.headers||typeof response.headers!=="object"||Array.isArray(response.headers)){
     await abort();return;
    }
    for(const [name,value] of Object.entries(response.headers)){
     const lower=name.toLowerCase();
     if(!safeHeaders.has(lower)||typeof value!=="string"||value.length>16000||/[\r\n\0]/.test(value)){
      await abort();return;
     }
     headers[lower]=value;
    }
   }
   receivedBytes+=body.byteLength;
   bindings.push(Object.freeze({url,resourceType:type,requestSha256,sourceSha256:response.sha256,byteLength:body.byteLength}));
   await route.fulfill({status:200,headers,body:Buffer.from(body)});
  }catch{await abort();}
 }
 async function navigateTo(raw){
  let url=safeUrl(raw).href;
  const seen=new Set();
  // Until a real final document commits, observations/captures cannot use
  // an old page or the synthetic redirect marker, even after caught errors.
  documentFailure=true;
  try{
   for(let hop=0;hop<4;hop++){
    if(seen.has(url))fail("INTERACTIVE_REDIRECT_LOOP");
    seen.add(url);
    await actionGrant("navigate",{url});
    expectedNavigation=url;documentFailure=false;unexpectedNavigation=false;redirect=null;
    const response=await bounded(page.goto(url,{waitUntil:"domcontentloaded",timeout:remaining()}));
    if(!response||response.status()!==200||documentFailure||unexpectedNavigation||currentUrl()!==url)
     fail("INTERACTIVE_NAVIGATION_UNCONFIRMED");
    if(redirect&&redirect.from===url){
     redirectBindings.push(Object.freeze({...redirect}));
     documentFailure=true;
     url=redirect.to;continue;
    }
    expectedNavigation=null;return;
   }
   fail("INTERACTIVE_REDIRECT_BOUND");
  }catch(error){documentFailure=true;expectedNavigation=null;throw error;}
 }
 async function describe(handle){
  return bounded(handle.evaluate(node=>{
   if(!node.isConnected)return null;
   const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
   if(!rect.width||!rect.height||style.visibility==="hidden"||style.display==="none"||
    node.closest("[inert],[hidden],[aria-hidden=true]"))return null;
   const label=(node.getAttribute("aria-label")||node.innerText||node.getAttribute("placeholder")||"").trim().slice(0,300);
   if(node.matches("a[href]")&&!node.hasAttribute("download")){
    return {kind:"link",label,url:node.href};
   }
   if(node.matches("summary")&&node.parentElement?.tagName==="DETAILS"){
    return {kind:"expand",label,expanded:node.parentElement.open};
   }
   if(node.matches("button[aria-expanded]")&&!node.closest("form")&&!node.disabled){
    return {kind:"expand",label,expanded:node.getAttribute("aria-expanded")==="true"};
   }
   if(node.matches("input[type=search]")&&!node.disabled&&!node.readOnly){
    const form=node.form;
    if(!form||form.method.toLowerCase()!=="get"||!node.name||
     !/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(node.name))return null;
    // Do not send hidden form values, credentials, or unrelated fields.
    const others=Array.from(form.elements).filter(e=>e!==node&&e.name&&!e.disabled);
    if(others.length)return null;
    return {kind:"search",label,action:form.action,parameter:node.name};
   }
   return null;
  }));
 }
 async function clearRefs(){
  const old=refs;refs=new Map();observation=null;
  await Promise.all([...old.values()].map(r=>r.handle.dispose().catch(()=>{})));
 }
 async function observePage(){
  live();
  if(documentFailure||unexpectedNavigation||expectedNavigation!==null)fail("INTERACTIVE_NAVIGATION_UNCONFIRMED");
  const url=currentUrl();
  await actionGrant("observe",{url});
  await clearRefs();
  const locator=page.locator("a[href],summary,button[aria-expanded],input[type=search]");
  const count=Math.min(await bounded(locator.count()),160);
  const elements=[];
  for(let i=0;i<count&&elements.length<80;i++){
   const handle=await bounded(locator.nth(i).elementHandle({timeout:Math.min(1000,remaining())}));
   if(!handle)continue;
   let value;
   try{value=await describe(handle);}catch{await handle.dispose().catch(()=>{});continue;}
   if(!value){await handle.dispose().catch(()=>{});continue;}
   const label=cleanText(value.label,300);
   try{
    if(value.kind==="link")value.url=safeUrl(value.url).href;
    if(value.kind==="search")value.action=safeUrl(value.action).href;
   }catch{await handle.dispose().catch(()=>{});continue;}
   const ref="r"+(generation+1)+"-"+(elements.length+1);
   const descriptor=Object.freeze({...value,label});
   refs.set(ref,{handle,descriptor,rawDescriptor:JSON.stringify(value)});
   // URLs are untrusted discovered leads, not access or evidence grants.
   elements.push(Object.freeze({ref,...descriptor}));
  }
  const text=await bounded(page.locator("body").evaluate(node=>(node.innerText??"").slice(0,24000),undefined,{timeout:remaining()}));
  const title=cleanText(await bounded(page.title()),500);
  const accessibility=await bounded(page.locator("body").ariaSnapshot({timeout:remaining()}));
  if(typeof accessibility!=="string"||documentFailure||unexpectedNavigation||currentUrl()!==url)
   fail("INTERACTIVE_OBSERVATION_UNCONFIRMED");
  const projection={generation:++generation,url,title,visibleText:typeof text==="string"?text:"",
   accessibility:accessibility.slice(0,24000),elements,elementScanTruncated:count>=160||elements.length>=80,
   blockedRequests};
  const observationSha256=hash(JSON.stringify(projection));
  await actionGrant("observe_result",{url,observationSha256});
  observation=Object.freeze({...projection,observationSha256});
  return observation;
 }
 async function resolveRef(ref,generationValue,kind){
  if(!observation||observation.generation!==generationValue||!refs.has(ref))fail("INTERACTIVE_STALE_REFERENCE");
  const entry=refs.get(ref);
  if(entry.descriptor.kind!==kind)fail("INTERACTIVE_REFERENCE_KIND_DENIED");
  const fresh=await describe(entry.handle);
  if(!fresh)fail("INTERACTIVE_STALE_REFERENCE");
  if(fresh.kind==="link")fresh.url=safeUrl(fresh.url).href;
  if(fresh.kind==="search")fresh.action=safeUrl(fresh.action).href;
  if(JSON.stringify(fresh)!==entry.rawDescriptor)fail("INTERACTIVE_STALE_REFERENCE");
  return entry;
 }
 async function step(fn){
  live();if(!active||busy||++actionCount>actionLimit)fail("INTERACTIVE_ACTION_BOUND");
  busy=true;
  try{return await fn();}finally{busy=false;}
 }
 try{
  await actionGrant("open");
  context=await bounded(browser.newContext({acceptDownloads:false,serviceWorkers:"block",
   javaScriptEnabled:true,ignoreHTTPSErrors:false,offline:true,viewport:{width:1280,height:900}}));
  await bounded(context.routeWebSocket("**/*",socket=>{void socket.close();}));
  page=await bounded(context.newPage());
  await bounded(context.route("**/*",routeResource));
  page.on("popup",p=>{unexpectedNavigation=true;void p.close().catch(()=>{});});
  page.on("download",d=>{unexpectedNavigation=true;void d.cancel().catch(()=>{});});
  page.on("framenavigated",frame=>{
   if(frame===page.mainFrame()&&frame.url()!=="about:blank"&&
    (expectedNavigation===null||frame.url()!==expectedNavigation))unexpectedNavigation=true;
  });
  const api=Object.freeze({
   navigate:raw=>step(async()=>{await clearRefs();await navigateTo(raw);return observePage();}),
   observe:()=>step(observePage),
   follow:(ref,g)=>step(async()=>{
    const entry=await resolveRef(ref,g,"link");
    const url=currentUrl(),target=entry.descriptor.url;
    await actionGrant("follow",{url,target,observationSha256:observation.observationSha256});
    await clearRefs();await navigateTo(target);return observePage();
   }),
   expand:(ref,g)=>step(async()=>{
    const entry=await resolveRef(ref,g,"expand");
    if(entry.descriptor.expanded)fail("INTERACTIVE_ALREADY_EXPANDED");
    const url=currentUrl();
    await actionGrant("expand",{url,ref,observationSha256:observation.observationSha256,label:entry.descriptor.label});
    // Exact observed element handle, no model-supplied selector or script.
    await bounded(entry.handle.click({timeout:remaining()}));
    if(documentFailure||unexpectedNavigation||currentUrl()!==url)fail("INTERACTIVE_NAVIGATION_UNCONFIRMED");
    return observePage();
   }),
   scroll:direction=>step(async()=>{
    if(!["down","up"].includes(direction))fail("INTERACTIVE_SCROLL_DENIED");
    const url=currentUrl();await actionGrant("scroll",{url,direction});
    await bounded(page.mouse.wheel(0,direction==="down"?720:-720));
    return observePage();
   }),
   search:(ref,g,query)=>step(async()=>{
    const entry=await resolveRef(ref,g,"search");
    if(typeof query!=="string"||query.trim()!==query||query.length<1||query.length>300||
     /[\p{Cc}\p{Cf}]/u.test(query))fail("INTERACTIVE_QUERY_DENIED");
    const url=currentUrl(),target=safeUrl(entry.descriptor.action);
    // Standard GET search action, no implicit form fields or POST. Exact
    // query is independently approved as public disclosure before sending.
    target.search="";target.searchParams.set(entry.descriptor.parameter,query);
    const destination=safeUrl(target.href).href;
    await actionGrant("search",{url,target:destination,query,observationSha256:observation.observationSha256});
    await clearRefs();await navigateTo(destination);return observePage();
   }),
   capture:({visual=false}={})=>step(async()=>{
    if(typeof visual!=="boolean"||documentFailure||unexpectedNavigation||expectedNavigation!==null)fail("INTERACTIVE_CAPTURE_DENIED");
    const url=currentUrl();await actionGrant("capture",{url,visual});
    const html=await bounded(page.locator("html").evaluate(node=>{
     const value=node.outerHTML;return value.length<=2000000?value:null;
    },undefined,{timeout:remaining()}));
    if(typeof html!=="string"||Buffer.byteLength(html)>MAX_DOM)fail("DOM_BOUND");
    const png=visual?await bounded(page.screenshot({type:"png",fullPage:false,animations:"disabled",timeout:remaining()})):null;
    if((visual&&!validPng(png))||documentFailure||unexpectedNavigation||currentUrl()!==url)
     fail("INTERACTIVE_CAPTURE_UNCONFIRMED");
    const body=new TextEncoder().encode(html),sourceSha256=hash(body);
    const visualSha256=png?hash(png):null;
    const dependencies=bindings.slice(),redirects=redirectBindings.slice();
    await actionGrant("capture_result",{url,sourceSha256,visualSha256,
     resourceBindingSha256:hash(JSON.stringify(dependencies)),redirectBindingSha256:hash(JSON.stringify(redirects))});
    return Object.freeze({contract:"mizizi.desk_interactive_capture.v1",scope,finalUrl:url,
     representation:"rendered_dom_not_original_response",body,sha256:sourceSha256,
     visual:png?{body:Uint8Array.from(png),sha256:visualSha256,contentType:"image/png"}:null,
     resourceBindings:dependencies,redirectBindings:redirects,identityVerified:false,sourceRetentionAuthorized:false,externalModelProcessingAuthorized:false});
   })
  });
  const result=await bounded(work(api));
  if(busy)fail("INTERACTIVE_CONCURRENT_WORK_UNCONFIRMED");
  return result;
 }finally{
  active=false;sessionAbort.abort();
  if(context){
   try{await within(context.close(),5000);}
   catch{fail("INTERACTIVE_CLEANUP_UNCONFIRMED");}
  }
 }
}

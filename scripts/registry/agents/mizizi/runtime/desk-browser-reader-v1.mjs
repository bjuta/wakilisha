/** Restricted Cloudflare Browser Run fallback. Never use Quick Actions:
 * provider session-level hostname guardrails are required. No model-authored
 * code, clicks, forms, credentials, arbitrary navigation or shared sessions.
 * Provider guardrails are hostname restrictions, NOT proof of public-IP egress.
 * Trusted runtime must supply independently verified remote network isolation,
 * exact disclosure/access authority and durable zero-cost account allocation.
 * No enabled implementation of those authorities is provided here.
 */
import {createHash,randomUUID} from "node:crypto";
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
 const {browser,scope:rawScope,authorizeAction,authorizeRequest,readResource,now=Date.now,deadlineMs}=options??{};
 if(!browser||typeof browser.newContext!=="function"||
  [authorizeAction,authorizeRequest,readResource,now,work].some(f=>typeof f!=="function"))
  fail("INTERACTIVE_CONFIGURATION_REQUIRED");
 const scope=scopeOf(rawScope,now());
 if(deadlineMs!==undefined&&(!Number.isFinite(deadlineMs)||deadlineMs<=now()))fail("DEADLINE");
 const end=Math.min(Date.parse(scope.leaseExpiresAt),now()+120000,deadlineMs??Infinity);
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
    // Capture DOM and visible text in one synchronous evaluation. Do not
    // treat a preceding accessibility snapshot or hidden text as evidence.
    const snapshot=await bounded(page.locator("html").evaluate(node=>{
     const html=node.outerHTML;
     if(html.length>2000000)return null;
     const visibleText=(node.ownerDocument.body?.innerText??"").slice(0,24000);
     return {html,visibleText};
    },undefined,{timeout:remaining()}));
    if(!snapshot||typeof snapshot.html!=="string"||typeof snapshot.visibleText!=="string"||
     Buffer.byteLength(snapshot.html)>MAX_DOM)fail("DOM_BOUND");
    const html=snapshot.html,visibleText=snapshot.visibleText,visibleTextSha256=hash(visibleText);
    const png=visual?await bounded(page.screenshot({type:"png",fullPage:false,animations:"disabled",timeout:remaining()})):null;
    if((visual&&!validPng(png))||documentFailure||unexpectedNavigation||currentUrl()!==url)
     fail("INTERACTIVE_CAPTURE_UNCONFIRMED");
    const body=new TextEncoder().encode(html),sourceSha256=hash(body);
    const visualSha256=png?hash(png):null;
    const dependencies=bindings.slice(),redirects=redirectBindings.slice();
    await actionGrant("capture_result",{url,sourceSha256,visualSha256,visibleTextSha256,
     resourceBindingSha256:hash(JSON.stringify(dependencies)),redirectBindingSha256:hash(JSON.stringify(redirects))});
    return Object.freeze({contract:"mizizi.desk_interactive_capture.v1",scope,finalUrl:url,
     representation:"rendered_dom_not_original_response",body,sha256:sourceSha256,visibleText,visibleTextSha256,
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


/** Model-facing navigation bridge, inside ONE live interactive session.
 * A model sees only admitted source excerpts and opaque action IDs. It
 * cannot supply a URL, selector, code, or fake observation. All capabilities,
 * resource access, finance, and custody must be supplied by the trusted host.
 * Do not enable this via the production dispatcher until its durable action
 * and observation admission contract is installed. No default grants.
 */
export function createDeskBrowserActionRouterV1({scope:rawScope,session,resolveReference,
 authorizeCall,authorizeQuery,admitObservation,visualAllowed=false,authorizeVisualLead,authorizeContentLabels,now=Date.now}={}){
 const scope=scopeOf(rawScope,now());
 if(!session||["navigate","follow","expand","scroll","search","observe","capture"].some(k=>typeof session[k]!=="function")||
  [resolveReference,authorizeCall,authorizeQuery,admitObservation,now].some(f=>typeof f!=="function")||
  (authorizeVisualLead!==undefined&&typeof authorizeVisualLead!=="function")||
  (authorizeContentLabels!==undefined&&typeof authorizeContentLabels!=="function")||
  typeof visualAllowed!=="boolean")fail("ACTION_ROUTER_CONFIGURATION");
 const sameScope=s=>s&&JSON.stringify(scope)===JSON.stringify(s);
 const cleanLabel=s=>typeof s==="string"?s.replace(/[\p{Cc}\p{Cf}]/gu," ").replace(/\s+/g," ").trim().slice(0,300).trim():"";
 let actions=new Map(),issued=new Set(),calls=new Set(),current=null,busy=false,poisoned=false;
 function live(){if(poisoned||now()>=Date.parse(scope.leaseExpiresAt))fail("ACTION_ROUTER_CLOSED");}
 const observeShape=o=>o&&Number.isSafeInteger(o.generation)&&o.generation>0&&
  typeof o.url==="string"&&safeUrl(o.url).href===o.url&&SHA.test(o.observationSha256)&&
  typeof o.visibleText==="string"&&typeof o.accessibility==="string"&&Array.isArray(o.elements)&&o.elements.length<=80;
 function freshId(){const id=randomUUID();if(issued.has(id))fail("ACTION_ID_COLLISION");issued.add(id);return id;}
 // A bounded set of actionable controls, followed by page links. Reserve
 // room for each capability rather than let a page's navigation menu
 // crowd the research controls out of the model context.
 function actionLeads(observation,allowVisual,allowContentLabels){
  const entries=[];
  const add=(kind,label,action,element=null)=>{
   if(!label||entries.length>=8)return;
   const lead=Object.freeze({id:freshId(),kind,label});
   const target=Object.freeze({lead,action,element,generation:observation.generation,
    url:observation.url,observationSha256:observation.observationSha256});
   entries.push(target);
  };
  for(const type of ["expand","search","link"]){
   const limit=type==="expand"?3:type==="search"?1:2;
   let count=0;
   for(const e of observation.elements){
    if(e?.kind!==type||typeof e.ref!=="string"||e.ref.length>40||
     type==="expand"&&e.expanded===true||count>=limit)continue;
    const label=cleanLabel(e.label);if(!label)continue;
    add("browser_action",allowContentLabels?(type==="expand"?"Expand: "+label:type==="search"?"Search: "+label:"Follow: "+label):
     (type==="expand"?"Expand public section":type==="search"?"Search public page":"Follow public reference"),
     type==="link"?"follow":type,e.ref);count++;
   }
  }
  // Keep the action set small; a model can ask for the viewport explicitly.
  add("browser_action","Scroll down","scroll_down");
  if(allowVisual)add("visual","Examine the current browser viewport","visual");
  return entries;
 }
 async function execute(candidate,call,callSha256){
  live();
  if(busy||!sameScope(candidate)||!call||!SHA.test(callSha256)||
   hash(JSON.stringify({scope:candidate,call}))!==callSha256||
   !["browse_page","inspect_visual"].includes(call.name)||
   !call.input||typeof call.input!=="object"||
   typeof call.input.lead_id!=="string"||!UUID.test(call.input.lead_id)||
   Object.keys(call.input).sort().join(",")!==(call.name==="browse_page"?"lead_id,query":"lead_id,page")||
   calls.has(callSha256)||calls.size>=4)fail("ACTION_ROUTER_CALL_DENIED");
  busy=true;
  try{
   if(await authorizeCall(scope,call,callSha256)!==true)fail("ACTION_ROUTER_AUTHORITY_DENIED");
   live();
   const id=call.input.lead_id,entry=actions.get(id);
   if(issued.has(id)&&!entry)fail("ACTION_ROUTER_STALE_LEAD");
   let selected;
   if(entry){
    if(!current||entry.generation!==current.generation||entry.observationSha256!==current.observationSha256||
     entry.url!==current.url)fail("ACTION_ROUTER_STALE_LEAD");
    selected=entry;
   }else{
    if(call.name!=="browse_page"||call.input.query!=="")fail("ACTION_ROUTER_LEAD_DENIED");
    const reference=await resolveReference(scope,id);
    if(!reference||reference.id!==id||reference.kind!=="reference"||!UUID.test(reference.receiptId??"")||
     typeof reference.url!=="string"||safeUrl(reference.url).href!==reference.url)
     fail("ACTION_ROUTER_LEAD_DENIED");
    selected={action:"navigate",url:reference.url,receiptId:reference.receiptId};
   }
   const action=selected.action;
   if(call.name==="inspect_visual"){
    if(action!=="visual"||!visualAllowed||call.input.page!==1)fail("ACTION_ROUTER_VISUAL_DENIED");
   }else if(action==="visual")fail("ACTION_ROUTER_VISUAL_DENIED");
   if(call.name==="browse_page"){
    const q=call.input.query;
    if(typeof q!=="string"||q.length>300||q.trim()!==q||/[\p{Cc}\p{Cf}]/u.test(q)||
     (action==="search"?q.length<3:q!==""))fail("ACTION_ROUTER_QUERY_DENIED");
    if(action==="search"&&await authorizeQuery(scope,q,selected.url,callSha256)!==true)
     fail("ACTION_ROUTER_QUERY_DENIED");
   }
   live();
   if(await authorizeCall(scope,call,callSha256)!==true)fail("ACTION_ROUTER_AUTHORITY_DENIED");
   // After a real action, every old control is invalid, including on error.
   // The original discovery reference may be re-resolved by the host.
   calls.add(callSha256);actions=new Map();
   let observation;
   try{
    if(action==="navigate")observation=await session.navigate(selected.url);
    else if(action==="follow")observation=await session.follow(selected.element,selected.generation);
    else if(action==="expand")observation=await session.expand(selected.element,selected.generation);
    else if(action==="search")observation=await session.search(selected.element,selected.generation,call.input.query);
    else if(action==="scroll_down")observation=await session.scroll("down");
    else if(action==="visual")observation=await session.observe();
    else fail("ACTION_ROUTER_ACTION_DENIED");
    live();
    if(!observeShape(observation))fail("ACTION_ROUTER_OBSERVATION_INVALID");
    const capture=await session.capture({visual:action==="visual"});
    live();
    if(capture?.contract!=="mizizi.desk_interactive_capture.v1"||
     !sameScope(capture.scope)||capture.finalUrl!==observation.url||
     capture.representation!=="rendered_dom_not_original_response"||
     !(capture.body instanceof Uint8Array)||capture.body.length<1||capture.body.length>MAX_DOM||
     hash(capture.body)!==capture.sha256||typeof capture.visibleText!=="string"||
     capture.visibleText.length>24000||hash(capture.visibleText)!==capture.visibleTextSha256||capture.identityVerified!==false||
     capture.sourceRetentionAuthorized!==false||capture.externalModelProcessingAuthorized!==false||
     (action==="visual"?(!validPng(capture.visual?.body)||hash(capture.visual.body)!==capture.visual.sha256):capture.visual!==null))
     fail("ACTION_ROUTER_CAPTURE_INVALID");
    // Capture and observation have different fingerprints: asynchronous DOM
    // changes are possible. A trusted admitter must derive actual evidence
    // from captured bytes, not claim the observation is the captured DOM.
    const allowVisual=visualAllowed&&(!authorizeVisualLead||await authorizeVisualLead(scope,observation.url)===true);
    // An access-only observation exposes control types, not publisher-supplied labels.
    const allowContentLabels=!authorizeContentLabels||await authorizeContentLabels(scope,observation.url)===true;
    const entries=action==="visual"?[]:actionLeads(observation,allowVisual,allowContentLabels);
    const leads=entries.map(e=>e.lead);
    const receiptId=freshId();
    const result=await admitObservation(Object.freeze({scope,call,callSha256,receiptId,
     parentLeadId:id,action,observation,capture,leads:Object.freeze(leads),
     actionBindings:Object.freeze(entries.map(e=>Object.freeze({id:e.lead.id,url:e.url,action:e.action,
      generation:e.generation,observationSha256:e.observationSha256})))}));
    live();
    if(!result||result.receiptId!==receiptId||JSON.stringify(result.leads)!==JSON.stringify(leads)||
     !Array.isArray(result.sources)||result.sources.length>1||
     result.sources.some(s=>s?.source?.sourceId!==receiptId||s.source.fingerprint!==capture.sha256||
      s.source.caseId!==scope.caseId||s.source.workspaceId!==scope.workspaceId)||
     (action==="visual"?(!result.visual||result.visual.sourceId!==receiptId||
       result.visual.sha256!==capture.visual.sha256||hash(result.visual.body)!==capture.visual.sha256||
       result.sources.length!==1):result.visual!==undefined))
     fail("ACTION_ROUTER_CUSTODY_DENIED");
    if(await authorizeCall(scope,call,callSha256)!==true)fail("ACTION_ROUTER_AUTHORITY_DENIED");
    live();
    current=Object.freeze({generation:observation.generation,url:observation.url,observationSha256:observation.observationSha256});
    actions=new Map(entries.map(e=>[e.lead.id,e]));
    return result;
   }catch(error){poisoned=true;actions.clear();current=null;throw error;}
  }finally{busy=false;}
 }
 return Object.freeze({execute,ownsLead:id=>issued.has(id)});
}


/** Lazy, exact-lease local browser lifecycle. No session exists until a
 * browse_page call requires it. The host must independently enforce a
 * browser process/network sandbox, deadline, abort and idempotent full
 * process cleanup by the preassigned session ID. A context close is NOT
 * proof of process termination. No default host or self-issued grant.
 *
 * The existing resource ledger consumes capacity before the host opens;
 * every action and acquisition revalidates both host and durable capacity.
 * The worker MUST await close() before append of the investigation pass.
 */
export function createDurableLocalDeskBrowserV1({scope:rawScope,host,finance,
 authorizeAction,authorizeRequest,readResource,routerOptions,now=Date.now}={}){
 const scope=scopeOf(rawScope,now());
 if(!host||!SHA.test(host.accountFingerprint??"")||
  [host.authorizeHost,host.open,host.close,finance?.reserve,finance?.consume,finance?.recordLifecycle,finance?.readSession,
   authorizeAction,authorizeRequest,readResource,routerOptions,now].some(fn=>typeof fn!=="function"))
  fail("LOCAL_HOST_CONFIGURATION");
 const binding=Object.freeze({scope,accountFingerprint:host.accountFingerprint,reserveSeconds:120,mode:"interactive"});
 const requestSha256=hash(JSON.stringify(binding)),sessionId=randomUUID();
 let runner=null,router=null,reservation=null,closed=false,release=null,readyResolve,readyReject,initialGrant=null,deadline=0;
 const lifetime=new AbortController();
 const sameScope=s=>s&&JSON.stringify(scope)===JSON.stringify(s);
 const approved=a=>a&&a.requestSha256===requestSha256&&a.egressIsolationVerified===true&&a.localCapacityVerified===true&&
  a.zeroIncrementalSpendAllowed===true&&typeof a.policyRef==="string"&&/^[A-Za-z0-9._:/-]{8,200}$/.test(a.policyRef)&&
  Number.isFinite(Date.parse(a.validUntil))&&Date.parse(a.validUntil)>now()&&Date.parse(a.validUntil)<=Date.parse(scope.leaseExpiresAt);
 async function checkHost(){
  const a=await host.authorizeHost(binding,requestSha256);
  if(!approved(a)||initialGrant&&initialGrant.policyRef!==a.policyRef)fail("LOCAL_HOST_AUTHORITY_DENIED");
  return a;
 }
 async function checkSession(){
  if(closed||!reservation||lifetime.signal.aborted||now()>=deadline)fail("LOCAL_SESSION_EXPIRED");
  const a=await checkHost(),p=await finance.readSession(scope,reservation,sessionId);
  if(!p||p.resource!=="local_chromium"||p.accountFingerprint!==host.accountFingerprint||
   p.reservationId!==reservation.reservationId||p.requestSha256!==requestSha256||
   p.sessionId!==sessionId||!sameScope(p.scope)||!Number.isFinite(Date.parse(p.validUntil))||
   Date.parse(p.validUntil)<=now()||Date.parse(p.validUntil)>Date.parse(scope.leaseExpiresAt))
   fail("LOCAL_SESSION_AUTHORITY_DENIED");
  deadline=Math.min(deadline,Date.parse(a.validUntil),Date.parse(p.validUntil));
  if(closed||lifetime.signal.aborted||now()>=deadline)fail("LOCAL_SESSION_EXPIRED");
  return Object.freeze({...p,validUntil:new Date(deadline).toISOString()});
 }
 async function run(){
  initialGrant=await checkHost();
  reservation=await finance.reserve(binding,requestSha256);
  if(!reservation||!UUID.test(reservation.reservationId??"")||reservation.requestSha256!==requestSha256||
   reservation.provider!=="local_chromium"||reservation.seconds!==120||reservation.maximumIncrementalCostMicrousd!==0||
   !Number.isFinite(Date.parse(reservation.validUntil))||Date.parse(reservation.validUntil)<=now()||
   Date.parse(reservation.validUntil)>Date.parse(scope.leaseExpiresAt))fail("LOCAL_CAPACITY_DENIED");
  const a=await checkHost();
  if(closed||Date.parse(reservation.validUntil)<=now())fail("LOCAL_CAPACITY_DENIED");
  // Anchor the local deadline before consume, not at browser launch.
  deadline=Math.min(Date.parse(scope.leaseExpiresAt),Date.parse(initialGrant.validUntil),Date.parse(a.validUntil),now()+120000);
  if(await finance.consume(reservation)!==true)fail("LOCAL_CAPACITY_NOT_CONSUMED");
  const event={reservationId:reservation.reservationId,requestSha256};
  let pending=false,opened=false,cleanup=false;
  try{
   await finance.recordLifecycle({...event,state:"open_pending"});pending=true;
   await checkHost();
   if(closed||now()>=deadline||Date.parse(reservation.validUntil)<=now())fail("LOCAL_CAPACITY_EXPIRED");
   const openSignal=AbortSignal.any([lifetime.signal,AbortSignal.timeout(Math.max(1,Math.min(deadline,Date.parse(reservation.validUntil))-now()))]);
   const browser=await within(host.open(binding,sessionId,openSignal),Math.max(1,Math.min(deadline,Date.parse(reservation.validUntil))-now()));
   if(!browser||typeof browser.newContext!=="function")fail("LOCAL_HOST_OPEN_UNCONFIRMED");
   await finance.recordLifecycle({...event,sessionId,state:"opened"});opened=true;
   await checkSession();
   const getSession=checkSession;
   await withDeskInteractiveBrowserV1({browser,scope,deadlineMs:deadline,now,
    authorizeAction:async(b,digest)=>authorizeAction(b,digest,await getSession()),
    authorizeRequest:async(b,digest)=>authorizeRequest(b,digest,await getSession()),
    readResource:async(b,digest,signal)=>{
     const p=await getSession();
     const result=await readResource(b,digest,AbortSignal.any([signal,lifetime.signal,
      AbortSignal.timeout(Math.max(1,Date.parse(p.validUntil)-now()))]),p);
     await getSession();return result;
    }},async(session)=>{
     router=createDeskBrowserActionRouterV1({...routerOptions(getSession),scope,session,now});
     readyResolve(router);
     await new Promise(resolve=>{release=resolve;if(closed)resolve();});
    });
  }finally{
   lifetime.abort();
   if(pending){
    try{cleanup=await within(host.close(sessionId,AbortSignal.timeout(5000)),5000)===true;}catch{}
    // Unknown open/close is retained as charged and never promotes evidence.
    await finance.recordLifecycle({...event,...(opened?{sessionId}:{}),
     state:opened&&cleanup?"close_acknowledged":"cleanup_unconfirmed"});
    if(!opened||!cleanup)fail("LOCAL_CLEANUP_UNCONFIRMED");
   }
  }
 }
 async function ensure(){
  if(closed)fail("LOCAL_SESSION_CLOSED");
  if(router)return router;
  if(!runner){
   const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
   runner=run();
   // Attach immediately to avoid an unhandled rejection during the model
   // transcript. close() still awaits and propagates the original failure.
   void runner.catch(error=>readyReject(error));
   return ready;
  }
  fail("LOCAL_SESSION_START_IN_PROGRESS");
 }
 return Object.freeze({
  ownsLead:id=>!!router&&router.ownsLead(id),
  execute:async(candidate,call,digest)=>{
   if(!sameScope(candidate))fail("SCOPE_DENIED");
   const active=await ensure();
   await checkSession();
   return active.execute(candidate,call,digest);
  },
  close:async()=>{
   closed=true;lifetime.abort();if(release)release();
   if(runner)await runner;
  }
 });
}

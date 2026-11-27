/** Durable finance/capacity adapter. No source access or model disclosure
 * permission. Never implement those independent decisions using these RPCs.
 */
import {createHash} from "node:crypto";
import type {WorkerRpc} from "./research-worker-cycle-v1.ts";
import type {DeskSearchScopeV1} from "./desk-research-gateway-v1.ts";
import type {DeskAnthropicOptionsV1} from "./desk-anthropic-tool-loop-v1.ts";
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
type Resource="anthropic"|"native_https"|"cloudflare_browser_run"|"local_chromium";
type Binding=Readonly<{scope:DeskSearchScopeV1;resource:Resource;requestSha256:string;accountFingerprint:string;model:string|null}>;
type ResourceQuote=Readonly<{resource:Resource;requestSha256:string;bindingSha256:string;policyRevision:number;units:number;
 validUntil:string;model:string|null;pricingRef:string|null;maxInputTokens:number|null;maxOutputTokens:number|null;maximumCostMicrousd:number}>;
type ResourceReservation=ResourceQuote&Readonly<{reservationId:string}>;
type ModelFinance=Pick<DeskAnthropicOptionsV1,"quote"|"reserve"|"consume"|"recordModelEvent">;
const fail=(code:string):never=>{throw Error("MIZIZI_DESK_RESOURCE_"+code);};
export function createDeskResourceBudgetV1({rpc,now=Date.now}:Readonly<{rpc:WorkerRpc;now?:()=>number}>){
 if(typeof rpc!=="function")fail("TRUSTED_RPC_REQUIRED");
 async function call(fn:string,args:Record<string,unknown>){
  const result=await rpc(fn,args);
  if(!result||result.error)fail("RPC_UNCONFIRMED");
  return result.data;
 }
 function descriptor(b:Binding){
  const s=b.scope;
  if(!s||![s.jobId,s.caseId,s.workspaceId].every(x=>UUID.test(x))||
   !Number.isSafeInteger(s.expectedRevision)||s.expectedRevision<1||
   !/^mizizi-chart:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s.workerId)||
   !Number.isFinite(Date.parse(s.leaseExpiresAt))||Date.parse(s.leaseExpiresAt)<=now()||
   !SHA.test(b.requestSha256)||!SHA.test(b.accountFingerprint)||
   !["anthropic","native_https","cloudflare_browser_run","local_chromium"].includes(b.resource)||
   (b.resource==="anthropic"?!/^[A-Za-z0-9._:-]{3,100}$/.test(b.model??""):b.model!==null))
   fail("BINDING_DENIED");
  return JSON.stringify({scope:{jobId:s.jobId,caseId:s.caseId,workspaceId:s.workspaceId,
   expectedRevision:s.expectedRevision,workerId:s.workerId,leaseExpiresAt:s.leaseExpiresAt},
   resource:b.resource,requestSha256:b.requestSha256,accountFingerprint:b.accountFingerprint,model:b.model});
 }
 function validated(raw:unknown,b:Binding,body:string):ResourceQuote|null{
  if(raw===null)return null;
  const q=raw as ResourceQuote;
  if(!q||q.resource!==b.resource||q.requestSha256!==b.requestSha256||q.bindingSha256!==hash(body)||
   !Number.isSafeInteger(q.policyRevision)||q.policyRevision<1||
   !Number.isSafeInteger(q.units)||q.units<1||q.units>100000000000||
   typeof q.validUntil!=="string"||!Number.isFinite(Date.parse(q.validUntil))||
   Date.parse(q.validUntil)<=now()||Date.parse(q.validUntil)>Date.parse(b.scope.leaseExpiresAt)||
   q.model!==b.model)fail("QUOTE_UNCONFIRMED");
  if(b.resource==="anthropic"){
   if(q.maximumCostMicrousd!==q.units||typeof q.pricingRef!=="string"||
    !/^[A-Za-z0-9._:/-]{8,200}$/.test(q.pricingRef)||
    !Number.isSafeInteger(q.maxInputTokens)||q.maxInputTokens!<1||q.maxInputTokens!>1000000||
    q.maxOutputTokens!==2500)fail("QUOTE_UNCONFIRMED");
  }else if(q.maximumCostMicrousd!==0||q.pricingRef!==null||q.maxInputTokens!==null||q.maxOutputTokens!==null||
   q.units!==(b.resource==="native_https"?2000000:120))fail("QUOTE_UNCONFIRMED");
  return Object.freeze({...q});
 }
 const quote=async(b:Binding)=>{
  const body=descriptor(b);return validated(await call("mizizi_quote_desk_resource_v1",{p_binding_text:body}),b,body);
 };
 const reserve=async(b:Binding,q:ResourceQuote):Promise<ResourceReservation|null>=>{
  const body=descriptor(b);
  if(q.bindingSha256!==hash(body)||q.requestSha256!==b.requestSha256||q.resource!==b.resource||
    Date.parse(q.validUntil)<=now())fail("QUOTE_BINDING_DENIED");
  const raw=await call("mizizi_reserve_desk_resource_v1",{p_binding_text:body,p_policy_revision:q.policyRevision,p_expected_units:q.units});
  const receipt=validated(raw,b,body);
  if(!receipt)return null;
  const id=(raw as ResourceReservation).reservationId;
  if(!UUID.test(id)||receipt.policyRevision!==q.policyRevision||receipt.units!==q.units||
    receipt.pricingRef!==q.pricingRef||receipt.maxInputTokens!==q.maxInputTokens||
    receipt.maxOutputTokens!==q.maxOutputTokens)fail("RESERVATION_UNCONFIRMED");
  return Object.freeze({...receipt,reservationId:id});
 };
 async function consume(r:Readonly<{reservationId:string;requestSha256:string}>,accountFingerprint:string){
  if(!UUID.test(r.reservationId)||!SHA.test(r.requestSha256)||!SHA.test(accountFingerprint))fail("RESERVATION_DENIED");
  return await call("mizizi_consume_desk_resource_v1",{p_reservation_id:r.reservationId,
    p_request_sha256:r.requestSha256,p_account_fingerprint:accountFingerprint})===true;
 }
 async function recordEvent(r:Readonly<{reservationId:string;requestSha256:string}>,accountFingerprint:string,state:string,detail:Record<string,unknown>){
  if(!UUID.test(r.reservationId)||!SHA.test(r.requestSha256)||!SHA.test(accountFingerprint))fail("EVENT_BINDING_DENIED");
  if(await call("mizizi_record_desk_resource_event_v1",{p_reservation_id:r.reservationId,
   p_request_sha256:r.requestSha256,p_account_fingerprint:accountFingerprint,p_state:state,p_detail:detail})!==true)
   fail("EVENT_UNCONFIRMED");
 }
 /** Model quote is based on verified full model context, not user/model
  * estimates; conservative ceiling can deny a small pass. No body leaves
  * this process for budget accounting, just the exact fingerprint. */
 function modelFinance(credential:Readonly<{apiKey:string;workspaceId?:string}>):ModelFinance{
  if(typeof credential?.apiKey!=="string"||credential.apiKey.length<12)fail("CREDENTIAL_DENIED");
  const accountFingerprint=hash(JSON.stringify(["mizizi:anthropic:credential:v1",credential.workspaceId??null,credential.apiKey]));
  const binding=(b:Parameters<ModelFinance["quote"]>[0]):Binding=>{
   if(b.credentialSha256!==accountFingerprint||
    b.requestSha256!==hash(JSON.stringify({scope:b.scope,round:b.round,credentialSha256:accountFingerprint,bodySha256:b.bodySha256})))
    fail("MODEL_ENVELOPE_BINDING_DENIED");
   return {scope:b.scope,resource:"anthropic",requestSha256:b.requestSha256,accountFingerprint,model:b.model};
  };
  return {
   quote:async(b,body)=>{
    if(hash(body)!==b.bodySha256||Buffer.byteLength(body)!==b.requestBytes)fail("MODEL_ENVELOPE_BINDING_DENIED");
    const q=await quote(binding(b));return q as Awaited<ReturnType<ModelFinance["quote"]>>;
   },
   reserve:async(b,q)=>{
    const d=binding(b),full=q as ResourceQuote;
    // The DB recomputes quote, revision, rates and totals atomically.
    const r=await reserve(d,full);return r as Awaited<ReturnType<ModelFinance["reserve"]>>;
   },
   consume:r=>consume(r,accountFingerprint),
   recordModelEvent:async e=>{
    if(e.responseModel!==undefined&&(e.state!=="response_metered"||!e.usage||
     typeof e.responseModel!=="string"||!/^[A-Za-z0-9._:-]{3,100}$/.test(e.responseModel)))
     fail("MODEL_RESPONSE_PROOF_DENIED");
    await recordEvent(e,accountFingerprint,e.state,e.usage?{...e.usage,
     ...(e.responseModel===undefined?{}:{responseModel:e.responseModel})}:{});
    if(e.state!=="response_metered"||e.responseModel===undefined)return;
    const units=await call("mizizi_read_desk_resource_encumbrance_v1",{
     p_reservation_id:e.reservationId,p_request_sha256:e.requestSha256,p_account_fingerprint:accountFingerprint});
    if(typeof units!=="number"||!Number.isSafeInteger(units)||units<1)fail("METERED_READBACK_UNCONFIRMED");
    return units;
   }
  };
 }
 /** Native hop: precharge 2 MB capacity and consume before the HTTP read.
  * This is not DNS/egress/robots authorization or a network byte meter. */
 function nativePrecharge(accountFingerprint:string){
  if(!SHA.test(accountFingerprint))fail("ALLOCATION_DENIED");
  return async(scope:DeskSearchScopeV1,target:Readonly<{url:string;hostname:string;address:string}>,
   _authority:unknown)=>{
   const b:Binding={scope,resource:"native_https",accountFingerprint,model:null,
    requestSha256:hash(JSON.stringify({scope,target}))};
   const q=await quote(b);if(!q)return false;
   const r=await reserve(b,q);return r?consume(r,accountFingerprint):false;
  };
 }
 /** Browser lifecycle adapter preserves unknown usage; no release or refund.
  * Actual remote isolation and entitlement must be independently established. */
 function browserFinance(accountFingerprint:string){
  if(!SHA.test(accountFingerprint))fail("ALLOCATION_DENIED");
  return {
   reserve:async(b:Readonly<{scope:DeskSearchScopeV1;accountFingerprint:string;reserveSeconds:number}>,digest:string,_authority:unknown)=>{
    if(b.accountFingerprint!==accountFingerprint||b.reserveSeconds!==120||hash(JSON.stringify(b))!==digest)
     fail("BROWSER_BINDING_DENIED");
    const d:Binding={scope:b.scope,resource:"cloudflare_browser_run",accountFingerprint,model:null,requestSha256:digest};
    const q=await quote(d);if(!q)return null;
    const r=await reserve(d,q);return r?{...r,provider:"cloudflare_browser_run",seconds:120,maximumIncrementalCostMicrousd:0}:null;
   },
   consume:(r:ResourceReservation)=>consume(r,accountFingerprint),
   recordLifecycle:(e:Readonly<{reservationId:string;requestSha256:string;state:string;sessionId?:string}>)=>
    recordEvent(e,accountFingerprint,e.state,e.sessionId?{sessionId:e.sessionId}:{})
  };
 }
 /** Local browser uses a separately reviewed fixed-capacity allocation,
  * not a Cloudflare entitlement or an assumption that compute is free. */
 function localBrowserFinance(accountFingerprint:string){
  if(!SHA.test(accountFingerprint))fail("ALLOCATION_DENIED");
  return {
   reserve:async(b:Readonly<{scope:DeskSearchScopeV1;accountFingerprint:string;reserveSeconds:number;mode:string}>,digest:string)=>{
    if(b.accountFingerprint!==accountFingerprint||b.reserveSeconds!==120||b.mode!=="interactive"||
     Object.keys(b).sort().join(",")!=="accountFingerprint,mode,reserveSeconds,scope"||hash(JSON.stringify(b))!==digest)
     fail("BROWSER_BINDING_DENIED");
    const d:Binding={scope:b.scope,resource:"local_chromium",accountFingerprint,model:null,requestSha256:digest};
    const q=await quote(d);if(!q)return null;
    const r=await reserve(d,q);return r?{...r,provider:"local_chromium",seconds:120,maximumIncrementalCostMicrousd:0}:null;
   },
   consume:(r:ResourceReservation)=>consume(r,accountFingerprint),
   recordLifecycle:(e:Readonly<{reservationId:string;requestSha256:string;state:string;sessionId?:string}>)=>
    recordEvent(e,accountFingerprint,e.state,e.sessionId?{sessionId:e.sessionId}:{}),
   readSession:async(scope:DeskSearchScopeV1,r:Readonly<{reservationId:string;requestSha256:string}>,sessionId:string)=>{
    if(!UUID.test(r.reservationId)||!SHA.test(r.requestSha256)||!UUID.test(sessionId))fail("BROWSER_BINDING_DENIED");
    const raw=await call("mizizi_read_desk_local_browser_session_v1",{p_scope:scope,p_reservation_id:r.reservationId,
     p_request_sha256:r.requestSha256,p_session_id:sessionId});
    if(raw===null)return null;
    const v=raw as {scope:DeskSearchScopeV1;resource:string;accountFingerprint:string;reservationId:string;requestSha256:string;sessionId:string;validUntil:string};
    if(v.resource!=="local_chromium"||v.accountFingerprint!==accountFingerprint||
     v.reservationId!==r.reservationId||v.requestSha256!==r.requestSha256||v.sessionId!==sessionId||
     !v.scope||Object.keys(scope).some(k=>v.scope[k as keyof DeskSearchScopeV1]!==scope[k as keyof DeskSearchScopeV1])||
     !Number.isFinite(Date.parse(v.validUntil))||Date.parse(v.validUntil)<=now()||
     Date.parse(v.validUntil)>Date.parse(scope.leaseExpiresAt))fail("BROWSER_SESSION_UNCONFIRMED");
    return Object.freeze({...v,scope:Object.freeze({...scope})});
   }
  };
 }
 /** Distinct exact browser resource precharge, not interchangeable with a
  * native page hop or another session/call. Same byte-capacity ledger. */
 function browserResourcePrecharge(accountFingerprint:string){
  if(!SHA.test(accountFingerprint))fail("ALLOCATION_DENIED");
  return async(b:Readonly<{scope:DeskSearchScopeV1;target:Readonly<{url:string;hostname:string;address:string}>;
   sessionId:string;callSha256:string;resourceRequestSha256:string}>,digest:string)=>{
   if(!UUID.test(b.sessionId)||!SHA.test(b.callSha256)||!SHA.test(b.resourceRequestSha256)||
    hash(JSON.stringify(b))!==digest)fail("BROWSER_RESOURCE_BINDING_DENIED");
   const d:Binding={scope:b.scope,resource:"native_https",accountFingerprint,model:null,requestSha256:digest};
   const q=await quote(d);if(!q)return false;
   const r=await reserve(d,q);return r?consume(r,accountFingerprint):false;
  };
 }
 return Object.freeze({modelFinance,nativePrecharge,browserFinance,localBrowserFinance,browserResourcePrecharge});
}

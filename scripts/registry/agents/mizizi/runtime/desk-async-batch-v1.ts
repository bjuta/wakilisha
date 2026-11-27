/** Exact, restartable opening-question batch transport. No tool execution,
 * arbitrary endpoint, source disclosure, new job queue, or unreserved POST.
 * The existing worker reclaims its job; only the provider result is polled.
 * A lost POST acknowledgement remains encumbered and cannot be retried.
 */
import {createHash} from "node:crypto";
import type {WorkerRpc} from "./research-worker-cycle-v1.ts";
import type {DeskAnthropicOptionsV1} from "./desk-anthropic-tool-loop-v1.ts";
type Binding=Parameters<DeskAnthropicOptionsV1["authorizeEnvelope"]>[0];
type Reservation=NonNullable<Awaited<ReturnType<DeskAnthropicOptionsV1["reserve"]>>>;
type Usage={inputTokens:number;outputTokens:number;cacheCreationTokens:number;cacheReadTokens:number};
type Active={state:"pending"|"metered";reservationId:string;originalRequestSha256:string;
 providerBatchId:string;bodySha256:string;model:string;maxInputTokens:number;maxOutputTokens:number;
 maximumCostMicrousd:number;resultSha256:string|null};
type BatchState=Active|{state:"available"|"disabled"};
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{64}$/;
const ID=/^msgbatch_[A-Za-z0-9_-]{1,128}$/;
const BASE="https://api.anthropic.com/v1/messages/batches";
const hash=(v:string)=>createHash("sha256").update(v,"utf8").digest("hex");
const fail=(code:string):never=>{throw Error("MIZIZI_DESK_BATCH_"+code);};
const record=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=="object"||Array.isArray(v))return fail("RESPONSE_INVALID");
 return v as Record<string,unknown>;
};
async function bounded(response:Response,max=180000){
 if(!response.ok||!response.body)fail("PROVIDER_UNCONFIRMED");
 const reader=response.body!.getReader(),chunks:Uint8Array[]=[];
 let n=0;
 try{while(true){const chunk=await reader.read();if(chunk.done)break;
  n+=chunk.value.length;if(n>max){await reader.cancel();fail("RESPONSE_BOUND");}chunks.push(chunk.value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(chunks,n).toString("utf8");
}
function parse(text:string){try{return record(JSON.parse(text));}catch{return fail("RESPONSE_INVALID");}}
function usageOf(payload:Record<string,unknown>,state:Active):Usage{
 const u=record(payload.usage),v=[u.input_tokens,u.output_tokens,u.cache_creation_input_tokens??0,u.cache_read_input_tokens??0];
 if(v.some(n=>typeof n!=="number"||!Number.isSafeInteger(n)||n<0))fail("USAGE_UNCONFIRMED");
 const [inputTokens,outputTokens,cacheCreationTokens,cacheReadTokens]=v as number[];
 if(inputTokens+cacheCreationTokens+cacheReadTokens>state.maxInputTokens||outputTokens>state.maxOutputTokens||
  inputTokens+outputTokens+cacheCreationTokens+cacheReadTokens<1)fail("USAGE_OUTSIDE_RESERVATION");
 return {inputTokens,outputTokens,cacheCreationTokens,cacheReadTokens};
}
export function createDeskAsyncOpeningBatchV1(options:Readonly<{rpc:WorkerRpc;
 credential:{apiKey:string;workspaceId?:string};transport?:typeof fetch;now?:()=>number}>){
 const {rpc,credential}=options,send=options.transport??fetch,now=options.now??Date.now;
 if(typeof rpc!=="function"||typeof credential?.apiKey!=="string"||credential.apiKey.length<12||
  credential.apiKey.trim()!==credential.apiKey||
  (credential.workspaceId&&!/^wrkspc_[A-Za-z0-9]{8,100}$/.test(credential.workspaceId)))fail("CONFIGURATION_DENIED");
 const account=hash(JSON.stringify(["mizizi:anthropic:credential:v1",credential.workspaceId??null,credential.apiKey]));
 const headers={"x-api-key":credential.apiKey,"anthropic-version":"2023-06-01","Content-Type":"application/json",
  ...(credential.workspaceId?{"anthropic-workspace-id":credential.workspaceId}:{})};
 const call=async(fn:string,args:Record<string,unknown>)=>{
  const reply=await rpc(fn,args);if(!reply||reply.error)fail("RPC_UNCONFIRMED");return reply.data;
 };
 const check=(b:Binding,body?:string)=>{
  if(b.round!==1||b.sourceIds.length||b.toolReceipts.length||b.credentialSha256!==account||
   !SHA.test(b.bodySha256)||!SHA.test(b.requestSha256)||b.maxOutputTokens!==2500||
   !UUID.test(b.scope.jobId)||Date.parse(b.scope.leaseExpiresAt)<=now()||
   b.requestSha256!==hash(JSON.stringify({scope:b.scope,round:b.round,credentialSha256:account,bodySha256:b.bodySha256})))
   fail("BINDING_DENIED");
  if(body!==undefined&&(hash(body)!==b.bodySha256||Buffer.byteLength(body)!==b.requestBytes))fail("BODY_DENIED");
 };
 const lookup=async(b:Binding):Promise<BatchState>=>{
  check(b);
  const raw=await call("mizizi_read_desk_async_batch_v1",{p_scope:b.scope,p_question_sha256:hash(b.question),
   p_body_sha256:b.bodySha256,p_model:b.model,p_account_fingerprint:account});
  const row=record(raw);
  if(row.state==="available"||row.state==="disabled")return {state:row.state};
  if(row.state==="uncertain"||row.state==="blocked")fail(row.state==="uncertain"?"SEND_UNCONFIRMED":"AUTHORITY_CHANGED");
  const a=row as unknown as Active;
  if(!["pending","metered"].includes(a.state)||!UUID.test(a.reservationId)||!SHA.test(a.originalRequestSha256)||
   !ID.test(a.providerBatchId)||a.bodySha256!==b.bodySha256||a.model!==b.model||
   !Number.isSafeInteger(a.maxInputTokens)||a.maxInputTokens<1||a.maxInputTokens>1000000||a.maxOutputTokens!==2500||
   !Number.isSafeInteger(a.maximumCostMicrousd)||a.maximumCostMicrousd<1||
   (a.state==="metered"?!SHA.test(a.resultSha256??""):a.resultSha256!==null))fail("STATE_UNCONFIRMED");
  return a;
 };
 const event=async(reservationId:string,state:string,batchId:string|null,resultSha256:string|null,usage:Usage|Record<string,never>)=>{
  if(await call("mizizi_record_desk_async_batch_v1",{p_reservation_id:reservationId,p_account_fingerprint:account,
   p_state:state,p_provider_batch_id:batchId,p_result_sha256:resultSha256,p_usage:usage})!==true)fail("EVENT_UNCONFIRMED");
 };
 const request=async(url:string,method:"GET"|"POST",body?:string)=>{
  // All URLs are constructed from the fixed endpoint and validated ID.
  return send(url,{method,redirect:"error",headers,...(body===undefined?{}:{body}),
   signal:AbortSignal.timeout(20000)});
 };
 const poll=async(b:Binding,a:Active):Promise<{payload:Record<string,unknown>;usage:Usage;reservedMicrousd:number}>=>{
  check(b);
  let status:Record<string,unknown>,raw:string;
  try{
   status=parse(await bounded(await request(BASE+"/"+a.providerBatchId,"GET")));
   if(status.id!==a.providerBatchId)fail("PROVIDER_ID_MISMATCH");
   if(status.processing_status==="in_progress"||status.processing_status==="canceling")fail("PENDING");
   if(status.processing_status!=="ended")fail("RESPONSE_INVALID");
   // Never use a provider-supplied results URL or follow a redirect.
   raw=await bounded(await request(BASE+"/"+a.providerBatchId+"/results","GET"));
  }catch(error){
   if(error instanceof Error&&error.message==="MIZIZI_DESK_BATCH_PROVIDER_ID_MISMATCH")throw error;
   fail("PENDING");
  }
  const lines=raw!.trim().split(/\r?\n/);
  if(lines.length!==1)fail("RESULT_PARTITION_DENIED");
  const row=parse(lines[0]),result=record(row.result);
  if(row.custom_id!==a.reservationId)fail("RESULT_ID_DENIED");
  if(["errored","canceled","expired"].includes(String(result.type))){
   await event(a.reservationId,"unconfirmed",a.providerBatchId,null,{});
   fail("TERMINAL_UNCONFIRMED");
  }
  if(result.type!=="succeeded")fail("RESULT_INVALID");
  const payload=record(result.message);
  if(payload.model!==a.model)fail("RESULT_MODEL_DENIED");
  const usage=usageOf(payload,a),digest=hash(lines[0]);
  if(a.state==="metered"&&a.resultSha256!==digest)fail("RESULT_CHANGED");
  await event(a.reservationId,"metered",a.providerBatchId,digest,usage);
  check(b);const fresh=await lookup(b);
  if(fresh.state!=="metered"||fresh.resultSha256!==digest||fresh.reservationId!==a.reservationId)fail("AUTHORITY_CHANGED");
  return {payload,usage,reservedMicrousd:a.maximumCostMicrousd};
 };
 const submit=async(b:Binding,body:string,reservation:Reservation):Promise<never>=>{
  check(b,body);
  if(!UUID.test(reservation.reservationId)||reservation.requestSha256!==b.requestSha256||
   Date.parse(reservation.validUntil)<=now())fail("RESERVATION_DENIED");
  // This adapter is called only after the ordinary exact-body verifier,
  // quote/reserve/consume, send_pending, and fresh disclosure checks.
  const {question,...rest}=b,bindingText=JSON.stringify({...rest,questionSha256:hash(question)});
  if(await call("mizizi_begin_desk_async_batch_v1",{p_scope:b.scope,p_binding_text:bindingText,
   p_binding_sha256:hash(bindingText),p_reservation_id:reservation.reservationId})!==true)fail("SEND_INTENT_DENIED");
  // Never send again after the durable intent, even if the POST times out.
  let id:string;
  try{
   check(b,body);
   if(Date.parse(reservation.validUntil)<=now())fail("RESERVATION_EXPIRED");
   const received=parse(await bounded(await request(BASE,"POST",JSON.stringify({requests:[{
    custom_id:reservation.reservationId,params:JSON.parse(body)}]}))));
   if(typeof received.id!=="string"||!ID.test(received.id)||
    !["in_progress","canceling","ended"].includes(String(received.processing_status)))fail("POST_UNCONFIRMED");
   id=received.id;
  }catch{
   await event(reservation.reservationId,"unconfirmed",null,null,{});
   fail("SEND_UNCONFIRMED");
  }
  await event(reservation.reservationId,"accepted",id!,null,{});
  return fail("PENDING");
 };
 return Object.freeze({lookup,poll,submit});
}
export type DeskAsyncOpeningBatchV1=ReturnType<typeof createDeskAsyncOpeningBatchV1>;

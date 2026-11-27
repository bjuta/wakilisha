/** One source-first discovery-only pass. Search metadata is a lead, never
 * recording evidence. All calls use existing lease-bound tool authorization,
 * zero-incremental-cost search reservation, custody and durable readback. */
import {createHash} from "node:crypto";
import type {PreparedDeskPassV1} from "./adaptive-investigation-v1.ts";
import type {DeskSearchScopeV1} from "./desk-research-gateway-v1.ts";
import type {DeskAnthropicOptionsV1,DeskToolCallV1} from "./desk-anthropic-tool-loop-v1.ts";
const hash=(s:string)=>createHash("sha256").update(s,"utf8").digest("hex");
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const fail=(code:string):never=>{throw Error("MIZIZI_DESK_DISCOVERY_ONLY_"+code);};
export const DISCOVERY_ONLY_METHOD_V1="mizizi.deterministic_discovery_only.v1";
export async function runDeskDiscoveryOnlyPassV1(input:Readonly<{
 scope:DeskSearchScopeV1;query:string;operation:"search_web"|"search_news";
 authorizeTool:DeskAnthropicOptionsV1["authorizeTool"];
 executeTool:DeskAnthropicOptionsV1["executeTool"];
 verifyToolReceipt:DeskAnthropicOptionsV1["verifyToolReceipt"];now?:()=>number;
}>):Promise<PreparedDeskPassV1>{
 const {scope,query,operation}=input,now=input.now??Date.now;
 const live=()=>{if(!Number.isFinite(Date.parse(scope.leaseExpiresAt))||Date.parse(scope.leaseExpiresAt)<=now())fail("LEASE_EXPIRED");};
 if(!["search_web","search_news"].includes(operation)||typeof query!=="string"||query.length<3||query.length>300||
  query.trim()!==query||/[\p{Cc}\p{Cf}]/u.test(query))fail("QUERY_DENIED");
 live();
 const call:DeskToolCallV1={name:operation,input:{query}},callSha256=hash(JSON.stringify({scope,call}));
 if(await input.authorizeTool(scope,call,callSha256)!==true)fail("AUTHORITY_DENIED");
 live();
 const result=await input.executeTool(scope,call,callSha256);
 live();
 if(!result||!UUID.test(result.receiptId)||!Array.isArray(result.leads)||result.leads.length>20||
  !Array.isArray(result.sources)||result.sources.length!==0||result.visual||
  result.leads.some(l=>!l||!UUID.test(l.id)||l.kind!=="reference"||typeof l.label!=="string"||!l.label.trim()||l.label.length>500)||
  new Set(result.leads.map(l=>l.id)).size!==result.leads.length)fail("RESULT_DENIED");
 const resultSha256=hash(JSON.stringify({receiptId:result.receiptId,leads:result.leads,sources:[],visual:null}));
 const receipt=Object.freeze({receiptId:result.receiptId,callSha256,resultSha256});
 if(await input.verifyToolReceipt(scope,receipt,result)!==true)fail("RECEIPT_DENIED");
 if(await input.authorizeTool(scope,call,callSha256)!==true)fail("AUTHORITY_CHANGED");
 live();
 return {method:"discovery_only",sources:[],deskToolReceipts:[receipt],costUnits:0,analysis:{
  hypotheses:[],leads:[],requestedDisposition:"pause",modelVersion:DISCOVERY_ONLY_METHOD_V1,
  promptFingerprint:hash(DISCOVERY_ONLY_METHOD_V1),
  passFinding:result.leads.length?
   "Authorized discovery recorded "+result.leads.length+" unverified reference leads; no source content or recording claim was established.":
   "Authorized discovery returned no reference leads; absence cannot establish that a cultural claim is false."
 }};
}

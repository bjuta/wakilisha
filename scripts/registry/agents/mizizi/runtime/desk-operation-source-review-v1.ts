/** Source-class interpretation qualification for the existing leased desk.
 * An owner's current standing revision records TWO independent artifact
 * fingerprints; this pure validator cannot issue grants or discover rights.
 * Each allowed route must represent a separately reviewed source-use class.
 * Default Anthropic 30-day retention is explicit; ZDR is never inferred.
 */
import {createHash} from "node:crypto";
import type {DeskSearchScopeV1} from "./desk-research-gateway-v1.ts";
import type {SourceInterpretationScopeV1,SourceInterpretationReviewV1} from "./desk-research-dispatcher-v1.ts";

export type DeskOperationReviewsV1=Readonly<{
 sourceUse:Readonly<{contract:"mizizi.desk_reviewed_source_use_v1";
  reviewRef:string;reviewedBy:string;reviewedAt:string;validUntil:string;
  routes:readonly Readonly<{host:string;pathPrefix:string;
   methods:readonly SourceInterpretationScopeV1["method"][];
   contentClass:"licensed_original_text"|"licensed_visual";
   rightsRef:string;termsRef:string}>[]}>;
 providerHandling:Readonly<{contract:"mizizi.desk_reviewed_provider_handling_v1";
  provider:"anthropic";retentionMode:"standard_30_day";retentionDays:30;
  credentialSha256:string;reviewRef:string;reviewedBy:string;
  reviewedAt:string;validUntil:string;termsRef:string}>;
}>;
export type CurrentDeskOperationReviewPolicyV1=Readonly<{
 scope:DeskSearchScopeV1;revision:number;credentialSha256:string;validUntil:string;
 operationInterpretationRule?:Readonly<{kind:string;operations:readonly string[];
  credentialSha256:string;sourceUseRef:string;providerProcessingRef:string}>|null;
}>;
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const clean=(s:unknown):s is string=>typeof s==="string"&&s.length>=8&&s.length<=500&&s.trim()===s&&!/[\p{Cc}\p{Cf}]/u.test(s);
const terms=(s:unknown)=>{if(!clean(s))return false;try{
 const u=new URL(s);return u.protocol==="https:"&&u.href===s&&!u.username&&!u.password&&!u.port&&!u.hash&&
  /^[a-z0-9.-]+$/.test(u.hostname)&&u.hostname.includes(".")&&!u.hostname.includes("..");
 }catch{return false;}};
/** Deterministic cross-runtime digest; route/review JSON key order cannot
 * change the bound reference. This proves artifact identity, not its truth. */
export function deskReviewDigestV1(value:unknown):string{
 return sha(JSON.stringify(value,(_key,v)=>v&&typeof v==="object"&&!Array.isArray(v)?
  Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v));
}
export function qualifyDeskOperationSourceReviewV1(
 reviews:DeskOperationReviewsV1|null|undefined,b:SourceInterpretationScopeV1,
 p:CurrentDeskOperationReviewPolicyV1|null,now:number
):SourceInterpretationReviewV1|null{
 const s=reviews?.sourceUse,h=reviews?.providerHandling,r=p?.operationInterpretationRule;
 if(!s||!h||!p||!r||!b||!b.scope||!p.scope||!Number.isFinite(now)||
  s.contract!=="mizizi.desk_reviewed_source_use_v1"||
  h.contract!=="mizizi.desk_reviewed_provider_handling_v1"||
  h.provider!=="anthropic"||h.retentionMode!=="standard_30_day"||h.retentionDays!==30||
  !/^[a-f0-9]{64}$/.test(h.credentialSha256)||h.credentialSha256!==b.credentialSha256||
  r.kind!=="bounded_public_research_v1"||r.credentialSha256!==b.credentialSha256||
  b.sourceUseRef!=="desk-source-review:sha256:"+deskReviewDigestV1(s)||
  b.providerProcessingRef!=="desk-provider-review:sha256:"+deskReviewDigestV1(h)||
  r.sourceUseRef!==b.sourceUseRef||r.providerProcessingRef!==b.providerProcessingRef||
  p.credentialSha256!==b.credentialSha256||p.revision!==b.standingRevision||
  Object.keys(b.scope).some(k=>p.scope[k as keyof DeskSearchScopeV1]!==b.scope[k as keyof DeskSearchScopeV1])||
  !Array.isArray(r.operations)||!r.operations.includes(b.method)||
  ![s.reviewRef,s.reviewedBy,h.reviewRef,h.reviewedBy].every(clean)||!terms(h.termsRef)||
  !Array.isArray(s.routes)||s.routes.length<1||s.routes.length>24)return null;
 const observed=Math.max(Date.parse(s.reviewedAt),Date.parse(h.reviewedAt));
 const expiry=Math.min(Date.parse(s.validUntil),Date.parse(h.validUntil),Date.parse(p.validUntil),Date.parse(b.scope.leaseExpiresAt));
 if(!Number.isFinite(observed)||observed>now||!Number.isFinite(expiry)||expiry<=now||
  expiry<Date.parse(b.scope.leaseExpiresAt))return null;
 let u:URL;try{u=new URL(b.url);}catch{return null;}
 if(u.href!==b.url||u.protocol!=="https:"||u.username||u.password||u.port||u.hash||u.search||
  !/^[a-z0-9.-]+$/.test(u.hostname)||!u.hostname.includes(".")||/%(?:2e|2f|5c|25)/i.test(u.pathname))return null;
 const legal=["native_text","browser_text","pdf_visual","browser_visual"];
 const visual=b.method==="pdf_visual"||b.method==="browser_visual";
 const candidates=s.routes.filter(x=>x&&x.host===u.hostname&&
  typeof x.pathPrefix==="string"&&x.pathPrefix.length>=3&&x.pathPrefix.length<=160&&
  /^\/[A-Za-z0-9_./~-]+\/$/.test(x.pathPrefix)&&
  !x.pathPrefix.split("/").some(y=>y==="."||y==="..")&&u.pathname.startsWith(x.pathPrefix)&&
  Array.isArray(x.methods)&&x.methods.length>0&&x.methods.length<=4&&
  x.methods.length===new Set(x.methods).size&&x.methods.every(m=>legal.includes(m))&&
  x.methods.includes(b.method)&&x.contentClass===(visual?"licensed_visual":"licensed_original_text")&&
  clean(x.rightsRef)&&terms(x.termsRef));
 if(candidates.length!==1)return null;
 return {...b,allowed:true,reviewRef:s.reviewRef,reviewedAt:new Date(observed).toISOString(),
  validUntil:new Date(expiry).toISOString()};
}

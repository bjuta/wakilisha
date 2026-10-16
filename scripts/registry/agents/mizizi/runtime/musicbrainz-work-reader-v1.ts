/** Permission-gated core Work metadata reader. NOT wired into the live
 * MIZIZI worker until a commercial MusicBrainz API agreement is evidenced.
 * One pre-authorized Work locator, one global rate slot, one bounded request.
 * Never treat another community database as independently verified rights.
 */
import {createHash} from "node:crypto";
import type {InvestigationIdentityV1,InvestigationReaderV1,
 SourceAuthorityV1,SourceExcerptV1} from "./adaptive-investigation-v1.ts";

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ISWC=/^T-[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]$/;
const HOST="https://musicbrainz.org";
const MAX_BODY=20000;
const CORE_FIELDS=["id","title","type","iswcs"] as const;
const LINEAGE="musicbrainz:community-core-work-data";

export type MusicBrainzWorkAuthorityV1=Readonly<{
 contractReference:string;
 commercialApiAccessAllowed:boolean;
 coreDataOnly:boolean;
 privateResearchAllowed:boolean;
 externalModelProcessingAllowed:boolean;
 privateEvidenceRetentionAllowed:boolean;
 expiresAt:string|null;revokedAt:string|null;
}>;
export type MusicBrainzWorkReadOptionsV1=Readonly<{
 /** A trusted case binding, not an analyst-supplied URL or search term. */
 workId:string;
 authorizeCommercialAccess:(identity:InvestigationIdentityV1,workId:string)=>
  Promise<MusicBrainzWorkAuthorityV1|null>;
 /** Must acquire one slot from a SHARED cross-worker <=1 request/s limiter.
  * Returning true without a real shared slot is not deployment authority. */
 acquireSharedRateSlot:(workId:string)=>Promise<boolean>;
 transport?:typeof fetch;now?:()=>number;
}>;

function sourceUuid(key:string):string{
 const v=createHash("sha256").update(key).digest("hex").slice(0,32).split("");
 v[12]="5";v[16]="89ab"[parseInt(v[16],16)%4];
 return [v.slice(0,8).join(""),v.slice(8,12).join(""),
  v.slice(12,16).join(""),v.slice(16,20).join(""),
  v.slice(20).join("")].join("-");
}
function approved(a:MusicBrainzWorkAuthorityV1|null,now:number):a is MusicBrainzWorkAuthorityV1{
 return !!a&&typeof a.contractReference==="string"&&
  /^contract:[A-Za-z0-9._:-]{8,200}$/.test(a.contractReference)&&
  a.commercialApiAccessAllowed===true&&a.coreDataOnly===true&&
  a.privateResearchAllowed===true&&a.externalModelProcessingAllowed===true&&
  a.privateEvidenceRetentionAllowed===true&&a.revokedAt===null&&
  (a.expiresAt===null||(typeof a.expiresAt==="string"&&
    Number.isFinite(Date.parse(a.expiresAt))&&Date.parse(a.expiresAt)>now));
}
/** Return nothing without a distinct, current permission receipt.
 * A query may guide the investigator but MUST NOT become an external search.
 */
export function createMusicBrainzWorkReaderV1(
 options:MusicBrainzWorkReadOptionsV1
):InvestigationReaderV1{
 if(!UUID.test(options?.workId)||typeof options.authorizeCommercialAccess!=="function"||
   typeof options.acquireSharedRateSlot!=="function")
  throw new TypeError("MIZIZI_MUSICBRAINZ_INVALID_TRUSTED_CONFIG");
 const workId=options.workId.toLowerCase();
 const transport=options.transport??fetch,now=options.now??Date.now;
 return async(identity,_question,_history):Promise<readonly SourceExcerptV1[]>=>{
  if(!UUID.test(identity?.caseId)||!UUID.test(identity?.workspaceId))
   throw new TypeError("MIZIZI_MUSICBRAINZ_INVALID_CASE_IDENTITY");
  const authority=await options.authorizeCommercialAccess(identity,workId);
  const at=now();
  if(!approved(authority,at))
   throw new Error("MIZIZI_MUSICBRAINZ_COMMERCIAL_SOURCE_PERMISSION_REQUIRED");
  if(await options.acquireSharedRateSlot(workId)!==true)
   throw new Error("MIZIZI_MUSICBRAINZ_SHARED_RATE_SLOT_REQUIRED");
  const url=HOST+"/ws/2/work/"+workId+"?fmt=json";
  let response:Response;
  try{
   response=await transport(url,{
    method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),
    headers:{"Accept":"application/json",
     "User-Agent":"WAKILISHA-MIZIZI/1.0 (https://wakilisha.africa)"}
   });
  }catch{throw new Error("MIZIZI_MUSICBRAINZ_TRANSPORT_UNCONFIRMED");}
  if(response.status===429||response.status===503)
   throw new Error("MIZIZI_MUSICBRAINZ_PROVIDER_RATE_LIMITED");
  if(!response.ok||!/^application\/json\b/i.test(response.headers.get("content-type")||""))
   throw new Error("MIZIZI_MUSICBRAINZ_PROVIDER_UNVERIFIED");
  const length=Number(response.headers.get("content-length")||0);
  if(!Number.isFinite(length)||length>MAX_BODY)
   throw new Error("MIZIZI_MUSICBRAINZ_RESPONSE_TOO_LARGE");
  const raw=await response.text();
  if(raw.length>MAX_BODY)
   throw new Error("MIZIZI_MUSICBRAINZ_RESPONSE_TOO_LARGE");
  let payload:unknown;
  try{payload=JSON.parse(raw);}catch{
   throw new Error("MIZIZI_MUSICBRAINZ_BAD_JSON");
  }
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   throw new Error("MIZIZI_MUSICBRAINZ_BAD_PAYLOAD");
  const p=payload as Record<string,unknown>;
  if(p.id!==workId||typeof p.title!=="string"||
     p.title.length<1||p.title.length>250||/[\u0000-\u001f]/.test(p.title)||
     !(p.type===null||p.type===undefined||
       (typeof p.type==="string"&&p.type.length<=100))||
     !(p.iswcs===undefined||(Array.isArray(p.iswcs)&&p.iswcs.length<=10&&
       p.iswcs.every(s=>typeof s==="string"&&ISWC.test(s)))))
   throw new Error("MIZIZI_MUSICBRAINZ_CORE_WORK_IDENTITY_UNVERIFIED");
  const excerpt=JSON.stringify({
   workId,title:p.title,type:p.type??null,
   iswcsFieldPresent:Object.prototype.hasOwnProperty.call(p,"iswcs"),
   iswcs:p.iswcs??null,inspectedFields:CORE_FIELDS,
   sourceLimit:"Community-contributed Work metadata, not independent rights proof"
  });
  const digest=createHash("sha256").update(excerpt,"utf8").digest("hex");
  const source:SourceAuthorityV1={
   sourceId:sourceUuid("musicbrainz:core:work:v1:"+workId+":"+digest),
   caseId:identity.caseId,workspaceId:identity.workspaceId,
   originKey:"musicbrainz:core:work:"+workId+":fingerprint:"+digest,
   lineageKey:LINEAGE,fingerprint:digest,
   authorityRef:authority.contractReference,useBasis:"documented_contract",
   observedAt:new Date(at).toISOString(),expiresAt:authority.expiresAt,
   revokedAt:null,privateResearchAllowed:true,
   externalModelProcessingAllowed:true,privateEvidenceRetentionAllowed:true
  };
  return [{source,excerpt,citation:HOST+"/work/"+workId}];
 };
}

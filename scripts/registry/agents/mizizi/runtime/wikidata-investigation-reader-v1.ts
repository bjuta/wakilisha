/** MIZIZI: read-only Wikidata structured-data reader. The entity data is
 * CC0, but the API's use and rate limits still apply. This supplies ONE
 * source family: repeating Wikidata records is not corroboration.
 * Query text is never sent externally without separate trusted authorization.
 */
import {createHash} from "node:crypto";
import type {InvestigationReaderV1,InvestigationIdentityV1,SourceExcerptV1,
 SourceAuthorityV1} from "./adaptive-investigation-v1.ts";

const HOST="https://www.wikidata.org";
const API="/w/api.php";
const LICENCE="https://www.wikidata.org/wiki/Wikidata:Licensing";
const CLIENT="WAKILISHA-MIZIZI/1.0 (https://wakilisha.africa)";
const QID=/^Q[1-9][0-9]{0,11}$/;
const MAX_BODY=180000;
// Changing the persisted evidence projection changes the source snapshot ID.
// A prior pass retains its original immutable identity and fingerprint.
const EXCERPT_PROJECTION="wikidata:structured:entity:v2";
const EXCERPT_PROPERTIES=["P31","P175","P86","P676","P264","P155","P156",
 "P361","P577","P483","P434","P435","P1827"] as const;

export type WikidataReadOptionsV1=Readonly<{
 authorizePublicQuery:(identity:InvestigationIdentityV1,question:string)=>Promise<boolean>;
 transport?:typeof fetch;now?:()=>number;
}>;

function sourceUuid(qid:string,revision:number):string{
 const c=createHash("sha256").update(EXCERPT_PROJECTION+":"+qid+":revision:"+revision).digest("hex").slice(0,32).split("");
 c[12]="5";c[16]="89ab"[parseInt(c[16],16)%4];
 return [c.slice(0,8).join(""),c.slice(8,12).join(""),c.slice(12,16).join(""),
 c.slice(16,20).join(""),c.slice(20).join("")].join("-");
}
async function request(url:URL,send:typeof fetch):Promise<Record<string,unknown>>{
 if(url.origin!==HOST||url.pathname!==API)throw new Error("MIZIZI_WIKIDATA_HOST_DENIED");
 // MediaWiki can respond HTTP 200 with error.code='maxlag'. Respect its
 // Retry-After rather than misclassifying database replica lag as bad evidence.
 for(let attempt=0;attempt<3;attempt++){
  let response:Response;
  try{
   response=await send(url.toString(),{
    method:"GET",redirect:"error",
    headers:{Accept:"application/json","User-Agent":CLIENT,"Api-User-Agent":CLIENT,
     "Accept-Encoding":"gzip, deflate"},
    signal:AbortSignal.timeout(16000)
   });
  }catch{throw new Error("MIZIZI_WIKIDATA_UNREACHABLE");}
  if(response.status===429||response.status===503)
   throw new Error("MIZIZI_WIKIDATA_RATE_LIMITED");
  if(!response.ok||!/^application\/json\b/i.test(response.headers.get("content-type")||""))
   throw new Error("MIZIZI_WIKIDATA_PROVIDER_UNVERIFIED");
  const bytes=Number(response.headers.get("content-length"));
  if(Number.isFinite(bytes)&&bytes>MAX_BODY)
   throw new Error("MIZIZI_WIKIDATA_RESPONSE_TOO_LARGE");
  const raw=await response.text();
  if(raw.length>MAX_BODY)throw new Error("MIZIZI_WIKIDATA_RESPONSE_TOO_LARGE");
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new Error("MIZIZI_WIKIDATA_BAD_JSON");}
  if(!value||typeof value!=="object"||Array.isArray(value))
   throw new Error("MIZIZI_WIKIDATA_BAD_PAYLOAD");
  const payload=value as Record<string,unknown>;
  if(payload.error!==undefined){
   const err=payload.error as {code?:unknown}|null;
   const code=typeof err?.code==="string"&&/^[a-z0-9_-]{1,48}$/.test(err.code)
    ?err.code:"unknown";
   if(code==="maxlag"){
    const header=Number(response.headers.get("retry-after")||"5");
    if(!Number.isFinite(header)||header>10||attempt===2)
     throw new Error("MIZIZI_WIKIDATA_MAXLAG_DEFERRED");
    await new Promise<void>(resolve=>setTimeout(resolve,Math.max(5000,header*1000)));
    continue;
   }
   throw new Error("MIZIZI_WIKIDATA_PROVIDER_ERROR_"+code);
  }
  return payload;
 }
 throw new Error("MIZIZI_WIKIDATA_MAXLAG_DEFERRED");
}
function excerpt(entity:Record<string,unknown>,qid:string):string{
 const labels=entity.labels as Record<string,{value?:unknown}>|undefined;
 const descriptions=entity.descriptions as Record<string,{value?:unknown}>|undefined;
 const claims=entity.claims as Record<string,unknown>|undefined;
 const included:Record<string,unknown>={};
 // IDs and reference counts are kept as source data, not asserted truth.
 for(const prop of EXCERPT_PROPERTIES){
  const rows=claims?.[prop];
  if(!Array.isArray(rows))continue;
  included[prop]=rows.slice(0,4).map((r:Record<string,unknown>)=>{
   const snak=(r.mainsnak||{}) as Record<string,unknown>;
   return {id:r.id,rank:r.rank,datatype:snak.datatype,
    datavalue:snak.datavalue,
    referenceCount:Array.isArray(r.references)?r.references.length:0};
  });
 }
 return JSON.stringify({entityId:qid,label:labels?.en?.value??null,
  description:descriptions?.en?.value??null,lastrevid:entity.lastrevid??null,
  projection:EXCERPT_PROJECTION,
  // Only these properties were evaluated. A missing property here does NOT
  // prove that no Work, ISWC, author or right exists in another registry.
  inspectedProperties:EXCERPT_PROPERTIES,
  absentProperties:EXCERPT_PROPERTIES.filter(p=>!Array.isArray(claims?.[p])),
  claims:included});
}
/** A trusted caller must explicitly authorize sharing this case question
 * with external Wikidata search, even when resulting Wikidata data is CC0.
 */
export function createWikidataInvestigationReaderV1(
 config:WikidataReadOptionsV1
):InvestigationReaderV1{
 if(typeof config?.authorizePublicQuery!=="function")
  throw new TypeError("MIZIZI_WIKIDATA_QUERY_AUTHORITY_REQUIRED");
 const send=config.transport??fetch;
 const now=config.now??Date.now;
 return async(identity,question,history)=>{
  if(typeof question!=="string"||question.trim()!==question||
   question.length<12||question.length>500||/[\u0000-\u001f]/.test(question))
   throw new TypeError("MIZIZI_WIKIDATA_INVALID_QUESTION");
  if(await config.authorizePublicQuery(identity,question)!==true)
   throw new Error("MIZIZI_WIKIDATA_PUBLIC_QUERY_NOT_AUTHORIZED");
  // A cultural question is not a useful entity-search term. Prefer an
  // explicitly quoted work, recording or Artist title when present.
  // Never substitute a guessed identity for the actual search result.
  const quoted=question.match(/[“"]([^”"]{3,120})[”"]/);
  // If an autonomous follow-up no longer names the work, retain the
  // original evidence anchor rather than searching a generic whole question.
  // A quoted new entity in the follow-up takes precedence.
  const original=history[0]?.question?.match(/[“"]([^”"]{3,120})[”"]/);
  const searchTerm=quoted?.[1]?.trim()||original?.[1]?.trim()||question;
  // Explicit Wikidata entity IDs are verifiable source locators, not
  // model-chosen network addresses. A follow-up may name another QID.
  // Preserve the opening anchor when a continuation has no explicit ID.
  const referenced=(question.match(/\bQ[1-9][0-9]{0,11}\b/g)||
   history[0]?.question.match(/\bQ[1-9][0-9]{0,11}\b/g)||[]);
  let distinctIds:string[];
  if(referenced.length>0){
   distinctIds=[...new Set(referenced.filter(id=>QID.test(id)))].slice(0,3);
  }else{
   const search=new URL(API,HOST);
   for(const [k,v] of Object.entries({action:"wbsearchentities",search:searchTerm,
    language:"en",format:"json",limit:"3"}))
    search.searchParams.set(k,v);
   const first=await request(search,send);
   if(!Array.isArray(first.search)||first.search.length>5)
    throw new Error("MIZIZI_WIKIDATA_UNBOUNDED_SEARCH");
   const ids=first.search.map(x=>(x as {id?:unknown})?.id)
    .filter((id):id is string=>typeof id==="string"&&QID.test(id));
   distinctIds=[...new Set(ids)].slice(0,3);
  }
  if(distinctIds.length===0)return [];
  const details=new URL(API,HOST);
  for(const [k,v] of Object.entries({action:"wbgetentities",ids:distinctIds.join("|"),
   props:"info|labels|descriptions|claims",languages:"en",
   format:"json"}))
   details.searchParams.set(k,v);
  const second=await request(details,send);
  if(!second.entities||typeof second.entities!=="object"||
   Array.isArray(second.entities))
   throw new Error("MIZIZI_WIKIDATA_ENTITIES_MISSING");
  const found:SourceExcerptV1[]=[];
  for(const qid of distinctIds){
   const raw=(second.entities as Record<string,unknown>)[qid];
   if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
   const entity=raw as Record<string,unknown>;
   if(entity.id!==qid||entity.missing!==undefined)continue;
   const revision=Number(entity.lastrevid);
   if(!Number.isSafeInteger(revision)||revision<=0)
    throw new Error("MIZIZI_WIKIDATA_REVISION_UNVERIFIED");
   const exact=excerpt(entity,qid);
   if(exact.length>5500)throw new Error("MIZIZI_WIKIDATA_ENTITY_BUDGET");
   const source:SourceAuthorityV1={
    sourceId:sourceUuid(qid,revision),caseId:identity.caseId,
    workspaceId:identity.workspaceId,
    originKey:"wikidata:"+qid+":revision:"+revision,
    lineageKey:"wikidata:community-structured-data",
    fingerprint:createHash("sha256").update(exact).digest("hex"),
    authorityRef:LICENCE,useBasis:"open_license",
    observedAt:new Date(now()).toISOString(),expiresAt:null,revokedAt:null,
    privateResearchAllowed:true,externalModelProcessingAllowed:true,
    privateEvidenceRetentionAllowed:true
   };
   found.push({source,excerpt:exact,
    citation:HOST+"/wiki/"+qid+"?oldid="+revision});
  }
  return found;
 };
}

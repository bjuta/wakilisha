/**
 * MIZIZI question-source review queue projection, issue #1247.
 *
 * Reuses research source identity and Registry assertion fingerprints. It does
 * NOT verify source-family independence, custody, lawful use or a human grade.
 * Those permissions must come from future durable, reviewed SQL authority.
 * Every matching source remains pending human evidence review; none can be
 * emitted as an ACH cell, Registry verdict or public record.
 */
import type {SourceAuthorityV1} from "./adaptive-investigation-v1";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const USE=new Set(["first_party","documented_consent","documented_contract","open_license"]);
const uuid=(v:unknown):v is string=>typeof v==="string"&&UUID.test(v);
const digest=(v:unknown):v is string=>typeof v==="string"&&SHA.test(v);
const nonempty=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=300&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const moment=(v:string|null):number|null=>{
 if(v===null)return null;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v))return NaN;
 return Date.parse(v);
};

export type SourceReviewScopeV1=Readonly<{
 workspaceId:string;caseId:string;caseRevision:number;
 subjectType:"artist"|"track"|"release"|"registry_relationship";
 subjectId:string;
}>;
/** A Registry assertion reference, NOT proof of independence or consent. */
export type SourceAssertionRefV1=Readonly<{
 assertionId:string;subjectType:SourceReviewScopeV1["subjectType"];
 subjectId:string;sourceId:string;assertionFingerprint:string;
 sourceUseBasis:string|null;lineageKey:string|null;
 independenceGroupHint:string|null;
}>;
export type SourceReviewInputV1=Readonly<{
 source:SourceAuthorityV1;
 /** Null means no matching Registry assertion has been recorded. */
 assertion:SourceAssertionRefV1|null;
}>;
export type SourceReviewBlockerV1=
 |"scope_mismatch"|"source_identity_invalid"|"source_expired_or_revoked"
 |"private_retention_not_allowed"|"registry_assertion_absent"
 |"registry_assertion_mismatch"|"source_use_not_documented"
 |"lineage_conflict"|"possible_shared_origin";
export type SourceReviewRowV1=Readonly<{
 sourceId:string;assertionId:string|null;
 disposition:"blocked"|"needs_independent_human_review";
 blockers:readonly SourceReviewBlockerV1[];
}>;
export type SourceReviewQueueV1=Readonly<{
 kind:"not_recorded"|"requires_review";
 rows:readonly SourceReviewRowV1[];
 /** Always zero until a separately verified server authority is accepted. */
 independentlyVerifiedFamilies:0;
 achAssessmentsAllowed:0;
}>;

/**
 * Can be used for a private attention queue, never to grant authoring rights.
 * The caller must already have performed server-side role, Hold and disclosure
 * checks before reading evidence. It accepts only IDs and reference metadata.
 */
export function screenMiziziQuestionSourcesV1(
 scope:SourceReviewScopeV1,
 candidates:readonly SourceReviewInputV1[],
 nowIso:string,
):SourceReviewQueueV1{
 if(!uuid(scope.workspaceId)||!uuid(scope.caseId)||!uuid(scope.subjectId)||
    !Number.isSafeInteger(scope.caseRevision)||scope.caseRevision<1||
    !["artist","track","release","registry_relationship"].includes(scope.subjectType)||
    !Number.isFinite(moment(nowIso)))throw new TypeError("MIZIZI_SOURCE_REVIEW_INVALID_SCOPE");
 if(!Array.isArray(candidates)||candidates.length>100)throw new TypeError("MIZIZI_SOURCE_REVIEW_CAP");
 if(candidates.length===0)return Object.freeze({kind:"not_recorded",rows:Object.freeze([]),independentlyVerifiedFamilies:0,achAssessmentsAllowed:0});
 const now=moment(nowIso)!;
 const ids=new Set<string>();
 // An independence-group *hint* is not source-family proof.
 const origins=new Map<string,number>();
 for(const c of candidates){
  if(!c||typeof c!=="object"||!c.source||!uuid(c.source.sourceId))
    throw new TypeError("MIZIZI_SOURCE_REVIEW_INVALID_SOURCE_ID");
  const id=c.source.sourceId.toLowerCase();
  if(ids.has(id))throw new TypeError("MIZIZI_SOURCE_REVIEW_DUPLICATE_SOURCE");
  ids.add(id);
  const origin=c.source.originKey+"|"+c.source.lineageKey;
  origins.set(origin,(origins.get(origin)||0)+1);
 }
 const rows=candidates.map((item):SourceReviewRowV1=>{
  const s=item.source,a=item.assertion,blockers:SourceReviewBlockerV1[]=[];
  if(s.caseId.toLowerCase()!==scope.caseId.toLowerCase()||s.workspaceId.toLowerCase()!==scope.workspaceId.toLowerCase())blockers.push("scope_mismatch");
  if(!uuid(s.sourceId)||!digest(s.fingerprint)||!nonempty(s.originKey)||!nonempty(s.lineageKey)||
     !nonempty(s.authorityRef)||!USE.has(s.useBasis))blockers.push("source_identity_invalid");
  const observed=moment(s.observedAt)??NaN,expiry=moment(s.expiresAt),revoked=moment(s.revokedAt);
  if(!Number.isFinite(observed)||observed>now||(expiry!==null&&(!Number.isFinite(expiry)||expiry<=now))||
     revoked!==null)blockers.push("source_expired_or_revoked");
  if(!s.privateResearchAllowed||!s.privateEvidenceRetentionAllowed)blockers.push("private_retention_not_allowed");
  if(a===null)blockers.push("registry_assertion_absent");
  else {
    if(!uuid(a.assertionId)||!uuid(a.sourceId)||a.sourceId.toLowerCase()!==s.sourceId.toLowerCase()||
       a.subjectType!==scope.subjectType||a.subjectId.toLowerCase()!==scope.subjectId.toLowerCase()||
       !digest(a.assertionFingerprint)||a.assertionFingerprint.toLowerCase()!==s.fingerprint.toLowerCase())
      blockers.push("registry_assertion_mismatch");
    if(!USE.has(a.sourceUseBasis??"")||a.sourceUseBasis!==s.useBasis)blockers.push("source_use_not_documented");
    if(a.lineageKey===null||a.lineageKey!==s.lineageKey)blockers.push("lineage_conflict");
  }
  if((origins.get(s.originKey+"|"+s.lineageKey)||0)>1)blockers.push("possible_shared_origin");
  return Object.freeze({sourceId:s.sourceId.toLowerCase(),assertionId:a?.assertionId.toLowerCase()??null,
   disposition:blockers.length?"blocked":"needs_independent_human_review",
   blockers:Object.freeze(blockers)});
 });
 return Object.freeze({kind:"requires_review",rows:Object.freeze(rows),independentlyVerifiedFamilies:0,achAssessmentsAllowed:0});
}

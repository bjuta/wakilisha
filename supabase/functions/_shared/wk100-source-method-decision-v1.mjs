/**
 * WK100 source-method review, UI and Edge request validation.
 *
 * This only validates an operator's proposed *review decision*. The separate
 * SQL SECURITY DEFINER RPC must independently verify JWT capability, current
 * proposal revision, active super_admin admission authority, per-source CAS,
 * evidence and expiry. A validated object is never itself collection permission.
 */
const KEYS=Object.freeze([
  'sourceKey','providerKey','proposalRevision','decisionState',
  'parserClass','methodClass','nativePeriodAuthority','nativePeriodEvidenceRef',
  'endpointSha256','accessEvidenceSha256','authorizationRef','authorizationExpiresAt',
  'constitutionVersion','reason',
]);
const PROVIDERS=Object.freeze({
  youtube_ke:'youtube_kenya_weekly_top_songs_v1',
  apple_ke:'apple_kenya_chart_v1',
  boomplay_ke:'boomplay_kenya_chart_v1',
  mdundo_ke:'mdundo_kenya_chart_v1',
  shazam_ke:'shazam_kenya_discovery_v1',
  spotify_ke:'spotify_kenya_offered_chart_csv_v1',
  audiomack_ke:'audiomack_kenya_chart_v1',
});
const METHOD=new Set(['provider_api','offered_export','reviewed_page_adapter','research_only']);
const PERIOD_AUTHORITY=new Set(['provider_defined','observed_as_of']);
const OBSERVED_PROVIDERS=new Set(['apple_ke','shazam_ke','mdundo_ke','audiomack_ke']);
// Reviewed missing-period evidence reference, never a claimed provider-native week.
const OBSERVED_POLICY=/^observed_as_of\/[a-z0-9][a-z0-9_.-]{2,119}$/;
const STATE=new Set(['held','collector_admitted','paused','retired']);
const HEX=/^[a-f0-9]{64}$/;
const SOURCE=/^[a-z][a-z0-9_]{2,63}$/;
const REF=/^[a-z][a-z0-9_./-]{2,119}$/;
const CONSTITUTION=/^[a-zA-Z0-9._-]{2,100}$/;
const NO_CONTROLS=/[\u0000-\u001f\u007f<>]/u;
const NO_EVIDENCE_MARKUP=/[\u0000-\u001f\u007f<>?&=#@]/u;
export class Wk100SourceMethodError extends Error {
  constructor(code){super(code);this.code=code;}
}
function fail(code){throw new Wk100SourceMethodError(code);}
const nullableText=(value,max,pattern)=>value===null||
  (typeof value==='string'&&value===value.trim()&&value.length>=1&&
   value.length<=max&&!(pattern??NO_CONTROLS).test(value));
const exactUtc=v=>typeof v==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(v)&&
  Number.isFinite(Date.parse(v))&&
  new Date(v).toISOString().replace('.000Z','Z')===v;
/**
 * All fourteen fields are required, nullable fields use explicit null,
 * and the only admitted method is a provider-specific known parser class.
 * The server checks expiry again using its own clock.
 */
export function validateWk100SourceMethodDecision(payload,{now=new Date()}={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    !KEYS.every(key=>Object.hasOwn(payload,key))||
    Object.keys(payload).length!==KEYS.length||
    JSON.stringify(payload).length>3500||
    !(now instanceof Date)||!Number.isFinite(now.valueOf()))fail('method_review_invalid');
  const p=payload;
  if(typeof p.sourceKey!=='string'||!SOURCE.test(p.sourceKey)||
    typeof p.providerKey!=='string'||!Object.hasOwn(PROVIDERS,p.providerKey)||
    !p.sourceKey.startsWith(p.providerKey+'_')||
    !Number.isInteger(p.proposalRevision)||p.proposalRevision<1||p.proposalRevision>100000||
    !STATE.has(p.decisionState)||!METHOD.has(p.methodClass)||
    !nullableText(p.parserClass,100)||!nullableText(p.nativePeriodAuthority,50)||
    !nullableText(p.nativePeriodEvidenceRef,240,NO_EVIDENCE_MARKUP)||
    !(p.endpointSha256===null||HEX.test(p.endpointSha256))||
    !(p.accessEvidenceSha256===null||HEX.test(p.accessEvidenceSha256))||
    !nullableText(p.authorizationRef,120)||!nullableText(p.authorizationExpiresAt,45)||
    typeof p.constitutionVersion!=='string'||!CONSTITUTION.test(p.constitutionVersion)||
    typeof p.reason!=='string'||p.reason.length<6||p.reason.length>500||
    p.reason!==p.reason.trim()||NO_CONTROLS.test(p.reason))fail('method_review_invalid');
  if(p.decisionState==='collector_admitted'){
    if(!PROVIDERS[p.providerKey]||p.parserClass!==PROVIDERS[p.providerKey]||
      p.methodClass==='research_only'||
      (p.providerKey==='spotify_ke'&&p.methodClass!=='offered_export')||
      !PERIOD_AUTHORITY.has(p.nativePeriodAuthority)||
      // Neither the Spotify weekly chart-export method nor the YouTube
      // period-bound weekly parser may silently become an as-of-only adapter.
      (p.nativePeriodAuthority==='observed_as_of'&&
        !OBSERVED_PROVIDERS.has(p.providerKey))||
      (p.nativePeriodAuthority==='observed_as_of'&&
        !OBSERVED_POLICY.test(p.nativePeriodEvidenceRef??''))||
      typeof p.nativePeriodEvidenceRef!=='string'||p.nativePeriodEvidenceRef.length<3||
      !HEX.test(p.endpointSha256??'')||!HEX.test(p.accessEvidenceSha256??'')||
      typeof p.authorizationRef!=='string'||!REF.test(p.authorizationRef)||
      !exactUtc(p.authorizationExpiresAt)||
      Date.parse(p.authorizationExpiresAt)<=now.valueOf()||
      Date.parse(p.authorizationExpiresAt)>now.valueOf()+400*24*60*60*1000)
      fail('method_admission_unqualified');
  }
  return Object.freeze({...p,canCollect:false,canScore:false,canPublish:false});
}

/** This is a request shape, NOT a collection grant. SQL independently
 * confirms current role, current decision, proposal and immutable contract. */
export function validateWk100ContractEnrollmentIntent(payload){
  const keys=['sourceKey','contractVersion','adapterSha256',
    'expectedProposalRevision','expectedDecisionRevision'];
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    Object.keys(payload).length!==keys.length||
    !keys.every(k=>Object.hasOwn(payload,k))||
    typeof payload.sourceKey!=='string'||!SOURCE.test(payload.sourceKey)||
    typeof payload.contractVersion!=='string'||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(payload.contractVersion)||
    typeof payload.adapterSha256!=='string'||!HEX.test(payload.adapterSha256)||
    !Number.isInteger(payload.expectedProposalRevision)||
    payload.expectedProposalRevision<1||payload.expectedProposalRevision>100000||
    !Number.isInteger(payload.expectedDecisionRevision)||
    payload.expectedDecisionRevision<1||payload.expectedDecisionRevision>100000)
    fail('contract_enrollment_invalid');
  return Object.freeze({...payload});
}

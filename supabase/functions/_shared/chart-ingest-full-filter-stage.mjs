/**
 * WAKILISHA — real frozen-policy eligibility STAGE, nonpublishing admission v1.
 * Replaces only the legacy evaluator for runs containing rule_snapshot_json.ingestPolicy.
 * Authorization must be performed by the existing chart-ingest-api manage_ingest route.
 * This module never calls client-side code or authorizes scoring/commit.
 * All database mutations occur in ONE existing-caller-JWT SQL RPC transaction.
 */
import {verifyIngestPolicySnapshot} from './chart-ingest-policy-snapshot.mjs';
import {readCallerScopedChartRun} from './chart-ingest-caller-read.mjs';
import {reconcileRunRawEvidence,inspectProductionShapedRunCandidate,projectSameRunMetadataReview} from './chart-ingest-run-provenance.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonical=(obj)=>JSON.stringify(obj,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const unique=a=>[...new Set(a)];
export const STAGE_DECISION_VERSION='chart-ingest-full-filter-decision/v1';
export class FullFilterStageHold extends Error {
  constructor(code){super(`full_filter_stage_hold:${code}`);this.name='FullFilterStageHold';this.code=code;}
}
const assert=(condition,code)=>{if(!condition)throw new FullFilterStageHold(code);};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const marketCode=(run,scope)=>{
  assert(Array.isArray(scope?.includedMarkets),'market_scope_missing');
  const slug=String(run.market_slug||'').trim().toLowerCase();
  const matches=scope.includedMarkets.filter(m=>
    String(m?.marketSlug||'').toLowerCase()===slug || String(m?.countryCode||'').toLowerCase()===slug);
  assert(slug&&matches.length===1,'market_scope_ambiguous');
  const code=matches[0].countryCode;
  assert(typeof code==='string'&&/^[A-Z]{2}$/.test(code),'market_country_invalid');
  return code;
};
function verifiedReleaseFacts(data){
  const releases=new Map(data.registryReleases.map(r=>[r.id,r]));
  return data.registryTracks.map(track=>{
    const release=releases.get(track.release_id);
    return {track_id:track.id,release_type:release?.release_type??null,
      release_date:release?.release_date??null,versions:release?.metadata?.versions??null};
  });
}
/** Prepare an exhaustive, immutable candidate disposition WITHOUT ANY SQL writes. */
export async function prepareFullFilterStage(db,runId,{read=readCallerScopedChartRun,inspect=inspectProductionShapedRunCandidate}={}){
  assert(db&&typeof db.from==='function','caller_jwt_client_required');
  assert(typeof runId==='string'&&UUID.test(runId),'run_id_invalid');
  let data;
  try{data=await read(db,runId);}catch{throw new FullFilterStageHold('caller_scoped_read_failed');}
  assert(data?.run?.id===runId&&data.runId===runId,'run_identity_mismatch');
  // Historical retirement and materialized Editions cannot be re-opened.
  const reprocessableRunStates = new Set([
    'draft','queued','running','preflight_passed','fetching','normalizing',
    'scoring','reviewing','dry_run_complete','needs_review','failed',
    'source_fetch_failed',
  ]);
  assert(reprocessableRunStates.has(data.run.status),'run_terminal_or_unknown_status');
  assert(isObj(data.run.rule_snapshot_json)&&isObj(data.run.rule_snapshot_json.ingestPolicy),'frozen_policy_missing');
  const policy=data.run.rule_snapshot_json.ingestPolicy;
  let verified;
  try{verified=await verifyIngestPolicySnapshot(policy);}catch{throw new FullFilterStageHold('policy_integrity_unverified');}
  assert(verified?.ok===true,'policy_integrity_unverified');
  assert(canonical(data.run.market_scope_snapshot_json)===canonical(verified.snapshot.marketScopeSnapshot),'market_scope_changed');
  const marketIso2=marketCode(data.run,verified.snapshot.marketScopeSnapshot);
  for(const name of ['candidates','runSources','rawRows','acceptedMatches','exclusions','reviewIssues','registryTracks','registryCredits','registryArtists','registryReleases','registryProviderLinks'])
    assert(Array.isArray(data[name]),'incomplete_read_'+name);
  assert(data.candidates.length>0&&data.candidates.length<=500,'candidate_batch_not_accepted');
  assert(data.exclusions.every(e=>e.run_id===runId),'cross_run_exclusion');
  assert(data.reviewIssues.every(e=>e.run_id===runId),'cross_run_review_issue');
  assert(new Set(data.candidates.map(c=>c.id)).size===data.candidates.length,'candidate_ids_not_unique');
  assert(data.candidates.every(c=>c.run_id===runId&&UUID.test(c.id)),'candidate_run_mismatch');
  assert(data.candidates.every(c=>c.status!=='committed'),'committed_candidate_not_reprocessable');
  assert(typeof data.run.updated_at==='string'&&data.run.updated_at.length>0,'run_version_missing');
  assert(data.candidates.every(c=>typeof c.updated_at==='string'&&c.updated_at.length>0),'candidate_version_missing');
  const association=reconcileRunRawEvidence(data);
  const input={runId,runSources:data.runSources,rawRows:data.rawRows,candidates:data.candidates,
    acceptedMatches:data.acceptedMatches,registryTracks:data.registryTracks,registryCredits:data.registryCredits,
    registryArtists:data.registryArtists,registryReleases:data.registryReleases,
    registryProviderLinks:data.registryProviderLinks,marketIso2,
    verifiedTrackMetadata:data.registryTracks,verifiedReleaseMetadata:verifiedReleaseFacts(data)};
  const evaluations=[];
  for(const candidate of data.candidates){
    let evaluation;
    try{evaluation=await inspect(policy,input,candidate.id);}catch{throw new FullFilterStageHold('candidate_evaluation_failed');}
    assert(['ELIGIBLE','EXCLUDED','REVIEW_REQUIRED','CONFLICTED'].includes(evaluation?.outcome),'invalid_filter_outcome');
    assert(evaluation.mayScore===false&&evaluation.mayPublish===false,'unexpected_scoring_authority');
    evaluations.push({candidateId:candidate.id,evaluation});
  }
  const projection=projectSameRunMetadataReview(evaluations);
  assert(projection.rows.length===data.candidates.length,'candidate_projection_not_exhaustive');
  // Source-native periods and live authorization are explicit independent gates.
  // In this version these are NOT attested by the historical reader; even a
  // predicate-ELIGIBLE result is persisted as NEEDS_REVIEW, NEVER eligible.
  const periodsVerified=data.sourceNativePeriodVerified===true;
  const completenessVerified=data.readCompleteness===true&&association.runIntegrityComplete===true;
  const independentAcceptance=periodsVerified&&completenessVerified&&data.callerAuthorizationVerified===true;
  const cById=new Map(data.candidates.map(c=>[c.id,c]));
  const protectedReasons=new Map();
  const preservedExclusions=data.exclusions.filter(ex=>ex.reason_code==='manual_exclude' ||
    !['eligibility','eligibility_execution','shortlist'].includes(ex.source_stage));
  for(const ex of preservedExclusions){
    if(ex.candidate_id==null)continue;
    if(!cById.has(ex.candidate_id))throw new FullFilterStageHold('exclusion_candidate_mismatch');
    if(!protectedReasons.has(ex.candidate_id))protectedReasons.set(ex.candidate_id,[]);
    protectedReasons.get(ex.candidate_id).push(ex.reason_code||'protected_exclusion');
  }
  const openIssueIds=new Set();let runWideReviewHold=false;
  for(const issue of data.reviewIssues){
    if(issue.blocking!==true||['resolved','closed'].includes(issue.status))continue;
    if(issue.candidate_id==null){runWideReviewHold=true;continue;}
    if(!cById.has(issue.candidate_id))throw new FullFilterStageHold('review_issue_candidate_mismatch');
    openIssueIds.add(issue.candidate_id);
  }
  const decisions=projection.rows.map(row=>{
    const sourceCandidate=cById.get(row.candidateId);
    assert(sourceCandidate,'candidate_projection_mismatch');
    const protectedExclusion=protectedReasons.has(row.candidateId)||sourceCandidate.status==='excluded';
    const ignored=sourceCandidate.status==='ignored';
    const status=ignored?'ignored':protectedExclusion||row.outcome==='EXCLUDED'?'excluded':'needs_review';
    const reasonCodes=unique(row.reasons.map(reason=>reason.code));
    if(ignored)reasonCodes.push('preexisting_ignored_preserved');
    if(protectedExclusion)reasonCodes.push('preexisting_exclusion_preserved',...(protectedReasons.get(row.candidateId)||[]));
    if(openIssueIds.has(row.candidateId)||runWideReviewHold)reasonCodes.push('open_blocking_review_issue');
    if(row.outcome==='ELIGIBLE'&&!independentAcceptance)reasonCodes.push('external_acceptance_not_verified');
    return {candidateId:row.candidateId,expectedUpdatedAt:sourceCandidate.updated_at,status,
      decision:{contract:STAGE_DECISION_VERSION,outcome:ignored||protectedExclusion?'EXCLUDED':row.outcome,status,policyDigest:policy.sha256,
        reasonCodes:unique(reasonCodes),requiresReview:status==='needs_review' || openIssueIds.has(row.candidateId)||runWideReviewHold,
        sourceEvidenceCount:row.originalProviderEvidence.length,
        canScore:false,canPublish:false,sourceNativePeriodVerified:periodsVerified,
        sourceAssociationComplete:association.runIntegrityComplete===true,
        registryReadComplete:data.readCompleteness===true}};
  });
  assert(decisions.length===data.candidates.length,'decision_count_mismatch');
  return {runId,policy,expectedRunUpdatedAt:data.run.updated_at,decisions,
    summary:{contract:STAGE_DECISION_VERSION,runId,candidateCount:decisions.length,predicateCounts:projection.counts,
      reviewRequired:decisions.filter(d=>d.status==='needs_review').length,
      excluded:decisions.filter(d=>d.status==='excluded').length,
      ignored:decisions.filter(d=>d.status==='ignored').length,
      openBlockingReviewIssues:openIssueIds.size+(runWideReviewHold?1:0),
      externalGatesAccepted:independentAcceptance,canScore:false,canCommit:false}};
}
/**
 * Write only through the separate SECURITY INVOKER transactional RPC.
 * A missing function / denied RLS / stale candidate aborts before any commits.
 * Its SQL must be created via the repository's CLI-generated migration path.
 */
export async function executeFullFilterStage(db,runId,{prepare=prepareFullFilterStage}={}){
  assert(db&&typeof db.rpc==='function','caller_jwt_rpc_required');
  const draft=await prepare(db,runId);
  assert(draft?.runId===runId&&Array.isArray(draft.decisions),'stage_draft_invalid');
  assert(draft.decisions.every(d=>['excluded','needs_review','ignored'].includes(d.status)),'unsafe_eligible_write');
  let res;
  try{res=await db.rpc('chart_apply_full_filter_decisions_v1',{
    p_run_id:runId,p_expected_run_updated_at:draft.expectedRunUpdatedAt,
    p_policy:draft.policy,p_decisions:draft.decisions,
  });}catch{throw new FullFilterStageHold('transactional_decision_write_unavailable');}
  if(res?.error)throw new FullFilterStageHold('transactional_decision_write_failed');
  assert(res?.data?.ok===true&&res.data?.decisionCount===draft.decisions.length,'transactional_receipt_not_verified');
  return {...draft.summary,persisted:true,transactional:true,canScore:false,canCommit:false};
}

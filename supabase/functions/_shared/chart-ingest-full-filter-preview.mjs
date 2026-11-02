/**
 * Read-only full Chart Ingest filter preview, embedded in the EXISTING caller-scoped
 * chart-ingest API. NO SQL writes, admin mutations, scoring or release authority.
 * Every non-proven observation is a review hold, never an implicit exclusion.
 * The responsible server action MUST independently require manage_ingest.
 */
import {verifyIngestPolicySnapshot} from './chart-ingest-policy-snapshot.mjs';
import {readCallerScopedChartRun} from './chart-ingest-caller-read.mjs';
import {reconcileRunRawEvidence,inspectProductionShapedRunCandidate,projectSameRunMetadataReview} from './chart-ingest-run-provenance.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const own=(o,k)=>o&&Object.prototype.hasOwnProperty.call(o,k);
export class ChartIngestPreviewHold extends Error {
  constructor(code){super(`full_filter_preview_blocked:${code}`);this.code=code;this.name='ChartIngestPreviewHold';}
}
const ensure=(ok,code)=>{if(!ok)throw new ChartIngestPreviewHold(code);};
const summaryOnly=out=>({candidateId:out.candidateId,outcome:out.outcome,reasonCodes:out.reasons.map(r=>r.code),sourceObservationCount:out.originalProviderEvidence.length});

export async function previewFullIngestFilters(db,runId,{
  read=readCallerScopedChartRun,
  verify=verifyIngestPolicySnapshot,
  reconcile=reconcileRunRawEvidence,
  inspect=inspectProductionShapedRunCandidate,
  project=projectSameRunMetadataReview,
  maxPreviewCandidates=500,
}={}) {
  ensure(typeof runId==='string' && UUID.test(runId),'invalid_run_id');
  ensure(db && typeof db.from==='function','caller_scoped_client_required');
  ensure(Number.isSafeInteger(maxPreviewCandidates)&&maxPreviewCandidates>0&&maxPreviewCandidates<=500,'preview_limit_invalid');
  let data;
  try {data=await read(db,runId);}catch {throw new ChartIngestPreviewHold('authorized_read_unavailable');}
  ensure(data?.runId===runId && data?.run?.id===runId,'run_identity_mismatch');
  ensure(data?.run?.rule_snapshot_json && own(data.run.rule_snapshot_json,'ingestPolicy'),'frozen_policy_missing');
  const frozen=data.run.rule_snapshot_json.ingestPolicy;
  let checked;
  try {checked=await verify(frozen);}catch {throw new ChartIngestPreviewHold('invalid_frozen_policy');}
  ensure(checked?.ok===true,'invalid_frozen_policy');
  const {candidates,runSources,rawRows,acceptedMatches,registryTracks,registryCredits,registryArtists,registryReleases,registryProviderLinks}=data;
  for(const [name,rows] of Object.entries({candidates,runSources,rawRows,acceptedMatches,registryTracks,registryCredits,registryArtists,registryReleases,registryProviderLinks}))
    ensure(Array.isArray(rows),`read_set_incomplete_${name}`);
  ensure(candidates.length<=maxPreviewCandidates,'preview_candidate_limit');
  ensure(new Set(candidates.map(c=>c.id)).size===candidates.length,'duplicate_candidate_ids');
  // Chart runs may use market slug 'kenya' or ISO2 'KE'. Neither is
  // an artist origin: resolve only through the immutable market scope.
  const scope=checked.snapshot?.marketScopeSnapshot;
  ensure(scope && Array.isArray(scope.includedMarkets),'frozen_market_scope_missing');
  const marketSlug=String(data.run.market_slug||'').trim().toLowerCase();
  ensure(marketSlug.length>0,'target_market_unverified');
  const matchingMarkets=scope.includedMarkets.filter(m=>
    typeof m?.marketSlug==='string' && m.marketSlug.trim().toLowerCase()===marketSlug ||
    typeof m?.countryCode==='string' && m.countryCode.trim().toLowerCase()===marketSlug);
  ensure(matchingMarkets.length===1,'target_market_scope_ambiguous');
  const marketCode=String(matchingMarkets[0].countryCode||'').toUpperCase();
  ensure(/^[A-Z]{2}$/.test(marketCode),'target_market_unverified');
  const stable=(v)=>JSON.stringify(v,(_key,value)=>
    value&&typeof value==='object'&&!Array.isArray(value) ?
      Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))) : value);
  ensure(data.run.market_scope_snapshot_json &&
    stable(data.run.market_scope_snapshot_json)===stable(scope),
    'frozen_market_scope_drift');
  const input={runId,runSources,rawRows,candidates,acceptedMatches,registryTracks,registryCredits,registryArtists,
    registryReleases,registryProviderLinks,marketIso2:marketCode,
    verifiedTrackMetadata:registryTracks.map(t=>({...t})),
    verifiedReleaseMetadata:registryTracks.map(t=>{
      const rel=registryReleases.find(r=>r.id===t.release_id);
      return {...rel,track_id:t.id,release_date:rel?.release_date||null,release_type:rel?.release_type||null};
    })};
  let association;
  try {association=reconcile(input);}catch {throw new ChartIngestPreviewHold('run_evidence_reconciliation_failed');}
  ensure(association&&Array.isArray(association.perCandidate),'run_evidence_reconciliation_failed');
  const evaluations=[];
  for(const c of candidates){
    let evaluation;
    try {evaluation=await inspect(frozen,input,c.id);}catch {throw new ChartIngestPreviewHold('candidate_evaluation_failed');}
    ensure(['ELIGIBLE','EXCLUDED','REVIEW_REQUIRED','CONFLICTED'].includes(evaluation?.outcome),'invalid_candidate_decision');
    ensure(evaluation.mayScore===false&&evaluation.mayPublish===false,'candidate_must_remain_nonpublishing');
    evaluations.push({candidateId:c.id,evaluation});
  }
  let projected;
  try {projected=project(evaluations);}catch {throw new ChartIngestPreviewHold('review_projection_failed');}
  ensure(projected?.rows?.length===candidates.length,'review_projection_incomplete');
  // Preview must NEVER silently turn a failed/partial read into a green review queue.
  const holdReasons=[];
  if(data.readCompleteness!==true)holdReasons.push('registry_entities_missing_or_unverified');
  if(association.runIntegrityComplete!==true)holdReasons.push('source_association_unverified');
  if(data.sourceNativePeriodVerified!==true)holdReasons.push('source_native_period_unverified');
  if(data.callerAuthorizationVerified!==true)holdReasons.push('caller_authorization_not_accepted');
  if(projected.reviewRowCount>0)holdReasons.push('metadata_review_required');
  return {
    runId,contract:'chart-ingest-full-filter-preview/v1',frozenPolicyVerified:true,
    readCompleteness:data.readCompleteness===true,sourceAssociationComplete:association.runIntegrityComplete===true,
    candidateCount:candidates.length,counts:projected.counts,reviewRowCount:projected.reviewRowCount,
    reviewRows:projected.rows.filter(r=>r.requiresReview).map(summaryOnly),
    excludedRows:projected.rows.filter(r=>r.outcome==='EXCLUDED').map(summaryOnly),
    holdReasons:[...new Set(holdReasons)],canAdvanceToScoring:false,canCommit:false,mayScore:false,mayPublish:false,
  };
}

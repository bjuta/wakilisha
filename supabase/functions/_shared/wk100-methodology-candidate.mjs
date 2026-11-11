/**
 * WK100 W7 native-evidence methodology proposal, not legacy chart scoring.
 * A valid proposal has no scoring, freeze, or publication authority.
 * Every source-native measurement must survive later independent review.
 */
export const WK100_METHOD_FAMILIES=Object.freeze([
  'apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke','spotify_editorial',
]);
export const WK100_SPOTIFY_EDITORIAL_PLAYLISTS=Object.freeze([
  '37i9dQZF1DWWWXigQZAD8B','37i9dQZF1DX5lbl7P6kJFp',
  '37i9dQZF1DX7z7RLIui5KP','37i9dQZF1DX80fLED6RkGS',
]);
// These are measurement meanings and proposed treatment constraints, NOT
// assertions that a source was admitted or an exact native week was verified.
export const WK100_FAMILY_MEASUREMENTS=Object.freeze({
  apple_ke:Object.freeze({
    behavior:'audio_consumption_rank',nativeEvidence:'kenya_daily_most_played_position',
    normalization:'within_verified_native_rank_depth',
    periodTreatment:'daily_observations_not_weekly_stream_totals',
  }),
  shazam_ke:Object.freeze({
    behavior:'discovery_rank',nativeEvidence:'kenya_shazam_discovery_position',
    normalization:'within_verified_native_rank_depth',
    periodTreatment:'source_reported_window_only',
  }),
  mdundo_ke:Object.freeze({
    behavior:'audio_chart_rank',nativeEvidence:'kenya_top_songs_chart_position',
    normalization:'within_verified_native_rank_depth',
    periodTreatment:'weekly_updated_is_not_verified_weekly_total',
  }),
  youtube_ke:Object.freeze({
    behavior:'video_consumption',nativeEvidence:'kenya_native_week_song_views',
    normalization:'verified_cardinal_within_native_week_only',
    periodTreatment:'exact_provider_week_required',
  }),
  audiomack_ke:Object.freeze({
    behavior:'audio_chart_rank',nativeEvidence:'kenya_geo_chart_position',
    normalization:'within_verified_native_rank_depth',
    periodTreatment:'chart_placement_not_disclosed_stream_totals',
  }),
  spotify_editorial:Object.freeze({
    behavior:'editorial_placement',nativeEvidence:'four_named_playlist_observations',
    normalization:'one_capped_provider_family_not_four_votes',
    periodTreatment:'observed_placement_not_weekly_consumption',
  }),
});
export const WK100_METHOD_REVIEW_CONTROLS=Object.freeze({
  sourceAuthority:'exact_admitted_original_and_native_period_required',
  temporalComparability:'no_unverified_daily_to_weekly_conversion',
  crossMetricConversion:'no_discovery_or_editorial_as_streams',
  familyIndependence:'one_contribution_per_provider_family_per_recording',
  missingEvidence:'reserved_share_unfilled_never_redistributed',
  recordingIdentity:'confirmed_registry_recording_only',
  coverage:'at_least_two_independent_qualified_core_providers',
  completeness:'insufficient_evidence_holds_private_ranking',
  sensitivity:'leave_one_core_provider_out_review_required',
  freeze:'independent_review_and_versioned_authority_required',
});
const SHA=/^[a-f0-9]{64}$/;
const MONDAY=/^\d{4}-\d{2}-\d{2}$/;
const keys=x=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x):[];
const exact=(actual,expected)=>actual.length===expected.length&&
  actual.every(k=>expected.includes(k));
const hold=code=>{throw new Error('wk100_methodology_'+code);};
function exactValues(actual,expected){
  return exact(keys(actual),keys(expected))&&
    keys(expected).every(k=>actual[k]===expected[k]);
}
export function validateWk100MethodologyCandidate(value,{weekStartEat,ingestPolicySha256}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||
    !exact(keys(value),[
      'schemaVersion','weekStartEat','ingestPolicySha256','weightsPercent',
      'spotifyEditorialPlaylistIds','familyMeasurements','reviewControls',
      'normalization','missingness','identityPolicy',
      'approvalState','canScore','canFreeze','canPublish',
    ])||value.schemaVersion!=='wk100-methodology-candidate/v2'||
    value.approvalState!=='proposed'||value.canScore!==false||
    value.canFreeze!==false||value.canPublish!==false)hold('shape_invalid');
  const week=value.weekStartEat;
  if(typeof week!=='string'||!MONDAY.test(week)||
     Number.isNaN(Date.parse(week+'T00:00:00Z'))||
     new Date(week+'T00:00:00Z').toISOString().slice(0,10)!==week||
     new Date(week+'T00:00:00Z').getUTCDay()!==1||
     (weekStartEat!=null&&week!==weekStartEat))hold('week_invalid');
  if(!SHA.test(value.ingestPolicySha256)||
     (ingestPolicySha256!=null&&value.ingestPolicySha256!==ingestPolicySha256))
    hold('policy_stale');
  if(!exact(keys(value.weightsPercent),WK100_METHOD_FAMILIES)||
     !WK100_METHOD_FAMILIES.every(k=>Number.isInteger(value.weightsPercent[k])&&
       value.weightsPercent[k]>0&&value.weightsPercent[k]<=100)||
     WK100_METHOD_FAMILIES.reduce((total,k)=>total+value.weightsPercent[k],0)!==100)
    hold('weights_invalid');
  const minCore=Math.min(...WK100_METHOD_FAMILIES.slice(0,5)
    .map(k=>value.weightsPercent[k]));
  if(value.weightsPercent.spotify_editorial>=minCore)
    hold('editorial_not_supplementary');
  if(!Array.isArray(value.spotifyEditorialPlaylistIds)||
     !exact(value.spotifyEditorialPlaylistIds,WK100_SPOTIFY_EDITORIAL_PLAYLISTS)||
     new Set(value.spotifyEditorialPlaylistIds).size!==4)
    hold('spotify_family_invalid');
  if(!exact(keys(value.familyMeasurements),WK100_METHOD_FAMILIES)||
     !WK100_METHOD_FAMILIES.every(k=>exactValues(
       value.familyMeasurements[k],WK100_FAMILY_MEASUREMENTS[k])))
    hold('native_measurement_invalid');
  if(!exactValues(value.reviewControls,WK100_METHOD_REVIEW_CONTROLS))
    hold('review_controls_invalid');
  if(value.normalization!=='source_metric_classes_separate'||
     value.missingness!=='hold_without_redistribution'||
     value.identityPolicy!=='confirmed_registry_recording_only')
    hold('guardrails_invalid');
  return Object.freeze({valid:true,canScore:false,canFreeze:false,
    canPublish:false,approvalState:'proposed'});
}


/**
 * W7 evidence-chain review for the existing authenticated Admin source read.
 *
 * This is NOT a qualification or scoring engine. The read model exposes a
 * capture summary but cannot attest Registry identities, source-native weekly
 * comparability, four Spotify editorial originals, or independent sign-off.
 * Never turn candidate-chain counts into approved coverage or frozen weights.
 */
export const WK100_W7_CORE_REVIEW_METRICS=Object.freeze({
  apple_ke:'rank',
  shazam_ke:'rank',
  mdundo_ke:'rank',
  youtube_ke:'rank_and_count',
  audiomack_ke:'rank',
});
function w7WeekStart(week){
  if(typeof week!=='string'||!MONDAY.test(week))hold('review_week_invalid');
  const ms=Date.parse(week+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==week||
     new Date(ms).getUTCDay()!==1)hold('review_week_invalid');
  return ms-3*60*60*1000; // Monday 00:00 East Africa Time
}
const w7InWeek=(instant,start)=>{
  const ms=Date.parse(instant);
  return Number.isFinite(ms)&&ms>=start&&ms<start+7*86400000;
};
const w7Original=s=>SHA.test(s.receiptSha256||'')&&
  ['succeeded','partial_depth'].includes(s.captureState)&&
  Number.isInteger(s.observedDepth)&&s.observedDepth>0&&
  Number.isInteger(s.expectedDepth)&&s.observedDepth<=s.expectedDepth;
const w7NativeWindow=s=>{
  if(s.nativePeriodAuthority!=='provider_defined')return false;
  const start=Date.parse(s.nativePeriodStart),end=Date.parse(s.nativePeriodEnd);
  return Number.isFinite(start)&&Number.isFinite(end)&&start<end;
};
export function reviewWk100MethodologyEvidence({weekStartEat,sources=[],methods=[]}={}){
  const start=w7WeekStart(weekStartEat);
  if(!Array.isArray(sources)||sources.length>200||
     !Array.isArray(methods)||methods.length>500||
     sources.some(x=>!x||typeof x!=='object'||Array.isArray(x))||
     methods.some(x=>!x||typeof x!=='object'||Array.isArray(x)))
    hold('review_read_unavailable');
  const core=WK100_METHOD_FAMILIES.slice(0,5).map(family=>{
    const candidates=sources.filter(s=>s.provider===family&&s.market==='KE');
    let originalCount=0,methodCandidateCount=0,nativeWindowCount=0;
    let asOfCount=0,metricMatchCount=0,chainCandidateCount=0;
    for(const s of candidates){
      const original=w7Original(s);
      const metric=s.metric===WK100_W7_CORE_REVIEW_METRICS[family];
      const method=methods.find(m=>m.sourceKey===s.sourceKey&&
        m.providerKey===family&&m.captureContractVersion===s.version);
      const candidate=!!method&&method.decisionState==='collector_admitted'&&
        method.hasMethodEvidence===true;
      const native=w7NativeWindow(s)&&method?.nativePeriodAuthority==='provider_defined';
      const asOf=method?.nativePeriodAuthority==='observed_as_of'&&
        w7InWeek(s.lastSuccessfulAt,start);
      if(original)originalCount++;
      if(candidate)methodCandidateCount++;
      if(native)nativeWindowCount++;
      if(asOf)asOfCount++;
      if(metric)metricMatchCount++;
      if(original&&metric&&candidate&&(native||asOf))chainCandidateCount++;
    }
    const holds=[];
    if(!candidates.length)holds.push('no_enrolled_source_report');
    if(!originalCount)holds.push('no_original_receipt_in_report');
    if(!methodCandidateCount)holds.push('method_admission_not_confirmed');
    if(!metricMatchCount)holds.push('native_metric_not_confirmed');
    if(!nativeWindowCount&&!asOfCount)holds.push('native_period_not_verified');
    if(asOfCount&&!nativeWindowCount)holds.push('as_of_not_weekly_total');
    if(!chainCandidateCount)holds.push('evidence_chain_incomplete');
    // An enrolled method and receipt are not a qualified week or identity.
    holds.push('registry_identity_and_week_alignment_unattested');
    return Object.freeze({family,sourceCount:candidates.length,
      originalCount,methodCandidateCount,nativeWindowCount,
      asOfCount,metricMatchCount,chainCandidateCount,
      holds:Object.freeze(holds),canScore:false,canFreeze:false});
  });
  const chainCandidateFamilies=core.filter(r=>r.chainCandidateCount>0).length;
  return Object.freeze({
    schemaVersion:'wk100-w7-evidence-review/v1',
    weekStartEat,core:Object.freeze(core),
    chainCandidateFamilies,minimumCoreFamilies:2,
    sourceCoverageConfirmed:false,
    spotifyEditorialPlaylistIds:WK100_SPOTIFY_EDITORIAL_PLAYLISTS,
    spotifyEditorialProven:false,
    nativeFormulaApproved:false,
    weekCompletenessApproved:false,
    concentrationAndSensitivityApproved:false,
    independentApprovalRecorded:false,
    canScore:false,canFreeze:false,canPublish:false,
  });
}

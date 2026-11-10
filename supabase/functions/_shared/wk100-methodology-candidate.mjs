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

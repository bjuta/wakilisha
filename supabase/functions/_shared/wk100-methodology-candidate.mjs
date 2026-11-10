/** W7 proposed methodology values. Candidate evidence only; never score, freeze or publish. */
export const WK100_METHOD_FAMILIES = Object.freeze([
  'apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke','spotify_editorial',
]);
export const WK100_SPOTIFY_EDITORIAL_PLAYLISTS = Object.freeze([
  '37i9dQZF1DWWWXigQZAD8B', '37i9dQZF1DX5lbl7P6kJFp',
  '37i9dQZF1DX7z7RLIui5KP', '37i9dQZF1DX80fLED6RkGS',
]);
const SHA=/^[a-f0-9]{64}$/;
const MONDAY=/^\d{4}-\d{2}-\d{2}$/;
const keys=(x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x):[];
const exact=(actual,expected)=>actual.length===expected.length&&actual.every(k=>expected.includes(k));
const hold=(code)=>{throw new Error('wk100_methodology_'+code);};
export function validateWk100MethodologyCandidate(value,{weekStartEat,ingestPolicySha256}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||
     !exact(keys(value),[
       'schemaVersion','weekStartEat','ingestPolicySha256','weightsPercent',
       'spotifyEditorialPlaylistIds','normalization','missingness','identityPolicy',
       'approvalState','canScore','canPublish',
     ])||value.schemaVersion!=='wk100-methodology-candidate/v1'||
     value.approvalState!=='proposed'||value.canScore!==false||value.canPublish!==false)
    hold('shape_invalid');
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
       value.weightsPercent[k]>=0&&value.weightsPercent[k]<=100)||
     WK100_METHOD_FAMILIES.reduce((total,k)=>total+value.weightsPercent[k],0)!==100)
    hold('weights_invalid');
  const core=WK100_METHOD_FAMILIES.slice(0,5)
    .map(k=>value.weightsPercent[k]).filter(w=>w>0);
  const editorial=value.weightsPercent.spotify_editorial;
  if(core.length===0||(editorial>0&&!(editorial<Math.min(...core))))
    hold('editorial_not_supplementary');
  if(!Array.isArray(value.spotifyEditorialPlaylistIds)||
     !exact(value.spotifyEditorialPlaylistIds,WK100_SPOTIFY_EDITORIAL_PLAYLISTS)||
     new Set(value.spotifyEditorialPlaylistIds).size!==4)
    hold('spotify_family_invalid');
  if(value.normalization!=='source_metric_classes_separate'||
     value.missingness!=='hold_without_redistribution'||
     value.identityPolicy!=='confirmed_registry_recording_only')
    hold('guardrails_invalid');
  return Object.freeze({valid:true,canScore:false,canPublish:false,approvalState:'proposed'});
}

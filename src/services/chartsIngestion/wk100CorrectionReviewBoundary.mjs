/**
 * W5C: read-only correction ownership/lineage boundary.
 * This is NOT a Registry writer or a durable decision ledger.
 * Actual metadata edits remain in existing governed Registry/MIZIZI flows.
 */
export const WK100_CORRECTION_FIELDS=Object.freeze({
  'track.title':Object.freeze({label:'Track title',owner:'registry_track',
    authority:'admin_patch_registry_track_profile_v1',route:'track',treatment:'existing_governed_editor'}),
  'track.isrc':Object.freeze({label:'ISRC',owner:'registry_track',
    authority:'admin_patch_registry_track_profile_v1',route:'track',treatment:'existing_governed_editor'}),
  'track.explicit':Object.freeze({label:'Explicit status',owner:'registry_track',
    authority:'admin_patch_registry_track_profile_v1',route:'track',treatment:'existing_governed_editor'}),
  'track.duration_ms':Object.freeze({label:'Track duration',owner:'registry_track',
    authority:'admin_patch_registry_track_profile_v1',route:'track',treatment:'existing_governed_editor'}),
  'release.release_type':Object.freeze({label:'Release type',owner:'registry_release',
    authority:'admin_patch_registry_release_profile_v1',route:'release',treatment:'existing_governed_editor'}),
  'release.release_date':Object.freeze({label:'Release date',owner:'registry_release',
    authority:'admin_patch_registry_release_profile_v1',route:'release',treatment:'existing_governed_editor'}),
  'artist.origin_iso2':Object.freeze({label:'Artist origin',owner:'registry_artist_origin',
    authority:'registry.artist_origin.admit/v1',route:'artist',treatment:'missing_origin_admission_or_separate_correction'}),
  'credits.primary_featured':Object.freeze({label:'Primary or featured credit',owner:'registry_credit',
    authority:'MIZIZI governed credit review',route:'mizizi',treatment:'human_identity_review'}),
  'recording.identity':Object.freeze({label:'Recording identity or version',owner:'registry_identity',
    authority:'MIZIZI governed recording review',route:'mizizi',treatment:'human_identity_review'}),
  'track.genres':Object.freeze({label:'Genre evidence',owner:'registry_evidence',
    authority:'Registry evidence review',route:'mizizi',treatment:'human_evidence_review'}),
  'track.languages':Object.freeze({label:'Language evidence',owner:'registry_evidence',
    authority:'Registry evidence review',route:'mizizi',treatment:'human_evidence_review'}),
});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const outcomes=new Set(['ELIGIBLE','EXCLUDED','REVIEW_REQUIRED','CONFLICTED']);
const fail=code=>{throw new Error('wk100_correction_boundary_'+code);};
export function describeWk100CorrectionReview(preview,captureRowId,fieldPath){
  if(!preview||preview.schemaVersion!=='wk100-admin-eligibility-preview-v1'||
     preview.canWriteRegistry!==false||preview.canScore!==false||preview.canPublish!==false||
     !UUID.test(preview.contractId)||!UUID.test(preview.receiptId)||
     !SHA.test(preview.payloadSha256)||!SHA.test(preview.policySha256)||
     !Number.isSafeInteger(preview.configRevision)||preview.configRevision<1||
     !Array.isArray(preview.rows)||preview.rows.length!==preview.observedDepth||
     preview.rows.length<1||preview.rows.length>200)fail('preview_invalid');
  const field=WK100_CORRECTION_FIELDS[fieldPath];
  if(!field)fail('field_unrecognized_or_source_immutable');
  if(!UUID.test(captureRowId))fail('row_invalid');
  const matches=preview.rows.filter(row=>row.captureRowId===captureRowId);
  if(matches.length!==1)fail('row_absent_or_duplicated');
  const row=matches[0];
  if(!SHA.test(row.registryFactsSha256)||!outcomes.has(row.outcome)||
     !Number.isInteger(row.rank)||row.rank<1||row.rank>200||
     row.canScore!==false||row.canPublish!==false)fail('row_unverified');
  return Object.freeze({
    schemaVersion:'wk100-correction-review-context/v1',
    weekStartEat:preview.weekStartEat,
    contractId:preview.contractId,receiptId:preview.receiptId,
    captureRowId,sourceRank:row.rank,sourceKey:preview.sourceKey,
    sourceOriginalSha256:preview.payloadSha256,
    editionPolicyRevision:preview.configRevision,
    editionPolicySha256:preview.policySha256,
    registryFactsSha256:row.registryFactsSha256,
    canonicalTrackId:row.canonicalTrackId??null,
    currentOutcome:row.outcome,
    fieldPath,owner:field.owner,authority:field.authority,
    treatment:field.treatment,route:field.route,
    durability:'not_saved',reviewState:'inspect_only',
    canWriteRegistry:false,canReEvaluate:false,canScore:false,canPublish:false,
  });
}

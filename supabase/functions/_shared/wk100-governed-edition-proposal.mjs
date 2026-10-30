/**
 * WK100 #1329: pure, NONPUBLISHING governed Edition proposal.
 *
 * A reviewed list can contain unresolved source observations. Those observations
 * do not become Registry entities or independent cross-source corroboration.
 * This is not a publication RPC, approval signature, or a scheduled job.
 */
import {canonicalJSON, digestSHA256, trackingWeek} from './chart-weekly-evidence.mjs';
import {buildWk100PrivatePreview} from './wk100-private-preview-core.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const PROVISIONAL=/^wk100:obs:v1:([a-f0-9]{64}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const fail=code=>{throw new Error('wk100_edition_proposal_'+code);};
const need=(yes,code)=>{if(!yes)fail(code);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=240;
const key=value=>typeof value==='string'&&/^[a-z][a-z0-9_:-]{2,79}$/.test(value);
const instant=value=>typeof value==='string'&&UTC.test(value)&&
  Number.isFinite(Date.parse(value))&&
  new Date(value).toISOString().replace('.000Z','Z')===value;
const unique=values=>new Set(values).size===values.length;
const clone=value=>structuredClone(value);
const freezeDeep=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freezeDeep(child);}return value;};
const validateRecord=(value,keys,code)=>{
  need(object(value)&&Object.keys(value).length===keys.length&&
    keys.every(field=>Object.hasOwn(value,field)),code);
};

/**
 * Only formats a content-addressed candidate for a future, separately authorized
 * transactional publisher. Its can_publish property is ALWAYS false.
 *
 * The caller must use the private reader's verified, authorized_candidate output;
 * this function also checks its cross-references but cannot authenticate a
 * fabricated reader_result in isolation.
 *
 * review.labels deliberately selects an ACTUAL observed title+artist receipt
 * for each immutable rank. A later Registry link must never rewrite this label.
 */
export async function prepareWk100GovernedEditionProposal({
  reader_result, edition_date_eat, cutoff_at_utc, deadline_at_utc,
  constitution_sha256, review,
}) {
  need(SHA.test(constitution_sha256),'constitution_authority_missing');
  const result=reader_result;
  need(object(result)&&result.status==='private_preview'&&
    result.can_publish===false,'reader_result_invalid');
  const audit=result.private_audit;
  need(object(audit)&&audit.schema_version==='wk100-private-audit-v1'&&
    audit.dataset_mode==='authorized_candidate'&&audit.can_publish===false&&
    audit.can_promote_to_edition===false,'audit_not_publishing_authority');
  need(SHA.test(result.rank_input_sha256)&&
    result.rank_input_sha256===audit.input_sha256,'input_digest_mismatch');
  const week=trackingWeek(result.week_start_eat);
  need(result.week_start_eat===audit.week_start_eat,'week_mismatch');
  need(typeof edition_date_eat==='string'&&/^\d{4}-\d\d-\d\d$/.test(edition_date_eat)&&
    Number.isFinite(Date.parse(edition_date_eat+'T00:00:00Z'))&&
    new Date(edition_date_eat+'T00:00:00Z').toISOString().startsWith(edition_date_eat+'T'),
    'edition_date_invalid');
  need(instant(cutoff_at_utc)&&instant(deadline_at_utc),'deadline_invalid');
  const end=Date.parse(week.ends_at),cutoff=Date.parse(cutoff_at_utc),deadline=Date.parse(deadline_at_utc);
  need(end<=cutoff&&cutoff<=deadline&&deadline<=end+7*86400000,'deadline_outside_weekly_window');
  validateRecord(review,['editor_ref','reviewed_at_utc','input_sha256','labels','dispositions'],'review_invalid');
  need(key(review.editor_ref)&&instant(review.reviewed_at_utc)&&
    Date.parse(review.reviewed_at_utc)>=cutoff&&Date.parse(review.reviewed_at_utc)<=deadline,
    'review_timing_invalid');
  need(review.input_sha256===result.rank_input_sha256,'review_input_digest_mismatch');

  const manifest=audit.source_manifest;
  need(Array.isArray(manifest)&&manifest.length>=2&&manifest.length<=8&&
    manifest.length===result.verified_receipts&&
    Array.isArray(result.selected_attempt_ids)&&
    result.selected_attempt_ids.length===manifest.length&&
    unique(result.selected_attempt_ids)&&result.selected_attempt_ids.every(id=>UUID.test(id)),
    'source_receipts_invalid');
  const sourceByKey=new Map(),operators=new Set();
  for(const source of manifest) {
    need(object(source)&&key(source.source_key)&&key(source.operator_key)&&
      source.market==='KE'&&source.admission==='approved'&&
      SHA.test(source.raw_sha256)&&
      Number.isInteger(source.expected_depth)&&source.expected_depth>0&&source.expected_depth<=200&&
      !sourceByKey.has(source.source_key)&&!operators.has(source.operator_key),
      'source_provenance_invalid');
    need(object(source.native_period)&&instant(source.native_period.starts_at)&&
      instant(source.native_period.ends_at)&&
      Date.parse(source.native_period.starts_at)<Date.parse(source.native_period.ends_at)&&
      key(source.native_period.evidence_ref),'native_period_unverified');
    operators.add(source.operator_key);
    sourceByKey.set(source.source_key,source);
  }
  need(operators.size>=2&&audit.operator_count===operators.size&&audit.behavior_count>=2,
    'independent_source_coverage_invalid');

  const provenance=result.provenance;
  need(Array.isArray(provenance)&&
    provenance.length===manifest.reduce((n,s)=>n+s.expected_depth,0),
    'provenance_depth_mismatch');
  const bySourceRank=new Map(),usedCapture=new Set(),sourceRanks=new Map();
  const attemptBySource=new Map(),attemptOwners=new Map();
  for(const row of provenance) {
    const source=sourceByKey.get(row?.source_key);
    need(source&&row.operator_key===source.operator_key&&
      UUID.test(row.attempt_id)&&result.selected_attempt_ids.includes(row.attempt_id)&&
      UUID.test(row.capture_row_id)&&
      Number.isInteger(row.source_rank)&&row.source_rank>=1&&
      row.source_rank<=source.expected_depth,'provenance_row_invalid');
    const k=row.source_key+'|'+row.source_rank;
    need(!bySourceRank.has(k)&&!usedCapture.has(row.capture_row_id),'provenance_duplicate');
    need((row.identity_state==='canonical'&&UUID.test(row.recording_id)&&
      row.provisional_ref===null)||
      (row.identity_state==='provisional'&&row.recording_id===null&&
      typeof row.provisional_ref==='string'&&
      PROVISIONAL.test(row.provisional_ref)&&
      row.provisional_ref===`wk100:obs:v1:${source.raw_sha256}:${row.capture_row_id.toLowerCase()}`),
      'provenance_identity_invalid');
    const priorAttempt=attemptBySource.get(row.source_key);
    need(!priorAttempt||priorAttempt===row.attempt_id,'source_attempt_mismatch');
    const priorSource=attemptOwners.get(row.attempt_id);
    need(!priorSource||priorSource===row.source_key,'attempt_reused_between_sources');
    attemptBySource.set(row.source_key,row.attempt_id);
    attemptOwners.set(row.attempt_id,row.source_key);
    bySourceRank.set(k,row);usedCapture.add(row.capture_row_id);
    sourceRanks.set(row.source_key,(sourceRanks.get(row.source_key)||0)+1);
  }
  for(const source of manifest)need(sourceRanks.get(source.source_key)===source.expected_depth,
    'source_rank_coverage_invalid');
  need(attemptOwners.size===result.selected_attempt_ids.length,'selected_attempt_coverage_invalid');
  // Reconstruct the EXACT sealed private input from each captured rank and
  // the frozen source constitution. A copied privateAudit alone cannot assert
  // its own scores or ranking order. Re-hash then replay the existing kernel.
  const reconstructed={
    schema_version:'wk100-private-preview-v1',
    week_start_eat:result.week_start_eat,
    dataset_mode:'authorized_candidate',
    method:clone(audit.method_configuration),
    sources:manifest.map(source=>({
      source_key:source.source_key,operator_key:source.operator_key,
      behavior:source.behavior,market:source.market,
      expected_depth:source.expected_depth,native_period:clone(source.native_period),
      authority_ref:source.authority_ref,admission:source.admission,
      raw_sha256:source.raw_sha256,
      entries:provenance.filter(row=>row.source_key===source.source_key)
        .sort((a,b)=>a.source_rank-b.source_rank)
        .map(row=>({recording_id:row.recording_id??row.provisional_ref,rank:row.source_rank})),
    })).sort((a,b)=>a.source_key.localeCompare(b.source_key)),
  };
  let replay;
  try {
    const computed=await digestSHA256(canonicalJSON(reconstructed));
    need(computed===result.rank_input_sha256,'independent_input_replay_mismatch');
    replay=buildWk100PrivatePreview(reconstructed,computed).privateAudit;
  } catch (error) {
    if(error?.message?.startsWith('wk100_edition_proposal_'))throw error;
    fail('private_ranking_replay_invalid');
  }
  need(canonicalJSON(replay.top100)===canonicalJSON(audit.top100)&&
    canonicalJSON(replay.failures)===canonicalJSON(audit.failures)&&
    replay.coverage_status===audit.coverage_status&&
    replay.provisional_recording_count===audit.provisional_recording_count,
    'private_ranking_replay_mismatch');

  need(Array.isArray(audit.top100)&&audit.top100.length===100&&
    Array.isArray(review.labels)&&review.labels.length===100,
    'top100_missing');
  const labels=new Map();
  for(const label of review.labels) {
    validateRecord(label,['position','source_key','capture_row_id'],'label_selection_invalid');
    need(Number.isInteger(label.position)&&label.position>=1&&label.position<=100&&
      key(label.source_key)&&UUID.test(label.capture_row_id)&&!labels.has(label.position),
      'label_selection_invalid');
    labels.set(label.position,label);
  }
  need(Array.isArray(audit.failures)&&unique(audit.failures)&&
    audit.failures.every(x=>typeof x==='string'&&/^[a-z][a-z0-9_]{2,79}$/.test(x)),
    'audit_failures_invalid');
  need(Array.isArray(review.dispositions)&&review.dispositions.length===audit.failures.length,
    'review_dispositions_missing');
  const dispositions=new Map();
  for(const d of review.dispositions) {
    validateRecord(d,['code','rationale'],'disposition_invalid');
    need(audit.failures.includes(d.code)&&text(d.rationale)&&d.rationale.trim().length>=20&&
      !dispositions.has(d.code),'disposition_invalid');
    dispositions.set(d.code,d.rationale.trim());
  }
  need(audit.failures.every(code=>dispositions.has(code)),'dispositions_incomplete');

  const records=new Set(),items=[];
  for(let i=0;i<100;i++) {
    const row=audit.top100[i],label=labels.get(i+1);
    need(row&&row.position===i+1&&label&&
      typeof row.recording_id==='string'&&
      (UUID.test(row.recording_id)||PROVISIONAL.test(row.recording_id))&&
      !records.has(row.recording_id)&&
      Number.isFinite(row.score)&&row.score>0&&
      Array.isArray(row.contributions)&&row.contributions.length>0,
      'ranked_entry_invalid');
    records.add(row.recording_id);
    const chosen=bySourceRank.get(label.source_key+'|'+
      row.contributions.find(c=>c.source_key===label.source_key&&
        bySourceRank.get(c.source_key+'|'+c.source_rank)?.capture_row_id===label.capture_row_id)?.source_rank);
    need(chosen&&chosen.capture_row_id===label.capture_row_id&&
      (chosen.recording_id??chosen.provisional_ref)===row.recording_id&&
      text(chosen.title_observed)&&text(chosen.artist_observed),
      'observed_label_unverifiable');
    for(const contribution of row.contributions) {
      const observed=bySourceRank.get(contribution.source_key+'|'+contribution.source_rank);
      need(observed&&(observed.recording_id??observed.provisional_ref)===row.recording_id&&
        Number.isFinite(contribution.value)&&contribution.value>0,
        'ranking_contribution_unverifiable');
    }
    const unresolved=PROVISIONAL.test(row.recording_id);
    items.push({
      rank:row.position,original_title:chosen.title_observed,
      original_artist:chosen.artist_observed,
      canonical_track_id:unresolved?null:row.recording_id,
      provisional_ref:unresolved?row.recording_id:null,
      score:row.score,source_observation:{
        source_key:label.source_key,capture_row_id:label.capture_row_id,
        source_rank:chosen.source_rank,attempt_id:chosen.attempt_id,
        raw_sha256:sourceByKey.get(chosen.source_key).raw_sha256,
      },
      corroboration_refs:row.contributions.map(c=>({
        source_key:c.source_key,source_rank:c.source_rank,
      })).sort((a,b)=>a.source_key.localeCompare(b.source_key)||a.source_rank-b.source_rank),
    });
  }
  const candidate={
    schema_version:'wk100-governed-edition-proposal-v1',
    week_start_eat:week.week_start_eat,edition_date_eat,
    evidence_week:{starts_at:week.starts_at,ends_at:week.ends_at},
    cutoff_at_utc,deadline_at_utc,
    constitution_sha256,
    methodology_version:audit.method_version,
    rank_input_sha256:result.rank_input_sha256,
    selected_attempt_ids:[...result.selected_attempt_ids].sort(),
    source_receipts:manifest.map(s=>({
      source_key:s.source_key,operator_key:s.operator_key,raw_sha256:s.raw_sha256,
      native_period:clone(s.native_period),
    })).sort((a,b)=>a.source_key.localeCompare(b.source_key)),
    editor_review:{
      editor_ref:review.editor_ref,reviewed_at_utc:review.reviewed_at_utc,
      dispositions:[...dispositions].sort(([a],[b])=>a.localeCompare(b))
        .map(([code,rationale])=>({code,rationale})),
    },
    pending_identity_rows:items.filter(x=>x.provisional_ref!==null).length,
    observed_entries:items,
  };
  const proposal_sha256=await digestSHA256(canonicalJSON(candidate));
  return freezeDeep({
    ...candidate,proposal_sha256,
    // The future database publisher MUST hold one immutable Edition slot per
    // market/week; a changed review digest is not a second publication.
    edition_slot_key:`wk100:KE:${week.week_start_eat}`,
    idempotency_key:`wk100:${week.week_start_eat}:${proposal_sha256}`,
    state:'candidate_for_separate_governed_review',
    can_publish:false,can_write_registry:false,
  });
}

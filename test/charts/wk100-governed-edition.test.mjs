import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWk100CaptureRankingInput} from '../../supabase/functions/_shared/wk100-capture-ranking-bridge.mjs';
import {buildWk100PrivatePreview} from '../../supabase/functions/_shared/wk100-private-preview-core.mjs';
import {canonicalJSON,digestSHA256} from '../../supabase/functions/_shared/chart-weekly-evidence.mjs';
import {prepareWk100GovernedEditionProposal as prepare} from '../../supabase/functions/_shared/wk100-governed-edition-proposal.mjs';

const uuid=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const copy=x=>structuredClone(x);
const method={
 version:'preview-proxy-v1',
 behavior_weights:{consumption:.5,video_consumption:.5},
 operator_slots:{consumption:1,video_consumption:1},
 minimum_operators:2,minimum_behaviors:2,minimum_corrob_tracks:1,
 maximum_operator_share:1,
};
function source(n,behavior) {
 const id=uuid(10+n),attempt=uuid(20+n);
 return {
  contract:{id,source_key:`source_${n}`,market:'KE',behavior,native_metric:'rank',expected_depth:100},
  attempt:{id:attempt,contract_id:id,week_start_eat:'2026-10-19',
   status:'succeeded',payload_sha256:n.toString(16).repeat(64),
   observed_depth:100,record_count:100,native_period_authority:'provider_defined',
   native_period_start:'2026-10-18T21:00:00Z',native_period_end:'2026-10-25T21:00:00Z',
   native_period_evidence_ref:'period_ke_week'},
  operator_key:`operator_${n}`,authority_ref:`authority_${n}`,
  rows:Array.from({length:100},(_,i)=>({
   id:uuid(1000+n*100+i),attempt_id:attempt,source_rank:i+1,
   title_observed:`Observed Track ${i+1}`,artist_observed:`Artist ${i+1}`,
  })),
 };
}
async function fixture() {
 const sources=[source(1,'consumption'),source(2,'video_consumption')];
 // The two final observations are not yet verified as the same recording.
 const resolutions=sources.flatMap(s=>s.rows.slice(0,99).map((row,i)=>({
  capture_row_id:row.id,recording_id:uuid(2000+i),
 })));
 const projected=buildWk100CaptureRankingInput({
  week_start_eat:'2026-10-19',dataset_mode:'authorized_candidate',
  method,sources,resolutions,
 });
 const sha=await digestSHA256(canonicalJSON(projected.input));
 const {privateAudit}=buildWk100PrivatePreview(projected.input,sha);
 const reader_result={
  status:'private_preview',week_start_eat:'2026-10-19',can_publish:false,
  verified_receipts:2,selected_attempt_ids:sources.map(s=>s.attempt.id),
  rank_input_sha256:sha,provenance:projected.provenance,private_audit:privateAudit,
 };
 const labels=privateAudit.top100.map(entry=>{
  const observation=entry.contributions[0];
  const row=projected.provenance.find(p=>p.source_key===observation.source_key&&
   p.source_rank===observation.source_rank);
  return {position:entry.position,source_key:row.source_key,capture_row_id:row.capture_row_id};
 });
 return {
  reader_result,constitution_sha256:'f'.repeat(64),
  edition_date_eat:'2026-10-26',
  cutoff_at_utc:'2026-10-25T21:00:00Z',
  deadline_at_utc:'2026-10-26T21:00:00Z',
  review:{editor_ref:'editor_research_01',reviewed_at_utc:'2026-10-26T09:00:00Z',
   input_sha256:sha,labels,dispositions:[]},
 };
}
test('mixed resolved/provisional Top 100 becomes sealed NONPUBLISHING proposal',async()=>{
 const f=await fixture(),p=await prepare(f);
 assert.equal(p.schema_version,'wk100-governed-edition-proposal-v1');
 assert.equal(p.observed_entries.length,100);
 assert.equal(p.pending_identity_rows,1);
 assert.equal(p.observed_entries.filter(x=>x.canonical_track_id!==null).length,99);
 assert.equal(p.observed_entries.filter(x=>x.provisional_ref!==null).length,1);
 assert.equal(p.observed_entries[0].original_title,'Observed Track 1');
 assert.equal(p.observed_entries[0].original_artist,'Artist 1');
 assert.equal(p.can_publish,false);assert.equal(p.can_write_registry,false);
 assert.equal(p.state,'candidate_for_separate_governed_review');
 assert.match(p.proposal_sha256,/^[a-f0-9]{64}$/);
 assert.equal(p.idempotency_key,`wk100:2026-10-19:${p.proposal_sha256}`);
 assert.equal(Object.isFrozen(p.observed_entries[0].source_observation),true);
 assert.throws(()=>{p.observed_entries[0].original_title='Tampered';},TypeError);
});
test('same frozen receipt and decisions replay to identical immutable proposal',async()=>{
 const f=await fixture(),a=await prepare(f);
 const b=await prepare(copy(f));
 assert.deepEqual(a,b);
 assert.deepEqual(b.observed_entries.map(x=>x.rank),Array.from({length:100},(_,i)=>i+1));
});
test('raw ranking receipt digest and review digest must both bind',async()=>{
 const f=await fixture();
 f.reader_result.private_audit.input_sha256='a'.repeat(64);
 await assert.rejects(prepare(f),/input_digest_mismatch/);
 const g=await fixture();g.review.input_sha256='b'.repeat(64);
 await assert.rejects(prepare(g),/review_input_digest_mismatch/);
});
test('fake provider-evidence association is rejected even with matched title',async()=>{
 const f=await fixture();
 f.reader_result.provenance[0].provisional_ref='wk100:obs:v1:'+'a'.repeat(64)+':'+uuid(1001);
 await assert.rejects(prepare(f),/provenance_identity_invalid/);
});
test('wrong observed label or missing original text fails closed',async()=>{
 const f=await fixture();
 f.review.labels[0].capture_row_id=uuid(999999);
 await assert.rejects(prepare(f),/observed_label_unverifiable/);
 const g=await fixture();g.reader_result.provenance.find(x=>x.source_rank===1).artist_observed='';
 await assert.rejects(prepare(g),/observed_label_unverifiable/);
});
test('altering score contribution cannot turn another observation into source corroboration',async()=>{
 const f=await fixture();f.reader_result.private_audit.top100[0].contributions[0].source_rank=98;
 await assert.rejects(prepare(f),/ranking_contribution_unverifiable|observed_label_unverifiable/);
});
test('no truncated Top100, phantom independent provider, duplicate position or incomplete source ranks',async()=>{
 const a=await fixture();a.reader_result.private_audit.top100.pop();
 await assert.rejects(prepare(a),/top100_missing/);
 const b=await fixture();b.reader_result.private_audit.source_manifest[1].operator_key='operator_1';
 await assert.rejects(prepare(b),/source_provenance_invalid/);
 const c=await fixture();c.review.labels[1].position=1;
 await assert.rejects(prepare(c),/label_selection_invalid/);
 const d=await fixture();d.reader_result.provenance.pop();
 await assert.rejects(prepare(d),/provenance_depth_mismatch/);
});
test('deadline is explicit in EAT week, and review must be between cutoff and deadline',async()=>{
 const a=await fixture();a.cutoff_at_utc='2026-10-25T20:59:59Z';
 await assert.rejects(prepare(a),/deadline_outside_weekly_window/);
 const b=await fixture();b.review.reviewed_at_utc='2026-10-26T21:00:01Z';
 await assert.rejects(prepare(b),/review_timing_invalid/);
 const c=await fixture();c.deadline_at_utc='2026-11-03T00:00:00Z';
 await assert.rejects(prepare(c),/deadline_outside_weekly_window/);
});
test('preview quality warnings need exact documented editorial dispositions, not invented evidence',async()=>{
 const f=await fixture();f.reader_result.private_audit.failures=['insufficient_cross_operator_corroboration'];
 await assert.rejects(prepare(f),/review_dispositions_missing/);
 f.review.dispositions=[{code:'insufficient_cross_operator_corroboration',
  rationale:'Unverified cross-source equivalence is not counted as corroboration.'}];
 const p=await prepare(f);
 assert.equal(p.can_publish,false);
 assert.deepEqual(p.editor_review.dispositions,f.review.dispositions);
});
test('private preview never authenticates itself as a publishing permission',async()=>{
 const a=await fixture();a.reader_result.can_publish=true;
 await assert.rejects(prepare(a),/reader_result_invalid/);
 const b=await fixture();b.reader_result.private_audit.dataset_mode='synthetic';
 await assert.rejects(prepare(b),/audit_not_publishing_authority/);
 const c=await fixture();c.constitution_sha256='unknown';
 await assert.rejects(prepare(c),/constitution_authority_missing/);
});

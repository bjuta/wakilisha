import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWk100CaptureRankingInput as project} from '../../supabase/functions/_shared/wk100-capture-ranking-bridge.mjs';
import {buildWk100PrivatePreview} from '../../scripts/charts/wk100-private-preview.mjs';
const uuid=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const method={version:'preview-proxy-v1',behavior_weights:{consumption:0.5,video_consumption:0.5},operator_slots:{consumption:1,video_consumption:1},minimum_operators:2,minimum_behaviors:2,minimum_corrob_tracks:1,maximum_operator_share:0.9};
function fixture(){
 const mk=(n,behavior)=>({
  contract:{id:uuid(10+n),source_key:`source_${n}`,market:'KE',behavior,native_metric:'rank',expected_depth:2},
  attempt:{id:uuid(20+n),contract_id:uuid(10+n),week_start_eat:'2026-10-19',status:'succeeded',
   payload_sha256:n.toString(16).repeat(64),observed_depth:2,record_count:2,
   native_period_authority:'provider_defined',native_period_start:'2026-10-18T21:00:00.000Z',native_period_end:'2026-10-25T21:00:00.000Z',native_period_evidence_ref:'period_ke_week'},
  operator_key:`operator_${n}`, authority_ref:`authority_${n}`,
  rows:[{id:uuid(30+n*2),attempt_id:uuid(20+n),source_rank:1},
   {id:uuid(31+n*2),attempt_id:uuid(20+n),source_rank:2}],
 });
 const sources=[mk(1,'consumption'),mk(2,'video_consumption')];
 const resolutions=sources.flatMap(s=>s.rows.map((r,i)=>({capture_row_id:r.id,recording_id:uuid(200+i)})));
 return {week_start_eat:'2026-10-19',dataset_mode:'synthetic',method,sources,resolutions};
}
test('two independent operators preserve source-native ranks and exact source count',()=>{
 const f=fixture(),r=project(f);
 assert.equal(r.input.sources.length,2);
 assert.deepEqual(r.input.sources.map(s=>s.operator_key),['operator_1','operator_2']);
 assert.deepEqual(r.input.sources.map(s=>s.entries.map(e=>e.rank)),[[1,2],[1,2]]);
 assert.equal(r.provenance.length,4);
 const preview=buildWk100PrivatePreview(r.input);
 assert.deepEqual(preview.privateAudit.top100.map(row=>[row.position,row.operator_count,row.score]),
   [[1,2,1],[2,2,0.5]]);
 assert.equal(preview.privateAudit.can_publish,false);
 assert.equal(r.can_publish,false);
});
test('row/source reorder has stable output and provenance',()=>{
 const a=fixture(),b=structuredClone(a);b.sources.reverse();b.sources.forEach(s=>s.rows.reverse());b.resolutions.reverse();
 assert.deepEqual(project(b),project(a));
});
test('fail closed on unresolved and forged recording identities',()=>{
 const a=fixture();a.resolutions.pop();assert.throws(()=>project(a),/wk100_bridge_recording_unresolved/);
 const b=fixture();b.resolutions[0].recording_id='not-uuid';assert.throws(()=>project(b),/wk100_bridge_resolution_invalid/);
});
test('reject duplicated operator, same recording twice in a source and reused capture row',()=>{
 const a=fixture();a.sources[1].operator_key='operator_1';assert.throws(()=>project(a),/source_or_operator_duplicate/);
 const b=fixture();b.resolutions[1].recording_id=b.resolutions[0].recording_id;assert.throws(()=>project(b),/recording_duplicate_within_source/);
 const c=fixture();c.sources[1].rows[0].id=c.sources[0].rows[0].id;assert.throws(()=>project(c),/capture_row_reused/);
});
test('reject partial receipt, wrong contract, missing period, and rank gaps',()=>{
 const edits=[
  f=>f.sources[0].attempt.status='partial_depth',
  f=>f.sources[0].attempt.contract_id=uuid(999),
  f=>f.sources[0].attempt.native_period_authority='unknown',
  f=>f.sources[0].rows[1].source_rank=3,
  f=>f.sources[0].attempt.payload_sha256='not-a-hash',
 ];
 for(const edit of edits){const f=fixture();edit(f);assert.throws(()=>project(f),/wk100_bridge_/);}
});
test('unrelated resolution rows and unsupported non-rank metric are rejected',()=>{
 const a=fixture();a.resolutions.push({capture_row_id:uuid(900),recording_id:uuid(1000)});
 assert.throws(()=>project(a),/orphan_resolution/);
 const b=fixture();b.sources[0].contract.native_metric='event_count';
 assert.throws(()=>project(b),/source_measurement_invalid/);
});
test('SQL UTC offsets are normalized to scorer timestamp format',()=>{
 const f=fixture();f.sources[0].attempt.native_period_start='2026-10-19T00:00:00+03:00';
 const p=project(f);assert.equal(p.input.sources[0].native_period.starts_at,'2026-10-18T21:00:00Z');
});

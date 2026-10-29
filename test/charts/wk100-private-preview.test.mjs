import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp,writeFile,readFile,stat,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { buildWk100PrivatePreview,previewInputDigest } from '../../scripts/charts/wk100-private-preview.mjs';
import {buildWk100CaptureRankingInput as project} from '../../supabase/functions/_shared/wk100-capture-ranking-bridge.mjs';

const uuid=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const p={starts_at:'2026-10-18T21:00:00Z',ends_at:'2026-10-25T21:00:00Z',evidence_ref:'period_week_2026_43'};
function input(){
 const definitions=[['op_alpha','alpha_chart','consumption'],['op_beta','beta_chart','consumption'],['op_gamma','gamma_chart','discovery'],['op_delta','delta_chart','video_consumption']];
 return {schema_version:'wk100-private-preview-v1',week_start_eat:'2026-10-19',dataset_mode:'synthetic',
  method:{version:'preview-proxy-v1',behavior_weights:{consumption:.5,discovery:.25,video_consumption:.25},operator_slots:{consumption:2,discovery:1,video_consumption:1},minimum_operators:4,minimum_behaviors:3,minimum_corrob_tracks:100,maximum_operator_share:.35},
  sources:definitions.map(([operator_key,source_key,behavior])=>({operator_key,source_key,behavior,market:'KE',
    expected_depth:120,native_period:{...p},authority_ref:'test_only_synthetic',admission:'synthetic',raw_sha256:'a'.repeat(64),
    entries:Array.from({length:120},(_,i)=>({recording_id:uuid(i+1),rank:i+1}))}))};
}
const clone=o=>structuredClone(o);
test('four distinct operators and three behavior families create a stable synthetic internal preview',()=>{
 const x=input(), a=buildWk100PrivatePreview(x,previewInputDigest(JSON.stringify(x)));
 assert.equal(a.privateAudit.coverage_status,'provisional_quality_floor_met');
 assert.equal(a.privateAudit.top100.length,100);
 assert.equal(a.privateAudit.corroborated_top100,100);
 assert.equal(a.privateAudit.sensitivity.length,4);
 assert.equal(a.privateAudit.can_publish,false);
 assert.equal(a.privateAudit.source_raw_digests_independently_verified,false);
 assert.equal(a.publicSummary.can_publish,false);
 assert.equal(a.publicSummary.verification_status,'INTERNAL_PREVIEW_ONLY');
 for(const item of [JSON.stringify(a.publicSummary)]) {
  for(const marker of ['alpha_chart','beta_chart','op_alpha','op_gamma','behavior_weights','0.25','a'.repeat(64)]) assert.equal(item.includes(marker),false,marker);
 }
});
test('deterministic by source ordering and stable rank-tie resolution',()=>{
 const a=input(),b=clone(a);b.sources.reverse();
 assert.deepEqual(buildWk100PrivatePreview(a).privateAudit.top100.map(x=>[x.recording_id,x.score]),
  buildWk100PrivatePreview(b).privateAudit.top100.map(x=>[x.recording_id,x.score]));
});
test('source dropout blocks coverage but does not renormalize away missing operator',()=>{
 const a=input();a.sources.pop();
 const x=buildWk100PrivatePreview(a);
 assert.ok(x.privateAudit.failures.includes('insufficient_independent_operators'));
 assert.equal(x.privateAudit.top100[0].score,.75);
 assert.equal(buildWk100PrivatePreview(input()).privateAudit.top100[0].score,1);
 assert.equal(x.privateAudit.can_publish,false);
});
test('fixed family slots do not redistribute weight after a consumption operator drops',()=>{
 const a=input();a.sources.shift();
 const r=buildWk100PrivatePreview(a).privateAudit;
 assert.equal(r.top100[0].score,.75);
 assert.ok(r.failures.includes('insufficient_independent_operators'));
 assert.equal(r.can_publish,false);
});
test('corroboration rejects nonoverlapping listings and flags lack of national representativeness',()=>{
 const a=input();a.sources.at(-1).entries.forEach((r,i)=>r.recording_id=uuid(i+201));
 const r=buildWk100PrivatePreview(a).privateAudit;
 assert.ok(r.failures.includes('insufficient_cross_operator_corroboration'));
 assert.equal(r.can_publish,false);
});
test('rejects false source-native metric, unapproved data, cross-provider duplication and forged registry identity',()=>{
 for(const edit of [
  a=>a.sources[0].admission='approved',
  a=>a.sources[0].entries[1].rank=1,
  a=>a.sources[0].entries[1].recording_id=a.sources[0].entries[0].recording_id,
  a=>a.sources[0].entries[0].recording_id='Artist One',
  a=>a.sources[0].market='US',
  a=>a.sources[0].raw_sha256='not-a-hash',
  a=>a.sources[0].native_period.ends_at='2026-01-01T00:00:00Z',
  a=>a.sources[1].operator_key=a.sources[0].operator_key,
  a=>a.method.behavior_weights.consumption=.9,
  a=>a.method.behavior_weights.broadcast_exposure=.2,
  a=>a.sources[0].entries[0].views=10000,
  a=>a.sources[0].entries.pop(),
 ]){const a=input();edit(a);assert.throws(()=>buildWk100PrivatePreview(a),/wk100_preview_/);}
});
test('a local execution writes only restricted private/public files and refuses public repo locations',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wk100-preview-test-'));
 try{
  const source=join(root,'input.json'),out=join(root,'report');
  await writeFile(source,JSON.stringify(input()),{mode:0o600});
  const cli=resolve('scripts/charts/wk100-private-preview-cli.mjs');
  const process1=spawnSync(process.execPath,[cli,'--input',source,'--output-dir',out],{cwd:resolve('test/charts'),encoding:'utf8'});
  assert.equal(process1.status,0,process1.stderr);
  assert.match(process1.stdout,/WK100_CAN_PUBLISH=false/);
  const details=JSON.parse(await readFile(join(out,'private-audit.json'),'utf8'));
  const publicText=await readFile(join(out,'public-methodology-summary.json'),'utf8');
  assert.equal(details.input_sha256,previewInputDigest(await readFile(source)));
  assert.equal(details.can_publish,false);
  assert.ok(!publicText.includes('op_alpha'));
  assert.equal((await stat(join(out,'private-audit.json'))).mode&0o777,0o600);
  assert.equal((await stat(out)).mode&0o777,0o700);
  const again=spawnSync(process.execPath,[cli,'--input',source,'--output-dir',out],{cwd:resolve('test/charts'),encoding:'utf8'});
  assert.notEqual(again.status,0);
  const invalid=spawnSync(process.execPath,[cli,'--input',source,'--output-dir',resolve('test/charts/leak')],{cwd:resolve('test/charts'),encoding:'utf8'});
  assert.notEqual(invalid.status,0);
 }finally{await rm(root,{recursive:true,force:true});}
});


// Captured evidence -> private ranking: retained with the WK100 domain contract.
{
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
}

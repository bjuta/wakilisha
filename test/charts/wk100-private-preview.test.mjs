import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp,writeFile,readFile,stat,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { buildWk100PrivatePreview,previewInputDigest } from '../../scripts/charts/wk100-private-preview.mjs';

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

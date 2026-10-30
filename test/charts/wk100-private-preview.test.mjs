import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp,writeFile,readFile,stat,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { buildWk100PrivatePreview,previewInputDigest } from '../../scripts/charts/wk100-private-preview.mjs';
import {buildWk100CaptureRankingInput as project} from '../../supabase/functions/_shared/wk100-capture-ranking-bridge.mjs';
import {createHash} from 'node:crypto';
import {readWk100SealedCaptureManifest,validWk100CapturePreviewProjectBinding,makeWk100CapturePreviewSummary,runWk100PrivateCapturePreview} from '../../supabase/functions/_shared/wk100-capture-private-server.mjs';
import {readWk100PrivateRankingEvidence as run} from '../../supabase/functions/_shared/wk100-capture-ranking-reader.mjs';
import {canonicalJSON,digestSHA256} from '../../supabase/functions/_shared/chart-weekly-evidence.mjs';
import {prepareWk100GovernedEditionProposal as prepare} from '../../supabase/functions/_shared/wk100-governed-edition-proposal.mjs';

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
test('provisional evidence survives incomplete Registry linkage without impersonating a Track',()=>{
 const a=fixture();a.resolutions.pop();const projected=project(a);
 assert.equal(projected.provenance.filter(x=>x.identity_state==='provisional').length,1);
 assert.equal(projected.provenance.filter(x=>x.identity_state==='canonical').length,3);
 const provisional=projected.provenance.find(x=>x.identity_state==='provisional');
 assert.equal(provisional.recording_id,null);
 assert.match(provisional.provisional_ref,/^wk100:obs:v1:[a-f0-9]{64}:[0-9a-f-]{36}$/);
 assert.equal(buildWk100PrivatePreview(projected.input).privateAudit.provisional_recording_count,1);
 assert.equal(projected.can_publish,false);
 const b=fixture();b.resolutions[0].recording_id='not-uuid';assert.throws(()=>project(b),/wk100_bridge_resolution_invalid/);
});
test('same observed title never fabricates cross-source corroboration, and provisional digests are sealed',()=>{
 const a=fixture();a.resolutions=[];
 for(const s of a.sources)for(const row of s.rows){row.title_observed='Shared title';row.artist_observed='Shared artist';}
 const ranked=project(a),again=structuredClone(a);again.sources.reverse();again.sources.forEach(x=>x.rows.reverse());
 assert.deepEqual(project(again),ranked);
 const audit=buildWk100PrivatePreview(ranked.input).privateAudit;
 assert.equal(audit.provisional_recording_count,4);
 assert.equal(audit.corroborated_top100,0);
 assert.ok(audit.failures.includes('insufficient_cross_operator_corroboration'));
 assert.ok(audit.top100.every(x=>x.operator_count===1));
 const forged=structuredClone(ranked.input);
 forged.sources[1].entries[0].recording_id=forged.sources[0].entries[0].recording_id;
 assert.throws(()=>buildWk100PrivatePreview(forged),/wk100_preview_provisional_evidence_mismatch/);
 const badDigest=structuredClone(ranked.input);badDigest.sources[0].raw_sha256='b'.repeat(64);
 assert.throws(()=>buildWk100PrivatePreview(badDigest),/wk100_preview_provisional_evidence_mismatch/);
 const reused=structuredClone(ranked.input);
 reused.sources[1].raw_sha256=reused.sources[0].raw_sha256;
 reused.sources[1].entries[0].recording_id=reused.sources[0].entries[0].recording_id;
 assert.throws(()=>buildWk100PrivatePreview(reused),/wk100_preview_provisional_reference_reused/);
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

// WK100_READER_CONSOLIDATED_ACCEPTANCE: exact capture and Registry resolution tests.
{
const uuid=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const week='2026-10-19';
const keys=['a','b'];
const bytes=new TextEncoder().encode('bytes for chart');
const hash=createHash('sha256').update(bytes).digest('hex');
const method={version:'preview-proxy-v1',behavior_weights:{consumption:0.5,video_consumption:0.5},operator_slots:{consumption:1,video_consumption:1},minimum_operators:2,minimum_behaviors:2,minimum_corrob_tracks:1,maximum_operator_share:0.9};
function f(){
 const contracts=keys.map((k,i)=>({id:uuid(i+1),source_key:`source_${k}`,provider_key:`provider_${k}`,market:'KE',behavior:i?'video_consumption':'consumption',native_metric:'rank',expected_depth:2,admission_state:'candidate',contract_version:'v1'}));
 const attempts=contracts.map((c,i)=>({id:uuid(11+i),contract_id:c.id,week_start_eat:week,scheduled_at:'2026-10-18T21:00:00+00:00',attempt_number:1,status:'succeeded',observed_market:'KE',observed_depth:2,record_count:2,payload_sha256:hash,raw_object_key:`wk100/test/private/bytes_${i}`,native_period_authority:'provider_defined',native_period_start:'2026-10-18T21:00:00Z',native_period_end:'2026-10-25T21:00:00Z',native_period_evidence_ref:'period_week_01'}));
 const rows=attempts.flatMap((a,i)=>[0,1].map(j=>({id:uuid(21+i*2+j),attempt_id:a.id,source_rank:j+1,provider_track_id:`native_${i}_${j}`,title_observed:`Song ${j}`,artist_observed:'Artist'})));
 const links=rows.map((r,i)=>({provider_key:contracts[Math.floor(i/2)].provider_key,provider_track_id:r.provider_track_id,track_id:uuid(101+i%2),match_status:'matched'}));
 const tracks=[{id:uuid(101),status:'active'},{id:uuid(102),status:'active'}];
 const data={wk_chart_capture_contracts_v1:contracts,wk_chart_capture_attempts_v1:attempts,wk_chart_capture_rows_v1:rows,registry_track_provider_links:links,provider_entity_links:[],registry_tracks:tracks};
 const calls=[];
 const db={from(table){calls.push(table);const criteria=[];let limit=Infinity;const query={select(){return query;},in(field,values){criteria.push(x=>values.includes(x[field]));return query;},eq(field,value){criteria.push(x=>x[field]===value);return query;},limit(n){limit=n;return Promise.resolve({data:data[table].filter(x=>criteria.every(q=>q(x))).slice(0,limit),error:null});}};return query;}};
 const options={db,readRawBytes:async()=>bytes,week_start_eat:week,selected_attempt_ids:attempts.map(a=>a.id),constitution:contracts.map((c,i)=>({source_key:c.source_key,operator_key:`operator_${i}`,authority_ref:`authority_${i}`})),method,dataset_mode:'synthetic'};
 return {data,calls,options};
}
test('exact immutable receipts resolve through existing provider links without writes',async()=>{
 const {options,calls}=f();const result=await run(options);
 assert.equal(result.status,'private_preview');assert.equal(result.verified_receipts,2);assert.equal(result.resolved_rows,4);assert.equal(result.can_publish,false);
 assert.equal(result.private_audit.operator_count,2);
 assert.deepEqual(result.private_audit.top100.map(x=>[x.position,x.operator_count,x.score]),[[1,2,1],[2,2,0.5]]);
 assert.match(result.rank_input_sha256,/^[a-f0-9]{64}$/);
 assert.ok(calls.every(x=>!x.startsWith('chart_ingest_')));
});
test('unknown provider Track is ranked provisionally and queued for identity review',async()=>{
 const x=f();x.data.registry_track_provider_links.shift();const r=await run(x.options);
 assert.equal(r.status,'private_preview');assert.equal(r.resolved_rows,3);
 assert.equal(r.pending_identity_rows,1);assert.equal(r.review_rows[0].reason,'unresolved');
 assert.equal(r.private_audit.provisional_recording_count,1);
 assert.equal(r.can_publish,false);
});
test('conflicting Registry links do not acquire false corroboration or block preview scoring',async()=>{
 const x=f();x.data.provider_entity_links.push({provider:'provider_a',provider_entity_id:'native_0_0',registry_entity_id:uuid(102),registry_entity_type:'track',match_status:'confirmed'});
 const r=await run(x.options);assert.equal(r.status,'private_preview');
 assert.equal(r.pending_identity_rows,1);assert.equal(r.review_rows[0].reason,'conflicting_identity');
 assert.equal(r.private_audit.provisional_recording_count,1);
});
test('inactive Registry Track becomes provisional while the other entries rank',async()=>{
 const x=f();x.data.registry_tracks[0].status='archived';const r=await run(x.options);
 assert.equal(r.status,'private_preview');assert.equal(r.pending_identity_rows,2);
 assert.equal(r.review_rows.length,2);assert.equal(r.review_rows[0].reason,'inactive_identity');
 assert.equal(r.private_audit.provisional_recording_count,2);
});
test('raw digest mismatch stops before scoring',async()=>{
 const x=f();x.options.readRawBytes=async()=>new TextEncoder().encode('different');
 await assert.rejects(run(x.options),/wk100_reader_raw_digest_mismatch/);
});
test('no newest-wins, duplicate selection, or duplicate operators',async()=>{
 const x=f();x.options.selected_attempt_ids[1]=x.options.selected_attempt_ids[0];
 await assert.rejects(run(x.options),/wk100_reader_attempt_selection_invalid/);
 const y=f();y.options.constitution[1].operator_key=y.options.constitution[0].operator_key;
 await assert.rejects(run(y.options),/wk100_reader_constitution_duplicate/);
});
test('truncated capture rows cannot be ranked',async()=>{
 const x=f();x.data.wk_chart_capture_rows_v1.pop();
 await assert.rejects(run(x.options),/wk100_reader_rows_incomplete/);
});
test('a receipt from another EAT week is not silently included',async()=>{
 const x=f();x.data.wk_chart_capture_attempts_v1[1].week_start_eat='2026-10-26';
 await assert.rejects(run(x.options),/wk100_reader_attempt_missing/);
});
test('ranking input digest is reproducible under explicit selection reorder',async()=>{
 const x=f(),y=f();y.options.selected_attempt_ids.reverse();y.options.constitution.reverse();
 const a=await run(x.options),b=await run(y.options);
 assert.equal(a.rank_input_sha256,b.rank_input_sha256);
 assert.match(a.rank_input_sha256,/^[a-f0-9]{64}$/);
});
test('duplicate source provider is not counted as an independent measurement',async()=>{
 const x=f();x.data.wk_chart_capture_contracts_v1[1].provider_key='provider_a';
 await assert.rejects(run(x.options),/wk100_reader_independent_source_duplicate/);
});


test('private candidate manifest requires exact sealed bytes and server-defined selections',async()=>{
 const x=f(), config={schema_version:'wk100-private-capture-preview-v1',week_start_eat:week,
   dataset_mode:'authorized_candidate',selected_attempt_ids:x.options.selected_attempt_ids,
   constitution:x.options.constitution,method};
 const raw=JSON.stringify(config), sha=createHash('sha256').update(raw).digest('hex');
 assert.deepEqual(await readWk100SealedCaptureManifest(raw,sha),config);
 await assert.rejects(readWk100SealedCaptureManifest(raw,'a'.repeat(64)),/manifest_digest_mismatch/);
 await assert.rejects(readWk100SealedCaptureManifest(JSON.stringify({...config,dataset_mode:'synthetic'}),
   createHash('sha256').update(JSON.stringify({...config,dataset_mode:'synthetic'})).digest('hex')),
   /manifest_contract_invalid/);
 const extra={...config,caller_url:'https://example.org'};
 await assert.rejects(readWk100SealedCaptureManifest(JSON.stringify(extra),
   createHash('sha256').update(JSON.stringify(extra)).digest('hex')),/manifest_contract_invalid/);
});
test('preview backend binding requires the exact project hostname and HTTPS',()=>{
 const ref='pgzizndxdyhqmtyywjmt';
 assert.equal(validWk100CapturePreviewProjectBinding(`https://${ref}.supabase.co`,ref),true);
 assert.equal(validWk100CapturePreviewProjectBinding(`http://${ref}.supabase.co`,ref),false);
 assert.equal(validWk100CapturePreviewProjectBinding(`https://${ref}.supabase.co.evil.com`,ref),false);
 assert.equal(validWk100CapturePreviewProjectBinding(`https://${ref}.supabase.co/path`,ref),false);
 assert.equal(validWk100CapturePreviewProjectBinding(`https://${ref}.supabase.co`, 'abcdefghijklmnopqrst'),false);
});
test('private candidate receipt adapter reads canonical private bucket and returns allowlisted aggregates only',async()=>{
  const {x,archive}=authorizedReplayFixture(),downloaded=[],canonicalKeys=[];
  for(let i=0;i<2;i++){
    const attempt=x.data.wk_chart_capture_attempts_v1[i];
    const raw=archive.get(attempt.raw_object_key);
    assert.ok(raw instanceof Uint8Array);
    archive.delete(attempt.raw_object_key);
    attempt.raw_object_key=`v1/${week}/${x.data.wk_chart_capture_contracts_v1[i].source_key}/20261019T000000Z-1/${attempt.payload_sha256}.json`;
    canonicalKeys.push(attempt.raw_object_key);
    archive.set(attempt.raw_object_key,raw);
  }
  const storage={from(bucket){assert.equal(bucket,'wk-chart-raw-evidence-v1');return {download:async(key)=>{
    downloaded.push(key);
    const raw=archive.get(key);
    return {data:raw?new Blob([raw]):null,error:raw?null:new Error('missing evidence')};
  }};}};
  const manifest={schema_version:'wk100-private-capture-preview-v1',week_start_eat:week,
    dataset_mode:'authorized_candidate',selected_attempt_ids:x.options.selected_attempt_ids,
    constitution:x.options.constitution,method};
  const result=await runWk100PrivateCapturePreview({db:x.options.db,storage,manifest});
  assert.equal(result.status,'private_preview');assert.equal(result.can_publish,false);
  assert.equal(result.operator_count,2);assert.equal(result.recording_count,2);
  assert.deepEqual(downloaded,canonicalKeys);
  const serialized=JSON.stringify(result);
  for(const secret of ['provider_0','apple_ke','operator_0','native_0_0',
    ...x.data.wk_chart_capture_attempts_v1.map(a=>a.payload_sha256),
    'behavior_weights','rank_input_sha256','private_audit','recording_id','contributions'])
    assert.equal(serialized.includes(secret),false,secret);
});
test('private adapter rejects noncanonical raw paths and oversized objects before scoring',async()=>{
 const make=()=>{
   const x=f();x.data.wk_chart_capture_attempts_v1.forEach((a,i)=>a.raw_object_key=
     `v1/${week}/source_${keys[i]}/20261019T000000Z-1/${hash}.json`);
   const manifest={schema_version:'wk100-private-capture-preview-v1',week_start_eat:week,
     dataset_mode:'authorized_candidate',selected_attempt_ids:x.options.selected_attempt_ids,
     constitution:x.options.constitution,method};return {x,manifest};};
 const a=make();a.x.data.wk_chart_capture_attempts_v1[0].raw_object_key='../private.json';
 const storage={from(){return {download:async()=>({data:new Blob([bytes]),error:null})};}};
 await assert.rejects(runWk100PrivateCapturePreview({db:a.x.options.db,storage,manifest:a.manifest}),
   /wk100_capture_preview_raw_key_invalid/);
 const b=make();const large={from(){return {download:async()=>({data:{size:5_000_000,arrayBuffer:async()=>new ArrayBuffer(0)},error:null})};}};
 await assert.rejects(runWk100PrivateCapturePreview({db:b.x.options.db,storage:large,manifest:b.manifest}),
   /wk100_capture_preview_raw_size_invalid/);
});
test('private candidate aggregate exposes unresolved count but never identity provenance',()=>{
 const r=makeWk100CapturePreviewSummary({status:'private_preview',week_start_eat:week,
   verified_receipts:2,resolved_rows:1,pending_identity_rows:3,
   review_rows:[{capture_row_id:uuid(700),provider_track_id:'secret_native',reason:'unresolved'}],
   private_audit:{can_publish:false,dataset_mode:'authorized_candidate',operator_count:2,
     behavior_count:2,recording_count:4,corroborated_top100:0,
     coverage_status:'below_proposed_quality_floor'},can_publish:false});
 assert.equal(r.pending_identity_rows,3);assert.equal(r.can_publish,false);
 assert.equal(JSON.stringify(r).includes('secret_native'),false);
 assert.equal(JSON.stringify(r).includes('review_rows'),false);
});
test('candidate review-only summary never serializes provider-native track IDs or row provenance',()=>{
 const result=makeWk100CapturePreviewSummary({status:'review_required',week_start_eat:week,
   verified_receipts:2,review_rows:[{source_key:'secret_source',provider_track_id:'secret_native',
     capture_row_id:uuid(900),reason:'conflicting_identity'}],can_publish:false});
 assert.deepEqual(result,{status:'review_required',week_start_eat:week,
   verified_receipts:2,pending_review_rows:1,can_publish:false});
 assert.ok(!JSON.stringify(result).includes('secret_native'));
});
test('capture-preview Edge route is JWT gated, admin-only, sealed and disabled by default',async()=>{
 const edge=await readFile('supabase/functions/wk100-capture-private-preview/index.ts','utf8');
 const config=await readFile('supabase/config.toml','utf8');
 assert.match(config,/\[functions\.wk100-capture-private-preview\]\s*verify_jwt = true/);
 assert.match(edge,/db\.auth\.getUser\(token\)/);
 assert.match(edge,/\.from\('user_role_assignments'\)/);
 assert.ok(edge.indexOf('isWk100PrivilegedReader(roles.data)')<
   edge.indexOf("Deno.env.get('WK100_CAPTURE_PREVIEW_MANIFEST')"));
 assert.match(edge,/WK100_CAPTURE_PREVIEW_ENABLED/);
 assert.match(edge,/Object\.keys\(payload\)\.length!==1\|\|payload\.action!=='read'/);
 assert.doesNotMatch(edge,/\bfetch\(/);
 assert.doesNotMatch(edge,/\.insert\(|\.upsert\(|\.delete\(/);
});


// WK100_NATIVE_REPLAY_CONSOLIDATED_ACCEPTANCE: immutable row-to-raw proof.
function authorizedReplayFixture() {
 const x=f(), encoder=new TextEncoder();
 const sourceKeys=['apple_ke','youtube_ke'];
 const key='weekly:20261019:20261025:ke';
 const raw=[
   encoder.encode(JSON.stringify({feed:{country:'KE',results:[
     {id:'native_0_0',name:'Song 0',artistName:'Artist'},
     {id:'native_0_1',name:'Song 1',artistName:'Artist'},
   ]}})),
   encoder.encode(JSON.stringify({period:key,trackViews:[
     {chartEntryMetadata:{currentPosition:1},encryptedVideoId:'native_1_0',
       viewCount:250,name:'Song 0',artists:[{name:'Artist'}]},
     {chartEntryMetadata:{currentPosition:2},encryptedVideoId:'native_1_1',
       viewCount:125,name:'Song 1',artists:[{name:'Artist'}]},
   ]})),
 ];
 const archive=new Map();
 x.options.dataset_mode='authorized_candidate';
 for(let i=0;i<2;i++) {
   x.data.wk_chart_capture_contracts_v1[i].source_key=sourceKeys[i];
   x.options.constitution[i].source_key=sourceKeys[i];
   const attempt=x.data.wk_chart_capture_attempts_v1[i];
   attempt.payload_sha256=createHash('sha256').update(raw[i]).digest('hex');
   attempt.raw_object_key=`wk100/private/test/evidence_${i}`;
   archive.set(attempt.raw_object_key,raw[i]);
 }
 x.data.wk_chart_capture_contracts_v1[1].native_metric='rank_and_count';
 x.data.wk_chart_capture_attempts_v1[1].native_period_evidence_ref=key;
 for(const row of x.data.wk_chart_capture_rows_v1) {
   row.source_native_count=row.attempt_id===x.data.wk_chart_capture_attempts_v1[1].id
     ?(row.source_rank===1?250:125):null;
 }
 x.options.readRawBytes=async objectKey=>archive.get(objectKey);
 return {x,archive};
}
test('authorized candidate replays exact raw Apple and weekly YouTube native rows',async()=>{
 const {x}=authorizedReplayFixture();
 const r=await run(x.options);
 assert.equal(r.status,'private_preview');
 assert.equal(r.verified_receipts,2);
 assert.equal(r.resolved_rows,4);
 assert.equal(r.private_audit.dataset_mode,'authorized_candidate');
 assert.equal(r.can_publish,false);
});
test('authorized candidate refuses a stored title or native count not in raw bytes',async()=>{
 const a=authorizedReplayFixture();
 a.x.data.wk_chart_capture_rows_v1[0].title_observed='Edited title';
 await assert.rejects(run(a.x.options),/wk100_reader_native_row_mismatch/);
 const b=authorizedReplayFixture();
 b.x.data.wk_chart_capture_rows_v1[2].source_native_count=999;
 await assert.rejects(run(b.x.options),/wk100_reader_native_row_mismatch/);
});
test('authorized candidate refuses mismatched provider track ID and duplicate rank',async()=>{
 const a=authorizedReplayFixture();
 a.x.data.wk_chart_capture_rows_v1[1].provider_track_id='forged';
 await assert.rejects(run(a.x.options),/wk100_reader_native_row_mismatch/);
 const b=authorizedReplayFixture();
 b.x.data.wk_chart_capture_rows_v1[1].source_rank=1;
 await assert.rejects(run(b.x.options),/wk100_reader_native_row_mismatch/);
});
test('a valid raw digest cannot bless stale database rows',async()=>{
 const a=authorizedReplayFixture(),attempt=a.x.data.wk_chart_capture_attempts_v1[0];
 const revised=new TextEncoder().encode(JSON.stringify({feed:{country:'KE',results:[
   {id:'native_0_0',name:'Different title',artistName:'Artist'},
   {id:'native_0_1',name:'Song 1',artistName:'Artist'},
 ]}}));
 attempt.payload_sha256=createHash('sha256').update(revised).digest('hex');
 a.archive.set(attempt.raw_object_key,revised);
 await assert.rejects(run(a.x.options),/wk100_reader_native_row_mismatch/);
});
test('candidate replay rejects unsupported parser and unmatched native week key',async()=>{
 const a=authorizedReplayFixture();
 a.x.data.wk_chart_capture_contracts_v1[0].source_key='unreviewed_source';
 a.x.options.constitution[0].source_key='unreviewed_source';
 await assert.rejects(run(a.x.options),/wk100_reader_native_replay_unavailable/);
 const b=authorizedReplayFixture();
 b.x.data.wk_chart_capture_attempts_v1[1].native_period_evidence_ref=
   'weekly:20261012:20261018:ke';
 await assert.rejects(run(b.x.options),/wk100_reader_native_replay_unavailable/);
});

}

// WK100 #1329: governed publication proposal is a nonpublishing evidence contract.
const proposalUuid=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const copy=x=>structuredClone(x);
const proposalMethod={
 version:'preview-proxy-v1',
 behavior_weights:{consumption:.5,video_consumption:.5},
 operator_slots:{consumption:1,video_consumption:1},
 minimum_operators:2,minimum_behaviors:2,minimum_corrob_tracks:1,
 maximum_operator_share:1,
};
function proposalSource(n,behavior) {
 const id=proposalUuid(10+n),attempt=proposalUuid(20+n);
 return {
  contract:{id,source_key:`source_${n}`,market:'KE',behavior,native_metric:'rank',expected_depth:100},
  attempt:{id:attempt,contract_id:id,week_start_eat:'2026-10-19',
   status:'succeeded',payload_sha256:n.toString(16).repeat(64),
   observed_depth:100,record_count:100,native_period_authority:'provider_defined',
   native_period_start:'2026-10-18T21:00:00Z',native_period_end:'2026-10-25T21:00:00Z',
   native_period_evidence_ref:'period_ke_week'},
  operator_key:`operator_${n}`,authority_ref:`authority_${n}`,
  rows:Array.from({length:100},(_,i)=>({
   id:proposalUuid(1000+n*100+i),attempt_id:attempt,source_rank:i+1,
   title_observed:`Observed Track ${i+1}`,artist_observed:`Artist ${i+1}`,
  })),
 };
}
async function proposalFixture(methodOverrides={}) {
 const sources=[proposalSource(1,'consumption'),proposalSource(2,'video_consumption')];
 // The two final observations are not yet verified as the same recording.
 const resolutions=sources.flatMap(s=>s.rows.slice(0,99).map((row,i)=>({
  capture_row_id:row.id,recording_id:proposalUuid(2000+i),
 })));
 const projected=buildWk100CaptureRankingInput({
  week_start_eat:'2026-10-19',dataset_mode:'authorized_candidate',
  method:{...proposalMethod,...methodOverrides},sources,resolutions,
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
test('Immutable mixed-recording snapshot, weekly-slot idempotency and deterministic replay',async()=>{
 {
  // mixed resolved/provisional Top 100 becomes sealed NONPUBLISHING proposal

  const f=await proposalFixture(),p=await prepare(f);
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
  assert.equal(p.edition_slot_key,'wk100:KE:2026-10-19');
  assert.equal(Object.isFrozen(p.observed_entries[0].source_observation),true);
  assert.throws(()=>{p.observed_entries[0].original_title='Tampered';},TypeError);
 }
 {
  // same frozen receipt and decisions replay to identical immutable proposal

  const f=await proposalFixture(),a=await prepare(f);
  const b=await prepare(copy(f));
  assert.deepEqual(a,b);
  assert.deepEqual(b.observed_entries.map(x=>x.rank),Array.from({length:100},(_,i)=>i+1));
 }
 {
  // review changes cannot create a second edition slot for the same EAT week

  const f=await proposalFixture(),a=await prepare(f);
  const g=copy(f);g.review.reviewed_at_utc='2026-10-26T10:00:00Z';
  const b=await prepare(g);
  assert.equal(a.edition_slot_key,b.edition_slot_key);
  assert.notEqual(a.proposal_sha256,b.proposal_sha256);
  assert.equal(b.can_publish,false);
 }
});

test('Cryptographic receipt binding and independent scoring replay',async()=>{
 {
  // raw ranking receipt digest and review digest must both bind

  const f=await proposalFixture();
  f.reader_result.private_audit.input_sha256='a'.repeat(64);
  await assert.rejects(prepare(f),/input_digest_mismatch/);
  const g=await proposalFixture();g.review.input_sha256='b'.repeat(64);
  await assert.rejects(prepare(g),/review_input_digest_mismatch/);
 }
 {
  // fake provider-evidence association is rejected even with matched title

  const f=await proposalFixture();
  f.reader_result.provenance[0].provisional_ref='wk100:obs:v1:'+'a'.repeat(64)+':'+proposalUuid(1001);
  await assert.rejects(prepare(f),/provenance_identity_invalid/);
 }
 {
  // altering score contribution cannot turn another observation into source corroboration

  const f=await proposalFixture();f.reader_result.private_audit.top100[0].contributions[0].source_rank=98;
  await assert.rejects(prepare(f),/private_ranking_replay_mismatch/);
 }
 {
  // a forged top rank or scored magnitude cannot pass independent ranking replay

  const a=await proposalFixture();a.reader_result.private_audit.top100[0].score=1000;
  await assert.rejects(prepare(a),/private_ranking_replay_mismatch/);
  const b=await proposalFixture();[b.reader_result.private_audit.top100[0],b.reader_result.private_audit.top100[1]]=
   [b.reader_result.private_audit.top100[1],b.reader_result.private_audit.top100[0]];
  await assert.rejects(prepare(b),/private_ranking_replay_mismatch/);
 }
 {
  // altered source-rank identity association fails original input SHA replay

  const a=await proposalFixture();
  const row=a.reader_result.provenance.find(x=>x.source_key==='source_1'&&x.source_rank===1);
  row.recording_id=proposalUuid(900000);
  await assert.rejects(prepare(a),/independent_input_replay_mismatch/);
 }
});

test('Observed display evidence, source attempts and exact ranked coverage',async()=>{
 {
  // wrong observed label or missing original text fails closed

  const f=await proposalFixture();
  f.review.labels[0].capture_row_id=proposalUuid(999999);
  await assert.rejects(prepare(f),/observed_label_unverifiable/);
  const g=await proposalFixture();g.reader_result.provenance.find(x=>x.source_rank===1).artist_observed='';
  await assert.rejects(prepare(g),/observed_label_unverifiable/);
 }
 {
  // no truncated Top100, phantom independent provider, duplicate position or incomplete source ranks

  const a=await proposalFixture();a.reader_result.private_audit.top100.pop();
  await assert.rejects(prepare(a),/private_ranking_replay_mismatch/);
  const b=await proposalFixture();b.reader_result.private_audit.source_manifest[1].operator_key='operator_1';
  await assert.rejects(prepare(b),/source_provenance_invalid/);
  const c=await proposalFixture();c.review.labels[1].position=1;
  await assert.rejects(prepare(c),/label_selection_invalid/);
  const d=await proposalFixture();d.reader_result.provenance.pop();
  await assert.rejects(prepare(d),/provenance_depth_mismatch/);
 }
 {
  // source rows cannot switch attempts or reuse an attempt as independent provider evidence

  const a=await proposalFixture(),row=a.reader_result.provenance[0];
  row.attempt_id=a.reader_result.selected_attempt_ids[1];
  await assert.rejects(prepare(a),/source_attempt_mismatch|attempt_reused_between_sources/);
  const b=await proposalFixture();
  b.reader_result.provenance.filter(x=>x.source_key==='source_2').forEach(x=>{
   x.attempt_id=b.reader_result.selected_attempt_ids[0];
  });
  await assert.rejects(prepare(b),/attempt_reused_between_sources/);
 }
});

test('EAT deadline, editorial exception review and nonpublishing authority',async()=>{
 {
  // deadline is explicit in EAT week, and review must be between cutoff and deadline

  const a=await proposalFixture();a.cutoff_at_utc='2026-10-25T20:59:59Z';
  await assert.rejects(prepare(a),/deadline_outside_weekly_window/);
  const b=await proposalFixture();b.review.reviewed_at_utc='2026-10-26T21:00:01Z';
  await assert.rejects(prepare(b),/review_timing_invalid/);
  const c=await proposalFixture();c.deadline_at_utc='2026-11-03T00:00:00Z';
  await assert.rejects(prepare(c),/deadline_outside_weekly_window/);
 }
 {
  // preview quality warnings need exact documented editorial dispositions, not invented evidence

  const f=await proposalFixture({minimum_corrob_tracks:100});
  assert.deepEqual(f.reader_result.private_audit.failures,['insufficient_cross_operator_corroboration']);
  await assert.rejects(prepare(f),/review_dispositions_missing/);
  f.review.dispositions=[{code:'insufficient_cross_operator_corroboration',
   rationale:'Unverified cross-source equivalence is not counted as corroboration.'}];
  const p=await prepare(f);
  assert.equal(p.can_publish,false);
  assert.deepEqual(p.editor_review.dispositions,f.review.dispositions);
 }
 {
  // private preview never authenticates itself as a publishing permission

  const a=await proposalFixture();a.reader_result.can_publish=true;
  await assert.rejects(prepare(a),/reader_result_invalid/);
  const b=await proposalFixture();b.reader_result.private_audit.dataset_mode='synthetic';
  await assert.rejects(prepare(b),/audit_not_publishing_authority/);
  const c=await proposalFixture();c.constitution_sha256='unknown';
  await assert.rejects(prepare(c),/constitution_authority_missing/);
 }
});

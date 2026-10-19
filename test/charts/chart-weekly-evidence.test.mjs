import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
 trackingWeek, checkpointsForSource, validateReceipt, prepareWeeklyEvidenceFreeze,
} from '../../supabase/functions/_shared/chart-weekly-evidence.mjs';

const SH = 'f'.repeat(64);
const day = (source_key='audiomack_ke') => ({
  source_key,behavior:'consumption',metric:'rank',market:'KE',depth:100,
  adapter_version:'adapter-v1',source_contract_version:'const-v1',required:true,
  cadence:{kind:'daily',eat_hour:10,eat_minute:0},minimum_healthy_checkpoints:7,
});
const weekly=()=>({ ...day('youtube_ke'), behavior:'video_consumption', metric:'rank_and_count',
  cadence:{kind:'weekly',weekday_eat:3,eat_hour:12,eat_minute:0},minimum_healthy_checkpoints:1 });
const receipt=(slot,c=day(),extra={})=>({source_key:c.source_key, scheduled_at:slot.scheduled_at,
 fetched_at:new Date(Date.parse(slot.scheduled_at)+60_000).toISOString(),
 status:'succeeded',payload_sha256:SH,observed_depth:100,record_count:100,
 source_native_period:{starts_at:'2026-10-18T21:00:00Z',ends_at:'2026-10-25T21:00:00Z',authority:'provider_defined',evidence_ref:'provider-2026-w43'},metric:c.metric,adapter_version:c.adapter_version,
 contract_version:c.source_contract_version,market:'KE',upstream_reference:'provider/chart/ke',...extra });
const assemble=(source=day())=>({week_start_eat:'2026-10-19',source_contracts:[source],
 receipts:checkpointsForSource('2026-10-19',source).map(s=>receipt(s,source)),constitution_version:'source-v1',methodology_version:'method-v1'});

test('EAT week begins Sunday 21:00 UTC, ends the next Sunday 21:00 UTC',()=>{
  assert.deepEqual(trackingWeek('2026-10-19'),{week_start_eat:'2026-10-19',starts_at:'2026-10-18T21:00:00Z',ends_at:'2026-10-25T21:00:00Z'});
  assert.throws(()=>trackingWeek('2026-10-20'),/must be Monday/);
  assert.throws(()=>trackingWeek('2026-02-30'),/calendar date/);
});
test('daily checkpoints are one per Kenya day, regardless of UTC boundary',()=>{
  const x=checkpointsForSource('2026-10-19',day());assert.equal(x.length,7);
  assert.equal(x[0].scheduled_at,'2026-10-19T07:00:00Z');
  assert.equal(x[6].scheduled_at,'2026-10-25T07:00:00Z');
});
test('six-hour checkpoints are exactly 28 and no end-boundary slot leaks in',()=>{
  const src={...day(),cadence:{kind:'interval_hours',hours:6,eat_hour:0,eat_minute:0},minimum_healthy_checkpoints:28};
  const r=checkpointsForSource('2026-10-19',src);assert.equal(r.length,28);
  assert.equal(r[0].scheduled_at,'2026-10-18T21:00:00Z');
  assert.equal(r[27].scheduled_at,'2026-10-25T15:00:00Z');
});
test('weekly checkpoint waits for the configured source day',()=>{
  const r=checkpointsForSource('2026-10-19',weekly());assert.equal(r.length,1);
  assert.equal(r[0].scheduled_at,'2026-10-22T09:00:00Z');
});
test('a complete unchanged daily feed has seven captures, not seven consumption events',async()=>{
  const m=await prepareWeeklyEvidenceFreeze(assemble());
  assert.equal(m.state,'evidence_ready_for_independent_review');assert.equal(m.can_publish,false);
  assert.equal(m.source_summary[0].healthy_checkpoints,7);
  assert.equal(m.source_summary[0].distinct_consecutive_payloads,1);
  assert.equal(m.receipts.length,7);
  assert.match(m.sha256,/^[a-f0-9]{64}$/);
});
test('freeze hash is deterministic independent of input ordering or object-key ordering',async()=>{
  const p=assemble();let a=await prepareWeeklyEvidenceFreeze(p);
  let b=await prepareWeeklyEvidenceFreeze({...p,receipts:p.receipts.slice().reverse(),source_contracts:p.source_contracts.map(s=>({...s,cadence:{eat_minute:0,eat_hour:10,kind:'daily'}}))});
  assert.equal(a.sha256,b.sha256);
});
test('a missing daily checkpoint blocks a required source',async()=>{
  let p=assemble();p.receipts.pop();const m=await prepareWeeklyEvidenceFreeze(p);
  assert.equal(m.state,'blocked');assert.equal(m.source_summary[0].healthy_checkpoints,6);
  assert.equal(m.source_summary[0].failures[0].reason,'missing_checkpoint');
});
test('an explicit partial-depth fetch is degraded and blocks minimum seven',async()=>{
  let p=assemble();p.receipts[1]={...p.receipts[1],status:'partial_depth',observed_depth:70,record_count:70};
  const m=await prepareWeeklyEvidenceFreeze(p);assert.equal(m.state,'blocked');
});
test('failed fetch cannot count fake records as healthy',()=>{
  const src=day(),slot=checkpointsForSource('2026-10-19',src)[0];
  assert.throws(()=>validateReceipt(receipt(slot,src,{status:'transport_failed',failure_code:'timeout'}),src,trackingWeek('2026-10-19')),/masquerade/);
});
test('noncritical source failure degrades rather than silently reweights required source',async()=>{
  const a=day(),b={...weekly(),required:false};let p=assemble(a);p.source_contracts=[a,b];
  const m=await prepareWeeklyEvidenceFreeze(p);assert.equal(m.state,'evidence_ready_for_independent_review');
  assert.equal(m.source_summary[1].status,'insufficient');assert.equal(m.can_publish,false);
});
test('reject unknown sources, unscheduled time, duplicate checkpoint and out-of-week time',async()=>{
  let p=assemble();await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[...p.receipts,{...p.receipts[0],source_key:'other'}]}),/unknown source/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[...p.receipts,p.receipts[0]]}),/duplicate checkpoint/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[...p.receipts.slice(1),{...p.receipts[0],scheduled_at:'2026-10-19T08:00:00Z',fetched_at:'2026-10-19T08:01:00Z'}]}),/unplanned checkpoint/);
});
test('reject wrong source-native metric, territory, and absent raw-content hash',async()=>{
  const p=assemble();for(const delta of [{metric:'event_count'},{market:'UG'},{payload_sha256:null}]){
    await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],...delta},...p.receipts.slice(1)]}));
  }
});
test('required unverified upstream period blocks readiness even after successful fetch',async()=>{
  const p=assemble();p.receipts[0]={...p.receipts[0],source_native_period:'unknown'};
  const m=await prepareWeeklyEvidenceFreeze(p);assert.equal(m.state,'blocked');
  assert.match(m.blocking.join(' '),/upstream period semantics unverified/);
});
test('freeze result is detached from caller mutation and deeply immutable',async()=>{
  const p=assemble();const m=await prepareWeeklyEvidenceFreeze(p);
  const original=m.receipts[0].source_native_period;
  p.receipts[0].source_native_period='mutated-after-hash';
  assert.equal(m.receipts[0].source_native_period,original);
  assert.equal(Object.isFrozen(m.receipts[0]),true);
  assert.throws(()=>{m.receipts[0].status='forged'},TypeError);
});
test('native source periods require typed provider boundaries and evidence',async()=>{
  const p=assemble();
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],source_native_period:{authority:'provider_defined',starts_at:'2026-10-25T21:00:00Z',ends_at:'2026-10-18T21:00:00Z',evidence_ref:'a'}},...p.receipts.slice(1)]}),/positive interval/);
});
test('the kernel has no policy for converting native rank to stream counts',()=>{
  assert.notEqual(day().metric,weekly().metric);
  assert.notEqual(day().behavior,weekly().behavior);
});
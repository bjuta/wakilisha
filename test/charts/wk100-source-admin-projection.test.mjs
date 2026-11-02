import test from 'node:test';
import assert from 'node:assert/strict';
import { validEatWeek, projectWk100SourceHealth } from '../../supabase/functions/_shared/wk100-source-admin-projection.mjs';

test('WK100 source read model preserves empty real Production state',()=>{
  const model=projectWk100SourceHealth([],[],'2026-11-02');
  assert.equal(model.sourceCount,0);
  assert.equal(model.qualifiedSources,0);
  assert.equal(model.successfulSources,0);
  assert.equal(model.canPublish,false);
});
test('WK100 source read never upgrades capture success into scoring qualification',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const model=projectWk100SourceHealth([
    {id,source_key:'apple_ke',provider_key:'apple',source_surface:'Apple Kenya',market:'KE',
      native_metric:'rank',behavior:'consumption',expected_depth:100,cadence_kind:'weekly',
      eat_hour:9,eat_minute:30,weekday_eat:2,interval_hours:null,
      minimum_healthy_checkpoints:1,adapter_version:'apple-v1',adapter_sha256:'b'.repeat(64),
      contract_version:'v1'}],
    [{contract_id:id,week_start_eat:'2026-11-02',status:'succeeded',created_at:'2026-11-02T09:00:00Z',
      fetched_at:'2026-11-02T09:00:00Z',observed_depth:100,
      payload_sha256:'a'.repeat(64),native_period_authority:'unknown',raw_object_key:'private/secret'}],
    '2026-11-02');
  assert.equal(model.successfulSources,1);
  assert.equal(model.qualifiedSources,0);
  assert.equal(model.sources[0].admissionState,'candidate');
  assert.equal(model.sources[0].canScore,false);
  assert.equal(model.sources[0].eatHour,9);
  assert.equal(model.sources[0].eatMinute,30);
  assert.equal(model.sources[0].weekdayEat,2);
  assert.equal(model.sources[0].minimumHealthyCheckpoints,1);
  assert.equal(model.sources[0].adapterVersion,'apple-v1');
  assert.equal('adapter_sha256' in model.sources[0],false);
  assert.equal('raw_object_key' in model.sources[0],false);
  assert.equal(model.sources[0].recentAttempts.length,1);
  assert.equal(model.sources[0].recentAttempts[0].status,'succeeded');
  assert.equal('raw_object_key' in model.sources[0].recentAttempts[0],false);
  assert.equal(model.sources[0].canPublish,false);
});
test('invalid week, malformed lists and overlarge input fail closed',()=>{
  assert.equal(validEatWeek('2026-11-03'),false);
  assert.equal(validEatWeek('2026-11-02'),true);
  assert.throws(()=>projectWk100SourceHealth([],[],'2026-11-03'),/week_invalid/);
  assert.throws(()=>projectWk100SourceHealth(null,[],'2026-11-02'),/unavailable/);
  assert.throws(()=>projectWk100SourceHealth(Array(101).fill({}),[],'2026-11-02'),/unavailable/);
});

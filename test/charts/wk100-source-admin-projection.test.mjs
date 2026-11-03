import test from 'node:test';
import assert from 'node:assert/strict';
import { validEatWeek, projectWk100SourceHealth } from '../../supabase/functions/_shared/wk100-source-admin-projection.mjs';
import { validateWk100SourceProposal } from '../../supabase/functions/_shared/wk100-source-proposal-v1.mjs';
import { resolveCaptureParser, parseCaptureNativeRows } from '../../supabase/functions/_shared/chart-capture-runtime.mjs';

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

// Reuse the existing WK100 source domain contract suite. No new CI file.
const wk100CandidateProposal=()=>({
  providerKey:'apple_ke',sourceKey:'apple_ke_weekly_songs',surface:'Apple Music Kenya most played',
  methodClass:'provider_api',behavior:'consumption',metric:'rank',
  expectedDepth:100,cadence:'weekly',intervalHours:null,
  eatHour:12,eatMinute:0,weekdayEat:0,minimumHealthyCheckpoints:1,
  evidenceReference:'wk100-apple-kenya-method-v1',reason:null,
});
test('source proposals remain unadmitted and cannot collect, score or publish',()=>{
  const model=validateWk100SourceProposal(wk100CandidateProposal());
  assert.equal(model.state,'proposed');
  assert.equal(model.market,'KE');
  assert.equal(model.canCollect,false);
  assert.equal(model.canScore,false);
  assert.equal(model.canPublish,false);
  assert.equal(Object.isFrozen(model),true);
});
test('source proposal rejects forged authority and arbitrary provider egress',()=>{
  for(const extra of [
    {admissionState:'qualified'},{enabled:true},{endpoint:'https://evil.example/'},
    {authorization_ref:'fabricated'},{canPublish:true},{actorUserId:'forged'},
    {adapterSha256:'a'.repeat(64)},
  ])assert.throws(()=>validateWk100SourceProposal({...wk100CandidateProposal(),...extra}),
    /proposal_fields_invalid/);
  for(const bad of [
    {sourceKey:'arbitrary_host'},
    {providerKey:'unsupported'},
    {providerKey:'youtube_ke'},
    {sourceKey:'apple_ke'},
    {behavior:'video_consumption',metric:'event_count'},
    {evidenceReference:'https://host/path?token=secret'},
    {expectedDepth:501},{cadence:'weekly',weekdayEat:7},
    {cadence:'weekly',intervalHours:3},
  ])assert.throws(()=>validateWk100SourceProposal({...wk100CandidateProposal(),...bad}));
});
test('candidate cadence validation stays bounded by existing EAT kernel vocabulary',()=>{
  const daily={...wk100CandidateProposal(),cadence:'daily',weekdayEat:null,
    minimumHealthyCheckpoints:7};
  const hourly={...daily,cadence:'interval_hours',intervalHours:3,
    minimumHealthyCheckpoints:56};
  assert.equal(validateWk100SourceProposal(daily).cadence,'daily');
  assert.equal(validateWk100SourceProposal(hourly).intervalHours,3);
  for(const candidate of [{...hourly,minimumHealthyCheckpoints:57},
    {...hourly,intervalHours:2},{...daily,minimumHealthyCheckpoints:8}])
    assert.throws(()=>validateWk100SourceProposal(candidate),/cadence_invalid/);
});
// Error and negative-revision tests stay in the single existing source contract suite.
test('source proposal cannot smuggle internal authority into persisted payload',()=>{
  const input=wk100CandidateProposal();
  for(const field of ['revision','actor','state','canCollect','approved','scheduledAt',
    'credential','authorization_ref','nativePeriodAuthority']){
    assert.throws(()=>validateWk100SourceProposal({...input,[field]:'forged'}),
      /proposal_fields_invalid/);
  }
  assert.throws(()=>validateWk100SourceProposal({...input,reason:'line\nbreak'}),/reason_invalid/);
});

test('multiple independent source IDs under one provider retain separate revisions',()=>{
  const first=wk100CandidateProposal();
  const second={...first,sourceKey:'apple_ke_top_albums'};
  assert.equal(validateWk100SourceProposal(first).sourceKey,'apple_ke_weekly_songs');
  assert.equal(validateWk100SourceProposal(second).providerKey,'apple_ke');
  assert.equal(validateWk100SourceProposal(second).sourceKey,'apple_ke_top_albums');
  for(const invalid of [
    {...first,sourceKey:'apple_ke'},
    {...first,sourceKey:'youtube_ke_weekly_songs'},
    {...first,providerKey:'youtube_ke'},
    {...first,sourceKey:'apple_ke_bad-name'},
    {...first,sourceKey:'apple_ke_'},
    {...first,sourceKey:'apple_ke_'+ 'x'.repeat(60)},
    {...first,providerKey:'bad_provider'},
    {...first,sourceKey:'apple_ke_weekly_songs',endpoint:'https://invalid.example'},
  ])assert.throws(()=>validateWk100SourceProposal(invalid));
  assert.equal(validateWk100SourceProposal(first).canCollect,false);
  assert.equal(validateWk100SourceProposal(second).canPublish,false);
});

test('WK100 provider-scoped source parser requires independently sealed native class',()=>{
  const youtube={provider_key:'youtube_ke',source_key:'youtube_ke_top_songs_weekly',
    market:'KE',behavior:'video_consumption',native_metric:'rank_and_count',expected_depth:100};
  const access={parser_class:'youtube_kenya_weekly_top_songs_v1',native_period_key:'weekly:20261102:20261108:ke'};
  assert.equal(resolveCaptureParser(youtube,access)?.providerKey,'youtube_ke');
  assert.equal(resolveCaptureParser({...youtube,source_key:'youtube_ke_second_weekly'},access)?.legacy,false);
  assert.equal(resolveCaptureParser({...youtube,source_key:'youtube_ke'},{}).legacy,true);
  for(const [contract,manifest] of [
    [youtube,{}],[youtube,{parser_class:'apple_kenya_chart_v1'}],
    [{...youtube,provider_key:'apple_ke'},access],
    [{...youtube,source_key:'spotify_ke_playlist'},access],
    [{...youtube,source_key:'youtube_ke_bad-name'},access],
  ]) assert.equal(resolveCaptureParser(contract,manifest),null);
  assert.throws(()=>parseCaptureNativeRows(new TextEncoder().encode('{}'),youtube,{}),
    e=>e?.code==='source_unimplemented');
  // A YouTube playlist listing has no native weekly Top Songs trackViews.
  assert.throws(()=>parseCaptureNativeRows(new TextEncoder().encode(JSON.stringify({
    period:access.native_period_key,playlistItems:[{videoId:'one'}]})),youtube,access));
  const apple={provider_key:'apple_ke',source_key:'apple_ke_catalog_most_played'};
  assert.equal(resolveCaptureParser(apple,{parser_class:'apple_kenya_chart_v1'})?.providerKey,'apple_ke');
});

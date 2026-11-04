import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { validEatWeek, projectWk100SourceHealth } from '../../supabase/functions/_shared/wk100-source-admin-projection.mjs';
import { validateWk100SourceProposal } from '../../supabase/functions/_shared/wk100-source-proposal-v1.mjs';
import { resolveCaptureParser, parseCaptureNativeRows } from '../../supabase/functions/_shared/chart-capture-runtime.mjs';
import { parseAppleKenyaPublicHtml, WK100_APPLE_KE_PUBLIC_CHART_URL,
  parseAudiomackKenya, WK100_AUDIOMACK_KE_PUBLIC_CHART_URL } from '../../supabase/functions/_shared/chart-public-source-observations.mjs';
import { planWk100SourceDispatch, selectWk100AuditedDispatch } from '../../supabase/functions/_shared/wk100-source-dispatch-plan.mjs';
import { fetchCandidateBytes, sha256Hex } from '../../supabase/functions/_shared/chart-candidate-capture.mjs';
import { bindWk100DispatchAuthority, wk100EatWeekFromUtc, isWk100CaptureConstitutionCurrent } from '../../supabase/functions/_shared/wk100-source-scheduler-authority.mjs';
import { validateWk100SourceMethodDecision, validateWk100ContractEnrollmentIntent } from '../../supabase/functions/_shared/wk100-source-method-decision-v1.mjs';

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
    [{contract_id:id,week_start_eat:'2026-11-02',status:'succeeded',scheduled_at:'2026-11-02T08:55:00Z',attempt_number:1,created_at:'2026-11-02T09:00:00Z',
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
  assert.equal(model.sources[0].lastScheduledAt,'2026-11-02T08:55:00Z');
  assert.equal(model.sources[0].lastAttemptNumber,1);
  assert.equal(model.sources[0].recentAttempts[0].scheduledAt,'2026-11-02T08:55:00Z');
  assert.equal(model.sources[0].recentAttempts[0].attemptNumber,1);
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

test('WK100 five-core public-source preflight has YouTube and no paid or dropped platform',()=>{
  // Execute the real preflight's NO_NETWORK mode, not a copied provider list.
  const r=spawnSync(process.execPath,[
    'scripts/acceptance/wk100-phase1-six-source-live-probe.mjs','--dry-run',
  ],{encoding:'utf8',timeout:10_000});
  assert.equal(r.status,0,r.stderr);
  const report=JSON.parse(r.stdout);
  assert.equal(report.mode,'NO_NETWORK');
  assert.deepEqual(report.providers.map(x=>x.provider),[
    'apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke',
  ]);
  assert.equal(report.providers[3].url,'https://charts.youtube.com/charts/TopSongs/ke');
  assert.match(report.providers[3].reason,/weekly original response.*unverified/);
  assert.ok(report.providers.every(x=>x.url?.startsWith('https://')));
  // These method probes do not expand the core roster, grant a source
  // admission, or turn four editorial playlists into four platforms.
  assert.deepEqual(report.supplementaryEditorial.map(x=>x.source),[
    'spotify_editorial_hot_hits_ke','spotify_editorial_nmf_ke',
    'spotify_editorial_made_in_ke','spotify_editorial_gengetone_fire',
  ]);
  assert.ok(report.supplementaryEditorial.every(x=>x.provider==='spotify_ke'&&
    x.signal==='editorial_placement_not_streams'));
  assert.deepEqual(report.routeCandidates.map(x=>[x.provider,x.method]),[
    ['youtube_ke','POST'],['audiomack_ke','GET'],
  ]);
  assert.ok(report.routeCandidates.every(x=>x.status==='research_method_not_admitted'));
  assert.equal(report.routeCandidates[0].url,
    'https://charts.youtube.com/youtubei/v1/browse?alt=json');
  assert.equal(report.routeCandidates[1].url,
    'https://api.audiomack.com/v1/playlist/geo-charts/kenya');
});

test('WK100 Audiomack public title metadata is candidate-only with no invented song ID or period',()=>{
  const tags=Array.from({length:100},(_,i)=>
    '<meta property="music:song" content="Synthetic Title '+(i+1)+'">').join('');
  const html='<title>Weekly 100: Kenya - Audiomack</title>'+tags;
  const access={endpoint:WK100_AUDIOMACK_KE_PUBLIC_CHART_URL,
    parser_class:'audiomack_kenya_chart_v1'};
  const contract={source_key:'audiomack_ke_public_weekly',provider_key:'audiomack_ke',
    adapter_version:'audiomack_kenya_chart_v1',expected_depth:100,
    native_metric:'rank',behavior:'consumption'};
  const parsed=parseAudiomackKenya(html,access);
  assert.equal(parsed.chart_surface,'audiomack_public_kenya_weekly_100_title_metadata');
  assert.equal(parsed.rank_authority,'metadata_order_requires_independent_verification');
  assert.equal(parsed.artist_authority,'unverified');
  assert.equal(parsed.provider_track_identity_authority,'unverified');
  assert.equal(parsed.native_period,'unknown');
  assert.equal(parsed.candidate_only,true);
  assert.equal(parsed.eligible_for_scoring,false);
  assert.equal(parsed.rows.length,100);
  assert.equal(parsed.rows[0].title,'Synthetic Title 1');
  assert.equal(parsed.rows[0].provider_track_id,null);
  // Research can read this first-party metadata, but no authoritative
  // display-order proof exists. Collector row commitment must fail closed.
  assert.throws(()=>parseCaptureNativeRows(new TextEncoder().encode(html),contract,access),
    /source_rank_unverified/);
  for(const bad of [
    html.replace('Weekly 100: Kenya','Top 100: Worldwide'),
    html.replace('Synthetic Title 100',''),
    html.replace('<meta property="music:song" content="Synthetic Title 100">',''),
    html+'<meta property="music:song" content="Synthetic Title 101">',
    html.replace('Synthetic Title 1','https://audiomack.com/some/song'),
  ])assert.throws(()=>parseAudiomackKenya(bad,access),/audiomack_/);
  for(const endpoint of [
    null,'https://audiomack.com/geo-charts/playlist/nigeria',
    'https://untrusted.example/geo-charts/playlist/kenya',
  ])assert.throws(()=>parseAudiomackKenya(html,{endpoint}),/audiomack_public_titles_unqualified/);
});

test('WK100 public Apple Kenya Top 100 is collector-parsable without API credentials',()=>{
  const urls=Array.from({length:100},(_,i)=>
    'https://music.apple.com/ke/song/synthetic-'+(i+1)+'/'+(100000+i));
  const meta='<meta property="music:song_count" content="100">'+
    urls.map((url,i)=>'<meta property="music:song" content="'+url+'">'+
      '<meta property="music:song:track" content="'+(i+1)+'">').join('');
  const playlist={'@type':'MusicPlaylist',numTracks:100,track:urls.map((url,i)=>({
    '@type':'MusicRecording',url,name:'Synthetic Song '+(i+1),duration:'PT3M12S',
  }))};
  const html=meta+'<script type="application/ld+json">'+
    JSON.stringify(playlist)+'</script>';
  const access={parser_class:'apple_kenya_chart_v1',
    endpoint:WK100_APPLE_KE_PUBLIC_CHART_URL};
  const contract={provider_key:'apple_ke',source_key:'apple_ke_public_top100',
    adapter_version:'apple_kenya_chart_v1',
    expected_depth:100,native_metric:'rank',behavior:'consumption'};
  const parsed=parseAppleKenyaPublicHtml(html,access);
  assert.equal(parsed.candidate_only,true);
  assert.equal(parsed.eligible_for_scoring,false);
  assert.equal(parsed.native_period,'unknown');
  assert.equal(parsed.chart_surface,'apple_public_daily_top_100');
  assert.equal(parsed.rows.length,100);
  const collector=parseCaptureNativeRows(new TextEncoder().encode(html),contract,access);
  assert.equal(collector.length,100);
  assert.equal(collector[0].provider_track_id,'100000');
  assert.equal(collector[99].rank,100);
  assert.equal(Object.hasOwn(collector[0],'view_count'),false);
  assert.equal(Object.hasOwn(collector[0],'source_native_count'),false);
  // Parser alone cannot grant SQL admission, scheduling or publication.
  for(const mutated of [
    meta+'<script type="application/ld+json">'+JSON.stringify({
      ...playlist,track:[{...playlist.track[0],url:urls[1]},...playlist.track.slice(1)],
    })+'</script>',
    html.replace('music:song_count" content="100"','music:song_count" content="99"'),
    html.replace('music:song:track" content="100"','music:song:track" content="1"'),
    html+'<script type="application/ld+json">'+JSON.stringify(playlist)+'</script>',
  ])assert.throws(()=>parseAppleKenyaPublicHtml(mutated,access),/apple_public_chart_/);
  for(const endpoint of [
    undefined,'https://music.apple.com/us/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172',
    'https://evil.example/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172',
  ])assert.throws(()=>parseAppleKenyaPublicHtml(html,{endpoint}),/apple_public_chart_endpoint_unverified/);
});

test('WK100 five selected core provider parsers remain explicitly resolved, not admitted',()=>{
  const core={
    apple_ke:'apple_kenya_chart_v1',
    shazam_ke:'shazam_kenya_discovery_v1',
    mdundo_ke:'mdundo_kenya_chart_v1',
    youtube_ke:'youtube_kenya_weekly_top_songs_v1',
    audiomack_ke:'audiomack_kenya_chart_v1',
  };
  assert.deepEqual(Object.keys(core),['apple_ke','shazam_ke','mdundo_ke',
    'youtube_ke','audiomack_ke']);
  for(const [provider,parserClass] of Object.entries(core)){
    const contract={provider_key:provider,source_key:provider+'_verified_candidate',
      adapter_version:parserClass};
    assert.equal(resolveCaptureParser(contract,{parser_class:parserClass})?.providerKey,
      provider,provider);
    assert.equal(resolveCaptureParser(contract,{parser_class:'unreviewed_parser_class_v1'}),
      null,provider);
  }
  assert.equal(resolveCaptureParser({source_key:'spotify_ke',provider_key:'spotify_ke'},{}),null);
  // A parser is not an approved source or acquisition method. SQL and the
  // authenticated review constitution remain independently required.
});

test('WK100 provider-scoped source parser requires independently sealed native class',()=>{
  const youtube={provider_key:'youtube_ke',source_key:'youtube_ke_top_songs_weekly',
    market:'KE',behavior:'video_consumption',native_metric:'rank_and_count',expected_depth:100,
    adapter_version:'youtube_kenya_weekly_top_songs_v1'};
  const access={parser_class:'youtube_kenya_weekly_top_songs_v1',native_period_key:'weekly:20261102:20261108:ke'};
  assert.equal(resolveCaptureParser(youtube,access)?.providerKey,'youtube_ke');
  assert.equal(resolveCaptureParser({...youtube,source_key:'youtube_ke_second_weekly'},access)?.legacy,false);
  assert.equal(resolveCaptureParser({...youtube,source_key:'youtube_ke'},{}).legacy,true);
  assert.equal(resolveCaptureParser({source_key:'mdundo_ke'},{}).legacy,true);
  // Existing immutable Apple/YouTube replay fixtures carry older provider
  // identifiers; the source key was already the accepted parser authority.
  assert.equal(resolveCaptureParser({...youtube,source_key:'apple_ke',
    provider_key:'provider_0',adapter_version:'fixture-v1'},{}).providerKey,'apple_ke');
  assert.equal(resolveCaptureParser({...youtube,source_key:'youtube_ke',
    provider_key:'provider_1',adapter_version:'fixture-v1'},{}).providerKey,'youtube_ke');
  // A known but conflicting provider parser must still fail closed.
  assert.equal(resolveCaptureParser({...youtube,source_key:'youtube_ke',provider_key:'apple_ke'},{}),null);
  assert.equal(resolveCaptureParser({...youtube,adapter_version:'unrelated-parser'},access),null);
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
  const apple={provider_key:'apple_ke',source_key:'apple_ke_catalog_most_played',adapter_version:'apple_kenya_chart_v1'};
  assert.equal(resolveCaptureParser(apple,{parser_class:'apple_kenya_chart_v1'})?.providerKey,'apple_ke');
});

const wk100PlanFixture=week=>({
  weekStartEat:week,nowUtc:week+'T06:05:00Z',executionEnabled:true,
  sourceContracts:[{
    id:'11111111-1111-4111-8111-111111111111',
    source_key:'youtube_ke_top_songs_weekly',provider_key:'youtube_ke',
    contract_version:'v1',market:'KE',behavior:'video_consumption',
    native_metric:'rank_and_count',expected_depth:100,
    adapter_version:'youtube_kenya_weekly_top_songs_v1',
    cadence_kind:'weekly',interval_hours:null,eat_hour:9,eat_minute:0,
    weekday_eat:0,minimum_healthy_checkpoints:1,
  }],
  approvedDecisions:[{
    source_key:'youtube_ke_top_songs_weekly',provider_key:'youtube_ke',
    contract_version:'v1',state:'collector_admitted',enabled:true,
    native_period_state:'provider_defined',native_period_evidence_ref:'provider_week',
    parser_class:'youtube_kenya_weekly_top_songs_v1',
    evidence_sha256:'a'.repeat(64),endpoint_sha256:'b'.repeat(64),
    constitution_version:'wk100-test-v1',authorization_ref:'test_approved_access',
    authorization_expires_at:'2027-01-01T00:00:00Z',
  }],
  attempts:[],
});
test('WK100 two prospective EAT weeks remain independent synthetic dispatch slots',()=>{
  const first=planWk100SourceDispatch(wk100PlanFixture('2026-11-02'));
  const second=planWk100SourceDispatch(wk100PlanFixture('2026-11-09'));
  assert.equal(first.jobs.length,1);
  assert.equal(second.jobs.length,1);
  assert.equal(first.jobs[0].scheduled_at,'2026-11-02T06:00:00Z');
  assert.equal(second.jobs[0].scheduled_at,'2026-11-09T06:00:00Z');
  assert.notEqual(first.jobs[0].scheduled_at,second.jobs[0].scheduled_at);
  assert.equal(first.canScore,false);assert.equal(second.canPublish,false);
});
test('WK100 dispatch requires explicit enable, admitted authority and native period',()=>{
  const f=wk100PlanFixture('2026-11-02');
  assert.equal(planWk100SourceDispatch({...f,executionEnabled:false}).jobs.length,0);
  for(const decision of [
    {...f.approvedDecisions[0],state:'proposed'},
    {...f.approvedDecisions[0],enabled:false},
    {...f.approvedDecisions[0],native_period_state:'unknown'},
    {...f.approvedDecisions[0],authorization_expires_at:'2026-11-01T00:00:00Z'},
    {...f.approvedDecisions[0],evidence_sha256:null},
    {...f.approvedDecisions[0],parser_class:'apple_kenya_chart_v1'},
  ]) {
    const r=planWk100SourceDispatch({...f,approvedDecisions:[decision]});
    assert.equal(r.jobs.length,0);assert.ok(r.blocked.length);
  }
});
test('WK100 committed, quarantined, unsafe or exhausted retries never duplicate a source observation',()=>{
  const f=wk100PlanFixture('2026-11-02');
  const receipt={contract_id:f.sourceContracts[0].id,scheduled_at:'2026-11-02T06:00:00Z',attempt_number:1};
  for(const status of ['succeeded','partial_depth','parse_failed','target_period_unavailable','reserved']) {
    const p=planWk100SourceDispatch({...f,attempts:[{...receipt,status}]});
    assert.equal(p.jobs.length,0);
  }
  const retry=planWk100SourceDispatch({...f,attempts:[{...receipt,status:'transport_failed'}]});
  assert.equal(retry.jobs.length,1);assert.equal(retry.jobs[0].attempt_number,2);
  const exhausted=planWk100SourceDispatch({...f,attempts:Array.from({length:8},(_,i)=>({
    ...receipt,attempt_number:i+1,status:'transport_failed',
  }))});
  assert.equal(exhausted.jobs.length,0);
  const late=planWk100SourceDispatch({...f,nowUtc:'2026-11-02T06:21:00Z'});
  assert.equal(late.jobs.length,0);
});

test('WK100 scheduler never dispatches a retry without exact audited contract, week, slot and attempt',()=>{
  const f=wk100PlanFixture('2026-11-02');
  const contract=f.sourceContracts[0];
  const slot='2026-11-02T06:00:00Z';
  const first=planWk100SourceDispatch(f);
  assert.equal(selectWk100AuditedDispatch({
    jobs:first.jobs,sourceContracts:f.sourceContracts,retryRequests:[],
  }).jobs.length,1); // normal first attempt remains eligible
  const failed={contract_id:contract.id,scheduled_at:'2026-11-02T06:00:00+00:00',
    attempt_number:1,status:'transport_failed'};
  const retry=planWk100SourceDispatch({...f,attempts:[failed]});
  assert.equal(retry.jobs[0].attempt_number,2); // UTC offset matches real SQL
  const absent=selectWk100AuditedDispatch({
    jobs:retry.jobs,sourceContracts:f.sourceContracts,retryRequests:[],
  });
  assert.equal(absent.jobs.length,0);
  assert.equal(absent.withheldRetryCount,1);
  const requested={contract_id:contract.id,source_key:contract.source_key,
    week_start_eat:f.weekStartEat,scheduled_at:'2026-11-02T06:00:00+00:00',
    attempt_number:2};
  const options=[
    {...requested,contract_id:'other-contract'},
    {...requested,source_key:'apple_ke_other'},
    {...requested,week_start_eat:'2026-11-09'},
    {...requested,scheduled_at:'2026-11-02T06:01:00+00:00'},
    {...requested,attempt_number:3},
  ];
  for(const bad of options){
    const denied=selectWk100AuditedDispatch({
      jobs:retry.jobs,sourceContracts:f.sourceContracts,retryRequests:[bad],
    });
    assert.equal(denied.jobs.length,0);
  }
  const approved=selectWk100AuditedDispatch({
    jobs:retry.jobs,sourceContracts:f.sourceContracts,retryRequests:[requested],
  });
  assert.equal(approved.jobs.length,1);
  assert.equal(approved.jobs[0].scheduled_at,slot);
  assert.equal(approved.jobs[0].attempt_number,2);
  assert.equal(approved.withheldRetryCount,0);
  assert.throws(()=>selectWk100AuditedDispatch({
    jobs:retry.jobs,sourceContracts:f.sourceContracts,
    retryRequests:[{...requested,scheduled_at:'not-a-date'}],
  }),/wk100_retry_dispatch_invalid/);
});
test('WK100 SQL timezone forms cannot make a completed slot look absent',()=>{
  const f=wk100PlanFixture('2026-11-02');
  const contract=f.sourceContracts[0];
  for(const sqlTime of ['2026-11-02T06:00:00+00:00',
    '2026-11-02T09:00:00+03:00','2026-11-02T06:00:00.000000Z']){
    const observed=planWk100SourceDispatch({...f,attempts:[{
      contract_id:contract.id,scheduled_at:sqlTime,
      attempt_number:1,status:'succeeded',
    }]});
    assert.equal(observed.jobs.length,0);
    assert.equal(observed.blocked[0].code,'slot_already_observed');
  }
  const corrupt=planWk100SourceDispatch({...f,attempts:[{
    contract_id:contract.id,scheduled_at:'not-a-date',
    attempt_number:1,status:'transport_failed',
  }]});
  assert.equal(corrupt.jobs.length,0);
  assert.equal(corrupt.blocked[0].code,'attempt_history_invalid');
});

test('WK100 source-method review cannot convert research-only or a mismatched provider into admission',()=>{
  const p={sourceKey:'youtube_ke_top_songs_weekly',providerKey:'youtube_ke',proposalRevision:1,
    decisionState:'collector_admitted',parserClass:'youtube_kenya_weekly_top_songs_v1',
    methodClass:'provider_api',nativePeriodAuthority:'provider_defined',
    nativePeriodEvidenceRef:'reviewed_week_20261102',endpointSha256:'a'.repeat(64),
    accessEvidenceSha256:'b'.repeat(64),authorizationRef:'reviewed_access_v1',
    authorizationExpiresAt:'2027-01-01T00:00:00Z',
    constitutionVersion:'wk100-test-v1',reason:'Reviewed original source method'};
  const now=new Date('2026-11-03T00:00:00Z');
  const accepted=validateWk100SourceMethodDecision(p,{now});
  assert.equal(accepted.canCollect,false);
  assert.equal(accepted.canScore,false);assert.equal(accepted.canPublish,false);
  for(const patch of [
    {methodClass:'research_only'},{parserClass:'apple_kenya_chart_v1'},
    {providerKey:'spotify_ke',sourceKey:'spotify_ke_chart'},
    {nativePeriodAuthority:'unknown'},{authorizationExpiresAt:'2026-11-02T00:00:00Z'},
    {endpointSha256:null},{extra:true},
  ])assert.throws(()=>validateWk100SourceMethodDecision({...p,...patch},{now}));
  // The source's reviewed weekly CSV may enter method review, but a
  // browser-valid request cannot grant source access or collection itself.
  const spotify={...p,providerKey:'spotify_ke',sourceKey:'spotify_ke_official_weekly',
    parserClass:'spotify_kenya_offered_chart_csv_v1',methodClass:'offered_export'};
  const acceptedSpotify=validateWk100SourceMethodDecision(spotify,{now});
  assert.equal(acceptedSpotify.canCollect,false);
  assert.equal(acceptedSpotify.canScore,false);
  assert.equal(acceptedSpotify.canPublish,false);
  for(const methodClass of ['provider_api','reviewed_page_adapter','research_only']){
    assert.throws(()=>validateWk100SourceMethodDecision({...spotify,methodClass},{now}),
      /method_admission_unqualified/);
  }
  assert.throws(()=>validateWk100SourceMethodDecision({
    ...spotify,parserClass:'apple_kenya_chart_v1',
  },{now}),/method_admission_unqualified/);
  const hold=validateWk100SourceMethodDecision({...p,decisionState:'held',
    parserClass:null,methodClass:'research_only',nativePeriodAuthority:null,
    nativePeriodEvidenceRef:null,endpointSha256:null,accessEvidenceSha256:null,
    authorizationRef:null,authorizationExpiresAt:null},{now});
  assert.equal(hold.canCollect,false);
});

test('WK100 review endpoint verifies caller JWT, both capabilities and SQL confirmation without service role',async()=>{
  const edge=await readFile('supabase/functions/wk100-source-admin-methods/index.ts','utf8');
  const config=await readFile('supabase/config.toml','utf8');
  assert.match(config,/\[functions\.wk100-source-admin-methods\]\s*verify_jwt = true/);
  assert.match(edge,/caller\.auth\.getUser\(bearer\.slice\(7\)\)/);
  assert.match(edge,/required_capability:'manage_ingest'/);
  assert.match(edge,/required_capability:'manage_charts'/);
  assert.match(edge,/wk100_review_source_method_v1/);
  assert.match(edge,/wk100_list_source_method_decisions_v1/);
  assert.match(edge,/data\.proposalRevision===decision\.proposalRevision/);
  assert.match(edge,/data\.decisionRevision===\(body\.expectedDecisionRevision as number\)\+1/);
  assert.doesNotMatch(edge,/SUPABASE_SERVICE_ROLE_KEY|service_role|\.insert\(|\.upsert\(|\bfetch\(/);
});

test('WK100 draft admission forbids research-only and YouTube playlist masquerading as Weekly Top Songs',async()=>{
  const sql=await readFile('scripts/acceptance/wk100-phase1-source-method-candidate.sql','utf8');
  assert.match(sql,/v_p\.method_class='research_only'/);
  assert.match(sql,/v_p\.provider_key='youtube_ke'/);
  assert.match(sql,/v_p\.behavior<>'video_consumption'/);
  assert.match(sql,/v_p\.native_metric<>'rank_and_count'/);
  assert.match(sql,/v_p\.cadence_kind<>'weekly'/);
  assert.match(sql,/wk100_method_restricted_decision_requires_super_admin/);
  assert.match(sql,/wk100_method_review_conflict/);
  assert.match(sql,/wk100_method_decision_immutable/);
});

test('WK100 source method review shares proposal revision lock and respects permanent retirement',async()=>{
  const sql=await readFile('scripts/acceptance/wk100-phase1-source-method-candidate.sql','utf8');
  assert.match(sql,/pg_advisory_xact_lock\(11400,pg_catalog\.hashtext\(v_key\)\)/);
  assert.doesNotMatch(sql,/pg_advisory_xact_lock\(11500,/);
  assert.match(sql,/where source_key=v_key and decision_state='retired'/);
  assert.match(sql,/wk100_method_source_retired/);
});

test('WK100 method retire is final and gated by super-admin, with no role-assignment drift',async()=>{
  const sql=await readFile('scripts/acceptance/wk100-phase1-source-method-candidate.sql','utf8');
  assert.match(sql,/if exists \(\s*select 1 from platform_private\.wk100_source_method_decisions_v1[\s\S]*where source_key=v_key and decision_state='retired'/);
  assert.match(sql,/v_state in \('collector_admitted','retired'\) and not exists/);
  assert.match(sql,/role_key='super_admin'/);
  assert.match(sql,/wk100_method_restricted_decision_requires_super_admin/);
});

test('WK100 capture authorization is service-only and bound to latest proposal and exact method',async()=>{
  const sql=await readFile('scripts/acceptance/wk100-phase1-source-method-candidate.sql','utf8');
  assert.match(sql,/create function public\.wk100_service_admitted_methods_v1\(\)/);
  assert.match(sql,/create function public\.wk100_service_capture_method_allowed_v1\(/);
  assert.match(sql,/auth\.role\(\) is distinct from 'service_role'/);
  assert.match(sql,/p\.revision=d\.proposal_revision/);
  assert.match(sql,/c\.adapter_version=d\.parser_class/);
  assert.match(sql,/c\.native_metric=p\.native_metric/);
  assert.match(sql,/d\.decision_state='collector_admitted'/);
  assert.match(sql,/d\.authorization_expires_at>now\(\)/);
  assert.match(sql,/item\.v->>'endpoint_sha256'=p_endpoint_sha256/);
  assert.match(sql,/grant execute on function public\.wk100_service_admitted_methods_v1/);
});

test('WK100 capture endpoint rechecks current method admission before a provider GET',async()=>{
  const edge=await readFile('supabase/functions/wk-chart-capture/index.ts','utf8');
  assert.match(edge,/wk100_service_capture_method_allowed_v1/);
  assert.match(edge,/if\(!await methodAllowed\(\)\)/);
  assert.match(edge,/current\.authorization_ref===decision\.authorization_ref &&\s*await methodAllowed\(\)/);
  assert.match(edge,/p_endpoint_sha256:endpointSha256/);
  assert.match(edge,/sha256Hex\(new TextEncoder\(\)\.encode\(entry\.endpoint\)\)/);
  // Apple scoped validation moved to its shared exact-route authority helper.
  assert.match(edge,/isWk100AppleCatalogChart\(key,entry\.endpoint\)/);
  const apple=await readFile('supabase/functions/_shared/wk100-apple-service-credential.mjs','utf8');
  assert.match(apple,/\^apple_ke\(\?:_\[a-z\]/);
  assert.match(apple,/validAppleEndpoint\(endpoint\)/);
  assert.doesNotMatch(edge,/body\.providerAuthorization|body\.endpoint/);
});

test('WK100 scoped Apple source sends provider token only to the exact native catalog charts route',async()=>{
  const endpoint='https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played';
  const token='local-test-apple-developer-token-not-a-secret';
  const createRequest=sourceKey=>({
    sourceKey,endpoint,
    accessDecision:{source_key:sourceKey,exact_endpoint:endpoint,
      authorization_ref:'reviewed_access_v1',purpose:'candidate_raw_evidence'},
    verifyAccess:async()=>true,
    providerAuthorization:{kind:'apple_developer_bearer',token},
    timeoutMs:1000,now:()=>new Date('2026-11-03T08:00:00Z'),
  });
  let called=0;
  const capture=await fetchCandidateBytes({...createRequest('apple_ke_catalog_most_played'),
    fetchImpl:async (_url,init)=>{
      called+=1;
      assert.equal(init.headers.authorization,'Bearer '+token);
      return new Response('{"native":"example"}',
        {status:200,headers:{'content-type':'application/json'}});
    }});
  assert.equal(called,1);
  assert.equal(capture.source_key,'apple_ke_catalog_most_played');
  assert.equal(capture.byte_length>0,true);
  await assert.rejects(
    fetchCandidateBytes({...createRequest('youtube_ke_top_songs_weekly'),
      fetchImpl:async()=>{throw Error('must_not_call');}}),
    e=>e?.code==='provider_authorization_invalid');
  assert.equal(called,1);
});

test('WK100 scheduler binds exact reviewed source, constitution, access digest and sealed manifest',async()=>{
  assert.equal(wk100EatWeekFromUtc(new Date('2026-11-02T00:00:00Z')),'2026-11-02');
  assert.equal(wk100EatWeekFromUtc(new Date('2026-11-08T22:00:00Z')),'2026-11-09');
  const endpoint='https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played';
  const reviewedEndpointSha=await sha256Hex(new TextEncoder().encode(endpoint));
  const modifiedEndpoint='https://unknown.invalid/raw';
  // Use the real digest: a constant hash stub would falsely approve a
  // tampered sealed-manifest endpoint and mask the security assertion.
  assert.notEqual(await sha256Hex(new TextEncoder().encode(modifiedEndpoint)),reviewedEndpointSha);
  const contract={source_key:'apple_ke_catalog_most_played',provider_key:'apple_ke',
    contract_version:'v1',adapter_version:'apple_kenya_chart_v1',
    adapter_sha256:'c'.repeat(64),admission_state:'candidate',market:'KE'};
  const row={source_key:contract.source_key,provider_key:contract.provider_key,
    contract_version:'v1',decision_state:'collector_admitted',
    parser_class:contract.adapter_version,native_period_state:'provider_defined',
    native_period_evidence_ref:'reviewed_period',
    endpoint_sha256:reviewedEndpointSha,evidence_sha256:'b'.repeat(64),
    authorization_ref:'reviewed_access_v1',authorization_expires_at:'2027-01-01T00:00:00Z',
    constitution_version:'approved-v1'};
  const entry={source_key:contract.source_key,contract_version:'v1',
    enabled:true,market:'KE',method:'GET',purpose:'candidate_raw_evidence',
    endpoint,parser_class:contract.adapter_version,adapter_sha256:contract.adapter_sha256,
    native_period_key:'provider_week',authorization_ref:'reviewed_access_v1',
    authorization_expires_at:row.authorization_expires_at};
  const args={methodRows:[row],manifest:{sources:[entry]},sourceContracts:[contract],
    sha256Hex,
    nowUtc:new Date('2026-11-03T08:00:00Z'),constitutionVersion:'approved-v1'};
  const allowed=await bindWk100DispatchAuthority(args);
  assert.equal(allowed.length,1);assert.equal(allowed[0].enabled,true);
  for(const override of [
    {constitutionVersion:'not-approved'},
    {methodRows:[{...row,decision_state:'paused'}]},
    {methodRows:[{...row,proposal_revision:2,constitution_version:'old-v1'}]},
    {methodRows:[{...row,authorization_ref:'different_access'}]},
    {manifest:{sources:[{...entry,enabled:false}]}},
    {manifest:{sources:[{...entry,endpoint:modifiedEndpoint}]}},
    {sourceContracts:[{...contract,adapter_version:'wrong'}]},
    {sourceContracts:[{...contract,adapter_sha256:'d'.repeat(64)}]},
    {manifest:{sources:[{...entry,adapter_sha256:'e'.repeat(64)}]}},
    {sha256Hex:async()=>('f'.repeat(64))},
    {nowUtc:new Date('2027-02-01T00:00:00Z')},
  ])assert.equal((await bindWk100DispatchAuthority({...args,...override})).length,0);
  await assert.rejects(bindWk100DispatchAuthority({...args,manifest:{sources:[entry,entry]}}));
  await assert.rejects(bindWk100DispatchAuthority({...args,methodRows:[row,row]}));
});

test('WK100 scheduler only dispatches signed service calls through existing capture worker',async()=>{
  const edge=await readFile('supabase/functions/wk100-source-scheduler/index.ts','utf8');
  const config=await readFile('supabase/config.toml','utf8');
  assert.match(config,/\[functions\.wk100-source-scheduler\]\s*verify_jwt = true/);
  assert.match(edge,/isGatewayVerifiedServiceRole\(bearer,req\.headers\.get\('apikey'\)\)/);
  assert.match(edge,/WK100_SOURCE_SCHEDULER_ENABLED/);
  assert.match(edge,/WK100_CAPTURE_ENABLED/);
  assert.match(edge,/WK100_SOURCE_CONSTITUTION_VERSION/);
  assert.match(edge,/runtimeProjectApiUrl\(bearer/);
  assert.match(edge,/wk100_service_admitted_methods_v1/);
  assert.match(edge,/bindWk100DispatchAuthority\(/);
  assert.match(edge,/planWk100SourceDispatch\(/);
  assert.match(edge,/wk100_service_retry_requests_v1/);
  assert.match(edge,/selectWk100AuditedDispatch\(/);
  assert.match(edge,/withheldRetries/);
  assert.match(edge,/\/functions\/v1\/wk-chart-capture/);
  assert.match(edge,/redirect:'error'/);
  assert.doesNotMatch(edge,/wk_chart_runtime_reserve_v1|\.insert\(|\.upsert\(|SUPABASE_SERVICE_ROLE_KEY/);
});

test('WK100 direct capture calls require current founder constitution, not merely service_role',async()=>{
  const row={
    source_key:'apple_ke_catalog_most_played',contract_version:'v1',
    decision_state:'collector_admitted',constitution_version:'accepted-constitution-v1',
    endpoint_sha256:'a'.repeat(64),authorization_ref:'reviewed_access_v1',
    parser_class:'apple_kenya_chart_v1',native_period_state:'provider_defined',
    native_period_evidence_ref:'native-period-2026',
    authorization_expires_at:'2027-01-01T00:00:00Z',
  };
  const req={
    rows:[row],sourceKey:row.source_key,contractVersion:row.contract_version,
    endpointSha256:row.endpoint_sha256,
    authorizationRef:row.authorization_ref,parserClass:row.parser_class,
    constitutionVersion:'accepted-constitution-v1',
    nowUtc:new Date('2026-11-03T08:00:00Z'),
  };
  assert.equal(isWk100CaptureConstitutionCurrent(req),true);
  for(const change of [
    {constitutionVersion:'unapproved'},
    {rows:[{...row,decision_state:'paused'}]},
    {rows:[{...row,decision_state:'retired'}]},
    {rows:[{...row,constitution_version:'superseded-constitution'}]},
    {rows:[{...row,authorization_expires_at:'2026-11-02T00:00:00Z'}]},
    {rows:[{...row,endpoint_sha256:'f'.repeat(64)}]},
    {rows:[{...row,native_period_state:'unknown'}]},
    {rows:[]},{rows:[row,row]},
    {parserClass:'youtube_kenya_weekly_top_songs_v1'},
  ])assert.equal(isWk100CaptureConstitutionCurrent({...req,...change}),false);
  const worker=await readFile('supabase/functions/wk-chart-capture/index.ts','utf8');
  assert.match(worker,/WK100_SOURCE_CONSTITUTION_VERSION/);
  assert.match(worker,/isWk100CaptureConstitutionCurrent/);
  assert.match(worker,/wk100_service_admitted_methods_v1/);
  assert.match(worker,/await methodAllowed\(\)/);
  // Service-role requests can reach the worker without passing through the
  // scheduler, so a direct retry must prove the same immutable SQL action.
  assert.match(worker,/if\(Number\(payload\.attempt_number\)>1\)/);
  assert.match(worker,/wk100_service_retry_requests_v1/);
  assert.match(worker,/selectWk100AuditedDispatch\(/);
  assert.match(worker,/retry_request_not_authorized/);
  assert.ok(worker.indexOf("if(Number(payload.attempt_number)>1)") <
    worker.indexOf("const credentials=await resolveWk100AppleProviderAuthorization"));
});
test('WK100 scheduler only passes admitted contract versions to the dispatch planner',async()=>{
  const edge=await readFile('supabase/functions/wk100-source-scheduler/index.ts','utf8');
  assert.match(edge,/const admittedContracts=new Set\(approved\.map/);
  assert.match(edge,/sourceContracts:currentContracts,approvedDecisions:approved/);
  assert.doesNotMatch(edge,/sourceContracts:contractsResult\.data,approvedDecisions:approved/);
  const authority=await readFile('supabase/functions/_shared/wk100-source-scheduler-authority.mjs','utf8');
  assert.match(authority,/scheduler_multiple_admitted_contract_versions/);
});

test('WK100 governed capture-contract enrollment has a single auditable super-admin authority',async()=>{
  const sql=await readFile('scripts/acceptance/wk100-phase1-source-method-candidate.sql','utf8');
  assert.match(sql,/revoke insert on public\.wk_chart_capture_contracts_v1 from service_role/);
  assert.match(sql,/create function public\.wk100_enroll_source_capture_contract_v1\(/);
  assert.match(sql,/wk100_contract_enrollment_not_authorized/);
  assert.match(sql,/v_actor uuid:=auth\.uid\(\)/);
  assert.match(sql,/role_key='super_admin'/);
  assert.match(sql,/pg_advisory_xact_lock\(11400,pg_catalog\.hashtext\(p_source_key\)\)/);
  assert.match(sql,/v_decision\.decision_state<>'collector_admitted'/);
  assert.match(sql,/v_decision\.proposal_revision<>v_proposal\.revision/);
  assert.match(sql,/wk100_contract_already_enrolled/);
  assert.match(sql,/create table platform_private\.wk100_capture_contract_enrollments_v1/);
  assert.match(sql,/wk100_contract_enrollment_update_delete_guard/);
  assert.match(sql,/wk100_contract_enrollment_truncate_guard/);
  assert.match(sql,/grant execute on function public\.wk100_enroll_source_capture_contract_v1/);
  assert.match(sql,/'state','candidate','canCollect',false,'canScore',false,'canPublish',false/);
});

test('WK100 enrollment intent is bounded and server uses exact JWT actor and SQL confirmation',async()=>{
  const p={sourceKey:'apple_ke_catalog_most_played',
    contractVersion:'apple-native-v1',adapterSha256:'a'.repeat(64),
    expectedProposalRevision:1,expectedDecisionRevision:1};
  assert.deepEqual({...validateWk100ContractEnrollmentIntent(p)},p);
  for(const patch of [
    {adapterSha256:'a'}, {contractVersion:'../escape'},
    {sourceKey:'apple_ke_bad-name'}, {expectedProposalRevision:0},
    {expectedDecisionRevision:1.5},{canPublish:true}
  ])assert.throws(()=>validateWk100ContractEnrollmentIntent({...p,...patch}));
  const edge=await readFile('supabase/functions/wk100-source-admin-methods/index.ts','utf8');
  assert.match(edge,/body\.action==='enroll_capture_contract'/);
  assert.match(edge,/validateWk100ContractEnrollmentIntent\(body\.enrollment\)/);
  assert.match(edge,/wk100_enroll_source_capture_contract_v1/);
  assert.match(edge,/result\.proposalRevision!==enrollment\.expectedProposalRevision/);
  assert.match(edge,/result\.decisionRevision!==enrollment\.expectedDecisionRevision/);
  assert.match(edge,/result\.canCollect!==false/);
  assert.doesNotMatch(edge,/SUPABASE_SERVICE_ROLE_KEY|\.insert\(|\.upsert\(/);
});

test('WK100 method list exposes only nonsecret capture contract version, not credential or URL',async()=>{
  const sql=await readFile('scripts/acceptance/wk100-phase1-source-method-candidate.sql','utf8');
  assert.match(sql,/'captureContractVersion',\(\s*select c\.contract_version/);
  assert.match(sql,/where c\.source_key=d\.source_key/);
  const section=sql.split('create function public.wk100_list_source_method_decisions_v1()')[1]
    .split('end; \$list\$;')[0];
  // The private digest is read to derive a BOOLEAN, not serialized as a field.
  // Assert the returned JSON projection's key names, not internal SQL columns.
  assert.match(section,/'hasMethodEvidence',d.access_evidence_sha256 is not null/);
  assert.doesNotMatch(section,/'(?:authorizationRef|endpointSha256|accessEvidenceSha256|authorization_ref|endpoint_sha256|access_evidence_sha256)'\s*,/);
});

test('WK100 enrollment UI cannot infer collection authority from a candidate contract',async()=>{
  const ui=await readFile('src/pages/admin/charts/wk100-operations/SourceMethodReviewForm.tsx','utf8');
  assert.match(ui,/previous\?\.decisionState==='collector_admitted'/);
  assert.match(ui,/previous\.proposalRevision===proposal\.revision/);
  assert.match(ui,/previous\.captureContractVersion/);
  assert.match(ui,/action:'enroll_capture_contract'/);
  assert.match(ui,/data\.enrollment\.decisionRevision!==previous\.decisionRevision/);
  assert.match(ui,/data\.enrollment\.canCollect!==false/);
  assert.match(ui,/data\.enrollment\.canPublish!==false/);
  assert.match(ui,/Collection Off/);
  assert.doesNotMatch(ui,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test('WK100 native adapter digest is a required contract/manifest match at scheduler and worker',async()=>{
  const scheduler=await readFile('supabase/functions/_shared/wk100-source-scheduler-authority.mjs','utf8');
  const worker=await readFile('supabase/functions/wk-chart-capture/index.ts','utf8');
  assert.match(scheduler,/contract\.adapter_sha256!==entry\.adapter_sha256/);
  assert.match(scheduler,/SHA\.test\(contract\.adapter_sha256\)/);
  assert.match(worker,/found\.data\.adapter_sha256!==entry\.adapter_sha256/);
  assert.match(worker,/found\.data\.adapter_version!==entry\.parser_class/);
  assert.match(worker,/source_adapter_digest_mismatch/);
  assert.match(worker,/!\/\^\[a-f0-9\]\{64\}\$\/\.test\(source\.adapter_sha256\)/);
});

test('WK100 restricted source health and proposal endpoints require the verified Admin JWT and both capabilities',async()=>{
  const config=await readFile('supabase/config.toml','utf8');
  for(const slug of ['wk100-source-admin-read','wk100-source-admin-proposals','wk100-source-admin-methods']) {
    assert.match(config,new RegExp('\\[functions\\.'+slug+'\\]\\s*verify_jwt = true'));
  }
  const health=await readFile('supabase/functions/wk100-source-admin-read/index.ts','utf8');
  const proposal=await readFile('supabase/functions/wk100-source-admin-proposals/index.ts','utf8');
  assert.match(health,/admin\.auth\.getUser\(token\)/);
  assert.match(proposal,/caller\.auth\.getUser\(bearer\.slice\(7\)\)/);
  for(const file of [health,proposal]){
    assert.match(file,/required_capability:'manage_ingest'/);
    assert.match(file,/required_capability:'manage_charts'/);
    assert.match(file,/data!==true\)return reply\(req,403,\{error:'not_authorized'\}\)/);
    assert.doesNotMatch(file,/WK100_CAPTURE_ENABLED|WK100_SOURCE_SCHEDULER_ENABLED/);
  }
  assert.match(health,/\.limit\(1000\)/);
  assert.match(health,/source_health_page_limit/);
  assert.doesNotMatch(health,/\.select\('\*'\)/);
  // The readback path requires a private object key internally.
  // The service must never return that key or a service-role credential.
  assert.match(health,/const hash=record\.payload_sha256,key=record\.raw_object_key/);
  assert.doesNotMatch(health,/raw_object_key:record\.raw_object_key|service_role:\s*serviceKey/);
});

test('WK100 private original readback binds exact signed-in receipt and hashes server-owned Storage bytes',async()=>{
  const code=await readFile('supabase/functions/wk100-source-admin-read/index.ts','utf8');
  const config=await readFile('supabase/config.toml','utf8');
  assert.match(config,/\[functions\.wk100-source-admin-read\]\s*verify_jwt\s*=\s*true/);
  assert.match(code,/data\.action==='verify_private_original'/);
  assert.match(code,/required_capability:'manage_ingest'/);
  assert.match(code,/required_capability:'manage_charts'/);
  assert.match(code,/\.eq\('id',receiptId\)\.eq\('contract_id',contractId\)\.eq\('week_start_eat',week\)/);
  assert.match(code,/\.from\('wk-chart-raw-evidence-v1'\)\.download\(key\)/);
  assert.match(code,/crypto\.subtle\.digest\('SHA-256',bytes\)/);
  assert.match(code,/if\(calculated!==hash\)return reply\(req,503/);
  assert.match(code,/originalVerified:true/);
  assert.match(code,/canScore:false,canPublish:false/);
  assert.doesNotMatch(code,/signedUrl|createSignedUrl/);
});


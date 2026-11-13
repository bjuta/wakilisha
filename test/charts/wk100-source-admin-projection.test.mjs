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
import { bindWk100DispatchAuthority, wk100YouTubePeriodForSlot, wk100EatWeekFromUtc, isWk100CaptureConstitutionCurrent, isWk100FirstPartyTransport } from '../../supabase/functions/_shared/wk100-source-scheduler-authority.mjs';
import { validateWk100SourceMethodDecision, validateWk100ContractEnrollmentIntent } from '../../supabase/functions/_shared/wk100-source-method-decision-v1.mjs';
import { selectWk100CollectNowDispatch } from '../../supabase/functions/_shared/wk100-collect-now-authority.mjs';
import { validateCaptureSlot } from '../../supabase/functions/_shared/chart-capture-runtime.mjs';

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

  // The first-party Kenya page's embedded Next.js Flight playlist has
  // 100 ordered song IDs, separate from the 100 music:song title metas.
  const playlist={id:'18474189',title:'Weekly 100: Kenya',
    href:'/geo-charts/playlist/kenya',urlSlug:'kenya',
    uploadedBy:{slug:'geo-charts'},trackCount:100,updatedAt:1793811472,
    tracks:Array.from({length:100},(_,i)=>({
      id:String(i+100000),songId:String(i+100000),type:'song',
      title:'Synthetic Title '+(i+1),artistName:'First-party Artist',
      href:'/kenya-artist/song/track-'+(i+1),
      parentPlaylist:{id:'18474189',href:'/geo-charts/playlist/kenya'},
    }))};
  const original=(p)=>html+'<script>self.__next_f.push('+
    JSON.stringify([1,'7:[{"music":'+JSON.stringify(p)+'}]'])+
    ')</script>';
  const validated=parseAudiomackKenya(original(playlist),access);
  assert.equal(validated.chart_surface,'audiomack_first_party_embedded_kenya_weekly_100');
  assert.equal(validated.rank_authority,'first_party_embedded_playlist_metadata_crosschecked');
  assert.equal(validated.provider_playlist_id,'18474189');
  assert.equal(validated.provider_updated_at,'2026-11-04T16:57:52.000Z');
  assert.equal(validated.native_period,'unknown');
  assert.equal(validated.rows.length,100);
  assert.equal(validated.rows[99].provider_track_id,'100099');
  const accepted=parseCaptureNativeRows(new TextEncoder().encode(original(playlist)),
    contract,access);
  assert.equal(accepted.length,100);
  assert.equal(accepted[0].provider_track_id,'100000');
  assert.equal(Object.hasOwn(accepted[0],'view_count'),false);
  for(const bad of [
    {...playlist,id:'other-id'},
    {...playlist,tracks:[...playlist.tracks.slice(1),playlist.tracks[0]]},
    {...playlist,tracks:[...playlist.tracks.slice(0,99)]},
    {...playlist,tracks:[...playlist.tracks.slice(0,99),playlist.tracks[0]]},
    {...playlist,tracks:[...playlist.tracks.slice(0,99),
      {...playlist.tracks[99],parentPlaylist:{id:'wrong',href:playlist.href}}]},
    {...playlist,trackCount:99},
  ])assert.throws(()=>parseCaptureNativeRows(
    new TextEncoder().encode(original(bad)),contract,access),/audiomack_/);
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
  // The signed-in W2A review cannot admit a YouTube GET/page/export method:
  // the first-party weekly transport only supports a reviewed provider POST.
  // A held research proposal remains valid; no method is auto-admitted.
  for(const methodClass of ['reviewed_page_adapter','offered_export','research_only'])
    assert.throws(()=>validateWk100SourceMethodDecision({
      ...p,methodClass,
    },{now}),/method_admission_unqualified/);
  const heldYoutube=validateWk100SourceMethodDecision({
    ...p,methodClass:'reviewed_page_adapter',decisionState:'held',
    parserClass:null,nativePeriodAuthority:null,nativePeriodEvidenceRef:null,
    endpointSha256:null,accessEvidenceSha256:null,authorizationRef:null,
    authorizationExpiresAt:null,
  },{now});
  assert.equal(heldYoutube.decisionState,'held');
  assert.equal(heldYoutube.canCollect,false);
  // Audiomack's admitted parser accepts only the exact 100-track Kenya HTML
  // surface, not an unevidenced playlist API or title-only feed method.
  const audiomack={...p,providerKey:'audiomack_ke',
    sourceKey:'audiomack_ke_public_weekly_100',
    parserClass:'audiomack_kenya_chart_v1',
    methodClass:'reviewed_page_adapter',
    nativePeriodAuthority:'observed_as_of',
    nativePeriodEvidenceRef:'observed_as_of/kenya_playlist_proof'};
  const acceptedAudiomack=validateWk100SourceMethodDecision(audiomack,{now});
  assert.equal(acceptedAudiomack.canCollect,false);
  for(const methodClass of ['provider_api','offered_export','research_only'])
    assert.throws(()=>validateWk100SourceMethodDecision({
      ...audiomack,methodClass,
    },{now}),/method_admission_unqualified/);
  assert.equal(accepted.canCollect,false);
  assert.equal(accepted.canScore,false);assert.equal(accepted.canPublish,false);
  // As-of is a reviewed observation strategy, not invented source-native dates.
  const asOf={...p,providerKey:'apple_ke',sourceKey:'apple_ke_public_top100',
    parserClass:'apple_kenya_chart_v1',methodClass:'reviewed_page_adapter',
    nativePeriodAuthority:'observed_as_of',
    nativePeriodEvidenceRef:'observed_as_of/approved_public_source_method_v1'};
  assert.equal(validateWk100SourceMethodDecision(asOf,{now}).nativePeriodAuthority,'observed_as_of');
  for(const patch of [
    {nativePeriodEvidenceRef:'unverified_provider_week'},
    {nativePeriodAuthority:'unknown'},
    {providerKey:'youtube_ke',sourceKey:'youtube_ke_weekly',parserClass:'youtube_kenya_weekly_top_songs_v1'},
    {providerKey:'spotify_ke',sourceKey:'spotify_ke_chart',parserClass:'spotify_kenya_offered_chart_csv_v1'},
    {providerKey:'boomplay_ke',sourceKey:'boomplay_ke_chart',parserClass:'boomplay_kenya_chart_v1'},
  ])assert.throws(()=>validateWk100SourceMethodDecision({...asOf,...patch},{now}),
    /method_admission_unqualified/);
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
  assert.match(edge,/isWk100FirstPartyTransport\(sourceKey,source\.method,source\.endpoint/);
  assert.match(edge,/httpMethod:entry.method/);
  // The sealed source method remains unchanged; only YouTube's native
  // request date is resolved from its authenticated scheduled slot.
  assert.match(edge,/wk100YouTubePeriodForSlot\(key,entry,String\(payload\.scheduled_at\)\)/);
  assert.match(edge,/method:entry.method,native_period_key:nativePeriodKey/);
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
  const observedRow={...row,native_period_state:'observed_as_of',
    native_period_evidence_ref:'observed_as_of/approved_chart_method_v1'};
  const observedEntry={...entry,native_period_key:null};
  const asOf=await bindWk100DispatchAuthority({...args,methodRows:[observedRow],
    manifest:{sources:[observedEntry]}});
  assert.equal(asOf.length,1);
  // A real signed-in SQL review can persist a subsecond timestamptz expiry.
  // It must remain dispatchable after the service bridge rounds down to its
  // strict UTC-second planner wire format; no expiry extension is allowed.
  const subsecondExpiry='2027-01-01T00:00:00.537Z';
  const subsecond=await bindWk100DispatchAuthority({...args,
    methodRows:[{...observedRow,authorization_expires_at:subsecondExpiry}],
    manifest:{sources:[{...observedEntry,authorization_expires_at:subsecondExpiry}]}});
  assert.equal(subsecond.length,1);
  assert.equal(subsecond[0].authorization_expires_at,'2027-01-01T00:00:00Z');
  const dispatch=planWk100SourceDispatch({
    weekStartEat:'2026-11-02',nowUtc:'2026-11-02T06:01:00Z',
    executionEnabled:true,
    sourceContracts:[{...contract,id:'11111111-1111-4111-8111-111111111111',
      behavior:'consumption',native_metric:'rank',expected_depth:100,
      cadence_kind:'weekly',interval_hours:null,eat_hour:9,eat_minute:0,
      weekday_eat:0,minimum_healthy_checkpoints:1}],
    approvedDecisions:subsecond,attempts:[],
  });
  assert.equal(dispatch.jobs.length,1);
  assert.equal(dispatch.blocked.length,0);
  for(const altered of [
    {...observedEntry,native_period_key:'fabricated_week'},
  ])assert.equal((await bindWk100DispatchAuthority({...args,
    methodRows:[observedRow],manifest:{sources:[altered]}})).length,0);
  assert.equal((await bindWk100DispatchAuthority({...args,
    methodRows:[{...observedRow,native_period_evidence_ref:'fake_period'}],
    manifest:{sources:[observedEntry]}})).length,0);
  // A POST is permissible only for a separately reviewed, provider-defined
  // first-party YouTube weekly chart, never an arbitrary method override.
  const youtubeEndpoint='https://charts.youtube.com/youtubei/v1/browse?alt=json';
  const youtubePeriod='weekly:20261023:20261029:ke';
  const youtubeContract={...contract,provider_key:'youtube_ke',
    source_key:'youtube_ke_weekly_top_songs',
    adapter_version:'youtube_kenya_weekly_top_songs_v1'};
  const youtubeRow={...row,source_key:youtubeContract.source_key,
    provider_key:'youtube_ke',parser_class:youtubeContract.adapter_version,
    method_class:'provider_api',native_period_state:'provider_defined',
    endpoint_sha256:await sha256Hex(new TextEncoder().encode(youtubeEndpoint))};
  const youtubeEntry={...entry,source_key:youtubeContract.source_key,
    endpoint:youtubeEndpoint,method:'POST',
    parser_class:youtubeContract.adapter_version,
    native_period_key:youtubePeriod};
  const youtubeArgs={...args,methodRows:[youtubeRow],
    sourceContracts:[youtubeContract],manifest:{sources:[youtubeEntry]}};
  const enabledYoutube=await bindWk100DispatchAuthority(youtubeArgs);
  assert.equal(enabledYoutube.length,1);
  // A fixed source week must stop dispatching as the Kenya week advances.
  const nextWeek=new Date('2026-11-10T08:00:00Z');
  assert.equal(wk100YouTubePeriodForSlot(youtubeContract.source_key,
    youtubeEntry,nextWeek),null);
  assert.equal((await bindWk100DispatchAuthority({...youtubeArgs,
    nowUtc:nextWeek})).length,0);
  const rolling={...youtubeEntry,native_period_rollover:'completed_weekly_thursday_v1'};
  assert.equal(wk100YouTubePeriodForSlot(youtubeContract.source_key,
    rolling,new Date('2026-11-03T08:00:00Z')),youtubePeriod);
  assert.equal(wk100YouTubePeriodForSlot(youtubeContract.source_key,
    rolling,nextWeek),'weekly:20261030:20261105:ke');
  assert.equal(wk100YouTubePeriodForSlot(youtubeContract.source_key,
    rolling,new Date('2026-11-17T08:00:00Z')),'weekly:20261106:20261112:ke');
  assert.equal((await bindWk100DispatchAuthority({...youtubeArgs,
    nowUtc:new Date('2026-11-17T08:00:00Z'),
    manifest:{sources:[rolling]}})).length,1);
  for(const bad of [
    {...rolling,native_period_rollover:'latest_unverified'},
    {...rolling,native_period_key:'weekly:20261024:20261030:ke'},
    {...rolling,endpoint:'https://youtube.com/other'},
  ])assert.equal(wk100YouTubePeriodForSlot(youtubeContract.source_key,
    bad,nextWeek),null);
  assert.equal(wk100YouTubePeriodForSlot(youtubeContract.source_key,
    rolling,new Date('2026-10-27T08:00:00Z')),null);
  assert.equal(wk100YouTubePeriodForSlot(youtubeContract.source_key,
    rolling,new Date('invalid')),null);
  assert.equal((await bindWk100DispatchAuthority({...youtubeArgs,
    manifest:{sources:[{...youtubeEntry,native_period_rollover:'unknown'}]}})).length,0);

  assert.equal(isWk100CaptureConstitutionCurrent({
    rows:[youtubeRow],sourceKey:youtubeContract.source_key,
    contractVersion:'v1',endpointSha256:youtubeRow.endpoint_sha256,
    authorizationRef:youtubeRow.authorization_ref,parserClass:youtubeRow.parser_class,
    constitutionVersion:'approved-v1',nowUtc:new Date('2026-11-03T08:00:00Z'),
    httpMethod:'POST'}),true);
  for(const changed of [
    {methodRows:[{...youtubeRow,method_class:'reviewed_page_adapter'}]},
    {methodRows:[{...youtubeRow,native_period_state:'observed_as_of'}]},
    {manifest:{sources:[{...youtubeEntry,native_period_key:'weekly:20261023:20261030:ke'}]}},
    {manifest:{sources:[{...youtubeEntry,endpoint:'https://charts.youtube.com/charts/TopSongs/ke'}]}},
    {manifest:{sources:[{...youtubeEntry,method:'PATCH'}]}},
    {manifest:{sources:[{...youtubeEntry,source_key:'shazam_ke_public_top200'}]}},
  ])assert.equal((await bindWk100DispatchAuthority({...youtubeArgs,...changed})).length,0);
  assert.equal(isWk100CaptureConstitutionCurrent({
    rows:[{...youtubeRow,method_class:'research_only'}],
    sourceKey:youtubeContract.source_key,contractVersion:'v1',
    endpointSha256:youtubeRow.endpoint_sha256,
    authorizationRef:youtubeRow.authorization_ref,parserClass:youtubeRow.parser_class,
    constitutionVersion:'approved-v1',nowUtc:new Date('2026-11-03T08:00:00Z'),
    httpMethod:'POST'}),false);
  // A YouTube GET could previously pass the generic method branch.
  // It must never be authorized for a first-party weekly chart, even if
  // a reviewed SQL row and sealed endpoint hash otherwise match.
  assert.equal(isWk100CaptureConstitutionCurrent({
    rows:[youtubeRow],sourceKey:youtubeContract.source_key,
    contractVersion:'v1',endpointSha256:youtubeRow.endpoint_sha256,
    authorizationRef:youtubeRow.authorization_ref,parserClass:youtubeRow.parser_class,
    constitutionVersion:'approved-v1',nowUtc:new Date('2026-11-03T08:00:00Z'),
    httpMethod:'GET'}),false);
  assert.equal((await bindWk100DispatchAuthority({
    ...youtubeArgs,manifest:{sources:[{...youtubeEntry,method:'GET'}]},
  })).length,0);
  // Audiomack's accepted decoder is the exact first-party Kenya HTML.
  // Do not accept a playlist API endpoint, impostor host, or provider POST.
  const audiomackEndpoint='https://audiomack.com/geo-charts/playlist/kenya';
  const audiomackContract={...contract,source_key:'audiomack_ke_weekly_100',
    provider_key:'audiomack_ke',adapter_version:'audiomack_kenya_chart_v1'};
  const audiomackRow={...row,source_key:audiomackContract.source_key,
    provider_key:'audiomack_ke',parser_class:audiomackContract.adapter_version,
    method_class:'reviewed_page_adapter',
    native_period_state:'observed_as_of',
    native_period_evidence_ref:'observed_as_of/kenya_playlist_observation',
    endpoint_sha256:await sha256Hex(new TextEncoder().encode(audiomackEndpoint))};
  const audiomackEntry={...entry,source_key:audiomackContract.source_key,
    endpoint:audiomackEndpoint,method:'GET',
    parser_class:audiomackContract.adapter_version,native_period_key:null};
  const audiomackArgs={...args,methodRows:[audiomackRow],
    sourceContracts:[audiomackContract],manifest:{sources:[audiomackEntry]}};
  assert.equal((await bindWk100DispatchAuthority(audiomackArgs)).length,1);
  assert.equal(isWk100CaptureConstitutionCurrent({
    rows:[audiomackRow],sourceKey:audiomackContract.source_key,
    contractVersion:'v1',endpointSha256:audiomackRow.endpoint_sha256,
    authorizationRef:audiomackRow.authorization_ref,parserClass:audiomackRow.parser_class,
    constitutionVersion:'approved-v1',nowUtc:new Date('2026-11-03T08:00:00Z'),
    httpMethod:'GET'}),true);
  for(const patch of [
    {methodRows:[{...audiomackRow,method_class:'provider_api'}]},
    {manifest:{sources:[{...audiomackEntry,method:'POST'}]}},
    {manifest:{sources:[{...audiomackEntry,endpoint:'https://api.audiomack.com/v1/playlist/geo-charts/kenya'}]}},
    {manifest:{sources:[{...audiomackEntry,endpoint:'https://audiomack.com.evil.example/geo-charts/playlist/kenya'}]}},
  ])assert.equal((await bindWk100DispatchAuthority({...audiomackArgs,...patch})).length,0);
  assert.equal(isWk100CaptureConstitutionCurrent({
    rows:[{...audiomackRow,method_class:'provider_api'}],
    sourceKey:audiomackContract.source_key,contractVersion:'v1',
    endpointSha256:audiomackRow.endpoint_sha256,
    authorizationRef:audiomackRow.authorization_ref,parserClass:audiomackRow.parser_class,
    constitutionVersion:'approved-v1',nowUtc:new Date('2026-11-03T08:00:00Z'),
    httpMethod:'GET'}),false);
  assert.equal(isWk100FirstPartyTransport(audiomackContract.source_key,
    'GET',audiomackEndpoint,null),true);
  assert.equal(isWk100FirstPartyTransport(audiomackContract.source_key,
    'GET',audiomackEndpoint,'weekly:20261023:20261029:ke'),false);
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
  const observed={...row,native_period_state:'observed_as_of',
    native_period_evidence_ref:'observed_as_of/method_review_v1'};
  assert.equal(isWk100CaptureConstitutionCurrent({...req,rows:[observed]}),true);
  assert.equal(isWk100CaptureConstitutionCurrent({...req,
    rows:[{...observed,native_period_evidence_ref:'fabricated_week'}]}),false);
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
  const methods=await readFile('supabase/functions/wk100-source-admin-methods/index.ts','utf8');
  // GoTrue adds Authorization on getUser(jwt). Match its exact key case so
  // Fetch never combines a second lowercase authorization bearer value.
  for(const edge of [proposal,methods]){
    assert.match(edge,/global:\{headers:\{Authorization:bearer\}\}/);
    assert.doesNotMatch(edge,/global:\{headers:\{authorization:bearer\}\}/);
  }
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


test('Collect Now is distinct from the weekly checkpoint and cannot claim an invented slot',()=>{
  const contract={
    id:'11111111-1111-4111-8111-111111111111',
    source_key:'apple_ke_catalog_most_played',provider_key:'apple_ke',
    contract_version:'v1',market:'KE',admission_state:'candidate',
    adapter_version:'apple_kenya_chart_v1',
    behavior:'consumption',native_metric:'rank',expected_depth:100,
    cadence_kind:'weekly',eat_hour:9,eat_minute:0,weekday_eat:0,
    minimum_healthy_checkpoints:1,
  };
  const args={contract,weekStartEat:'2026-11-02',
    scheduledAt:'2026-11-05T12:00:00Z',attemptNumber:1,
    access:{parser_class:'apple_kenya_chart_v1'},
    clock:new Date('2026-11-05T12:00:30Z')};
  assert.throws(()=>validateCaptureSlot(args),/slot_unexpected/);
  assert.doesNotThrow(()=>validateCaptureSlot({...args,collectionMode:'collect_now'}));
  for(const bad of [
    {attemptNumber:2},{weekStartEat:'2026-11-09'},
    {scheduledAt:'2026-11-05T12:00:01Z'},
    {clock:new Date('2026-11-05T12:21:00Z')},
    {clock:new Date('2026-11-05T11:59:59Z')},
    {collectionMode:'unsupported'},
  ])assert.throws(()=>validateCaptureSlot({...args,collectionMode:'collect_now',...bad}));
});
test('Collect Now only dispatches a current, admitted, exact SQL-ticket source',()=>{
  const contract={id:'11111111-1111-4111-8111-111111111111',
    source_key:'apple_ke_catalog_most_played',contract_version:'v1'};
  const decision={source_key:contract.source_key,contract_version:'v1',
    state:'collector_admitted',enabled:true};
  const request={operation_id:'22222222-2222-4222-8222-222222222222',
    actor_user_id:'33333333-3333-4333-8333-333333333333',
    contract_id:contract.id,source_key:contract.source_key,contract_version:'v1',
    week_start_eat:'2026-11-02',scheduled_at:'2026-11-05T12:00:00+00:00'};
  const input={requests:[request],sourceContracts:[contract],
    approvedDecisions:[decision],attempts:[],
    nowUtc:'2026-11-05T12:00:30Z',weekStartEat:'2026-11-02'};
  const ok=selectWk100CollectNowDispatch(input);
  assert.equal(ok.jobs.length,1);
  assert.equal(ok.jobs[0].collection_mode,'collect_now');
  assert.equal(ok.jobs[0].attempt_number,1);
  assert.equal(ok.jobs[0].scheduled_at,'2026-11-05T12:00:00Z');
  assert.equal(ok.canPublish,false);
  for(const invalid of [
    {requests:[{...request,actor_user_id:null}]},
    {requests:[{...request,contract_id:'44444444-4444-4444-8444-444444444444'}]},
    {requests:[{...request,scheduled_at:'2026-11-05T12:00:20Z'}]},
    {requests:[{...request,week_start_eat:'2026-11-09'}]},
    {approvedDecisions:[{...decision,state:'paused'}]},
    {nowUtc:'2026-11-05T12:21:01Z'},
    {attempts:[{contract_id:contract.id,scheduled_at:request.scheduled_at}]},
  ])assert.equal(selectWk100CollectNowDispatch({...input,...invalid}).jobs.length,0);
  assert.throws(()=>selectWk100CollectNowDispatch({
    ...input,requests:[request,request]}),/request_duplicate/);
});
test('Collect Now keeps approved UI untouched and SQL remains an independent gate',async()=>{
  const worker=await readFile('supabase/functions/wk-chart-capture/index.ts','utf8');
  const scheduler=await readFile('supabase/functions/wk100-source-scheduler/index.ts','utf8');
  const runtime=await readFile('supabase/functions/_shared/chart-capture-runtime.mjs','utf8');
  const sql=await readFile('scripts/acceptance/wk100-collect-now-forward-candidate-v1.sql','utf8');
  assert.match(worker,/wk100_service_collect_now_requests_v1/);
  assert.match(worker,/wk_chart_runtime_reserve_now_v1/);
  assert.match(scheduler,/selectWk100CollectNowDispatch/);
  assert.match(runtime,/collect_now_reservation_missing/);
  assert.match(sql,/wk100_request_collect_now_v1/);
  assert.match(sql,/wk_chart_runtime_reserve_now_v1/);
  assert.match(sql,/wk100_service_collect_now_requests_v1/);
  assert.match(sql,/current_user_has_capability\('manage_ingest'\)/);
  assert.match(sql,/private\.wk_chart_runtime_guard_v1\(\)/);
});


// WK100 Apple artist evidence report acceptance: only exact immutable receipt rows.
import {validateWk100AppleArtistReport, sha256OfWk100ReportRaw} from '../../supabase/functions/_shared/wk100-apple-artist-evidence.mjs';

test('WK100 rejects source/title/ID drift and unapproved artist report fields',async()=>{
  const receipt={id:'de7e4965-b3db-4e04-b352-49a2dc6ee1bb',week_start_eat:'2026-11-09',
    payload_sha256:'a'.repeat(64),status:'succeeded'};
  const rows=Array.from({length:100},(_,i)=>({id:'row-'+(i+1),attempt_id:receipt.id,
    source_rank:i+1,provider_track_id:String(900000+i),title_observed:'Song '+(i+1),artist_observed:null}));
  const report={schemaVersion:'wk100-apple-artist-observation-probe-v1',
    sourceReceipt:{source:'apple_ke_public_top100',weekStartEat:'2026-11-09',
      receiptId:receipt.id,originalSha256:receipt.payload_sha256,
      capturedAtUtc:'2026-11-09T13:10:18.956Z',originalArtistCount:0},
    generatedAtUtc:'2026-11-10T08:29:09.232Z',initiatedAtUtc:'2026-11-10T08:28:44.492Z',
    lookupEndpoint:'https://itunes.apple.com/lookup',lookupCountry:'ke',
    batchSize:10,requestedBatches:[1,2,3,4,5,6,7,8,9,10],
    supplierDataIsCurrentLookupNotOriginal:true,doesNotEstablishRegistryIdentity:true,
    canMutateRegistry:false,canMutateSource:false,canScore:false,canPublish:false,
    summary:{artist_found:100},batchesFailed:[],
    rows:rows.map(x=>({rank:x.source_rank,providerTrackId:x.provider_track_id,
      observedTitle:x.title_observed,status:'artist_found',artistName:'Artist '+x.source_rank,
      providerTitle:x.title_observed,lookupRetrievedAtUtc:'2026-11-10T08:28:48.573Z',
      evidenceSource:'Apple iTunes Search API ID lookup',originalArtistObserved:null,registryIdentityConfirmed:false}))};
  assert.equal(validateWk100AppleArtistReport({report,receipt,rows}).length,100);
  assert.match(await sha256OfWk100ReportRaw(JSON.stringify(report)),/^[a-f0-9]{64}$/);
  const testBad=mutate=>{const d=structuredClone(report);mutate(d);
    assert.throws(()=>validateWk100AppleArtistReport({report:d,receipt,rows}),/wk100_apple_artist_/);};
  testBad(x=>{x.rows[0].providerTrackId='other';});
  testBad(x=>{x.rows[0].observedTitle='other';});
  testBad(x=>{x.rows[0].artistName='';});
  testBad(x=>{x.rows[0].registryIdentityConfirmed=true;});
  testBad(x=>{x.canMutateRegistry=true;});
  testBad(x=>{x.rows.pop();});
  testBad(x=>{x.sourceReceipt.originalSha256='b'.repeat(64);});
});

test('WK100 artist imports bind the approved report and reject competing receipt rows',async()=>{
  const edge=await readFile('supabase/functions/wk100-source-admin-read/index.ts','utf8');
  const sql=await readFile('supabase/migrations/20261110085456_wk100_apple_artist_observations_v1.sql','utf8');
  assert.match(edge,/reportSha256!=='46a2d8f28c25ed06ee8e22ea832d1172c1c820be3c42c27b235822ec897d0296'/);
  assert.match(sql,/unique \(source_receipt_id,capture_row_id\)/);
  assert.doesNotMatch(sql,/unique \(source_receipt_id,capture_row_id,report_sha256\)/);
});

test('WK100 recovered provider artist is searchable in the Workbench',async()=>{
  const ui=await readFile('src/pages/admin/charts/wk100-operations/Wk100IdentifyReview.tsx','utf8');
  assert.match(ui,/row\.observedTitle,row\.observedArtist,row\.providerArtistName,row\.providerTrackId/);
});

// W7 uses one proposed source-family contribution, never approved ranking authority.
test('WK100 W7 native-evidence methodology proposal rejects metric, period and governance substitution',async()=>{
  const {validateWk100MethodologyCandidate,WK100_METHOD_FAMILIES,
    WK100_SPOTIFY_EDITORIAL_PLAYLISTS,WK100_FAMILY_MEASUREMENTS,
    WK100_METHOD_REVIEW_CONTROLS}=await import(
    '../../supabase/functions/_shared/wk100-methodology-candidate.mjs');
  const sample=()=>({schemaVersion:'wk100-methodology-candidate/v2',weekStartEat:'2026-11-09',
    ingestPolicySha256:'a'.repeat(64),weightsPercent:{apple_ke:25,shazam_ke:20,
      mdundo_ke:20,youtube_ke:20,audiomack_ke:10,spotify_editorial:5},
    spotifyEditorialPlaylistIds:[...WK100_SPOTIFY_EDITORIAL_PLAYLISTS],
    familyMeasurements:Object.fromEntries(WK100_METHOD_FAMILIES.map(
      key=>[key,{...WK100_FAMILY_MEASUREMENTS[key]}])),
    reviewControls:{...WK100_METHOD_REVIEW_CONTROLS},
    normalization:'source_metric_classes_separate',missingness:'hold_without_redistribution',
    identityPolicy:'confirmed_registry_recording_only',approvalState:'proposed',
    canScore:false,canFreeze:false,canPublish:false});
  const expected={weekStartEat:'2026-11-09',ingestPolicySha256:'a'.repeat(64)};
  const accepted=validateWk100MethodologyCandidate(sample(),expected);
  assert.equal(accepted.canScore,false);
  assert.equal(accepted.canFreeze,false);
  assert.equal(accepted.canPublish,false);
  assert.notEqual(WK100_FAMILY_MEASUREMENTS.youtube_ke.nativeEvidence,
    WK100_FAMILY_MEASUREMENTS.shazam_ke.nativeEvidence);
  for(const bad of [
    x=>{x.schemaVersion='wk100-methodology-candidate/v1'},
    x=>{x.canScore=true},x=>{x.canFreeze=true},x=>{x.approvalState='frozen'},
    x=>{x.weightsPercent.spotify_editorial=20},
    x=>{x.weightsPercent.youtube_ke=0},
    x=>{delete x.weightsPercent.mdundo_ke},
    x=>{x.spotifyEditorialPlaylistIds.pop()},
    x=>{x.familyMeasurements.youtube_ke.nativeEvidence='playlist_order'},
    x=>{x.familyMeasurements.apple_ke.periodTreatment='weekly_stream_totals'},
    x=>{x.familyMeasurements.shazam_ke.behavior='audio_consumption_rank'},
    x=>{x.familyMeasurements.spotify_editorial.normalization='four_independent_votes'},
    x=>{x.reviewControls.missingEvidence='redistribute'},
    x=>{x.reviewControls.coverage='one_core_provider_enough'},
    x=>{x.normalization='mix_native_counts'},
    x=>{x.ingestPolicySha256='b'.repeat(64)},
  ]){const next=sample();bad(next);assert.throws(()=>
    validateWk100MethodologyCandidate(next,expected),/wk100_methodology_/);}
  const edge=await readFile('supabase/functions/chart-ingest-api/index.ts','utf8');
  assert.match(edge,/explicitMethodologyProposal/);
  assert.match(edge,/ingestPolicySha256:policyDraftDigest/);
});

test('WK100 W5C/W6 keep ten-row presentation separate from all-row correction comparison',async()=>{
  const {compareWk100EligibilityRechecks}=await import(
    '../../src/services/chartsIngestion/wk100EligibilityRecheck.mjs');
  const base={schemaVersion:'wk100-admin-eligibility-preview-v1',
    weekStartEat:'2026-11-09',contractId:'11111111-1111-4111-8111-111111111111',
    receiptId:'22222222-2222-4222-8222-222222222222',sourceKey:'apple_ke_public_top100',
    payloadSha256:'a'.repeat(64),policySha256:'b'.repeat(64),
    receiptStatus:'succeeded',observedDepth:10,expectedDepth:10,configRevision:1,
    canWriteRegistry:false,canScore:false,canPublish:false,
    counts:{ELIGIBLE:0,EXCLUDED:0,REVIEW_REQUIRED:10,CONFLICTED:0},
    rows:Array.from({length:10},(_,i)=>({
      captureRowId:'33333333-3333-4333-8333-'+String(i+1).padStart(12,'0'),
      rank:i+1,observedTitle:'Original title '+i,observedArtist:null,
      providerTrackId:String(100+i),canonicalTrackId:null,identityState:'needs_review',
      registryFactsSha256:'c'.repeat(64),outcome:'REVIEW_REQUIRED',
      reasonCodes:['canonical_identity_needs_review'],canScore:false,canPublish:false,
    }))};
  const after=structuredClone(base);
  after.rows[7].registryFactsSha256='d'.repeat(64);
  const result=compareWk100EligibilityRechecks(base,after);
  assert.equal(result.evaluatedRows,10);
  assert.equal(result.changedCount,1);
  assert.equal(result.changed[0].rank,8);
  assert.equal(result.immutableSourceRetained,true);
  assert.equal(result.canScore,false);
  const tampered=structuredClone(after);
  tampered.rows[7].providerTrackId='changed-source-id';
  assert.throws(()=>compareWk100EligibilityRechecks(base,tampered),/wk100_recheck_source_row_changed/);
});

test('WK100 W6 denies unexplained outcome changes and reports source-bound impact',async()=>{
  const {compareWk100EligibilityRechecks}=await import(
    '../../src/services/chartsIngestion/wk100EligibilityRecheck.mjs');
  const row={captureRowId:'33333333-3333-4333-8333-333333333333',rank:1,
    observedTitle:'Original title',observedArtist:null,providerTrackId:'one',
    canonicalTrackId:null,identityState:'needs_review',registryFactsSha256:'a'.repeat(64),
    outcome:'REVIEW_REQUIRED',reasonCodes:['canonical_identity_needs_review'],
    canScore:false,canPublish:false};
  const before={schemaVersion:'wk100-admin-eligibility-preview-v1',
    weekStartEat:'2026-11-09',contractId:'11111111-1111-4111-8111-111111111111',
    receiptId:'22222222-2222-4222-8222-222222222222',sourceKey:'apple_ke_public_top100',
    receiptStatus:'succeeded',observedDepth:1,expectedDepth:100,configRevision:1,
    payloadSha256:'b'.repeat(64),policySha256:'c'.repeat(64),
    canWriteRegistry:false,canScore:false,canPublish:false,
    counts:{ELIGIBLE:0,EXCLUDED:0,REVIEW_REQUIRED:1,CONFLICTED:0},rows:[row]};
  const after=structuredClone(before);after.rows[0].outcome='ELIGIBLE';
  after.counts.ELIGIBLE=1;after.counts.REVIEW_REQUIRED=0;
  assert.throws(()=>compareWk100EligibilityRechecks(before,after),
    /unexplained_evaluation_change/);
  after.rows[0].registryFactsSha256='d'.repeat(64);
  after.rows[0].reasonCodes=[];
  const comparison=compareWk100EligibilityRechecks(before,after);
  assert.equal(comparison.changedCount,1);
  assert.equal(comparison.summary.becameEligible,1);
  assert.equal(comparison.summary.reasonsResolved,1);
  assert.deepEqual(comparison.changed[0].resolvedReasons,['canonical_identity_needs_review']);
  assert.equal(comparison.verifiedRegistryOperation,false);
  assert.equal(comparison.canScore,false);
  assert.throws(()=>compareWk100EligibilityRechecks(before,{...after,
    configRevision:2}),/policy_changed/);
  assert.throws(()=>compareWk100EligibilityRechecks(before,{...after,
    payloadSha256:'e'.repeat(64)}),/receipt_changed/);
});

test('WK100 W5C correction context ties every investigation to immutable source and current facts',async()=>{
  const {WK100_CORRECTION_FIELDS,describeWk100CorrectionReview}=await import(
    '../../src/services/chartsIngestion/wk100CorrectionReviewBoundary.mjs');
  const sample={schemaVersion:'wk100-admin-eligibility-preview-v1',
    weekStartEat:'2026-11-09',contractId:'11111111-1111-4111-8111-111111111111',
    receiptId:'22222222-2222-4222-8222-222222222222',sourceKey:'apple_ke_public_top100',
    payloadSha256:'a'.repeat(64),policySha256:'b'.repeat(64),configRevision:3,
    observedDepth:1,canWriteRegistry:false,canScore:false,canPublish:false,
    rows:[{captureRowId:'33333333-3333-4333-8333-333333333333',rank:1,
      canonicalTrackId:'44444444-4444-4444-8444-444444444444',
      outcome:'REVIEW_REQUIRED',registryFactsSha256:'c'.repeat(64),
      canScore:false,canPublish:false}]};
  const ctx=describeWk100CorrectionReview(sample,sample.rows[0].captureRowId,'track.title');
  assert.equal(ctx.sourceOriginalSha256,sample.payloadSha256);
  assert.equal(ctx.editionPolicySha256,sample.policySha256);
  assert.equal(ctx.registryFactsSha256,sample.rows[0].registryFactsSha256);
  assert.equal(ctx.authority,'admin_patch_registry_track_profile_v1');
  assert.equal(ctx.durability,'not_saved');
  assert.equal(ctx.canWriteRegistry,false);
  assert.equal(WK100_CORRECTION_FIELDS['artist.origin_iso2'].treatment,
    'missing_origin_admission_or_separate_correction');
  for(const field of ['source.rank','source.metric','source.native_period','track.unknown'])
    assert.throws(()=>describeWk100CorrectionReview(sample,sample.rows[0].captureRowId,field),
      /field_unrecognized/);
  assert.throws(()=>describeWk100CorrectionReview(sample,
    '55555555-5555-4555-8555-555555555555','track.title'),/row_absent/);
  assert.throws(()=>describeWk100CorrectionReview({...sample,canScore:true},
    sample.rows[0].captureRowId,'track.title'),/preview_invalid/);
  const source=await readFile('src/pages/admin/charts/wk100-operations/Wk100IdentifyReview.tsx','utf8');
  assert.match(source,/data-wk100-correction-context/);
  assert.match(source,/not a saved decision/);
});

test('WK100 W5C migration uses CLI-minted path, private append-only history, and caller-bound CAS',async()=>{
  const sql=await readFile(
    'supabase/migrations/20261112164236_wk100_correction_decision_ledger_forward_v1.sql','utf8');
  assert.ok(sql.length>12000);
  assert.match(sql,/Forward migration filename minted by Supabase CLI v2\.107\.0/);
  for(const required of [
    'platform_private.wk100_correction_cases_v1',
    'platform_private.wk100_correction_events_v1',
    'wk100_correction_events_no_update_delete_v1',
    'wk100_correction_events_no_truncate_v1',
    'wk100_correction_cases_truncate_guard_v1',
    'public.wk100_record_correction_decision_v1',
    'public.wk100_read_correction_cases_v1',
    "current_user_has_capability('manage_ingest')",
    "current_user_has_capability('manage_charts')",
    "current_user_has_capability('view_registry')",
    'v_case.revision<>v_expected_revision',
    'v_retry.request_sha256<>v_input_hash',
    'pg_catalog.pg_advisory_xact_lock(',
    "pg_catalog.hashtextextended('wk100-correction:'||v_operation::text,0)",
    'v_attempt.payload_sha256 is distinct from',
    'v_draft.config_json',
    "p_request->'canonicalWriteEventId' is distinct from 'null'::jsonb",
    "'canonicalWriteVerified',false",
    "'canWriteRegistry',false",
    "'canReEvaluate',false",
    "'canScore',false",
    "'canPublish',false",
  ])assert.ok(sql.includes(required),'Missing SQL authority: '+required);
  assert.match(sql,/revoke all on platform_private\.wk100_correction_cases_v1 from public,anon,authenticated,service_role/);
  assert.match(sql,/revoke all on function public\.wk100_record_correction_decision_v1\(jsonb\)/);
  assert.match(sql,/grant execute on function public\.wk100_record_correction_decision_v1\(jsonb\)\s+to authenticated/);
  assert.doesNotMatch(sql,/\b(update|insert into|delete from)\s+public\.(registry_tracks|registry_artists|registry_releases|wk_chart_capture_rows_v1|wk_chart_capture_attempts_v1)\b/i);
  assert.doesNotMatch(sql,/grant\s+(insert|update|delete)\s+on\s+platform_private\.wk100_correction_/i);
  assert.doesNotMatch(sql,/verified_canonical_write|registry_canonical_write_events|canonical_write_event_id/);
  const gate=await readFile(
    'scripts/acceptance/wk100-correction-ledger-structural-gate-v1.sql','utf8');
  assert.match(gate,/WK100_CORRECTION_LEDGER_STRUCTURAL_GATE=PASS/);
  assert.match(gate,/has_table_privilege\('authenticated'/);
  assert.match(gate,/has_function_privilege\('anon'/);
  assert.match(gate,/v_triggers<>5/);
  assert.doesNotMatch(gate,/\b(insert into|update|delete from)\s+public\./i);
});
test('WK100 W5C Admin saves only explicit review decisions through guarded RPC',async()=>{
  const ui=await readFile('src/pages/admin/charts/wk100-operations/Wk100IdentifyReview.tsx','utf8');
  assert.match(ui,/data-wk100-correction-context/);
  assert.match(ui,/wk100_read_correction_cases_v1/);
  assert.match(ui,/wk100_record_correction_decision_v1/);
  assert.match(ui,/canonicalWriteEventId:null/);
  assert.match(ui,/expectedCaseRevision:focusedCase\?\.revision\?\?0/);
  assert.match(ui,/pendingCaseOperation.current\?\.key===key/);
  assert.match(ui,/Recording a review decision does not change a Registry fact/);
  assert.doesNotMatch(ui,/setCases\(null\);setCaseMessage\(''\)/);
  assert.doesNotMatch(ui,/\u2014/);
});


test('WK100 W5C typed correction values cannot bypass the existing Registry writer',async()=>{
  const {normalizeWk100CorrectionPatchValue:parse}=await import(
    '../../src/services/chartsIngestion/wk100CorrectionReviewBoundary.mjs');
  assert.equal(parse('track.title','Nairobi Morning'),'Nairobi Morning');
  assert.equal(parse('track.isrc','KEABC2600012'),'KEABC2600012');
  assert.equal(parse('track.explicit','true'),true);
  assert.equal(parse('track.explicit','false'),false);
  assert.equal(parse('track.duration_ms','123456'),123456);
  assert.equal(parse('release.release_type','single'),'single');
  assert.equal(parse('release.release_date','2026-11-09'),'2026-11-09');
  for(const field of ['track.isrc','track.explicit','track.duration_ms','release.release_date'])
    assert.equal(parse(field,'__clear__'),null);
  for(const [field,value] of [
    ['track.title',''],['track.title',' __clear__ '],
    ['track.duration_ms','-9'],['track.duration_ms','4.3'],
    ['track.duration_ms','90000000'],['release.release_date','2026-02-31'],
    ['release.release_type','playlist'],['recording.identity','merged'],
    ['credits.primary_featured','other'],['source.rank','4'],
    ['track.explicit','false?'],['track.title','__clear__'],
    ['track.isrc',' ABC '],
  ])assert.throws(()=>parse(field,value),/wk100_correction_value_invalid/);
});

test('WK100 W5C atomically invokes the typed Registry writer before private immutable proof',async()=>{
  const sql=await readFile(
    'supabase/migrations/20261112164236_wk100_correction_decision_ledger_forward_v1.sql','utf8');
  const name='create function public.wk100_apply_reviewed_registry_correction_v1(';
  const start=sql.indexOf(name);
  const end=sql.indexOf('revoke all on function public.wk100_apply_reviewed_registry_correction_v1(',start);
  assert.ok(start>0&&end>start);
  const body=sql.slice(start,end);
  for(const required of [
    "current_user_has_capability('manage_registry')",
    "current_user_has_capability('manage_ingest')",
    "current_user_has_capability('manage_charts')",
    "current_user_has_capability('view_registry')",
    "v_case.state<>'request_registry_review'",
    'v_attempt.payload_sha256 is distinct from v_case.original_sha256',
    'v_draft.revision is distinct from v_case.policy_revision',
    'v_source_row.provider_track_id is distinct from v_case.provider_track_id',
    "l.match_status='matched'",
    "l.match_status='confirmed'",
    "public.admin_patch_registry_track_profile_v1(",
    "public.admin_patch_registry_release_profile_v1(",
    "v_after is distinct from v_readback",
    "where id=v_case.id and revision=v_case.revision",
    "decision,reason,",
    "'applied_registry'",
    "pg_catalog.pg_advisory_xact_lock(",
    "v_retry.request_sha256 is distinct from v_hash",
  ])assert.ok(body.includes(required),'Missing atomic writer boundary: '+required);
  assert.ok(body.indexOf('public.admin_patch_registry_track_profile_v1(')<
    body.indexOf('insert into platform_private.wk100_correction_events_v1 ('));
  assert.ok(body.indexOf('public.admin_patch_registry_release_profile_v1(')<
    body.indexOf('insert into platform_private.wk100_correction_events_v1 ('));
  assert.doesNotMatch(body,/insert into public\.(registry_canonical_write_events|registry_tracks|registry_releases)/);
  assert.match(sql,/constraint wk100_correction_applied_event_only_with_provenance/);
  assert.match(sql,/old.state in \('closed_no_change','applied_registry'\)/);
  assert.match(sql,/v_case.state in \('closed_no_change','applied_registry'\)/);
  assert.match(sql,/create function public\.wk100_read_correction_application_v1\(p_case_id uuid\)/);
  assert.match(sql,/v_now->v_field is not distinct from v_event\.writer_after_value/);
});

test('WK100 W6 requires applied case proof and independent full-receipt readback',async()=>{
  const {compareWk100EligibilityRechecksWithApplication:verify}=await import(
    '../../src/services/chartsIngestion/wk100EligibilityRecheck.mjs');
  const track='44444444-4444-4444-8444-444444444444';
  const row='33333333-3333-4333-8333-333333333333';
  const before={schemaVersion:'wk100-admin-eligibility-preview-v1',
    weekStartEat:'2026-11-09',contractId:'11111111-1111-4111-8111-111111111111',
    receiptId:'22222222-2222-4222-8222-222222222222',
    sourceKey:'apple_ke_public_top100',payloadSha256:'a'.repeat(64),
    policySha256:'b'.repeat(64),receiptStatus:'succeeded',
    observedDepth:1,expectedDepth:1,configRevision:3,
    canWriteRegistry:false,canScore:false,canPublish:false,
    counts:{ELIGIBLE:0,EXCLUDED:0,REVIEW_REQUIRED:1,CONFLICTED:0},
    rows:[{captureRowId:row,rank:1,observedTitle:'Source title',
      observedArtist:null,providerTrackId:'90315517',
      identityState:'resolved',canonicalTrackId:track,registryTrackId:track,
      registryReleaseId:'66666666-6666-4666-8666-666666666666',
      registryFactsSha256:'c'.repeat(64),outcome:'REVIEW_REQUIRED',
      reasonCodes:['missing_isrc'],canScore:false,canPublish:false}]};
  const after=structuredClone(before);
  after.rows[0].registryFactsSha256='d'.repeat(64);
  after.rows[0].outcome='ELIGIBLE';
  after.rows[0].reasonCodes=[];
  after.counts.REVIEW_REQUIRED=0;after.counts.ELIGIBLE=1;
  const proof={
    schemaVersion:'wk100-correction-application-proof/v1',
    caseId:'77777777-7777-4777-8777-777777777777',
    eventId:'88888888-8888-4888-8888-888888888888',
    weekStartEat:before.weekStartEat,contractId:before.contractId,
    receiptId:before.receiptId,captureRowId:row,sourceRank:1,
    originalSha256:before.payloadSha256,policyRevision:before.configRevision,
    policySha256:before.policySha256,registryFactsBeforeSha256:'c'.repeat(64),
    fieldPath:'track.isrc',
    registryEntityId:track,registryEntityType:'track',
    writerAuthority:'admin_patch_registry_track_profile_v1',
    beforeValue:null,afterValue:'KEABC2600012',
    expectedUpdatedAt:'2026-11-09T08:00:00Z',
    appliedUpdatedAt:'2026-11-09T08:01:00Z',
    appliedAt:'2026-11-09T08:01:00Z',
    verifiedWriterExecuted:true,canonicalAfterMatchesCurrent:true,
    canScore:false,canPublish:false,
  };
  const result=verify(before,after,proof);
  assert.equal(result.summary.becameEligible,1);
  assert.equal(result.applicationEventId,proof.eventId);
  assert.equal(result.verifiedRegistryOperation,true);
  assert.equal(result.savedCorrection,true);
  assert.equal(result.comparisonPersisted,false);
  assert.equal(result.canScore,false);
  for(const bad of [
    {...proof,canonicalAfterMatchesCurrent:false},
    {...proof,verifiedWriterExecuted:false},
    {...proof,registryFactsBeforeSha256:'9'.repeat(64)},
    {...proof,originalSha256:'9'.repeat(64)},
    {...proof,policyRevision:4},
    {...proof,writerAuthority:'manual_audit_row'},
    {...proof,registryEntityId:'99999999-9999-4999-8999-999999999999'},
    {...proof,sourceRank:2},
    {...proof,afterValue:null},
  ])assert.throws(()=>verify(before,after,bad),/wk100_recheck_application_/);
  assert.throws(()=>verify(before,{...after,payloadSha256:'e'.repeat(64)},proof),
    /wk100_recheck_receipt_changed/);
  const unchanged=structuredClone(after);
  unchanged.rows[0].registryFactsSha256='c'.repeat(64);
  unchanged.rows[0].outcome='REVIEW_REQUIRED';
  unchanged.rows[0].reasonCodes=['missing_isrc'];
  unchanged.counts.REVIEW_REQUIRED=1;unchanged.counts.ELIGIBLE=0;
  assert.throws(()=>verify(before,unchanged,proof),/facts_not_rechecked/);
  const unrelatedBefore=structuredClone(before);
  unrelatedBefore.rows.push({
    ...structuredClone(before.rows[0]),
    captureRowId:'99999999-9999-4999-8999-999999999999',
    rank:2,registryTrackId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    canonicalTrackId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    registryFactsSha256:'e'.repeat(64),
  });
  unrelatedBefore.observedDepth=2;unrelatedBefore.expectedDepth=2;
  unrelatedBefore.counts.REVIEW_REQUIRED=2;
  const unrelatedAfter=structuredClone(unrelatedBefore);
  unrelatedAfter.rows[0]=structuredClone(after.rows[0]);
  unrelatedAfter.rows[1].registryFactsSha256='f'.repeat(64);
  unrelatedAfter.counts.REVIEW_REQUIRED=1;unrelatedAfter.counts.ELIGIBLE=1;
  assert.throws(()=>verify(unrelatedBefore,unrelatedAfter,proof),
    /wk100_recheck_application_unattributed_registry_change/);
  const ui=await readFile('src/pages/admin/charts/wk100-operations/Wk100IdentifyReview.tsx','utf8');
  assert.match(ui,/wk100_apply_reviewed_registry_correction_v1/);
  assert.match(ui,/wk100_read_correction_application_v1/);
  assert.match(ui,/compareWk100EligibilityRechecksWithApplication/);
  assert.match(ui,/data-wk100-canonical-application/);
});



test('WK100 W7 fixed ranking evidence review keeps source reports separate from qualification',async()=>{
  const {reviewWk100RankingEvidence:review}=await import(
    '../../supabase/functions/_shared/wk100-ranking-evidence-review.mjs');
  const weekStartEat='2026-11-09';
  const empty=review({weekStartEat});
  assert.equal(empty.core.length,5);
  assert.equal(empty.chainCandidateFamilies,0);
  assert.equal(empty.sourceCoverageConfirmed,false);
  assert.equal('spotifyEditorialPlaylistIds' in empty,false);
  assert.deepEqual([empty.canScore,empty.canFreeze,empty.canPublish],[false,false,false]);
  assert.deepEqual(empty.core.map(f=>f.family),[
    'apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke']);
  const original={
    id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    sourceKey:'youtube_ke_public_weekly',provider:'youtube_ke',market:'KE',
    metric:'rank_and_count',version:'w7-evidence-v1',captureState:'succeeded',
    expectedDepth:100,observedDepth:100,receiptSha256:'a'.repeat(64),
    nativePeriodAuthority:'provider_defined',
    nativePeriodStart:'2026-11-10T00:00:00Z',
    nativePeriodEnd:'2026-11-11T00:00:00Z',lastSuccessfulAt:'2026-11-11T00:00:00Z',
  };
  const method={
    sourceKey:original.sourceKey,providerKey:'youtube_ke',
    captureContractVersion:'w7-evidence-v1',decisionRevision:1,
    decisionState:'collector_admitted',
    hasMethodEvidence:true,nativePeriodAuthority:'provider_defined',
  };
  const observed=review({weekStartEat,sources:[original],methods:[method],
    reviewedSourceIds:[original.id]});
  const yt=observed.core.find(row=>row.family==='youtube_ke');
  assert.equal(yt.originalCount,1);
  assert.equal(yt.methodCandidateCount,1);
  assert.equal(yt.nativeWindowCount,1);
  assert.equal(yt.chainCandidateCount,1);
  assert(yt.holds.includes('registry_identity_and_week_alignment_unattested'));
  assert.equal(observed.chainCandidateFamilies,1);
  assert.equal(observed.sourceCoverageConfirmed,false);
  assert.deepEqual([observed.canScore,observed.canFreeze,observed.canPublish],[false,false,false]);
  for(const edit of [
    {metric:'rank'}, // Playlist position is not a YouTube native view count.
    {receiptSha256:'bad'}, // A claim without a valid original digest is held.
    {captureState:'parse_failed'},
    {nativePeriodStart:'2026-11-02T00:00:00Z'}, // Stale week is not admitted.
    {nativePeriodAuthority:'unknown'},
    {observedDepth:101}, // Cannot exceed the actual capture contract depth.
  ]){
    const next=review({weekStartEat,sources:[{...original,...edit}],methods:[method],
      reviewedSourceIds:[original.id]});
    assert.equal(next.chainCandidateFamilies,0);
    assert.equal(next.canScore,false);
  }
  for(const m of [
    {...method,decisionState:'paused'},
    {...method,hasMethodEvidence:false},
    {...method,captureContractVersion:'other'},
    {...method,nativePeriodAuthority:'observed_as_of'},
  ]){
    const next=review({weekStartEat,sources:[original],methods:[m],
      reviewedSourceIds:[original.id]});
    assert.equal(next.chainCandidateFamilies,0);
  }
  const asOf={...original,sourceKey:'apple_ke_public_top100',
    provider:'apple_ke',metric:'rank',nativePeriodAuthority:'unknown',
    nativePeriodStart:null,nativePeriodEnd:null,
    lastSuccessfulAt:'2026-11-11T08:00:00Z'};
  const asOfMethod={...method,sourceKey:asOf.sourceKey,providerKey:'apple_ke',
    nativePeriodAuthority:'observed_as_of'};
  const asOfEvidence=review({weekStartEat,sources:[asOf],methods:[asOfMethod],
    reviewedSourceIds:[asOf.id]});
  const apple=asOfEvidence.core.find(x=>x.family==='apple_ke');
  assert.equal(apple.asOfCount,1);
  assert.equal(apple.chainCandidateCount,1);
  assert(apple.holds.includes('as_of_not_weekly_total'));
  assert.equal(asOfEvidence.canScore,false);
  assert.equal(review({weekStartEat,sources:[
    {...asOf,lastSuccessfulAt:'2026-11-02T08:00:00Z'}],
    methods:[asOfMethod],reviewedSourceIds:[asOf.id]}).chainCandidateFamilies,0);
  assert.equal(review({weekStartEat,sources:[original],methods:[method],
    reviewedSourceIds:[]}).chainCandidateFamilies,0);
  assert.equal(review({weekStartEat,sources:[original],
    methods:[method,{...method,decisionRevision:2,decisionState:'paused'}],
    reviewedSourceIds:[original.id]}).chainCandidateFamilies,0);
  assert.equal(review({weekStartEat,sources:[original],
    methods:[method,method],reviewedSourceIds:[original.id]}).chainCandidateFamilies,0);
  assert.equal(review({weekStartEat,sources:[{...original,
    nativePeriodStart:'2026-11-10T00:00:00'}],methods:[method],
    reviewedSourceIds:[original.id]}).chainCandidateFamilies,0);
  assert.throws(()=>review({weekStartEat,sources:[original,original],methods:[method]}),
    /wk100_ranking_review_source_identity_invalid/);
  assert.throws(()=>review({weekStartEat:'2026-11-10'}),/review_week_invalid/);
});


test('WK100 fixed five-source ranking primitive replays two logical EAT weeks without waiting', async()=>{
  const {computeWk100PrivateRankingCandidate:compute,
    WK100_RANKING_SPECIFICATION_V1:spec}=await import(
      '../../supabase/functions/_shared/wk100-ranking-primitive.mjs');
  const sha=n=>n.toString(16).padStart(64,'0');
  const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const addDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000)
    .toISOString().slice(0,10);
  const make=(week,shift=0)=>{
    let seq=400000;
    const snapshots=[];
    const families=['apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke'];
    for(const family of families){
      const repeat=family==='apple_ke'?7:1;
      const size=family==='shazam_ke'?200:100;
      for(let day=0;day<repeat;day++){
        const sourceDay=family==='apple_ke'?addDays(week,day):addDays(week,4);
        const observedAtUtc=sourceDay+'T11:00:00Z';
        const rows=Array.from({length:size},(_,k)=>({
          recordingId:uuid(((k+shift)%size)+1),rank:k+1,
          ...(family==='youtube_ke'?{nativeCount:10000-k*12}:{})
        }));
        snapshots.push({family,sourceKey:family+'_weekly_kenya',
          captureReceiptId:uuid(seq++),captureReceiptSha256:sha(seq),market:'KE',
          nativeMetric:family==='youtube_ke'?'rank_and_count':'rank',
          observedAtUtc,
          nativePeriodAuthority:family==='youtube_ke'?'provider_declared_dates':'observed_as_of',
          nativePeriodStartUtc:null,nativePeriodEndUtc:null,
          providerPeriodStartDate:family==='youtube_ke'?addDays(week,-3):null,
          providerPeriodEndDate:family==='youtube_ke'?addDays(week,3):null,
          declaredDepth:size,rows});
      }
    }
    return {weekStartEat:week,eligibilityPolicySha256:sha(99001),
      registrySnapshotSha256:sha(99123),snapshots};
  };
  const first=make('2026-11-09');
  const result=await compute(first);
  assert.equal(result.status,'private_research_candidate');
  assert.deepEqual(result.sourceFamilies,spec.families);
  assert.equal(result.sourcePanelCount,11);
  assert.equal(result.ranked.length,100);
  assert.equal(result.ranked[0].rank,1);
  assert.equal(result.ranked[0].recordingId,uuid(1));
  assert.equal(result.ranked[0].score,100);
  assert.equal(result.ranked[0].listedFamilyCount,5);
  assert.equal(result.canStage,false);
  assert.equal(result.canPublish,false);
  assert.match(result.rankingDigest,/^[0-9a-f]{64}$/);
  const shuffled=structuredClone(first);
  shuffled.snapshots.reverse();
  for(const panel of shuffled.snapshots)panel.rows.reverse();
  const replay=await compute(shuffled);
  assert.equal(result.rankingDigest,replay.rankingDigest);
  assert.deepEqual(result.ranked,replay.ranked);
  const next=await compute(make('2026-11-16',2));
  assert.equal(next.ranked.length,100);
  assert.notEqual(next.rankingDigest,result.rankingDigest);
  assert.equal(next.canPublish,false);
  // Real source lists are positional evidence, never inferred platform streams.
  assert.equal(result.scoreMeaning,'ordinal_chart_traction_not_streams');
  assert.equal(spec.spotifyContributionPercent,0);
  const invalid=async (change,regex)=>{
    const v=structuredClone(first);change(v);
    await assert.rejects(()=>compute(v),regex);
  };
  await invalid(v=>v.snapshots.pop(),/wk100_rank_input_invalid/);
  await invalid(v=>{v.snapshots[0].rows.pop()},/wk100_rank_snapshot_invalid/);
  await invalid(v=>{v.snapshots[0].rows[0].rank=2},/wk100_rank_rank_or_identity_invalid/);
  await invalid(v=>{v.snapshots[0].rows[0].recordingId='not-registry'},
    /wk100_rank_rank_or_identity_invalid/);
  await invalid(v=>{v.snapshots[0].nativeMetric='event_count'},/wk100_rank_snapshot_invalid/);
  await invalid(v=>{v.snapshots[0].market='US'},/wk100_rank_snapshot_invalid/);
  await invalid(v=>{v.snapshots[0].family='spotify_ke'},/wk100_rank_snapshot_invalid/);
  await invalid(v=>{v.snapshots[1].captureReceiptId=v.snapshots[0].captureReceiptId},
    /wk100_rank_receipt_reused/);
  await invalid(v=>{v.snapshots[1].observedAtUtc=v.snapshots[0].observedAtUtc},
    /wk100_rank_apple_daily_checkpoints_incomplete/);
  await invalid(v=>{v.snapshots.find(x=>x.family==='youtube_ke').nativePeriodAuthority='observed_as_of'},
    /wk100_rank_period_authority_invalid/);
  await invalid(v=>{v.snapshots.find(x=>x.family==='youtube_ke').providerPeriodStartDate='2026-11-01'},
    /wk100_rank_youtube_week_incorrect/);
  await invalid(v=>{v.snapshots.find(x=>x.family==='youtube_ke').rows[5].nativeCount=999999},
    /wk100_rank_youtube_count_order_invalid/);
  await invalid(v=>{v.snapshots.find(x=>x.family==='shazam_ke').rows[0].nativeCount=500},
    /wk100_rank_rank_or_identity_invalid/);
  await invalid(v=>{v.snapshots.find(x=>x.family==='mdundo_ke').rows.pop()},
    /wk100_rank_snapshot_invalid/);
  await invalid(v=>{v.snapshots.find(x=>x.family==='audiomack_ke').observedAtUtc='2026-11-03T11:00:00Z'},
    /wk100_rank_observation_outside_week/);
  await invalid(v=>{v.sourceWeights={apple_ke:100}},/wk100_rank_input_invalid/);
  await invalid(v=>{v.eligibilityPolicySha256={toString:()=>sha(99001)}},
    /wk100_rank_input_invalid/);
  await invalid(v=>{v.snapshots[0].captureReceiptSha256={toString:()=>sha(99001)}},
    /wk100_rank_snapshot_invalid/);
  await invalid(v=>{v.snapshots[0].rows[0].recordingId={toString:()=>uuid(1)}},
    /wk100_rank_rank_or_identity_invalid/);
  const differentPolicy=structuredClone(first);
  differentPolicy.eligibilityPolicySha256=sha(99002);
  assert.notEqual((await compute(differentPolicy)).rankingDigest,result.rankingDigest);
});


test('WK100 independent synthetic research challenge detects model disagreement',()=>{
  const run=spawnSync(process.execPath,[
    'scripts/acceptance/wk100-ranking-research-challenge.mjs',
  ],{encoding:'utf8',timeout:10_000,maxBuffer:2_000_000});
  assert.equal(run.status,0,run.stderr);
  const research=JSON.parse(run.stdout);
  assert.equal(research.dataClass,'SYNTHETIC_NOT_PROVIDER_EVIDENCE');
  assert.equal(research.settings.releaseThresholds,'not_set');
  assert.equal(research.specificationId,'wk100-kenya-traction-ordinal-v1');
  assert.deepEqual(research.referenceConstitution,[
    'apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke']);
  assert.deepEqual(research.results.map(x=>x.mode),[
    'correlated','conflicting','one_provider_reversed']);
  assert(research.results.every(x=>x.sourcePanelCount===11));
  const conflict=research.results[1];
  // A real challenge must expose instability rather than claim all models
  // are equivalent just because their ordered inputs match.
  assert(conflict.nonlinearHeadFocused.top10Overlap<10);
  assert(Object.values(conflict.leaveOneFamilyOut).some(x=>x.top10Overlap<10));
  assert(Object.values(conflict.alternativeShares30_17_5)
    .some(x=>x.top10Overlap<10));
  // These are model sensitivity diagnostics, NOT launch pass thresholds.
});

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
test('source and receipt fields fail closed on unexpected confidential or untyped payloads',async()=>{
  const p=assemble();
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,source_contracts:[{...p.source_contracts[0],credential:'never-store'}]}),/unexpected field/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],api_token:'never-store'},...p.receipts.slice(1)]}),/unexpected field/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],source_native_period:{...p.receipts[0].source_native_period,raw_api_reply:{secret:'x'}}},...p.receipts.slice(1)]}),/unexpected field/);
});
test('the kernel has no policy for converting native rank to stream counts',()=>{
  assert.notEqual(day().metric,weekly().metric);
  assert.notEqual(day().behavior,weekly().behavior);
});

// Source-native parser boundary: this is NOT an admission test and exercises
// static fixtures, not the current provider HTTP surfaces.
import {
  parseMdundoKenya, parseAudiomackKenya, parseBoomplayKenya,
  parseShazamKenya, parseAppleKenya, parseYouTubeKenyaWeekly,
  parseSpotifyChartCsvCandidate, parseSpotifyKenyaWeeklyCandidate,
} from '../../supabase/functions/_shared/chart-public-source-observations.mjs';
import {parseYouTubeKenyaWeeklyCandidate} from '../../supabase/functions/_shared/wk100-youtube-kenya-unresolved-native-row.mjs';

test('Mdundo parses explicit Kenya playlist ranks, and rejects unexplained rank gaps',()=>{
  const html='<div class="md-playlist-song-item" data-index="1" data-id="543" data-playlist-url="/top-charts/ke" data-title="Song A" data-artist="A"></div>'+
    '<div class="md-playlist-song-item" data-index="2" data-id="544" data-playlist-url="/top-charts/ke" data-title="Song B" data-artist="B"></div>';
  const r=parseMdundoKenya(html);
  assert.equal(r.behavior,'consumption');assert.equal(r.native_period,'unknown');assert.equal(r.eligible_for_scoring,false);
  assert.equal(r.rows[0].provider_track_id,'543');assert.equal(r.rows[1].rank,2);
  assert.throws(()=>parseMdundoKenya(html.replace('data-index="2"','data-index="3"')),/duplicate_or_invalid_rank|noncontiguous_rank/);
});

test('Audiomack observations preserve ordered provider song IDs and partial depth',()=>{
  const html='<script>{"track_count":3}</script><meta property="music:song" content="https://audiomack.com/ke-artist/song-1"><meta property="music:song" content="https://audiomack.com/ke-artist/song-2">';
  const r=parseAudiomackKenya(html);
  assert.equal(r.status,'partial_depth');assert.equal(r.chart_depth,3);
  assert.equal(r.rows[0].provider_track_id,'ke-artist/song-1');
  assert.throws(()=>parseAudiomackKenya(html.replace('https://audiomack.com/ke-artist/song-2','https://evil.example/song-2')),/untrusted_song_origin/);
});

test('Boomplay page repeats do not become extra ranked observations; scope stays unverified',()=>{
  const html='<a href="/songs/41">A</a><a href="/songs/41">A again</a><a href="/songs/44">B</a>';
  const r=parseBoomplayKenya(html);
  assert.equal(r.rows.length,2);assert.equal(r.rows[1].provider_track_id,'44');
  assert.equal(r.officiality,'unverified');assert.equal(r.native_period,'unknown');
});

test('Spotify exported chart CSV preflight preserves ranked native counts without inventing Kenya or weekly period',()=>{
  const id1='A'.repeat(22),id2='B'.repeat(22);
  const header='rank,uri,artist_names,track_name,source,peak_rank,previous_rank,weeks_on_chart,streams';
  const first=`1,spotify:track:${id1},"Alpha, Guest","Song, Mix",Label,1,0,2,2433`;
  const second=`2,spotify:track:${id2},Beta,Second,Label,2,1,1,2000`;
  const csv=[header,first,second,''].join('\n');
  const got=parseSpotifyChartCsvCandidate(csv);
  assert.equal(got.source_key,'spotify_chart_csv_candidate');
  assert.equal(got.market,'unverified');
  assert.equal(got.behavior,'consumption');
  assert.equal(got.metric,'rank_plus_spotify_chart_eligible_streams');
  assert.equal(got.native_period,'unknown');
  assert.equal(got.source_admitted,false);
  assert.equal(got.eligible_for_scoring,false);
  assert.equal(got.can_collect,false);assert.equal(got.can_score,false);assert.equal(got.can_publish,false);
  assert.deepEqual(got.rows.map(r=>r.provider_track_id),[id1,id2]);
  assert.deepEqual(got.rows.map(r=>r.chart_eligible_stream_count),[2433,2000]);
  assert.equal(got.rows[0].artist,'Alpha, Guest');
  assert.equal(got.rows[0].title,'Song, Mix');
  assert.equal(got.rows[0].view_count,undefined);
});

test('Spotify candidate preflight rejects forged or ambiguous CSV shapes rather than granting collector authority',()=>{
  const id1='A'.repeat(22),id2='B'.repeat(22);
  const header='rank,uri,artist_names,track_name,source,peak_rank,previous_rank,weeks_on_chart,streams';
  const r1=`1,spotify:track:${id1},Artist,Track,Label,1,1,1,1200`;
  const r2=`2,spotify:track:${id2},Artist Two,Track Two,Label,2,1,1,1000`;
  const csv=[header,r1,r2].join('\n');
  assert.throws(()=>parseSpotifyChartCsvCandidate(csv.replace('streams','youtube_views')),
    /spotify_export_schema_unverified/);
  assert.throws(()=>parseSpotifyChartCsvCandidate(csv.replace(id1,'not-an-id')),
    /spotify_export_row_invalid/);
  assert.throws(()=>parseSpotifyChartCsvCandidate(csv.replace(',1200',',-1')),
    /spotify_export_row_invalid/);
  assert.throws(()=>parseSpotifyChartCsvCandidate(csv.replace(r2,`3,${r2.slice(2)}`)),
    /spotify_chart_csv_candidate_duplicate_or_invalid_rank|spotify_chart_csv_candidate_noncontiguous_rank/);
  assert.throws(()=>parseSpotifyChartCsvCandidate(csv.replace(id2,id1)),
    /spotify_chart_csv_candidate_duplicate_provider_id/);
  assert.throws(()=>parseSpotifyChartCsvCandidate(csv+',unexpected,column'),
    /spotify_export_row_invalid/);
  const tooDeep=Array.from({length:201},(_,i)=>`${i+1},spotify:track:${id1},A,T,L,1,1,1,1`).join('\n');
  assert.throws(()=>parseSpotifyChartCsvCandidate(header+'\n'+tooDeep),
    /spotify_export_depth_invalid/);
});

test('Shazam quoted comma is parsed and evidence remains discovery, not streaming',()=>{
  const r=parseShazamKenya('Shazam Top 200 Kenya\n2026-W42\nRank,Artist,Title\n1,"Artist, Guest","Tune, Mix"\n2,Other,Second\n');
  assert.equal(r.behavior,'discovery');assert.equal(r.metric,'rank');
  assert.equal(r.rows[0].artist,'Artist, Guest');assert.equal(r.rows[0].title,'Tune, Mix');
  assert.equal(r.provider_period_label,'2026-W42');assert.equal(r.native_period,'unknown');
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,A,X\n1,B,Y\n'),/duplicate_or_invalid_rank/);
});

test('Shazam preserves the dated seven-day CSV label without inventing exact UTC bounds',()=>{
  const raw='"Wednesday, 28 October 2026 [performance over the past 7 days]"\n\n'+
    'Rank,Artist,Title\n1,\"Kenya Artist\",\"Kenya Song\"\n';
  const parsed=parseShazamKenya(raw);
  assert.equal(parsed.provider_period_label,
    'Wednesday, 28 October 2026 [performance over the past 7 days]');
  assert.equal(parsed.provider_snapshot_date,'2026-10-28');
  assert.equal(parsed.provider_rolling_window_days,7);
  assert.equal(parsed.native_period,'unknown');
  assert.equal(parsed.eligible_for_scoring,false);
  assert.equal(parsed.rows[0].title,'Kenya Song');
  const noLabel=parseShazamKenya('Rank,Artist,Title\n1,A,B\n');
  assert.equal(noLabel.provider_period_label,null);
  assert.equal(noLabel.provider_snapshot_date,null);
  assert.equal(noLabel.provider_rolling_window_days,null);
  const inconsistent=parseShazamKenya(
    '"Thursday, 28 October 2026 [performance over the past 7 days]"\n'+
    'Rank,Artist,Title\n1,A,B\n');
  assert.equal(inconsistent.provider_snapshot_date,null);
  assert.equal(inconsistent.provider_rolling_window_days,null);
  assert.equal(inconsistent.native_period,'unknown');
});

test('Shazam preserves literal interior quotes inside quoted public CSV fields',()=>{
  const csv='Shazam Top 200 Kenya\n2026-W42\nRank,Artist,Title\n'+
    '1,"The "Real" Artist","Song "Love" Edit"\n'+
    '2,"The ""Official"" Artist","Song, Version"\n';
  const r=parseShazamKenya(csv);
  assert.equal(r.rows.length,2);
  assert.deepEqual(r.rows.map(x=>[x.rank,x.artist,x.title]),[
    [1,'The "Real" Artist','Song "Love" Edit'],
    [2,'The "Official" Artist','Song, Version'],
  ]);
  assert.equal(r.native_period,'unknown');
  assert.ok(r.rows.every(x=>x.provider_track_id===null));
});

test('Shazam 200-row public CSV with an interior quote on physical line 116 retains all ranks',()=>{
  const rows=Array.from({length:200},(_,i)=>i===112
    ?`113,"The "Real" Artist","Song "Love" Edit"`
    :`${i+1},Artist ${i+1},Song ${i+1}`);
  const csv=`Shazam Top 200 Kenya\n2026-W42\nRank,Artist,Title\n${rows.join('\n')}\n`;
  const r=parseShazamKenya(csv);
  assert.equal(r.rows.length,200);
  assert.equal(r.rows[112].rank,113);
  assert.equal(r.rows[112].artist,'The "Real" Artist');
  assert.equal(r.rows[112].title,'Song "Love" Edit');
  assert.equal(r.chart_depth,200);
  assert.equal(r.native_period,'unknown');
});

test('Shazam retains strict columns, field boundaries and rank integrity',()=>{
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,"Artist"tail,Song\n'),
    /shazam_unterminated_csv_quote/);
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,Artist"bad,Song\n'),
    /shazam_invalid_quoted_csv/);
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,"Artist"x",Song,Injected\n'),
    /shazam_invalid_chart_row/);
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,A,Song,Injected\n'),
    /shazam_invalid_chart_row/);
  // With two rows, a source rank of 3 exceeds declared depth 2 and
  // fails the rank-range check before the subsequent contiguity check.
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,A,Song\n3,B,Other\n'),
    /shazam_ke_duplicate_or_invalid_rank/);
});

test('Apple public most-played is not inferred to be a seven-day consumption total',()=>{
  const payload={feed:{country:'KE',updated:'2026-10-19T00:00:00Z',results:[{id:'121',name:'Song',artistName:'Artist',artistId:'22'}]}};
  const r=parseAppleKenya(payload);
  assert.equal(r.metric,'rank');assert.equal(r.native_period,'unknown');
  assert.equal(r.provider_updated_at,'2026-10-19T00:00:00Z');
  assert.throws(()=>parseAppleKenya({...payload,feed:{...payload.feed,country:'US'}}),/territory_unverified/);

  // Native Music API chart response has no trustworthy market in its JSON
  // payload. The independently approved exact Kenya endpoint is required.
  const api={results:{songs:[{chart:'most-played',data:[
    {id:'131',type:'songs',attributes:{name:'Song A',artistName:'Artist A'}},
    {id:'132',type:'songs',attributes:{name:'Song B',artistName:'Artist B'}},
  ]}]}};
  const endpoint='https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played&limit=100';
  const native=parseAppleKenya(api,{endpoint});
  assert.equal(native.chart_surface,'apple_music_api_most_played');
  assert.equal(native.metric,'rank');
  assert.equal(native.native_period,'unknown');
  assert.equal(native.candidate_only,true);
  assert.equal(native.eligible_for_scoring,false);
  assert.deepEqual(native.rows.map(row=>[row.rank,row.provider_track_id]),[[1,'131'],[2,'132']]);
  assert.equal(native.rows[0].view_count,undefined);
  assert.throws(()=>parseAppleKenya(api),/apple_chart_endpoint_unverified/);
  for(const invalid of [
    endpoint.replace('/ke/','/us/'),
    endpoint.replace('api.music.apple.com','api.music.apple.com.evil.example'),
    endpoint.replace('https:','http:'),
    endpoint.replace('types=songs','types=playlists'),
    endpoint.replace('chart=most-played','chart=top'),
    endpoint+'&genre=1',
    endpoint.replace('limit=100','limit=201'),
    endpoint+'&types=playlists',
  ]) assert.throws(()=>parseAppleKenya(api,{endpoint:invalid}),/apple_chart_endpoint_unverified/);
  assert.throws(()=>parseAppleKenya({results:{songs:[{chart:'top',data:api.results.songs[0].data}]}},{endpoint}),/apple_invalid_chart_response/);
  assert.throws(()=>parseAppleKenya({results:{songs:[{chart:'most-played',data:[
    {...api.results.songs[0].data[0]}, {...api.results.songs[0].data[0]},
  ]}]}},{endpoint}),/apple_ke_duplicate_provider_id/);
  assert.throws(()=>parseAppleKenya({results:{songs:[{chart:'most-played',data:[
    {id:'131',type:'playlists',attributes:{name:'Song',artistName:'Artist'}},
  ]}]}},{endpoint}),/apple_invalid_chart_item/);
});

test('YouTube provider weekly observation retains views, exact target period and separate behavior',()=>{
  const target='weekly:20261016:20261022:ke';
  const payload={metadata:{periodKey:target},charts:{trackViews:[
    {encryptedVideoId:'xyz',name:'Track',artists:[{name:'Singer'}],viewCount:'12,400',chartEntryMetadata:{currentPosition:1}}
  ]}};
  const r=parseYouTubeKenyaWeekly(payload,target);
  assert.equal(r.metric,'rank_and_count');assert.equal(r.behavior,'video_consumption');
  assert.equal(r.rows[0].view_count,12400);assert.equal(r.source_period_key,target);
  assert.throws(()=>parseYouTubeKenyaWeekly(payload,'weekly:20261009:20261015:ke'),/target_period_unavailable/);
  const otherWeek='weekly:20261009:20261015:ke';
  const mismatched={metadata:{periodKey:target},
    charts:{periodKey:otherWeek,trackViews:[{
      encryptedVideoId:'wrong-week',name:'Other week',
      viewCount:999999,chartEntryMetadata:{currentPosition:1},
    }]}};
  assert.throws(()=>parseYouTubeKenyaWeekly(mismatched,target),/target_period_unavailable/);
  const both={charts:[
    {periodKey:otherWeek,trackViews:Array.from({length:3},(_,i)=>({
      encryptedVideoId:'old-'+i,viewCount:1000,chartEntryMetadata:{currentPosition:i+1},
    }))},
    {periodKey:target,trackViews:payload.charts.trackViews},
  ]};
  assert.equal(parseYouTubeKenyaWeekly(both,target).rows[0].provider_track_id,'xyz');

  // Real first-party web-chart response shape: weekly type + source endDate
  // own the rank/view rows; a requested period string never creates that date.
  const siteNode={listType:'TOP_VIEWS_CHART',
    chartPeriodType:'CHART_PERIOD_TYPE_WEEKLY',endDate:'2026-10-22',
    trackViews:payload.charts.trackViews};
  const asSite=(node)=>({contents:{sectionListRenderer:{contents:[
    {musicAnalyticsSectionRenderer:{content:{trackTypes:[node]}}}
  ]}}});
  const access={endpoint:'https://charts.youtube.com/youtubei/v1/browse?alt=json'};
  const native=parseYouTubeKenyaWeekly(asSite(siteNode),target,access);
  assert.equal(native.rows[0].view_count,12400);
  assert.equal(native.provider_week_ending_date,'2026-10-22');
  assert.equal(native.native_period,'unknown');
  assert.equal(native.eligible_for_scoring,false);
  assert.throws(()=>parseYouTubeKenyaWeekly(asSite(siteNode),target,
    {endpoint:'https://charts.youtube.com/charts/TopSongs/us'}),
  /youtube_source_endpoint_unverified/);
  for(const changed of [
    {...siteNode,endDate:'2026-10-15'},
    {...siteNode,endDate:'2026-10-23'},
    {...siteNode,chartPeriodType:'CHART_PERIOD_TYPE_DAILY'},
    {...siteNode,listType:'TOP_VIDEOS_CHART'},
  ])assert.throws(()=>parseYouTubeKenyaWeekly(asSite(changed),target,access),/youtube_/);
  assert.throws(()=>parseYouTubeKenyaWeekly(asSite(siteNode),
    'weekly:20261017:20261022:ke',access),/youtube_target_period_unavailable/);
  assert.throws(()=>parseYouTubeKenyaWeekly({
    contents:{sectionListRenderer:{contents:[{
      musicAnalyticsSectionRenderer:{content:{trackTypes:[siteNode,siteNode]}}
    }]}}
  },target,access),/youtube_ambiguous_weekly_track_views/);

  assert.throws(()=>parseYouTubeKenyaWeekly({
    periodKey:target,charts:{trackViews:payload.charts.trackViews,
      competing:{periodKey:target,trackViews:payload.charts.trackViews}},
  },target),/ambiguous_weekly_track_views/);
});

test('YouTube first-party weekly Top Songs preserves one unresolved native video identity without inventing a video id',()=>{
  const week='weekly:20261030:20261105:ke';
  const access={endpoint:'https://charts.youtube.com/youtubei/v1/browse?alt=json'};
  const rows=Array.from({length:100},(_,i)=>({
    id:'chart:opaque:'+String(i).padStart(3,'0'),
    encryptedVideoId:'v'+String(i).padStart(10,'0'),
    name:'Synthetic Song '+(i+1),artists:[{name:'Synthetic Artist'}],
    viewCount:String(12000-i),chartEntryMetadata:{currentPosition:i+1},
  }));
  delete rows[88].encryptedVideoId;
  const native=trackViews=>({contents:{sectionListRenderer:{contents:[{
    musicAnalyticsSectionRenderer:{content:{trackTypes:[{
      listType:'TOP_VIEWS_CHART',chartPeriodType:'CHART_PERIOD_TYPE_WEEKLY',
      endDate:'2026-11-05',trackViews,
    }]}}
  }]}}});
  const found=parseYouTubeKenyaWeeklyCandidate(native(rows),week,access);
  assert.equal(found.observed_depth,100);
  assert.equal(found.rows.length,100);
  assert.equal(found.rows[88].rank,89);
  assert.equal(found.rows[88].view_count,11912);
  assert.equal(found.rows[88].provider_track_id,null);
  assert.equal(found.unresolved_provider_identity_rows,1);
  assert.equal(found.candidate_only,true);
  assert.equal(found.eligible_for_scoring,false);
  const altered=change=>{
    const copy=rows.map(row=>({...row,chartEntryMetadata:{...row.chartEntryMetadata}}));
    change(copy);return native(copy);
  };
  assert.throws(()=>parseYouTubeKenyaWeeklyCandidate(altered(x=>{
    delete x[87].encryptedVideoId;
  }),week,access),/youtube_native_row_unverified/);
  assert.throws(()=>parseYouTubeKenyaWeeklyCandidate(altered(x=>{
    delete x[88].id;
  }),week,access),/youtube_native_row_unverified/);
  assert.throws(()=>parseYouTubeKenyaWeeklyCandidate(altered(x=>{
    x[88].id=x[0].id;
  }),week,access),/youtube_native_row_unverified/);
  assert.throws(()=>parseYouTubeKenyaWeeklyCandidate(altered(x=>{
    delete x[88].viewCount;
  }),week,access),/youtube_missing_native_view_count/);
  const complete=parseYouTubeKenyaWeeklyCandidate(altered(x=>{
    x[88].encryptedVideoId='v0000000088';
  }),week,access);
  assert.equal(complete.unresolved_provider_identity_rows,0);
  assert.equal(complete.rows[88].provider_track_id,'v0000000088');
});

test('YouTube rejects absent counts, duplicated ranks and invented provider periods',()=>{
  const target='weekly:20261016:20261022:ke';
  const payload={period:target,trackViews:[
    {encryptedVideoId:'a',viewCount:0,chartEntryMetadata:{currentPosition:1}},
    {encryptedVideoId:'b',viewCount:1,chartEntryMetadata:{currentPosition:2}},
  ]};
  assert.equal(parseYouTubeKenyaWeekly(payload,target).rows[0].view_count,0);
  assert.throws(()=>parseYouTubeKenyaWeekly({...payload,trackViews:[payload.trackViews[0],{...payload.trackViews[1],viewCount:'NaN'}]},target),/missing_native_view_count/);
  assert.throws(()=>parseYouTubeKenyaWeekly({...payload,trackViews:[payload.trackViews[0],{...payload.trackViews[1],chartEntryMetadata:{currentPosition:1}}]},target),/duplicate_or_invalid_rank/);
});

test('all source parsers fail closed on empty inputs and never assign a country-level audience estimate',()=>{
  for (const f of [parseMdundoKenya,parseAudiomackKenya,parseBoomplayKenya,parseShazamKenya])
    assert.throws(()=>f(''),Error);
  assert.throws(()=>parseAppleKenya({}),/invalid_feed/);
  assert.throws(()=>parseYouTubeKenyaWeekly({},'weekly:20261016:20261022:ke'),/target_period_unavailable/);
  const r=parseShazamKenya('Rank,Artist,Title\n1,A,B\n');
  assert.equal('plays' in r,false);assert.equal('estimated_listeners' in r,false);
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,A,B\n,Hidden,Missing Rank\n'),
    /shazam_invalid_chart_row/);
  assert.equal(parseShazamKenya('Rank,Artist,Title\n1,A,B\n\n').rows.length,1);
});


test('a provider-native chart interval cannot silently replace the edition tracking week',async()=>{
  const p=assemble();
  p.receipts[0]={...p.receipts[0],source_native_period:{...p.receipts[0].source_native_period,
    starts_at:'2026-10-11T21:00:00Z',ends_at:'2026-10-18T21:00:00Z'}};
  const out=await prepareWeeklyEvidenceFreeze(p);
  assert.equal(out.state,'blocked');
  assert.equal(out.source_summary[0].periods_outside_week,1);
  assert.match(out.blocking.join(';'),/outside tracking week/);

  const q=assemble();
  // YouTube may use a provider-native Friday–Thursday week while a product
  // edition uses a different window; the relation needs explicit authority.
  q.receipts[0]={...q.receipts[0],source_native_period:{...q.receipts[0].source_native_period,
    starts_at:'2026-10-15T21:00:00Z',ends_at:'2026-10-22T21:00:00Z'}};
  const partial=await prepareWeeklyEvidenceFreeze(q);
  assert.equal(partial.state,'blocked');
  assert.equal(partial.source_summary[0].periods_crossing_week_boundary,1);
  assert.match(partial.blocking.join(';'),/explicit alignment policy required/);
});

// WAKILISHA 100 candidate-only source transport/private-byte contract.
// Consolidated into the existing chart kernel suite, not a new permanent test.
import {
  CandidateCaptureError, fetchCandidateBytes, archiveCandidateBytes, sha256Hex,
} from '../../supabase/functions/_shared/chart-candidate-capture.mjs';

const wkCapUrl = 'https://example.org/chart/ke';
const wkCapAuthority = { source_key:'mdundo_ke', exact_endpoint:wkCapUrl,
  authorization_ref:'wk-source-access-v1/fixture', purpose:'candidate_raw_evidence' };
const wkCapBytes = new TextEncoder().encode('<html>KE source fixture</html>');
const wkCapWeek = '2026-10-19';
const wkCapSlot = '2026-10-19T09:00:00Z';
const wkCapInput = (overrides={}) => ({sourceKey:'mdundo_ke',endpoint:wkCapUrl,
  accessDecision:wkCapAuthority,verifyAccess:async()=>true,
  fetchImpl:async (_url,opts)=>{
    assert.equal(opts.redirect,'manual');
    assert.equal(opts.credentials,'omit');
    return new Response(wkCapBytes,{status:200,headers:{'content-type':'text/html'}});
  },now:()=>new Date('2026-10-19T09:02:00Z'),...overrides});
const wkCapReject = (fn,code)=>assert.rejects(fn,
  e=>e instanceof CandidateCaptureError && e.code===code);
const wkCapStorage = () => {
  const objects=new Map(),events=[],entries=[];
  const storage={
    async putCreateOnly(key,bytes,config) {
      events.push('put');assert.equal(config.upsert,false);
      if(objects.has(key))throw Error('collision');objects.set(key,new Uint8Array(bytes));
    },
    async readPrivate(key){events.push('read');return objects.get(key);},
  };
  const ledger={async record(entry){events.push(entry.state);entries.push(entry);}};
  return {objects,events,entries,storage,ledger};
};

test('candidate capture never runs before exact externally verified source access',async()=>{
  let calls=0;
  const transport=async()=>{calls++;return new Response(wkCapBytes);};
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({verifyAccess:async()=>false,fetchImpl:transport})), 'source_access_not_authorized');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({verifyAccess:null,fetchImpl:transport})), 'source_access_verifier_required');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({accessDecision:{...wkCapAuthority,source_key:'apple_ke'},fetchImpl:transport})), 'source_access_invalid');
  for(const url of ['http://example.org/chart/ke','https://127.0.0.1/a','https://host.local/a','https://evil.com@valid.org/a','https://example.org:9000/a'])
    await wkCapReject(()=>fetchCandidateBytes(wkCapInput({endpoint:url,fetchImpl:transport})), 'endpoint_invalid');
  assert.equal(calls,0);
  // A delayed approval must not start a request after the deadline expires.
  let grantLateAccess;
  const lateAccess = new Promise(resolve => { grantLateAccess = resolve; });
  await wkCapReject(() => fetchCandidateBytes(wkCapInput({
    timeoutMs: 100, verifyAccess: () => lateAccess, fetchImpl: transport,
  })), 'transport_timeout');
  grantLateAccess(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls,0);
});

test('candidate HTTP evidence retains exact bytes but refuses redirect, MIME, overage and timeout',async()=>{
  const captured=await fetchCandidateBytes(wkCapInput());
  assert.deepEqual(captured.bytes,wkCapBytes);
  assert.equal(captured.payload_sha256,await sha256Hex(wkCapBytes));
  assert.equal(captured.byte_length,wkCapBytes.length);
  assert.equal('can_publish' in captured,false);
  // Apple API auth is a server-only, exact-host exception. No bearer may be
  // sent to a public chart provider or to a lookalike destination.
  const chartEndpoint='https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played&limit=100';
  const token='eyJhbGciOiJFUzI1NiJ9.appleChartFixture.signature';
  const appleInput={
    sourceKey:'apple_ke',endpoint:chartEndpoint,
    accessDecision:{source_key:'apple_ke',exact_endpoint:chartEndpoint,
      authorization_ref:'wk-source-access-v1/fixture',purpose:'candidate_raw_evidence'},
    providerAuthorization:{kind:'apple_developer_bearer',token},
    verifyAccess:async()=>true,
    now:()=>new Date('2026-10-19T09:02:00Z'),
  };
  const nativeBytes=new TextEncoder().encode('{"results":{"songs":[]}}');
  const native=await fetchCandidateBytes({...appleInput,fetchImpl:async(url,options)=>{
    assert.equal(url,chartEndpoint);
    assert.equal(options.redirect,'manual');
    assert.equal(options.headers.authorization,'Bearer '+token);
    return new Response(nativeBytes,{status:200,headers:{'content-type':'application/json'}});
  }});
  assert.deepEqual(native.bytes,nativeBytes);
  assert.equal('providerAuthorization' in native,false);
  // An enrolled Apple source has a distinct ID; the shared token transport
  // must accept that exact Kenya API route, but never other query variants.
  const scopedApple={...appleInput,sourceKey:'apple_ke_official_chart',
    accessDecision:{...appleInput.accessDecision,source_key:'apple_ke_official_chart'}};
  const scoped=await fetchCandidateBytes({...scopedApple,fetchImpl:async(url,options)=>{
    assert.equal(url,chartEndpoint);
    assert.equal(options.headers.authorization,'Bearer '+token);
    return new Response(nativeBytes,{status:200,headers:{'content-type':'application/json'}});
  }});
  assert.deepEqual(scoped.bytes,nativeBytes);
  let unauthorizedRequests=0;
  const countRequest=async()=>{unauthorizedRequests++;return new Response(nativeBytes);};
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({
    providerAuthorization:{kind:'apple_developer_bearer',token},fetchImpl:countRequest,
  })),'provider_authorization_invalid');
  await wkCapReject(()=>fetchCandidateBytes({...appleInput,
    endpoint:chartEndpoint.replace('api.music.apple.com','api.music.apple.com.evil.example'),
    fetchImpl:countRequest,
  }),'provider_authorization_invalid');
  await wkCapReject(()=>fetchCandidateBytes({...appleInput,
    providerAuthorization:{kind:'apple_developer_bearer',token:'bad\\nheader'},fetchImpl:countRequest,
  }),'provider_authorization_invalid');
  await wkCapReject(()=>fetchCandidateBytes({...scopedApple,
    endpoint:chartEndpoint+'&country=us',fetchImpl:countRequest,
  }),'provider_authorization_invalid');
  await wkCapReject(()=>fetchCandidateBytes({...scopedApple,
    endpoint:chartEndpoint.replace('/ke/','/us/'),fetchImpl:countRequest,
  }),'provider_authorization_invalid');
  assert.equal(unauthorizedRequests,0);
  const fixtureResponse=(body,status,type,extra={})=>async()=>new Response(body,{status,headers:{'content-type':type,...extra}});
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse(null,302,'text/html',{location:'https://wrong.tld'})})), 'redirect_forbidden');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse('oops',503,'text/html')})), 'upstream_http_unaccepted');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse('oops',200,'text/plain')})), 'upstream_content_type_unaccepted');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse(new Uint8Array(4_194_305),200,'application/octet-stream')})), 'raw_body_too_large');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({timeoutMs:100,fetchImpl:async()=>new Promise(()=>{})})), 'transport_timeout');
});


test('WK100 candidate transport only POSTs a first-party YouTube Kenya native weekly chart',async()=>{
  const endpoint='https://charts.youtube.com/youtubei/v1/browse?alt=json';
  const key='weekly:20261023:20261029:ke';
  const source='youtube_ke_weekly_top_songs';
  let sent=0,verified=0;
  const nativeBytes=new TextEncoder().encode('{"firstParty":true}');
  const input={sourceKey:source,endpoint,method:'POST',nativePeriodKey:key,
    accessDecision:{source_key:source,exact_endpoint:endpoint,
      authorization_ref:'wk-source-access-v1/fixture',purpose:'candidate_raw_evidence'},
    verifyAccess:async (_authority,meta)=>{
      verified++;assert.equal(meta.method,'POST');return true;
    },
    fetchImpl:async (_url,opts)=>{
      sent++;
      assert.equal(opts.method,'POST');
      assert.equal(opts.redirect,'manual');
      assert.equal(opts.credentials,'omit');
      assert.equal(opts.headers['content-type'],'application/json');
      assert.equal(opts.headers.authorization,undefined);
      const body=JSON.parse(opts.body);
      assert.equal(body.browseId,'FEmusic_analytics_charts_home');
      assert.equal(body.context.client.gl,'KE');
      assert.equal(body.query.includes('chart_params_chart_type=TRACKS'),true);
      assert.equal(body.query.includes('chart_params_period_type=WEEKLY'),true);
      assert.equal(body.query.includes('chart_params_end_date=20261029'),true);
      return new Response(nativeBytes,{status:200,
        headers:{'content-type':'application/json'}});
    }};
  const allowed=await fetchCandidateBytes(input);
  assert.deepEqual(allowed.bytes,nativeBytes);
  assert.equal(sent,1);assert.equal(verified,1);
  for(const invalid of [
    {sourceKey:'audiomack_ke_weekly_100',
      accessDecision:{...input.accessDecision,source_key:'audiomack_ke_weekly_100'}},
    {sourceKey:'youtube_ke',
      accessDecision:{...input.accessDecision,source_key:'youtube_ke'}},
    {endpoint:'https://charts.youtube.com/youtubei/v1/browse?alt=json&us=1',
      accessDecision:{...input.accessDecision,exact_endpoint:'https://charts.youtube.com/youtubei/v1/browse?alt=json&us=1'}},
    {endpoint:'https://charts.youtube.com.evil.example/youtubei/v1/browse?alt=json',
      accessDecision:{...input.accessDecision,exact_endpoint:'https://charts.youtube.com.evil.example/youtubei/v1/browse?alt=json'}},
    {nativePeriodKey:'weekly:20261023:20261030:ke'},
    {nativePeriodKey:'weekly:20261016:20261029:ke'},
    {nativePeriodKey:'weekly:20261023:20261029:us'},
    {nativePeriodKey:'weekly:20260230:20260305:ke'},
    {nativePeriodKey:null},
    {method:'PUT'},
    {providerAuthorization:{kind:'apple_developer_bearer',token:'not-a-real-token'}},
  ]){
    await assert.rejects(()=>fetchCandidateBytes({...input,...invalid}),
      e=>e instanceof CandidateCaptureError);
  }
  assert.equal(sent,1,'invalid attempts must not reach first-party network');
  assert.equal(verified,1,'invalid attempts must not reach authorization');
  await wkCapReject(()=>fetchCandidateBytes({...input,
    verifyAccess:async()=>false,
    fetchImpl:async()=>{sent++;throw Error('should not fetch');}}),
    'source_access_not_authorized');
  assert.equal(sent,1);
});

test('candidate private archive persists reservation before create-only, rechecks bytes and never publishes',async()=>{
  const capture=await fetchCandidateBytes(wkCapInput());
  const f=wkCapStorage();
  const args={capture,weekStartEat:wkCapWeek,scheduledAt:wkCapSlot,attemptNumber:1,storage:f.storage,ledger:f.ledger};
  const result=await archiveCandidateBytes(args);
  assert.deepEqual(f.events,['reserved','put','uploaded_unverified','read','verified']);
  assert.match(result.object_key,/^v1\/2026-10-19\/mdundo_ke\/20261019T090000Z-1\/[a-f0-9]{64}\.html$/);
  assert.equal(result.status,'candidate_only_verified');
  assert.equal(result.can_publish,false);
  assert.equal(f.objects.size,1);
  await wkCapReject(()=>archiveCandidateBytes(args),'raw_storage_create_failed');
  assert.equal(f.objects.size,1);
  assert.equal(f.entries.at(-1).state,'reserved');
});

test('candidate archive stops on digest, missing ledger, corrupt readback and invalid EAT slot',async()=>{
  const capture=await fetchCandidateBytes(wkCapInput());
  const f=wkCapStorage();
  const args={capture,weekStartEat:wkCapWeek,scheduledAt:wkCapSlot,attemptNumber:1,storage:f.storage,ledger:f.ledger};
  await wkCapReject(()=>archiveCandidateBytes({...args,capture:{...capture,payload_sha256:'0'.repeat(64)}}),'capture_digest_mismatch');
  await wkCapReject(()=>archiveCandidateBytes({...args,scheduledAt:'2026-10-25T21:00:00Z'}),'slot_outside_eat_week');
  await wkCapReject(()=>archiveCandidateBytes({...args,attemptNumber:9}),'attempt_number_invalid');
  assert.deepEqual(f.events,[]);
  await assert.rejects(()=>archiveCandidateBytes({...args,ledger:{record:async()=>{throw Error('durability unavailable')}}}),/durability unavailable/);
  assert.equal(f.objects.size,0);
  await wkCapReject(()=>archiveCandidateBytes({...args,storage:{...f.storage,readPrivate:async(key)=>new Uint8Array((await f.storage.readPrivate(key)).length)}}),'raw_storage_integrity_mismatch');
  assert.equal(f.objects.size,1); // retained for explicit reconciliation, never deleted
  assert.deepEqual(f.entries.map(x=>x.state),['reserved','uploaded_unverified']);
});

// Integrated WK100 candidate-only collector contract. Existing chart suite owner.
import { runCandidateCapture,validateCaptureSlot,resolveCaptureParser,parseCaptureNativeRows } from '../../supabase/functions/_shared/chart-capture-runtime.mjs';
import { isWk100AppleCatalogChart,resolveWk100AppleProviderAuthorization } from '../../supabase/functions/_shared/wk100-apple-service-credential.mjs';
import { planWk100SourceDispatch } from '../../supabase/functions/_shared/wk100-source-dispatch-plan.mjs';
const wkRuntimeSlot='2026-10-19T09:00:00Z';
const wkRuntimeWeek='2026-10-19';
const wkRuntimeBytes=new TextEncoder().encode('<div class="md-playlist-song-item" data-index="1" data-id="123" data-playlist-url="/top-charts/ke" data-title="Song" data-artist="Singer"></div>');
const wkRuntimeContract={id:'10000000-0000-4000-8000-000000000001',source_key:'mdundo_ke',contract_version:'fixture-v1',
  admission_state:'candidate',market:'KE',behavior:'consumption',native_metric:'rank',expected_depth:1,
  cadence_kind:'daily',interval_hours:null,eat_hour:12,eat_minute:0,weekday_eat:null,
  minimum_healthy_checkpoints:1,adapter_version:'fixture-v1'};
const wkRuntimeAccess={source_key:'mdundo_ke',endpoint:'https://example.org/chart/ke',
  authorization_ref:'WK100-ACCESS-TEST-1'};
function wkRuntimeHarness(extra={}) {
  const events=[],objects=new Map();
  const db={
    async reserve() {events.push('reserve');return {state:'reserved',reservation_id:'reservation1',lease_id:'lease1'};},
    async advance(p){events.push(`advance:${p.p_action}`);return {accepted:true};},
    async commit(p){events.push('commit');assert.equal(p.p_rows.length,p.p_outcome==='succeeded'?1:0);
      return {status:p.p_outcome,receipt_id:'receipt1'};},
    async fail(p){events.push('fail');return {status:p.p_outcome,receipt_id:'failed1'};},
  };
  const storage={
    async putCreateOnly(key,bytes,options){events.push('put');assert.equal(options.upsert,false);
      if(objects.has(key))throw Error('duplicate');objects.set(key,new Uint8Array(bytes));},
    async readPrivate(key){events.push('read');const bytes=objects.get(key);
      if(!bytes)throw Error('missing');return new Uint8Array(bytes);},
  };
  const args={contract:wkRuntimeContract,weekStartEat:wkRuntimeWeek,
    scheduledAt:wkRuntimeSlot,attemptNumber:1,access:wkRuntimeAccess,
    verifyAccess:async()=>{events.push('authorize');return true;},
    db,storage,enabled:true,
    clock:()=>new Date('2026-10-19T09:02:00Z'),
    fetchImpl:async()=>{events.push('fetch');return new Response(wkRuntimeBytes,{status:200,headers:{'content-type':'text/html'}});},
    ...extra};
  return {events,objects,db,storage,args};
}

test('WK100 Audiomack original URL tags and current title tags cannot become unverified collector ranks',()=>{
  const contract={...wkRuntimeContract,source_key:'audiomack_ke_weekly_public',
    provider_key:'audiomack_ke',adapter_version:'audiomack_kenya_chart_v1',
    expected_depth:100};
  const access={source_key:contract.source_key,parser_class:contract.adapter_version,
    endpoint:'https://audiomack.com/geo-charts/playlist/kenya'};
  assert.equal(resolveCaptureParser(contract,access)?.providerKey,'audiomack_ke');
  const titleOriginal='<title>Weekly 100: Kenya</title>'+Array.from({length:100},(_,i)=>
    '<meta property="music:song" content="Actual-public-title-'+(i+1)+'">').join('');
  const oldUrlOriginal='<script>{"track_count":2}</script>'+
    '<meta property="music:song" content="https://audiomack.com/ke-artist/song-1">'+
    '<meta property="music:song" content="https://audiomack.com/ke-artist/song-2">';
  for(const [original,depth] of [[titleOriginal,100],[oldUrlOriginal,2]]){
    const bytes=new TextEncoder().encode(original);
    assert.throws(()=>parseCaptureNativeRows(bytes,{...contract,expected_depth:depth},access),
      e=>e?.code==='source_rank_unverified');
  }
});

test('Spotify scoped collector adapter preserves native chart-eligible streams without YouTube view labels',()=>{
  const header='rank,uri,artist_names,track_name,source,peak_rank,previous_rank,weeks_on_chart,streams';
  const csv=[header,
    '1,spotify:track:'+ 'A'.repeat(22)+',"Singer, Guest","Song, Mix",Label,1,0,2,2433',
    '2,spotify:track:'+ 'B'.repeat(22)+',Another,Second,Label,2,1,1,2000',
  ].join('\n');
  const parsed=parseSpotifyKenyaWeeklyCandidate(csv);
  assert.equal(parsed.source_key,'spotify_ke');
  assert.equal(parsed.market,'KE'); // Contract-bound territory, not attested by CSV.
  assert.equal(parsed.source_market_authority,'external_method_review_required');
  assert.equal(parsed.source_period_authority,'unknown');
  assert.equal(parsed.eligible_for_scoring,false);
  assert.equal(parsed.source_admitted,false);
  assert.equal(parsed.can_collect,false);assert.equal(parsed.can_publish,false);
  const contract={...wkRuntimeContract,provider_key:'spotify_ke',
    source_key:'spotify_ke_official_weekly',adapter_version:'spotify_kenya_offered_chart_csv_v1',
    behavior:'consumption',native_metric:'rank_and_count',expected_depth:2};
  const access={parser_class:'spotify_kenya_offered_chart_csv_v1'};
  assert.equal(resolveCaptureParser(contract,access)?.providerKey,'spotify_ke');
  assert.equal(resolveCaptureParser({...contract,source_key:'spotify_ke'},access),null);
  assert.equal(resolveCaptureParser({...contract,source_key:'spotify_ke_playlist'},{}),null);
  assert.equal(resolveCaptureParser({...contract,adapter_version:'youtube_kenya_weekly_top_songs_v1'},access),null);
  assert.equal(resolveCaptureParser({...contract,provider_key:'youtube_ke'},access),null);
  const rows=parseCaptureNativeRows(new TextEncoder().encode(csv),contract,access);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.source_native_count),[2433,2000]);
  assert(rows.every(r=>!Object.hasOwn(r,'view_count')));
  assert.equal(rows[0].title,'Song, Mix');
  assert.equal(rows[0].artist,'Singer, Guest');
  assert.throws(()=>parseCaptureNativeRows(new TextEncoder().encode(csv),
    {...contract,native_metric:'rank'},access),/parser_contract_mismatch/);
  assert.throws(()=>parseCaptureNativeRows(new TextEncoder().encode(csv),
    contract,{}),e=>e?.code==='source_unimplemented');
});

test('Spotify collector candidate uses existing original-byte Storage/SQL lease without granting source authority',async()=>{
  // Synthetic fixture, NOT official KE chart evidence or authorized Spotify egress.
  const csv=['rank,uri,artist_names,track_name,source,peak_rank,previous_rank,weeks_on_chart,streams',
    '1,spotify:track:'+ 'A'.repeat(22)+',Artist,Song,Label,1,0,1,200',
    '2,spotify:track:'+ 'B'.repeat(22)+',Another,Second,Label,2,1,1,150'].join('\n');
  const bytes=new TextEncoder().encode(csv);
  const contract={...wkRuntimeContract,source_key:'spotify_ke_official_weekly',
    provider_key:'spotify_ke',adapter_version:'spotify_kenya_offered_chart_csv_v1',
    behavior:'consumption',native_metric:'rank_and_count',expected_depth:2};
  const access={source_key:contract.source_key,
    endpoint:'https://example.org/reviewed-spotify-candidate-not-real',
    authorization_ref:'WK100-ACCESS-TEST-1',parser_class:contract.adapter_version};
  const f=wkRuntimeHarness({contract,access,
    fetchImpl:async()=>{f.events.push('fetch');return new Response(bytes,{
      status:200,headers:{'content-type':'text/csv'},
    });},
  });
  let pRows=null;
  f.db.commit=async p=>{
    f.events.push('commit');
    assert.equal(p.p_outcome,'succeeded');
    assert.equal(p.p_native_period_start,null);
    assert.equal(p.p_native_period_end,null);
    assert.equal(p.p_native_period_evidence_ref,null);
    pRows=p.p_rows;
    return {status:p.p_outcome,receipt_id:'fixture-receipt'};
  };
  const result=await runCandidateCapture(f.args);
  assert.equal(result.status,'succeeded');
  assert.equal(result.can_publish,false);
  assert.deepEqual(pRows.map(r=>r.view_count),[200,150]);
  assert.deepEqual(pRows.map(r=>r.provider_track_id),['A'.repeat(22),'B'.repeat(22)]);
  assert(f.events.includes('fetch')&&f.events.includes('put')&&
    f.events.includes('read')&&f.events.includes('commit'));
  assert.equal(f.objects.size,1);
  const stored=[...f.objects.values()][0];
  assert.deepEqual(stored,bytes);
  assert.equal(result.payload_sha256,
    await (await import('../../supabase/functions/_shared/chart-candidate-capture.mjs')).sha256Hex(bytes));
  const denied=wkRuntimeHarness({contract,access,
    verifyAccess:async()=>false,
    fetchImpl:async()=>{throw Error('must not fetch unapproved Spotify source');},
  });
  await assert.rejects(()=>runCandidateCapture(denied.args),/source_access_not_authorized/);
  assert.deepEqual(denied.events,[]);
});

test('WK100 Apple signing is exact-route, opt-in, project-local and never creates collection authority',async()=>{
  const {webcrypto}=await import('node:crypto');
  const pair=await webcrypto.subtle.generateKey(
    {name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pkcs8=await webcrypto.subtle.exportKey('pkcs8',pair.privateKey);
  const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(pkcs8).toString('base64')+
    '\n-----END PRIVATE KEY-----';
  const secrets={
    apple_music_private_key:pem,
    apple_music_team_id:'ABCDEFGHIJ',
    apple_music_key_id:'0123456789',
  };
  const calls=[];
  const db={
    from(table){
      assert.equal(table,'admin_settings_secrets');
      return {
        select(name){
          assert.equal(name,'setting_value');
          return this;
        },
        eq(key,value){
          assert.equal(key,'setting_key');
          calls.push(value);
          this.secretKey=value;
          return this;
        },
        async maybeSingle(){return {data:{setting_value:secrets[this.secretKey]},error:null};},
      };
    },
  };
  const endpoint='https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played&limit=100';
  const base={sourceKey:'apple_ke_kenya_most_played',endpoint,db,
    now:new Date('2026-11-03T11:00:00Z'),subtle:webcrypto.subtle};
  assert.equal(isWk100AppleCatalogChart(base.sourceKey,endpoint),true);
  for(const bad of [
    'http://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played',
    'https://api.music.apple.com.evil.test/v1/catalog/ke/charts?types=songs&chart=most-played',
    'https://api.music.apple.com/v1/catalog/us/charts?types=songs&chart=most-played',
    'https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played&chart=most-played',
    'https://api.music.apple.com/v1/catalog/ke/charts?types=songs&chart=most-played&redirect=evil',
  ])assert.equal(isWk100AppleCatalogChart(base.sourceKey,bad),false);
  assert.equal(await resolveWk100AppleProviderAuthorization(base),null);
  assert.deepEqual(calls,[]); // no key read unless WK100-specific opt-in
  assert.equal(await resolveWk100AppleProviderAuthorization({
    ...base,sourceKey:'spotify_ke_playlist',reuseExisting:true}),null);
  assert.deepEqual(calls,[]);
  const credentials=await resolveWk100AppleProviderAuthorization({
    ...base,reuseExisting:true});
  assert.equal(credentials.kind,'apple_developer_bearer');
  assert.match(credentials.token,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(calls.sort(),Object.keys(secrets).sort());
  const [h,p,signature]=credentials.token.split('.');
  const header=JSON.parse(Buffer.from(h,'base64url').toString('utf8'));
  const payload=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
  assert.deepEqual(header,{alg:'ES256',kid:'0123456789'});
  assert.equal(payload.iss,'ABCDEFGHIJ');
  assert.equal(payload.iat,1793703600);
  assert.equal(payload.exp-payload.iat,3600);
  assert.equal(await webcrypto.subtle.verify(
    {name:'ECDSA',hash:'SHA-256'},pair.publicKey,
    Buffer.from(signature,'base64url'),new TextEncoder().encode(h+'.'+p)),true);
  // An expired/incorrect signing key cannot accidentally create a token.
  secrets.apple_music_private_key='uploaded:server';
  assert.equal(await resolveWk100AppleProviderAuthorization({
    ...base,reuseExisting:true}),null);
  assert.equal(await resolveWk100AppleProviderAuthorization({
    ...base,directToken:'invalid',reuseExisting:true}),null);
  const direct=await resolveWk100AppleProviderAuthorization({
    ...base,directToken:'token-'+ 'a'.repeat(40)});
  assert.equal(direct.token,'token-'+ 'a'.repeat(40));
});

test('WK100 integrated collector authorizes source before durable slot claim, stores and commits without publishing',async()=>{
  const f=wkRuntimeHarness();const r=await runCandidateCapture(f.args);
  assert.deepEqual(f.events,['authorize','reserve','authorize','fetch','advance:bind','put','advance:uploaded','read','advance:verified','commit']);
  assert.equal(r.status,'succeeded');assert.equal(r.can_publish,false);
  assert.equal(f.objects.size,1);
  assert.match(r.raw_object_key,/^v1\/2026-10-19\/mdundo_ke\/20261019T090000Z-1\/[a-f0-9]{64}\.html$/);
});

// Accelerated gate: two logical EAT weeks in the existing isolated collector
// harness, NOT two purported live provider observations or a real-time soak.
test('WK100 two consecutive EAT weeks keep distinct raw bytes, slots and idempotent receipts without elapsed calendar delay',async()=>{
  const f=wkRuntimeHarness();
  const receipts=new Map();
  let networkCalls=0;
  f.db.reserve=async({p_contract_id,p_week_start_eat,p_scheduled_at,p_attempt_number})=>{
    assert.equal(p_contract_id,wkRuntimeContract.id);
    const id=[p_week_start_eat,p_scheduled_at,p_attempt_number].join('/');
    const committed=receipts.get(id);
    return committed
      ?{state:'committed',receipt_id:committed.receipt_id}
      :{state:'reserved',reservation_id:id,lease_id:'fixture-exclusive-lease'};
  };
  f.db.commit=async p=>{
    assert.equal(p.p_outcome,'succeeded');
    assert.equal(p.p_rows.length,1);
    // Neither an injected week nor an HTML page can invent native-period evidence.
    assert.equal(p.p_native_period_start,null);
    assert.equal(p.p_native_period_end,null);
    assert.equal(p.p_native_period_evidence_ref,null);
    const receipt_id='synthetic-only-receipt-'+(receipts.size+1);
    assert.equal(receipts.has(p.p_reservation_id),false);
    receipts.set(p.p_reservation_id,{receipt_id,rows:p.p_rows});
    return {status:p.p_outcome,receipt_id};
  };
  const weeks=[
    {week:'2026-10-19',slot:'2026-10-19T09:00:00Z',song:'123'},
    {week:'2026-10-26',slot:'2026-10-26T09:00:00Z',song:'456'},
  ];
  // The real dispatch planner, not an invented timer implementation, is run
  // for both adjacent logical EAT weeks. Decisions and provider bytes below
  // are synthetic authority fixtures and never qualify a live Kenya source.
  const planContract={...wkRuntimeContract,provider_key:'mdundo_ke'};
  const syntheticMethod={
    source_key:'mdundo_ke',provider_key:'mdundo_ke',contract_version:'fixture-v1',
    state:'collector_admitted',enabled:true,native_period_state:'provider_defined',
    native_period_evidence_ref:'synthetic_period_marker_not_a_provider_fact',
    authorization_ref:'WK100-ACCESS-TEST-1',constitution_version:'ci-only-v1',
    evidence_sha256:'f'.repeat(64),endpoint_sha256:'e'.repeat(64),
    authorization_expires_at:'2026-11-30T00:00:00Z',
  };
  for(const {week,slot,song} of weeks){
    const nowUtc=new Date(Date.parse(slot)+2*60_000).toISOString().replace('.000Z','Z');
    const schedule={weekStartEat:week,nowUtc,sourceContracts:[planContract],
      approvedDecisions:[syntheticMethod],attempts:[],executionEnabled:true};
    const plan=planWk100SourceDispatch(schedule);
    assert.equal(plan.canPublish,false);
    assert.equal(plan.canScore,false);
    assert.deepEqual(plan.jobs,[{
      source_key:'mdundo_ke',contract_version:'fixture-v1',
      week_start_eat:week,scheduled_at:slot,attempt_number:1,
    }]);
    const alreadyObserved=planWk100SourceDispatch({
      ...schedule,attempts:[{
        contract_id:planContract.id,scheduled_at:slot,
        attempt_number:1,status:'succeeded',
      }],
    });
    assert.equal(alreadyObserved.jobs.length,0);
    assert.equal(alreadyObserved.blocked[0]?.code,'slot_already_observed');
    const disabled=planWk100SourceDispatch({...schedule,executionEnabled:false});
    assert.equal(disabled.jobs.length,0);
    assert.equal(disabled.blocked[0]?.code,'scheduler_disabled');
    const observedAt=new Date(Date.parse(slot)+2*60_000);
    f.args.weekStartEat=week;
    f.args.scheduledAt=slot;
    f.args.clock=()=>new Date(observedAt);
    f.args.fetchImpl=async()=>{
      networkCalls+=1;
      return new Response(
        '<div class="md-playlist-song-item" data-index="1" data-id="'+song+
        '" data-playlist-url="/top-charts/ke" data-title="Fixture song" data-artist="Fixture"></div>',
        {status:200,headers:{'content-type':'text/html'}},
      );
    };
    const result=await runCandidateCapture(f.args);
    assert.equal(result.status,'succeeded');
    assert.equal(result.can_publish,false);
    assert.equal(result.raw_object_key.startsWith('v1/'+week+'/mdundo_ke/'),true);
    const duplicate=await runCandidateCapture(f.args);
    assert.equal(duplicate.status,'already_committed');
    assert.equal(duplicate.can_publish,false);
  }
  assert.equal(networkCalls,2); // a replay never creates another provider GET
  assert.equal(receipts.size,2);
  assert.equal(f.objects.size,2);
  const originalKeys=[...f.objects.keys()];
  assert.equal(new Set(originalKeys).size,2);
  assert.notDeepEqual(f.objects.get(originalKeys[0]),f.objects.get(originalKeys[1]));
  assert.deepEqual([...receipts.values()].map(r=>r.rows[0].provider_track_id),['123','456']);
  await assert.rejects(()=>runCandidateCapture({
    ...f.args,weekStartEat:'2026-10-19',scheduledAt:'2026-10-26T09:00:00Z',
  }),/slot_unexpected/);
  assert.equal(networkCalls,2);
  assert.equal(receipts.size,2);
});

test('WK100 integrated collector rejects inactive, unapproved and mistimed sources before any claim',async()=>{
  const f=wkRuntimeHarness();
  await assert.rejects(()=>runCandidateCapture({...f.args,enabled:false}),/capture_not_enabled/);
  await assert.rejects(()=>runCandidateCapture({...f.args,verifyAccess:async()=>false}),/source_access_not_authorized/);
  await assert.rejects(()=>runCandidateCapture({...f.args,scheduledAt:'2026-10-19T10:00:00Z'}),/slot_unexpected/);
  await assert.rejects(()=>runCandidateCapture({...f.args,clock:()=>new Date('2026-10-19T09:21:00Z')}),/slot_outside_capture_window/);
  assert.deepEqual(f.events,[]);
});

test('WK100 integrated collector resumes bound original bytes, never silently polls a changed provider',async()=>{
  const f=wkRuntimeHarness();
  const digest=await (await import('../../supabase/functions/_shared/chart-candidate-capture.mjs')).sha256Hex(wkRuntimeBytes);
  const key=`v1/${wkRuntimeWeek}/mdundo_ke/20261019T090000Z-1/${digest}.html`;
  f.objects.set(key,new Uint8Array(wkRuntimeBytes));
  f.args.db.reserve=async()=>({state:'bound',reservation_id:'reservation1',lease_id:'lease1',
    object_key:key,payload_sha256:digest,byte_length:wkRuntimeBytes.length,
    content_type:'text/html',fetched_at:'2026-10-19T09:01:00.000Z'});
  f.args.fetchImpl=async()=>{throw Error('provider must NOT be polled on restart');};
  const result=await runCandidateCapture(f.args);
  assert.equal(result.status,'succeeded');assert.equal(result.can_publish,false);
  assert(!f.events.includes('fetch'));assert.deepEqual(f.events,['authorize','read','advance:uploaded','advance:verified','commit']);
  f.objects.set(key,new Uint8Array([0,1,2]));
  await assert.rejects(()=>runCandidateCapture(f.args),/reconciliation_digest_mismatch/);
});

test('WK100 preserves wrong YouTube native week as quarantined receipt, distinct from malformed counts',async()=>{
  const target='weekly:20261016:20261022:ke';
  const contract={...wkRuntimeContract,source_key:'youtube_ke',provider_key:'youtube_ke',
    behavior:'video_consumption',native_metric:'rank_and_count',
    cadence_kind:'weekly',weekday_eat:3,expected_depth:1};
  const periodFixture=(periodKey,viewCount)=>new TextEncoder().encode(JSON.stringify({
    metadata:{periodKey},charts:{trackViews:[{
      encryptedVideoId:'fixture-video',name:'Fixture track',
      artists:[{name:'Fixture artist'}],viewCount,
      chartEntryMetadata:{currentPosition:1},
    }]},
  }));
  const make=bytes=>{
    const f=wkRuntimeHarness({
      contract,weekStartEat:'2026-10-19',scheduledAt:'2026-10-22T09:00:00Z',
      clock:()=>new Date('2026-10-22T09:02:00Z'),
      access:{source_key:'youtube_ke',endpoint:'https://example.org/chart/ke',
        authorization_ref:'WK100-ACCESS-TEST-1',native_period_key:target},
      fetchImpl:async()=>new Response(bytes,{status:200,
        headers:{'content-type':'application/json'}}),
    });
    const commits=[];
    f.db.commit=async p=>{
      commits.push(p);
      assert.deepEqual(p.p_rows,[]);
      assert.equal(p.p_native_period_start,null);
      assert.equal(p.p_native_period_end,null);
      assert.equal(p.p_native_period_evidence_ref,null);
      return {status:p.p_outcome,receipt_id:'synthetic-only-receipt'};
    };
    return {...f,commits};
  };
  const wrong=make(periodFixture('weekly:20261009:20261015:ke','12400'));
  const missing=await runCandidateCapture(wrong.args);
  assert.equal(missing.status,'target_period_unavailable');
  assert.equal(missing.can_publish,false);
  assert.equal(wrong.commits[0].p_outcome,'target_period_unavailable');
  assert.equal(wrong.commits[0].p_failure_code,'source_target_period_unavailable');
  assert.equal(wrong.objects.size,1); // exact original bytes remain archived privately
  const malformed=make(periodFixture(target,'not-a-count'));
  const parsed=await runCandidateCapture(malformed.args);
  assert.equal(parsed.status,'parse_failed');
  assert.equal(parsed.can_publish,false);
  assert.equal(malformed.commits[0].p_failure_code,'source_parse_failed');
  assert.equal(malformed.objects.size,1);
  const method={source_key:'youtube_ke',provider_key:'youtube_ke',contract_version:'fixture-v1',
    state:'collector_admitted',enabled:true,native_period_state:'provider_defined',
    native_period_evidence_ref:'synthetic_only_not_provider_evidence',
    authorization_ref:'WK100-ACCESS-TEST-1',constitution_version:'ci-only-v1',
    evidence_sha256:'f'.repeat(64),endpoint_sha256:'e'.repeat(64),
    authorization_expires_at:'2026-11-30T00:00:00Z'};
  const plan=planWk100SourceDispatch({
    weekStartEat:'2026-10-19',nowUtc:'2026-10-22T09:02:00Z',
    sourceContracts:[contract],approvedDecisions:[method],
    attempts:[{contract_id:contract.id,scheduled_at:'2026-10-22T09:00:00Z',
      attempt_number:1,status:'target_period_unavailable'}],executionEnabled:true,
  });
  assert.equal(plan.jobs.length,0);
  assert.equal(plan.blocked[0]?.code,'source_quarantined');
  assert.equal(plan.canPublish,false);
});

test('WK100 integrated collector persists a transport failure and never commits truncated raw rows',async()=>{
  const f=wkRuntimeHarness({fetchImpl:async()=>new Response('blocked',{status:503,headers:{'content-type':'text/html'}})});
  const result=await runCandidateCapture(f.args);
  assert.equal(result.status,'transport_failed');assert.equal(result.can_publish,false);
  assert(f.events.includes('fail'));assert(!f.events.includes('commit'));assert.equal(f.objects.size,0);
  const g=wkRuntimeHarness();
  g.storage.readPrivate=async()=>{g.events.push('read');return new Uint8Array([1,2,3]);};
  await assert.rejects(()=>runCandidateCapture(g.args),/raw_storage_integrity_mismatch/);
  assert(!g.events.includes('commit'));assert.equal(g.objects.size,1);
});


// The Edge gateway authenticates the signature. These tests seal the handler's
// additional fail-closed checks; decoding alone is NEVER a signature verifier.
import { readFileSync } from 'node:fs';
import { isGatewayVerifiedServiceRole, runtimeProjectApiUrl } from
  '../../supabase/functions/_shared/chart-capture-gateway-role.mjs';

const wkJwt = (role='service_role',exp=2_108_002_896,iss='supabase',ref='zogdfvoizohrhwmovlpv') => {
  const base64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  return base64({alg:'HS256',typ:'JWT'})+'.'+base64({role,exp,iss,ref})+'.'+('a'.repeat(43));
};

test('WK100 Edge gateway service identity rejects anon, malformed, expired and mismatched keys',()=>{
  const valid=wkJwt(),now=1_792_480_000_000;
  assert.equal(isGatewayVerifiedServiceRole(valid,valid,now),true);
  assert.equal(isGatewayVerifiedServiceRole(wkJwt('anon'),wkJwt('anon'),now),false);
  assert.equal(isGatewayVerifiedServiceRole(wkJwt('service_role',123),wkJwt('service_role',123),now),false);
  assert.equal(isGatewayVerifiedServiceRole(wkJwt('service_role',2_108_002_896,'unknown'),wkJwt('service_role',2_108_002_896,'unknown'),now),false);
  assert.equal(isGatewayVerifiedServiceRole(valid,'wrong',now),false);
  assert.equal(isGatewayVerifiedServiceRole('not-a-jwt','not-a-jwt',now),false);
  assert.equal(isGatewayVerifiedServiceRole('',valid,now),false);
});

test('WK100 Edge runtime authorization is inseparable from verified gateway and project origin',()=>{
  const config=readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8');
  assert.match(config,/\[functions\.wk-chart-capture\]\s*verify_jwt\s*=\s*true/);
  const edge=readFileSync(new URL('../../supabase/functions/wk-chart-capture/index.ts',import.meta.url),'utf8');
  assert.match(edge,/isGatewayVerifiedServiceRole\(bearer,req\.headers\.get\('apikey'\)\)/);
  assert.match(edge,/runtimeProjectApiUrl\(bearer,Deno\.env\.get\('WK100_CAPTURE_PROJECT_REF'\)\)/);
  assert.match(edge,/createClient\(url,bearer,/);
  assert.doesNotMatch(edge,/Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
  const ref='zogdfvoizohrhwmovlpv', production='pgzizndxdyhqmtyywjmt';
  const now=1_792_480_000_000;
  const valid=wkJwt();
  assert.equal(runtimeProjectApiUrl(valid,ref,now),'https://'+ref+'.supabase.co');
  assert.equal(runtimeProjectApiUrl(wkJwt('anon'),ref,now),null);
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',123),ref,now),null);
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',2_108_002_896,'bad'),ref,now),null);
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',2_108_002_896,'supabase','invalid'),ref,now),null);
  assert.equal(runtimeProjectApiUrl('invalid',ref,now),null);
  // The helper only decodes claims. The hosted gateway MUST verify signatures
  // and the separate platform-configured project identity must agree as well.
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',2_108_002_896,'supabase',production),ref,now),null);
  assert.equal(runtimeProjectApiUrl(valid,production,now),null);
  assert.equal(runtimeProjectApiUrl(valid,'',now),null);
  assert.equal(runtimeProjectApiUrl(valid,'invalid',now),null);
  assert.equal(runtimeProjectApiUrl(valid,undefined,now),null);
  assert.doesNotMatch(edge,/Deno\.env\.get\('SUPABASE_URL'\)/);
  assert.doesNotMatch(edge,/runtimeProjectApiUrl\(bearer,req\.url\)/);
  assert(edge.indexOf("candidate_collector_disabled") < edge.indexOf("WK100_CAPTURE_PROJECT_REF"));
});

import {test} from 'node:test';
import {projectWk100RecordingQCCandidates} from '../../src/services/chartsIngestion/wk100RecordingQCCandidates.mjs';
import assert from 'node:assert/strict';
import {
  projectMiziziWk100RegistryCandidates as candidates,
  wk100CandidateTitleKey,
  MIZIZI_WK100_CANDIDATE_CONTRACT,
} from '../../supabase/functions/_shared/mizizi-wk100-registry-candidates.mjs';
import {projectWk100IdentifyObservations as project,wk100RegistryProviderKey,
  wk100ChartScopedObservationRef as chartRef}
  from '../../supabase/functions/_shared/wk100-identify-observations.mjs';

const contractId='11111111-1111-4111-8111-111111111111';
const attemptId='22222222-2222-4222-8222-222222222222';
const trackA='33333333-3333-4333-8333-333333333333';
const trackB='44444444-4444-4444-8444-444444444444';
const sha='a'.repeat(64);
const key=(n)=>String(n).padStart(12,'0');
const row=(n,id,title='Track '+n,artist='Artist '+n)=>({
 id:'55555555-5555-4555-8555-'+key(n),attempt_id:attemptId,
 source_rank:n,provider_track_id:id,title_observed:title,artist_observed:artist,
});
const contract=(n=3,provider='apple_ke')=>({
 id:contractId,source_key:'apple_ke_public_top100',provider_key:provider,
 market:'KE',expected_depth:n,
});
const attempt=(n=3,status='succeeded')=>({
 id:attemptId,contract_id:contractId,week_start_eat:'2026-11-09',
 status,payload_sha256:sha,observed_depth:n,record_count:n,
});
const go=(options={})=>project({
 weekStartEat:'2026-11-09',contract:contract(options.expected??3,options.provider??'apple_ke'),
 attempt:attempt(options.count??3,options.status??'succeeded'),
 rows:options.rows??[row(1,'1'),row(2,null),row(3,'3')],
 typedLinks:options.typedLinks??[],
 legacyLinks:options.legacyLinks??[],
 activeTracks:options.activeTracks??[],
});
test('Apple Kenya provider IDs use exact existing Apple Music Registry namespace',()=>{
 assert.equal(wk100RegistryProviderKey('apple_ke'),'apple_music');
 assert.deepEqual(['apple_ke','audiomack_ke','mdundo_ke','shazam_ke','youtube_ke']
   .map(wk100RegistryProviderKey),['apple_music','audiomack','mdundo','shazam','youtube']);
 assert.throws(()=>wk100RegistryProviderKey('spotify_ke'),/provider_unsupported/);
 const v=go({rows:[row(1,'10001','Song title',null),row(2,'10002'),row(3,null)],
   typedLinks:[{provider_key:'apple_music',provider_track_id:'10001',
     track_id:trackA,match_status:'matched'}],
   legacyLinks:[{provider:'apple_music',provider_entity_id:'10001',
     registry_entity_id:trackA,registry_entity_type:'track',match_status:'confirmed'}],
   activeTracks:[{id:trackA,status:'active'}],
 });
 assert.equal(v.rows[0].canonicalTrackId,trackA);
 assert.equal(v.rows[0].observedArtist,null);
 assert.equal(v.rows[0].provisionalRef,null);
 assert.equal(v.rows[1].reviewReason,'provider_link_missing');
 assert.equal(v.rows[2].reviewReason,'provider_identity_unavailable');
 assert.equal(v.totals.resolved,1);
 assert.equal(v.totals.needsReview,2);
 assert.equal(v.originalReadbackInThisRequest,false);
 assert.deepEqual([v.canWriteRegistry,v.canScore,v.canPublish],[false,false,false]);
});
test('all-origin chart evidence has stable provider-scoped references without Registry admission',async()=>{
  const ref=async (providerKey,providerTrackId,receiptSha256=sha,captureRowId=row(1,'1').id)=>
    chartRef({providerKey,providerTrackId,receiptSha256,captureRowId});
  const apple=await ref('apple_ke','1882060336');
  assert.match(apple,/^wk100:source:v1:apple_music:[a-f0-9]{64}$/);
  assert.equal(apple,await ref('apple_ke','1882060336','b'.repeat(64),row(2,'2').id));
  assert.notEqual(apple,await ref('apple_ke','1882060337'));
  assert.notEqual(apple,await ref('audiomack_ke','1882060336'));
  assert.notEqual(apple,await ref('apple_ke','01882060336'));
  assert.notEqual(apple,await ref('apple_ke','1882060336'.toLowerCase()+'X'));
  assert.equal(await ref('youtube_ke',null),
    'wk100:obs:v1:'+sha+':'+row(1,'1').id);
  assert.notEqual(await ref('youtube_ke',null),await ref('youtube_ke',null,'b'.repeat(64)));
  for(const bad of ['spotify_ke','youtube','shazam'])await assert.rejects(
    ()=>ref(bad,'exact-1'),/wk100_identify_provider_unsupported/);
  for(const bad of ['', ' 1', '1 ', 'bad\nid'])await assert.rejects(
    ()=>ref('apple_ke',bad),/wk100_identify_chart_provider_id_invalid/);
  await assert.rejects(()=>ref('apple_ke','ok','a'),/wk100_identify_chart_observation_receipt_invalid/);
  await assert.rejects(()=>ref('apple_ke',null,sha,'not-a-uuid'),
    /wk100_identify_chart_observation_receipt_invalid/);
  // These are source observations, not Registry UUIDs and cannot mint Artist,
  // Track, provider-link, score or Edition publication authority.
  assert.equal(/^[0-9a-f]{8}-/.test(apple),false);
});

test('Mdundo partial-depth original remains inspectable without inventing the missing rank',()=>{
 const v=go({expected:4,count:3,status:'partial_depth',provider:'mdundo_ke'});
 assert.equal(v.receiptStatus,'partial_depth');
 assert.equal(v.expectedDepth,4);
 assert.equal(v.observedDepth,3);
 assert.equal(v.rows.length,3);
 assert.deepEqual(v.rows.map(x=>x.rank),[1,2,3]);
 assert.match(v.rows[2].provisionalRef,/^wk100:obs:v1:[a-f0-9]{64}:/);
});
test('conflicting and inactive identity links never become a canonical recording match',()=>{
 const conflict=go({typedLinks:[
   {provider_key:'apple_music',provider_track_id:'1',track_id:trackA,match_status:'matched'},
   {provider_key:'apple_music',provider_track_id:'1',track_id:trackB,match_status:'matched'},
   {provider_key:'apple_music',provider_track_id:'3',track_id:trackB,match_status:'matched'},
 ],activeTracks:[{id:trackA,status:'active'}]});
 assert.equal(conflict.rows[0].identityState,'conflicting');
 assert.equal(conflict.rows[0].canonicalTrackId,null);
 assert.equal(conflict.rows[2].identityState,'inactive');
 assert.equal(conflict.rows[2].canonicalTrackId,null);
 assert.equal(conflict.totals.conflicting,1);
 assert.equal(conflict.totals.inactive,1);
});
test('unreviewed links and alias mismatches cannot assert a recording',()=>{
 const out=go({typedLinks:[
   {provider_key:'apple_ke',provider_track_id:'1',track_id:trackA,match_status:'matched'},
   {provider_key:'apple_music',provider_track_id:'3',track_id:trackA,match_status:'needs_review'},
 ],legacyLinks:[{provider:'apple_music',provider_entity_id:'1',
   registry_entity_id:trackA,registry_entity_type:'artist',match_status:'confirmed'}],
 activeTracks:[{id:trackA,status:'active'}]});
 assert.equal(out.totals.resolved,0);
 assert.equal(out.totals.needsReview,3);
});
test('tampered rank, mismatched receipt, fabricated healthy partial, or non-Monday week fail closed',()=>{
 assert.throws(()=>go({rows:[row(1,'1'),row(1,'2'),row(3,'3')]}),/row_invalid/);
 assert.throws(()=>go({count:3,status:'partial_depth'}),/receipt_depth_invalid/);
 assert.throws(()=>project({weekStartEat:'2026-11-10',contract:contract(),
   attempt:attempt(),rows:[row(1,'1'),row(2,'2'),row(3,'3')],
   typedLinks:[],legacyLinks:[],activeTracks:[]}),/week_invalid/);
 assert.throws(()=>go({rows:[{...row(1,'1'),attempt_id:trackA},row(2,'2'),row(3,'3')]}),/row_invalid/);
});

const qweek='2026-11-09';
const qid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const qrow=(n,rank,title,artist,id)=>({
  captureRowId:qid(n),rank,observedTitle:title,observedArtist:artist,
  providerArtistName:null,providerTrackId:id,identityState:'needs_review',
});
const qreceipt=(n,sourceKey,rows)=>({
  schemaVersion:'wk100-admin-identify-observations-v1',weekStartEat:qweek,
  sourceKey,receiptId:qid(n),payloadSha256:'f'.repeat(64),
  receiptStatus:'succeeded',expectedDepth:rows.length,observedDepth:rows.length,
  originalReadbackInThisRequest:false,rows,
  canWriteRegistry:false,canScore:false,canPublish:false,
});

test('WK100 W4 cross-source QC treats artist variants and within-source repeats as review candidates only',()=>{
  const apple=qreceipt(1,'apple_ke_public_top100',[
    qrow(10,1,'Kitemeo',null,'6793757785'),
    qrow(11,2,'Wrong Places','Joshua Baraka','1808449129'),
  ]);
  apple.rows[0].providerArtistName='Kapitani';
  const youtube=qreceipt(2,'youtube_ke_top_songs_weekly',[
    qrow(20,1,'Kitemeo','Kapitani','97mJYdIMkyI'),
    qrow(21,2,'Wrong Places','Joshua Baraka, JAE5','jeKPLNFDoHA'),
  ]);
  const mdundo=qreceipt(3,'mdundo_ke_top100',[
    qrow(30,1,'Kitemeo','Zien Kapitani','7025545'),
    qrow(31,2,'Trap 2020','Free Beats & Instrumentals','1579655'),
    qrow(32,3,'Trap 2020','Free Beats & Instrumentals','1616707'),
  ]);
  const result=projectWk100RecordingQCCandidates({weekStartEat:qweek,
    reviews:[apple,youtube,mdundo]});
  assert.equal(result.observedRows,7);
  assert.deepEqual(result.counts,{
    same_title_artist:1,title_artist_variation:2,
    within_source_repeat:1,provider_id_repeat:0,
  });
  assert.equal(result.groups.find(g=>g.kind==='within_source_repeat').positions.length,2);
  assert.equal(result.groups.find(g=>g.kind==='same_title_artist').sourceCount,2);
  assert.deepEqual([result.canWriteRegistry,result.canScore,result.canPublish],
    [false,false,false]);
});

test('WK100 W4 cross-source QC never merges songs just because the title agrees',()=>{
  const a=qreceipt(4,'a_provider',[qrow(40,1,'Wewe','Harmonize','idA')]);
  const b=qreceipt(5,'b_provider',[qrow(50,1,'Wewe','Johmarley','idB')]);
  const result=projectWk100RecordingQCCandidates({weekStartEat:qweek,reviews:[a,b]});
  assert.equal(result.counts.same_title_artist,0);
  assert.equal(result.counts.title_artist_variation,1);
  assert.equal(result.confirmedActiveLinks,0);
});

test('WK100 W4 QC flags reused native provider IDs without granting any match',()=>{
  const a=qreceipt(6,'a_provider',[
    qrow(60,1,'Track A','Artist','SAME'),
    qrow(61,2,'Track B','Artist','SAME'),
  ]);
  const b=qreceipt(7,'b_provider',[qrow(70,1,'Other','Other','different')]);
  const result=projectWk100RecordingQCCandidates({weekStartEat:qweek,reviews:[a,b]});
  assert.equal(result.counts.provider_id_repeat,1);
  assert.equal(result.counts.within_source_repeat,0);
});

test('WK100 W4 QC rejects stale receipts, identity claims and malformed row rank',()=>{
  const a=qreceipt(8,'a_provider',[qrow(80,1,'A','Artist','id1')]);
  const b=qreceipt(9,'b_provider',[qrow(90,1,'B','Artist','id2')]);
  const run=(r)=>projectWk100RecordingQCCandidates({weekStartEat:qweek,reviews:[a,r]});
  assert.throws(()=>run({...b,weekStartEat:'2026-11-16'}),/receipt_invalid/);
  assert.throws(()=>run({...a,sourceKey:'b_provider'}),/receipt_invalid/);
  assert.throws(()=>run({...b,canPublish:true}),/receipt_invalid/);
  assert.throws(()=>run({...b,rows:[{...b.rows[0],rank:2}]}),/row_invalid/);
  assert.throws(()=>run({...b,receiptStatus:'partial_depth'}),/receipt_invalid/);
});

test('all five WK100 native provider namespaces consume reviewed canonical Registry links',()=>{
 const pairs=[['apple_ke','apple_music'],['audiomack_ke','audiomack'],
   ['mdundo_ke','mdundo'],['shazam_ke','shazam'],['youtube_ke','youtube']];
 for(const [family,namespace] of pairs){
   const v=go({provider:family,rows:[row(1,'native-id'),row(2,'second'),row(3,null)],
     typedLinks:[{provider_key:namespace,provider_track_id:'native-id',track_id:trackA,match_status:'matched'}],
     activeTracks:[{id:trackA,status:'active'}]});
   assert.equal(v.registryProviderKey,namespace);
   assert.equal(v.rows[0].canonicalTrackId,trackA);
   assert.equal(v.rows[0].identityState,'resolved');
   assert.equal(v.rows[1].identityState,'needs_review');
   assert.equal(v.rows[2].identityState,'needs_review');
   assert.deepEqual([v.canWriteRegistry,v.canScore,v.canPublish],[false,false,false]);
 }
});

// MIZIZI existing-Registry candidate boundary, consolidated with W4 tests.
const mboka='4a610192-c5bf-483c-9e4b-bf715836d640';
const siaka='208e0284-93b8-43fd-991e-b17ffa624c4b';
const freestyle='62525a7c-c582-48b6-93dc-a10496fbc626';
const mejja='efdf79dc-9280-406a-b6e3-f8672f6b783f';
const waka='77777777-7777-4777-8777-777777777777';
const track=(id,title,isrc)=>({id,title,normalized_title:wk100CandidateTitleKey(title),
  status:'active',isrc});
const candidateRow=(title,artist,identityState='needs_review')=>({
  observedTitle:title,observedArtist:artist,providerArtistName:null,
  providerTrackId:null,canonicalTrackId:null,identityState,
});
const base=()=>{
  const registryTracks=[track(mboka,'Mboka','QZQAY2651792'),
    track(siaka,'Siaka','QZTLA2696488'),
    track(freestyle,'Freestyle','QZTAS2181684')];
  const registryCredits=[
    {track_id:mboka,artist_id:mejja,status:'active'},
    {track_id:siaka,artist_id:mejja,status:'active'},
    {track_id:freestyle,artist_id:waka,status:'active'},
  ];
  const registryArtists=[
    {id:mejja,display_name:'Mejja',status:'active'},
    {id:waka,display_name:'Wakadinali',status:'active'},
  ];
  return {registryTracks,registryCredits,registryArtists};
};

test('Mboka and Siaka are proposed from existing active Registry credits, never resolved',()=>{
 const source=[candidateRow('Mboka','Mejja'),candidateRow('Mboka','Mejja Genge'),
   candidateRow('Siaka','Mejja, Fik Fameica'),candidateRow('Freestyle','Lil Baby')];
 const result=candidates({...base(),rows:source});
 assert.equal(result.contractVersion,MIZIZI_WK100_CANDIDATE_CONTRACT);
 assert.equal(result.candidateRows,3);
 assert.equal(result.rows[0].registryCandidates[0].trackId,mboka);
 assert.equal(result.rows[0].registryCandidates[0].basis,'exact_artist_credit');
 assert.equal(result.rows[1].registryCandidates[0].basis,'artist_credit_variant');
 assert.equal(result.rows[2].registryCandidates[0].basis,'listed_artist_credit');
 assert.deepEqual(result.rows[3].registryCandidates,[]);
 for(let i=0;i<source.length;i++){
   assert.equal(result.rows[i].canonicalTrackId,null);
   assert.equal(result.rows[i].identityState,'needs_review');
 }
 assert.deepEqual([result.canWriteRegistry,result.canScore,result.canPublish],[false,false,false]);
});
test('accepted Artist alias is only a research clue; pending alias cannot create a lead',()=>{
 const registryAliases=[{canonical_artist_id:mejja,alias_display_name:'Mejja Genge',status:'active'}];
 const accepted=candidates({...base(),registryAliases,rows:[candidateRow('Mboka','Mejja Genge')]});
 assert.equal(accepted.candidateRows,1);
 assert.equal(accepted.rows[0].registryCandidates[0].basis,'exact_artist_credit');
 assert.equal(accepted.rows[0].canonicalTrackId,null);
 const unapproved=candidates({...base(),registryAliases:[{...registryAliases[0],status:'pending'}],
   rows:[candidateRow('Mboka','Entirely Different Performer')]});
 assert.equal(unapproved.candidateRows,0);
});
test('same title, unrelated Artist is not a candidate, even with a real ISRC on the Registry Track',()=>{
 const out=candidates({...base(),rows:[candidateRow('Freestyle','Lil Baby'),candidateRow('Mboka','Completely Different'),
   candidateRow('Freestyle','Wakadinali')]});
 assert.deepEqual(out.rows[0].registryCandidates,[]);
 assert.deepEqual(out.rows[1].registryCandidates,[]);
 assert.equal(out.rows[2].registryCandidates[0].trackId,freestyle);
 assert.equal(out.rows[2].registryCandidates[0].identifierCorroborated,false);
});
test('Shazam missing provider ID is a lead at most; existing resolved Track receives no new claim',()=>{
 const out=candidates({...base(),rows:[
   candidateRow('Mboka','Mejja'),candidateRow('Mboka','Mejja','resolved'),
   candidateRow('Siaka',null),
 ]});
 assert.equal(out.rows[0].registryCandidates.length,1);
 assert.deepEqual(out.rows[1].registryCandidates,[]);
 assert.deepEqual(out.rows[2].registryCandidates,[]);
 assert.equal(out.rows[0].providerTrackId,null);
});
test('inactive, uncredited, and overflow Registry inputs fail closed',()=>{
 const b=base();b.registryTracks[0].status='needs_review';
 assert.equal(candidates({...b,rows:[candidateRow('Mboka','Mejja')]}).candidateRows,0);
 assert.throws(()=>candidates({...base(),rows:Array.from({length:201},()=>candidateRow('Mboka','Mejja'))}),
   /input_unbounded/);
 assert.throws(()=>candidates({...base(),registryCredits:Array(1601).fill({}),
   rows:[candidateRow('Mboka','Mejja')]}),/input_unbounded/);
});

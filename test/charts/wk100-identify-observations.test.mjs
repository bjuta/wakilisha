import {test} from 'node:test';
import {projectWk100RecordingQCCandidates} from '../../src/services/chartsIngestion/wk100RecordingQCCandidates.mjs';
import assert from 'node:assert/strict';
import {projectWk100IdentifyObservations as project,wk100RegistryProviderKey}
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
 assert.equal(wk100RegistryProviderKey('mdundo_ke'),'mdundo_ke');
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

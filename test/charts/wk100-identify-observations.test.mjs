import {test} from 'node:test';
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

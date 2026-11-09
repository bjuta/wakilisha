import test from 'node:test';
import assert from 'node:assert/strict';
import {compareWk100EligibilityRechecks as compare,Wk100RecheckConflict}
  from '../../src/services/chartsIngestion/wk100EligibilityRecheck.mjs';
const u=n=>String(n).padStart(12,'0');
const ROW=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+u(n);
const fields=n=>({
  captureRowId:ROW(n),rank:n,observedTitle:'Song '+n,
  observedArtist:'Artist '+n,providerTrackId:'provider-'+n,
  identityState:n===1?'resolved':'needs_review',
  canonicalTrackId:n===1?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':null,
  registryFactsSha256:(n===1?'a':'b').repeat(64),
  outcome:n===1?'ELIGIBLE':'REVIEW_REQUIRED',
  reasonCodes:n===1?[]:['canonical_identity_needs_review'],
  canScore:false,canPublish:false,
});
const fixture=()=>({
  schemaVersion:'wk100-admin-eligibility-preview-v1',
  weekStartEat:'2026-11-09',
  contractId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  receiptId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  sourceKey:'mdundo_ke_public_top_songs',receiptStatus:'partial_depth',
  payloadSha256:'1'.repeat(64),policySha256:'2'.repeat(64),
  expectedDepth:3,observedDepth:2,configRevision:1,
  counts:{ELIGIBLE:1,EXCLUDED:0,REVIEW_REQUIRED:1,CONFLICTED:0},
  rows:[fields(1),fields(2)],
  canScore:false,canPublish:false,canWriteRegistry:false,
});
const rejected=code=>e=>e instanceof Wk100RecheckConflict&&e.code===code;
test('a real W6 recheck compares every source position without refetching or saving',()=>{
  const before=fixture(),after=structuredClone(before);
  after.rows[0].registryFactsSha256='d'.repeat(64);
  after.rows[0].outcome='REVIEW_REQUIRED';
  after.rows[0].reasonCodes=['primary_artist_origin_unknown'];
  after.rows[1].identityState='resolved';
  after.rows[1].canonicalTrackId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  after.rows[1].registryFactsSha256='e'.repeat(64);
  after.rows[1].outcome='ELIGIBLE';
  after.rows[1].reasonCodes=[];
  after.counts={ELIGIBLE:1,EXCLUDED:0,REVIEW_REQUIRED:1,CONFLICTED:0};
  const result=compare(before,after);
  assert.equal(result.changedCount,2);
  assert.deepEqual(result.changed.map(x=>x.rank),[1,2]);
  assert.equal(result.changed[0].beforeOutcome,'ELIGIBLE');
  assert.equal(result.changed[0].afterOutcome,'REVIEW_REQUIRED');
  assert.equal(result.changed[0].factsChanged,true);
  assert.equal(result.changed[1].afterCanonicalTrackId,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  assert.equal(result.changed[1].afterOutcome,'ELIGIBLE');
  assert.deepEqual([result.immutableSourceRetained,result.policyRetained,
    result.savedCorrection,result.canScore,result.canPublish],[true,true,false,false,false]);
});
test('unchanged reread gives an honest zero-change comparison',()=>{
 const x=fixture(),r=compare(x,structuredClone(x));
 assert.equal(r.changedCount,0);assert.equal(r.evaluatedRows,2);
});
test('Registry fact change is visible even when eligibility result is unchanged',()=>{
 const a=fixture(),b=structuredClone(a);
 b.rows[0].registryFactsSha256='f'.repeat(64);
 const r=compare(a,b);
 assert.equal(r.changedCount,1);
 assert.equal(r.changed[0].outcomeChanged,false);
 assert.equal(r.changed[0].factsChanged,true);
});
test('changed source rank, row identity, title, artist, or raw provider ID never passes as a correction',()=>{
 for(const [key,value] of [['rank',3],['captureRowId',ROW(99)],
   ['observedTitle','New fake title'],['observedArtist','Other singer'],
   ['providerTrackId','changed-provider-id']]){
   const a=fixture(),b=structuredClone(a);b.rows[0][key]=value;
   // A changed rank breaks the ordered-row contract before the source-row comparison.
   assert.throws(()=>compare(a,b),e=>e instanceof Wk100RecheckConflict&&
     ['invalid_row','source_row_changed'].includes(e.code));
 }
});
test('different source original, week, receipt, or Edition policy fails closed',()=>{
 for(const [key,value,code] of [
   ['payloadSha256','f'.repeat(64),'receipt_changed'],
   ['receiptId','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','receipt_changed'],
   ['weekStartEat','2026-11-16','receipt_changed'],
   ['policySha256','d'.repeat(64),'policy_changed'],
   ['configRevision',2,'policy_changed'],
 ]){
   const a=fixture(),b=structuredClone(a);b[key]=value;
   assert.throws(()=>compare(a,b),rejected(code));
 }
});
test('duplicate, missing, fabricated or score-enabled outcomes are rejected',()=>{
 for(const invalid of [
   b=>{b.rows[1].captureRowId=b.rows[0].captureRowId;},
   b=>{b.rows[0].registryFactsSha256='bad';},
   b=>{b.counts.ELIGIBLE=2;},
   b=>{b.rows[1].canScore=true;},
   b=>{b.canPublish=true;},
 ]){
  const a=fixture(),b=structuredClone(a);invalid(b);
  assert.throws(()=>compare(a,b),e=>e instanceof Wk100RecheckConflict&&
    ['invalid_row','invalid_count','invalid_result'].includes(e.code));
 }
});

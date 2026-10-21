import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyWk100OfflineIntake } from '../../scripts/charts/wk100-offline-intake-authority.mjs';
const bytes=x=>new TextEncoder().encode(JSON.stringify(x));
const sha=x=>createHash('sha256').update(x).digest('hex');
const stamp='2026-10-21T15:00:00Z';
function fixture(){
 const authority={schema_version:'wk100-offline-authority-v1',source_key:'source_alpha',operator_key:'operator_alpha',market:'KE',behavior:'consumption',
 authorized_purpose:'candidate_evidence_only',observation_format:'wk100-delivered-ordinal-v1',valid_from:'2026-10-01T00:00:00Z',valid_until:'2026-11-01T00:00:00Z',
 approved_by:'test-only-reviewer',evidence_ref:'test_only_grant'};
 const observation={schema_version:'wk100-delivered-ordinal-v1',source_key:'source_alpha',operator_key:'operator_alpha',market:'KE',behavior:'consumption',
 native_period:{starts_at:'2026-10-18T21:00:00Z',ends_at:'2026-10-25T21:00:00Z',evidence_ref:'test_only_period'},
 entries:[{recording_id:'00000000-0000-4000-8000-000000000001',rank:1},{recording_id:'00000000-0000-4000-8000-000000000002',rank:2}]};
 return {authority,observation};
}
function invoke(edit=()=>{},override={}){
 const f=fixture();edit(f);
 const authorityBytes=bytes(f.authority),observationBytes=bytes(f.observation);
 return verifyWk100OfflineIntake({authorityBytes,observationBytes,authorityExpectedSha256:sha(authorityBytes),now:new Date(stamp),...override});
}
test('trusted offline input produces private preview candidate without claiming licence or origin verification',()=>{
 const r=invoke();assert.equal(r.raw_sha256,sha(bytes(fixture().observation)));
 assert.equal(r.admission,'approved');assert.equal(r.entries.length,2);
 assert.equal(r.independently_verified.original_bytes_sha256,true);
 for(const property of ['provider_origin','legal_grant','registry_identity'])assert.equal(r.independently_verified[property],false);
 assert.equal(r.can_publish,undefined);
});
test('untrusted private authority content fails if independently sealed hash changes',()=>{
 const f=fixture(),before=bytes(f.authority);f.authority.approved_by='different reviewer';
 assert.throws(()=>verifyWk100OfflineIntake({authorityBytes:bytes(f.authority),authorityExpectedSha256:sha(before),observationBytes:bytes(f.observation),now:new Date(stamp)}),/authority_hash_mismatch/);
});
test('wrong or absent trusted authority digest fails closed',()=>{
 assert.throws(()=>invoke(()=>{},{authorityExpectedSha256:'a'.repeat(64)}),/authority_hash_mismatch/);
 assert.throws(()=>invoke(()=>{},{authorityExpectedSha256:null}),/trusted_authority_digest_missing/);
});
test('expired and future grants fail closed',()=>{
 assert.throws(()=>invoke(f=>f.authority.valid_until='2026-10-01T00:00:00Z'),/authority_expired|authority_invalid/);
 assert.throws(()=>invoke(f=>f.authority.valid_from='2026-10-25T00:00:00Z'),/authority_expired/);
});
test('native source substitution, market drift, and changed behavior fail closed',()=>{
 for(const edit of [f=>f.observation.source_key='other_source',f=>f.observation.market='US',f=>f.observation.behavior='discovery',
 f=>f.observation.operator_key='operator_beta'])assert.throws(()=>invoke(edit),/observation_authority_mismatch/);
});
test('invalid native periods, row ranks, IDs, duplicates and injected metrics fail closed',()=>{
 for(const edit of [f=>f.observation.native_period.ends_at='2026-01-01T00:00:00Z',
 f=>f.observation.entries[1].rank=1,f=>f.observation.entries[1].recording_id=f.observation.entries[0].recording_id,
 f=>f.observation.entries[0].recording_id='fake',f=>f.observation.entries[0].streams=1000])
 assert.throws(()=>invoke(edit),/wk100_intake_/);
});
test('extra authority or input data fields cannot silently modify trust semantics',()=>{
 for(const edit of [f=>f.authority.bypass_approval=true,f=>f.observation.can_publish=true,f=>f.observation.native_period.verified=true])
 assert.throws(()=>invoke(edit),/wk100_intake_/);
});

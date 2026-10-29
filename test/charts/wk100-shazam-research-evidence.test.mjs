import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,stat,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareShazamResearchEvidence,archiveShazamResearchEvidence,prepareShazamRegistryReview} from '../../scripts/charts/wk100-shazam-research-evidence.mjs';
const enc=x=>new TextEncoder().encode(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const csv=enc('Rank,Artist,Title\n1,Artist One,Track One\n2,Artist Two,Track Two\n');
const args={csvBytes:csv,source_url:'https://www.shazam.com/services/charts/csv/top-200/kenya',observed_at:'2026-10-29T18:00:00Z',operator_ref:'operator_private_2026_10_29'};
const u=n=>`00000000-0000-4000-8000-${n.toString().padStart(12,'0')}`;
const tracks=[{id:u(1),status:'active',isrc:'USABC2600001'},{id:u(2),status:'active',isrc:'KEABC2600002'}];
function valid(){const evidence=prepareShazamResearchEvidence(args);
 const snapshot={schema_version:'wk100-shazam-registry-snapshot-v1',coverage:'complete_active_isrc_index',as_of:'2026-10-29T18:15:00Z',tracks};
 const registrySnapshotBytes=enc(JSON.stringify(snapshot));
 const expectedRegistrySha256=hash(registrySnapshotBytes);
 const review={schema_version:'wk100-shazam-identity-review-v1',source_raw_sha256:evidence.receipt.raw_sha256,registry_snapshot_sha256:expectedRegistrySha256,decisions:[{rank:1,observed_title:'Track One',observed_artist:'Artist One',track_id:u(1),isrc:'USABC2600001',source_evidence_ref:'evidence/shazam/song/11111',identity_evidence_ref:'registry/independent/isrc/11111',reviewer_primary:'reviewer_alpha',reviewer_independent:'reviewer_beta',reviewed_at:'2026-10-29T18:30:00Z',decision:'reviewed_proposal'}]};
 const reviewManifestBytes=enc(JSON.stringify(review));
 return {csvBytes:csv,evidence,registrySnapshotBytes,expectedRegistrySha256,reviewManifestBytes,expectedReviewSha256:hash(reviewManifestBytes)};
}
test('Shazam provided CSV becomes byte-addressed, review-only evidence without fabricated identity or native period',()=>{
 const e=prepareShazamResearchEvidence(args);
 assert.equal(e.receipt.raw_sha256,hash(csv));
 assert.equal(e.receipt.observed_depth,2);assert.equal(e.receipt.source_native_period.authority,'unknown');
 assert.equal(e.receipt.source_native_period.starts_at,null);
 assert.ok(e.entries.every((v,i)=>v.row_ref===`${hash(csv)}:${i+1}`&&v.recording_id===null&&v.provider_track_id===null&&v.status==='review_required'));
 assert.equal(e.receipt.can_publish,false);
});
test('exact offered public source, observed time, operator and bounded data are enforced',()=>{
 for(const u of ['http://www.shazam.com/services/charts/csv/top-200/kenya',
 'https://evil.example.net/services/charts/csv/top-200/kenya',
 'https://www.shazam.com/services/charts/csv/top-200/kenya?download=1',
 'https://www.shazam.com/services/charts/csv/top-200/usa'])assert.throws(()=>prepareShazamResearchEvidence({...args,source_url:u}),/source_url/);
 assert.throws(()=>prepareShazamResearchEvidence({...args,observed_at:'2026-10-29'}),/observation_metadata/);
 assert.throws(()=>prepareShazamResearchEvidence({...args,csvBytes:enc('garbage')}),/csv_native_parse/);
 assert.throws(()=>prepareShazamResearchEvidence({...args,csvBytes:new Uint8Array(4_194_305)}),/raw_size/);
});
test('researcher archive is private, immutable, content-addressed and idempotent',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wk100-shazam-'));
 const dir=join(root,'private');
 try{
  const a=await archiveShazamResearchEvidence({...args,archive_dir:dir});
  const b=await archiveShazamResearchEvidence({...args,archive_dir:dir});
  assert.equal(a.raw_sha256,b.raw_sha256);
  for(const suf of ['csv','receipt.json','review.json']){
    const ob=hash(enc(JSON.stringify(a.receipt)));
    const p=join(dir,`${suf==='csv'?hash(csv):ob}.${suf}`),s=await stat(p);
    assert.equal(s.mode&0o077,0); assert.ok(s.size>0);
  }
  assert.deepEqual(new Uint8Array(await readFile(join(dir,`${hash(csv)}.csv`))),csv);
  const queue=JSON.parse(await readFile(join(dir,`${a.observation_sha256}.review.json`),'utf8'));
  assert.equal(queue.entries[0].status,'review_required');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('unchanged CSV reused on a later observation preserves distinct receipt without inventing fresh activity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wk100-repeat-'));
 try{const dir=join(root,'private');const a=await archiveShazamResearchEvidence({...args,archive_dir:dir});
 const b=await archiveShazamResearchEvidence({...args,observed_at:'2026-10-30T18:00:00Z',archive_dir:dir});
 assert.equal(a.raw_sha256,b.raw_sha256);assert.notEqual(a.observation_sha256,b.observation_sha256);
 assert.equal((await readFile(join(dir,`${hash(csv)}.csv`))).equals(Buffer.from(csv)),true);
 assert.equal(JSON.parse(await readFile(join(dir,`${b.observation_sha256}.receipt.json`))).observed_at,'2026-10-30T18:00:00Z');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('unsafe preexisting archive directories cannot receive private source bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wk100-unsafe-'));
 try{const dir=join(root,'public');await symlink(root,dir);
  await assert.rejects(archiveShazamResearchEvidence({...args,archive_dir:dir}),/archive_dir_unsafe/);
  await chmod(root,0o755);
  await assert.rejects(archiveShazamResearchEvidence({...args,archive_dir:root}),/archive_dir_unsafe/);
 }finally{await chmod(root,0o700);await rm(root,{recursive:true,force:true});}
});
test('review packet binds source raw hash, immutable row, independently sealed Registry and separate reviewers without claiming authority',()=>{
 const x=valid(),p=prepareShazamRegistryReview(x);
 assert.equal(p.proposed,1);assert.equal(p.unresolved,1);
 assert.equal(p.outcomes[0].proposed_track_id,u(1));assert.equal(p.outcomes[1].proposed_track_id,null);
 assert.equal(p.canonical_identity_admitted,false);assert.equal(p.can_publish,false);
});
test('tampered source raw bytes, receipt rows and registry seal fail closed',()=>{
 const a=valid();assert.throws(()=>prepareShazamRegistryReview({...a,csvBytes:enc('altered')}),/evidence_raw_mismatch/);
 const b=valid();b.evidence.entries[0].title_observed='Fake';assert.throws(()=>prepareShazamRegistryReview(b),/evidence_raw_mismatch/);
 const c=valid();assert.throws(()=>prepareShazamRegistryReview({...c,expectedRegistrySha256:'a'.repeat(64)}),/independent_seal_mismatch/);
});
test('human review cannot bind wrong rank/title/artist or unsupported ISRC',()=>{
 const a=valid(),o=JSON.parse(new TextDecoder().decode(a.reviewManifestBytes));o.decisions[0].observed_title='Different';const changed=enc(JSON.stringify(o));
 assert.throws(()=>prepareShazamRegistryReview({...a,reviewManifestBytes:changed,expectedReviewSha256:hash(changed)}),/review_identity_conflict/);
 const b=valid(),v=JSON.parse(new TextDecoder().decode(b.reviewManifestBytes));v.decisions[0].isrc='USABC2600002';const bb=enc(JSON.stringify(v));
 assert.throws(()=>prepareShazamRegistryReview({...b,reviewManifestBytes:bb,expectedReviewSha256:hash(bb)}),/review_identity_conflict/);
});
test('two independently named reviewers and disjoint evidence references are mandatory',()=>{
 const a=valid(),o=JSON.parse(new TextDecoder().decode(a.reviewManifestBytes));o.decisions[0].reviewer_independent=o.decisions[0].reviewer_primary;const b=enc(JSON.stringify(o));
 assert.throws(()=>prepareShazamRegistryReview({...a,reviewManifestBytes:b,expectedReviewSha256:hash(b)}),/review_decision_invalid/);
 const c=valid(),v=JSON.parse(new TextDecoder().decode(c.reviewManifestBytes));v.decisions[0].identity_evidence_ref=v.decisions[0].source_evidence_ref;const d=enc(JSON.stringify(v));
 assert.throws(()=>prepareShazamRegistryReview({...c,reviewManifestBytes:d,expectedReviewSha256:hash(d)}),/review_decision_invalid/);
});
test('unreviewed or stale registry coverage cannot become a canonical identity proposal',()=>{
 const a=valid(),x=JSON.parse(new TextDecoder().decode(a.registrySnapshotBytes));x.coverage='partial';
 const xb=enc(JSON.stringify(x)),v=JSON.parse(new TextDecoder().decode(a.reviewManifestBytes));
 v.registry_snapshot_sha256=hash(xb);const vb=enc(JSON.stringify(v));
 assert.throws(()=>prepareShazamRegistryReview({...a,registrySnapshotBytes:xb,expectedRegistrySha256:hash(xb),reviewManifestBytes:vb,expectedReviewSha256:hash(vb)}),/registry_coverage_incomplete/);
 const b=valid(),t=JSON.parse(new TextDecoder().decode(b.reviewManifestBytes));t.decisions[0].reviewed_at='2026-10-28T18:00:00Z';
 const tb=enc(JSON.stringify(t));
 assert.throws(()=>prepareShazamRegistryReview({...b,reviewManifestBytes:tb,expectedReviewSha256:hash(tb)}),/review_decision_invalid/);
});
test('duplicate active ISRC and archived Registry candidates fail closed',()=>{
 const a=valid(),sn=JSON.parse(new TextDecoder().decode(a.registrySnapshotBytes));sn.tracks.push({id:u(4),status:'active',isrc:'USABC2600001'});const sb=enc(JSON.stringify(sn));
 const rv=JSON.parse(new TextDecoder().decode(a.reviewManifestBytes));rv.registry_snapshot_sha256=hash(sb);const rb=enc(JSON.stringify(rv));
 assert.throws(()=>prepareShazamRegistryReview({...a,registrySnapshotBytes:sb,expectedRegistrySha256:hash(sb),reviewManifestBytes:rb,expectedReviewSha256:hash(rb)}),/review_identity_conflict/);
 const b=valid(),st=JSON.parse(new TextDecoder().decode(b.registrySnapshotBytes));st.tracks[0].status='archived';const bst=enc(JSON.stringify(st));const br=JSON.parse(new TextDecoder().decode(b.reviewManifestBytes));br.registry_snapshot_sha256=hash(bst);const brb=enc(JSON.stringify(br));
 assert.throws(()=>prepareShazamRegistryReview({...b,registrySnapshotBytes:bst,expectedRegistrySha256:hash(bst),reviewManifestBytes:brb,expectedReviewSha256:hash(brb)}),/review_identity_conflict/);
});
test('identical filename at source rank does not infer a source-native provider ID',()=>{
 const x=valid();x.evidence.entries[0].provider_track_id='fake_shazam_id';
 assert.throws(()=>prepareShazamRegistryReview(x),/evidence_raw_mismatch/);
});
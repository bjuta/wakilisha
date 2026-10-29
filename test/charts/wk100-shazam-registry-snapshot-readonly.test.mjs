import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,lstat,rm,symlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validateRegistryIndex,readRegistryIndex,writePrivateRegistrySnapshot,
  validateRegistryDatabaseUrl,REGISTRY_INDEX_SQL,REGISTRY_INDEPENDENT_FINGERPRINT_SQL}
  from '../../scripts/charts/wk100-shazam-registry-snapshot-readonly.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const ids=[1,2].map(x=>`00000000-0000-4000-8000-${String(x).padStart(12,'0')}`);
const tracks=[{id:ids[0],status:'active',isrc:'KEABC2600001'},
  {id:ids[1],status:'active',isrc:'USABC2600002'}];
const fingerprint=rows=>sha(rows.map(r=>`${r.id}\t${r.status}\t${r.isrc}`).join('\n'));
const summary=(rows=tracks)=>({active_count:rows.length,distinct_isrc_count:rows.length,
  invalid_isrc_count:0,index_sha256:fingerprint(rows),as_of:'2026-10-29T22:10:00Z'});
const valid=()=>validateRegistryIndex(tracks,summary(),fingerprint(tracks));

test('complete current active Track snapshot matches independent SQL fingerprint',()=>{
  const r=valid(),snap=JSON.parse(r.snapshotBytes);
  assert.deepEqual(snap,{schema_version:'wk100-shazam-registry-snapshot-v1',
    as_of:'2026-10-29T22:10:00Z',coverage:'complete_active_isrc_index',tracks});
  assert.equal(sha(r.snapshotBytes),r.snapshot_sha256);
  assert.equal(r.active_tracks,2);
  assert.equal(r.canonical_identity_admitted,false);
  assert.equal(r.can_publish,false);
});
test('a self-reported complete flag does not override independent digest',()=>{
  assert.throws(()=>validateRegistryIndex(tracks,summary(),sha('made-up')),/independent_fingerprint_mismatch/);
  assert.throws(()=>validateRegistryIndex(tracks,summary(),''),/independent_fingerprint_missing/);
});
test('missing, injected or stale Registry Track fails closed',()=>{
  assert.throws(()=>validateRegistryIndex([tracks[0]],summary(),fingerprint(tracks)),/server_count_conflict/);
  assert.throws(()=>validateRegistryIndex([...tracks,{id:ids[0],status:'active',isrc:'USABC2600003'}],
    {...summary(),active_count:3,distinct_isrc_count:3},fingerprint(tracks)),/registry_row_invalid/);
  const changed=tracks.map(x=>({...x}));changed[0].isrc='KEABC2600099';
  assert.throws(()=>validateRegistryIndex(changed,summary(changed),fingerprint(tracks)),/independent_fingerprint_mismatch/);
});
test('inactive, duplicate ISRC and unsorted index are not active complete identity',()=>{
  const archived=tracks.map(x=>({...x}));archived[1].status='archived';
  assert.throws(()=>validateRegistryIndex(archived,summary(archived),fingerprint(archived)),/registry_row_invalid/);
  const duplicate=tracks.map(x=>({...x}));duplicate[1].isrc=duplicate[0].isrc;
  assert.throws(()=>validateRegistryIndex(duplicate,summary(duplicate),fingerprint(duplicate)),/registry_row_invalid/);
  const reversed=[...tracks].reverse();
  assert.throws(()=>validateRegistryIndex(reversed,summary(reversed),fingerprint(reversed)),/registry_row_invalid/);
});
test('noncanonical ISRC and malformed timestamp are refused',()=>{
  const bad=tracks.map(x=>({...x}));bad[0].isrc='not-an-isrc';
  assert.throws(()=>validateRegistryIndex(bad,summary(bad),fingerprint(bad)),/registry_row_invalid/);
  assert.throws(()=>validateRegistryIndex(tracks,{...summary(),as_of:'2026-10-29'},fingerprint(tracks)),/server_summary_invalid/);
});
test('read only isolation, consistent select order, and commit',async()=>{
  const calls=[];
  const q=async sql=>{
    calls.push(sql);
    if(sql===REGISTRY_INDEX_SQL)return {rows:tracks};
    if(sql===REGISTRY_INDEPENDENT_FINGERPRINT_SQL)return {rows:[summary()]};
    return {rows:[]};
  };
  const result=await readRegistryIndex(q,fingerprint(tracks));
  assert.equal(result.active_tracks,2);
  assert.deepEqual(calls,[
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    REGISTRY_INDEX_SQL,REGISTRY_INDEPENDENT_FINGERPRINT_SQL,'COMMIT'
  ]);
  assert.ok(REGISTRY_INDEPENDENT_FINGERPRINT_SQL.includes('transaction_timestamp()'));
  assert.ok(REGISTRY_INDEPENDENT_FINGERPRINT_SQL.includes('ORDER BY id'));
});
test('validation failure rolls back without mutating Registry',async()=>{
  const calls=[];
  await assert.rejects(readRegistryIndex(async sql=>{
    calls.push(sql);
    if(sql===REGISTRY_INDEX_SQL)return {rows:tracks};
    if(sql===REGISTRY_INDEPENDENT_FINGERPRINT_SQL)return {rows:[summary()]};
    return {rows:[]};
  },sha('false fingerprint')),/independent_fingerprint_mismatch/);
  assert.equal(calls.at(-1),'ROLLBACK');
  assert.ok(calls.every(x=>!/(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)/.test(x)));
});
test('private create-only snapshot archive readback and idempotence',async()=>{
  const root=await mkdtemp(join(tmpdir(),'wk100-registry-'));
  try{
    const dest=join(root,'private');
    const r=valid();
    const a=await writePrivateRegistrySnapshot(dest,r);
    const b=await writePrivateRegistrySnapshot(dest,r);
    assert.deepEqual(a,b);
    assert.equal((await lstat(dest)).mode&0o077,0);
    const path=join(dest,`${r.snapshot_sha256}.registry.json`);
    const stat=await lstat(path);assert.equal(stat.mode&0o077,0);
    assert.equal(sha(await readFile(path)),r.snapshot_sha256);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('unsafe public archive directory and symlink are blocked',async()=>{
  const root=await mkdtemp(join(tmpdir(),'wk100-registry-unsafe-'));
  try{
    await chmod(root,0o755);
    await assert.rejects(writePrivateRegistrySnapshot(root,valid()),/archive_directory_unsafe/);
    const link=join(root,'link');await symlink(root,link);
    await assert.rejects(writePrivateRegistrySnapshot(link,valid()),/archive_directory_unsafe/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('project and TLS transport binding cannot be diverted to another database',()=>{
  const token=encodeURIComponent('private-not-logged');
  assert.equal(validateRegistryDatabaseUrl(`postgresql://postgres:${token}@db.pgzizndxdyhqmtyywjmt.supabase.co:5432/postgres`).startsWith('postgresql://'),true);
  assert.equal(validateRegistryDatabaseUrl(`postgres://postgres.pgzizndxdyhqmtyywjmt:${token}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`).startsWith('postgres://'),true);
  for(const url of [
    `postgresql://postgres:${token}@evil.example.net/postgres`,
    `postgresql://postgres:${token}@db.someotherproject.supabase.co/postgres`,
    `postgresql://postgres:${token}@db.pgzizndxdyhqmtyywjmt.supabase.co/other`,
    `postgresql://postgres:${token}@db.pgzizndxdyhqmtyywjmt.supabase.co/postgres?sslmode=disable`,
    `http://postgres:${token}@db.pgzizndxdyhqmtyywjmt.supabase.co/postgres`,
  ])assert.throws(()=>validateRegistryDatabaseUrl(url),/wk100_registry_snapshot_/);
});

test('independently sealed snapshot fits existing Shazam review-only Registry API',async()=>{
  const {prepareShazamResearchEvidence,prepareShazamRegistryReview}=await import('../../scripts/charts/wk100-shazam-research-evidence.mjs');
  const csvBytes=Buffer.from('Rank,Artist,Title\n1,Artist One,Track One\n2,Artist Two,Track Two\n');
  const evidence=prepareShazamResearchEvidence({csvBytes,source_url:'https://www.shazam.com/services/charts/csv/top-200/kenya',
    observed_at:'2026-10-29T19:41:23Z',operator_ref:'operator_private_2026_10_29'});
  const snapshot=valid();
  const manifest=Buffer.from(JSON.stringify({schema_version:'wk100-shazam-identity-review-v1',
    source_raw_sha256:evidence.receipt.raw_sha256,registry_snapshot_sha256:snapshot.snapshot_sha256,
    decisions:[]}));
  const packet=prepareShazamRegistryReview({csvBytes,evidence,registrySnapshotBytes:snapshot.snapshotBytes,
    expectedRegistrySha256:snapshot.snapshot_sha256,reviewManifestBytes:manifest,
    expectedReviewSha256:sha(manifest)});
  assert.equal(packet.proposed,0);assert.equal(packet.unresolved,2);
  assert.ok(packet.outcomes.every(x=>x.status==='review_required'&&x.proposed_track_id===null));
  assert.equal(packet.canonical_identity_admitted,false);assert.equal(packet.can_publish,false);
});

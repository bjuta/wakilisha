import {test} from 'node:test';
import {storeWk100ResearchOriginalBytes} from '../../supabase/functions/_shared/wk100-research-private-object-store.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,stat,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareShazamResearchEvidence,archiveShazamResearchEvidence,prepareShazamRegistryReview} from '../../scripts/charts/wk100-shazam-research-evidence.mjs';
import {executeWk100ResearchIntake} from '../../supabase/functions/_shared/wk100-research-intake-orchestrator.mjs';
import {verifyWk100ShazamResearchImport,projectWk100ResearchImportStatus} from '../../supabase/functions/_shared/wk100-research-receipt-bridge.mjs';
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
test('research intake preserves embedded public CSV quotes with original hash and unresolved identity',()=>{
  const supplied=enc('Shazam Top 200 Kenya\n2026-W42\nRank,Artist,Title\n'+
    '1,"The "Real" Artist","Song "Love" Edit"\n'+
    '2,"The ""Official"" Artist","Song, Version"\n');
  const evidence=prepareShazamResearchEvidence({...args,csvBytes:supplied});
  assert.equal(evidence.receipt.raw_sha256,hash(supplied));
  assert.equal(evidence.receipt.observed_depth,2);
  assert.equal(evidence.entries[0].artist_observed,'The "Real" Artist');
  assert.equal(evidence.entries[0].title_observed,'Song "Love" Edit');
  assert.equal(evidence.entries[1].artist_observed,'The "Official" Artist');
  assert.ok(evidence.entries.every(x=>x.provider_track_id===null&&
    x.recording_id===null&&x.status==='review_required'));
  assert.equal(evidence.receipt.source_native_period.authority,'unknown');
  assert.equal(evidence.receipt.can_publish,false);
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

test('WK100 server import bridges genuine researcher CSV receipt to private nonpublishing rows',async()=>{
 const evidence=prepareShazamResearchEvidence(args);
 const verified=await verifyWk100ShazamResearchImport({
   originalBytes:csv,receipt:evidence.receipt,researchWeekStartEat:'2026-10-26'});
 assert.equal(verified.raw_sha256,hash(csv));
 assert.equal(verified.private_rows.length,2);
 assert.equal(verified.private_rows[0].row_ref,`${hash(csv)}:1`);
 assert.equal(verified.private_rows[0].title_observed,'Track One');
 assert.equal(verified.private_rows[0].artist_observed,'Artist One');
 assert.equal(verified.private_rows[0].canonical_track_id,null);
 assert.equal(verified.private_rows[0].provider_track_id,null);
 assert.equal(verified.private_rows[0].source_native_count,null);
 assert.equal(verified.source_native_metric,'rank');
 assert.equal(verified.native_period_authority,'unknown');
 assert.equal(verified.source_origin_independently_attested,false);
 assert.equal(verified.source_admitted,false);
 assert.equal(verified.can_score,false);
 assert.equal(verified.can_publish,false);
});
test('WK100 import rejects changed raw bytes even when a CSV still parses',async()=>{
 const receipt=prepareShazamResearchEvidence(args).receipt;
 const changed=enc('Rank,Artist,Title\n1,Artist One,Track One\n2,Artist Two,Track Six\n');
 assert.equal(changed.byteLength,csv.byteLength);
 await assert.rejects(verifyWk100ShazamResearchImport({
   originalBytes:changed,receipt,researchWeekStartEat:'2026-10-26'}),/original_bytes_mismatch/);
});
test('WK100 research receipt never impersonates HTTP collection, native period, streams, or admitted provider',async()=>{
 const original=prepareShazamResearchEvidence(args).receipt;
 for(const change of [
   {http_status:200},
   {source_key:'youtube_ke'},
   {acquisition_mode:'unattended_collector'},
   {source_url:'https://evil.example/kenya'},
   {can_publish:true},
   {identity_state:'canonical'},
   {source_native_period:{authority:'provider_defined',starts_at:'2026-10-26T00:00:00Z',ends_at:'2026-11-02T00:00:00Z'}},
 ]){
   await assert.rejects(verifyWk100ShazamResearchImport({
     originalBytes:csv,receipt:{...original,...change},researchWeekStartEat:'2026-10-26'}),
     /receipt_invalid/);
 }
 await assert.rejects(verifyWk100ShazamResearchImport({
   originalBytes:csv,receipt:{...original,observed_depth:200},researchWeekStartEat:'2026-10-26'}),
   /native_observation_mismatch/);
});
test('WK100 import requires exact EAT Monday editorial week without inventing source measurement time',async()=>{
 const receipt=prepareShazamResearchEvidence(args).receipt;
 for(const week of ['2026-10-25','2026-10-27','2026-13-04','2026-02-30','26-10-26']){
   await assert.rejects(verifyWk100ShazamResearchImport({
     originalBytes:csv,receipt,researchWeekStartEat:week}),/week_invalid/);
 }
 assert.equal((await verifyWk100ShazamResearchImport({
   originalBytes:csv,receipt,researchWeekStartEat:'2026-10-26'})).observation_time_utc,
   args.observed_at);
});
test('WK100 import refuses invalid original-byte encoding and native CSV rows',async()=>{
 const invalid=new Uint8Array([0xff,0xfe,0x00]);
 const receipt={...prepareShazamResearchEvidence(args).receipt,
   raw_sha256:hash(invalid),byte_length:invalid.length};
 await assert.rejects(verifyWk100ShazamResearchImport({
   originalBytes:invalid,receipt,researchWeekStartEat:'2026-10-26'}),/source_native_parse_failed/);
});
test('WK100 import preserves original CSV byte-size cap and exact receipt shape',async()=>{
 const receipt=prepareShazamResearchEvidence(args).receipt;
 await assert.rejects(verifyWk100ShazamResearchImport({
   originalBytes:new Uint8Array(4_194_305),receipt,researchWeekStartEat:'2026-10-26'}),/byte_size_invalid/);
 await assert.rejects(verifyWk100ShazamResearchImport({
   originalBytes:csv,receipt:{...receipt,operator_ref:undefined},researchWeekStartEat:'2026-10-26'}),/receipt_invalid/);
 await assert.rejects(verifyWk100ShazamResearchImport({
   originalBytes:csv,receipt:{...receipt,observed_at:'2026-02-30T18:00:00Z'},
   researchWeekStartEat:'2026-10-26'}),/receipt_invalid/);
});
test('WK100 Admin projection leaks no research labels, operator, original SHA, or private bytes',async()=>{
 const receipt=prepareShazamResearchEvidence(args).receipt;
 const verified=await verifyWk100ShazamResearchImport({
   originalBytes:csv,receipt,researchWeekStartEat:'2026-10-26'});
 const projected=projectWk100ResearchImportStatus(verified);
 const exposed=JSON.stringify(projected);
 for(const confidential of ['Track One','Artist One',args.operator_ref,hash(csv),'private_rows'])
   assert.equal(exposed.includes(confidential),false);
 assert.equal(projected.status,'research_only');
 assert.equal(projected.can_score,false);
 assert.equal(projected.can_publish,false);
 assert.equal(projected.native_period_authority,'unknown');
 assert.throws(()=>projectWk100ResearchImportStatus({...verified,can_publish:true}),/unverified_projection/);
});

// WK100 research bytes are stored only by a restricted server caller;
// no successful Storage ACK alone becomes a database research receipt.
function researchStorageFake({initial=null,writeError=null,readError=null}={}){
  const objects=new Map(initial?[[initial.key,new Uint8Array(initial.bytes)]]:[]);
  const actions=[];
  return {actions,objects,storage:{from(name){
    actions.push(['bucket',name]);
    return {
      async upload(path,body,options){
        actions.push(['upload',path,options]);
        if(writeError)return {data:null,error:writeError};
        if(objects.has(path))return {data:null,error:{code:'AssetAlreadyExists',statusCode:409}};
        objects.set(path,new Uint8Array(body));
        return {data:{path},error:null};
      },
      async download(path){
        actions.push(['download',path]);
        if(readError)return {data:null,error:readError};
        const bytes=objects.get(path);
        if(!bytes)return {data:null,error:{statusCode:404}};
        return {data:new Blob([bytes],{type:'text/csv'}),error:null};
      },
    };
  }}};
}
const researchStoreInput=()=>({originalBytes:csv,
  receipt:prepareShazamResearchEvidence(args).receipt,
  researchWeekStartEat:'2026-10-26'});

test('WK100 private research object is create-only and exactly read back, not an admitted receipt',async()=>{
  const fake=researchStorageFake();
  const result=await storeWk100ResearchOriginalBytes({...researchStoreInput(),storage:fake.storage});
  assert.equal(fake.actions[0][1],'wk-chart-raw-evidence-v1');
  assert.equal(fake.actions[1][2].upsert,false);
  assert.equal(fake.actions[1][2].contentType,'text/csv');
  assert.equal(result.object_key,`research/v1/shazam_ke/${hash(csv).slice(0,2)}/${hash(csv)}.csv`);
  assert.equal(result.reused_existing_object,false);
  assert.equal(result.status,'private_bytes_verified_no_db_receipt');
  assert.equal(result.source_admitted,false);
  assert.equal(result.can_score,false);
  assert.equal(result.can_publish,false);
  assert.equal(result.private_verification.private_rows.length,2);
  assert.equal(result.sanitized_status.status,'research_only');
  assert.equal('private_rows' in result.sanitized_status,false);
});
test('WK100 same raw CSV reuses exact Storage object, never upserts',async()=>{
  const fake=researchStorageFake();
  const first=await storeWk100ResearchOriginalBytes({...researchStoreInput(),storage:fake.storage});
  const again=await storeWk100ResearchOriginalBytes({...researchStoreInput(),storage:fake.storage});
  assert.equal(again.reused_existing_object,true);
  assert.equal(again.object_key,first.object_key);
  assert.equal(fake.objects.size,1);
  assert.ok(fake.actions.filter(x=>x[0]==='upload').every(x=>x[2].upsert===false));
});
test('WK100 changed original bytes fail before any private Storage interaction',async()=>{
  const fake=researchStorageFake();
  const edited=enc('Rank,Artist,Title\n1,Artist One,Track Six\n2,Artist Two,Track Two\n');
  await assert.rejects(storeWk100ResearchOriginalBytes({...researchStoreInput(),
    originalBytes:edited,storage:fake.storage}),/wk100_research_import_original_bytes_mismatch/);
  assert.equal(fake.actions.length,0);
});
test('WK100 private object hash collision or tampered readback fails closed',async()=>{
  const fake=researchStorageFake();
  const input=researchStoreInput();
  const key=`research/v1/shazam_ke/${hash(csv).slice(0,2)}/${hash(csv)}.csv`;
  fake.objects.set(key,enc('different source evidence'));
  await assert.rejects(storeWk100ResearchOriginalBytes({...input,storage:fake.storage}),
    /private_readback_mismatch/);
  assert.deepEqual(fake.objects.get(key),enc('different source evidence'));
});
test('WK100 unrelated upload error is never mistaken for an idempotent collision',async()=>{
  const fake=researchStorageFake({writeError:{statusCode:503,code:'StorageUnavailable'}});
  await assert.rejects(storeWk100ResearchOriginalBytes({...researchStoreInput(),
    storage:fake.storage}),/upload_unavailable/);
  assert.equal(fake.actions.some(x=>x[0]==='download'),false);
});
test('WK100 missing readback never counts as a verified research object',async()=>{
  const fake=researchStorageFake({readError:{statusCode:503}});
  await assert.rejects(storeWk100ResearchOriginalBytes({...researchStoreInput(),
    storage:fake.storage}),/private_readback_unavailable/);
});
test('WK100 needs restricted private Storage client and does not invent admission',async()=>{
  await assert.rejects(storeWk100ResearchOriginalBytes({...researchStoreInput(),
    storage:null}),/restricted_storage_required/);
  const fake=researchStorageFake();
  const x=await storeWk100ResearchOriginalBytes({...researchStoreInput(),storage:fake.storage});
  const fields=JSON.stringify(x.sanitized_status);
  assert.equal(fields.includes(args.operator_ref),false);
  assert.equal(fields.includes(hash(csv)),false);
  assert.equal(fields.includes('Track One'),false);
});

// WAKILISHA 100: authenticated research intake -> immutable reservation ->
// private byte-confirmed object -> service-only finalized research receipt.
const intakeId='00000000-0000-4000-8000-000000000321';
const intakeActor='00000000-0000-4000-8000-000000000654';
const intakeKey=`research/v1/shazam_ke/${hash(csv).slice(0,2)}/${hash(csv)}.csv`;
function intakeFake({reserveError=null,reservedKey=intakeKey,finalizeError=null,finalizeId=intakeId,storageFake=null}={}){
  const order=[];
  const blob=storageFake??researchStorageFake();
  return {order,blob,callerDb:{async rpc(name,params){
    order.push(['reserve',name,params]);
    return reserveError?{data:null,error:reserveError}:{data:{reservation_id:intakeId,object_key:reservedKey},error:null};
  }},serviceDb:{async rpc(name,params){
    order.push(['finalize',name,params]);
    return finalizeError?{data:null,error:finalizeError}:{data:{reservation_id:finalizeId,status:'verified'},error:null};
  }}};
}
const runIntake=(f,more={})=>executeWk100ResearchIntake({
  ...researchStoreInput(),authenticatedUserId:intakeActor,
  callerDb:f.callerDb,serviceDb:f.serviceDb,restrictedStorage:f.blob.storage,...more,
});
test('WK100 authenticated server intake reserves, verifies original bytes and finalizes private evidence only',async()=>{
  const f=intakeFake();const result=await runIntake(f);
  assert.deepEqual(f.order.map(x=>x[0]),['reserve','finalize']);
  assert.equal(f.order[0][1],'wk100_reserve_research_observation_v1');
  assert.equal(f.order[0][2].p_observed_at,args.observed_at);
  assert.equal(f.order[0][2].p_operator_ref,args.operator_ref);
  assert.equal(f.order[1][1],'wk100_finalize_research_observation_v1');
  assert.deepEqual(f.order[1][2].p_rows.map(r=>r.source_rank),[1,2]);
  assert.ok(f.blob.actions.some(x=>x[0]==='download'));
  assert.equal(result.reservation_id,intakeId);
  assert.equal(result.persisted,true);
  assert.equal(result.original_bytes_privately_verified,true);
  assert.equal(result.status,'research_only');
  assert.equal(result.can_score,false);assert.equal(result.can_publish,false);
  for(const privateText of [args.operator_ref,hash(csv),'Track One','Artist One',intakeKey])
    assert.equal(JSON.stringify(result).includes(privateText),false);
});
test('WK100 malformed actor and edited original CSV never reserve or store',async()=>{
  const f=intakeFake();await assert.rejects(runIntake(f,{authenticatedUserId:'forged'}),/restricted_boundary_required/);
  const edited=enc('Rank,Artist,Title\n1,Artist One,Track Six\n2,Artist Two,Track Two\n');
  await assert.rejects(runIntake(f,{originalBytes:edited}),/original_bytes_mismatch/);
  assert.equal(f.order.length,0);assert.equal(f.blob.actions.length,0);
});
test('WK100 SQL reservation denied or unavailable fails before private Storage calls',async()=>{
  const f=intakeFake({reserveError:{code:'42501'}});
  await assert.rejects(runIntake(f),/reservation_unavailable/);
  assert.equal(f.blob.actions.length,0);
  assert.deepEqual(f.order.map(x=>x[0]),['reserve']);
});
test('WK100 failed Storage readback does not claim a durable finalized receipt',async()=>{
  const f=intakeFake({storageFake:researchStorageFake({readError:{statusCode:503}})});
  await assert.rejects(runIntake(f),/private_readback_unavailable/);
  assert.deepEqual(f.order.map(x=>x[0]),['reserve']);
});
test('WK100 reserved object key mismatch prevents any durable finalize RPC',async()=>{
  const f=intakeFake({reservedKey:'research/v1/shazam_ke/ff/'+hash(csv)+'.csv'});
  await assert.rejects(runIntake(f),/reservation_storage_mismatch/);
  assert.deepEqual(f.order.map(x=>x[0]),['reserve']);
});
test('WK100 finalize failure or mismatched UUID cannot acknowledge a persisted receipt',async()=>{
  const a=intakeFake({finalizeError:{code:'42501'}});
  await assert.rejects(runIntake(a),/durable_receipt_unavailable/);
  const b=intakeFake({finalizeId:intakeActor});
  await assert.rejects(runIntake(b),/durable_receipt_unavailable/);
});
test('WK100 original CSV duplicate safely reuses object while each observation has DB verification',async()=>{
  const f=intakeFake();await runIntake(f);await runIntake(f);
  assert.equal(f.blob.objects.size,1);
  assert.equal(f.order.filter(x=>x[0]==='reserve').length,2);
  assert.equal(f.order.filter(x=>x[0]==='finalize').length,2);
  assert.ok(f.blob.actions.filter(x=>x[0]==='upload').every(x=>x[2].upsert===false));
});
test('WK100 additive SQL ledger and restricted Edge route retain independent authority',async()=>{
  const {readdir}=await import('node:fs/promises');
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  const files=(await readdir(dir)).filter(x=>x.endsWith('_wk100_research_observation_ledger_v1.sql'));
  assert.equal(files.length,1);
  const sql=await readFile(new URL(files[0],dir),'utf8');
  for(const word of [
    'wk100_reserve_research_observation_v1','wk100_finalize_research_observation_v1',
    "auth.role() IS DISTINCT FROM 'service_role'",'current_user_has_capability',
    'source_native_period_authority','source_admitted=false','can_score=false',
    'can_publish=false','FOR UPDATE','REVOKE ALL','BEFORE TRUNCATE',
    'ON CONFLICT(week_start_eat,source_key,observation_time_utc,raw_sha256,reserved_by)',
  ])assert.ok(sql.includes(word),`missing SQL ledger invariant ${word}`);
  assert.equal(sql.includes('CREATE POLICY'),false);
  const edge=await readFile(new URL('../../supabase/functions/wk100-research-intake/index.ts',import.meta.url),'utf8');
  for(const word of [
    'WK100_RESEARCH_INTAKE_ENABLED', 'WK100_RESEARCH_INTAKE_PROJECT_REF',
    'auth.getUser(token)',"required_capability:'manage_charts'",
    "required_capability:'manage_ingest'",'boundedBody(req)',
    'executeWk100ResearchIntake','serviceDb.storage',
  ])assert.ok(edge.includes(word),`missing Edge boundary ${word}`);
});

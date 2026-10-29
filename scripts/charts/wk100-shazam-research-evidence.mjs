/**
 * Researcher-directed Shazam Kenya CSV evidence and Registry review proposals.
 * NO HTTP, provider polling, DB writes, Registry link admission or chart scoring.
 * Retain the original bytes; never invent a native period, Shazam track ID or ISRC.
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { lstat, mkdir, open, readFile, link, unlink } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { parseShazamKenya } from '../../supabase/functions/_shared/chart-public-source-observations.mjs';

const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISRC=/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const REF=/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{7,239}$/;
const MAX=4_194_304;
const reject=code=>{throw new Error('wk100_shazam_'+code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>SHA.test(a)&&SHA.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys,code)=>{
  if(!plain(x)||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))reject(code);
};
const clock=x=>typeof x==='string'&&UTC.test(x)&&!Number.isNaN(Date.parse(x))&&
  new Date(x).toISOString().replace('.000Z','Z')===x;
const jsonBytes=x=>Buffer.from(JSON.stringify(x),'utf8');
function parseJson(bytes,code){
  if(!(bytes instanceof Uint8Array)||bytes.length<2||bytes.length>MAX)reject(code);
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{reject(code);}
}
function sourceUrl(value){
  if(typeof value!=='string')reject('source_url');
  let u;try{u=new URL(value);}catch{reject('source_url');}
  if(u.protocol!=='https:'||!['shazam.com','www.shazam.com'].includes(u.hostname)||
    u.username||u.password||u.port||u.search||u.hash||
    !['/services/charts/csv/top-200/kenya','/charts/top-200/kenya'].includes(u.pathname)||
    u.href!==value)reject('source_url');
  return value;
}
function researchInput({csvBytes,source_url,observed_at,operator_ref}){
  if(!(csvBytes instanceof Uint8Array)||csvBytes.length<1||csvBytes.length>MAX)reject('raw_size');
  sourceUrl(source_url);
  if(!clock(observed_at)||typeof operator_ref!=='string'||!REF.test(operator_ref))reject('observation_metadata');
  let parsed;
  try{parsed=parseShazamKenya(new TextDecoder('utf-8',{fatal:true}).decode(csvBytes));}
  catch{reject('csv_native_parse');}
  if(parsed.source_key!=='shazam_ke'||parsed.market!=='KE'||parsed.behavior!=='discovery'||
    parsed.metric!=='rank'||parsed.rows.length>200||parsed.rows.length<1||
    parsed.rows.some((r,i)=>r.rank!==i+1||r.provider_track_id!==null))reject('csv_shape');
  const raw_sha256=sha(csvBytes);
  const entries=parsed.rows.map(r=>({
    row_ref:`${raw_sha256}:${r.rank}`,source_rank:r.rank,
    title_observed:r.title,artist_observed:r.artist,provider_track_id:null,
    status:'review_required',recording_id:null,
  }));
  return {
    receipt:{schema_version:'wk100-shazam-research-receipt-v1',source_key:'shazam_ke',
      source_url,observed_at,operator_ref,acquisition_mode:'researcher_directed_public_csv',
      raw_sha256,byte_length:csvBytes.length,observed_depth:entries.length,
      source_native_period:{authority:'unknown',starts_at:null,ends_at:null},
      identity_state:'unresolved',can_publish:false},
    entries,
  };
}
export function prepareShazamResearchEvidence(input){
  return structuredClone(researchInput(input));
}
async function writeExactPrivate(path,bytes){
  const temp=`${path}.${randomUUID()}.partial`;
  let h,linked=false;
  try{
    h=await open(temp,'wx',0o600);
    await h.writeFile(bytes);
    await h.sync();
    await h.close();h=null;
    try{await link(temp,path);linked=true;}
    catch(err){if(err?.code!=='EEXIST')reject('archive_create_failed');}
    const st=await lstat(path);
    if(!st.isFile()||st.isSymbolicLink()||st.mode&0o077)reject('archive_existing_unsafe');
    const existing=await readFile(path);
    if(!existing.equals(Buffer.from(bytes)))reject('archive_collision');
  }catch(e){
    if(e?.message?.startsWith('wk100_shazam_'))throw e;
    reject('archive_create_failed');
  }finally{
    if(h)await h.close().catch(()=>{});
    await unlink(temp).catch(()=>{});
  }
}
/**
 * Operator controls the private local directory. Immutable content-addressed
 * payload, receipt and review queue; no remote writes, automatic expiry or deletion.
 * The directory MUST be dedicated and initially absent or safe (0700).
 */
export async function archiveShazamResearchEvidence({csvBytes,source_url,observed_at,
  operator_ref,archive_dir}){
  if(typeof archive_dir!=='string'||!isAbsolute(archive_dir))reject('archive_path');
  const dir=resolve(archive_dir);
  await mkdir(dir,{recursive:true,mode:0o700});
  const st=await lstat(dir);
  if(!st.isDirectory()||st.isSymbolicLink()||st.mode&0o077)reject('archive_dir_unsafe');
  const evidence=researchInput({csvBytes,source_url,observed_at,operator_ref});
  const observation_sha256=sha(jsonBytes(evidence.receipt));
  const raw=join(dir,`${evidence.receipt.raw_sha256}.csv`);
  const receipt=join(dir,`${observation_sha256}.receipt.json`);
  const queue=join(dir,`${observation_sha256}.review.json`);
  await writeExactPrivate(raw,csvBytes);
  const saved=await readFile(raw);
  if(!same(sha(saved),evidence.receipt.raw_sha256))reject('archive_readback');
  await writeExactPrivate(receipt,jsonBytes(evidence.receipt));
  await writeExactPrivate(queue,jsonBytes({schema_version:'wk100-shazam-review-queue-v1',
    raw_sha256:evidence.receipt.raw_sha256,entries:evidence.entries,can_publish:false}));
  return Object.freeze({receipt:evidence.receipt,archived_files:3,
    raw_sha256:evidence.receipt.raw_sha256,observation_sha256,can_publish:false});
}
/**
 * Only an independently pinned snapshot AND separately pinned review manifest
 * may generate reviewed proposals. The packet DOES NOT admit canonical links.
 * It MUST be passed to existing Registry review/typed operations and rechecked
 * against the live Registry and identity lineage at the time of approval.
 */
export function prepareShazamRegistryReview({csvBytes,evidence,registrySnapshotBytes,
  expectedRegistrySha256,reviewManifestBytes,expectedReviewSha256}){
  exact(evidence,['receipt','entries'],'evidence_schema');
  const {receipt,entries}=evidence;
  if(!(csvBytes instanceof Uint8Array)||!SHA.test(receipt?.raw_sha256)||!same(sha(csvBytes),receipt.raw_sha256))reject('evidence_raw_mismatch');
  const reproduced=researchInput({csvBytes,source_url:receipt.source_url,
    observed_at:receipt.observed_at,operator_ref:receipt.operator_ref});
  if(JSON.stringify(reproduced)!==JSON.stringify(evidence))reject('evidence_raw_mismatch');
  if(receipt?.schema_version!=='wk100-shazam-research-receipt-v1'||receipt.source_key!=='shazam_ke'||
    !SHA.test(receipt.raw_sha256)||!Array.isArray(entries)||entries.length!==receipt.observed_depth||
    entries.some((row,i)=>row.source_rank!==i+1||row.row_ref!==`${receipt.raw_sha256}:${i+1}`||
      row.provider_track_id!==null||row.recording_id!==null||row.status!=='review_required'))reject('evidence_invalid');
  if(!(registrySnapshotBytes instanceof Uint8Array)||!(reviewManifestBytes instanceof Uint8Array)||
    !same(expectedRegistrySha256,sha(registrySnapshotBytes))||
    !same(expectedReviewSha256,sha(reviewManifestBytes)))reject('independent_seal_mismatch');
  const snapshot=parseJson(registrySnapshotBytes,'registry_json');
  exact(snapshot,['schema_version','as_of','coverage','tracks'],'registry_schema');
  if(snapshot.coverage!=='complete_active_isrc_index')reject('registry_coverage_incomplete');
  if(snapshot.schema_version!=='wk100-shazam-registry-snapshot-v1'||!clock(snapshot.as_of)||
    Date.parse(snapshot.as_of)<Date.parse(receipt.observed_at)||
    !Array.isArray(snapshot.tracks)||snapshot.tracks.length>5000)reject('registry_schema');
  const tracks=new Map(),isrcCounts=new Map();
  for(const t of snapshot.tracks){
    exact(t,['id','status','isrc'],'registry_track_schema');
    if(!UUID.test(t.id)||!['active','archived','draft','retired'].includes(t.status)||
      (t.isrc!==null&&(!ISRC.test(t.isrc)))||tracks.has(t.id))reject('registry_track_invalid');
    tracks.set(t.id,t);
    if(t.status==='active'&&t.isrc)isrcCounts.set(t.isrc,(isrcCounts.get(t.isrc)||0)+1);
  }
  const review=parseJson(reviewManifestBytes,'review_json');
  exact(review,['schema_version','source_raw_sha256','registry_snapshot_sha256','decisions'],'review_schema');
  if(review.schema_version!=='wk100-shazam-identity-review-v1'||
    review.source_raw_sha256!==receipt.raw_sha256||
    review.registry_snapshot_sha256!==expectedRegistrySha256||
    !Array.isArray(review.decisions)||review.decisions.length>entries.length)reject('review_scope');
  const byRank=new Map(),usedTrackIds=new Set();
  for(const d of review.decisions){
    exact(d,['rank','observed_title','observed_artist','track_id','isrc',
      'source_evidence_ref','identity_evidence_ref','reviewer_primary','reviewer_independent',
      'reviewed_at','decision'],'review_decision_schema');
    if(!Number.isInteger(d.rank)||d.rank<1||d.rank>entries.length||byRank.has(d.rank)||
      !UUID.test(d.track_id)||!ISRC.test(d.isrc)||d.decision!=='reviewed_proposal'||
      ![d.source_evidence_ref,d.identity_evidence_ref,d.reviewer_primary,d.reviewer_independent]
        .every(x=>typeof x==='string'&&REF.test(x))||
      d.reviewer_primary===d.reviewer_independent||d.source_evidence_ref===d.identity_evidence_ref||
      !clock(d.reviewed_at)||Date.parse(d.reviewed_at)<Date.parse(snapshot.as_of)||
      usedTrackIds.has(d.track_id))reject('review_decision_invalid');
    const row=entries[d.rank-1],track=tracks.get(d.track_id);
    if(row.title_observed!==d.observed_title||row.artist_observed!==d.observed_artist||
      !track||track.status!=='active'||track.isrc!==d.isrc||isrcCounts.get(d.isrc)!==1)
      reject('review_identity_conflict');
    usedTrackIds.add(d.track_id);byRank.set(d.rank,d);
  }
  const outcomes=entries.map(row=>{
    const d=byRank.get(row.source_rank);
    return d?{row_ref:row.row_ref,source_rank:row.source_rank,status:'reviewed_proposal',
      proposed_track_id:d.track_id,isrc:d.isrc,source_evidence_ref:d.source_evidence_ref,
      identity_evidence_ref:d.identity_evidence_ref,reviewed_at:d.reviewed_at,
      reviewers:[d.reviewer_primary,d.reviewer_independent]}:
      {row_ref:row.row_ref,source_rank:row.source_rank,status:'review_required',
        proposed_track_id:null};
  });
  return Object.freeze({schema_version:'wk100-shazam-registry-review-packet-v1',
    raw_sha256:receipt.raw_sha256,registry_snapshot_sha256:expectedRegistrySha256,
    review_manifest_sha256:expectedReviewSha256,proposed:byRank.size,
    unresolved:entries.length-byRank.size,outcomes,
    canonical_identity_admitted:false,can_publish:false});
}

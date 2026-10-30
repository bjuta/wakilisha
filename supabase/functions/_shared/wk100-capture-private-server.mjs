/**
 * Restricted, read-only WK100 candidate capture preview adapter.
 * The caller owns authentication, service-only DB access and a trusted sealed
 * server manifest. Never pass database clients, manifests or audit details to
 * the browser. No provider request, Registry write or edition mutation.
 */
import {readWk100PrivateRankingEvidence} from './wk100-capture-ranking-reader.mjs';

const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ID=/^[a-z][a-z0-9_:-]{2,79}$/;
const RAW=/^v1\/\d{4}-\d{2}-\d{2}\/[a-z][a-z0-9_-]{1,63}\/\d{8}T\d{6}Z-[1-8]\/[a-f0-9]{64}\.(?:html|csv|json|bin)$/;
const BUCKET='wk-chart-raw-evidence-v1';
const MAX_RAW=4_194_304;
const fail=code=>{throw new Error(`wk100_capture_preview_${code}`);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const unique=xs=>new Set(xs).size===xs.length;
async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}

export function validWk100CapturePreviewProjectBinding(url,ref){
  if(typeof ref!=='string'||!/^[a-z0-9]{20}$/.test(ref))return false;
  try{const u=new URL(url);return u.protocol==='https:'&&u.hostname===`${ref}.supabase.co`&&
    !u.username&&!u.password&&(!u.port||u.port==='443')&&u.pathname==='/'&&!u.search&&!u.hash;}
  catch{return false;}
}

/** Verifies exact manifest bytes against the independent server-only SHA seal. */
export async function readWk100SealedCaptureManifest(raw,expected){
  if(typeof raw!=='string'||raw.length<2||raw.length>262144||!SHA.test(expected))fail('manifest_unavailable');
  if(await digest(new TextEncoder().encode(raw))!==expected)fail('manifest_digest_mismatch');
  let config;
  try{config=JSON.parse(raw);}catch{fail('manifest_json_invalid');}
  if(!exact(config,['schema_version','week_start_eat','dataset_mode','selected_attempt_ids','constitution','method'])||
    config.schema_version!=='wk100-private-capture-preview-v1'||config.dataset_mode!=='authorized_candidate')
    fail('manifest_contract_invalid');
  const ids=config.selected_attempt_ids;
  if(!Array.isArray(ids)||ids.length<2||ids.length>8||!unique(ids)||!ids.every(x=>typeof x==='string'&&UUID.test(x)))
    fail('manifest_attempts_invalid');
  const c=config.constitution;
  if(!Array.isArray(c)||c.length!==ids.length||!c.every(x=>exact(x,['source_key','operator_key','authority_ref'])&&
    Object.values(x).every(v=>typeof v==='string'&&ID.test(v)))||
    !unique(c.map(x=>x.source_key))||!unique(c.map(x=>x.operator_key)))fail('manifest_constitution_invalid');
  if(!exact(config.method,['version','behavior_weights','operator_slots','minimum_operators',
    'minimum_behaviors','minimum_corrob_tracks','maximum_operator_share']))fail('manifest_method_invalid');
  return config;
}

/** Explicit browser allowlist: no private source, scores, evidence or IDs. */
export function makeWk100CapturePreviewSummary(result){
  if(!object(result)||result.can_publish!==false||
    !['review_required','private_preview'].includes(result.status))fail('result_invalid');
  if(result.status==='review_required'){
    if(!Array.isArray(result.review_rows))fail('review_rows_invalid');
    return {status:'review_required',week_start_eat:result.week_start_eat,
      verified_receipts:result.verified_receipts,pending_review_rows:result.review_rows.length,
      can_publish:false};
  }
  const audit=result.private_audit;
  if(!object(audit)||audit.can_publish!==false||audit.dataset_mode!=='authorized_candidate')
    fail('audit_invalid');
  return {status:'private_preview',week_start_eat:result.week_start_eat,
    verified_receipts:result.verified_receipts,operator_count:audit.operator_count,
    behavior_count:audit.behavior_count,recording_count:audit.recording_count,
    pending_identity_rows:result.pending_identity_rows??0,
    corroborated_top100:audit.corroborated_top100,coverage_status:audit.coverage_status,
    can_publish:false};
}

/** Service-only DB client and private Storage bucket are never instantiated here. */
export async function readWk100PrivateCaptureEvidence({db,storage,manifest}){
  if(!db||typeof db.from!=='function'||!storage||typeof storage.from!=='function')fail('backend_missing');
  if(!object(manifest)||manifest.schema_version!=='wk100-private-capture-preview-v1'||
    manifest.dataset_mode!=='authorized_candidate')fail('manifest_not_authorized');
  const bucket=storage.from(BUCKET);
  if(!bucket||typeof bucket.download!=='function')fail('storage_unavailable');
  const readRawBytes=async key=>{
    if(typeof key!=='string'||key.length>256||!RAW.test(key)||key.includes('..'))fail('raw_key_invalid');
    const {data,error}=await bucket.download(key);
    if(error||!data||typeof data.arrayBuffer!=='function')fail('private_readback_failed');
    if(!Number.isFinite(data.size)||data.size<1||data.size>MAX_RAW)fail('raw_size_invalid');
    const bytes=new Uint8Array(await data.arrayBuffer());
    if(bytes.byteLength!==data.size||bytes.byteLength>MAX_RAW)fail('raw_size_invalid');
    return bytes;
  };
  const result=await readWk100PrivateRankingEvidence({db,readRawBytes,
    week_start_eat:manifest.week_start_eat,selected_attempt_ids:manifest.selected_attempt_ids,
    constitution:manifest.constitution,method:manifest.method,dataset_mode:'authorized_candidate'});
  return result;
}

/** Browser-safe existing preview path: never returns private evidence. */
export async function runWk100PrivateCapturePreview(args){
  return makeWk100CapturePreviewSummary(await readWk100PrivateCaptureEvidence(args));
}

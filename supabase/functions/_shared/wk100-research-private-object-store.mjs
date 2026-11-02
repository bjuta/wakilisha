/**
 * WK100 researcher-directed original CSV: restricted server-only Storage helper.
 *
 * Not an Edge endpoint, DB receipt, source admission, attestation or publisher.
 * Call only after an authenticated/capability-authorized and project-bound server
 * boundary. SQL must reserve and durably record the observation separately.
 * The original CSV bytes and private row labels must never reach public clients.
 */
import {
  verifyWk100ShazamResearchImport,
  projectWk100ResearchImportStatus,
} from './wk100-research-receipt-bridge.mjs';

const BUCKET='wk-chart-raw-evidence-v1';
const SHA=/^[a-f0-9]{64}$/;
const fail=code=>{throw new Error('wk100_research_store_'+code);};

async function sha256(bytes){
  const d=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...d].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function isDuplicate(error){
  if(!error || typeof error!=='object')return false;
  return error.code==='AssetAlreadyExists' || error.code==='ResourceAlreadyExists' ||
    error.statusCode===409 || error.status===409;
}
function sameBytes(a,b){
  if(a.byteLength!==b.byteLength)return false;
  let mismatch=0;
  for(let i=0;i<a.byteLength;i++) mismatch|=a[i]^b[i];
  return mismatch===0;
}

/**
 * The return is PRIVATE. Do not serialize the returned object to the browser.
 * No caller may treat Storage success as a real research receipt without an
 * immutable PostgreSQL observation record and independent source-method review.
 * Do not remove an object if the later SQL receipt transaction fails; reconcile
 * from the durable reservation ledger, not an untracked destructive cleanup.
 */
export async function storeWk100ResearchOriginalBytes({
  originalBytes,receipt,researchWeekStartEat,storage,
}){
  // Always validate original content and exact researcher-provided observation
  // before ANY Storage operation. Neither the receipt nor hash proves origin.
  const verified=await verifyWk100ShazamResearchImport({
    originalBytes,receipt,researchWeekStartEat,
  });
  if(!SHA.test(verified.raw_sha256) ||
     !storage || typeof storage.from!=='function')
    fail('restricted_storage_required');
  const bucket=storage.from(BUCKET);
  if(!bucket || typeof bucket.upload!=='function' ||
     typeof bucket.download!=='function')
    fail('restricted_storage_required');

  // Stable content address: two observations of the same exact CSV can reuse
  // one private object, but must become separate durable observation receipts.
  const objectKey=`research/v1/shazam_ke/${verified.raw_sha256.slice(0,2)}/${verified.raw_sha256}.csv`;
  const upload=await bucket.upload(objectKey,originalBytes,{
    contentType:'text/csv',upsert:false,cacheControl:'0',
  });
  if(!upload || (upload.data===undefined && upload.error===undefined))
    fail('upload_unavailable');
  if(upload.error && !isDuplicate(upload.error))fail('upload_unavailable');

  // Upload ACK is insufficient: verify exact private readback, including a
  // collision/retry. A different body at the same key must hard-stop.
  const download=await bucket.download(objectKey);
  if(download?.error || !download?.data ||
     typeof download.data.arrayBuffer!=='function')
    fail('private_readback_unavailable');
  let bytes;
  try {bytes=new Uint8Array(await download.data.arrayBuffer());}
  catch {fail('private_readback_unavailable');}
  if(bytes.byteLength!==verified.byte_length ||
     await sha256(bytes)!==verified.raw_sha256 ||
     !sameBytes(originalBytes,bytes))
    fail('private_readback_mismatch');

  return Object.freeze({
    status:'private_bytes_verified_no_db_receipt',
    bucket:BUCKET,object_key:objectKey,
    raw_sha256:verified.raw_sha256,
    byte_length:verified.byte_length,
    reused_existing_object:!!upload?.error,
    research_week_start_eat:researchWeekStartEat,
    private_verification:verified,
    sanitized_status:projectWk100ResearchImportStatus(verified),
    source_admitted:false,can_score:false,can_publish:false,
  });
}

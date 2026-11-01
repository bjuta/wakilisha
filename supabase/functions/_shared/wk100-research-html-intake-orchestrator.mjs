/**
 * Restricted WK100 October original HTML handoff.
 *
 * Call only from the signed-in user Edge boundary AFTER both live capabilities.
 * Uses the separate unapplied html ledger candidate; never the Shazam ledger,
 * capture attempts, Registry, score kernel or governed publisher.
 */
import {verifyWk100OctoberHtmlOriginal} from './wk100-research-native-html-bridge.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET='wk-chart-raw-evidence-v1';
const fail=code=>{throw Error('wk100_html_intake_'+code);};

function identicalBytes(a,b){
  if(a.byteLength!==b.byteLength)return false;
  let mismatch=0;
  for(let i=0;i<a.byteLength;i++)mismatch|=a[i]^b[i];
  return mismatch===0;
}
function retryableDuplicate(err){
  return err?.code==='AssetAlreadyExists'||err?.code==='ResourceAlreadyExists'||
    err?.error==='Duplicate'||err?.code==='Duplicate'||
    err?.status===409||err?.statusCode===409;
}
function rowsForLedger(verified){
  return verified.private_rows.map(row=>({
    source_rank:row.source_rank,
    row_ref:verified.raw_sha256+':'+row.source_rank,
    provider_track_id:row.provider_track_id,
    title_observed:row.title_observed,
    artist_observed:row.artist_observed??null,
    provider_url:row.provider_url??null,
    duration_native:row.duration_native??null,
    canonical_track_id:null,source_native_count:null,
  }));
}

export async function executeWk100HtmlResearchIntake({
  originalBytes,sourceKey,researchWeekStartEat,authenticatedUserId,
  callerDb,serviceDb,restrictedStorage,
}){
  if(!UUID.test(authenticatedUserId??'')||
     typeof callerDb?.rpc!=='function'||typeof serviceDb?.rpc!=='function'||
     typeof restrictedStorage?.from!=='function')fail('restricted_boundary_required');

  // Crucially performs SHA-256 ORIGINAL-byte pinning and native 100-row replay
  // before a reservation, any Storage transfer or service-role SQL mutation.
  const verified=await verifyWk100OctoberHtmlOriginal({
    originalBytes,sourceKey,weekStartEat:researchWeekStartEat,
  });
  if(verified.can_score!==false||verified.can_publish!==false||
     verified.source_admitted!==false||verified.private_rows.length!==100)
    fail('source_not_qualified');
  const objectKey='research/v1/html/'+sourceKey+'/'+
    verified.raw_sha256.slice(0,2)+'/'+verified.raw_sha256+'.html';
  const reservation=await callerDb.rpc('wk100_reserve_html_research_observation_v1',{
    p_week:researchWeekStartEat,p_source_key:sourceKey,
    p_source_url:verified.source_url,p_observed_at:verified.observation_time_utc,
    p_acquisition_mode:verified.acquisition_mode,
    p_raw_sha256:verified.raw_sha256,p_byte_length:verified.byte_length,
  });
  if(reservation?.error||!UUID.test(reservation?.data?.reservation_id??'')||
     reservation.data.object_key!==objectKey)
    fail('reservation_unavailable');

  const bucket=restrictedStorage.from(BUCKET);
  if(typeof bucket?.upload!=='function'||typeof bucket?.download!=='function')
    fail('restricted_storage_required');
  const uploaded=await bucket.upload(objectKey,originalBytes,{
    contentType:'text/html',upsert:false,cacheControl:'0',
  });
  if(!uploaded||uploaded.error&&!retryableDuplicate(uploaded.error))
    fail('private_upload_unavailable');
  const downloaded=await bucket.download(objectKey);
  if(downloaded?.error||!downloaded?.data||
     typeof downloaded.data.arrayBuffer!=='function')
    fail('private_readback_unavailable');
  let readback;
  try{readback=new Uint8Array(await downloaded.data.arrayBuffer());}
  catch{fail('private_readback_unavailable');}
  if(!identicalBytes(originalBytes,readback))
    fail('private_readback_mismatch');
  // Hashing again prevents a stale/collision object from being treated as ACK.
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',readback));
  const digest=[...hash].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==verified.raw_sha256)fail('private_readback_mismatch');

  // Private observed rows reach the service-only SQL finalizer; the browser
  // receives no titles, IDs, object key, operator UUID or raw receipt paths.
  const finalized=await serviceDb.rpc('wk100_finalize_html_research_observation_v1',{
    p_reservation_id:reservation.data.reservation_id,
    p_sha256:verified.raw_sha256,p_rows:rowsForLedger(verified),
  });
  if(finalized?.error||finalized?.data?.status!=='verified'||
     finalized.data.reservation_id!==reservation.data.reservation_id)
    fail('durable_receipt_unavailable');
  return Object.freeze({
    schema_version:'wk100-admin-html-research-ack-v1',
    reservation_id:reservation.data.reservation_id,
    persisted:true,original_bytes_privately_verified:true,
    research_week_start_eat:researchWeekStartEat,source_key:sourceKey,
    observed_depth:100,native_period_authority:'unknown',
    source_admitted:false,can_score:false,can_publish:false,
    status:'research_only',
  });
}

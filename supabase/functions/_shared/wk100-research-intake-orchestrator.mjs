/**
 * Restricted WK100 research intake orchestrator. Caller must authenticate the
 * user and verify BOTH chart+ingest capabilities before invoking this module.
 * Separately preserve original bytes, private rows, and reservation metadata.
 */
import {verifyWk100ShazamResearchImport,projectWk100ResearchImportStatus} from './wk100-research-receipt-bridge.mjs';
import {storeWk100ResearchOriginalBytes} from './wk100-research-private-object-store.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error('wk100_research_intake_'+code);};

export async function executeWk100ResearchIntake({
  originalBytes,receipt,researchWeekStartEat,authenticatedUserId,
  callerDb,serviceDb,restrictedStorage,
}){
  if(!UUID.test(authenticatedUserId??'') ||
     !callerDb || typeof callerDb.rpc!=='function' ||
     !serviceDb || typeof serviceDb.rpc!=='function' ||
     !restrictedStorage || typeof restrictedStorage.from!=='function')fail('restricted_boundary_required');
  const verified=await verifyWk100ShazamResearchImport({
    originalBytes,receipt,researchWeekStartEat,
  });
  const reservation=await callerDb.rpc('wk100_reserve_research_observation_v1',{
    p_week:researchWeekStartEat,p_source_url:receipt.source_url,
    p_observed_at:receipt.observed_at,p_raw_sha256:verified.raw_sha256,
    p_byte_length:verified.byte_length,p_depth:verified.private_rows.length,
    p_operator_ref:receipt.operator_ref,
  });
  if(reservation?.error || !UUID.test(reservation?.data?.reservation_id??''))
    fail('reservation_unavailable');
  const stored=await storeWk100ResearchOriginalBytes({
    originalBytes,receipt,researchWeekStartEat,storage:restrictedStorage,
  });
  if(reservation.data.object_key!==stored.object_key ||
     stored.raw_sha256!==verified.raw_sha256 ||
     stored.status!=='private_bytes_verified_no_db_receipt')
    fail('reservation_storage_mismatch');
  // Service-role transport is provided ONLY by the authenticated Edge boundary.
  // The supplied rows come from byte-verified source-native parsing, never user
  // submitted arbitrary Registry IDs or client-controlled parsed rows.
  const finalized=await serviceDb.rpc('wk100_finalize_research_observation_v1',{
    p_reservation_id:reservation.data.reservation_id,p_sha256:verified.raw_sha256,
    p_rows:verified.private_rows,
  });
  if(finalized?.error || finalized?.data?.status!=='verified' ||
     finalized.data.reservation_id!==reservation.data.reservation_id)
    fail('durable_receipt_unavailable');
  return Object.freeze({
    schema_version:'wk100-admin-research-intake-ack-v1',
    reservation_id:reservation.data.reservation_id,
    persisted:true,original_bytes_privately_verified:true,
    ...projectWk100ResearchImportStatus(verified),
    source_admitted:false,can_score:false,can_publish:false,
  });
}

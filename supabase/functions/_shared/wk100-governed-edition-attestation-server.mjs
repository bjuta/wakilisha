/**
 * WK100 #1329: server-only bridge between the existing exact-byte private
 * reader, governed 100-row proposal and the service-role attestation RPC.
 *
 * This is NOT an Edge route, frontend response, publication or Registry write.
 * Never return its proposal, raw rows, source IDs, or attestation to browsers.
 * The caller must own an authenticated restricted server context and trusted
 * sealed manifest SHA, and supply a genuine service-role DB client.
 */
import {readWk100SealedCaptureManifest,readWk100PrivateCaptureEvidence}
  from './wk100-capture-private-server.mjs';
import {prepareWk100GovernedEditionProposal}
  from './wk100-governed-edition-proposal.mjs';
import {canonicalJSON,digestSHA256} from './chart-weekly-evidence.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error('wk100_governed_attestation_'+code);};

export async function verifyAndAttestWk100GovernedEdition({
  db,storage,sealed_manifest_text,sealed_manifest_sha256,
  edition_date_eat,cutoff_at_utc,deadline_at_utc,review,
}){
  if(!db||typeof db.from!=='function'||typeof db.rpc!=='function'||
     !storage||typeof storage.from!=='function')
    fail('restricted_backend_required');
  const manifest=await readWk100SealedCaptureManifest(
    sealed_manifest_text,sealed_manifest_sha256);
  const verified=await readWk100PrivateCaptureEvidence({db,storage,manifest});
  if(verified.status!=='private_preview'||verified.can_publish!==false)
    fail('private_replay_not_verified');

  // Only admitted, independently sealed constitution/methodology is used;
  // the browser cannot submit a new source panel or scores for attestation.
  const constitution_sha256=await digestSHA256(canonicalJSON({
    constitution:manifest.constitution,method:manifest.method,
  }));
  const proposal=await prepareWk100GovernedEditionProposal({
    reader_result:verified,edition_date_eat,cutoff_at_utc,
    deadline_at_utc,constitution_sha256,review,
  });
  if(proposal.can_publish!==false||proposal.can_write_registry!==false||
     proposal.observed_entries.length!==100)fail('proposal_not_sealed');

  const {data,error}=await db.rpc('wk100_attest_private_ranking_replay_v1',{
    p_proposal:proposal,
  });
  if(error||typeof data!=='string'||!UUID.test(data))
    fail('attestation_rpc_failed');
  return Object.freeze({attestation_id:data,proposal});
}

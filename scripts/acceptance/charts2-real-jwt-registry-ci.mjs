/**
 * WAKILISHA Charts 2.0: genuine GoTrue JWT / PostgREST proof for already
 * accepted governed Registry review RPCs.  Runs only on the existing fresh,
 * unlinked Supabase disposable CI database.  These synthetic receipts are
 * local fixtures, never source/Artist identity evidence for Production.
 *
 * No application-level Edge service or signed-in Charts Studio browser is
 * claimed here. That requires its own separate product acceptance.
 */
import {randomUUID} from "node:crypto";

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fail=(ok,code)=>{if(!ok)throw Error(code);};
const note="A separate steward independently verified this source recording and every Artist credit against the original publication and release evidence.";
const approval="I independently verified this exact Shazam position and authorize its private Registry recording resolution.";
const revocation="I revoke this exact private Shazam recording resolution after independent re-review.";

async function accept(client,name,params,label){
 const result=await client.rpc(name,params);
 fail(!result.error,label+"_"+String(result.error?.code??"NO_CODE"));
 return result.data;
}
function denied(response,code,label){
 fail(response.error?.code===code,label+"_EXPECTED_"+code+"_GOT_"+String(response.error?.code??"NONE"));
}

export async function verifyCharts2RealJwtRegistryV1({
 api,sql,first,second,subscriber,
}){
 fail(process.env.GITHUB_ACTIONS==="true" &&
   process.env.GITHUB_EVENT_NAME==="pull_request" &&
   !process.env.SUPABASE_PROJECT_REF &&
   !process.env.SUPABASE_ACCESS_TOKEN &&
   api==="http://127.0.0.1:54321" &&
   typeof sql==="function" && first?.user && second?.user &&
   subscriber && UUID.test(first.id) && UUID.test(second.id),
   "STOP_CHARTS2_JWT_NOT_UNLINKED_LOCAL");
 const sourceId=randomUUID(),shazamId=randomUUID(),trackId=randomUUID();
 const sourceSha="a".repeat(64),shazamSha="b".repeat(64);
 const before=sql("select (select count(*) from "+
   "platform_private.charts2_capture_receipts_v1)::text||'|'||"+
   "(select count(*) from platform_private.charts2_observation_review_events_v1)::text;");
 fail(before==="0|0","STOP_CHARTS2_JWT_SOURCE_LEDGER_NOT_EMPTY");
 sql(`do $charts2_real_jwt_original$
 declare positions jsonb;
 begin
   select jsonb_agg(jsonb_build_object('rank',n,'title','CI Genuine JWT Song',
     'artist','CI Original Artist','provider_track_id','youtube-jwt-'||n)
     order by n) into positions from generate_series(1,100) n;
   insert into platform_private.charts2_capture_receipts_v1(
     id,source_key,source_endpoint,method_revision,capture_mode,observed_at,
     original_object_key,original_byte_length,original_sha256,
     original_verified_at,original_content_type,expected_depth,observed_depth,
     observations,parser_version
   ) values (
     '${sourceId}'::uuid,'youtube_ke','https://charts.youtube.com/jwt-original',
     1,'research_original_upload',now(),'jwt-youtube-${sourceId}',1024,
     '${sourceSha}',now(),'application/json',100,100,
     positions,'ci-genuine-jwt-original-v1'
   );
   select jsonb_agg(jsonb_build_object('rank',n,'title','CI Genuine JWT Song',
     'artist','CI Original Artist','provider_track_id',null)
     order by n) into positions from generate_series(1,200) n;
   insert into platform_private.charts2_capture_receipts_v1(
     id,source_key,source_endpoint,method_revision,capture_mode,observed_at,
     original_object_key,original_byte_length,original_sha256,
     original_verified_at,original_content_type,expected_depth,observed_depth,
     observations,parser_version
   ) values (
     '${shazamId}'::uuid,'shazam_ke','https://www.shazam.com/jwt-original',
     1,'research_original_upload',now(),'jwt-shazam-${shazamId}',1024,
     '${shazamSha}',now(),'application/json',200,200,
     positions,'ci-genuine-jwt-original-v1'
   );
   insert into public.registry_tracks(id,slug,title,normalized_title,status)
   values ('${trackId}'::uuid,'ci-jwt-${trackId.slice(0,8)}',
     'CI Genuine JWT Song','ci genuine jwt song','active');
 end $charts2_real_jwt_original$;`);
 const sourceArgs={
   p_source_key:"youtube_ke",p_receipt_id:sourceId,
   p_original_sha256:sourceSha,p_rank:1,
 };
 denied(await subscriber.rpc("admin_stage_charts2_track_intake_v1",sourceArgs),
   "42501","STOP_CHARTS2_SIGNED_IN_UNPRIVILEGED_TRACK_INTAKE");
 const staged=await accept(first.user,"admin_stage_charts2_track_intake_v1",
   sourceArgs,"STOP_CHARTS2_REAL_JWT_TRACK_INTAKE");
 fail(UUID.test(staged?.suggestion_id??"") &&
   staged.status==="needs_review" &&
   staged.idempotent_replay===false,
   "STOP_CHARTS2_REAL_JWT_TRACK_INTAKE_RECEIPT_INVALID");
 const replay=await accept(second.user,"admin_stage_charts2_track_intake_v1",
   sourceArgs,"STOP_CHARTS2_REAL_JWT_REPLAY");
 fail(replay.suggestion_id===staged.suggestion_id &&
   replay.idempotent_replay===true,"STOP_CHARTS2_REAL_JWT_TRACK_REPLAY_NOT_IDEMPOTENT");
 const rawCredit=sql("select credit_role||'|'||resolution_mode||'|'||"+
   "observed_name from public.registry_provider_track_suggestion_artists "+
   "where suggestion_id='"+staged.suggestion_id+"'::uuid and credit_order=1;");
 fail(rawCredit==="unresolved|unresolved|CI Original Artist",
   "STOP_CHARTS2_REAL_JWT_RAW_CREDIT_REWRITTEN");
 const credit=await accept(first.user,
   "admin_append_charts2_track_intake_credit_v1",{
     p_suggestion_id:staged.suggestion_id,
     p_observed_name:"CI Collaborating Artist",
     p_review_note:note,p_evidence_url:"https://example.org/ci-artist-credit",
   },"STOP_CHARTS2_REAL_JWT_APPEND_CREDIT");
 fail(credit?.credit_order===2 && credit.credit_role==="unresolved" &&
   credit.identity_approved===false,
   "STOP_CHARTS2_REAL_JWT_CREDIT_PREMATURE_AUTHORITY");
 const artist=await accept(first.user,"admin_stage_charts2_artist_intake_v1",
   sourceArgs,"STOP_CHARTS2_REAL_JWT_ARTIST_INTAKE");
 fail(UUID.test(artist?.run_id??"") && UUID.test(artist?.staging_id??""),
   "STOP_CHARTS2_REAL_JWT_ARTIST_INTAKE_RECEIPT");
 const artistState=sql("select "+
   "(source_origin_iso2 is null)::text||'|'||"+
   "(source_spotify_id is null)::text||'|'||"+
   "(source_metadata->>'chart_artist_claim_only')::text "+
   "from public.provider_intake_artist_staging where id='"+artist.staging_id+"'::uuid;");
 fail(artistState==="true|true|true",
   "STOP_CHARTS2_REAL_JWT_ARTIST_INTAKE_INVENTED_METADATA");
 console.log("WK_AUTH_CHARTS2_JWT_TRACK_ARTIST_CREDIT_INTAKE_AND_DENIAL=PASS");

 // Genuine caller-bound recovery: no fabricated operation/grant/verifier
 // receipts. Only the two pre-existing Artist identities are local fixtures.
 const recoveryArgs={p_status:"all",p_limit:1,p_offset:0,
   p_suggestion_id:staged.suggestion_id,p_playlist_item_id:null};
 const readRecovery=async (user)=>{
   const envelope=await accept(user,"admin_get_registry_track_intake_queue",recoveryArgs,
     "STOP_CHARTS2_JWT_RECOVERY_QUEUE");
   fail(envelope?.rows?.length===1 && envelope.rows[0].suggestion_id===staged.suggestion_id,
     "STOP_CHARTS2_JWT_RECOVERY_ROW");
   return envelope.rows[0];
 };
 denied(await subscriber.rpc("admin_get_registry_track_intake_queue",recoveryArgs),
   "42501","STOP_CHARTS2_JWT_UNPRIVILEGED_RECOVERY");
 fail((await readRecovery(first.user)).recovery===null,"STOP_CHARTS2_JWT_FRESH_RECOVERY_NOT_NULL");
 const artistIds=[randomUUID(),randomUUID()];
 sql(`insert into public.registry_artists(id,slug,display_name,normalized_name,status) values
   ('${artistIds[0]}','ci-original-${artistIds[0].slice(0,8)}','CI Original Artist','ci original artist','active'),
   ('${artistIds[1]}','ci-collab-${artistIds[1].slice(0,8)}','CI Collaborating Artist','ci collaborating artist','active');`);
 for(let i=0;i<2;i++){
   await accept(first.user,"admin_update_registry_track_intake_artist_credit",{
     p_suggestion_id:staged.suggestion_id,p_credit_order:i+1,
     p_credit_role:i===0?"primary":"featured",p_resolution_mode:"existing_artist",
     p_registry_artist_id:artistIds[i],p_observed_name:i===0?"CI Original Artist":"CI Collaborating Artist",
   },"STOP_CHARTS2_JWT_REVIEWED_RECOVERY_CREDIT");
 }
 const createArgs={p_suggestion_id:staged.suggestion_id,p_title:"CI Genuine JWT Recovery Song"};
 const created=await accept(first.user,"admin_create_registry_track_intake_identity_v1",
   createArgs,"STOP_CHARTS2_JWT_CREATE_RECOVERY_DRAFT");
 const recoveryId=created?.track?.track_id;
 fail(UUID.test(recoveryId??"")&&created.verifier_status==="passed"&&
   created.track.status==="draft","STOP_CHARTS2_JWT_DRAFT_VERIFIER");
 const draft=await readRecovery(first.user);
 fail(draft.recovery?.state==="draft"&&draft.recovery.track_id===recoveryId&&
   draft.recovery.title===createArgs.p_title&&draft.canonical_track_id===null,
   "STOP_CHARTS2_JWT_VERIFIED_DRAFT_RECOVERY");
 fail((await readRecovery(second.user)).recovery?.state==="blocked",
   "STOP_CHARTS2_JWT_OTHER_CALLER_DRAFT_RECOVERY");
 const resumed=await accept(first.user,"admin_create_registry_track_intake_identity_v1",
   createArgs,"STOP_CHARTS2_JWT_REPLAY_RECOVERY_DRAFT");
 fail(resumed.idempotent_replay===true&&resumed.track.track_id===recoveryId,
   "STOP_CHARTS2_JWT_DRAFT_REPLAY_CHANGED_ID");
 for(const reviewed of draft.artist_credits){
   await accept(first.user,"admin_reconcile_registry_track_intake_credit_v1",{
     p_suggestion_id:staged.suggestion_id,p_source_credit_id:reviewed.credit_id,
     p_registry_track_id:recoveryId,
   },"STOP_CHARTS2_JWT_RECOVERY_CREDIT_RECONCILIATION");
 }
 // No selected enrichment or confirmed provider links have been introduced.
 await accept(first.user,"admin_admit_registry_track_intake_track_profile_v1",{
   p_suggestion_id:staged.suggestion_id,p_registry_track_id:recoveryId,p_allow_overwrite:false,
 },"STOP_CHARTS2_JWT_RECOVERY_PROFILE");
 const activated=await accept(first.user,"admin_activate_registry_track_intake_v1",{
   p_suggestion_id:staged.suggestion_id,
 },"STOP_CHARTS2_JWT_RECOVERY_ACTIVATION");
 fail(activated?.verifier_status==="passed"&&activated?.track?.track_id===recoveryId,
   "STOP_CHARTS2_JWT_RECOVERY_ACTIVATION_VERIFIER");
 const active=await readRecovery(first.user);
 fail(active.recovery?.state==="active"&&active.recovery.track_id===recoveryId&&
   active.canonical_track_id===null,"STOP_CHARTS2_JWT_ACTIVE_RECOVERY");
 // Preserve structured verifier rejection evidence in this disposable-only
 // harness. Do not modify operations, grants, receipts or verifier results.
 const finalArgs={
   p_suggestion_id:staged.suggestion_id,p_registry_track_id:recoveryId,p_review_note:note,
 };
 const finalResponse=await first.user.rpc("admin_finalize_registry_track_intake_v1",finalArgs);
 if(finalResponse.error){
   const err=finalResponse.error;
   console.log("WK_AUTH_CHARTS2_FINALIZATION_DENIAL="+JSON.stringify({
     code:err.code,message:err.message,details:err.details,hint:err.hint,
   }));
   const diagnostic=sql(`select jsonb_agg(jsonb_build_object(
     'operation',o.operation_key,'status',o.status,'verifier',o.verifier_status,
     'grant_track_matches',g.plan_payload->>'track_id'='${recoveryId}',
     'grant_suggestion_matches',g.plan_payload->>'suggestion_id'='${staged.suggestion_id}',
     'credit_fingerprint_matches',case when o.operation_key='registry.track_artist_credit.reviewed_reconcile'
       then platform_private.registry_subject_state_fingerprint('track_artist_credit',
         nullif(o.result_payload->>'relation_id','')::uuid)=o.result_payload->>'relation_state_fingerprint'
       else null end
   ) order by o.created_at,o.id) from platform_private.registry_mutation_operations o
   join platform_private.registry_execution_grants g on g.id=o.execution_grant_id
   where g.plan_payload->>'track_id'='${recoveryId}';`);
   console.log("WK_AUTH_CHARTS2_CHILD_RECEIPT_DIAGNOSTIC="+diagnostic);
 }
 fail(!finalResponse.error,"STOP_CHARTS2_JWT_RECOVERY_FINALIZE_"+String(finalResponse.error?.code??"NO_CODE"));
 const finalized=finalResponse.data;
 const finished=await readRecovery(first.user);
 fail(finalized?.status==="canonicalized"&&finished.status==="canonicalized"&&
   finished.recovery===null&&finished.canonicalized_track_id===recoveryId,
   "STOP_CHARTS2_JWT_RECOVERY_FINAL_STATE");
 console.log("WK_AUTH_CHARTS2_VERIFIED_DRAFT_AND_ACTIVATION_RECOVERY=PASS");

 const decisionArgs={
   p_receipt_id:shazamId,p_original_sha256:shazamSha,p_rank:1,
   p_action:"approve",p_track_id:trackId,p_review_note:note,
   p_evidence_url:"https://example.org/ci-shazam-release",
   p_expected_previous_event_id:null,p_acknowledgement:approval,
 };
 denied(await subscriber.rpc(
   "admin_review_charts2_no_id_observation_v1",decisionArgs),
   "42501","STOP_CHARTS2_UNPRIVILEGED_SHZAM_APPROVAL");
 const result=await accept(first.user,
   "admin_review_charts2_no_id_observation_v1",
   decisionArgs,"STOP_CHARTS2_REAL_JWT_SHZAM_APPROVAL");
 fail(UUID.test(result?.event_id??"")&&result.action==="approve"&&
   result.idempotent_replay===false,
   "STOP_CHARTS2_REAL_JWT_SHZAM_APPROVAL_RECEIPT");
 const same=await accept(first.user,
   "admin_review_charts2_no_id_observation_v1",
   decisionArgs,"STOP_CHARTS2_REAL_JWT_SHZAM_IDEMPOTENT");
 fail(same.event_id===result.event_id &&
   same.idempotent_replay===true,
   "STOP_CHARTS2_REAL_JWT_SHZAM_EXACT_REPLAY");
 denied(await second.user.rpc(
   "admin_review_charts2_no_id_observation_v1",decisionArgs),
   "PT409","STOP_CHARTS2_TWO_GENUINE_JWT_STALE_SHZAM_REVIEW");
 const revoked=await accept(first.user,
   "admin_review_charts2_no_id_observation_v1",{
     ...decisionArgs,p_action:"revoke",p_track_id:null,
     p_expected_previous_event_id:result.event_id,
     p_evidence_url:"https://example.org/ci-shazam-correction",
     p_acknowledgement:revocation,
   },"STOP_CHARTS2_REAL_JWT_SHZAM_REVOCATION");
 fail(UUID.test(revoked?.event_id??"") &&
   revoked.action==="revoke" && revoked.revision===2,
   "STOP_CHARTS2_REAL_JWT_SHZAM_REVOCATION_RECEIPT");
 const after=sql("select (select count(*) from "+
  "platform_private.charts2_observation_review_events_v1 where receipt_id='"+
  shazamId+"'::uuid)::text||'|'||"+
  "(select count(*) from public.registry_track_provider_links where track_id='"+
  trackId+"'::uuid)::text;");
 fail(after==="2|0","STOP_CHARTS2_REAL_JWT_SHZAM_SYNTHETIC_PROVIDER_ID");
 console.log("WK_AUTH_CHARTS2_TWO_REAL_JWT_SHZAM_REVIEW_CAS_REVOCATION_NO_FAKE_ID=PASS");
}

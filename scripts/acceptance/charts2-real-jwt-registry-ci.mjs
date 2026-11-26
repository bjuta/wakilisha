/**
 * WAKILISHA Charts 2.0: genuine GoTrue JWT / PostgREST proof for already
 * accepted governed Registry review RPCs.  Runs only on the existing fresh,
 * unlinked Supabase disposable CI database.  These synthetic receipts are
 * local fixtures, never source/Artist identity evidence for Production.
 *
 * No application-level Edge service or signed-in Charts Studio browser is
 * claimed here. That requires its own separate product acceptance.
 */
import {randomUUID,createHash} from "node:crypto";

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
 api,sql,first,second,subscriber,reviewer,service,
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
     'artist',case when n=3 then 'CI Chart Artist Draft' else 'CI Original Artist' end,'provider_track_id','youtube-jwt-'||n)
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
 const sourceEvidence=await accept(first.user,"admin_get_registry_track_intake_enrichment",{
   p_suggestion_id:staged.suggestion_id,
 },"STOP_CHARTS2_JWT_ORIGINAL_EVIDENCE");
 fail(sourceEvidence.provider_links?.length===1 &&
   sourceEvidence.provider_links[0].provider_entity_id==="youtube-jwt-1" &&
   sourceEvidence.provider_links[0].match_status==="candidate" &&
   Number(sourceEvidence.provider_links[0].confidence_score)===0 &&
   sourceEvidence.observations?.some(o=>o.field_name==="title"&&
     o.field_value==="CI Genuine JWT Song"&&o.source_path==="chart_receipt.original.title") &&
   !sourceEvidence.observations?.some(o=>o.source_path?.startsWith("playlist_validation.")) &&
   Object.keys(sourceEvidence.accepted??{}).length===0,
   "STOP_CHARTS2_JWT_SOURCE_AUTO_CONFIRMED_OR_MISLABELLED");
 console.log("WK_AUTH_CHARTS2_ORIGINAL_SOURCE_CANDIDATE_ONLY=PASS");
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
   {...sourceArgs,p_rank:3},"STOP_CHARTS2_REAL_JWT_ARTIST_INTAKE");
 fail(UUID.test(artist?.run_id??"") && UUID.test(artist?.staging_id??""),
   "STOP_CHARTS2_REAL_JWT_ARTIST_INTAKE_RECEIPT");
 const artistState=sql("select "+
   "(source_origin_iso2 is null)::text||'|'||"+
   "(source_spotify_id is null)::text||'|'||"+
   "(source_metadata->>'chart_artist_claim_only')::text "+
   "from public.provider_intake_artist_staging where id='"+artist.staging_id+"'::uuid;");
 fail(artistState==="true|true|true",
   "STOP_CHARTS2_REAL_JWT_ARTIST_INTAKE_INVENTED_METADATA");
 // Complete the already-staged Artist contract, not a second independent fixture.
 const shellArgs={p_staging_id:artist.staging_id};
 denied(await subscriber.rpc("admin_create_registry_artist_intake_shell_v1",shellArgs),
   "42501","STOP_CHARTS2_JWT_ARTIST_UNPRIVILEGED_CREATE");
 denied(await first.user.rpc("admin_create_registry_artist_intake_shell_v1",shellArgs),
   "42501","STOP_CHARTS2_JWT_ARTIST_PENDING_CREATE");
 const artistReview=await accept(first.user,"admin_review_registry_artist_intake_v1",{
   p_intake_run_id:artist.run_id,p_staging_id:artist.staging_id,p_decision:"accepted",
   p_notes:note,p_target_registry_artist_id:null,
 },"STOP_CHARTS2_JWT_ARTIST_REVIEW");
 fail(artistReview.decision==="accepted"&&/^[a-f0-9]{64}$/.test(artistReview.review_fingerprint??""),
   "STOP_CHARTS2_JWT_ARTIST_REVIEW_RECEIPT");
 const shell=await accept(first.user,"admin_create_registry_artist_intake_shell_v1",shellArgs,
   "STOP_CHARTS2_JWT_ARTIST_CREATE");
 const draftArtistId=shell?.artist?.artist_id;
 fail(UUID.test(draftArtistId??"")&&UUID.test(shell?.operation_id??"")&&
   shell.created===true&&shell.idempotent_replay===false&&shell.verifier_status==="passed"&&
   shell.artist.status==="draft"&&shell.artist.artist_name==="CI Chart Artist Draft",
   "STOP_CHARTS2_JWT_ARTIST_DRAFT_VERIFIER");
 const artistProof=sql(`select count(*) from platform_private.registry_mutation_operations o
   join platform_private.registry_execution_grants g on g.id=o.execution_grant_id
   join platform_private.registry_evidence_assertions e on e.id=(g.plan_payload->>'evidence_assertion_id')::uuid
   join public.provider_intake_artist_staging s on s.id='${artist.staging_id}'::uuid
   join public.registry_artists a on a.id='${draftArtistId}'::uuid
   where o.id='${shell.operation_id}'::uuid and o.operation_key='registry.artist.create'
     and o.status='succeeded' and o.verifier_status='passed' and o.affected_rows=1
     and g.idempotency_key='artist-intake-create:'||s.id::text and g.issued_by_user_id='${first.id}'::uuid
     and e.subject_id=a.id and e.source_kind='charts2_chart_observation'
     and e.source_ref='artist-intake-staging:'||s.id::text
     and e.source_payload_fingerprint=s.review_fingerprint
     and a.status='draft' and a.origin_iso2 is null;`);
 fail(artistProof==="1","STOP_CHARTS2_JWT_ARTIST_EXACT_SOURCE_GRANT_PROOF");
 const sameArtist=await accept(first.user,"admin_create_registry_artist_intake_shell_v1",shellArgs,
   "STOP_CHARTS2_JWT_ARTIST_DRAFT_REPLAY");
 fail(sameArtist.idempotent_replay===true&&sameArtist.created===false&&
   sameArtist.artist.artist_id===draftArtistId&&sameArtist.operation_id===shell.operation_id&&
   sameArtist.verifier_status==="passed","STOP_CHARTS2_JWT_ARTIST_REPLAY_CHANGED_DRAFT");
 denied(await second.user.rpc("admin_create_registry_artist_intake_shell_v1",shellArgs),
   "40001","STOP_CHARTS2_JWT_ARTIST_OTHER_CALLER_REPLAY");
 await accept(first.user,"admin_mark_registry_artist_intake_applied_v1",{
   p_staging_id:artist.staging_id,p_artist_id:draftArtistId,
 },"STOP_CHARTS2_JWT_ARTIST_SEAL");
 fail(sql(`select count(*) from public.provider_intake_artist_staging s
   join public.registry_artists a on a.id=s.applied_registry_artist_id
   where s.id='${artist.staging_id}'::uuid and s.review_status='accepted'
     and s.action_taken='processed' and a.id='${draftArtistId}'::uuid
     and a.status='draft' and a.origin_iso2 is null;`)==="1",
   "STOP_CHARTS2_JWT_ARTIST_SEAL_STATE");
 console.log("WK_AUTH_CHARTS2_ARTIST_VERIFIED_CHART_ORIGIN_DRAFT_AND_SEAL=PASS");
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
   finalized.finalization_state?.ready===true &&
   finalized.finalization_state.provider_expected===0 &&
   finalized.finalization_state.provider_verified===0 &&
   finished.recovery===null&&finished.canonicalized_track_id===recoveryId &&
   sql("select count(*) from public.registry_track_provider_links where track_id='"+
     recoveryId+"'::uuid;")==="0",
   "STOP_CHARTS2_JWT_RECOVERY_FINAL_STATE");
 console.log("WK_AUTH_CHARTS2_VERIFIED_DRAFT_AND_ACTIVATION_RECOVERY=PASS");

 const secondStage=await accept(first.user,"admin_stage_charts2_track_intake_v1",
   {...sourceArgs,p_rank:2},"STOP_CHARTS2_JWT_SECOND_PROVIDER_CANDIDATE");
 const secondId=secondStage.suggestion_id;
 const selectionArgs={p_suggestion_id:secondId,p_provider:"youtube",
   p_provider_entity_id:"youtube-jwt-2",p_reason:note};
 denied(await subscriber.rpc("admin_select_registry_track_intake_provider_evidence",selectionArgs),
   "42501","STOP_CHARTS2_JWT_UNPRIVILEGED_PROVIDER_SELECTION");
 await accept(first.user,"admin_record_registry_track_intake_provider_evidence",{
   p_suggestion_id:secondId,p_provider:"youtube",p_provider_entity_id:"youtube-jwt-2",
   p_provider_url:"https://www.youtube.com/watch?v=ci-local-only",
   p_fields:{title:"CI Genuine JWT Song",artist_names:["CI Original Artist"]},
   p_raw_payload:{fixture:"disposable-local-only"},p_confidence:0.95,
 },"STOP_CHARTS2_JWT_INSPECTED_PROVIDER_EVIDENCE");
 const selected=await accept(first.user,"admin_select_registry_track_intake_provider_evidence",
   selectionArgs,"STOP_CHARTS2_JWT_EXPLICIT_PROVIDER_SELECTION");
 fail(selected.match_status==="confirmed"&&selected.changed===true &&
   sql("select count(*) from public.registry_track_provider_links where provider_track_id='youtube-jwt-2';")==="0",
   "STOP_CHARTS2_JWT_PROVIDER_SELECTION_BYPASSED_ADMISSION");
 const selectedReplay=await accept(first.user,"admin_select_registry_track_intake_provider_evidence",
   selectionArgs,"STOP_CHARTS2_JWT_PROVIDER_SELECTION_REPLAY");
 fail(selectedReplay.changed===false,"STOP_CHARTS2_JWT_PROVIDER_SELECTION_NOT_IDEMPOTENT");
 console.log("WK_AUTH_CHARTS2_PROVIDER_SELECTION_EXPLICIT_NO_CANONICAL_WRITE=PASS");

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

 // Real JWT admission over a full local five-source receipt set. These rows
 // are synthetic disposable SQL fixtures, not newly verified Storage bytes.
 // Keep the preceding Intake fixture unchanged; new receipts supersede its
 // earlier partial source set by the existing latest-reader ordering.
 sql(`insert into platform_private.charts2_capture_receipts_v1(
   source_key,source_endpoint,method_revision,capture_mode,observed_at,
   original_object_key,original_byte_length,original_sha256,original_verified_at,
   original_content_type,expected_depth,observed_depth,observations,parser_version,
   native_period_authority,provider_week_ending_date,created_at)
 select s.source_key,s.endpoint,1,'service_original',now(),
   s.source_key||'/'||left(s.sha,2)||'/'||s.sha||s.ext,1024,s.sha,now(),
   s.mime,s.depth,s.depth,
   (select jsonb_agg(jsonb_build_object('rank',n,'title','CI Admission Song '||n,
     'artist',case when s.source_key='apple_ke' then null else 'CI Admission Artist' end,
     'provider_track_id',case when s.source_key='shazam_ke' then null else 'admission-'||s.source_key||'-'||n end)
     order by n) from generate_series(1,s.depth) n),
   'ci-admission-local-v1',
   case when s.source_key='youtube_ke' then 'provider_declared_end_date' else 'unknown' end,
   case when s.source_key='youtube_ke' then '2026-11-12'::date else null end,now()+interval '1 second'
 from (values
   ('youtube_ke','https://charts.youtube.com/youtubei/v1/browse?alt=json',repeat('1',64),100,'application/json','.json'),
   ('mdundo_ke','https://play.mdundo.com/top-charts/ke',repeat('2',64),100,'text/html','.html'),
   ('apple_ke','https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172',repeat('3',64),100,'text/html','.html'),
   ('audiomack_ke','https://audiomack.com/geo-charts/playlist/kenya',repeat('4',64),100,'text/html','.html'),
   ('shazam_ke','https://www.shazam.com/services/charts/csv/top-200/kenya',repeat('5',64),200,'text/csv','.csv')
 ) s(source_key,endpoint,sha,depth,mime,ext);`);
 const readProjection=()=>JSON.parse(sql("select platform_private.charts2_compute_private_freeze_v1(true)::text;"));
 const original=readProjection();
 fail(original.unresolved_count===600&&original.conflict_count===0&&
   original.investigation_positions.length===600&&original.eligible_count===0,
   "STOP_MIZIZI_ADMISSION_FULL_SOURCE_PARTITION");
 const shazam=original.investigation_positions.find(p=>p.source_key==="shazam_ke"&&p.rank===1);
 const resolved=await accept(first.user,"admin_review_charts2_no_id_observation_v1",{
   p_receipt_id:shazam.receipt_id,p_original_sha256:shazam.original_sha256,p_rank:1,
   p_action:"approve",p_track_id:trackId,p_review_note:note,
   p_evidence_url:"https://example.org/ci-admission-evidence",
   p_expected_previous_event_id:null,p_acknowledgement:approval,
 },"STOP_MIZIZI_ADMISSION_RESOLVED_FIXTURE");
 fail(UUID.test(resolved.event_id),"STOP_MIZIZI_ADMISSION_RESOLVED_RECEIPT");
 const material=readProjection();
 fail(material.unresolved_count===599&&material.eligible_count===1&&
   material.conflict_count===0&&material.input_sha256!==original.input_sha256,
   "STOP_MIZIZI_ADMISSION_RESOLVED_EXCLUSION");
 const coordinate=p=>({source_key:p.source_key,receipt_id:p.receipt_id,
   original_sha256:p.original_sha256,rank:p.rank});
 const groups=material.investigation_positions.map(p=>({
   disposition:p.disposition,positions:[coordinate(p)],
 }));
 // Join two exact positions across distinct sources, not same-source duplicates.
 const appleIndex=groups.findIndex(g=>g.positions[0].source_key==="apple_ke"&&g.positions[0].rank===1);
 const youtubeIndex=groups.findIndex(g=>g.positions[0].source_key==="youtube_ke"&&g.positions[0].rank===1);
 const paired={disposition:"research",positions:[groups[appleIndex].positions[0],groups[youtubeIndex].positions[0]]};
 const workload=[paired,...groups.filter((_,i)=>i!==appleIndex&&i!==youtubeIndex)];
 const args={p_expected_input_sha256:material.input_sha256,p_groups:workload};
 const admission="admin_mizizi_admit_chart_candidates_v1";
 const proof=()=>sql(`select jsonb_build_object(
   'subjects',(select count(*) from mizizi_private.chart_candidate_subjects_v1),
   'positions',(select count(*) from mizizi_private.chart_candidate_positions_v1),
   'events',(select count(*) from mizizi_private.case_events),
   'artists',(select count(*) from public.registry_artists),
   'tracks',(select count(*) from public.registry_tracks),
   'links',(select count(*) from public.registry_track_provider_links),
   'grants',(select count(*) from platform_private.registry_execution_grants),
   'jobs',(select count(*) from platform_private.jobs),
   'reviews',(select count(*) from platform_private.charts2_observation_review_events_v1),
   'freezes',(select count(*) from platform_private.charts2_private_freezes_v1),
   'receipts',(select count(*) from platform_private.charts2_capture_receipts_v1))::text;`);
 const baseline=proof();
 fail(!!reviewer,"STOP_MIZIZI_ADMISSION_REVIEWER_FIXTURE");
 denied(await subscriber.rpc(admission,args),"42501","STOP_MIZIZI_ADMISSION_SUBSCRIBER");
 denied(await reviewer.rpc(admission,args),"42501","STOP_MIZIZI_ADMISSION_REVIEWER");
 denied(await first.user.rpc(admission,{...args,p_expected_input_sha256:original.input_sha256}),
   "PT409","STOP_MIZIZI_ADMISSION_STALE");
 denied(await first.user.rpc(admission,{...args,p_groups:workload.slice(0,-1)}),
   "22023","STOP_MIZIZI_ADMISSION_INCOMPLETE_ROLLBACK");
 const changed=JSON.parse(JSON.stringify(workload));
 changed[changed.length-1].positions[0].original_sha256="f".repeat(64);
 denied(await first.user.rpc(admission,{...args,p_groups:changed}),
   "PT409","STOP_MIZIZI_ADMISSION_TAMPERED_ROLLBACK");
 denied(await first.user.rpc(admission,{...args,p_groups:[...workload.slice(0,-1),workload[0]]}),
   "22023","STOP_MIZIZI_ADMISSION_DUPLICATE_ROLLBACK");
 denied(await first.user.rpc(admission,{...args,p_groups:[...workload,
   {disposition:"research",positions:[coordinate(shazam)]}]}),
   "PT409","STOP_MIZIZI_ADMISSION_RESOLVED_POSITION");
 fail(proof()===baseline,"STOP_MIZIZI_ADMISSION_DENIAL_CHANGED_DURABLE_STATE");
 const race=await Promise.all([
   first.user.rpc(admission,args),second.user.rpc(admission,args)
 ]);
 fail(race.every(r=>!r.error),"STOP_MIZIZI_ADMISSION_CONCURRENT_"+race.map(r=>r.error?.code??"OK").join("_"));
 const results=race.map(r=>r.data);
 fail(results.reduce((n,r)=>n+r.created,0)===598&&
   results.reduce((n,r)=>n+r.replayed,0)===598&&
   results.every(r=>r.position_count===599&&r.jobs_dispatched===0&&
     r.can_publish===false&&r.cases.length===598&&r.cases.every(c=>c.stage==="triage"&&c.revision===1)),
   "STOP_MIZIZI_ADMISSION_SINGLE_CREATION_RACE");
 const sortedIds=r=>r.cases.map(c=>c.case_id).sort().join(",");
 fail(sortedIds(results[0])===sortedIds(results[1]),"STOP_MIZIZI_ADMISSION_CONCURRENT_CASE_DIVERGENCE");
 const replayed=await accept(first.user,admission,{...args,p_groups:[...workload].reverse().map(g=>({
   ...g,positions:[...g.positions].reverse()
 }))},"STOP_MIZIZI_ADMISSION_ORDER_INDEPENDENT");
 fail(replayed.created===0&&replayed.replayed===598&&sortedIds(replayed)===sortedIds(results[0]),
   "STOP_MIZIZI_ADMISSION_REPLAY_CHANGED_IDENTITY");
 denied(await first.user.rpc(admission,{...args,p_groups:groups}),
   "PT409","STOP_MIZIZI_ADMISSION_OVERLAP");
 denied(await first.user.rpc("admin_mizizi_begin_case_research_v1",{
   p_case_id:replayed.cases[0].case_id,p_expected_revision:1,
   p_reason:"Do not dispatch a chart hypothesis via the old Registry review route."
 }),"23514","STOP_MIZIZI_ADMISSION_UNWIRED_RESEARCH");
 const afterAdmission=JSON.parse(proof()),beforeAdmission=JSON.parse(baseline);
 fail(afterAdmission.subjects===598&&afterAdmission.positions===599&&
   afterAdmission.events-beforeAdmission.events===598,
   "STOP_MIZIZI_ADMISSION_DURABLE_COUNTS");
 for(const key of ["artists","tracks","links","grants","jobs","reviews","freezes","receipts"])
   fail(afterAdmission[key]===beforeAdmission[key],"STOP_MIZIZI_ADMISSION_SIDE_EFFECT_"+key);
 fail(sql(`select count(*) from mizizi_private.chart_candidate_subjects_v1 s
   join mizizi_private.cases c on c.id=s.case_id and c.workspace_id=s.workspace_id
   join mizizi_private.case_events e on e.case_id=c.id and e.case_revision=1
   where c.subject_id=s.case_id and c.subject_type='recording' and c.current_stage='triage'
     and c.mutation_state='not_planned' and c.case_state='open' and c.revision=1
     and e.actor_key='user:'||s.admitted_by::text and e.event_type='case_created'
     and s.member_count=(select count(*) from mizizi_private.chart_candidate_positions_v1 p where p.case_id=s.case_id);`)==="598",
   "STOP_MIZIZI_ADMISSION_JOURNAL_OR_MEMBERSHIP");
 fail(readProjection().input_sha256===material.input_sha256,
   "STOP_MIZIZI_ADMISSION_SCORING_CHANGED");
 console.log("WK_AUTH_MIZIZI_CHART_CANDIDATES_FULL_PARTITION_CONCURRENT_IDEMPOTENT_NO_REGISTRY_WRITE=PASS");

 // Real human transition is separate from the narrow shared job broker.
 // Queue admission below uses local SET SESSION AUTHORIZATION simulation,
 // not a claim of genuine hosted JIT connectivity or provider research.
 const chartReason="Investigate receipt-bound chart recording identity.";
 const transition="admin_mizizi_begin_chart_case_research_v1";
 const ack="I authorize read-only investigation of this chart recording hypothesis.";
 const pairedId=sql("select case_id from mizizi_private.chart_candidate_subjects_v1 where member_count=2;");
 const staleId=sql("select case_id from mizizi_private.chart_candidate_positions_v1 where source_key='shazam_ke' and rank=2;");
 const ws=sql("select workspace_id from mizizi_private.chart_candidate_subjects_v1 where case_id='"+pairedId+"';");
 fail([pairedId,staleId,ws].every(v=>UUID.test(v))&&pairedId!==staleId,"STOP_CHART_DISPATCH_FIXTURE_BINDING");
 const transitionArgs={p_case_id:pairedId,p_expected_revision:1,
   p_expected_input_sha256:material.input_sha256,p_acknowledgement:ack};
 denied(await subscriber.rpc(transition,transitionArgs),"42501","STOP_CHART_DISPATCH_SUBSCRIBER");
 denied(await reviewer.rpc(transition,transitionArgs),"42501","STOP_CHART_DISPATCH_REVIEWER");
 denied(await first.user.rpc(transition,{...transitionArgs,p_acknowledgement:"yes"}),
   "22023","STOP_CHART_DISPATCH_MISSING_CONSENT");
 denied(await first.user.rpc(transition,{...transitionArgs,p_expected_input_sha256:original.input_sha256}),
   "PT409","STOP_CHART_DISPATCH_STALE_SNAPSHOT");
 fail(JSON.stringify(JSON.parse(proof()))===JSON.stringify(afterAdmission),
   "STOP_CHART_DISPATCH_DENIAL_CHANGED_STATE");
 const jobArgs=(id,rev,reason=chartReason,key="mizizi.case_research_v1."+id+"."+rev)=>{
   const hash=createHash("sha256").update([id,ws,String(rev),"read_only_research",reason].join("\n")).digest("hex");
   return "'"+id+"'::uuid,'"+ws+"'::uuid,"+rev+",'system:mizizi','"+key+"','"+hash+"','"+reason+"'";
 };
 const denyJit=(args,code,prefix="")=>sql(`begin;
 ${prefix}
 set session authorization mizizi_executor;
 do $deny$ begin
   begin
     perform * from mizizi_private.admit_case_research_job_v1(${args});
     raise exception 'Unexpected chart dispatch success';
   exception when sqlstate '${code}' then null;end;
 end $deny$;
 rollback;`);
 denyJit(jobArgs(pairedId,1),"55000");
 const transitionRace=await Promise.all([
   first.user.rpc(transition,transitionArgs),second.user.rpc(transition,transitionArgs),
 ]);
 const winners=transitionRace.map((v,i)=>({v,i})).filter(x=>!x.v.error);
 fail(winners.length===1&&transitionRace.filter(x=>x.error?.code==="PT409").length===1,
   "STOP_CHART_DISPATCH_TRANSITION_CAS");
 const winner=winners[0].i===0?first:second;
 const transitionReceipt=winners[0].v.data;
 fail(transitionReceipt.caseId===pairedId&&transitionReceipt.workspaceId===ws&&transitionReceipt.revision===2&&
   transitionReceipt.stage==="research"&&transitionReceipt.state==="in_progress"&&transitionReceipt.researchReason===chartReason&&
   transitionReceipt.jobsDispatched===0&&transitionReceipt.canPublish===false,"STOP_CHART_DISPATCH_TRANSITION_RECEIPT");
 fail(sql("select count(*) from mizizi_private.case_events where case_id='"+pairedId+
   "' and case_revision=2 and actor_key='user:"+winner.id+"';")==="1",
   "STOP_CHART_DISPATCH_HUMAN_JOURNAL");
 denyJit(jobArgs(pairedId,2,"PUBLIC_CC0_RESEARCH: Arbitrary caller supplied research question"),"42501");
 denyJit(jobArgs(pairedId,2,chartReason,"wrong-idempotency-key"),"42501");
 denyJit(jobArgs(pairedId,2),"42501",
   "update public.user_role_assignments set expires_at=now()-interval '1 second' where user_id='"+winner.id+"';");
 const admitChartJob=(id)=>JSON.parse(sql(`set session authorization mizizi_executor;
 select row_to_json(j)::text from mizizi_private.admit_case_research_job_v1(${jobArgs(id,2)}) j;
 reset session authorization;`));
 const job=admitChartJob(pairedId),sameJob=admitChartJob(pairedId);
 fail(job.case_id===pairedId&&job.workspace_id===ws&&job.resource_id===pairedId&&
   job.case_revision===2&&job.job_status==="queued"&&job.outcome==="created"&&
   sameJob.outcome==="replayed"&&sameJob.job_id===job.job_id&&
   sameJob.command_receipt_id===job.command_receipt_id,"STOP_CHART_DISPATCH_EXACT_JOB_REPLAY");
 fail(sql("select count(*) from platform_private.jobs where id='"+job.job_id+
   "' and attempt_count=0 and max_attempts=25 and status='queued';")==="1",
   "STOP_CHART_DISPATCH_RETRY_BUDGET");
 sql(`begin;
 set session authorization service_role;
 do $claim$ begin
   perform set_config('request.jwt.claim.role','service_role',true);
   if exists(select 1 from public.mizizi_claim_case_research_jobs_v1('wk-chart-legacy-claim',10,300) where job_id='${job.job_id}')
    or exists(select 1 from platform_private.claim_jobs('wk-chart-general-claim',100,300) where job_id='${job.job_id}')
   then raise exception 'Unscoped worker consumed chart research';end if;
 end $claim$;
 rollback;`);
 const afterDispatch=JSON.parse(proof());
 fail(afterDispatch.jobs===afterAdmission.jobs+1&&afterDispatch.events===afterAdmission.events+1,
   "STOP_CHART_DISPATCH_JOB_AND_EVENT_COUNT");
 for(const key of ["subjects","positions","artists","tracks","links","grants","reviews","freezes","receipts"])
   fail(afterDispatch[key]===afterAdmission[key],"STOP_CHART_DISPATCH_SIDE_EFFECT_"+key);

 // A case whose exact member resolves after its human transition must never
 // queue via the JIT broker. Changes elsewhere do not stale the paired case.
 const staleMember=material.investigation_positions.find(p=>p.source_key==="shazam_ke"&&p.rank===2);
 const staleTransition=await accept(first.user,transition,{...transitionArgs,p_case_id:staleId},
   "STOP_CHART_DISPATCH_STALE_MEMBER_TRANSITION");
 fail(staleTransition.revision===2,"STOP_CHART_DISPATCH_STALE_MEMBER_REVISION");
 await accept(first.user,"admin_review_charts2_no_id_observation_v1",{
   p_receipt_id:staleMember.receipt_id,p_original_sha256:staleMember.original_sha256,p_rank:2,
   p_action:"approve",p_track_id:recoveryId,p_review_note:note,
   p_evidence_url:"https://example.org/ci-dispatch-stale-member",
   p_expected_previous_event_id:null,p_acknowledgement:approval,
 },"STOP_CHART_DISPATCH_RESOLVED_MEMBER_FIXTURE");
 fail(!readProjection().investigation_positions.some(p=>p.receipt_id===staleMember.receipt_id&&p.rank===2),
   "STOP_CHART_DISPATCH_MEMBER_NOT_RESOLVED");
 denyJit(jobArgs(staleId,2),"PT409");
 const afterUnrelatedResolution=admitChartJob(pairedId);
 fail(afterUnrelatedResolution.outcome==="replayed"&&afterUnrelatedResolution.job_id===job.job_id,
   "STOP_CHART_DISPATCH_UNRELATED_REVIEW_INVALIDATED_JOB");
 fail(sql("select count(*) from platform_private.jobs where resource_id='"+staleId+"';")==="0",
   "STOP_CHART_DISPATCH_STALE_MEMBER_JOB_CREATED");
 console.log("WK_AUTH_MIZIZI_CHART_RESEARCH_STEWARD_CAS_JIT_REPLAY_STALE_AND_LEGACY_CLAIM_FENCE=PASS");

 // Actual disposable service JWT/PostgREST, not real Storage bytes or providers.
 {
 const workerBaseline=JSON.parse(proof());
 fail(typeof service?.rpc==="function","STOP_CHART_SCOPED_SERVICE_CLIENT");
 const claimName="mizizi_claim_exact_chart_research_job_v1",
  recoverName="mizizi_recover_expired_chart_research_job_v1",
  contextName="mizizi_read_leased_chart_research_context_v1";
 const workerA="mizizi-chart:"+randomUUID(),workerB="mizizi-chart:"+randomUUID();
 const scope={p_job_id:job.job_id,p_case_id:pairedId,p_workspace_id:ws,p_expected_revision:2};
 const claimArgs={...scope,p_worker_id:workerA,p_lease_seconds:300};
 const contextArgs={p_job_id:job.job_id,p_worker_id:workerA};
 const call=(name,args)=>accept(service,name,args,"STOP_CHART_SCOPED_"+name);
 const deny=async(name,args,code)=>denied(await service.rpc(name,args),code,"STOP_CHART_SCOPED_"+name);
 for(const [name,args] of [[claimName,claimArgs],[recoverName,{...scope,p_retry_delay_seconds:1}],
   [contextName,contextArgs]])
  denied(await first.user.rpc(name,args),"42501","STOP_CHART_SCOPED_BROWSER_"+name);
 await deny(claimName,{...claimArgs,p_worker_id:"legacy-worker"},"22023");
 await deny(contextName,contextArgs,"55000");
 for(const patch of [{p_case_id:staleId},{p_workspace_id:randomUUID()},{p_expected_revision:1},{p_job_id:randomUUID()}])
  fail((await call(claimName,{...claimArgs,...patch})).length===0,"STOP_CHART_SCOPED_CROSS_JOB_CLAIM");
 fail(sql("select attempt_count::text from platform_private.jobs where id='"+job.job_id+"';")==="0",
  "STOP_CHART_SCOPED_WRONG_SCOPE_INCREMENT");
 const race=await Promise.all([service.rpc(claimName,claimArgs),
   service.rpc(claimName,{...claimArgs,p_worker_id:workerB})]);
 fail(race.every(x=>!x.error&&Array.isArray(x.data))&&
   race[0].data.length+race[1].data.length===1,"STOP_CHART_SCOPED_CLAIM_RACE");
 const activeWorker=race[0].data.length===1?workerA:workerB;
 const losingWorker=activeWorker===workerA?workerB:workerA;
 const leased=race.find(x=>x.data.length===1).data[0];
 fail(leased.job_id===job.job_id&&leased.command_receipt_id===job.command_receipt_id&&
   leased.resource_id===pairedId&&leased.attempt_count===1&&leased.max_attempts===25,
   "STOP_CHART_SCOPED_LEASE_RECEIPT");
 const activeContext={p_job_id:job.job_id,p_worker_id:activeWorker};
 await deny(contextName,{...activeContext,p_worker_id:losingWorker},"55000");
 const context=await call(contextName,activeContext);
 fail(context.contract==="mizizi.charts.research_context.v1"&&context.jobId===job.job_id&&
   context.receiptId===job.command_receipt_id&&context.caseId===pairedId&&context.workspaceId===ws&&
   context.expectedRevision===2&&Date.parse(context.leaseExpiresAt)===Date.parse(leased.lease_expires_at)&&
   context.positions.length===2&&context.publicSourceSearchApproved===false&&
   context.externalModelProcessingAllowed===false,"STOP_CHART_SCOPED_CONTEXT_AUTHORITY");
 const binding=JSON.parse(sql("select jsonb_build_object('membership',membership_sha256,'observation',observation_sha256)::text "+
   "from mizizi_private.chart_candidate_subjects_v1 where case_id='"+pairedId+"';"));
 fail(context.membershipSha256===binding.membership&&context.observationSha256===binding.observation&&
  context.positions.every(p=>{
   const observed=material.investigation_positions.find(o=>o.receipt_id===p.receipt_id&&o.rank===p.rank);
   const extension=p.original_content_type==="application/json"?".json":".html";
   return observed&&p.title===observed.title&&p.artist===observed.artist&&
     p.provider_track_id===observed.provider_track_id&&p.original_sha256===observed.original_sha256&&
     p.original_bucket==="charts2-evidence-private-v1"&&p.original_byte_length===1024&&
     p.original_object_key===p.source_key+"/"+p.original_sha256.slice(0,2)+"/"+p.original_sha256+extension;
  }),"STOP_CHART_SCOPED_ORIGINAL_CONTEXT");
 const passBody=JSON.stringify({contract:"mizizi.adaptive_investigation.v1",caseId:pairedId,
  workspaceId:ws,ordinal:1,question:"Read-only local test of the exact chart lease.",
  predecessorFingerprint:null,sourceReceipts:[],findings:[],proposedLeads:[],
  decision:{action:"pause",nextQuestion:null},passFinding:"Synthetic local lease test, no evidence claimed."});
 const fingerprint=createHash("sha256").update(passBody).digest("hex");
 const passArgs={...activeContext,p_body_text:passBody,p_fingerprint:fingerprint,p_predecessor:null};
 const appendName="mizizi_append_research_pass_v1",readName="mizizi_read_research_passes_v1",
  completeName="mizizi_complete_case_research_job_v1";
 const result={contract:"mizizi.read_only_research_result.v1",caseId:pairedId,
  status:"insufficient_evidence",sourceReferences:[]};
 await deny(appendName,{...passArgs,p_worker_id:losingWorker},"55000");
 const appended=await call(appendName,passArgs);
 fail(appended.length===1&&appended[0].case_id===pairedId&&appended[0].fingerprint===fingerprint&&
  appended[0].outcome==="created","STOP_CHART_SCOPED_APPEND_RECEIPT");
 const stored=await call(readName,activeContext);
 fail(stored.length===1&&stored[0].body_text===passBody&&stored[0].fingerprint===fingerprint,"STOP_CHART_SCOPED_PASS_BYTES");
 // Expire only the disposable fixture. Legacy recovery must leave it alone.
 sql("update platform_private.jobs set locked_at=now()-interval '2 minutes',lease_expires_at=now()-interval '1 minute' where id='"+job.job_id+"';");
 await deny(contextName,activeContext,"55000");
 await deny(completeName,{...activeContext,p_result:result},"55000");
 await call("mizizi_recover_expired_case_research_jobs_v1",{p_limit:100,p_retry_delay_seconds:1});
 fail(sql("select status from platform_private.jobs where id='"+job.job_id+"';")==="running","STOP_CHART_SCOPED_LEGACY_RECOVERED");
 fail(await call(recoverName,{...scope,p_case_id:staleId,p_retry_delay_seconds:1})===0,"STOP_CHART_SCOPED_WRONG_RECOVER_MUTATION");
 fail(await call(recoverName,{...scope,p_retry_delay_seconds:1})===1,"STOP_CHART_SCOPED_RECOVERY_COUNT");
 fail(await call(recoverName,{...scope,p_retry_delay_seconds:1})===0,"STOP_CHART_SCOPED_DOUBLE_RECOVERY");
 sql("update platform_private.jobs set available_at=now()-interval '1 second' where id='"+job.job_id+"';");
 const resumed=await call(claimName,{...claimArgs,p_worker_id:losingWorker});
 fail(resumed.length===1&&resumed[0].attempt_count===2,"STOP_CHART_SCOPED_RESUME_RECEIPT");
 const resumedContext={p_job_id:job.job_id,p_worker_id:losingWorker};
 await deny(contextName,activeContext,"55000");
 const history=await call(readName,resumedContext);
 fail(history.length===1&&history[0].fingerprint===fingerprint,"STOP_CHART_SCOPED_HISTORY_LOST");
 sql("update public.user_role_assignments set expires_at=now()-interval '1 second' where user_id='"+winner.id+"' and role_key='administrator';");
 await deny(contextName,resumedContext,"42501");
 await deny(readName,resumedContext,"42501");
 await deny(appendName,{...passArgs,p_worker_id:losingWorker},"42501");
 await deny(completeName,{...resumedContext,p_result:result},"42501");
 sql("update public.user_role_assignments set expires_at=now()+interval '10 minutes' where user_id='"+winner.id+"' and role_key='administrator';");
 const completed=await call(completeName,{...resumedContext,p_result:result});
 fail(completed.job_id===job.job_id&&completed.case_id===pairedId&&
  completed.command_receipt_id===job.command_receipt_id&&completed.job_status==="succeeded",
  "STOP_CHART_SCOPED_COMPLETE_RECEIPT");
 await deny(contextName,resumedContext,"55000");
 const afterWorker=JSON.parse(proof());
 for(const key of ["subjects","positions","artists","tracks","links","grants","reviews","freezes","receipts"])
  fail(afterWorker[key]===workerBaseline[key],"STOP_CHART_SCOPED_SIDE_EFFECT_"+key);
 console.log("WK_AUTH_MIZIZI_CHART_EXACT_LEASE_CONTEXT_RECOVERY_PERSISTENCE_NO_DISCLOSURE=PASS");
 }



}

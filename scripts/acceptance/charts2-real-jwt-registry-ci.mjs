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
 // Durable desk-search budget: actual service JWTs and concurrent SQL
 // transactions; synthetic owner policy/credential, no external calls.
 {
 const authorizeName="mizizi_authorize_desk_search_v1",reserveName="mizizi_reserve_desk_search_v1",
  consumeName="mizizi_consume_desk_search_v1";
 const account=createHash("sha256").update("mizizi:brave:credential:v1:fixture-only-credential").digest("hex");
 const position=context.positions[0];
 const search=(patch={},scopePatch={})=>{
  const body=JSON.stringify({scope:{jobId:job.job_id,caseId:pairedId,workspaceId:ws,
   expectedRevision:2,workerId:activeWorker,leaseExpiresAt:context.leaseExpiresAt,...scopePatch},
   operation:"search_web",query:position.title,count:3,...patch});
  return {p_request_text:body,p_request_sha256:createHash("sha256").update(body).digest("hex"),
   p_account_fingerprint:account};
 };
 const req=search(),policyRef="desk-search:brave:1";
 const reserve=(params)=>({...params,p_policy_ref:policyRef});
 fail(await call(authorizeName,req)===null&&await call(reserveName,reserve(req))===null,
   "STOP_DESK_NO_DEFAULT_POLICY");
 for(const [name,args] of [[authorizeName,req],[reserveName,reserve(req)],
   [consumeName,{p_reservation_id:randomUUID(),p_request_sha256:req.p_request_sha256,p_account_fingerprint:account}]]){
  denied(await first.user.rpc(name,args),"42501","STOP_DESK_BROWSER_"+name);
  denied(await subscriber.rpc(name,args),"42501","STOP_DESK_SUBSCRIBER_"+name);
 }
 fail(sql("select count(*) from mizizi_private.desk_search_reservations_v1;")==="0","STOP_DESK_DEFAULT_CHARGE");
 // Only the disposable database owner issues this fixture policy. No enabled
 // policy or account entitlement is seeded in the migration.
 sql(`insert into mizizi_private.desk_search_policy_versions_v1(
  revision,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
  disclosure_policy_ref,commercial_search_allowed,zero_cost_hard_cap_verified,
  exclusive_allocated_usage_verified,public_chart_labels_allowed,allowance_start,
  allowance_end,valid_until,account_limit,daily_limit,case_limit)
 values(1,true,'${ws}','${account}','fixture:entitlement','fixture:hard-cap',
  'fixture:chart-labels',true,true,true,true,now()-interval '1 hour',
  now()+interval '1 hour',now()+interval '10 minutes',2,2,2);`);
 const auth=await call(authorizeName,req);
 fail(auth?.requestSha256===req.p_request_sha256&&auth.policyRef===policyRef&&
   auth.publicQueryAllowed===true&&auth.zeroIncrementalSpendAllowed===true&&
   !Object.hasOwn(auth,"membershipSha256"),"STOP_DESK_POLICY_RECEIPT");
 fail(await call(authorizeName,{...req,p_account_fingerprint:"f".repeat(64)})===null&&
  await call(authorizeName,search({query:"Private case notes not in public chart labels"}))===null&&
  await call(authorizeName,search({}, {caseId:staleId}))===null&&
  await call(authorizeName,search({}, {expectedRevision:1}))===null&&
  await call(reserveName,{...reserve(req),p_policy_ref:"desk-search:brave:999"})===null,
  "STOP_DESK_POLICY_OR_SCOPE_BYPASS");
 await deny(authorizeName,{...req,p_request_sha256:"f".repeat(64)},"22023");
 await deny(authorizeName,search({}, {workerId:losingWorker}),"55000");
 const duplicate=await Promise.all([service.rpc(reserveName,reserve(req)),service.rpc(reserveName,reserve(req))]);
 fail(duplicate.every(x=>!x.error)&&duplicate.filter(x=>x.data!==null).length===1,"STOP_DESK_DUPLICATE_RESERVATION_RACE");
 const charged=duplicate.find(x=>x.data!==null).data;
 fail(UUID.test(charged.reservationId)&&charged.requestSha256===req.p_request_sha256&&
  charged.units===1&&charged.maximumIncrementalCostMicrousd===0&&charged.provider==="brave",
  "STOP_DESK_RESERVATION_RECEIPT");
 const secondReq=search({operation:"search_news"}),thirdReq=search({count:4});
 const lastSlot=await Promise.all([service.rpc(reserveName,reserve(secondReq)),service.rpc(reserveName,reserve(thirdReq))]);
 fail(lastSlot.every(x=>!x.error)&&lastSlot.filter(x=>x.data!==null).length===1&&
  sql("select count(*) from mizizi_private.desk_search_reservations_v1;")==="2","STOP_DESK_SHARED_LAST_SLOT_RACE");
 const secondCharge=lastSlot.find(x=>x.data!==null).data;
 const consumeArgs={p_reservation_id:charged.reservationId,p_request_sha256:charged.requestSha256,p_account_fingerprint:account};
 fail(await call(consumeName,{...consumeArgs,p_account_fingerprint:"e".repeat(64)})===false&&
  await call(consumeName,{...consumeArgs,p_request_sha256:"f".repeat(64)})===false,"STOP_DESK_CONSUME_SCOPE");
 const consumeRace=await Promise.all([service.rpc(consumeName,consumeArgs),service.rpc(consumeName,consumeArgs)]);
 fail(consumeRace.every(x=>!x.error)&&consumeRace.filter(x=>x.data===true).length===1&&
  consumeRace.filter(x=>x.data===false).length===1,"STOP_DESK_SINGLE_USE_CONSUME_RACE");
 fail(await call(reserveName,reserve(search({count:5})))===null&&
  sql("select count(*) from mizizi_private.desk_search_reservations_v1 where consumed_at is null;")==="1",
  "STOP_DESK_UNUSED_RESERVATION_REFUND_OR_CAP");
 // Policy window shift cannot restore capacity. Revocation is append-only;
 // the still-reserved second slot must remain charged and unusable.
 sql(`do $desk$ begin
  begin
   insert into mizizi_private.desk_search_policy_versions_v1(
    revision,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
    disclosure_policy_ref,commercial_search_allowed,zero_cost_hard_cap_verified,
    exclusive_allocated_usage_verified,public_chart_labels_allowed,allowance_start,
    allowance_end,valid_until,account_limit,daily_limit,case_limit)
   select 2,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
    disclosure_policy_ref,commercial_search_allowed,zero_cost_hard_cap_verified,
    exclusive_allocated_usage_verified,public_chart_labels_allowed,allowance_start+interval '1 second',
    allowance_end,valid_until,account_limit,daily_limit,case_limit
   from mizizi_private.desk_search_policy_versions_v1 where revision=1;
   raise exception 'Unexpected quota window reset';
  exception when sqlstate 'PT409' then null;end;
  begin
   update mizizi_private.desk_search_reservations_v1 set consumed_at=null where consumed_at is not null;
   raise exception 'Unexpected refund';exception when sqlstate '55000' then null;end;
 end $desk$;`);
 sql(`insert into mizizi_private.desk_search_policy_versions_v1(
  revision,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
  disclosure_policy_ref,commercial_search_allowed,zero_cost_hard_cap_verified,
  exclusive_allocated_usage_verified,public_chart_labels_allowed,allowance_start,
  allowance_end,valid_until,account_limit,daily_limit,case_limit)
 select 2,false,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
  disclosure_policy_ref,commercial_search_allowed,zero_cost_hard_cap_verified,
  exclusive_allocated_usage_verified,public_chart_labels_allowed,allowance_start,
  allowance_end,valid_until,account_limit,daily_limit,case_limit
 from mizizi_private.desk_search_policy_versions_v1 where revision=1;`);
 fail(await call(authorizeName,req)===null&&await call(consumeName,{
  p_reservation_id:secondCharge.reservationId,p_request_sha256:secondCharge.requestSha256,p_account_fingerprint:account})===false&&
  sql("select count(*) from mizizi_private.desk_search_reservations_v1;")==="2",
  "STOP_DESK_REVOCATION_OR_REFUND");
 fail(sql("select (not has_table_privilege('service_role','mizizi_private.desk_search_policy_versions_v1','INSERT') "+
  "and not has_table_privilege('service_role','mizizi_private.desk_search_reservations_v1','UPDATE') "+
  "and not has_table_privilege('authenticated','mizizi_private.desk_search_reservations_v1','SELECT'))::text;")==="true",
  "STOP_DESK_PRIVATE_LEDGER_ACL");
 console.log("WK_AUTH_MIZIZI_DESK_ZERO_COST_POLICY_RESERVATION_CONSUME_RACES_REVOCATION=PASS");
 }
 // Shared paid inference and zero-cost acquisition capacity. Disposable
 // owner-issued fixture only; this is budget proof, not disclosure authority.
 {
 const quoteName="mizizi_quote_desk_resource_v1",reserveName="mizizi_reserve_desk_resource_v1",
  consumeName="mizizi_consume_desk_resource_v1",eventName="mizizi_record_desk_resource_event_v1";
 const account="d".repeat(64);
 const descriptor=(resource,label,patch={})=>({p_binding_text:JSON.stringify({
  scope:{jobId:job.job_id,caseId:pairedId,workspaceId:ws,expectedRevision:2,
   workerId:activeWorker,leaseExpiresAt:context.leaseExpiresAt},
  resource,requestSha256:createHash("sha256").update(label).digest("hex"),
  accountFingerprint:account,model:resource==="anthropic"?"fixture-haiku":null,...patch})});
 const firstReq=descriptor("anthropic","fixture-model-1");
 fail(await call(quoteName,firstReq)===null,"STOP_RESOURCE_DEFAULT_ENABLED");
 for(const [name,args] of [[quoteName,firstReq],[reserveName,{...firstReq,p_policy_revision:1,p_expected_units:1750}],
  [consumeName,{p_reservation_id:randomUUID(),p_request_sha256:"a".repeat(64),p_account_fingerprint:account}],
  [eventName,{p_reservation_id:randomUUID(),p_request_sha256:"a".repeat(64),p_account_fingerprint:account,p_state:"send_pending",p_detail:{}}]]){
  denied(await first.user.rpc(name,args),"42501","STOP_RESOURCE_BROWSER_"+name);
  denied(await subscriber.rpc(name,args),"42501","STOP_RESOURCE_SUBSCRIBER_"+name);
 }
 sql(`insert into mizizi_private.desk_resource_policy_versions_v1(
  resource,revision,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
  exclusive_allocation_verified,capacity_ceiling_verified,paid_inference_authorized,zero_incremental_cost_verified,
  allowance_start,allowance_end,valid_until,account_limit,daily_limit,case_limit,model_tariffs)
 select v.resource,1,true,'${ws}','${account}','fixture:entitlement','fixture:capacity',
  true,true,v.resource='anthropic',v.resource<>'anthropic',now()-interval '1 hour',now()+interval '1 hour',
  now()+interval '10 minutes',v.cap,v.cap,v.cap,v.tariffs
 from (values ('anthropic',3500,'{"fixture-haiku":{"pricingRef":"pricing:fixture-haiku","maxInputTokens":5000,"maxOutputTokens":2500,"inputRate":100000,"outputRate":500000}}'::jsonb),
 ('native_https',2000000,'{}'::jsonb),('cloudflare_browser_run',240,'{}'::jsonb)) v(resource,cap,tariffs);`);
 const q=await call(quoteName,firstReq);
 fail(q.units===1750&&q.maximumCostMicrousd===1750&&q.maxInputTokens===5000&&q.maxOutputTokens===2500&&
  q.pricingRef==="pricing:fixture-haiku"&&q.bindingSha256===createHash("sha256").update(firstReq.p_binding_text).digest("hex")&&
  !Object.hasOwn(q,"modelDisclosureAllowed"),"STOP_RESOURCE_QUOTE_OR_DISCLOSURE");
 fail(await call(quoteName,descriptor("anthropic","wrong-model",{model:"fixture-opus"}))===null&&
  await call(quoteName,descriptor("anthropic","wrong-key",{accountFingerprint:"e".repeat(64)}))===null&&
  await call(reserveName,{...firstReq,p_policy_revision:1,p_expected_units:1})===null,"STOP_RESOURCE_UNDERQUOTE_OR_CREDENTIAL");
 const reserve=(req,units)=>({...req,p_policy_revision:1,p_expected_units:units});
 const firstRace=await Promise.all([service.rpc(reserveName,reserve(firstReq,1750)),service.rpc(reserveName,reserve(firstReq,1750))]);
 fail(firstRace.every(x=>!x.error)&&firstRace.filter(x=>x.data!==null).length===1,"STOP_RESOURCE_DUPLICATE_RACE");
 const paid=firstRace.find(x=>x.data!==null).data;
 const finalRace=await Promise.all([service.rpc(reserveName,reserve(descriptor("anthropic","fixture-model-2"),1750)),
  service.rpc(reserveName,reserve(descriptor("anthropic","fixture-model-3"),1750))]);
 fail(finalRace.every(x=>!x.error)&&finalRace.filter(x=>x.data!==null).length===1,"STOP_RESOURCE_LAST_SLOT");
 const paid2=finalRace.find(x=>x.data!==null).data;
 const args=r=>({p_reservation_id:r.reservationId,p_request_sha256:r.requestSha256,p_account_fingerprint:account});
 const event=(r,state,detail={})=>call(eventName,{...args(r),p_state:state,p_detail:detail});
 fail(await event(paid,"send_pending")===false,"STOP_RESOURCE_EVENT_BEFORE_CONSUME");
 const consumeRace=await Promise.all([service.rpc(consumeName,args(paid)),service.rpc(consumeName,args(paid))]);
 fail(consumeRace.every(x=>!x.error)&&consumeRace.filter(x=>x.data===true).length===1&&
  consumeRace.filter(x=>x.data===false).length===1,"STOP_RESOURCE_CONSUME_RACE");
 fail(await event(paid,"send_pending")===true&&await event(paid,"send_pending")===true&&
  await event(paid,"response_metered",{inputTokens:5001,outputTokens:1,cacheCreationTokens:0,cacheReadTokens:0})===false&&
  await event(paid,"response_unconfirmed")===true&&
  await event(paid,"response_metered",{inputTokens:1,outputTokens:1,cacheCreationTokens:0,cacheReadTokens:0})===false&&
  await call(reserveName,reserve(descriptor("anthropic","fixture-model-4"),1750))===null,
  "STOP_RESOURCE_UNKNOWN_CHARGE_OR_EVENT");
 const nativeReq=descriptor("native_https","fixture-hop");
 const native=await call(reserveName,reserve(nativeReq,2000000));
 fail(native.units===2000000&&native.maximumCostMicrousd===0&&await call(consumeName,args(native))===true&&
  await call(reserveName,reserve(descriptor("native_https","fixture-hop-2"),2000000))===null,"STOP_RESOURCE_NATIVE_CAP");
 const browser=await call(reserveName,reserve(descriptor("cloudflare_browser_run","fixture-browser"),120));
 const browser2=await call(reserveName,reserve(descriptor("cloudflare_browser_run","fixture-browser-2"),120));
 fail(browser.units===120&&browser.maximumCostMicrousd===0&&await call(consumeName,args(browser))===true&&
  await event(browser,"open_pending")===true&&await event(browser,"opened",{sessionId:pairedId})===true&&
  await event(browser,"close_acknowledged",{sessionId:staleId})===false&&
  await event(browser,"cleanup_unconfirmed",{sessionId:pairedId})===true&&
  await call(reserveName,reserve(descriptor("cloudflare_browser_run","fixture-browser-3"),120))===null,
  "STOP_RESOURCE_BROWSER_LIFECYCLE");
 sql(`insert into mizizi_private.desk_resource_policy_versions_v1(
 resource,revision,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
 exclusive_allocation_verified,capacity_ceiling_verified,paid_inference_authorized,zero_incremental_cost_verified,
 allowance_start,allowance_end,valid_until,account_limit,daily_limit,case_limit,model_tariffs)
 select resource,2,false,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
 exclusive_allocation_verified,capacity_ceiling_verified,paid_inference_authorized,zero_incremental_cost_verified,
 allowance_start,allowance_end,valid_until,account_limit,daily_limit,case_limit,model_tariffs
 from mizizi_private.desk_resource_policy_versions_v1 where revision=1;`);
 fail(await call(consumeName,args(paid2))===false&&await call(consumeName,args(browser2))===false&&
  await call(quoteName,firstReq)===null&&
  sql("select count(*) from mizizi_private.desk_resource_reservations_v1;")==="5"&&
  sql("select count(*) from mizizi_private.desk_resource_events_v1;")==="5",
  "STOP_RESOURCE_REVOCATION_OR_HISTORY");
 fail(sql("select (not has_table_privilege('service_role','mizizi_private.desk_resource_policy_versions_v1','INSERT') "+
  "and not has_table_privilege('service_role','mizizi_private.desk_resource_reservations_v1','UPDATE') "+
  "and not has_table_privilege('authenticated','mizizi_private.desk_resource_events_v1','SELECT'))::text;")==="true",
  "STOP_RESOURCE_ACL");
 console.log("WK_AUTH_MIZIZI_DESK_SHARED_RESOURCE_PRECHARGE_MODEL_BROWSER_NATIVE=PASS");
 }
 // Private pre-canonical custody: actual service JWT and immutable DB
 // readback. Synthetic provider/permission fixtures, no live network.
 {
 const policyName="mizizi_read_desk_custody_policy_v1",appendName="mizizi_record_desk_tool_receipt_v1",
  readName="mizizi_read_desk_tool_receipt_v1",resolveName="mizizi_resolve_desk_reference_lead_v1";
 const scope={jobId:job.job_id,caseId:pairedId,workspaceId:ws,expectedRevision:2,
  workerId:activeWorker,leaseExpiresAt:context.leaseExpiresAt};
 const hash=s=>createHash("sha256").update(s).digest("hex");
 const searchHost="api.search.brave.com",host="archive.org",url="https://archive.org/details/fixture";
 const searchId=randomUUID(),leadId=randomUUID(),pageId=randomUUID(),nextLead=randomUUID();
 const htmlLead=randomUUID(),htmlUrl="https://archive.org/details/dynamic-fixture";
 const searchRequest=JSON.stringify({scope,operation:"search_web",query:context.positions[0].title,count:3});
 const requestSha256=hash(searchRequest);
 const reservationId=sql("select id from mizizi_private.desk_search_reservations_v1 where consumed_at is not null and request_sha256='"+requestSha256+"';");
 fail(UUID.test(reservationId),"STOP_CUSTODY_SEARCH_FIXTURE");
 const binding=(name,input,result,host,provenance,leads,revision=1)=>{
  const callText=JSON.stringify({scope,call:{name,input}}),resultText=JSON.stringify(result);
  return {p_call_text:callText,p_call_sha256:hash(callText),p_result_text:resultText,
   p_result_sha256:hash(resultText),p_host:host,p_policy_revision:revision,p_provenance:provenance,p_lead_bindings:leads};
 };
 const searchResult={receiptId:searchId,leads:[{id:leadId,kind:"reference",label:"Fixture archive"},
  {id:htmlLead,kind:"reference",label:"Dynamic archive"}],sources:[],visual:null};
 const searchArgs=binding("search_web",{query:context.positions[0].title},searchResult,searchHost,
  {reservationId,requestSha256,requestText:searchRequest},[{id:leadId,url},{id:htmlLead,url:htmlUrl}]);
 fail(await call(policyName,{p_scope:scope,p_host:searchHost})===null&&await call(appendName,searchArgs)===null,
  "STOP_CUSTODY_DEFAULT_ENABLED");
 for(const [name,args] of [[policyName,{p_scope:scope,p_host:host}],[appendName,searchArgs],
  [readName,{p_scope:scope,p_receipt_id:searchId}],[resolveName,{p_scope:scope,p_lead_id:leadId}]]){
  denied(await first.user.rpc(name,args),"42501","STOP_CUSTODY_BROWSER_"+name);
  denied(await subscriber.rpc(name,args),"42501","STOP_CUSTODY_SUBSCRIBER_"+name);
 }
 sql(`insert into mizizi_private.desk_custody_policy_versions_v1(
  workspace_id,host,revision,enabled,source_family,authority_ref,origin_key,lineage_key,use_basis,
  private_research_allowed,metadata_retention_allowed,excerpt_retention_allowed,external_model_processing_allowed,browser_render_allowed,visual_processing_allowed,valid_until)
 select '${ws}',v.host,1,true,v.family,'fixture:reviewed-rights','fixture:original-origin',
  'fixture:common-lineage','documented_contract',true,true,v.family='public_web',true,v.family='public_web',v.family='public_web',now()+interval '10 minutes'
 from (values ('api.search.brave.com','brave_discovery'),('archive.org','public_web')) v(host,family);`);
 const p=await call(policyName,{p_scope:scope,p_host:host});
 fail(p.host===host&&p.revision===1&&p.excerptRetentionAllowed===true&&p.externalModelProcessingAllowed===true,
  "STOP_CUSTODY_POLICY_RECEIPT");
 // Full standing-policy convergence in a rollback-only local transaction.
 // Reuse the exact case, consumed search/native reservations and real RPCs.
 // Synthetic source rights/bytes only: no live provider entitlement asserted.
 {
 const q=v=>"'"+String(v).replaceAll("'","''")+"'";
 const j=v=>q(JSON.stringify(v))+"::jsonb";
 const authority=(operation,binding)=>{
  const text=JSON.stringify(binding);
  return "public.mizizi_authorize_desk_model_operation_v1("+j(scope)+","+q(operation)+","+q(text)+","+q(hash(text))+")";
 };
 const access=(operation,binding)=>{
  const text=JSON.stringify(binding);
  return "public.mizizi_authorize_desk_access_v1("+j(scope)+","+q(operation)+","+q(text)+","+q(hash(text))+")";
 };
 const append=args=>"public.mizizi_record_desk_tool_receipt_v1("+[
  q(args.p_call_text),q(args.p_call_sha256),q(args.p_result_text),q(args.p_result_sha256),
  q(args.p_host),args.p_policy_revision,j(args.p_provenance),j(args.p_lead_bindings)].join(",")+")";
 const read=id=>"public.mizizi_read_desk_tool_receipt_v1("+j(scope)+","+q(id)+"::uuid)";
 const question="Fixture exact public research question",questionHash=hash(question),credential=hash("standing credential");
 const envelope=(round,sourceIds,toolReceipts,patch={})=>{
  const bodySha256=hash("standing fixture envelope "+round);
  return {scope,model:"fixture-haiku",round,requestSha256:hash(JSON.stringify({scope,round,credentialSha256:credential,bodySha256})),
   bodySha256,credentialSha256:credential,requestBytes:128,maxOutputTokens:2500,sourceIds,toolReceipts,questionSha256:questionHash,...patch};
 };
 const searchCall=JSON.parse(searchArgs.p_call_text),readCall={scope,call:{name:"read_page",input:{lead_id:leadId}}};
 const readHash=hash(JSON.stringify(readCall)),hopHash=hash("fixture-hop"),sourceHash=hash("standing native bytes");
 const observedAt=new Date().toISOString(),standingPageId=randomUUID();
 const standingSource={sourceId:standingPageId,caseId:pairedId,workspaceId:ws,originKey:p.originKey,lineageKey:p.lineageKey,
  fingerprint:sourceHash,authorityRef:p.authorityRef,useBasis:p.useBasis,observedAt,expiresAt:p.validUntil,revokedAt:null,
  privateResearchAllowed:true,externalModelProcessingAllowed:true,privateEvidenceRetentionAllowed:true};
 const standingExcerpt={source:standingSource,excerpt:"Synthetic standing source, no live acquisition.",citation:url+"#plain_text"};
 const standingPage=binding("read_page",{lead_id:leadId},{receiptId:standingPageId,leads:[],sources:[standingExcerpt],visual:null},host,
  {requestedUrl:url,finalUrl:url,sourceSha256:sourceHash,projectionSha256:hash("standing projection"),
   contentType:"text/plain",retrievedAt:observedAt,byteLength:22,hopSha256:[hopHash],locator:"plain_text",documentPages:null,renderRequired:false},[]);
 const grantNative=access("native_acquire",{url,descriptor:{},callSha256:readHash,hopSha256:hopHash});
 const grantText=access("native_text",{url,descriptor:{finalUrl:url,sha256:sourceHash,representation:"native_response_bytes",pageStart:1,pageEnd:10},callSha256:readHash});
 const deps=[{receiptId:searchId,callSha256:searchArgs.p_call_sha256,resultSha256:searchArgs.p_result_sha256},
  {receiptId:standingPageId,callSha256:standingPage.p_call_sha256,resultSha256:standingPage.p_result_sha256}];
 const journalRef={sourceId:standingPageId,originKey:standingSource.originKey,lineageKey:standingSource.lineageKey,
  payloadFingerprint:sourceHash,useBasis:standingSource.useBasis,authorityRef:standingSource.authorityRef,observedAt,
  citation:standingExcerpt.citation,excerpt:standingExcerpt.excerpt,modelDisclosed:true};
 const journal=toolDeps=>{
  const body=JSON.stringify({contract:"mizizi.adaptive_investigation.v1",caseId:pairedId,workspaceId:ws,ordinal:1,
   question,predecessorFingerprint:null,sourceReceipts:[journalRef],deskToolReceipts:toolDeps,findings:[],proposedLeads:[],
   decision:{action:"pause",nextQuestion:null},passFinding:"Synthetic native operational evidence."});
  return "public.mizizi_append_research_pass_v1("+q(job.job_id)+"::uuid,"+q(activeWorker)+","+q(body)+","+q(hash(body))+",null)";
 };
 const journalRead="public.mizizi_read_research_passes_v1("+q(job.job_id)+"::uuid,"+q(activeWorker)+")";
 const rules=[{host,pathPrefix:"/details/",custodyRevision:1,operations:["native_acquire","native_text"]}];
 fail(sql(`begin;
 insert into mizizi_private.desk_operational_policy_versions_v1(workspace_id,case_id,revision,expected_revision,
 membership_sha256,observation_sha256,enabled,authority_ref,credential_sha256,model_ids,question_sha256s,tool_names,
 max_rounds,max_request_bytes,access_rules,valid_until)
 values (${q(ws)},${q(pairedId)},1,2,${q(context.membershipSha256)},${q(context.observationSha256)},true,
 'fixture:standing-owner-review',${q(credential)},array['fixture-haiku'],array[${q(questionHash)}],
 array['search_web','read_page'],5,10000,${j(rules)},now()+interval '5 minutes');
 set local role service_role;
 set local request.jwt.claim.role='service_role';
 do $standing$ begin
 if (public.mizizi_read_desk_operational_policy_v1(${j(scope)})->>'revision') is distinct from '1'
 or (${authority("model_disclose",envelope(1,[],[]))}->>'allowed') is distinct from 'true'
 or ${authority("model_disclose",envelope(1,[],[],{model:"fixture-opus"}))} is not null
 or ${authority("model_disclose",envelope(1,[],[],{questionSha256:hash("unapproved question")}))} is not null
 or ${authority("tool_execute",{scope,call:{name:"search_web",input:{query:"unapproved private question"}}})} is not null
 or ${authority("tool_execute",{scope,call:{name:"search_news",input:{query:context.positions[0].title}}})} is not null
 then raise exception 'STOP_STANDING_MODEL_OR_TOOL_SCOPE';end if;
 if ${append(searchArgs)} is not null then raise exception 'STOP_STANDING_UNAUTHORIZED_TOOL_ADMITTED';end if;
 if (${authority("tool_execute",searchCall)}->>'allowed') is distinct from 'true' then raise exception 'STOP_STANDING_SEARCH_GRANT';end if;
 if (${append(searchArgs)}->>'outcome') is distinct from 'created' then raise exception 'STOP_STANDING_SEARCH_ADMISSION';end if;
 if (${authority("tool_execute",readCall)}->>'allowed') is distinct from 'true' then raise exception 'STOP_STANDING_DYNAMIC_LEAD';end if;
 if ${access("native_acquire",{url:"https://archive.org/unreviewed/fixture",descriptor:{},callSha256:readHash,hopSha256:hopHash})} is not null
 or ${access("native_acquire",{url,descriptor:{},callSha256:hash("other call"),hopSha256:hopHash})} is not null
 or ${append(standingPage)} is not null then raise exception 'STOP_STANDING_ACCESS_DEFAULT_DENY';end if;
 if (${grantNative}->>'allowed') is distinct from 'true' then raise exception 'STOP_STANDING_NATIVE_GRANT';end if;
 if ${append(standingPage)} is not null then raise exception 'STOP_STANDING_MISSING_EXAMINATION';end if;
 if (${grantText}->>'allowed') is distinct from 'true' then raise exception 'STOP_STANDING_EXAMINATION_GRANT';end if;
 if (${append(standingPage)}->>'outcome') is distinct from 'created' then raise exception 'STOP_STANDING_NATIVE_ADMISSION';end if;
 if (${authority("model_disclose",envelope(3,[standingPageId],deps))}->>'allowed') is distinct from 'true'
 then raise exception 'STOP_STANDING_DYNAMIC_MODEL_TRANSCRIPT';end if;
 begin perform * from ${journal([deps[1]])};raise exception 'STOP_STANDING_OMITTED_DISCOVERY';
 exception when sqlstate '42501' then null;end;
 if (select outcome from ${journal(deps)}) is distinct from 'created' then raise exception 'STOP_STANDING_JOURNAL';end if;
 if (select count(*) from ${journalRead})<>1 then raise exception 'STOP_STANDING_JOURNAL_READ';end if;
 end $standing$;
 reset role;
 insert into mizizi_private.desk_operational_policy_versions_v1(workspace_id,case_id,revision,expected_revision,
 membership_sha256,observation_sha256,enabled,authority_ref,credential_sha256,model_ids,question_sha256s,tool_names,
 max_rounds,max_request_bytes,access_rules,valid_until)
 select workspace_id,case_id,2,expected_revision,membership_sha256,observation_sha256,false,authority_ref,credential_sha256,
 model_ids,question_sha256s,tool_names,max_rounds,max_request_bytes,access_rules,valid_until
 from mizizi_private.desk_operational_policy_versions_v1 where case_id=${q(pairedId)} and revision=1;
 set local role service_role;
 do $standing$ begin
 if ${read(searchId)} is not null or ${read(standingPageId)} is not null
 or ${authority("model_disclose",envelope(1,[],[]))} is not null then raise exception 'STOP_STANDING_REVOKED_USE';end if;
 begin perform * from ${journalRead};raise exception 'STOP_STANDING_REVOKED_JOURNAL';
 exception when sqlstate '42501' then null;end;
 end $standing$;
 rollback;
 select 'PASS';`)==="PASS","STOP_OPERATIONAL_CONVERGENCE_ROLLBACK");
 console.log("WK_AUTH_MIZIZI_DESK_OPERATIONAL_CONVERGENCE=PASS");
 }
 const accessName="mizizi_authorize_desk_access_v1";
 const accessArgs=(operation,target=url,descriptor={})=>{
  const body=JSON.stringify({url:target,descriptor});
  return {p_scope:scope,p_operation:operation,p_binding_text:body,p_binding_sha256:hash(body)};
 };
 const nativeAccess=accessArgs("native_acquire");
 fail(await call(accessName,nativeAccess)===null,"STOP_ACCESS_DEFAULT_DENY");
 for(const actor of [first.user,subscriber]){
  denied(await actor.rpc(accessName,nativeAccess),"42501","STOP_ACCESS_BROWSER_ACL");
 }
 await deny(accessName,{...nativeAccess,p_binding_sha256:hash("wrong")},"22023");
 sql(`insert into mizizi_private.desk_access_policy_versions_v1
  (workspace_id,host,url_sha256,operation,revision,custody_revision,enabled,authority_ref,valid_until)
  values ('${ws}','${host}','${hash(url)}','native_acquire',1,1,true,'fixture:independent-access-review',now()+interval '5 minutes');`);
 const access=await call(accessName,nativeAccess);
 fail(access?.allowed===true&&access.bindingSha256===nativeAccess.p_binding_sha256&&access.urlSha256===hash(url)&&
  Date.parse(access.validUntil)<=Date.parse(scope.leaseExpiresAt),"STOP_ACCESS_EXACT_RECEIPT");
 const examinationArgs=accessArgs("native_text",url,{finalUrl:url,sha256:hash("fixture"),representation:"native_response_bytes"});
 fail(await call(accessName,examinationArgs)===null&&await call(accessName,accessArgs("native_acquire",htmlUrl))===null,
  "STOP_ACCESS_SEPARATE_EXAMINATION_AND_URL");
 sql(`insert into mizizi_private.desk_access_policy_versions_v1
  (workspace_id,host,url_sha256,operation,revision,custody_revision,enabled,authority_ref,valid_until)
  values ('${ws}','${host}','${hash(url)}','native_text',1,1,true,'fixture:independent-examination-review',now()+interval '5 minutes');`);
 fail((await call(accessName,examinationArgs))?.allowed===true,"STOP_ACCESS_EXAMINATION_GRANT");
 sql(`insert into mizizi_private.desk_access_policy_versions_v1
  (workspace_id,host,url_sha256,operation,revision,custody_revision,enabled,authority_ref,valid_until)
  values ('${ws}','${host}','${hash(url)}','native_acquire',2,1,false,'fixture:revoked-access-review',now()+interval '5 minutes');`);
 fail(await call(accessName,nativeAccess)===null&&(await call(accessName,examinationArgs))?.allowed===true,"STOP_ACCESS_REVOCATION");
 console.log("WK_AUTH_MIZIZI_DESK_INDEPENDENT_URL_ACCESS=PASS");
 fail(await call(appendName,{...searchArgs,p_provenance:{...searchArgs.p_provenance,reservationId:randomUUID()}})===null&&
  await call(appendName,{...searchArgs,p_lead_bindings:[{id:leadId,url:"https://127.0.0.1/private"},{id:htmlLead,url:htmlUrl}]})===null,
  "STOP_CUSTODY_FORGED_RESERVATION_OR_LEAD");
 await deny(appendName,{...searchArgs,p_result_sha256:"f".repeat(64)},"22023");
 const race=await Promise.all([service.rpc(appendName,searchArgs),service.rpc(appendName,searchArgs)]);
 fail(race.every(x=>!x.error)&&race.map(x=>x.data.outcome).sort().join(",")==="created,replayed",
  "STOP_CUSTODY_ATOMIC_REPLAY");
 const searchRead=await call(readName,{p_scope:scope,p_receipt_id:searchId});
 fail(searchRead.resultText===searchArgs.p_result_text&&searchRead.resultSha256===searchArgs.p_result_sha256&&
  !Object.hasOwn(searchRead.provenance,"requestText"),"STOP_CUSTODY_READBACK_OR_QUERY_RETENTION");
 const resolved=await call(resolveName,{p_scope:scope,p_lead_id:leadId});
 fail(resolved.url===url&&resolved.receiptId===searchId&&
  await call(resolveName,{p_scope:{...scope,caseId:staleId},p_lead_id:leadId})===null,
  "STOP_CUSTODY_LEAD_SCOPE");
 const modelAuthorityName="mizizi_authorize_desk_model_operation_v1";
 const modelArgs=(operation,descriptor)=>{
  const body=JSON.stringify(descriptor);
  return {p_scope:scope,p_operation:operation,p_binding_text:body,p_binding_sha256:hash(body)};
 };
 const modelDescriptor=(round,sourceIds,toolReceipts)=>{
  const bodySha256=hash("fixture envelope "+round),credentialSha256=hash("fixture credential");
  return {scope,model:"fixture-haiku",round,requestSha256:hash(JSON.stringify({scope,round,credentialSha256,bodySha256})),
   bodySha256,credentialSha256,requestBytes:128,maxOutputTokens:2500,sourceIds,toolReceipts,questionSha256:hash("fixture question")};
 };
 const firstModel=modelArgs("model_disclose",modelDescriptor(1,[],[]));
 const firstTool=modelArgs("tool_execute",{scope,call:{name:"search_web",input:{query:context.positions[0].title}}});
 const allowModelOperation=(args,revision=1,enabled=true)=>{
  sql(`insert into mizizi_private.desk_model_authority_versions_v1
  (workspace_id,case_id,operation,binding_sha256,revision,enabled,authority_ref,valid_until)
  values ('${ws}','${pairedId}','${args.p_operation}','${args.p_binding_sha256}',${revision},${enabled},'fixture:independent-model-review',now()+interval '5 minutes');`);
 };
 fail(await call(modelAuthorityName,firstModel)===null&&await call(modelAuthorityName,firstTool)===null,"STOP_MODEL_DEFAULT_DENY");
 for(const actor of [first.user,subscriber])denied(await actor.rpc(modelAuthorityName,firstModel),"42501","STOP_MODEL_AUTHORITY_ACL");
 await deny(modelAuthorityName,{...firstModel,p_binding_sha256:hash("wrong")},"22023");
 allowModelOperation(firstModel);
 fail((await call(modelAuthorityName,firstModel))?.allowed===true&&await call(modelAuthorityName,firstTool)===null,
  "STOP_MODEL_TOOL_PERMISSION_INDEPENDENCE");
 allowModelOperation(firstTool);
 fail((await call(modelAuthorityName,firstTool))?.allowed===true,"STOP_MODEL_TOOL_EXACT_GRANT");
 const changedModel=modelArgs("model_disclose",{...modelDescriptor(1,[],[]),bodySha256:hash("changed body")});
 fail(await call(modelAuthorityName,changedModel)===null,"STOP_MODEL_CHANGED_BODY");
 allowModelOperation(firstModel,2,false);
 fail(await call(modelAuthorityName,firstModel)===null&&(await call(modelAuthorityName,firstTool))?.allowed===true,"STOP_MODEL_GRANT_REVOCATION");
 const retrievedAt=new Date().toISOString(),sourceSha256=hash("synthetic source bytes");
 const nativeHop=hash("fixture-hop");
 const source={sourceId:pageId,caseId:pairedId,workspaceId:ws,originKey:p.originKey,lineageKey:p.lineageKey,
  fingerprint:sourceSha256,authorityRef:p.authorityRef,useBasis:p.useBasis,observedAt:retrievedAt,
  expiresAt:p.validUntil,revokedAt:null,privateResearchAllowed:true,
  externalModelProcessingAllowed:true,privateEvidenceRetentionAllowed:true};
 const excerpt={source,excerpt:"Synthetic original evidence for disposable acceptance.",citation:url+"#pdf_page:1"};
 const pageResult={receiptId:pageId,leads:[{id:nextLead,kind:"document",label:"PDF document — 4 pages"}],sources:[excerpt],visual:null};
 const pageProvenance={requestedUrl:url,finalUrl:url,sourceSha256,projectionSha256:hash("synthetic projection"),
  contentType:"application/pdf",retrievedAt,byteLength:22,hopSha256:[nativeHop],locator:"pdf_page:1",documentPages:4,renderRequired:false};
 const pageArgs=binding("read_page",{lead_id:leadId},pageResult,host,pageProvenance,[{id:nextLead,url}]);
 const forged=binding("read_page",{lead_id:randomUUID()},pageResult,host,pageProvenance,pageArgs.p_lead_bindings);
 fail(await call(appendName,forged)===null&&
  await call(appendName,{...pageArgs,p_provenance:{...pageProvenance,hopSha256:["e".repeat(64)]}})===null,
  "STOP_CUSTODY_FORGED_PARENT_OR_NATIVE_RECEIPT");
 const changed=binding("read_page",{lead_id:leadId},{...pageResult,sources:[{...excerpt,source:{...source,lineageKey:"fabricated:independent"}}]},
  host,pageProvenance,pageArgs.p_lead_bindings);
 fail(await call(appendName,changed)===null,"STOP_CUSTODY_INVENTED_LINEAGE");
 const admitted=await call(appendName,pageArgs);
 fail(admitted.receiptId===pageId&&admitted.outcome==="created","STOP_CUSTODY_SOURCE_ADMISSION");
 fail((await call(readName,{p_scope:scope,p_receipt_id:pageId})).resultText===pageArgs.p_result_text,
  "STOP_CUSTODY_EXACT_SOURCE_READBACK");
 const receiptBinding=(id,args)=>({receiptId:id,callSha256:args.p_call_sha256,resultSha256:args.p_result_sha256});
 const exactModel=modelArgs("model_disclose",modelDescriptor(3,[pageId],[receiptBinding(searchId,searchArgs),receiptBinding(pageId,pageArgs)]));
 const omittedSource=modelArgs("model_disclose",{...JSON.parse(exactModel.p_binding_text),sourceIds:[]});
 const forgedReceipt=modelArgs("model_disclose",{...JSON.parse(exactModel.p_binding_text),toolReceipts:[receiptBinding(searchId,searchArgs),{...receiptBinding(pageId,pageArgs),resultSha256:hash("forged")}]});
 const readTool=modelArgs("tool_execute",{scope,call:{name:"read_page",input:{lead_id:leadId}}});
 for(const args of [exactModel,omittedSource,forgedReceipt,readTool])allowModelOperation(args);
 fail((await call(modelAuthorityName,exactModel))?.allowed===true&&(await call(modelAuthorityName,readTool))?.allowed===true&&
  await call(modelAuthorityName,omittedSource)===null&&await call(modelAuthorityName,forgedReceipt)===null,
  "STOP_MODEL_CUSTODY_EXACT_BINDING");
 // Same original PDF, no new network allocation. Follow-up is an exact
 // same-lease derivative, never a second independent origin.
 const docId=randomUUID(),visualId=randomUUID();
 const derivative={parentReceiptId:pageId,finalUrl:url,sourceSha256,
  contentType:"application/pdf",retrievedAt,byteLength:22};
 const docResult={receiptId:docId,leads:[],sources:[{source:{...source,sourceId:docId},
  excerpt:"Page 2: synthetic archival source.",citation:url+"#pdf_pages:2-3"}],visual:null};
 const docMeta={...derivative,projectionSha256:hash("pages two and three"),locator:"pdf_pages:2-3",detail:{pageStart:2,pageEnd:3}};
 const docArgs=binding("read_document",{lead_id:nextLead,page_start:2,page_end:3},docResult,host,docMeta,[]);
 fail(await call(appendName,{...docArgs,p_provenance:{...docMeta,sourceSha256:"e".repeat(64)}})===null&&
  await call(appendName,{...docArgs,p_provenance:{...docMeta,parentReceiptId:searchId}})===null,
  "STOP_CUSTODY_DERIVATIVE_FORGED_PARENT_OR_PAYLOAD");
 const outside=binding("read_document",{lead_id:nextLead,page_start:2,page_end:5},docResult,host,
  {...docMeta,detail:{pageStart:2,pageEnd:5}},[]);
 fail(await call(appendName,outside)===null,"STOP_CUSTODY_DERIVATIVE_PAGE_BOUND");
 fail((await call(appendName,docArgs)).outcome==="created"&&(await call(appendName,docArgs)).outcome==="replayed",
  "STOP_CUSTODY_DOCUMENT_APPEND");
 const image={sha256:hash("synthetic raster"),width:300,height:200,byteLength:55};
 const visualResult={receiptId:visualId,leads:[],sources:[{source:{...source,sourceId:visualId},
  excerpt:"Visual derivative for examination; no textual claim is verified.",citation:url+"#pdf_visual:2"}],
  visual:{sourceId:visualId,sha256:image.sha256,contentType:"image/png"}};
 const visualMeta={...derivative,projectionSha256:image.sha256,locator:"pdf_visual:2",detail:{page:2,visual:image}};
 const visualArgs=binding("inspect_visual",{lead_id:nextLead,page:2},visualResult,host,visualMeta,[]);
 fail(await call(appendName,{...visualArgs,p_provenance:{...visualMeta,detail:{page:2,visual:{...image,width:9999}}}})===null,
  "STOP_CUSTODY_RASTER_BOUND");
 fail((await call(appendName,visualArgs)).outcome==="created"&&
  (await call(readName,{p_scope:scope,p_receipt_id:visualId})).resultText===visualArgs.p_result_text&&
  (await call(readName,{p_scope:scope,p_receipt_id:docId})).resultText===docArgs.p_result_text,
  "STOP_CUSTODY_DERIVATIVE_READBACK");
 fail(sql("select count(*) from mizizi_private.desk_tool_receipts_v1 where parent_receipt_id='"+pageId+"';")==="2",
  "STOP_CUSTODY_DERIVATIVE_PARENT_LINK");
 // Separate fresh owner policy revisions in the same allocation window.
 // No refunds; raise only disposable fixture ceilings. The real provider
 // remains unused; the DB verifies the exact consumed request/close journal.
 sql(`insert into mizizi_private.desk_resource_policy_versions_v1(
 resource,revision,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
 exclusive_allocation_verified,capacity_ceiling_verified,paid_inference_authorized,zero_incremental_cost_verified,
 allowance_start,allowance_end,valid_until,account_limit,daily_limit,case_limit,model_tariffs)
 select resource,3,true,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
 exclusive_allocation_verified,capacity_ceiling_verified,paid_inference_authorized,zero_incremental_cost_verified,
 allowance_start,allowance_end,valid_until,account_limit+case when resource='native_https' then 2000000 else 120 end,
 daily_limit+case when resource='native_https' then 2000000 else 120 end,
 case_limit+case when resource='native_https' then 2000000 else 120 end,model_tariffs
 from mizizi_private.desk_resource_policy_versions_v1 where revision=2 and resource in ('native_https','cloudflare_browser_run');`);
 const resourceAccount="d".repeat(64),resourceQuote="mizizi_quote_desk_resource_v1",
  resourceReserve="mizizi_reserve_desk_resource_v1",resourceConsume="mizizi_consume_desk_resource_v1";
 async function charge(resource,digest){
  const descriptor={p_binding_text:JSON.stringify({scope,resource,requestSha256:digest,accountFingerprint:resourceAccount,model:null})};
  const q=await call(resourceQuote,descriptor);
  fail(q?.policyRevision===3,"STOP_DERIVATIVE_RESOURCE_QUOTE");
  const receipt=await call(resourceReserve,{...descriptor,p_policy_revision:q.policyRevision,p_expected_units:q.units});
  fail(!!receipt,"STOP_DERIVATIVE_RESOURCE_RESERVE");
  const args={p_reservation_id:receipt.reservationId,p_request_sha256:receipt.requestSha256,p_account_fingerprint:resourceAccount};
  fail(await call(resourceConsume,args)===true,"STOP_DERIVATIVE_RESOURCE_CONSUME");
  return {receipt,args};
 }
 const htmlId=randomUUID(),renderLead=randomUUID(),renderId=randomUUID(),screenshotLead=randomUUID(),screenshotId=randomUUID();
 const htmlHash=hash("native shell bytes"),htmlProjection=hash("native shell projection"),htmlHop=hash("second native hop");
 await charge("native_https",htmlHop);
 const htmlMeta={requestedUrl:htmlUrl,finalUrl:htmlUrl,sourceSha256:htmlHash,projectionSha256:htmlProjection,
  contentType:"text/html",retrievedAt,byteLength:22,hopSha256:[htmlHop],locator:"no_text",
  documentPages:null,renderRequired:true};
 const htmlResult={receiptId:htmlId,leads:[{id:renderLead,kind:"render",label:"Native extraction insufficient"}],sources:[],visual:null};
 const htmlArgs=binding("read_page",{lead_id:htmlLead},htmlResult,host,htmlMeta,[{id:renderLead,url:htmlUrl}]);
 fail((await call(appendName,htmlArgs)).outcome==="created","STOP_CUSTODY_RENDER_LEAD");
 const browserText=JSON.stringify({scope,url:htmlUrl,hostname:host,visual:true,sourceSha256:htmlHash,
  projectionSha256:htmlProjection,accountFingerprint:resourceAccount,reserveSeconds:120});
 const browserHash=hash(browserText),browserCharge=await charge("cloudflare_browser_run",browserHash);
 const browserEvent=(state,detail={})=>call("mizizi_record_desk_resource_event_v1",{...browserCharge.args,p_state:state,p_detail:detail});
 const sessionId=randomUUID();
 fail(await browserEvent("open_pending")===true&&await browserEvent("opened",{sessionId})===true,"STOP_CUSTODY_BROWSER_OPEN");
 const renderedHash=hash("rendered DOM fixture"),renderedProjection=hash("rendered projection"),shot={sha256:hash("viewport fixture"),width:1280,height:900,byteLength:55};
 const browserSource={...source,sourceId:renderId,fingerprint:renderedHash};
 const renderMeta={parentReceiptId:htmlId,finalUrl:htmlUrl,sourceSha256:renderedHash,projectionSha256:renderedProjection,
  contentType:"text/html",retrievedAt,byteLength:22,locator:"article_text",
  detail:{reservationId:browserCharge.receipt.reservationId,requestSha256:browserHash,requestText:browserText,visual:shot}};
 const renderResult={receiptId:renderId,leads:[{id:screenshotLead,kind:"visual",label:"Rendered viewport"}],
  sources:[{source:browserSource,excerpt:"Rendered archival material, not original response.",citation:htmlUrl+"#article_text"}],visual:null};
 const renderArgs=binding("render_page",{lead_id:renderLead},renderResult,host,renderMeta,[{id:screenshotLead,url:htmlUrl}]);
 fail(await call(appendName,renderArgs)===null,"STOP_CUSTODY_UNCLOSED_BROWSER");
 fail(await browserEvent("close_acknowledged",{sessionId})===true,"STOP_CUSTODY_BROWSER_CLOSE");
 fail((await call(appendName,renderArgs)).outcome==="created","STOP_CUSTODY_BROWSER_ADMISSION");
 const browserRead=await call(readName,{p_scope:scope,p_receipt_id:renderId});
 fail(!Object.hasOwn(browserRead.provenance.detail,"requestText")&&browserRead.provenance.sourceSha256===renderedHash,
  "STOP_CUSTODY_BROWSER_DERIVATIVE_DIGEST");
 const shotMeta={parentReceiptId:renderId,finalUrl:htmlUrl,sourceSha256:renderedHash,projectionSha256:shot.sha256,
  contentType:"text/html",retrievedAt,byteLength:22,locator:"browser_viewport:1",detail:{page:1,visual:shot}};
 const shotResult={receiptId:screenshotId,leads:[],sources:[{source:{...browserSource,sourceId:screenshotId},
  excerpt:"Visual derivative for examination; no textual claim is verified.",citation:htmlUrl+"#browser_viewport:1"}],
  visual:{sourceId:screenshotId,sha256:shot.sha256,contentType:"image/png"}};
 const shotArgs=binding("inspect_visual",{lead_id:screenshotLead,page:1},shotResult,host,shotMeta,[]);
 fail((await call(appendName,shotArgs)).outcome==="created"&&
  (await call(readName,{p_scope:scope,p_receipt_id:screenshotId})).resultText===shotArgs.p_result_text,
  "STOP_CUSTODY_BROWSER_SCREENSHOT");
 console.log("WK_AUTH_MIZIZI_DESK_BROWSER_DERIVATIVE_CLOSED_RESERVATION=PASS");
 // Exercise the existing RPCs against a real admitted source. A rollback-only
 // local transaction preserves the independent subsequent lease-recovery fixture.
 const journalRef={sourceId:pageId,originKey:source.originKey,lineageKey:source.lineageKey,
  payloadFingerprint:source.fingerprint,useBasis:source.useBasis,authorityRef:source.authorityRef,
  observedAt:source.observedAt,citation:excerpt.citation,excerpt:excerpt.excerpt,modelDisclosed:true};
 const journalBody=(ref)=>JSON.stringify({contract:"mizizi.adaptive_investigation.v1",caseId:pairedId,
  workspaceId:ws,ordinal:1,question:"Read-only journal authority fixture.",predecessorFingerprint:null,
  sourceReceipts:[ref],findings:[],proposedLeads:[],decision:{action:"pause",nextQuestion:null},
  passFinding:"Synthetic local evidence only."});
 const journalArgs=(ref)=>{const body=journalBody(ref);return {...activeContext,p_body_text:body,
  p_fingerprint:hash(body),p_predecessor:null};};
 const journalAppend="mizizi_append_research_pass_v1",journalRead="mizizi_read_research_passes_v1";
 await deny(journalAppend,journalArgs({...journalRef,excerpt:"forged excerpt"}),"42501");
 await deny(journalAppend,journalArgs({...journalRef,sourceId:randomUUID()}),"42501");
 await deny(journalAppend,journalArgs({...journalRef,modelDisclosed:false}),"42501");
 const valid=journalArgs(journalRef);
 const quoted=(v)=>"'"+String(v).replaceAll("'","''")+"'";
 const appendSql="public."+journalAppend+"("+quoted(job.job_id)+"::uuid,"+quoted(activeWorker)+","+
  quoted(valid.p_body_text)+","+quoted(valid.p_fingerprint)+",null)";
 const readSql="public."+journalRead+"("+quoted(job.job_id)+"::uuid,"+quoted(activeWorker)+")";
 fail(sql(`begin;
 set local role service_role;
 set local request.jwt.claim.role='service_role';
 do $test$ begin
 if (select outcome from ${appendSql})<>'created' or (select body_text from ${readSql}) is distinct from ${quoted(valid.p_body_text)}
 or (select outcome from ${appendSql})<>'replayed' then raise exception 'STOP_JOURNAL_VALID';end if;
 end $test$;
 reset role;
 insert into mizizi_private.desk_custody_policy_versions_v1(
 workspace_id,host,revision,enabled,source_family,authority_ref,origin_key,lineage_key,use_basis,
 private_research_allowed,metadata_retention_allowed,excerpt_retention_allowed,external_model_processing_allowed,valid_until)
 select workspace_id,host,2,false,source_family,authority_ref,origin_key,lineage_key,use_basis,
 private_research_allowed,metadata_retention_allowed,excerpt_retention_allowed,external_model_processing_allowed,valid_until
 from mizizi_private.desk_custody_policy_versions_v1 where revision=1 and host='archive.org' and workspace_id='${ws}';
 set local role service_role;
 do $test$ begin
 begin perform * from ${readSql};raise exception 'STOP_JOURNAL_REVOKED_READ';exception when SQLSTATE '42501' then null;end;
 begin perform * from ${appendSql};raise exception 'STOP_JOURNAL_REVOKED_REPLAY';exception when SQLSTATE '42501' then null;end;
 begin perform public.mizizi_complete_case_research_job_v1('${job.job_id}','${activeWorker}','{}');raise exception 'STOP_JOURNAL_REVOKED_COMPLETE';exception when SQLSTATE '42501' then null;end;
 end $test$;
 rollback;
 select 'PASS';`)==="PASS","STOP_JOURNAL_ROLLBACK_ACCEPTANCE");
 fail(sql("select count(*) from mizizi_private.research_passes where case_id='"+pairedId+"';")==="0",
  "STOP_JOURNAL_FIXTURE_NOT_ROLLED_BACK");
 console.log("WK_AUTH_MIZIZI_DESK_JOURNAL_CURRENT_CUSTODY=PASS");
 // Revoking discovery ancestry denies descendants even while source-family
 // rights are still current. Historical immutable bytes remain private.
 sql(`insert into mizizi_private.desk_custody_policy_versions_v1(
 workspace_id,host,revision,enabled,source_family,authority_ref,origin_key,lineage_key,use_basis,
 private_research_allowed,metadata_retention_allowed,excerpt_retention_allowed,external_model_processing_allowed,valid_until)
 select workspace_id,host,2,false,source_family,authority_ref,origin_key,lineage_key,use_basis,
 private_research_allowed,metadata_retention_allowed,excerpt_retention_allowed,external_model_processing_allowed,valid_until
 from mizizi_private.desk_custody_policy_versions_v1 where revision=1 and host='api.search.brave.com';`);
 fail(await call(readName,{p_scope:scope,p_receipt_id:visualId})===null&&
  await call(readName,{p_scope:scope,p_receipt_id:docId})===null&&
  await call(readName,{p_scope:scope,p_receipt_id:screenshotId})===null&&
  await call(resolveName,{p_scope:scope,p_lead_id:nextLead})===null,
  "STOP_CUSTODY_DERIVATIVE_ANCESTRY_REVOCATION");
 fail(await call(modelAuthorityName,exactModel)===null&&await call(modelAuthorityName,readTool)===null,
  "STOP_MODEL_ANCESTRY_REVOCATION");
 console.log("WK_AUTH_MIZIZI_DESK_EXACT_MODEL_TOOL_AUTHORITY=PASS");
 console.log("WK_AUTH_MIZIZI_DESK_DERIVATIVE_DOCUMENT_VISUAL_ANCESTRY=PASS");
 sql(`insert into mizizi_private.desk_custody_policy_versions_v1(
 workspace_id,host,revision,enabled,source_family,authority_ref,origin_key,lineage_key,use_basis,
 private_research_allowed,metadata_retention_allowed,excerpt_retention_allowed,external_model_processing_allowed,valid_until)
 select workspace_id,host,2,false,source_family,authority_ref,origin_key,lineage_key,use_basis,
 private_research_allowed,metadata_retention_allowed,excerpt_retention_allowed,external_model_processing_allowed,valid_until
 from mizizi_private.desk_custody_policy_versions_v1 where revision=1 and host='archive.org';`);
 fail(await call(readName,{p_scope:scope,p_receipt_id:pageId})===null&&
  await call(resolveName,{p_scope:scope,p_lead_id:nextLead})===null&&await call(appendName,pageArgs)===null&&
  sql("select count(*) from mizizi_private.desk_tool_receipts_v1;")==="7"&&
  sql("select count(*) from mizizi_private.desk_reference_leads_v1;")==="5","STOP_CUSTODY_REVOCATION");
 fail(sql("select (not has_table_privilege('service_role','mizizi_private.desk_custody_policy_versions_v1','INSERT') "+
  "and not has_table_privilege('service_role','mizizi_private.desk_tool_receipts_v1','UPDATE') "+
  "and not has_table_privilege('authenticated','mizizi_private.desk_reference_leads_v1','SELECT'))::text;")==="true",
  "STOP_CUSTODY_PRIVATE_ACL");
 await deny(journalAppend,valid,"42501");
 console.log("WK_AUTH_MIZIZI_DESK_PRIVATE_CUSTODY_OPAQUE_LEAD_SOURCE_REPLAY_REVOCATION=PASS");
 }
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

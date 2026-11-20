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
   "where suggestion_id='${staged.suggestion_id}'::uuid and credit_order=1;");
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
   "from public.provider_intake_artist_staging where id='${artist.staging_id}'::uuid;");
 fail(artistState==="true|true|true",
   "STOP_CHARTS2_REAL_JWT_ARTIST_INTAKE_INVENTED_METADATA");
 console.log("WK_AUTH_CHARTS2_JWT_TRACK_ARTIST_CREDIT_INTAKE_AND_DENIAL=PASS");

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
   "40001","STOP_CHARTS2_TWO_GENUINE_JWT_STALE_SHZAM_REVIEW");
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

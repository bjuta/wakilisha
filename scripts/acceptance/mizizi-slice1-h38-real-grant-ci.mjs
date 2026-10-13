/**
 * H38: prove a real, pre-existing and caller-bound reviewed Registry grant is
 * denied AFTER a genuine signed-in operator activates Hold Writes.
 * Only a fresh disposable local Supabase runner can load this test shim.
 * The shim splits two existing private issuance steps; no grant table shortcut.
 * No Preview/Production authority, fake JWT, or fabricated registry operation.
 */
import {randomUUID} from "node:crypto";

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function check(value,marker){if(!value)throw new Error(marker);}
function resultOk(response,label){
 check(!response.error,label+"_"+String(response.error?.code||"UNKNOWN"));
 return response.data;
}
export async function verifyH38ExactGrantedWriterV1({sql,db,operator}){
 check(process.env.GITHUB_ACTIONS==="true"&&
  process.env.GITHUB_EVENT_NAME==="pull_request"&&
  typeof sql==="function"&&typeof db==="string"&&
  UUID.test(operator?.id||"")&&
  typeof operator.user?.rpc==="function",
  "STOP_H38_NOT_GENUINE_DISPOSABLE_OPERATOR");
 const baseline=sql("SELECT (SELECT count(*) FROM platform_private.registry_execution_grants WHERE status='active')::text||'|'||"+
  "(SELECT count(*) FROM public.registry_artists)::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.write_holds WHERE status='active');",db);
 check(baseline==="0|0|0","STOP_H38_NONEMPTY_ARTIST_GRANT_OR_HOLD_BASELINE");
 const source=randomUUID(),canonical=randomUUID();
 const sourceSlug="wk-h38-source-"+source.slice(0,12);
 const canonicalSlug="wk-h38-target-"+canonical.slice(0,12);
 sql("INSERT INTO public.registry_artists (id,slug,display_name,normalized_name,status,metadata) VALUES "+
  "('"+source+"'::uuid,'"+sourceSlug+"','Disposable H38 Source','disposable h38 source','active','{}'::jsonb),"+
  "('"+canonical+"'::uuid,'"+canonicalSlug+"','Disposable H38 Target','disposable h38 target','active','{}'::jsonb);",db);

 // This LOCAL-ONLY, disposable shim exposes exactly the two existing private
 // caller-bound issuance functions, with the real JWT-provided auth.uid().
 // The product public command remains unchanged; the shim does not execute it.
 sql([
"CREATE FUNCTION public.wk_ci_h38_issue_exact_grant_v1(",
" p_source_artist_id uuid,p_canonical_artist_id uuid",
") RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER",
"SET search_path=pg_catalog,public,platform_private,auth",
"AS $wk_h38$",
"DECLARE v_uid uuid; v_evidence uuid;",
"BEGIN",
" v_uid:=platform_private.registry_artist_merge_admin_current_user_v1();",
" v_evidence:=platform_private.record_registry_artist_merge_evidence_v1(",
"  p_source_artist_id,p_canonical_artist_id,",
"  'H38 disposable reviewed writer fixture.',true,'duplicate_record');",
" RETURN platform_private.issue_registry_artist_merge_grant_v1(v_evidence);",
"END $wk_h38$;",
"REVOKE ALL ON FUNCTION public.wk_ci_h38_issue_exact_grant_v1(uuid,uuid)",
" FROM public,anon,authenticated,service_role;",
"GRANT EXECUTE ON FUNCTION public.wk_ci_h38_issue_exact_grant_v1(uuid,uuid)",
" TO authenticated;",
"NOTIFY pgrst, 'reload schema';"
].join("\n"),db);

 let grantResult;
 for(let attempt=0;attempt<15;attempt++){
  grantResult=await operator.user.rpc("wk_ci_h38_issue_exact_grant_v1",{
   p_source_artist_id:source,p_canonical_artist_id:canonical,
  });
  if(!grantResult.error||!["PGRST202","PGRST301"].includes(
     String(grantResult.error.code||"")))break;
  await new Promise(resolve=>setTimeout(resolve,400));
 }
 const grantId=resultOk(grantResult,"STOP_H38_GENUINE_EXACT_GRANT_ISSUER");
 check(UUID.test(grantId||""),"STOP_H38_PREEXISTING_GRANT_ID_MISSING");
 const issued=sql("SELECT (SELECT count(*) FROM platform_private.registry_execution_grants g "+
  "WHERE g.id='"+grantId+"'::uuid AND g.status='active' "+
  "AND g.actor_key='registry_artist_merge_admin' AND g.operation_key='registry.artist.merge' "+
  "AND g.operation_version=1 AND g.issued_by_user_id='"+operator.id+"'::uuid "+
  "AND g.required_user_capability_key='manage_registry' "+
  "AND g.plan_fingerprint=platform_private.registry_plan_fingerprint(g.plan_payload))::text||'|'||"+
  "(SELECT count(*) FROM platform_private.registry_execution_grant_targets "+
  "WHERE execution_grant_id='"+grantId+"'::uuid AND expected_state_fingerprint IS NOT NULL)::text||'|'||"+
  "(SELECT count(*) FROM platform_private.registry_evidence_assertions e "+
  "JOIN platform_private.registry_execution_grants g ON g.id='"+grantId+"'::uuid "+
  "WHERE e.id=(g.plan_payload->>'evidence_assertion_id')::uuid "+
  "AND e.recorded_by_principal_key='user:"+operator.id+"' AND e.trust_class='INTERNAL_FACT')::text;",db);
 check(issued==="1|2|1","STOP_H38_VALID_ISSUED_FROZEN_REVIEW_GRANT_NOT_PROVEN");
 console.log("WK_H38_REAL_SIGNED_IN_ISSUER_VALID_PREEXISTING_EXACT_GRANT=PASS");

 const held=resultOk(await operator.user.rpc("admin_mizizi_hold_workspace_writes_v1",{
  p_hold_key:"wk-h38-local-"+randomUUID(),
  p_reason:"Exercise stale preauthorized exact Registry writer under active Hold Writes.",
  p_review_after:null,
 }),"STOP_H38_SIGNED_IN_HOLD_COMMAND");
 check(UUID.test(held?.holdId||"")&&held.status==="active"&&held.revision===1,
  "STOP_H38_SIGNED_IN_ACTIVE_HOLD_NOT_PROVEN");
 const mergeArgs={
  p_source_artist_id:source,p_canonical_artist_id:canonical,
  p_note:"H38 disposable reviewed writer fixture.",
  p_archive_source:true,p_merge_reason:"duplicate_record",
 };
 const blocked=await operator.user.rpc("admin_safe_merge_registry_artists",mergeArgs);
 check(blocked.error?.code==="42501",
  "STOP_H38_STALE_ISSUED_WRITER_NOT_DENIED_"+
  String(blocked.error?.code||"NONE").replace(/[^A-Za-z0-9_]/g,""));
 const afterDenied=sql("SELECT "+
  "(SELECT count(*) FROM platform_private.registry_execution_grants "+
  " WHERE id='"+grantId+"'::uuid AND status='active')::text||'|'||"+
  "(SELECT count(*) FROM platform_private.registry_mutation_operations "+
  " WHERE execution_grant_id='"+grantId+"'::uuid)::text||'|'||"+
  "(SELECT count(*) FROM public.registry_artists WHERE id='"+source+
  "'::uuid AND status='active')::text||'|'||"+
  "(SELECT count(*) FROM public.registry_artist_resolution_events "+
  " WHERE source_artist_id='"+source+"'::uuid AND status='success')::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.write_hold_events "+
  " WHERE hold_id='"+held.holdId+"'::uuid AND event_kind='hold_started')::text;",db);
 check(afterDenied==="1|0|1|0|1",
  "STOP_H38_DENIED_CANONICAL_WRITE_OR_MUTATION_HISTORY_DRIFT");
 console.log("WK_H38_REAL_AUTH_STALE_EXACT_GRANT_WRITER_DENIED_DURING_HOLD=PASS");
 console.log("WK_H38_ZERO_CANONICAL_ARTIST_MUTATIONS_WHILE_HELD=PASS");

 const released=resultOk(await operator.user.rpc("admin_mizizi_release_workspace_hold_v1",{
  p_hold_id:held.holdId,p_expected_revision:1,
  p_reason:"The H38 local blocking test completed; release reviewed temporary hold.",
 }),"STOP_H38_AUTH_HOLD_RELEASE");
 check(released.status==="released"&&released.revision===2,
  "STOP_H38_HOLD_RELEASE_NOT_SEALED");
 const applied=await operator.user.rpc("admin_safe_merge_registry_artists",mergeArgs);
 resultOk(applied,"STOP_H38_SAME_AUTHORISED_GRANT_CANNOT_RESUME_POST_RELEASE");
 const verified=sql("SELECT "+
  "(SELECT count(*) FROM platform_private.registry_execution_grants WHERE id='"+
  grantId+"'::uuid AND status='consumed')::text||'|'||"+
  "(SELECT count(*) FROM platform_private.registry_mutation_operations "+
  " WHERE execution_grant_id='"+grantId+"'::uuid AND status='succeeded' "+
  " AND verifier_status='passed')::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.write_hold_events "+
  " WHERE hold_id='"+held.holdId+"'::uuid AND event_kind='hold_released')::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.write_holds "+
  " WHERE id='"+held.holdId+"'::uuid AND status='released')::text;",db);
 check(verified==="1|1|1|1",
  "STOP_H38_EXACT_PREEXISTING_GRANT_DID_NOT_COMPLETE_AFTER_RELEASE");
 console.log("WK_H38_SAME_VALID_GRANT_EXECUTED_AND_INDEPENDENTLY_VERIFIED_POST_RELEASE=PASS");
 console.log("WK_H38_ALL_ARTISTS_AND_SHIM=DISPOSABLE_LOCAL_ONLY");
}

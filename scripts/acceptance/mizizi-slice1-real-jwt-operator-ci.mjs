#!/usr/bin/env node
// Actual GoTrue JWT + PostgREST RPC proof in fresh unlinked LOCAL CI only.
// Temporary role and second workspace membership are synthetic local fixtures.
// Surrounding workflow MUST destroy the local Docker volumes on every outcome.
import {createClient} from "@supabase/supabase-js";
import {execFileSync,spawnSync} from "node:child_process";
import {readFileSync,existsSync} from "node:fs";
import {randomBytes,randomUUID} from "node:crypto";

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const assert=(v,code)=>{if(!v)throw new Error(code);};
function environment(){
 const raw=execFileSync("supabase",["status","-o","env"],{encoding:"utf8"});
 const values={};
 for(const row of raw.split(/\r?\n/)){
  const match=row.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if(match)values[match[1]]=match[2].replace(/^["']|["']$/g,"");
 }
 return values;
}
function localSql(query,container){
 const result=spawnSync("docker",["exec","-i",container,"psql","-X","-q",
  "-A","-t","-v","ON_ERROR_STOP=1","-U","supabase_admin","-d","postgres"],
  {input:query,encoding:"utf8",timeout:180000,maxBuffer:512*1024});
 if(result.error||result.status!==0)throw new Error(
  "LOCAL_SQL_"+String((result.stderr||"").match(/ERROR:\s*([^\n]+)/)?.[1]||
  "UNKNOWN").replace(/[^A-Za-z0-9_]/g,"_").slice(0,110));
 return result.stdout.trim();
}
function requireDenied(result,sqlstate,label){
 assert(result.error?.code===sqlstate,label+"_GOT_"+
  String(result.error?.code||"NONE").replace(/[^A-Za-z0-9_]/g,""));
}
async function call(user,fn,args,label){
 const response=await user.rpc(fn,args);
 assert(!response.error,label+"_"+String(response.error?.code||"UNKNOWN"));
 return response.data;
}
const client=(url,key)=>createClient(url,key,{
 auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
});
async function main(){
 assert(process.env.GITHUB_ACTIONS==="true"&&process.env.GITHUB_EVENT_NAME==="pull_request"&&
  !process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_PROJECT_REF&&
  !existsSync("supabase/.temp/project-ref"),"STOP_AUTH_NOT_UNLINKED_LOCAL_PR");
 const values=environment();
 const api=values.API_URL||values.SUPABASE_URL;
 const loc=new URL(api||"https://invalid.invalid");
 assert(loc.protocol==="http:"&&loc.hostname==="127.0.0.1"&&
  loc.port==="54321"&&loc.pathname==="/"&&
  values.ANON_KEY&&values.SERVICE_ROLE_KEY,"STOP_AUTH_LOCAL_KEYS_OR_URL_NOT_PROVEN");
 const names=execFileSync("docker",["ps","--filter","name=^supabase_db_",
  "--format","{{.Names}}"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
 assert(names.length===1,"STOP_AUTH_LOCAL_DB_CONTAINER_COUNT");
 const db=names[0];
 const baseline=localSql("SELECT (SELECT count(*) FROM supabase_migrations.schema_migrations)::text||'|'||"+
  "(SELECT max(version) FROM supabase_migrations.schema_migrations)||'|'||"+
  "(SELECT count(*) FROM auth.users)||'|'||"+
  "(SELECT count(*) FROM mizizi_private.workspace_memberships)||'|'||"+
  "(SELECT count(*) FROM mizizi_private.cases)||'|'||"+
  "(SELECT count(*) FROM mizizi_private.write_holds)||'|'||"+
  "(SELECT count(*) FROM public.registry_releases);",db);
 assert(baseline==="229|20261014134759|0|0|0|0|0",
  "STOP_AUTH_NOT_FRESH_LOCAL_227");
 console.log("WK_AUTH_EMPTY_227_UNLINKED_LOCAL_BASELINE=PASS");

 const admin=client(api,values.SERVICE_ROLE_KEY),people=[];
 for(const label of ["first","second"]){
  const email="wk-local-ci-"+randomUUID()+"@example.test";
  const password=randomBytes(30).toString("base64url");
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  assert(!created.error&&UUID.test(created.data.user?.id||""),
   "STOP_LOCAL_GOTRUE_CREATE_USER_"+label);
  const user=client(api,values.ANON_KEY);
  const login=await user.auth.signInWithPassword({email,password});
  assert(!login.error&&login.data.user?.id===created.data.user.id&&
   login.data.session?.access_token,"STOP_LOCAL_GOTRUE_SIGNIN_"+label);
  people.push({id:created.data.user.id,user,email,password});
 }
 const first=people[0],second=people[1];
 console.log("WK_AUTH_TWO_GENUINE_SIGNED_IN_LOCAL_USERS=PASS");
 requireDenied(await client(api,values.ANON_KEY).rpc("admin_mizizi_cases_v1",
  {p_limit:100}),"42501","STOP_ANON_ACCESS");
 // O21: actual anonymous PostgREST bootstrap call must never acquire an owner.
 requireDenied(await client(api,values.ANON_KEY).rpc("admin_mizizi_bootstrap_internal_owner_v1",
  {p_reason:"Anonymous local owner bootstrap must be denied."}),
  "42501","STOP_O21_ANONYMOUS_BOOTSTRAP");
 console.log("WK_AUTH_O21_ANONYMOUS_OWNER_BOOTSTRAP_DENIED=PASS");
 requireDenied(await first.user.rpc("admin_mizizi_bootstrap_internal_owner_v1",
  {p_reason:"Unprivileged operator bootstrap must be refused."}),
  "42501","STOP_UNPRIVILEGED_BOOTSTRAP");
 console.log("WK_AUTH_ANONYMOUS_AND_UNPRIVILEGED_DENIAL=PASS");

 localSql("INSERT INTO public.user_role_assignments("+
  "user_id,role_key,status,expires_at,notes) VALUES ('"+first.id+
  "'::uuid,'administrator','active',clock_timestamp()+interval '10 minutes',"+
  "'Disposable local first operator authority fixture.');",db);
 requireDenied(await first.user.rpc("admin_mizizi_cases_v1",
  {p_limit:100}),"42501","STOP_ADMIN_WITHOUT_MEMBERSHIP");
 const initial=await call(first.user,"admin_mizizi_bootstrap_internal_owner_v1",
  {p_reason:"One-time local-only internal Headquarters operator bootstrap."},
  "STOP_REAL_BOOTSTRAP");
 assert(UUID.test(initial||""),"STOP_BOOTSTRAP_RECEIPT_ID");
 requireDenied(await first.user.rpc("admin_mizizi_bootstrap_internal_owner_v1",
  {p_reason:"A second initial workspace setup must be denied."}),
  "55000","STOP_BOOTSTRAP_REPLAY");
 console.log("WK_AUTH_FIRST_OWNER_REAL_JWT_BOOTSTRAP_ONCE=PASS");

 // Explicitly synthetic SECOND owner; no claim of production invitation flow.
 localSql("BEGIN;\nINSERT INTO public.user_role_assignments("+
  "user_id,role_key,status,expires_at,notes) VALUES ('"+second.id+
  "'::uuid,'administrator','active',clock_timestamp()+interval '10 minutes',"+
  "'Disposable local second operator authority fixture.');\n"+
  "INSERT INTO mizizi_private.workspace_memberships("+
  "workspace_id,user_id,member_role,grant_source,granted_by,last_changed_by,"+
  "change_reason,valid_until) SELECT id,'"+second.id+
  "'::uuid,'owner','operator_review','"+first.id+"'::uuid,'"+
  first.id+"'::uuid,'Local second signed-in competing owner scenario.',"+
  "clock_timestamp()+interval '10 minutes' FROM mizizi_private.workspaces"+
  " WHERE workspace_key='wakilisha-internal' AND status='active';\nCOMMIT;",db);
 const empty=await call(second.user,"admin_mizizi_cases_v1",
  {p_limit:100},"STOP_SECOND_OWNER_AUTHENTICATED_READ");
 assert(Array.isArray(empty)&&empty.length===0,"STOP_SECOND_AUTH_CASE_BASELINE");
 console.log("WK_AUTH_SECOND_TRUE_JWT_AND_SYNTHETIC_LOCAL_MEMBERSHIP=PASS");
 // O22: a different genuine signed-in administrator cannot re-bootstrap.
 requireDenied(await second.user.rpc("admin_mizizi_bootstrap_internal_owner_v1",
  {p_reason:"Second already authorized owner cannot bootstrap twice."}),
  "55000","STOP_O22_DIFFERENT_ADMIN_BOOTSTRAP");
 console.log("WK_AUTH_O22_SECOND_GENUINE_ADMIN_OWNER_BOOTSTRAP_DENIED=PASS");

 // Reuse already-accepted broker fixture, commit source/case only, not job.
 const fixture=readFileSync(
  "scripts/acceptance/mizizi-slice1-worker-parallel-setup-ci.sql","utf8");
 const bound=fixture.indexOf("-- Synthetic local state transition ONLY");
 assert(fixture.startsWith("-- WAKILISHA Slice 1 true-concurrency fixture.")&&
  bound>3000&&fixture.slice(0,bound).trimEnd().endsWith(
   "SET SESSION AUTHORIZATION DEFAULT;"),"STOP_CASE_FIXTURE_SOURCE_DRIFT");
 localSql(fixture.slice(0,bound)+"\nCOMMIT;\n",db);
 const cases=await call(first.user,"admin_mizizi_cases_v1",{p_limit:100},
  "STOP_REAL_JWT_CASE_READ");
 assert(cases.length===1&&cases[0].state==="open"&&cases[0].stage==="triage"&&
  cases[0].caseRevision===1&&UUID.test(cases[0].reviewId||""),
  "STOP_SOURCE_BOUND_CASE_READ_MISMATCH");
 const caseId=cases[0].caseId;
 // O20: prove a fresh, actually signed-in subscriber cannot read a REAL
 // source-backed open case or its immutable event journal. No member grant.
 const subscriberEmail="wk-local-subscriber-"+randomUUID()+"@example.test";
 const subscriberPassword=randomBytes(30).toString("base64url");
 const subscriberCreated=await admin.auth.admin.createUser({
  email:subscriberEmail,password:subscriberPassword,email_confirm:true});
 assert(!subscriberCreated.error&&UUID.test(subscriberCreated.data.user?.id||""),
  "STOP_O20_REAL_GOTRUE_SUBSCRIBER_CREATE");
 const subscriber=client(api,values.ANON_KEY);
 const subscriberLogin=await subscriber.auth.signInWithPassword({
  email:subscriberEmail,password:subscriberPassword});
 assert(!subscriberLogin.error&&subscriberLogin.data.user?.id===subscriberCreated.data.user.id&&
  subscriberLogin.data.session?.access_token,"STOP_O20_REAL_SUBSCRIBER_JWT");
 const nonMember=localSql("SELECT count(*) FROM mizizi_private.workspace_memberships"+
  " WHERE user_id='"+subscriberCreated.data.user.id+"'::uuid;",db);
 assert(nonMember==="0","STOP_O20_SUBSCRIBER_UNEXPECTED_WORKSPACE_MEMBERSHIP");
 requireDenied(await subscriber.rpc("admin_mizizi_cases_v1",{p_limit:100}),
  "42501","STOP_O20_SUBSCRIBER_CASE_READ");
 requireDenied(await subscriber.rpc("admin_mizizi_case_events_v1",
  {p_case_id:caseId,p_limit:100}),"42501","STOP_O20_SUBSCRIBER_CASE_JOURNAL");
 requireDenied(await subscriber.rpc("admin_mizizi_begin_case_research_v1",
  {p_case_id:caseId,p_expected_revision:1,
   p_reason:"Unprivileged subscriber cannot change a source-bound case."}),
  "42501","STOP_O20_SUBSCRIBER_CASE_TRANSITION");
 console.log("WK_AUTH_O20_REAL_SUBSCRIBER_SOURCE_CASE_READ_JOURNAL_AND_WRITE_DENIED=PASS");
 // O24: a genuine signed-in administrator with a valid REVIEWER membership
 // can read this case, but cannot perform a STEWARD-only stage transition.
 // This is distinct from the subscriber-with-no-membership denial above.
 const reviewerEmail="wk-local-reviewer-"+randomUUID()+"@example.test";
 const reviewerPassword=randomBytes(30).toString("base64url");
 const reviewerCreated=await admin.auth.admin.createUser({
  email:reviewerEmail,password:reviewerPassword,email_confirm:true});
 assert(!reviewerCreated.error&&UUID.test(reviewerCreated.data.user?.id||""),
  "STOP_O24_REAL_GOTRUE_REVIEWER_CREATE");
 const reviewer=client(api,values.ANON_KEY);
 const reviewerLogin=await reviewer.auth.signInWithPassword({
  email:reviewerEmail,password:reviewerPassword});
 assert(!reviewerLogin.error&&reviewerLogin.data.user?.id===reviewerCreated.data.user.id&&
  reviewerLogin.data.session?.access_token,"STOP_O24_REAL_REVIEWER_JWT");
 const reviewerId=reviewerCreated.data.user.id;
 localSql("BEGIN;\nINSERT INTO public.user_role_assignments("+
  "user_id,role_key,status,expires_at,notes) VALUES ('"+reviewerId+
  "'::uuid,'administrator','active',clock_timestamp()+interval '10 minutes',"+
  "'Disposable local O24 reviewer capability fixture.');\n"+
  "INSERT INTO mizizi_private.workspace_memberships("+
  "workspace_id,user_id,member_role,grant_source,granted_by,last_changed_by,"+
  "change_reason,valid_until) SELECT id,'"+reviewerId+
  "'::uuid,'reviewer','operator_review','"+first.id+"'::uuid,'"+
  first.id+"'::uuid,'Local real JWT reviewer must not perform steward transition.',"+
  "clock_timestamp()+interval '10 minutes' FROM mizizi_private.workspaces"+
  " WHERE workspace_key='wakilisha-internal' AND status='active';\nCOMMIT;",db);
 const reviewerVisible=await call(reviewer,"admin_mizizi_cases_v1",
  {p_limit:100},"STOP_O24_AUTH_REVIEWER_CASE_READ");
 assert(reviewerVisible.length===1&&reviewerVisible[0].caseId===caseId&&
  reviewerVisible[0].caseRevision===1,
  "STOP_O24_REVIEWER_LACKS_REAL_CASE_READ_ACCESS");
 const reviewerJournal=await call(reviewer,"admin_mizizi_case_events_v1",
  {p_case_id:caseId,p_limit:100},"STOP_O24_AUTH_REVIEWER_JOURNAL");
 assert(reviewerJournal.length===1&&reviewerJournal[0].type==="case_created",
  "STOP_O24_REVIEWER_JOURNAL_NOT_VISIBLE");
 requireDenied(await reviewer.rpc("admin_mizizi_begin_case_research_v1",{
  p_case_id:caseId,p_expected_revision:1,
  p_reason:"Reviewer can inspect evidence but may not start research."}),
  "42501","STOP_O24_REVIEWER_STAGE_ROLE_BOUNDARY");
 const reviewerImmutable=localSql("SELECT revision::text||'|'||case_state||'|'||"+
  "current_stage||'|'||(SELECT count(*)::text FROM mizizi_private.case_events"+
  " WHERE case_id='"+caseId+"'::uuid) FROM mizizi_private.cases"+
  " WHERE id='"+caseId+"'::uuid;",db);
 assert(reviewerImmutable==="1|open|triage|1",
  "STOP_O24_REVIEWER_DENIAL_CHANGED_CASE_OR_JOURNAL");
 console.log("WK_AUTH_O24_AUTHENTICATED_REVIEWER_READ_ALLOWED_STAGE_DENIED=PASS");
 const journal=await call(first.user,"admin_mizizi_case_events_v1",
  {p_case_id:caseId,p_limit:100},"STOP_REAL_JWT_EVENT_READ");
 assert(journal.length===1&&journal[0].type==="case_created",
  "STOP_SOURCE_CASE_JOURNAL_MISMATCH");
 const progressed=await call(first.user,"admin_mizizi_begin_case_research_v1",{
  p_case_id:caseId,p_expected_revision:1,
  p_reason:"Review verified disposable evidence before further research."},
  "STOP_REAL_JWT_CASE_RESEARCH_STAGE");
 assert(progressed.caseId===caseId&&progressed.revision===2&&
  progressed.stage==="research","STOP_CASE_REVISION_RECEIPT");
 console.log("WK_AUTH_REAL_JWT_SOURCE_CASE_STAGE2_RECEIPT=PASS");
 // O23: independently confirm the authenticated steward changed exactly
 // one source-backed case, retained the original open Registry review, and
 // appended one correctly attributed DB02 transition event.
 const o23State=localSql("SELECT "+
  "c.revision::text||'|'||c.case_state||'|'||c.current_stage||'|'||"+
  "(SELECT count(*)::text FROM mizizi_private.case_events e"+
  " WHERE e.case_id=c.id)||'|'||"+
  "(SELECT count(*)::text FROM mizizi_private.case_events e"+
  " WHERE e.case_id=c.id AND e.case_revision=2"+
  " AND e.event_type='case_state_changed' AND e.actor_key='user:"+first.id+"')||'|'||"+
  "(SELECT count(*)::text FROM mizizi_private.case_receipt_links l"+
  " JOIN public.registry_review_items r ON r.id=l.authority_id"+
  " WHERE l.case_id=c.id AND l.relation_type='review_item'"+
  " AND r.status='open' AND r.entity_id=c.subject_id"+
  " AND r.entity_type=c.subject_type)"+
  " FROM mizizi_private.cases c WHERE c.id='"+caseId+"'::uuid;",db);
 assert(o23State==="2|in_progress|research|2|1|1",
  "STOP_O23_SIGNED_IN_STAGE_OR_REGISTRY_REVIEW_DRIFT");
 console.log("WK_AUTH_O23_SIGNED_IN_STEWARD_STAGE2_REVIEW_AND_JOURNAL=PASS");
 const staleAttempt=await second.user.rpc("admin_mizizi_begin_case_research_v1",{
  p_case_id:caseId,p_expected_revision:1,
  p_reason:"Competing stale case revision must be denied."});
 if(staleAttempt.error?.code!=="PT409"){
  const current=localSql("SELECT revision::text||'|'||case_state||'|'||"+
   "current_stage||'|'||(SELECT count(*)::text FROM mizizi_private.case_events"+
   " WHERE case_id='"+caseId+"'::uuid) FROM mizizi_private.cases"+
   " WHERE id='"+caseId+"'::uuid;",db);
  const safe=(value)=>String(value||"NONE").replace(/[^A-Za-z0-9_.,:-]/g,"_").slice(0,100);
  console.error("WK_AUTH_STALE_RPC_HTTP_STATUS="+safe(staleAttempt.status));
  console.error("WK_AUTH_STALE_RPC_ERROR_CODE="+safe(staleAttempt.error?.code));
  console.error("WK_AUTH_STALE_RPC_ERROR_NAME="+safe(staleAttempt.error?.name));
  console.error("WK_AUTH_STALE_RPC_ERROR_KIND="+safe(staleAttempt.error?.message?.slice(0,72)));
  console.error("WK_AUTH_STALE_CASE_INDEPENDENT_DB="+safe(current));
 }
 requireDenied(staleAttempt,"PT409","STOP_STALE_AUTH_CASE_UPDATE");
 console.log("WK_AUTH_REAL_JWT_SOURCE_CASE_RESEARCH_AND_STALE_CAS=PASS");

 const holdKey="wk-jwt-local-"+randomUUID();
 const hold=await call(first.user,"admin_mizizi_hold_workspace_writes_v1",{
  p_hold_key:holdKey,
  p_reason:"Genuine signed-in operator sets disposable local Hold Writes.",
  p_review_after:null},"STOP_REAL_JWT_HOLD");
 assert(hold.status==="active"&&hold.revision===1&&UUID.test(hold.holdId||""),
  "STOP_AUTH_HOLD_RECEIPT");
 const visible=await call(second.user,"admin_mizizi_list_workspace_holds_v1",
  {p_limit:100},"STOP_SECOND_JWT_HOLD_VIEW");
 assert(visible.some(h=>h.holdId===hold.holdId&&h.status==="active"),
  "STOP_COMPETING_USER_CANNOT_SEE_HOLD");
 const args={p_hold_id:hold.holdId,p_expected_revision:1,
  p_reason:"Reviewed concurrent local Hold Writes release request safely."};
 const results=await Promise.all([
  first.user.rpc("admin_mizizi_release_workspace_hold_v1",args),
  second.user.rpc("admin_mizizi_release_workspace_hold_v1",args),
 ]);
 const succeeded=results.filter(x=>!x.error),lost=results.filter(x=>x.error?.code==="PT409");
 assert(succeeded.length===1&&lost.length===1&&
  succeeded[0].data?.revision===2,"STOP_TWO_AUTHENTICATED_RELEASE_CAS");
 const settled=await call(second.user,"admin_mizizi_list_workspace_holds_v1",
  {p_limit:100},"STOP_RECORDED_RELEASE_QUERY");
 assert(settled.filter(x=>x.holdId===hold.holdId&&
  x.status==="released"&&x.revision===2).length===1,"STOP_RELEASED_HOLD_READ");
 const evidence=localSql("SELECT (SELECT count(*) FROM mizizi_private.write_hold_events"+
  " WHERE hold_id='"+hold.holdId+"'::uuid AND event_kind='hold_released')::text||'|'||"+
  "(SELECT count(*) FROM platform_private.registry_execution_grants"+
  " WHERE status='active')::text;",db);
 assert(evidence==="1|0","STOP_DOUBLE_RELEASE_OR_ACTIVE_GRANT");
 console.log("WK_AUTH_TWO_REAL_JWTS_H39_CONCURRENT_HOLD_RELEASE_CAS=PASS");
 console.log("WK_AUTH_H36_H40_HOLD_READ_AND_SINGLE_RELEASE=PASS");

 // Reuse the same true signed-in operator and disposable Registry schema:
 // mint a real exact grant BEFORE an active hold, challenge it through the
 // unchanged public Artist merge command, and independently verify the result.
 const {verifyH38ExactGrantedWriterV1}=await import("./mizizi-slice1-h38-real-grant-ci.mjs");
 await verifyH38ExactGrantedWriterV1({sql:localSql,db,operator:first});
 console.log("WK_AUTH_H38_PRIOR_EXACT_GRANT_STALE_WRITER=PASS");

 // Real Admin Studio browser uses the exact same signed-in disposable users,
 // source-backed case and local Hold Writes history as the validated RPC test.
 const {verifyLocalHeadquartersBrowsersV1}=await import("./mizizi-slice1-real-browser-ci.mjs");
 await verifyLocalHeadquartersBrowsersV1({
  api,anonKey:values.ANON_KEY,first,second,caseId,
 });
 console.log("WK_AUTH_DESKTOP_MOBILE_BROWSER_AND_AUDIT=PASS");
 const kept=localSql("SELECT (SELECT count(*) FROM mizizi_private.cases WHERE id='"+
  caseId+"'::uuid AND revision=2 AND case_state='in_progress' AND current_stage='research')::text||'|'||"+
  "(SELECT count(*) FROM public.registry_review_items WHERE id=(SELECT authority_id FROM "+
  "mizizi_private.case_receipt_links WHERE case_id='"+caseId+"'::uuid "+
  "AND relation_type='review_item' LIMIT 1) AND status='open')::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.case_events WHERE case_id='"+
  caseId+"'::uuid)::text;",db);
 assert(kept==="1|1|2",
  "STOP_FOCUSED_REVIEW_DONE_FOR_NOW_SILENTLY_CHANGED_CASE_OR_REVIEW");
 console.log("WK_AUTH_REVIEW_DONE_FOR_NOW_NO_REGISTRY_DECISION_OR_CASE_MUTATION=PASS");

 // C14: separate durable case time-box by the actual signed-in steward.
 // Session-level Done for Now above intentionally made no case mutation.
 console.log("WK_C14_BEGIN_SIGNED_IN_RUNTIME=PASS");
 const boundedAt=new Date(Date.now()+15*60*1000).toISOString();
 const doneArgs={p_case_id:caseId,p_expected_revision:2,
  p_reason:"Reviewed this source-bound research case and scheduled follow-up.",
  p_next_action_at:boundedAt};
 requireDenied(await subscriber.rpc("admin_mizizi_done_for_now_case_v1",doneArgs),
  "42501","C14_NONMEMBER");
 requireDenied(await client(api,values.ANON_KEY).rpc(
  "admin_mizizi_done_for_now_case_v1",doneArgs),
  "42501","C14_ANON");
 console.log("WK_C14_AUTH_PERMISSION_NEGATIVES=PASS");
 const done=await call(first.user,"admin_mizizi_done_for_now_case_v1",
  doneArgs,"C14_OPERATOR");
 assert(done.caseId===caseId&&done.revision===3&&
  done.state==="done_for_now"&&done.stage==="research"&&
  Date.parse(done.nextActionAt)===Date.parse(boundedAt),
  "STOP_C14_AUTH_COMPLETION_RECEIPT");
 console.log("WK_C14_GENUINE_STEWARD_COMPLETED=PASS");
 requireDenied(await second.user.rpc("admin_mizizi_done_for_now_case_v1",doneArgs),
  "PT409","C14_STALE");
 requireDenied(await first.user.rpc("admin_mizizi_begin_case_research_v1",{
  p_case_id:caseId,p_expected_revision:3,
  p_reason:"Completed case cannot silently re-enter research stage."}),
  "55000","C14_REOPEN");
 const afterDone=localSql("SELECT "+
  "(SELECT count(*) FROM mizizi_private.cases WHERE id='"+caseId+
  "'::uuid AND revision=3 AND case_state='done_for_now' AND current_stage='research'"+
  " AND next_action_at IS NOT NULL)::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.case_events WHERE case_id='"+
  caseId+"'::uuid)::text||'|'||"+
  "(SELECT count(*) FROM public.registry_review_items WHERE id=(SELECT authority_id"+
  " FROM mizizi_private.case_receipt_links WHERE case_id='"+caseId+
  "'::uuid AND relation_type='review_item' LIMIT 1) AND status='open')::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.case_receipt_links WHERE case_id='"+
  caseId+"'::uuid AND relation_type='review_item')::text||'|'||"+
  "(SELECT count(*) FROM mizizi_private.case_observations WHERE case_id='"+
  caseId+"'::uuid)::text;",db);
 assert(afterDone==="1|3|1|1|1","C14_POSTCHECK");
 console.log("WK_C14_INDEPENDENT_DB_JOURNAL_AND_REVIEW=PASS");
 const releaseSlug=localSql("SELECT r.slug FROM public.registry_releases r"+
  " JOIN mizizi_private.cases c ON c.subject_id=r.id WHERE c.id='"+
  caseId+"'::uuid;",db);
 assert(/^wk-ci-worker-[a-z0-9]{12}$/.test(releaseSlug),"C14_RELEASE");
 const proposed=releaseSlug+"-accepted";
 const sourceId=localSql("SELECT subject_id::text FROM mizizi_private.cases"+
  " WHERE id='"+caseId+"'::uuid;",db);
 assert(UUID.test(sourceId),"C14_SUBJECT");
 const workspaceId=localSql("SELECT id::text FROM mizizi_private.workspaces"+
  " WHERE workspace_key='wakilisha-internal' AND status='active';",db);
 assert(UUID.test(workspaceId),"C14_WORKSPACE");
 const sourceFP=localSql("SELECT mizizi_private.finding_fingerprint_v1("+
  "'release_slug_provider_packaging','1.2.0','release','"+
  sourceId+"','slug','"+releaseSlug+"','"+proposed+"');",db);
 assert(/^[0-9a-f]{64}$/.test(sourceFP),"C14_FINGERPRINT");
 const gatewayProof=localSql(
  "BEGIN; SET SESSION AUTHORIZATION mizizi_executor;"+
  "DO $wk_c14_real_authenticated_case$ DECLARE denied boolean:=false; BEGIN "+
  "BEGIN PERFORM * FROM mizizi_private.admit_review_case_gateway_v1("+
  "'"+workspaceId+"'::uuid,"+
  "'wk-ci-local-worker',jsonb_build_object("+
  "'entityType','release','entityId','"+sourceId+"',"+
  "'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0',"+
  "'fieldName','slug','currentValue','"+releaseSlug+"',"+
  "'proposedValue','"+proposed+"','fingerprint','"+sourceFP+"',"+
  "'confidence',1,'severity','high','disposition','review',"+
  "'reason','Disposable local source-bound worker lease acceptance.',"+
  "'evidence',jsonb_build_object('fixture','ci-only')));"+
  " EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END; "+
  "IF NOT denied THEN RAISE EXCEPTION 'STOP_C14_REAL_COMPLETED_CASE_GATEWAY_REPLAY_ACCEPTED';"+
  " END IF; END $wk_c14_real_authenticated_case$;"+
  " SET SESSION AUTHORIZATION DEFAULT; ROLLBACK;"+
  " SELECT 'WK_AUTH_C14_SIGNED_IN_DURABLE_COMPLETION_TRUSTED_REPLAY_DENIED=PASS';",db);
 assert(gatewayProof==="WK_AUTH_C14_SIGNED_IN_DURABLE_COMPLETION_TRUSTED_REPLAY_DENIED=PASS",
  "C14_REPLAY");
 console.log(gatewayProof);
 console.log("WK_AUTH_C14_REAL_JWT_DURABLE_TIMEBOX_CAS_AND_REVIEW_INTACT=PASS");

 // C18: two real signed-in reviewers see the same revision before
 // simultaneously requesting a stage transition. Keep this *additional*
 // source-backed case after browser and C14 acceptance to preserve the exact
 // one-case browser/export contract. Disposable local database only.
 const raceReleaseId=randomUUID();
 const raceSlug="wk-ci-c18-"+raceReleaseId.slice(0,12);
 const raceProposed=raceSlug+"-accepted";
 localSql("INSERT INTO public.registry_releases"+
  " (id,slug,title,normalized_title,status,metadata) VALUES ('"+
  raceReleaseId+"'::uuid,'"+raceSlug+
  "','C18 Disposable Review','c18 disposable review','active',"+
  "jsonb_build_object('test_fixture','c18-local-only'));",db);
 const raceFingerprint=localSql(
  "SELECT mizizi_private.finding_fingerprint_v1("+
  "'release_slug_provider_packaging','1.2.0','release','"+
  raceReleaseId+"','slug','"+raceSlug+"','"+raceProposed+"');",db);
 assert(/^[0-9a-f]{64}$/.test(raceFingerprint),
  "STOP_C18_APPROVED_SOURCE_FINGERPRINT_MISSING");
 localSql("BEGIN; SET SESSION AUTHORIZATION mizizi_executor;"+
  "DO $wk_c18_trusted_source$ DECLARE v_result record; BEGIN "+
  "SELECT * INTO STRICT v_result FROM mizizi_private.admit_review_case_gateway_v1("+
  "'"+workspaceId+"'::uuid,'wk-ci-local-worker',jsonb_build_object("+
  "'entityType','release','entityId','"+raceReleaseId+"',"+
  "'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0',"+
  "'fieldName','slug','currentValue','"+raceSlug+"',"+
  "'proposedValue','"+raceProposed+"','fingerprint','"+raceFingerprint+"',"+
  "'confidence',1,'severity','high','disposition','review',"+
  "'reason','Independent source-bound C18 concurrent case claim.',"+
  "'evidence',jsonb_build_object('fixture','ci-only'))); "+
  "IF v_result.outcome<>'created' OR v_result.headquarters_case_revision<>1 "+
  "OR v_result.review_item_id IS NULL OR v_result.receipt_link_id IS NULL "+
  "THEN RAISE EXCEPTION 'STOP_C18_TRUSTED_SOURCE_ADMISSION'; END IF; "+
  "END $wk_c18_trusted_source$; "+
  "SET SESSION AUTHORIZATION DEFAULT; COMMIT;",db);
 const raceCaseId=localSql("SELECT id::text FROM mizizi_private.cases "+
  "WHERE workspace_id='"+workspaceId+"'::uuid AND subject_type='release'"+
  " AND subject_id='"+raceReleaseId+"'::uuid AND revision=1"+
  " AND case_state='open' AND current_stage='triage';",db);
 assert(UUID.test(raceCaseId),"STOP_C18_SOURCE_BOUND_CASE_NOT_ADMITTED");
 const bothBefore=await Promise.all([
  call(first.user,"admin_mizizi_cases_v1",{p_limit:100},"STOP_C18_FIRST_READ"),
  call(second.user,"admin_mizizi_cases_v1",{p_limit:100},"STOP_C18_SECOND_READ"),
 ]);
 assert(bothBefore.every(rows=>rows.filter(item=>item.caseId===raceCaseId&&
  item.caseRevision===1&&item.stage==="triage"&&UUID.test(item.reviewId||""))
  .length===1),"STOP_C18_BOTH_AUTH_OPERATORS_MUST_SEE_REVISION_ONE");
 console.log("WK_AUTH_C18_TWO_REAL_JWTS_SAME_SOURCE_CASE_REVISION_ONE=PASS");
 const raceArgs=(reason)=>({p_case_id:raceCaseId,p_expected_revision:1,
  p_reason:reason});
 const raceResults=await Promise.all([
  first.user.rpc("admin_mizizi_begin_case_research_v1",
   raceArgs("First reviewer concurs that source-backed research should begin.")),
  second.user.rpc("admin_mizizi_begin_case_research_v1",
   raceArgs("Second reviewer independently seeks the same case revision.")),
 ]);
 const winners=raceResults.filter(x=>!x.error);
 const losers=raceResults.filter(x=>x.error?.code==="PT409");
 assert(winners.length===1&&losers.length===1&&
  winners[0].data?.caseId===raceCaseId&&
  winners[0].data?.revision===2&&winners[0].data?.stage==="research",
  "STOP_C18_TWO_REVIEWERS_EXPECT_EXACTLY_ONE_CAS_WINNER_"+
  raceResults.map(x=>String(x.error?.code||"SUCCESS")
   .replace(/[^A-Za-z0-9_]/g,"")).join("_"));
 const winningActor=raceResults[0].error?second.id:first.id;
 const raceProof=localSql("SELECT "+
  "c.revision::text||'|'||c.case_state||'|'||c.current_stage||'|'||"+
  "(SELECT count(*)::text FROM mizizi_private.case_events e"+
  " WHERE e.case_id=c.id)||'|'||"+
  "(SELECT count(*)::text FROM mizizi_private.case_events e"+
  " WHERE e.case_id=c.id AND e.case_revision=2"+
  " AND e.event_type='case_state_changed' AND e.actor_key='user:"+
  winningActor+"')||'|'||"+
  "(SELECT count(*)::text FROM mizizi_private.case_receipt_links l"+
  " JOIN public.registry_review_items r ON r.id=l.authority_id"+
  " WHERE l.case_id=c.id AND l.relation_type='review_item'"+
  " AND r.status='open' AND r.entity_id=c.subject_id"+
  " AND r.entity_type=c.subject_type)||'|'||"+
  "(SELECT count(*)::text FROM platform_private.registry_execution_grants"+
  " WHERE status='active')"+
  " FROM mizizi_private.cases c WHERE c.id='"+raceCaseId+"'::uuid;",db);
 assert(raceProof==="2|in_progress|research|2|1|1|0",
  "STOP_C18_CONCURRENT_CAS_OR_REGISTRY_REVIEW_AUDIT_DRIFT");
 console.log("WK_AUTH_C18_GENUINE_CONCURRENT_REVIEWERS_SINGLE_CAS_JOURNAL=PASS");

 // Capability re-evaluation with an unchanged genuine JWT.
 localSql("UPDATE public.user_role_assignments SET expires_at="+
  "clock_timestamp()-interval '1 second' WHERE user_id='"+
  first.id+"'::uuid AND role_key='administrator';",db);
 requireDenied(await first.user.rpc("admin_mizizi_cases_v1",{p_limit:100}),
  "42501","STOP_EXPIRED_PLATFORM_CAPABILITY_ACCEPTED");
 console.log("WK_AUTH_SAME_REAL_JWT_EXPIRED_CAPABILITY_DENIED=PASS");
 console.log("WK_AUTH_ALL_IDENTITIES_AND_CASES=DISPOSABLE_LOCAL_ONLY");
}
main().catch(error=>{
 console.error("WK_AUTH_STOP="+String(error?.message||"UNKNOWN")
  .replace(/[A-Za-z0-9_-]{48,}/g,"[redacted]").slice(0,230));
 process.exitCode=1;
});

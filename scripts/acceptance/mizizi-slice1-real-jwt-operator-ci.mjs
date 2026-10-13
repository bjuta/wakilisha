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
 assert(baseline==="227|20261013190100|0|0|0|0|0",
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
  people.push({id:created.data.user.id,user});
 }
 const first=people[0],second=people[1];
 console.log("WK_AUTH_TWO_GENUINE_SIGNED_IN_LOCAL_USERS=PASS");
 requireDenied(await client(api,values.ANON_KEY).rpc("admin_mizizi_cases_v1",
  {p_limit:100}),"42501","STOP_ANON_ACCESS");
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

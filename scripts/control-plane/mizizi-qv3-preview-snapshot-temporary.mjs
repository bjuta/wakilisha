// Temporary, read-only exact Preview before/after snapshot for QV3 one-file push.
import {readFileSync,writeFileSync} from "node:fs";
import {queryViaManagementReadOnly} from "./mizizi-production-jit-runtime.mjs";
const REF="nkgfoppunmnkcumalxqp";
const PROD="pgzizndxdyhqmtyywjmt";
const phase=process.env.WK_QV3_PHASE;
const token=process.env.SUPABASE_ACCESS_TOKEN||"";
if(REF===PROD||!token||!["before","after"].includes(phase)||
 process.env.PREVIEW_REF!==REF)throw Error("STOP_QV3_PREVIEW_BOUNDARY");
const sql=`with protected as (
 select jsonb_build_object(
  'cases',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.cases t),
  'case_events',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.case_events t),
  'research_passes',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.research_passes t),
  'question_versions',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.case_question_versions t),
  'workspace_memberships',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.workspace_memberships t),
  'holds',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.write_holds t),
  'hold_events',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.write_hold_events t),
  'jobs',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from platform_private.jobs t),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from mizizi_private.case_receipt_links t),
  'registry_assertions',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from platform_private.registry_evidence_assertions t),
  'editorial_sources',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from editorial.sources t),
  'editorial_source_versions',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from editorial.source_versions t),
  'editorial_source_links',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from editorial.source_registry_links t)
 ) body
)
select
 (select count(*)::int from supabase_migrations.schema_migrations) migration_count,
 (select max(version) from supabase_migrations.schema_migrations) migration_head,
 (select count(*)::int from mizizi_private.cases) cases,
 (select count(*)::int from mizizi_private.research_passes) passes,
 (select count(*)::int from mizizi_private.case_question_versions) questions,
 (select count(*)::int from platform_private.registry_evidence_assertions) assertions,
 (select count(*)::int from editorial.sources) sources,
 (select count(*)::int from mizizi_private.workspace_memberships) memberships,
 (select count(*)::int from mizizi_private.write_holds) holds,
 to_regclass('mizizi_private.question_source_attestation_events')::text qv3_table,
 to_regprocedure('public.admin_mizizi_attest_question_source_v1(uuid,integer,uuid,integer,uuid,uuid,uuid,text,text,text,text,text,text,text)')::text qv3_writer,
 (select encode(extensions.digest(convert_to(body::text,'UTF8'),'sha256'),'hex') from protected) fingerprint`;
const row=await queryViaManagementReadOnly({projectRef:REF,token,sql});
const valid=(row.cases===1&&row.passes===2&&row.questions===0&&
 row.assertions===0&&row.sources===0&&row.memberships===1&&row.holds===1&&
 /^[a-f0-9]{64}$/.test(row.fingerprint||""));
if(!valid)throw Error("STOP_QV3_EXISTING_PREVIEW_DATA_DRIFT");
const path=process.env.RUNNER_TEMP+"/wk-qv3-preview-before.json";
if(phase==="before"){
 if(row.migration_count!==236||row.migration_head!=="20261017202800"||
  row.qv3_table!==null||row.qv3_writer!==null)
  throw Error("STOP_QV3_PREVIEW_PRESTATE_NOT_236");
 writeFileSync(path,JSON.stringify({fingerprint:row.fingerprint}));
 console.log("WK_QV3_BEFORE_236_EXACT_DATA_FINGERPRINT=PASS");
}else{
 if(row.migration_count!==237||row.migration_head!=="20261017212255"||
  row.qv3_table!=="mizizi_private.question_source_attestation_events"||
  row.qv3_writer!==
   "admin_mizizi_attest_question_source_v1(uuid,integer,uuid,integer,uuid,uuid,uuid,text,text,text,text,text,text,text)")
  throw Error("STOP_QV3_PREVIEW_POSTSTATE_NOT_237");
 const before=JSON.parse(readFileSync(path,"utf8"));
 if(before.fingerprint!==row.fingerprint)
  throw Error("STOP_QV3_EXISTING_PREVIEW_ROWS_CHANGED");
 console.log("WK_QV3_AFTER_237_ALL_PREEXISTING_DATA_PRESERVED=PASS");
}

#!/usr/bin/env python3
from pathlib import Path
import json
import re
import subprocess
import sys

EDGE=Path('supabase/functions/chart-ingest-api/index.ts')
VERIFIER=Path('scripts/control-plane/verify-registry-chart-materialization-runtime.sql')
MANIFEST=Path('scripts/control-plane/registry-privileged-writer-manifest.json')
LEDGER=Path('docs/engineering/mizizi-registry-authority-ledger.md')
TEST=Path('test/registry/mizizi-cultural-data-steward.test.ts')
PROVIDER=Path('supabase/functions/chart-provider-fetch/index.ts')
MIGRATION=Path('supabase/migrations/20260915122100_chart_runtime_caller_jwt_convergence_v1.sql')

EXPECTED={
 EDGE:'9a2de5a776bfa92f15ede2125186734b11c669ab',
 VERIFIER:'75b2088bf9cd73236de83987d3b8a71f18ee1f84',
 MANIFEST:'942b0ca620f49d185e861628e7550e19256afe90',
 LEDGER:'b7444975aa65cc848b1777d5b607448dd89ed440',
 TEST:'3adaefa7384d5b02d1aa811472a2763124848145',
}

def fail(msg): raise SystemExit('STOP: '+msg)
def blob(path): return subprocess.check_output(['git','hash-object',str(path)],text=True).strip()
def one(text,old,new,label):
    n=text.count(old)
    if n!=1: fail(f'{label}: expected 1 match, found {n}')
    return text.replace(old,new,1)
def region(text,start,end,new,label):
    if text.count(start)!=1: fail(f'{label}: start count {text.count(start)}')
    if text.count(end)!=1: fail(f'{label}: end count {text.count(end)}')
    a=text.index(start); b=text.index(end,a+len(start))
    return text[:a]+new.rstrip()+'\n\n'+text[b:]

for p,h in EXPECTED.items():
    got=blob(p); print(f'BLOB {p}={got}')
    if got!=h: fail(f'base blob drift: {p}')
if not PROVIDER.exists() or not MIGRATION.exists(): fail('additive runtime files missing')

edge=EDGE.read_text()
edge=one(edge,'import { canonicalTrackSlugCandidate } from "../_shared/registry-track-identity.ts";\n','', 'retire chart-local Track writer import')
edge=one(edge,'const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;','const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;','caller JWT key')

old='''async function verifyJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }

async function requireCap(userId: string, cap: string, db?: ReturnType<typeof createClient>): Promise<boolean> { const c=db??createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c of caps)all.add(c.capability_key);} return all.has(cap); }'''
new='''function callerClient(req: Request): ReturnType<typeof createClient> {
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer ")) throw new Error("Bearer authorization is required.");
  return createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
}

async function verifyJwt(req: Request): Promise<{id:string;email?:string}|null> {
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer ")) return null;
  const token=authorization.replace("Bearer ","");
  const db=callerClient(req);
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user) return null;
  return {id:user.id,email:user.email};
}

async function requireCap(db: ReturnType<typeof createClient>,cap:string): Promise<boolean> {
  const {data,error}=await db.rpc("current_user_has_capability",{required_capability:cap});
  return !error&&data===true;
}'''
edge=one(edge,old,new,'caller auth block')
edge=one(edge,'''  const requiredCapability = ACTION_CAPABILITIES[action];
  if (requiredCapability) { const can = await requireCap(auth.id, requiredCapability); if (!can) return json(req, { error: "forbidden" }, 403); }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);''','''  const db=callerClient(req);
  const requiredCapability=ACTION_CAPABILITIES[action];
  if(requiredCapability){const can=await requireCap(db,requiredCapability);if(!can)return json(req,{error:"forbidden"},403);}''','caller dispatch')

# Retire chart-local slug writer helpers before normalizeSlug.
a=edge.find('function generateTrackSlug('); b=edge.find('function normalizeSlug',a)
if a<0 or b<0: fail('slug writer helper boundary missing')
edge=edge[:a]+edge[b:]

provider='''async function fetchProviderSource(
  req: Request,
  provider: string,
  sourceUrl: string,
  market: string,
  maxRows: number,
): Promise<ProviderFetchResult> {
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer ")) return {tracks:[],warnings:[],error:"Provider fetch requires caller bearer token."};
  let response:Response;
  try {
    response=await fetch(`${SUPABASE_URL}/functions/v1/chart-provider-fetch`,{
      method:"POST",
      headers:{Authorization:authorization,apikey:ANON_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({provider,sourceUrl,market,maxRows}),
    });
  } catch(error) {
    return {tracks:[],warnings:[],error:"Chart provider fetch unavailable: "+(error instanceof Error?error.message:String(error))};
  }
  let payload:ProviderFetchResult;
  try { payload=await response.json() as ProviderFetchResult; }
  catch { return {tracks:[],warnings:[],error:`Chart provider fetch returned invalid JSON (${response.status}).`}; }
  if(!response.ok) return {tracks:[],warnings:payload.warnings??[],error:payload.error||`Chart provider fetch failed (${response.status}).`};
  return {tracks:Array.isArray(payload.tracks)?payload.tracks:[],warnings:Array.isArray(payload.warnings)?payload.warnings:[],error:payload.error??null};
}'''
edge=region(edge,'async function readCredential(','function anchorToMonday(',provider,'provider runtime')
edge=one(edge,'const fr = await fetchProviderSource(source.provider as string, source.source_url as string, market, mr, db);','const fr = await fetchProviderSource(req, source.provider as string, source.source_url as string, market, mr);','provider fetch invocation')

# Remove direct Registry helpers, leaving parseArtists and downstream chart logic.
edge=region(edge,'// REGISTRY RESOLUTION HELPERS','function parseArtists','''// REGISTRY MATERIALIZATION
// Canonical Registry writes are delegated to the governed Slice-2 RPC family.''','direct Registry helper family')

materializer='''
interface ChartMaterializationResult {
  run_id:string; candidate_id:string; track_id:string; track_slug:string;
  track_created:boolean; track_operation_id?:string;
  primary_artist_id:string; primary_artist_slug:string;
  artists:Array<{artist_id:string;artist_slug:string;artist_name:string;created:boolean;operation_id?:string}>;
  credits:Array<{credit_id:string;artist_id:string;created:boolean;operation_id?:string}>;
}

async function materializeChartCandidate(db:ReturnType<typeof createClient>,runId:string,candidateId:string):Promise<ChartMaterializationResult>{
  const {data,error}=await db.rpc("chart_materialize_candidate_registry_v1",{p_run_id:runId,p_candidate_id:candidateId});
  if(error) throw new Error(`Governed Registry materialization failed for candidate ${candidateId}: ${error.message}`);
  const result=(data??{}) as unknown as ChartMaterializationResult;
  if(!result.track_id||!result.track_slug||!result.primary_artist_id||!result.primary_artist_slug) throw new Error(`Governed Registry materialization returned incomplete identity for candidate ${candidateId}.`);
  return {...result,artists:Array.isArray(result.artists)?result.artists:[],credits:Array.isArray(result.credits)?result.credits:[]};
}
'''
edge=one(edge,'\n// ── HANDLERS ──',materializer+'\n// ── HANDLERS ──','materializer insertion')

fix='''async function handleFixChartArtistSlugs(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,user:{id:string;email?:string}) {
  const {editionId,dryRun}=params as {editionId?:string;dryRun?:boolean};
  const isDryRun=dryRun!==false; const now=new Date().toISOString();
  const {data:rows,error}=await db.rpc("chart_get_entry_registry_identity_v1",{p_edition_id:editionId||null});
  if(error) return json(req,{error:"canonical_identity_lookup_failed",detail:error.message},500);
  const fixes:Array<{id:string;track_title:string;artist_name:string;current_slug:string;correct_slug:string;method:string}>=[]; const skipped:string[]=[];
  for(const raw of rows||[]){
    const row=raw as {entry_id?:string;track_title?:string;artist_name?:string;current_artist_slug?:string;canonical_track_id?:string;canonical_primary_artist_slug?:string};
    const id=String(row.entry_id||""); const title=String(row.track_title||""); const artist=String(row.artist_name||"");
    const current=normalizeSlug(String(row.current_artist_slug||"")); const correct=normalizeSlug(String(row.canonical_primary_artist_slug||""));
    if(!id||!row.canonical_track_id||!correct){skipped.push(`${title} by ${artist} (no canonical primary credit)`);continue;}
    if(current===correct)continue;
    fixes.push({id,track_title:title,artist_name:artist,current_slug:current,correct_slug:correct,method:"canonical_track_primary_credit"});
  }
  if(isDryRun)return json(req,{ok:true,dry_run:true,total_entries:(rows||[]).length,to_fix:fixes.length,skipped:skipped.length,fix_preview:fixes.slice(0,50),skipped_samples:skipped.slice(0,20)});
  let fixed=0;
  for(const item of fixes){const {error:updateError}=await db.from("wk_chart_entries_v2").update({artist_slug:item.correct_slug,updated_at:now}).eq("id",item.id);if(!updateError)fixed++;}
  await db.from("chart_ingest_audit_events").insert({run_id:editionId||"global",actor:user.id,actor_email:user.email||null,action:"fix_artist_slugs",new_status:"fixed",payload_json:{fixed,skipped:skipped.length,dryRun:false,totalEntries:(rows||[]).length},created_at:now});
  return json(req,{ok:true,fixed,skipped:skipped.length,total_entries:(rows||[]).length,skipped_samples:skipped.slice(0,20)});
}'''
edge=region(edge,'async function handleFixChartArtistSlugs(','async function handleReingestEdition(',fix,'fix artist slugs')

reingest='''async function handleReingestEdition(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,user:{id:string;email?:string}) {
  const {editionId,dryRun}=params as {editionId:string;dryRun?:boolean}; if(!editionId)return json(req,{error:"editionId_required"},400);
  const isDryRun=dryRun!==false; const now=new Date().toISOString();
  const {data:edition,error:editionError}=await db.from("wk_chart_editions_v2").select("id, edition_slug, ingest_run_id").eq("id",editionId).maybeSingle();
  if(editionError)return json(req,{error:"edition_lookup_failed",detail:editionError.message},500); if(!edition)return json(req,{error:"edition_not_found"},404);
  const runId=String(edition.ingest_run_id||"");
  const {data:entries,error:entryError}=await db.from("wk_chart_entries_v2").select("*").eq("edition_id",editionId).order("rank",{ascending:true});
  if(entryError)return json(req,{error:"entry_lookup_failed",detail:entryError.message},500); if(!entries?.length)return json(req,{error:"no_entries"},400);
  const stats={total:entries.length,tracks_found:0,tracks_created:0,artists_found:0,artists_created:0,links_created:0,artist_slugs_fixed:0,track_slugs_normalized:0,canonical_ids_set:0,errors:0};
  const repairs:Array<{id:string;track_title:string;artist_name:string;action:string}>=[];
  for(const entry of entries){
    const id=String(entry.id||""); const title=String(entry.track_title||""); const artist=String(entry.artist_name||""); const key=String(entry.normalized_key||""); const existing=String(entry.canonical_track_id||"");
    try{
      if(!runId||!key){if(existing){stats.tracks_found++;repairs.push({id,track_title:title,artist_name:artist,action:"existing_canonical_binding_preserved"});continue;}throw new Error("missing_original_run_candidate_binding");}
      const {data:candidates,error:candidateError}=await db.from("chart_ingest_candidates").select("id").eq("run_id",runId).eq("normalized_key",key).limit(2);
      if(candidateError)throw new Error("candidate_binding_lookup_failed:"+candidateError.message);
      if(!candidates||candidates.length!==1){if(existing){stats.tracks_found++;repairs.push({id,track_title:title,artist_name:artist,action:"existing_canonical_binding_preserved_without_unique_candidate"});continue;}throw new Error(candidates?.length?"ambiguous_original_candidate_binding":"missing_original_candidate_binding");}
      const candidateId=String(candidates[0].id); if(isDryRun){repairs.push({id,track_title:title,artist_name:artist,action:`would_materialize_candidate:${candidateId}`});continue;}
      const result=await materializeChartCandidate(db,runId,candidateId); if(result.track_created)stats.tracks_created++;else stats.tracks_found++;
      for(const a of result.artists){if(a.created)stats.artists_created++;else stats.artists_found++;} stats.links_created+=result.credits.filter(c=>c.created).length;
      const trackSlug=normalizeSlug(result.track_slug); const artistSlug=normalizeSlug(result.primary_artist_slug);
      if(trackSlug!==String(entry.track_slug||""))stats.track_slugs_normalized++; if(artistSlug!==String(entry.artist_slug||""))stats.artist_slugs_fixed++;
      const {error:updateError}=await db.from("wk_chart_entries_v2").update({canonical_track_id:result.track_id,track_slug:trackSlug,artist_slug:artistSlug,updated_at:now}).eq("id",id);
      if(updateError)throw new Error("chart_entry_update_failed:"+updateError.message); stats.canonical_ids_set++; repairs.push({id,track_title:title,artist_name:artist,action:result.track_created?`created_track:${trackSlug}`:`linked_track:${trackSlug}`});
    }catch(error){stats.errors++;repairs.push({id,track_title:title,artist_name:artist,action:"ERROR:"+(error instanceof Error?error.message:String(error))});}
  }
  await db.from("chart_ingest_audit_events").insert({run_id:editionId,actor:user.id,actor_email:user.email||null,action:"reingest_edition",new_status:isDryRun?"dry_run":"done",payload_json:{...stats,edition_slug:edition.edition_slug,dryRun:isDryRun},created_at:now});
  return json(req,{ok:stats.errors===0,dry_run:isDryRun,edition_slug:String(edition.edition_slug||""),stats,repairs:repairs.slice(0,100)});
}'''
edge=region(edge,'async function handleReingestEdition(','async function handleCreateDryRun(',reingest,'reingest')

commit='''async function handleCommitRun(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,user:{id:string;email?:string}) {
  const {runId,publishImmediately,notes}=params as {runId:string;publishImmediately?:boolean;notes?:string}; if(!runId)return json(req,{error:"runId_required"},400);
  const {error:gateError}=await db.rpc("chart_assert_committable_run",{p_run_id:runId}); if(gateError)return json(req,{error:"commit_blocked_chart_run_integrity",detail:gateError.message},400);
  const {data:run,error:runError}=await db.from("chart_ingest_runs").select("*").eq("id",runId).maybeSingle(); if(runError)return json(req,{error:"run_lookup_failed",detail:runError.message},500); if(!run)return json(req,{error:"run_not_found"},404);
  const now=new Date().toISOString(); const editionDate=String(run.edition_date||now.split("T")[0]); const chartSize=Number(run.chart_size||20); const programId=String(run.program_id||"unknown"); const actor=user.email||user.id;
  const {data:candidates,error:candidateError}=await db.from("chart_ingest_candidates").select("*").eq("run_id",runId).eq("status","eligible").order("created_at"); if(candidateError)return json(req,{error:"candidate_lookup_failed",detail:candidateError.message},500); if(!candidates?.length)return json(req,{error:"no_eligible_candidates"},400);
  const ids=candidates.map(c=>String(c.id)); const {data:scores,error:scoreError}=await db.from("chart_ingest_candidate_scores").select("*").in("candidate_id",ids); if(scoreError)return json(req,{error:"score_lookup_failed",detail:scoreError.message},500);
  const scoreMap=new Map<string,Record<string,unknown>>(); for(const s of scores||[])scoreMap.set(String(s.candidate_id),s);
  const top=[...candidates].sort((a,b)=>{const sa=Number(scoreMap.get(String(a.id))?.final_score??0);const sb=Number(scoreMap.get(String(b.id))?.final_score??0);return sb!==sa?sb-sa:String(a.normalized_key||"").localeCompare(String(b.normalized_key||""));}).slice(0,chartSize);
  const prevRanks=new Map<string,number>(); const prevKeys=new Set<string>();
  try{const {data:prev}=await db.from("wk_chart_editions_v2").select("id").eq("program_id",programId).in("status",["committed","published"]).lt("edition_date",editionDate).order("edition_date",{ascending:false}).limit(1).maybeSingle();if(prev){const {data:rows}=await db.from("wk_chart_entries_v2").select("normalized_key, rank").eq("edition_id",prev.id);for(const row of rows||[]){const key=String(row.normalized_key||"");if(key){prevRanks.set(key,Number(row.rank));prevKeys.add(key);}}}}catch{}
  const registryStats={tracks_found:0,tracks_created:0,artists_found:0,artists_created:0,links_created:0,previews_set:0,errors:0}; const materialized=new Map<string,ChartMaterializationResult>();
  for(const c of top){const candidateId=String(c.id);try{const result=await materializeChartCandidate(db,runId,candidateId);materialized.set(candidateId,result);if(result.track_created)registryStats.tracks_created++;else registryStats.tracks_found++;for(const a of result.artists){if(a.created)registryStats.artists_created++;else registryStats.artists_found++;}registryStats.links_created+=result.credits.filter(x=>x.created).length;}catch(error){registryStats.errors++;return json(req,{error:"registry_materialization_failed",candidateId,detail:error instanceof Error?error.message:String(error),registryStats},409);}}
  const editionId=crypto.randomUUID(); const {data:program}=await db.from("wk_chart_programs_v2").select("public_slug, public_label").eq("id",programId).maybeSingle(); const editionSlug=editionDate;
  const {error:editionError}=await db.from("wk_chart_editions_v2").insert({id:editionId,program_id:programId,edition_slug:editionSlug,edition_label:String(program?.public_label||"Chart Edition"),edition_date:editionDate,period_start:run.period_start||editionDate,period_end:run.period_end||editionDate,entry_count:top.length,status:publishImmediately?"published":"committed",methodology_version:String(run.methodology_version||"1.0.0"),rule_set_snapshot:(run.rule_snapshot_json as Record<string,unknown>)||{},chart_size:chartSize,ingest_run_id:runId,published_at:publishImmediately?now:null,published_by:publishImmediately?actor:null,created_at:now,updated_at:now}); if(editionError)return json(req,{error:"edition_create_failed",detail:editionError.message},500);
  const rows:Array<Record<string,unknown>>=[];
  for(let i=0;i<top.length;i++){const c=top[i];const candidateId=String(c.id);const result=materialized.get(candidateId);if(!result){await db.from("wk_chart_editions_v2").delete().eq("id",editionId);return json(req,{error:"materialization_result_missing",candidateId},500);}const rank=i+1;const key=String(c.normalized_key||"");const previous=prevRanks.get(key)??null;let movement:string|null=null;if(previous===null)movement=prevKeys.has(key)?"reentry":"new";else if(rank===previous)movement="same";else movement=rank<previous?"up":"down";rows.push({id:crypto.randomUUID(),edition_id:editionId,rank,previous_rank:previous,movement,track_title:String(c.title||""),artist_name:String(c.artist_display||""),artwork_url:c.artwork_url||null,normalized_key:key,lead_artist_key:String(c.lead_artist_key||""),track_slug:normalizeSlug(result.track_slug),artist_slug:normalizeSlug(result.primary_artist_slug),canonical_track_id:result.track_id,total_score:Number(scoreMap.get(candidateId)?.final_score??0),carry_forward_only:Boolean(c.carry_forward_only),release_date:sanitizeDate(c.release_date as string),source_count:Number(c.source_count||0),occurrence_count:Number(c.occurrence_count||0),created_at:now,updated_at:now});}
  const {error:entryError}=await db.from("wk_chart_entries_v2").insert(rows);if(entryError){await db.from("wk_chart_editions_v2").delete().eq("id",editionId);return json(req,{error:"entry_create_failed",detail:entryError.message},500);}
  const status=publishImmediately?"published":"committed"; const {error:updateError}=await db.from("chart_ingest_runs").update({status,committed_at:now,commit_edition_id:editionId,notes:notes??null,updated_at:now}).eq("id",runId);if(updateError)return json(req,{error:"run_commit_state_update_failed",detail:updateError.message},500);
  await db.from("chart_ingest_stage_events").update({status:"done",finished_at:now,message:`${top.length} entries committed.`}).eq("run_id",runId).eq("stage","commit_write"); await db.from("chart_ingest_audit_events").insert({run_id:runId,actor:user.id,actor_email:actor,action:"run_committed",new_status:status,payload_json:{editionId,editionSlug,entryCount:top.length}});
  return json(req,{runId,status,editionId,editionSlug,entryCount:top.length,publicUrl:`/charts/${String(program?.public_slug||programId)}/${editionSlug}`,registryStats,integrity:{ok:true,warnings:[],errors:[]}});
}'''
edge=region(edge,'async function handleCommitRun(','async function handleRunAirplayDetection(',commit,'commit')

origin='''async function handleSetArtistOriginForRun(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,_user:{id:string;email?:string}) {
  const {artistId,originIso2,runId,candidateId,note}=params as {artistId:string;originIso2:string;runId:string;candidateId:string;note?:string};
  if(!artistId)return json(req,{error:"artistId_required"},400);if(!originIso2)return json(req,{error:"originIso2_required"},400);if(!runId)return json(req,{error:"runId_required"},400);if(!candidateId)return json(req,{error:"candidateId_required"},400);
  const {data,error}=await db.rpc("chart_admit_artist_origin_v1",{p_artist_id:artistId,p_origin_iso2:originIso2,p_run_id:runId,p_candidate_id:candidateId,p_note:note||"Resolved from chart origin queue."});
  if(error)return json(req,{error:error.message},500);return json(req,{ok:true,result:data});
}'''
edge=region(edge,'async function handleSetArtistOriginForRun(','async function handleCreateOriginArtistShell(',origin,'origin admission')

shell='''async function handleCreateOriginArtistShell(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,_user:{id:string;email?:string}) {
  const {artistName,originIso2,runId,candidateId}=params as {artistName:string;originIso2:string;runId:string;candidateId:string};
  if(!artistName)return json(req,{error:"artistName_required"},400);if(!originIso2)return json(req,{error:"originIso2_required"},400);if(!runId)return json(req,{error:"runId_required"},400);if(!candidateId)return json(req,{error:"candidateId_required"},400);
  const {data,error}=await db.rpc("chart_create_artist_origin_shell_v1",{p_artist_name:artistName,p_origin_iso2:originIso2,p_run_id:runId,p_candidate_id:candidateId});
  if(error)return json(req,{error:error.message},500);return json(req,{ok:true,result:data});
}'''
edge=region(edge,'async function handleCreateOriginArtistShell(','async function handleResetAfterOriginResolution(',shell,'origin shell')

for old,new in [('"chart_get_run_origin_review_queue"','"chart_get_run_origin_review_queue_v1"'),('"chart_reset_run_after_origin_resolution"','"chart_reset_run_after_origin_resolution_v1"'),('"chart_get_family_ingest_presets"','"chart_get_family_ingest_presets_v1"'),('"chart_get_weekly_backfill_plan"','"chart_get_weekly_backfill_plan_v1"'),('"chart_upsert_family_ingest_preset"','"chart_upsert_family_ingest_preset_v1"')]: edge=one(edge,old,new,'RPC '+old)
edge=one(edge,'    p_config_json: config || {},\n    p_actor_user_id: user.id,\n','    p_config_json: config || {},\n','preset actor derivation')

for bad in ['SUPABASE_SERVICE_ROLE_KEY','SERVICE_KEY','admin_settings_secrets','chart_set_artist_origin_for_charts','"chart_create_artist_origin_shell"','findOrCreateRegistryTrack','findOrCreateRegistryArtist','uniqueArtistSlug','ensureTrackArtistLink']:
    if bad in edge: fail('chart runtime forbidden authority remains: '+bad)
if re.search(r'\.from\(["\']registry_(?:artists|tracks|track_artists)["\']\)[\s\S]{0,600}?\.(?:insert|update|delete|upsert)\s*\(',edge): fail('direct Registry DML remains')
for good in ['SUPABASE_ANON_KEY','/functions/v1/chart-provider-fetch','chart_materialize_candidate_registry_v1','chart_admit_artist_origin_v1','chart_create_artist_origin_shell_v1','chart_get_entry_registry_identity_v1']:
    if good not in edge: fail('chart runtime missing '+good)
EDGE.write_text(edge)

# Extend existing permanent verifier instead of adding a parallel verifier file.
ver=VERIFIER.read_text()
if 'REGISTRY_CHART_CALLER_JWT_CONVERGENCE_PASS' in ver: fail('convergence verifier already present')
ver+='''\n\n-- Permanent verifier for #939 final chart caller-JWT convergence.\ndo $verify_chart_caller_jwt$\ndeclare v_signature text; v_definition text;\nbegin\n  if not has_table_privilege('authenticated','public.wk_chart_editions_v2','insert') or not has_table_privilege('authenticated','public.wk_chart_editions_v2','update') or not has_table_privilege('authenticated','public.wk_chart_editions_v2','delete') or not has_table_privilege('authenticated','public.wk_chart_entries_v2','insert') or not has_table_privilege('authenticated','public.wk_chart_entries_v2','update') or not has_table_privilege('authenticated','public.wk_chart_entries_v2','delete') then raise exception 'Chart caller-JWT output grants incomplete'; end if;\n  foreach v_signature in array array['public.chart_get_run_origin_review_queue_v1(text)','public.chart_get_family_ingest_presets_v1()','public.chart_get_weekly_backfill_plan_v1(text,date,date)','public.chart_reset_run_after_origin_resolution_v1(text)','public.chart_upsert_family_ingest_preset_v1(text,jsonb)','public.chart_get_entry_registry_identity_v1(text)'] loop if to_regprocedure(v_signature) is null or not has_function_privilege('authenticated',v_signature,'execute') or has_function_privilege('anon',v_signature,'execute') or has_function_privilege('service_role',v_signature,'execute') then raise exception 'Chart caller-JWT wrapper privilege drifted: %',v_signature; end if; end loop;\n  select pg_get_functiondef('public.chart_get_entry_registry_identity_v1(text)'::regprocedure) into v_definition; if position('publish_charts' in v_definition)=0 or position('registry_tracks' in v_definition)=0 or position('registry_track_artists' in v_definition)=0 then raise exception 'Chart identity read wrapper drifted'; end if;\n  if has_function_privilege('authenticated','public.chart_set_artist_origin_for_charts(uuid,text,text,text,text,text)','execute') or has_function_privilege('service_role','public.chart_set_artist_origin_for_charts(uuid,text,text,text,text,text)','execute') or has_function_privilege('authenticated','public.chart_create_artist_origin_shell(text,text,text,text,text)','execute') or has_function_privilege('service_role','public.chart_create_artist_origin_shell(text,text,text,text,text)','execute') then raise exception 'Legacy chart origin road remains executable'; end if;\n  if exists(select 1 from public.role_capabilities p where p.capability_key='publish_charts' and (not exists(select 1 from public.role_capabilities m where m.role_key=p.role_key and m.capability_key='manage_charts') or not exists(select 1 from public.role_capabilities v where v.role_key=p.role_key and v.capability_key='view_charts_admin'))) then raise exception 'publish_charts role bundle lost chart RLS prerequisites'; end if;\n  if exists(select 1 from public.role_capabilities i where i.capability_key='manage_ingest' and not exists(select 1 from public.role_capabilities m where m.role_key=i.role_key and m.capability_key='manage_charts')) then raise exception 'manage_ingest role bundle lost manage_charts'; end if;\n  raise notice 'REGISTRY_CHART_CALLER_JWT_CONVERGENCE_PASS';\nend\n$verify_chart_caller_jwt$;\n'''
VERIFIER.write_text(ver)

manifest=json.loads(MANIFEST.read_text()); matches=[w for w in manifest['writers'] if w.get('id')=='chart-ingest-api']
if len(matches)!=1: fail('chart-ingest manifest entry count '+str(len(matches)))
matches[0].update({'authentication':'request_bearer_user','authorization':'action_specific_capabilities','executionAuthority':'caller_jwt_rls_plus_typed_registry_operations','targets':['wk_chart_programs_v2','wk_chart_editions_v2','wk_chart_entries_v2','chart_materialize_candidate_registry_v1','chart_admit_artist_origin_v1','chart_create_artist_origin_shell_v1'],'riskClass':'high','disposition':'keep','futureBoundary':'caller_jwt_rls_and_typed_registry_operations','canonicalMutation':False,'legacyDebt':False}); manifest['status']='slice_2_chart_runtime_converged'; MANIFEST.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')

ledger=LEDGER.read_text(); start='### 6.5 `chart-ingest-api`'; end='### 6.6 `admin-router`'
newsec='''### 6.5 `chart-ingest-api`\n\n**Live posture**\n\n- ACTIVE deployment\n- request-bearer authentication\n- action-specific capability checks\n- caller-JWT + RLS for Chart-domain reads and writes\n- no `SUPABASE_SERVICE_ROLE_KEY` load\n- no direct canonical Registry DML\n- provider fetch delegated to `chart-provider-fetch`, which returns provider data rather than credentials\n\n**Canonical authority**\n\nArtist creation, Track creation, and Track↔Artist credit admission route through `chart_materialize_candidate_registry_v1(...)`. Existing-Artist origin admission routes through `chart_admit_artist_origin_v1(...)`, and unresolved Artist origin creation routes through `chart_create_artist_origin_shell_v1(...)`.\n\n`chart-ingest-api` is therefore an orchestration boundary, not a canonical Registry writer.\n\n`chart-provider-fetch` is a narrow provider boundary: it verifies the request user and `manage_ingest`, reads the existing Admin-managed provider secret store server-side, performs the provider request, and returns normalized provider data. It has no Registry authority.\n\n**Current consumer**\n\nCurrent Charts admin client is wired directly to `chart-ingest-api`.\n\n**Decision**: `KEEP / SLICE-2 CONVERGED`. Preserve caller identity, Chart RLS, and governed typed Registry operations. Keep the superseded service-role origin roads revoked.\n'''
ledger=region(ledger,start,end,newsec,'authority ledger section'); LEDGER.write_text(ledger)

# Update the existing critical MIZIZI test to reflect that chart-ingest is no longer a direct Track writer.
test=TEST.read_text(); test=one(test,'    const chartIngest =\n      readFileSync(\n        "supabase/functions/chart-ingest-api/index.ts",\n        "utf8",\n      );\n','', 'old chart writer fixture'); test=one(test,'    expect(chartIngest).toContain(\n      \'from "../_shared/registry-track-identity.ts"\',\n    );\n    expect(chartIngest).toContain(\n      "trackSlugCollisionInArtistScope",\n    );\n    expect(chartIngest).not.toContain(\n      "uniqueTrackSlug",\n    );\n','', 'old chart writer assertions'); test=one(test,'  it("binds live Registry Track writers to the shared identity rule", () => {','  it("binds remaining live Registry Track writers to the shared identity rule", () => {','writer test title')
insert='''  it("converges chart runtime onto caller-JWT and governed Registry authority", () => {\n    const chartIngest=readFileSync("supabase/functions/chart-ingest-api/index.ts","utf8");\n    const providerFetch=readFileSync("supabase/functions/chart-provider-fetch/index.ts","utf8");\n    const migration=readFileSync("supabase/migrations/20260915122100_chart_runtime_caller_jwt_convergence_v1.sql","utf8");\n    const manifest=JSON.parse(readFileSync("scripts/control-plane/registry-privileged-writer-manifest.json","utf8")) as {writers:Array<{id:string;executionAuthority:string;canonicalMutation:boolean}>};\n    expect(chartIngest).toContain("SUPABASE_ANON_KEY"); expect(chartIngest).not.toContain("SUPABASE_SERVICE_ROLE_KEY"); expect(chartIngest).not.toContain("admin_settings_secrets"); expect(chartIngest).toContain("/functions/v1/chart-provider-fetch"); expect(chartIngest).toContain("chart_materialize_candidate_registry_v1"); expect(chartIngest).toContain("chart_admit_artist_origin_v1"); expect(chartIngest).toContain("chart_create_artist_origin_shell_v1"); expect(chartIngest).not.toContain("chart_set_artist_origin_for_charts");\n    expect(providerFetch).toContain("SUPABASE_SERVICE_ROLE_KEY"); expect(providerFetch).toContain("admin_settings_secrets"); expect(providerFetch).toContain('required_capability: "manage_ingest"'); expect(providerFetch).not.toContain("registry_");\n    expect(manifest.writers.find(w=>w.id==="chart-ingest-api")).toMatchObject({executionAuthority:"caller_jwt_rls_plus_typed_registry_operations",canonicalMutation:false});\n    expect(migration).toContain("chart_get_entry_registry_identity_v1"); expect(migration).toContain("revoke all on function public.chart_set_artist_origin_for_charts"); expect(migration).not.toContain("wk_chart_editions_v2_publish_charts_insert_v1");\n  });\n\n'''
marker='  it("binds remaining live Registry Track writers to the shared identity rule", () => {'
if marker not in test: fail('new test insertion marker missing')
test=test.replace(marker,insert+marker,1); TEST.write_text(test)

# Exact final source checks.
for bad in ['SUPABASE_SERVICE_ROLE_KEY','admin_settings_secrets','chart_set_artist_origin_for_charts','findOrCreateRegistryTrack','findOrCreateRegistryArtist','ensureTrackArtistLink']:
    if bad in EDGE.read_text(): fail('forbidden source remains '+bad)
subprocess.run(['git','diff','--check'],check=True)
print('WK939_RUNTIME_APPLY_PASS')

#!/usr/bin/env node
// Local execution only. Never posts statuses, merges, dispatches, links or deploys.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fs.realpathSync(new URL('../..',import.meta.url).pathname);
process.chdir(root);
const plans=JSON.parse(fs.readFileSync('ops/local/workflow-plan.json'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function stop(s){throw Error(s);}
function capture(cmd,args,opts={}) {
 const r=spawnSync(cmd,args,{encoding:'utf8',...opts});
 if(r.status!==0)stop(`${cmd} failed (${r.status})`);
 return r.stdout.trim();
}
export function auditPlans(){
 for(const [id,p] of Object.entries(plans)) {
  if(sha(fs.readFileSync(`ops/local/workflows/${id}.yml`))!==p.sha256)stop('Archived workflow drift: '+id);
  const parsed=JSON.parse(capture('ruby',['-ryaml','-rjson','-e','puts JSON.generate(YAML.load_file(ARGV[0])["jobs"])',`ops/local/workflows/${id}.yml`]));
  if(JSON.stringify(parsed)!==JSON.stringify(p.jobs))stop('Plan differs from archived jobs: '+id);
  const active=fs.readFileSync(`.github/workflows/${id}.yml`,'utf8');
  if(!active.includes('on:\n  workflow_dispatch:\n') || /\n  (push|pull_request|schedule):/.test(active))stop('Automatic Actions trigger: '+id);
  const jobs=active.split('\njobs:\n')[1]?.match(/^  [\w-]+:\n    if: \$\{\{ false \}\}$/gm);
  if(jobs?.length!==Object.keys(p.jobs).length)stop('Runnable Actions job: '+id);
 }
 const active=fs.readdirSync('.github/workflows').filter(x=>/\.ya?ml$/.test(x));
 if(active.length!==Object.keys(plans).length)stop('Unaudited workflow');
}
auditPlans();
const core=plans['critical-control-plane'].jobs['critical-core'].steps;
const blockedCore=new Set(['Require Supabase control-plane access','Resolve public RLS test credentials','Run critical security and lifecycle tests','Detect live schema and migration-history drift']);
const lanes={
 core:core.filter(s=>s.run&&!blockedCore.has(s.name)).map(s=>({...s,run:s.name.startsWith('Enforce authoritative ERN')?'bash scripts/music-standards/verify-ern432-authoritative-conformance.sh':s.run})),
 browser:plans['critical-control-plane'].jobs['critical-browser'].steps.filter(s=>s.run&&!s.name.includes('preflight')),
 'source-preflight':plans['critical-control-plane'].jobs['critical-browser'].steps.filter(s=>s.name.includes('source preflight')).map(s=>({...s,run:s.run.replace("${RUNNER_TEMP:-/tmp}","${TMPDIR:-/tmp}")})),
 'mizizi-sql':plans['mizizi-slice1-disposable-postgres'].jobs['disposable-worker-sql'].steps.filter(s=>s.run&&!/Destroy/.test(s.name)),
 'mizizi-auth':plans['mizizi-slice1-disposable-postgres'].jobs['disposable-operator-jwt'].steps.filter(s=>s.run&&!/Destroy|Install/.test(s.name)),
 wk100:plans['wk100-disposable-security'].jobs['disposable-wk100-security'].steps.filter(s=>s.run&&!/Destroy|Install/.test(s.name)).map(s=>({...s,run:s.run.replace('test "$GITHUB_EVENT_NAME" = pull_request','node scripts/local/disposable-context.mjs'),env:s.env?{WK100_LIVE_SOURCE_ACCEPTANCE:'true'}:undefined})),
};
const lane=process.argv[2];
if(lane==='audit'){console.log('LOCAL_WORKFLOW_AUDIT=PASS; eight retired workflows; no runner allocation');process.exit(0);}
if(!lanes[lane])stop('Choose: audit, core, browser, source-preflight, mizizi-sql, mizizi-auth, wk100. Release remains BLOCKED until all scopes and remote/provenance/protection gates pass.');
if(process.argv.includes('--plan')){console.log(JSON.stringify({lane,steps:lanes[lane],blockedReleaseGates:['live security and schema drift','three production control-plane preflights','public runtime watch','trusted local replay provenance','enforced merge protection'],productionMutation:false},null,2));process.exit(0);}
if(process.platform!=='darwin'||process.versions.node.split('.')[0]!=='22')stop('Run on macOS with pinned Node 22');
// Ambient credentials and repository .env files never enter the execution clone.
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:os.tmpdir(),LANG:'en_US.UTF-8',CI:'true',CONTROL_PLANE_BASE_REF:'origin/main'};
const dirty=capture('git',['status','--porcelain']);
if(dirty)stop('Commit reviewed changes before running acceptance; dirty trees are not evidence');
const head=capture('git',['rev-parse','HEAD']);
const base=capture('git',['rev-parse','refs/remotes/origin/main']);
const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'wakilisha-local-'));
fs.chmodSync(dir,0o700);
const reportDir=path.join(root,'artifacts','local',path.basename(dir));fs.mkdirSync(reportDir,{recursive:true,mode:0o700});
const report={kind:'mac-local-verification-v1',lane,head,base,platform:os.platform(),arch:os.arch(),node:process.version,plan_sha256:sha(fs.readFileSync('ops/local/workflow-plan.json')),started:new Date().toISOString(),result:'running',releaseAcceptance:'blocked',steps:[],scratch:dir};
const save=()=>fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
let database=false,locked=false;const lock=path.join(fs.realpathSync(os.tmpdir()),'wakilisha-local-disposable.lock');
function command(name,script,extra={}) {
 if(script.includes('${{'))stop('Untranslated Actions expression: '+name);
 const started=Date.now();
 const r=spawnSync('/bin/bash',['-euo','pipefail','-c',script],{cwd:dir,env:{...env,...extra},encoding:'utf8',timeout:30*60*1000,maxBuffer:32*1024*1024});
 const log=String(r.stdout??'')+String(r.stderr??'');
 const index=report.steps.length;
 const captures=path.join(dir,'test-results');
 if(fs.existsSync(captures))fs.cpSync(captures,path.join(reportDir,`captures-${index}`),{recursive:true});
 fs.writeFileSync(path.join(reportDir,`${index}.log`),log,{mode:0o600});
 report.steps.push({name,exit:r.status,signal:r.signal,error:r.error?.code,elapsed_ms:Date.now()-started,log_sha256:sha(log)});save();
 console.log(`${r.status===0?'PASS':'FAIL'} ${name}`);
 if(r.status!==0)stop(`${name} failed; private evidence: ${reportDir}`);
}
try {
 capture('git',['clone','--shared','--no-checkout',root,dir]);capture('git',['checkout','--detach',head],{cwd:dir});
 capture('git',['update-ref','refs/remotes/origin/main',base],{cwd:dir});
 // Dependencies are installed in the scratch tree; no user checkout is modified.
 command('locked dependencies','npm ci --ignore-scripts --no-audit --no-fund');
 const dbLane=['mizizi-sql','mizizi-auth','wk100'].includes(lane);
 if(dbLane){
  fs.mkdirSync(lock);locked=true;
  const existing=capture('docker',['ps','-a','--filter','name=^supabase_','--format','{{.Names}}'],{env});
  const volumes=capture('docker',['volume','ls','--filter','name=supabase_','--format','{{.Name}}'],{env});
  if(existing||volumes)stop('Existing Supabase resources: refusing to start, target or destroy them');
  if(capture('supabase',['--version'],{env})!=='2.121.0')stop('Disposable Supabase CLI must be 2.121.0');
  // The stack project ID is unique, and legacy broad discovery is safe only after the empty-host check.
  const config=path.join(dir,'supabase/config.toml');fs.writeFileSync(config,`project_id = "${path.basename(dir)}"\n`+fs.readFileSync(config,'utf8'));
  Object.assign(env,{WK_LOCAL_DISPOSABLE:'1',WK_LOCAL_DISPOSABLE_DIR:dir});
  database=true;
 }
 if(lane==='browser'||lane==='mizizi-auth')command('Chromium installation','./node_modules/.bin/playwright install chromium');
 for(const s of lanes[lane])command(s.name,s.run,s.env??{});
 // Copy before later browser invocations clear test-results (each invocation is preserved).
 report.result='pass';
} catch(e){report.result='fail';report.reason=e.message;console.error(e.message);process.exitCode=1;}
finally {
 if(database){
  try{
   command('Destroy only this newly owned disposable stack','supabase stop --no-backup');
   const owned=capture('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${path.basename(dir)}`,'--format','{{.Names}}'],{env});
   const volumes=capture('docker',['volume','ls','--filter',`label=com.supabase.cli.project=${path.basename(dir)}`,'--format','{{.Name}}'],{env});
   if(owned||volumes)stop('Owned resources remain');report.cleanup='pass';
  }catch(e){report.cleanup='fail';report.result='fail';report.reason=e.message;process.exitCode=1;}
 }
 if(locked)fs.rmdirSync(lock);
 const files=[];
 function inventory(d,rel=''){for(const ent of fs.readdirSync(d,{withFileTypes:true})){const r=path.join(rel,ent.name);if(ent.isDirectory())inventory(path.join(d,ent.name),r);else if(ent.name!=='report.json')files.push({path:r,sha256:sha(fs.readFileSync(path.join(d,ent.name)))});}}
 inventory(reportDir);report.files=files;report.finished=new Date().toISOString();save();console.log('Local evidence: '+reportDir);
}

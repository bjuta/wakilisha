#!/usr/bin/env node
/**
 * Real GoTrue-issued authenticated JWT vs PRIVATE WK100 Storage in a disposable
 * local Supabase stack. No hosted Preview/Production credentials or endpoints.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
const check=(condition,code)=>{if(!condition) throw new Error(code);};
const UUID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
function env(){
  const lines=execFileSync('supabase',['status','-o','env'],{encoding:'utf8'}).split(/\r?\n/);
  const values={};
  for(const line of lines){
    const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if(m)values[m[1]]=m[2].replace(/^["']|["']$/g,'');
  }
  return values;
}
function query(sql,container){
  const p=spawnSync('docker',['exec','-i',container,'psql','-X','-q','-A','-t',
    '-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],{
    input:sql,encoding:'utf8',timeout:45000,maxBuffer:256*1024});
  check(!p.error && p.status===0,'STOP_DISPOSABLE_LOCAL_SQL_FAILED');
  return p.stdout.trim();
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const client=(url,key)=>createClient(url,key,{auth:{autoRefreshToken:false,
  persistSession:false,detectSessionInUrl:false}});
async function main(){
  check(process.env.GITHUB_ACTIONS==='true'&&
   process.env.GITHUB_EVENT_NAME==='pull_request'&&
   !process.env.SUPABASE_PROJECT_REF&&!process.env.SUPABASE_ACCESS_TOKEN&&
   !existsSync('supabase/.temp/project-ref'),
   'STOP_NOT_UNLINKED_DISPOSABLE_PR_RUNNER');
  const v=env(); const url=v.API_URL||v.SUPABASE_URL;
  const parsed=new URL(url||'http://invalid.invalid');
  check(parsed.protocol==='http:'&&parsed.hostname==='127.0.0.1'&&
    parsed.port==='54321'&&parsed.pathname==='/'&&
    v.ANON_KEY&&v.SERVICE_ROLE_KEY,'STOP_NOT_LOCAL_AUTH_AND_STORAGE');
  const c=execFileSync('docker',['ps','--filter','name=^supabase_db_',
    '--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  check(c.length===1,'STOP_LOCAL_POSTGRES_CONTAINER_CARDINALITY');
  const db=c[0];
  check(query("SELECT (SELECT count(*) FROM supabase_migrations.schema_migrations)::text||'|'||"+
    "(SELECT count(*) FROM auth.users)::text||'|'||"+
    "(SELECT count(*) FROM storage.objects WHERE bucket_id='wk-chart-raw-evidence-v1')::text;",db)
    ==='234|0|0','STOP_LOCAL_234_AUTH_AND_STORAGE_NOT_EMPTY');
  const admin=client(url,v.SERVICE_ROLE_KEY),anon=client(url,v.ANON_KEY);
  const identity=randomUUID(); const email=`wk100-ci-${identity}@example.test`;
  const password=randomBytes(30).toString('base64url');
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  check(!created.error&&UUID.test(created.data.user?.id||''),
    'STOP_LOCAL_GOTRUE_SYNTHETIC_USER_CREATE');
  const signed=client(url,v.ANON_KEY);
  const login=await signed.auth.signInWithPassword({email,password});
  check(!login.error&&login.data.user?.id===created.data.user.id&&
    !!login.data.session?.access_token,'STOP_REAL_SIGNED_IN_SESSION_MISSING');
  const token=login.data.session.access_token;
  const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
  const verified=await signed.auth.getUser();
  check(payload.role==='authenticated'&&payload.sub===created.data.user.id&&
    payload.exp>Math.floor(Date.now()/1000)&&
    !verified.error&&verified.data.user?.id===created.data.user.id,
    'STOP_GOTRUE_AUTHENTICATED_IDENTITY_NOT_PROVEN');
  console.log('WK100_GENUINE_LOCAL_GOTRUE_SIGNED_IN_USER=PASS');
  const bucket='wk-chart-raw-evidence-v1';
  const key=`acceptance/wk100-auth-disposable/${identity}.bin`;
  const raw=Buffer.from(`WK100 isolated private sentinel ${identity}`,'utf8');
  const upload=await admin.storage.from(bucket).upload(key,raw,{
    contentType:'application/octet-stream',upsert:false,cacheControl:'0'});
  check(!upload.error,'STOP_LOCAL_PRIVATE_SERVICE_UPLOAD_FAILED');
  const own=await admin.storage.from(bucket).download(key);
  check(!own.error&&own.data&&
    sha(Buffer.from(await own.data.arrayBuffer()))===sha(raw),
    'STOP_LOCAL_SERVICE_RAW_BYTE_DIGEST_MISMATCH');
  console.log('WK100_LOCAL_PRIVATE_SERVICE_BYTE_READBACK_SHA256=PASS');
  const denied=await signed.storage.from(bucket).download(key);
  check(!!denied.error&&!denied.data,
    'STOP_REAL_AUTHENTICATED_USER_READS_PRIVATE_RAW_OBJECT');
  const anonymous=await anon.storage.from(bucket).download(key);
  check(!!anonymous.error&&!anonymous.data,
    'STOP_ANONYMOUS_READS_PRIVATE_RAW_OBJECT');
  const listed=await signed.storage.from(bucket).list('acceptance/wk100-auth-disposable');
  check(!!listed.error||!listed.data?.some(x=>x.name===`${identity}.bin`),
    'STOP_SIGNED_IN_USER_LISTS_PRIVATE_RAW_OBJECT');
  console.log('WK100_GENUINE_AUTHENTICATED_USER_PRIVATE_DOWNLOAD_AND_LIST_DENIED=PASS');
  console.log('WK100_ANONYMOUS_PRIVATE_DOWNLOAD_DENIED=PASS');
  const removed=await admin.storage.from(bucket).remove([key]);
  check(!removed.error,'STOP_LOCAL_PRIVATE_OBJECT_CLEANUP_FAILED');
  check(query("SELECT count(*) FROM storage.objects WHERE bucket_id='wk-chart-raw-evidence-v1';",db)==='0',
    'STOP_LOCAL_PRIVATE_STORAGE_CLEANUP_NOT_EMPTY');
  const deleted=await admin.auth.admin.deleteUser(created.data.user.id);
  check(!deleted.error,'STOP_LOCAL_AUTH_USER_CLEANUP_FAILED');
  check(query('SELECT count(*) FROM auth.users;',db)==='0',
    'STOP_LOCAL_AUTH_USER_RETAINED');
  console.log('WK100_SYNTHETIC_LOCAL_STORAGE_AND_AUTH_CLEANUP=PASS');
  console.log('WK100_NO_HOSTED_SUPABASE_PROVIDER_OR_PRODUCTION_ACCESS=PASS');
}
main().catch(e=>{console.error(String(e?.message||'STOP_UNKNOWN').replace(/[^a-zA-Z0-9_ .:-]/g,'_').slice(0,140));process.exitCode=1;});

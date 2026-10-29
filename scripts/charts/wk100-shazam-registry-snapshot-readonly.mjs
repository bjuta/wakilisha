/**
 * WK100 Shazam: independently fingerprinted read-only Production Registry export.
 * No chart/provider requests, Registry DML, canonical links or scoring.
 * The expected index digest MUST come independently from a trusted read-only
 * control plane; never generate that expected value from the same export.
 */
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, lstat, open, link, readFile, unlink} from 'node:fs/promises';
import {join, resolve, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';

const PROJECT='pgzizndxdyhqmtyywjmt';
const SHA=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISRC=/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
const MAX=5000;
const reject=code=>{throw Error(`wk100_registry_snapshot_${code}`);};
const digest=x=>createHash('sha256').update(x).digest('hex');
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const isUTC=x=>typeof x==='string'&&UTC.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().replace('.000Z','Z')===x;

export const REGISTRY_INDEX_SQL=`SELECT id::text AS id, status, isrc
FROM public.registry_tracks
WHERE status = 'active'
ORDER BY id ASC`;
export const REGISTRY_INDEPENDENT_FINGERPRINT_SQL=`SELECT count(*)::int AS active_count,
       count(DISTINCT isrc)::int AS distinct_isrc_count,
       count(*) FILTER (WHERE isrc IS NULL OR isrc !~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$')::int AS invalid_isrc_count,
       encode(digest(coalesce(string_agg(id::text || E'\\t' || status || E'\\t' || isrc,
         E'\\n' ORDER BY id), ''), 'sha256'), 'hex') AS index_sha256,
       to_char(transaction_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS as_of
FROM public.registry_tracks WHERE status = 'active'`;

/** Verify independent Production fingerprint and the whole active Track set. */
export function validateRegistryIndex(rows,summary,expectedIndexSha256){
  if(!SHA.test(expectedIndexSha256||''))reject('independent_fingerprint_missing');
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX)reject('row_count');
  if(!summary||!Number.isInteger(summary.active_count)||
    !Number.isInteger(summary.distinct_isrc_count)||
    !Number.isInteger(summary.invalid_isrc_count)||
    !SHA.test(summary.index_sha256||'')||!isUTC(summary.as_of))reject('server_summary_invalid');
  if(summary.active_count!==rows.length || summary.distinct_isrc_count!==rows.length ||
    summary.invalid_isrc_count!==0)reject('server_count_conflict');
  const ids=new Set(),isrcs=new Set();let prior='';
  for(const row of rows){
    if(!row||Object.keys(row).sort().join(',')!=='id,isrc,status'||
      !UUID.test(row.id)||row.status!=='active'||!ISRC.test(row.isrc)||
      ids.has(row.id)||isrcs.has(row.isrc)||row.id<=prior)reject('registry_row_invalid');
    prior=row.id;ids.add(row.id);isrcs.add(row.isrc);
  }
  const material=rows.map(r=>`${r.id}\t${r.status}\t${r.isrc}`).join('\n');
  const indexSha256=digest(Buffer.from(material,'utf8'));
  if(indexSha256!==summary.index_sha256)reject('database_result_mismatch');
  if(indexSha256!==expectedIndexSha256)reject('independent_fingerprint_mismatch');
  const snapshot={schema_version:'wk100-shazam-registry-snapshot-v1',
    as_of:summary.as_of,coverage:'complete_active_isrc_index',tracks:rows.map(r=>({...r}))};
  const snapshotBytes=Buffer.from(JSON.stringify(snapshot),'utf8');
  return Object.freeze({snapshot,snapshotBytes,snapshot_sha256:digest(snapshotBytes),
    index_sha256:indexSha256,active_tracks:rows.length,can_publish:false,
    canonical_identity_admitted:false});
}

/** Transaction-scoped repeatable-read complete active index, read-only by SQL. */
export async function readRegistryIndex(query,expectedIndexSha256){
  if(typeof query!=='function')reject('reader_missing');
  let begun=false;
  try{
    await query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
    const {rows:items}=await query(REGISTRY_INDEX_SQL);
    const result=await query(REGISTRY_INDEPENDENT_FINGERPRINT_SQL);
    if(!result||!Array.isArray(result.rows)||result.rows.length!==1)reject('server_summary_invalid');
    const exportResult=validateRegistryIndex(items,result.rows[0],expectedIndexSha256);
    await query('COMMIT');begun=false;
    return exportResult;
  }catch(e){if(begun)await query('ROLLBACK').catch(()=>{});throw e;}
}

/** Lock destination to a dedicated private folder and never overwrite evidence. */
export async function writePrivateRegistrySnapshot(directory,exportResult){
  if(typeof directory!=='string'||!isAbsolute(directory))reject('archive_path');
  const d=resolve(directory);
  await mkdir(d,{recursive:true,mode:0o700});
  const st=await lstat(d);
  if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077))reject('archive_directory_unsafe');
  const bytes=exportResult?.snapshotBytes;
  if(!(bytes instanceof Uint8Array)||digest(bytes)!==exportResult.snapshot_sha256)reject('export_invalid');
  const path=join(d,`${exportResult.snapshot_sha256}.registry.json`);
  const temp=`${path}.${randomUUID()}.partial`;
  let handle;
  try{
    handle=await open(temp,'wx',0o600);
    await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
    try{await link(temp,path)}catch(e){if(e.code!=='EEXIST')throw e;}
    const fs=await lstat(path);
    if(!fs.isFile()||fs.isSymbolicLink()||(fs.mode&0o077))reject('archive_file_unsafe');
    if(digest(await readFile(path))!==exportResult.snapshot_sha256)reject('archive_bytes_mismatch');
    return {saved:true,snapshot_sha256:exportResult.snapshot_sha256,
      index_sha256:exportResult.index_sha256,active_tracks:exportResult.active_tracks,
      can_publish:false,canonical_identity_admitted:false};
  }finally{if(handle)await handle.close().catch(()=>{});await unlink(temp).catch(()=>{});}
}

export function validateRegistryDatabaseUrl(raw){
  if(typeof raw!=='string'||!raw)reject('connection_missing');
  let url;try{url=new URL(raw)}catch{reject('connection_invalid')}
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.password.length<1||
    url.searchParams.has('sslmode')&&url.searchParams.get('sslmode')==='disable'||
    url.hash)reject('connection_invalid');
  const direct=url.hostname===`db.${PROJECT}.supabase.co`&&url.username==='postgres';
  const pooler=url.hostname.endsWith('.pooler.supabase.com')&&
    url.hostname.length>('.pooler.supabase.com'.length)&&
    url.username===`postgres.${PROJECT}`;
  if(!direct&&!pooler)reject('project_binding_invalid');
  if(url.pathname!=='/postgres')reject('database_name_invalid');
  return raw;
}

export async function runRegistrySnapshotCli(argv=process.argv.slice(2),env=process.env){
  if(argv.length!==4||argv[0]!=='--archive-dir'||argv[2]!=='--expected-index-sha256')
    reject('usage');
  const [dir,expected]=[argv[1],argv[3]];
  if(!SHA.test(expected))reject('independent_fingerprint_missing');
  const uri=validateRegistryDatabaseUrl(env.WK100_REGISTRY_DATABASE_URL);
  const {default:pg}=await import('pg');
  // Enforce verified TLS independently of URL sslmode values; never print a secret.
  const clean=new URL(uri);clean.searchParams.delete('sslmode');
  const client=new pg.Client({connectionString:clean.toString(),ssl:{rejectUnauthorized:true},
    application_name:'wk100_shazam_readonly_registry_snapshot',connectionTimeoutMillis:12000});
  try{
    await client.connect();
    const result=await readRegistryIndex(sql=>client.query(sql),expected);
    const out=await writePrivateRegistrySnapshot(dir,result);
    process.stdout.write(`WK100_REGISTRY_SNAPSHOT=PASS\nACTIVE_TRACKS=${out.active_tracks}\nINDEX_SHA256=${out.index_sha256}\nSNAPSHOT_SHA256=${out.snapshot_sha256}\nINDEPENDENT_FINGERPRINT=PASS\nCAN_PUBLISH=FALSE\nCANONICAL_REGISTRY_MUTATION=NONE\n`);
    return out;
  }finally{await client.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  runRegistrySnapshotCli().catch(e=>{process.stderr.write(`WK100_REGISTRY_SNAPSHOT=FAIL\nCODE=${e?.message?.startsWith('wk100_registry_snapshot_')?e.message:'wk100_registry_snapshot_connection_or_read_failed'}\n`);process.exitCode=1;});
}

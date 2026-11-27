// Preview-only operational probe cleanup. This helper does not issue credentials.
const fail=()=>{throw Error("MIZIZI_EXECUTOR_RESIDUE_UNCONFIRMED");};
const stamp=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::\d{2})?$/;
export const executorIdentitySql="select session_user::text as role,current_database() as db,pg_backend_pid() as pid,backend_start::text as backend_start from pg_stat_activity where pid=pg_backend_pid()";
export function captureExecutorIdentity(row){
 if(!row||row.role!=="mizizi_executor"||row.db!=="postgres"||!Number.isSafeInteger(row.pid)||row.pid<1||row.pid>2147483647||typeof row.backend_start!=="string"||!stamp.test(row.backend_start))return fail();
 return Object.freeze({pid:row.pid,backendStart:row.backend_start});
}
const revoked="exists(select 1 from pg_catalog.pg_authid where rolname='mizizi_executor' and rolpassword is null and rolvaliduntil<=clock_timestamp())";
const preview="(select count(*) from supabase_migrations.schema_migrations)=306 and (select max(version) from supabase_migrations.schema_migrations)='20261127171129'";
const snapshot="select "+revoked+" as revoked,"+preview+" as preview,(select count(*)::int from pg_stat_activity where usename='mizizi_executor') as sessions";
export async function cleanupExecutorResidue({query,identity,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 const one=async q=>{const rows=await query(q);if(!Array.isArray(rows)||rows.length!==1)return fail();return rows[0];};
 const read=async()=>{const s=await one(snapshot);if(s.revoked!==true||s.preview!==true||!Number.isSafeInteger(s.sessions)||s.sessions<0)return fail();return s.sessions;};
 const initial=await read();
 if(initial===0)return {terminated:false,sessions:0};
 // The preflight required zero preexisting executor sessions. Unknown,
 // additional, active or transaction-bearing sessions are never targeted.
 if(initial!==1||!identity)return fail();
 const {pid,backendStart}=captureExecutorIdentity({role:"mizizi_executor",db:"postgres",pid:identity.pid,backend_start:identity.backendStart});
 const fence="a.pid="+pid+" and a.backend_start='"+backendStart+"'::timestamptz and a.usename='mizizi_executor' and a.application_name='Supavisor' and a.backend_type='client backend' and a.state='idle' and a.xact_start is null and (select count(*) from pg_stat_activity where usename='mizizi_executor')=1 and "+revoked+" and "+preview;
 const rows=await query("select pg_terminate_backend(a.pid) as terminated from pg_stat_activity a where "+fence);
 if(!Array.isArray(rows)||rows.length>1||(rows.length===1&&rows[0].terminated!==true))return fail();
 // A concurrent natural disconnect may produce zero rows; never retry a
 // termination against another PID. Verify absence independently.
 for(let i=0;i<5;i++){
  if(await read()===0)return {terminated:rows.length===1,sessions:0};
  if(i<4)await delay(500);
 }
 return fail();
}

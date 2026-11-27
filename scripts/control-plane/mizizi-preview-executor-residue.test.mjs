import test from "node:test";
import assert from "node:assert/strict";
import {captureExecutorIdentity,cleanupExecutorResidue,executorIdentitySql} from "./mizizi-preview-executor-residue.mjs";
const row={role:"mizizi_executor",db:"postgres",pid:445668,backend_start:"2026-11-27 18:04:41.363144+00"};
const identity=captureExecutorIdentity(row);
const snap=(sessions,revoked=true,preview=true)=>[{sessions,revoked,preview}];
const fake=responses=>{const calls=[];return {calls,query:async sql=>{calls.push(sql);assert.ok(responses.length,"unexpected query");return responses.shift();}};};
const run=(h,id=identity)=>cleanupExecutorResidue({query:h.query,identity:id,delay:async()=>{}});
test("capture preserves microsecond identity and rejects wrong or injectable identities",()=>{
 assert.match(executorIdentitySql,/pg_backend_pid/);
 assert.equal(identity.backendStart,row.backend_start);
 for(const bad of [{role:"postgres"},{db:"other"},{pid:0},{pid:"1;select 1"},{backend_start:"2026-11-27 18:04:41+00' or true --"}])assert.throws(()=>captureExecutorIdentity({...row,...bad}),/RESIDUE_UNCONFIRMED/);
});
test("already closed: no termination",async()=>{const h=fake([snap(0)]);assert.deepEqual(await run(h),{terminated:false,sessions:0});assert.equal(h.calls.length,1);});
test("exact idle residual backend is terminated once then independently verified",async()=>{
 const h=fake([snap(1),[{terminated:true}],snap(1),snap(0)]);
 assert.deepEqual(await run(h),{terminated:true,sessions:0});
 const sql=h.calls[1];
 for(const guard of ["a.pid=445668","a.backend_start='2026-11-27 18:04:41.363144+00'::timestamptz","a.usename='mizizi_executor'","a.application_name='Supavisor'","a.backend_type='client backend'","a.state='idle'","a.xact_start is null","rolpassword is null","rolvaliduntil<=clock_timestamp()","20261127171129",")=1"])assert.ok(sql.includes(guard),guard);
 assert.equal(h.calls.filter(x=>x.includes("pg_terminate_backend")).length,1);
});
test("unknown, additional, live credentials or wrong migration: no termination",async()=>{
 for(const [s,id] of [[snap(1),null],[snap(2),identity],[snap(1,false),identity],[snap(1,true,false),identity]]){
  const h=fake([s]);await assert.rejects(run(h,id),/RESIDUE_UNCONFIRMED/);assert.equal(h.calls.length,1);
 }
});
test("stale identity or active transaction: SQL fence returns no row and fails closed",async()=>{
 const h=fake([snap(1),[],snap(1),snap(1),snap(1),snap(1),snap(1)]);await assert.rejects(run(h),/RESIDUE_UNCONFIRMED/);
 assert.equal(h.calls.filter(x=>x.includes("pg_terminate_backend")).length,1);
});
test("natural disconnect after inventory is safe",async()=>{const h=fake([snap(1),[],snap(0)]);assert.deepEqual(await run(h),{terminated:false,sessions:0});});
test("termination failure remains failure",async()=>{const h=fake([snap(1),[{terminated:false}]]);await assert.rejects(run(h),/RESIDUE_UNCONFIRMED/);});

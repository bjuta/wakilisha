import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildWk100PrivatePreview } from '../../supabase/functions/_shared/wk100-private-preview-core.mjs';
import { isWk100PrivilegedReader, makeWk100RestrictedPreview } from '../../supabase/functions/_shared/wk100-admin-projection.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+n.toString().padStart(12,'0');
function fixture(){
 const sourceRows=[['alpha_secret','op_alpha','consumption'],['beta_secret','op_beta','consumption'],['gamma_secret','op_gamma','discovery'],['delta_secret','op_delta','video_consumption']];
 return {schema_version:'wk100-private-preview-v1',week_start_eat:'2026-10-19',dataset_mode:'synthetic',
  method:{version:'preview-private-v1',behavior_weights:{consumption:.5,discovery:.25,video_consumption:.25},
    operator_slots:{consumption:2,discovery:1,video_consumption:1},minimum_operators:4,minimum_behaviors:3,
    minimum_corrob_tracks:100,maximum_operator_share:.35},
  sources:sourceRows.map(([source_key,operator_key,behavior])=>({
    source_key,operator_key,behavior,market:'KE',expected_depth:120,
    native_period:{starts_at:'2026-10-18T21:00:00Z',ends_at:'2026-10-25T21:00:00Z',evidence_ref:'synthetic_period'},
    authority_ref:'synthetic_authority',admission:'synthetic',raw_sha256:'b'.repeat(64),
    entries:Array.from({length:120},(_,i)=>({recording_id:uuid(i+1),rank:i+1}))
  }))};
}
test('admin privileges require an active unexpired super admin or administrator assignment',()=>{
 const now=Date.parse('2026-10-21T12:00:00Z');
 assert.equal(isWk100PrivilegedReader(null,now),false);
 for(const role_key of ['chart_editor_global','chart_editor_regional','analyst','developer','editor','subscriber'])
   assert.equal(isWk100PrivilegedReader([{role_key,status:'active',expires_at:null}],now),false);
 assert.equal(isWk100PrivilegedReader([{role_key:'administrator',status:'revoked',expires_at:null}],now),false);
 assert.equal(isWk100PrivilegedReader([{role_key:'super_admin',status:'active',expires_at:'2026-10-20T00:00:00Z'}],now),false);
 assert.equal(isWk100PrivilegedReader([{role_key:'administrator',status:'active',expires_at:'2026-10-22T00:00:00Z'}],now),true);
 assert.equal(isWk100PrivilegedReader([{role_key:'super_admin',status:'active',expires_at:null}],now),true);
});
test('server projection accepts only synthetic and never claims publication',()=>{
 const f=fixture(),r=buildWk100PrivatePreview(f);
 const v=makeWk100RestrictedPreview(f,r.privateAudit);
 assert.equal(v.entries.length,100);
 assert.equal(v.entries[0].recording_id,uuid(1));
 assert.equal(v.can_publish,false);
 assert.equal(v.status,'synthetic_preview');
 assert.equal(v.operator_count,4);
 assert.throws(()=>makeWk100RestrictedPreview({...f,dataset_mode:'authorized_candidate'},r.privateAudit),/not_available/);
});
test('admin projection excludes source keys, raw bytes, authority refs, precise weights and method config',()=>{
 const f=fixture(),r=buildWk100PrivatePreview(f),s=JSON.stringify(makeWk100RestrictedPreview(f,r.privateAudit));
 for(const value of ['alpha_secret','beta_secret','gamma_secret','op_alpha','operator_slots','behavior_weights',
 'synthetic_authority','synthetic_period','b'.repeat(64),'preview-private-v1','source_manifest','input_sha256','max_operator_share','contributions'])
 assert.equal(s.includes(value),false,value);
});
test('separate pure kernel retains existing deterministic offline ranking acceptance',()=>{
 const f=fixture();
 const first=buildWk100PrivatePreview(f).privateAudit.top100.map(x=>x.recording_id);
 const again=structuredClone(f);again.sources.reverse();
 assert.deepEqual(buildWk100PrivatePreview(again).privateAudit.top100.map(x=>x.recording_id),first);
});
test('API is JWT gated and verifies user and live role assignments before reading private configuration',async()=>{
 const edge=await readFile('supabase/functions/wk100-private-admin-preview/index.ts','utf8');
 const conf=await readFile('supabase/config.toml','utf8');
 assert.match(conf,/\[functions\.wk100-private-admin-preview\]\s*verify_jwt = true/);
 assert.match(edge,/db\.auth\.getUser\(token\)/);
 assert.match(edge,/\.from\('user_role_assignments'\)/);
 assert.ok(edge.indexOf('isWk100PrivilegedReader(roles.data)')<edge.indexOf("Deno.env.get('WK100_PRIVATE_PREVIEW_INPUT')"));
 assert.match(edge,/input\?\.dataset_mode!=='synthetic'/);
 assert.doesNotMatch(edge,/fetch\(/);
});

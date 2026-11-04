import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateDisposableCiReplayRepositoryState} from '../scripts/control-plane/verify-disposable-ci-replay-proof.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
test('historical replay receipts bind their own schema while latest receipt covers current schema',()=>{
 const before=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'wk-replay-history-'));
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  process.chdir(dir);git('init','-q');git('config','user.name','Local Fixture');git('config','user.email','fixture@example.invalid');
  fs.mkdirSync('supabase/migrations',{recursive:true});fs.mkdirSync('src/types',{recursive:true});
  const one='20260101000000_one.sql',two='20260201000000_two.sql';
  fs.writeFileSync('supabase/migrations/'+one,'SELECT 1;\n');fs.writeFileSync('src/types/database.types.ts','type One = 1;\n');
  git('add','.');git('commit','-qm','first');const first=git('rev-parse','HEAD');
  fs.writeFileSync('supabase/migrations/'+two,'SELECT 2;\n');fs.writeFileSync('src/types/database.types.ts','type Two = 2;\n');
  git('add','.');git('commit','-qm','second');const second=git('rev-parse','HEAD');
  const base='a'.repeat(40),mode='disposable_ci_clean_replay_v1';
  const p1={proof_mode:mode,replay_candidate_head_sha:first,schema_types_sha256:digest('type One = 1;\n'),schema_migration_count:1,schema_migration_head:one.slice(0,14),workflow_run_id:1};
  const p2={proof_mode:mode,replay_candidate_head_sha:second,schema_types_sha256:digest('type Two = 2;\n'),schema_migration_count:2,schema_migration_head:two.slice(0,14),workflow_run_id:2};
  const entries=[one,two].map(n=>({status:'A',path:'supabase/migrations/'+n}));
  const args={changedActive:entries,proofs:new Map([[entries[0].path,p1],[entries[1].path,p2]]),mergeBase:base,
   migrations:[one,two],latestMigration:two,actualTypesSha256:p2.schema_types_sha256,
   baseline:{typesSha256:p2.schema_types_sha256,migrationCount:2,latestMigration:two,
    schemaSeal:{mode:'disposable_ci',sourceProjectRef:'unlinked-local-ci',baseMainSha:base,replayCandidateHeadSha:second,workflowRunId:2,migrationHead:two.slice(0,14)}}};
  assert.deepEqual(validateDisposableCiReplayRepositoryState(args),[]);
  const invalidOld={...p1,schema_migration_count:2};args.proofs.set(entries[0].path,invalidOld);
  assert.ok(validateDisposableCiReplayRepositoryState(args).includes('disposable CI proof does not bind its recorded replay schema'));
  args.proofs.set(entries[0].path,p1);
  fs.writeFileSync('supabase/migrations/'+one,'SELECT 999;\n');
  assert.ok(validateDisposableCiReplayRepositoryState(args).includes('disposable CI previously replayed migration bytes changed or were removed'));
  fs.writeFileSync('supabase/migrations/'+one,'SELECT 1;\n');
  args.proofs.set(entries[1].path,{...p2,replay_candidate_head_sha:first});
  assert.ok(validateDisposableCiReplayRepositoryState(args).includes('disposable CI migration filename set changed since replay'));
  args.proofs.set(entries[1].path,p2);
  args.actualTypesSha256=digest('tampered');
  assert.ok(validateDisposableCiReplayRepositoryState(args).includes('disposable CI proof does not bind current types and active migration head'));
 }finally{process.chdir(before);fs.rmSync(dir,{recursive:true});}
});

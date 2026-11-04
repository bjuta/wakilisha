import { realpathSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
function manifest(){
 const cwd=realpathSync(process.cwd());
 const m=JSON.parse(readFileSync('.local-disposable.json','utf8'));
 const config=readFileSync('supabase/config.toml','utf8');
 if(m.projectId!==path.basename(cwd)||!/^wakilisha-local-[A-Za-z0-9]+$/.test(m.projectId)||
  !Number.isInteger(m.apiPort)||m.apiPort<1024||m.apiPort>65535||
  !config.startsWith(`project_id = "${m.projectId}"\n`)||
  !config.includes(`[api]\nport = ${m.apiPort}\n`))throw Error('Invalid disposable ownership manifest');
 return m;
}
export function localDisposableContext() {
 try{
  const cwd=realpathSync(process.cwd());
  return process.env.WK_LOCAL_DISPOSABLE==='1' && !process.env.GITHUB_ACTIONS &&
   cwd.startsWith(path.join(realpathSync(tmpdir()),'wakilisha-local-')) &&
   process.env.WK_LOCAL_DISPOSABLE_DIR===cwd &&
   !process.env.SUPABASE_ACCESS_TOKEN && !process.env.SUPABASE_PROJECT_REF &&
   !process.env.DATABASE_URL && !process.env.PGHOST &&
   !existsSync('supabase/.temp/project-ref') && !!manifest();
 }catch{return false;}
}
function hosted(){return process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_EVENT_NAME==='pull_request'&&!process.env.WK_LOCAL_DISPOSABLE;}
export function disposableDatabaseFilter(){
 if(localDisposableContext())return `name=^supabase_db_${manifest().projectId}$`;
 if(hosted())return 'name=^supabase_db_';
 throw Error('Unverified disposable database context');
}
export function disposableApiPort(){
 if(localDisposableContext())return String(manifest().apiPort);
 if(hosted())return '54321';
 throw Error('Unverified disposable API context');
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(process.argv[2]==='--db-filter')console.log(disposableDatabaseFilter());
 else if(!localDisposableContext())process.exit(20);
}

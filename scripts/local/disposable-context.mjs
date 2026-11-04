import { realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
export function localDisposableContext() {
  const cwd=realpathSync(process.cwd());
  return process.env.WK_LOCAL_DISPOSABLE==='1' && !process.env.GITHUB_ACTIONS &&
    cwd.startsWith(path.join(realpathSync(tmpdir()),'wakilisha-local-')) &&
    process.env.WK_LOCAL_DISPOSABLE_DIR===cwd &&
    !process.env.SUPABASE_ACCESS_TOKEN && !process.env.SUPABASE_PROJECT_REF &&
    !process.env.DATABASE_URL && !process.env.PGHOST &&
    !existsSync('supabase/.temp/project-ref');
}
if (process.argv[1]?.endsWith('/disposable-context.mjs') && !localDisposableContext()) process.exit(20);

import fs from "node:fs";

const migration = "supabase/migrations/20260714220500_phase_0a_lock_down_user_access_admin_rpcs.sql";
const sql = fs.readFileSync(migration, "utf8");

const targets = [
  "assign_user_role_admin(uuid, text, text, text, text)",
  "record_admin_audit(text, text, text, uuid, text, jsonb)",
  "record_password_reset_admin(uuid, text, text, text, text)",
  "revoke_user_role_admin(uuid, text)",
  "revoke_user_scope_admin(uuid)",
  "suspend_user_access_admin(uuid, text)",
  "upsert_user_scope_admin(uuid, text, text, text, boolean, boolean, boolean)",
];

const compact = sql.replace(/\s+/g, " ").toLowerCase();

for (const signature of targets) {
  const target = `public.${signature}`.toLowerCase();
  const revoke = `revoke execute on function ${target} from public, anon, authenticated`;
  const grant = `grant execute on function ${target} to service_role`;
  if (!compact.includes(revoke)) throw new Error(`Missing public/anon/authenticated revoke for ${signature}`);
  if (!compact.includes(grant)) throw new Error(`Missing service_role grant for ${signature}`);
}

console.log(`Verified ${targets.length} privileged admin RPC execution boundaries.`);

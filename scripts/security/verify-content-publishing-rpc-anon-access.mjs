import fs from "node:fs";

const migration =
  "docs/engineering/replay-baseline/legacy-migrations/20260714190345_phase_0a_lock_down_content_publishing_rpc_anon_access.sql";

const sql = fs
  .readFileSync(migration, "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

const targets = [
  "create_article(text, text, text, text, text, text, text, jsonb, jsonb, jsonb, timestamp with time zone)",
  "create_magazine_issue(text, text, text, text, text, text, text, text)",
  "update_article(uuid, jsonb, timestamp with time zone)",
  "update_article(uuid, jsonb)",
  "update_article_hero_image(uuid, text)",
];

for (const signature of targets) {
  const functionName = `public.${signature}`.toLowerCase();
  const revoke =
    `revoke execute on function ${functionName} from public, anon`;
  const grant =
    `grant execute on function ${functionName} to authenticated, service_role`;

  if (!sql.includes(revoke)) {
    throw new Error(
      `Missing PUBLIC/anon revoke for ${signature}`,
    );
  }

  if (!sql.includes(grant)) {
    throw new Error(
      `Missing authenticated/service_role grant for ${signature}`,
    );
  }
}

console.log(
  `Verified ${targets.length} content-publishing RPC boundaries.`,
);

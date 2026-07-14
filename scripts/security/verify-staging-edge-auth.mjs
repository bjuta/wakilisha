import fs from "node:fs";

const helperPath =
  "supabase/functions/_shared/require-import-management-access.ts";

const functionFiles = [
  "supabase/functions/purge-staging-records/index.ts",
  "supabase/functions/batch-delete-staging/index.ts",
];

const expectedScope = String.fromCharCode(
  64,
  115,
  117,
  112,
  97,
  98,
  97,
  115,
  101,
);

const expectedVersion = "2.57.4";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function functionConfigBlock(config, name) {
  const escaped = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const match = config.match(
    new RegExp(
      `\\[functions\\.${escaped}\\]` +
        `([\\s\\S]*?)(?=\\n\\[|$)`,
    ),
  );

  return match?.[1] ?? null;
}

const helper = read(helperPath);

const importMatch = helper.match(
  /https:\/\/esm\.sh\/(@[^/]+)\/supabase-js@([^"']+)/,
);

assert(
  importMatch !== null,
  "Shared guard must contain a Supabase client import.",
);

assert(
  importMatch[1] === expectedScope,
  `Shared guard package scope is not canonical lowercase: ${importMatch[1]}`,
);

assert(
  importMatch[2] === expectedVersion,
  `Shared guard must pin supabase-js to ${expectedVersion}.`,
);

assert(
  helper.includes("auth.getUser()"),
  "Shared guard must validate the caller with auth.getUser().",
);

assert(
  helper.includes("current_user_is_administrator"),
  "Shared guard must check administrator status.",
);

assert(
  helper.includes(
    'required_capability: "manage_imports"',
  ),
  "Shared guard must require manage_imports.",
);

for (const file of functionFiles) {
  const source = read(file);

  assert(
    source.includes('req.method !== "POST"'),
    `${file} must reject non-POST requests.`,
  );

  assert(
    source.includes("requireImportManagementAccess"),
    `${file} must use the shared authorization guard.`,
  );

  assert(
    source.includes(
      "if (!supabaseUrl || !anonKey || !serviceRoleKey)",
    ),
    `${file} must require URL, anon key and service-role key.`,
  );

  assert(
    !source.includes("anonKey || serviceRoleKey"),
    `${file} must not use service_role as an auth-client fallback.`,
  );

  const authorizationIndex = source.indexOf(
    "const access = await requireImportManagementAccess",
  );

  const destructiveRpcIndex = source.indexOf(
    "/rest/v1/rpc/delete_batch_from_staging",
  );

  const serviceRoleInvocationIndex = source.indexOf(
    "Authorization: `Bearer ${serviceRoleKey}`",
  );

  assert(
    authorizationIndex >= 0,
    `${file} is missing the authorization call.`,
  );

  assert(
    destructiveRpcIndex >= 0,
    `${file} is missing its expected staging RPC call.`,
  );

  assert(
    serviceRoleInvocationIndex >= 0,
    `${file} is missing the expected service-role RPC invocation.`,
  );

  assert(
    authorizationIndex < destructiveRpcIndex,
    `${file} constructs the destructive RPC before authorization.`,
  );

  assert(
    authorizationIndex < serviceRoleInvocationIndex,
    `${file} uses service_role before caller authorization.`,
  );

  assert(
    source.includes("requested_by: access.userId"),
    `${file} must log the authorized user ID.`,
  );

  assert(
    !/\bstack\s*:/.test(source),
    `${file} must not expose stack traces.`,
  );
}

const config = read("supabase/config.toml");

for (const name of [
  "purge-staging-records",
  "batch-delete-staging",
]) {
  const block = functionConfigBlock(config, name);

  assert(
    block !== null,
    `Missing function configuration block for ${name}.`,
  );

  assert(
    /verify_jwt\s*=\s*true/.test(block),
    `${name} must explicitly enable JWT verification.`,
  );

  assert(
    !/verify_jwt\s*=\s*false/.test(block),
    `${name} must not disable JWT verification.`,
  );
}

console.log(
  "PASS: Both destructive staging functions require valid JWT authentication and administrator/manage_imports authorization before service-role use.",
);

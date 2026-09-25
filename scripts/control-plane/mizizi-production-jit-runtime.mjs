import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import pg from "pg";

const PINNED_SUPABASE_CLI = "2.108.0";

export function runCommand(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: options.env || process.env,
  });

  if (result.status !== 0) {
    throw new Error(
      cmd +
        " " +
        args.join(" ") +
        " failed" +
        (result.stderr ? ": " + result.stderr.trim() : ""),
    );
  }

  return (result.stdout || "").trim();
}

async function managementApi(token, method, path, body) {
  const response = await fetch("https://api.supabase.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      "Supabase Management API " +
        method +
        " " +
        path +
        " failed " +
        response.status +
        ": " +
        text.slice(0, 500),
    );
  }

  return text ? JSON.parse(text) : null;
}

function findPayload(value, depth = 0) {
  if (depth > 14) return null;

  if (typeof value === "string") {
    try {
      return findPayload(JSON.parse(value), depth + 1);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPayload(item, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    if (value.payload !== undefined) return value.payload;

    for (const child of Object.values(value)) {
      const found = findPayload(child, depth + 1);
      if (found !== null) return found;
    }
  }

  return null;
}

export function linkSupabaseProject(projectRef) {
  if (!projectRef) {
    throw new Error("projectRef is required");
  }

  runCommand(
    "npx",
    [
      "--yes",
      "supabase@" + PINNED_SUPABASE_CLI,
      "link",
      "--project-ref",
      projectRef,
    ],
  );
}

export function queryViaLinkedCli(sql) {
  const wrapped =
    "select to_jsonb(q) as payload from (" +
    sql.replace(/;\s*$/, "") +
    ") q";

  const raw = runCommand(
    "npx",
    [
      "--yes",
      "supabase@" + PINNED_SUPABASE_CLI,
      "db",
      "query",
      "--linked",
      "--agent=no",
      "-o",
      "json",
      wrapped,
    ],
    { capture: true },
  );

  const payload = findPayload(JSON.parse(raw));

  if (payload === null) {
    throw new Error(
      "linked Supabase CLI query did not return a parseable payload",
    );
  }

  return payload;
}

function rowsFromJitList(raw) {
  return Array.isArray(raw)
    ? raw
    : raw?.data || raw?.mappings || raw?.users || raw?.items || [];
}

function profileId(raw) {
  return (
    raw?.gotrue_id ||
    raw?.id ||
    raw?.user_id ||
    raw?.user?.id ||
    raw?.data?.id ||
    raw?.data?.gotrue_id ||
    ""
  );
}

function configState(raw) {
  return String(
    raw?.state || raw?.data?.state || raw?.config?.state || "",
  ).toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function databaseUrl(projectRef, token, role) {
  const path = "supabase/.temp/pooler-url";

  if (!fs.existsSync(path)) {
    throw new Error(
      "linked Supabase CLI did not create " + path,
    );
  }

  const linked = fs.readFileSync(path, "utf8").trim();
  const sanitized = linked.replace(
    /:\/\/([^:]+):[^@]*@/,
    "://$1:x@",
  );
  const url = new URL(sanitized);

  if (!url.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error(
      "linked Supabase CLI returned unexpected pooler host " +
        url.hostname,
    );
  }

  url.username = role + "." + projectRef;
  url.password = token;
  url.port = "5432";
  url.search = "";
  url.searchParams.set("options", "-c jit=true");

  console.log(
    "Using linked Supabase pooler host: " +
      url.hostname +
      ":5432 as " +
      role,
  );

  return url.toString();
}

function isTransientJitError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || error || "").toLowerCase();

  return (
    code === "EJITREQUESTFAILED" ||
    code === "28P01" ||
    code === "XX000" ||
    message.includes("jit provider") ||
    message.includes("temporary access") ||
    message.includes("password authentication failed") ||
    message.includes("pam authentication failed")
  );
}

async function createJitPoolWithRetry(url, expectedRole) {
  const attempts = 12;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      statement_timeout: 30000,
    });

    try {
      const { rows: [session] } = await pool.query(
        "select current_user as database_user, current_database() as database_name",
      );

      if (
        session.database_user !== expectedRole ||
        session.database_name !== "postgres"
      ) {
        throw new Error(
          "unexpected JIT database session " +
            session.database_user +
            "@" +
            session.database_name +
            " expected " +
            expectedRole +
            "@postgres",
        );
      }

      console.log(
        "PASS: JIT " +
          expectedRole +
          " database session ready on attempt " +
          attempt +
          "/" +
          attempts,
      );

      return pool;
    } catch (error) {
      await pool.end().catch(() => {});

      if (!isTransientJitError(error) || attempt === attempts) {
        throw error;
      }

      console.log(
        "JIT session not ready on attempt " +
          attempt +
          "/" +
          attempts +
          "; retrying after transient " +
          (error?.code || "UNKNOWN"),
      );

      await sleep(5000);
    }
  }

  throw new Error("JIT database session readiness exhausted");
}

const stageCAuthoritySql = `select
  exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='20260920095334'
      and name='mizizi_stage_c_narrow_executor_transport_v1'
  ) as stage_c_applied,
  exists(
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='active'
  ) as executor_active,
  exists(
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='disabled'
  ) as postgres_disabled`;

export async function openMiziziJitSession({
  projectRef,
  managementProjectRef = projectRef,
  token,
}) {
  if (!projectRef || !managementProjectRef || !token) {
    throw new Error(
      "projectRef, managementProjectRef and Supabase access token are required",
    );
  }

  linkSupabaseProject(projectRef);

  const authority = queryViaLinkedCli(stageCAuthoritySql);

  if (
    authority.stage_c_applied !== true ||
    authority.executor_active !== true ||
    authority.postgres_disabled !== true
  ) {
    throw new Error(
      "current MIZIZI programme requires exact Stage C mizizi_executor authority",
    );
  }

  console.log(
    "PASS: Stage C ledger active; current programme transport = mizizi_executor",
  );

  const userId = profileId(
    await managementApi(token, "GET", "/v1/profile"),
  );

  if (!userId) {
    throw new Error(
      "Supabase profile did not expose a JIT user id",
    );
  }

  const originalState = configState(
    await managementApi(
      token,
      "GET",
      "/v1/projects/" + managementProjectRef + "/jit-access",
    ),
  );

  if (originalState !== "disabled") {
    throw new Error(
      "production temporary access must be disabled at rest; found " +
        (originalState || "unknown"),
    );
  }

  const list = rowsFromJitList(
    await managementApi(
      token,
      "GET",
      "/v1/projects/" + managementProjectRef + "/database/jit/list",
    ),
  );

  const existing =
    list.find(
      (item) =>
        String(
          item.user_id || item.id || item.gotrue_id || "",
        ) === userId,
    ) || null;

  const originalRoles =
    existing && Array.isArray(existing.user_roles)
      ? existing.user_roles
      : [];

  let mappingChanged = false;
  let pool = null;
  let closed = false;

  const restore = async () => {
    if (closed) return;
    closed = true;

    const errors = [];

    if (pool) {
      await pool.end().catch((error) => {
        errors.push(
          "pool cleanup failed: " + (error?.message || error),
        );
      });
      pool = null;
    }

    if (mappingChanged) {
      try {
        if (existing) {
          await managementApi(
            token,
            "PUT",
            "/v1/projects/" + managementProjectRef + "/database/jit",
            {
              user_id: userId,
              roles: originalRoles,
            },
          );
        } else {
          await managementApi(
            token,
            "DELETE",
            "/v1/projects/" +
              managementProjectRef +
              "/database/jit/" +
              userId,
          );
        }
      } catch (error) {
        errors.push(
          "mapping cleanup failed: " +
            (error?.message || error),
        );
      }
    }

    try {
      await managementApi(
        token,
        "PUT",
        "/v1/projects/" + managementProjectRef + "/jit-access",
        { state: "disabled" },
      );
    } catch (error) {
      errors.push(
        "temporary-access cleanup failed: " +
          (error?.message || error),
      );
    }

    if (errors.length) {
      throw new Error(errors.join("; "));
    }

    console.log(
      "PASS: JIT mapping restored and production temporary access disabled at rest",
    );
  };

  try {
    await managementApi(
      token,
      "PUT",
      "/v1/projects/" + managementProjectRef + "/jit-access",
      { state: "enabled" },
    );

    const roles = originalRoles.filter(
      (entry) =>
        !["postgres", "mizizi_executor"].includes(
          String(entry.role || ""),
        ),
    );

    roles.push({
      role: "mizizi_executor",
      expires_at: Date.now() + 60 * 60 * 1000,
    });

    await managementApi(
      token,
      "PUT",
      "/v1/projects/" + managementProjectRef + "/database/jit",
      {
        user_id: userId,
        roles,
      },
    );

    mappingChanged = true;

    const url = databaseUrl(
      projectRef,
      token,
      "mizizi_executor",
    );

    console.log("::add-mask::" + url);

    pool = await createJitPoolWithRetry(
      url,
      "mizizi_executor",
    );

    return {
      pool,
      url,
      restore,
    };
  } catch (error) {
    await restore().catch(() => {});
    throw error;
  }
}

export async function streamCommand(
  cmd,
  args,
  env,
  logPath,
) {
  const out = fs.createWriteStream(logPath);
  const child = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(data);
    out.write(data);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(data);
    out.write(data);
  });

  const code = await new Promise((resolve) =>
    child.on("close", resolve),
  );

  out.end();

  if (code !== 0) {
    throw new Error(cmd + " exited " + code);
  }
}

export async function streamReadOnlyAuditWithRetry(
  args,
  env,
  logPath,
) {
  const attempts = 4;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await streamCommand(
        "npm",
        args,
        env,
        logPath,
      );
      return;
    } catch (error) {
      const output = fs.existsSync(logPath)
        ? fs.readFileSync(logPath, "utf8")
        : "";
      const transient = output.includes("EJITREQUESTFAILED");

      if (!transient || attempt === attempts) {
        throw error;
      }

      console.log(
        "Read-only MIZIZI audit hit transient JIT access on attempt " +
          attempt +
          "/" +
          attempts +
          "; retrying",
      );

      await sleep(5000);
    }
  }

  throw new Error(
    "read-only MIZIZI audit retry budget exhausted",
  );
}

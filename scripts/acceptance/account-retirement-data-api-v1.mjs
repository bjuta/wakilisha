import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

const url = required("WK_SUPABASE_URL");
const anonKey = required("WK_ANON_KEY");
const operatorEmail = required("WK_OPERATOR_EMAIL");
const operatorPassword = required("WK_OPERATOR_PASSWORD");
const targetEmail = required("WK_TARGET_EMAIL");
const targetPassword = required("WK_TARGET_PASSWORD");
const targetUserId = required("WK_TARGET_USER_ID");
const targetPersonId = required("WK_TARGET_PERSON_ID");
const targetLinkId = required("WK_TARGET_LINK_ID");
const idempotencyKey = required("WK_IDEMPOTENCY_KEY");

if (!url.includes("bkerabqqgsvgeidnqqco")) {
  throw new Error(
    "STOP: account-retirement Data API acceptance is Preview-only.",
  );
}

const adminClient = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const targetClient = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const targetLogin = await targetClient.auth.signInWithPassword({
  email: targetEmail,
  password: targetPassword,
});

if (targetLogin.error || !targetLogin.data.session?.access_token) {
  throw new Error(
    `Target login failed: ${targetLogin.error?.message ?? "no session"}`,
  );
}

const noCapAttempt = await targetClient.rpc(
  "retire_account_identity",
  {
    p_user_id: targetUserId,
    p_person_resource_id: targetPersonId,
    p_expected_identity_revision: 1,
    p_identity_link_id: targetLinkId,
    p_reason: "Preview no-capability denial proof.",
    p_idempotency_key:
      `${idempotencyKey}:no-capability`,
    p_correlation_id: crypto.randomUUID(),
  },
);

if (
  !noCapAttempt.error ||
  noCapAttempt.error.code !== "42501"
) {
  throw new Error(
    `Expected 42501 from no-capability facade call, got ${JSON.stringify(noCapAttempt.error)}`,
  );
}

console.log(
  "ACCOUNT_RETIREMENT_DATA_API_NO_CAPABILITY_DENIAL=PASS",
);

const adminLogin = await adminClient.auth.signInWithPassword({
  email: operatorEmail,
  password: operatorPassword,
});

if (adminLogin.error || !adminLogin.data.session?.access_token) {
  throw new Error(
    `Operator login failed: ${adminLogin.error?.message ?? "no session"}`,
  );
}

const adminToken =
  adminLogin.data.session.access_token;

const privateSchemaResponse = await fetch(
  `${url}/rest/v1/rpc/retire_account_identity`,
  {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
      "Content-Profile": "account_identity_private",
    },
    body: "{}",
  },
);

const privateSchemaBody =
  await privateSchemaResponse.text();

if (privateSchemaResponse.status !== 406) {
  throw new Error(
    `Private executor schema unexpectedly reachable: HTTP ${privateSchemaResponse.status} ${privateSchemaBody}`,
  );
}

console.log(
  "ACCOUNT_RETIREMENT_PRIVATE_SCHEMA_NOT_EXPOSED=PASS",
);

const retirement = await adminClient.rpc(
  "retire_account_identity",
  {
    p_user_id: targetUserId,
    p_person_resource_id: targetPersonId,
    p_expected_identity_revision: 1,
    p_identity_link_id: targetLinkId,
    p_reason:
      "Disposable Preview proof of account-retirement Data API facade/private-executor architecture.",
    p_idempotency_key: idempotencyKey,
    p_correlation_id: crypto.randomUUID(),
  },
);

if (retirement.error) {
  throw new Error(
    `Governed retirement RPC failed: ${retirement.error.code} ${retirement.error.message} ${retirement.error.hint ?? ""}`,
  );
}

if (
  !Array.isArray(retirement.data) ||
  retirement.data.length !== 1
) {
  throw new Error(
    `Unexpected retirement response: ${JSON.stringify(retirement.data)}`,
  );
}

const receipt = retirement.data[0];

if (
  receipt.receipt_status !== "succeeded" ||
  receipt.user_id !== targetUserId ||
  receipt.person_resource_id !== targetPersonId ||
  receipt.identity_link_id !== targetLinkId ||
  Number(receipt.identity_revision) !== 3 ||
  receipt.account_deleted !== true ||
  receipt.person_archived !== true
) {
  throw new Error(
    `Retirement receipt invariant failed: ${JSON.stringify(receipt)}`,
  );
}

console.log(
  `ACCOUNT_RETIREMENT_DATA_API_RECEIPT=${receipt.command_receipt_id}`,
);
console.log(
  "ACCOUNT_RETIREMENT_DATA_API_HTTP_PASS",
);

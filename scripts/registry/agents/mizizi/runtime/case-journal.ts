/**
 * MIZIZI Headquarters, Slice 1: durable case intake and conservative state transitions.
 *
 * This code is for the existing trusted server/CLI runtime only. The caller
 * supplies an already-authorized PostgreSQL pool. No browser, service-role
 * REST access, long-lived connection, grant issuance, Registry mutation, or
 * new queue is created here.
 *
 * DB02 owns the unique (workspace_id,case_key), revision guard, and immutable
 * case_events journal. We never write case_events directly.
 */
import {
  findingToCaseCandidateV1,
  type CaseCandidateV1,
} from "./case-adapter";
import {
  planCaseTransitionV1,
  type CaseTransitionCommandV1,
  type CaseRevisionV1,
} from "./case-state-machine";
import type { MiziziFinding } from "../core";

export const CASE_JOURNAL_CONTRACT = "mizizi.case_journal.v1" as const;

export interface CaseDbResultV1<T> {
  rows: T[];
  rowCount: number | null;
}
export interface CaseDbSessionV1 {
  query<T = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<CaseDbResultV1<T>>;
  release(): void;
}
export interface CaseDbPoolV1 {
  connect(): Promise<CaseDbSessionV1>;
}

type CaseRow = CaseRevisionV1 & Readonly<{
  case_key: string;
  subject_type: string;
  subject_id: string;
  claim_family_key: string;
  claim_key: string;
  last_observation_fingerprint: string | null;
  policy_ruleset_version: string | null;
}>;

type CreatedCase = Readonly<{ id: string; revision: number }>;

export type CaseAdmissionResultV1 = Readonly<{
  contract: typeof CASE_JOURNAL_CONTRACT;
  caseId: string;
  workspaceId: string;
  caseKey: string;
  revision: number;
  status: "created" | "unchanged" | "observation_recorded" | "requires_manual_reopen";
}>;

export type CaseCommandResultV1 = Readonly<{
  contract: typeof CASE_JOURNAL_CONTRACT;
  caseId: string;
  revision: number;
  status: "changed" | "unchanged";
}>;

async function tx<T>(pool: CaseDbPoolV1, action: (session: CaseDbSessionV1) => Promise<T>): Promise<T> {
  const session = await pool.connect();
  let begun = false;
  try {
    await session.query("BEGIN");
    begun = true;
    await session.query("SET LOCAL lock_timeout = '5s'");
    await session.query("SET LOCAL statement_timeout = '45s'");
    const result = await action(session);
    await session.query("COMMIT");
    begun = false;
    return result;
  } catch (error) {
    if (begun) {
      try { await session.query("ROLLBACK"); } catch { /* original error is authoritative */ }
    }
    throw error;
  } finally {
    session.release();
  }
}

const FIND_CASE_SQL = `
  select id,workspace_id,case_key,subject_type,subject_id,claim_family_key,claim_key,
    revision,case_state,current_stage,
    to_char(next_action_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as next_action_at,
    last_observation_fingerprint,policy_ruleset_version
  from mizizi_private.cases
  where workspace_id=$1::uuid and case_key=$2::text
  for update
`;

const FIND_BY_ID_SQL = `
  select id,workspace_id,case_key,subject_type,subject_id,claim_family_key,claim_key,
    revision,case_state,current_stage,
    to_char(next_action_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as next_action_at,
    last_observation_fingerprint,policy_ruleset_version
  from mizizi_private.cases
  where workspace_id=$1::uuid and id=$2::uuid
  for update
`;

function single<T>(result: CaseDbResultV1<T>, description: string): T {
  if (result.rows.length !== 1 || result.rowCount !== 1) {
    throw new Error(`MIZIZI case journal: expected one ${description}`);
  }
  return result.rows[0];
}

function verifyIdentity(row: CaseRow, candidate: CaseCandidateV1): void {
  const p = candidate.persistence;
  if (row.workspace_id !== p.workspace_id || row.case_key !== p.case_key ||
      row.subject_type !== p.subject_type || row.subject_id !== p.subject_id ||
      row.claim_family_key !== p.claim_family_key || row.claim_key !== p.claim_key) {
    throw new Error("MIZIZI case journal: existing case identity disagrees with deterministic finding");
  }
  if (!Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error("MIZIZI case journal: invalid stored case revision");
  }
}

/**
 * Admit only allowlisted MIZIZI findings. It is *not* a migration of all
 * Registry review categories or a human-approval operation.
 */
export async function admitMiziziFindingCaseV1(
  pool: CaseDbPoolV1,
  input: Readonly<{ workspaceId: string; policyRulesetVersion: string; finding: Readonly<MiziziFinding> }>,
): Promise<CaseAdmissionResultV1> {
  // Validate *before* opening a transaction or touching a database.
  const candidate = findingToCaseCandidateV1(input);
  const p = candidate.persistence;
  return tx(pool, async (session) => {
    const workspace = await session.query<{ id: string }>(`
      select id from mizizi_private.workspaces
      where id=$1::uuid and workspace_key='wakilisha-internal' and status='active'
    `, [p.workspace_id]);
    single(workspace, "authorized internal workspace");

    // Concurrent retries are idempotent through DB02's *real* unique index.
    // Never overwrite a resolved/held case on INSERT conflict.
    const insert = await session.query<CreatedCase>(`
      insert into mizizi_private.cases (
        workspace_id,case_key,subject_type,subject_id,claim_family_key,claim_key,
        last_observation_fingerprint,policy_ruleset_version,
        transition_actor_key,transition_reason
      ) values ($1::uuid,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10)
      on conflict (workspace_id,case_key) do nothing
      returning id,revision
    `, [p.workspace_id,p.case_key,p.subject_type,p.subject_id,p.claim_family_key,p.claim_key,
      p.last_observation_fingerprint,p.policy_ruleset_version,p.transition_actor_key,p.transition_reason]);
    if (insert.rows.length === 1 && insert.rowCount === 1) {
      return { contract: CASE_JOURNAL_CONTRACT, caseId: insert.rows[0].id,
        workspaceId: p.workspace_id, caseKey: p.case_key,
        revision: insert.rows[0].revision, status: "created" };
    }
    if (insert.rows.length !== 0 || insert.rowCount !== 0) {
      throw new Error("MIZIZI case journal: inconsistent insertion receipt");
    }
    const row = single(await session.query<CaseRow>(FIND_CASE_SQL, [p.workspace_id,p.case_key]), "existing case");
    verifyIdentity(row, candidate);
    const same = row.last_observation_fingerprint === p.last_observation_fingerprint &&
      row.policy_ruleset_version === p.policy_ruleset_version;
    if (same) {
      return { contract: CASE_JOURNAL_CONTRACT, caseId: row.id, workspaceId: p.workspace_id,
        caseKey: p.case_key, revision: row.revision, status: "unchanged" };
    }
    // A new observation cannot silently reopen a resolved/closed case or
    // turn a human decision into an unreviewed machine override.
    if (row.case_state === "resolved" || row.case_state === "closed" ||
        row.current_stage === "complete") {
      return { contract: CASE_JOURNAL_CONTRACT, caseId: row.id, workspaceId: p.workspace_id,
        caseKey: p.case_key, revision: row.revision, status: "requires_manual_reopen" };
    }
    const result = single(await session.query<{ id: string; revision: number }>(`
      update mizizi_private.cases set
        revision=revision+1,
        last_observation_fingerprint=$4,
        policy_ruleset_version=$5,
        transition_actor_key='system:mizizi',
        transition_reason='New deterministic observation recorded; prior human review remains authoritative.'
      where workspace_id=$1::uuid and id=$2::uuid and revision=$3::int
      returning id,revision
    `, [p.workspace_id,row.id,row.revision,p.last_observation_fingerprint,p.policy_ruleset_version]), "recorded observation revision");
    return { contract: CASE_JOURNAL_CONTRACT, caseId: result.id, workspaceId: p.workspace_id,
      caseKey: p.case_key, revision: result.revision, status: "observation_recorded" };
  });
}

/**
 * Trusted system-only state changes. Human operator commands require a
 * separate authenticated, capability-checked SQL/RPC boundary. This method
 * cannot issue grants, change review decisions, or finalize operations.
 */
export async function transitionMiziziCaseSystemV1(
  pool: CaseDbPoolV1,
  input: Readonly<{ workspaceId: string; caseId: string; expectedRevision: number;
    command: CaseTransitionCommandV1; reason: string; nextActionAt?: string | null }>,
): Promise<CaseCommandResultV1> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.workspaceId) ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.caseId)) {
    throw new TypeError("MIZIZI case journal: invalid transition case/workspace UUID");
  }
  return tx(pool, async (session) => {
    const row = single(await session.query<CaseRow>(FIND_BY_ID_SQL, [input.workspaceId,input.caseId]), "case for transition");
    const plan = planCaseTransitionV1({
      current: row,
      expectedRevision: input.expectedRevision,
      command: input.command,
      actorKey: "system:mizizi",
      reason: input.reason,
      ...(Object.prototype.hasOwnProperty.call(input,"nextActionAt") ? { nextActionAt: input.nextActionAt } : {}),
    });
    if (plan.kind === "no_change") {
      return { contract: CASE_JOURNAL_CONTRACT, caseId: row.id,
        revision: row.revision, status: "unchanged" };
    }
    if (!plan.set) throw new Error("MIZIZI case journal: missing changed-state plan");
    const set = plan.set;
    const updated = single(await session.query<{ id: string; revision: number }>(`
      update mizizi_private.cases set
        revision=$4::int,case_state=$5,current_stage=$6,next_action_at=$7::timestamptz,
        transition_actor_key=$8,transition_reason=$9
      where workspace_id=$1::uuid and id=$2::uuid and revision=$3::int
      returning id,revision
    `, [input.workspaceId,input.caseId,input.expectedRevision,set.revision,set.case_state,
      set.current_stage,set.next_action_at,set.transition_actor_key,set.transition_reason]), "case transition revision");
    return { contract: CASE_JOURNAL_CONTRACT, caseId: updated.id,
      revision: updated.revision, status: "changed" };
  });
}

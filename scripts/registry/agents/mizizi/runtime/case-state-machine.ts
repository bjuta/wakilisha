/**
 * MIZIZI Headquarters / Slice 1 — pure, read-only case transition planner.
 *
 * DB02 remains the writer/journal authority. This module returns a typed
 * compare-and-set request for a FUTURE privileged command, never executes SQL.
 * It deliberately cannot approve a human decision, authorize Registry writes,
 * declare execution verified, close a case, or manipulate global Write Holds.
 */

export const CASE_TRANSITION_CONTRACT = "mizizi.case_transition.v1" as const;

export type CaseLifecycleStateV1 =
  | "open" | "in_progress" | "awaiting_review" | "held"
  | "done_for_now" | "resolved" | "closed";

export type CaseStageV1 =
  | "triage" | "research" | "human_review" | "planning"
  | "execution" | "verification" | "finalization" | "complete";

export type CaseTransitionCommandV1 =
  | "start_research"
  | "request_human_review"
  | "hold_case"
  | "done_for_now"
  | "resume_case";

export type CaseRevisionV1 = Readonly<{
  id: string;
  workspace_id: string;
  revision: number;
  case_state: CaseLifecycleStateV1;
  current_stage: CaseStageV1;
  next_action_at: string | null;
}>;

export type CaseTransitionRequestV1 = Readonly<{
  current: CaseRevisionV1;
  expectedRevision: number;
  command: CaseTransitionCommandV1;
  actorKey: string;
  reason: string;
  /** Explicit ISO-8601 UTC instant, null or omitted (preserves current value). */
  nextActionAt?: string | null;
}>;

export type CaseTransitionPlanV1 = Readonly<{
  contract: typeof CASE_TRANSITION_CONTRACT;
  kind: "cas_update" | "no_change";
  where: Readonly<{ id: string; workspace_id: string; revision: number }>;
  set: Readonly<{
    revision: number;
    case_state: CaseLifecycleStateV1;
    current_stage: CaseStageV1;
    next_action_at: string | null;
    transition_actor_key: string;
    transition_reason: string;
  }> | null;
  /** DB02's `mizizi_cases_journal` trigger owns the eventual event. */
  journalAuthority: "mizizi_private.cases/mizizi_cases_journal";
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTOR = /^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$/;
const STATES: readonly CaseLifecycleStateV1[] = [
  "open", "in_progress", "awaiting_review", "held", "done_for_now", "resolved", "closed",
];
const STAGES: readonly CaseStageV1[] = [
  "triage", "research", "human_review", "planning",
  "execution", "verification", "finalization", "complete",
];

function invalid(reason: string): never {
  throw new TypeError(`MIZIZI case transition denied: ${reason}`);
}

export function planCaseTransitionV1(request: CaseTransitionRequestV1): CaseTransitionPlanV1 {
  const { current, expectedRevision, command, actorKey, reason } = request;
  if (!current || typeof current !== "object" || !UUID.test(current.id) || !UUID.test(current.workspace_id)) {
    invalid("invalid case identity");
  }
  if (!Number.isSafeInteger(current.revision) || current.revision < 1 ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision) {
    invalid("stale or malformed case revision");
  }
  if (!STATES.includes(current.case_state) || !STAGES.includes(current.current_stage)) {
    invalid("unrecognized DB02 case state");
  }
  if (typeof actorKey !== "string" || !ACTOR.test(actorKey) ||
      (actorKey.startsWith("user:") && !UUID.test(actorKey.slice(5)))) {
    invalid("invalid actor format (authentication must still be checked by backend)");
  }
  if (typeof reason !== "string" || reason.trim().length < 12 || reason.trim().length > 1000) {
    invalid("reason must contain 12–1000 non-whitespace characters");
  }
  if (current.next_action_at !== null &&
      (typeof current.next_action_at !== "string" || !Number.isFinite(Date.parse(current.next_action_at)))) {
    invalid("invalid current next action date");
  }
  let nextActionAt = current.next_action_at;
  if (Object.prototype.hasOwnProperty.call(request, "nextActionAt")) {
    const supplied = request.nextActionAt;
    if (supplied !== null && (typeof supplied !== "string" ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(supplied) ||
        !Number.isFinite(Date.parse(supplied)))) {
      invalid("nextActionAt requires explicit valid UTC timestamp or null");
    }
    nextActionAt = supplied ?? null;
  }

  // Terminal statuses belong ONLY to separately receipt-validated finalizers.
  if (current.case_state === "resolved" || current.case_state === "closed" ||
      current.current_stage === "complete") {
    invalid("terminal case cannot be changed by intake planner");
  }

  let state: CaseLifecycleStateV1;
  let stage: CaseStageV1;
  switch (command) {
    case "start_research":
      if (!(["open", "in_progress"] as string[]).includes(current.case_state) ||
          !(["triage", "research"] as string[]).includes(current.current_stage)) {
        invalid("research requires open triage/research (resume a held case explicitly)");
      }
      state = "in_progress";
      stage = "research";
      break;
    case "request_human_review":
      if (!(["open", "in_progress", "awaiting_review"] as string[]).includes(current.case_state) ||
          !(["triage", "research", "human_review"] as string[]).includes(current.current_stage)) {
        invalid("review request requires triage/research and cannot approve a decision");
      }
      state = "awaiting_review";
      stage = "human_review";
      break;
    case "hold_case":
      state = "held";
      stage = current.current_stage;
      break;
    case "done_for_now":
      if (current.case_state === "held") invalid("held case needs explicit resume; no silent release");
      if (current.case_state === "awaiting_review") invalid("pending human review must remain visible");
      state = "done_for_now";
      stage = current.current_stage;
      break;
    case "resume_case":
      if (current.case_state !== "held" && current.case_state !== "done_for_now") {
        invalid("resume requires held or done_for_now case");
      }
      // A past review/execution stage cannot imply a retained authorization.
      state = "in_progress";
      stage = "triage";
      break;
    default:
      invalid("unknown or privileged command");
  }

  const where = Object.freeze({
    id: current.id.toLowerCase(),
    workspace_id: current.workspace_id.toLowerCase(),
    revision: current.revision,
  });
  const changed = state !== current.case_state || stage !== current.current_stage ||
    nextActionAt !== current.next_action_at;
  return {
    contract: CASE_TRANSITION_CONTRACT,
    kind: changed ? "cas_update" : "no_change",
    where,
    set: changed ? Object.freeze({
      revision: current.revision + 1,
      case_state: state,
      current_stage: stage,
      next_action_at: nextActionAt,
      transition_actor_key: actorKey,
      transition_reason: reason.trim(),
    }) : null,
    journalAuthority: "mizizi_private.cases/mizizi_cases_journal",
  };
}

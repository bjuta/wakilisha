/**
 * An authenticated, redacted export of the existing operator-visible case and
 * hold ledgers. The Data API enforces workspace membership and capabilities.
 * This module never uses a service key or reads private SQL tables directly.
 *
 * Deliberate limits: no raw reasons, source identifiers, user identifiers, or
 * private evidence; linked receipt counts are not underlying receipt payloads.
 * This is a client-verified read, not a transactional database snapshot.
 */
import {
  loadDurableHeadquartersCasesV1,
  loadHeadquartersCaseEventsV1,
  loadHeadquartersHoldsV1,
  type HeadquartersRpc,
} from "./miziziDurableCases";

export async function buildRedactedHeadquartersAuditV1(
  rpc?: HeadquartersRpc,
): Promise<string> {
  const cases = await loadDurableHeadquartersCasesV1(rpc);
  const holds = await loadHeadquartersHoldsV1(rpc);

  // The hold RPC has no cursor. Refuse a potentially truncated export.
  if (holds.length >= 100) throw new RangeError("Headquarters hold ledger exceeds the export limit");

  const redactedCases: Array<Record<string, unknown>> = [];
  for (const item of cases) {
    // The case-event RPC exposes only the newest 100 revisions.
    if (item.caseRevision > 100) throw new RangeError("Headquarters case journal exceeds the export limit");
    const events = await loadHeadquartersCaseEventsV1(item.caseId, rpc);
    if (events.length !== item.caseRevision ||
      events[0]?.revision !== item.caseRevision ||
      events[events.length - 1]?.type !== "case_created" ||
      events[0]?.state !== item.state || events[0]?.stage !== item.stage)
      throw new Error("Headquarters case journal is incomplete or inconsistent");

    for (let i = 0; i < events.length; i++) {
      if (events[i].revision !== item.caseRevision - i ||
        (i + 1 < events.length &&
          (events[i].previousState !== events[i + 1].state ||
           events[i].previousStage !== events[i + 1].stage)))
        throw new Error("Headquarters case journal has an unverifiable revision chain");
    }

    redactedCases.push({
      caseId: item.caseId,
      claimFamily: item.claimFamily,
      subjectType: item.subjectType,
      caseRevision: item.caseRevision,
      state: item.state,
      stage: item.stage,
      riskClass: item.riskClass,
      linkedReceiptCount: item.receiptCount,
      updatedAt: item.updatedAt,
      events: events.map(event => {
        const actorClass = /^user:[0-9a-f-]{36}$/i.test(event.actorKey)
          ? "operator"
          : /^system:[a-z][a-z0-9_]{2,79}$/.test(event.actorKey)
            ? "system"
            : null;
        if (!actorClass) throw new Error("Unrecognized Headquarters journal actor");
        return {
          eventId: event.eventId,
          revision: event.revision,
          type: event.type,
          previousState: event.previousState,
          state: event.state,
          previousStage: event.previousStage,
          stage: event.stage,
          actorClass,
          recordedAt: event.recordedAt,
        };
      }),
    });
  }

  // A concurrent decision or new hold must not silently produce a mixed export.
  const confirmedCases = await loadDurableHeadquartersCasesV1(rpc);
  const confirmedHolds = await loadHeadquartersHoldsV1(rpc);
  if (JSON.stringify(cases) !== JSON.stringify(confirmedCases) ||
    JSON.stringify(holds) !== JSON.stringify(confirmedHolds))
    throw new Error("Headquarters records changed while preparing the audit");

  return JSON.stringify({
    format: "wakilisha.mizizi.headquarters.redacted-audit.v1",
    capturedAt: new Date().toISOString(),
    scope: "authenticated_case_and_workspace_hold_records",
    consistency: "client_verified_before_and_after;not_a_database_transaction_snapshot",
    redaction: "source_ids,review_ids,workspaces,raw_reasons,actor_ids,hold_keys,private_evidence_excluded",
    receipts: "linked_counts_only;underlying_receipt_payloads_not_included",
    caseCount: redactedCases.length,
    holdCount: holds.length,
    cases: redactedCases,
    holds: holds.map(hold => ({
      holdId: hold.holdId,
      scopeKind: hold.scopeKind,
      status: hold.status,
      revision: hold.revision,
      heldAt: hold.heldAt,
      releasedAt: hold.releasedAt,
    })),
  }, null, 2) + "\n";
}

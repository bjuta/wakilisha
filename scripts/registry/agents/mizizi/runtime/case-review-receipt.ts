/**
 * MIZIZI Headquarters / Slice 1: attach an EXISTING and verified Registry review
 * to an accepted case. No review creation, human judgment, grants, or Registry DML.
 *
 * The existing DB02 case_receipt_links trigger owns typed authority existence and
 * the immutable receipt; caller must already have authorized, transient SQL access.
 * The case is admitted separately by case-journal and that transaction commits
 * first. If this link fails, replay the same finding + receipt; never guess that
 * human review was approved or synthesize a new review to make the link work.
 */
import { createHash } from "node:crypto";
import { findingToCaseCandidateV1 } from "./case-adapter";
import type { CaseAdmissionResultV1, CaseDbPoolV1, CaseDbSessionV1 } from "./case-journal";
import type { MiziziFinding } from "../core";

export const CASE_REVIEW_RECEIPT_CONTRACT = "mizizi.case_review_receipt.v1" as const;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/;

type ReviewRow = {
  id: string;
  review_key: string;
  entity_type: string;
  entity_id: string | null;
  source_id: string | null;
  review_type: string;
  status: string;
  source_payload: unknown;
};

type CaseRow = {
  id: string;
  case_key: string;
  subject_id: string;
  subject_type: string;
  workspace_id: string;
};

type LinkRow = { id: string; authority_fingerprint: string };

export type ReviewReceiptResultV1 = Readonly<{
  contract: typeof CASE_REVIEW_RECEIPT_CONTRACT;
  caseId: string;
  reviewItemId: string;
  status: "linked" | "already_linked";
}>;

export async function attachExistingMiziziReviewV1(
  pool: CaseDbPoolV1,
  input: Readonly<{
    workspaceId: string;
    policyRulesetVersion: string;
    finding: Readonly<MiziziFinding>;
    admission: CaseAdmissionResultV1;
    reviewItemId: string;
  }>,
): Promise<ReviewReceiptResultV1> {
  const candidate = findingToCaseCandidateV1(input);
  const p = candidate.persistence;
  if (input.finding.disposition !== "review") {
    throw new TypeError("MIZIZI review receipt: only actual human-review findings may be linked");
  }
  if (!UUID.test(input.reviewItemId) || !UUID.test(input.admission.caseId)) {
    throw new TypeError("MIZIZI review receipt: invalid existing receipt/case identity");
  }
  if (input.admission.workspaceId !== p.workspace_id ||
      input.admission.caseKey !== p.case_key ||
      input.admission.contract !== "mizizi.case_journal.v1") {
    throw new Error("MIZIZI review receipt: admission identity disagrees with finding");
  }
  if (input.admission.status === "requires_manual_reopen") {
    throw new Error("MIZIZI review receipt: completed case requires separate human re-opening");
  }

  let began = false;
  const session = await pool.connect();
  try {
    await session.query("BEGIN");
    began = true;
    await session.query("SET LOCAL lock_timeout = '5s'");
    await session.query("SET LOCAL statement_timeout = '45s'");

    const cases = await session.query<CaseRow>(`
      select id::text,workspace_id::text,case_key,subject_type,subject_id::text
      from mizizi_private.cases
      where workspace_id=$1::uuid and id=$2::uuid
      for share
    `,[p.workspace_id,input.admission.caseId]);
    if (cases.rowCount !== 1 || cases.rows.length !== 1) {
      throw new Error("MIZIZI review receipt: case not found");
    }
    const owned = cases.rows[0];
    if (owned.workspace_id !== p.workspace_id || owned.case_key !== p.case_key ||
        owned.subject_type !== p.subject_type || owned.subject_id !== p.subject_id) {
      throw new Error("MIZIZI review receipt: case scope or subject mismatch");
    }

    const reviews = await session.query<ReviewRow>(`
      select id::text,review_key,entity_type,entity_id::text,source_id,
        review_type,status,source_payload
      from public.registry_review_items
      where id=$1::uuid
      for share
    `,[input.reviewItemId]);
    if (reviews.rowCount !== 1 || reviews.rows.length !== 1) {
      throw new Error("MIZIZI review receipt: Registry review not found");
    }
    const review = reviews.rows[0];
    // Only this existing review lane, not unrelated Chart ingestion categories.
    // Contribution-attestation reviews require their separate typed source contract.
    if (review.review_type !== "mizizi_data_hygiene" || review.status !== "open" ||
        !["track","release"].includes(input.finding.entityType)) {
      throw new Error("MIZIZI review receipt: review lane is not eligible");
    }
    const entityId = input.finding.entityId.toLowerCase();
    if (review.entity_type !== input.finding.entityType ||
        (review.entity_id != null && review.entity_id.toLowerCase() !== entityId) ||
        (review.source_id != null && review.source_id.toLowerCase() !== entityId)) {
      throw new Error("MIZIZI review receipt: Registry review subject mismatch");
    }
    if (review.entity_id == null && review.source_id == null) {
      throw new Error("MIZIZI review receipt: Registry review has no bound subject identity");
    }
    const payload = review.source_payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        (payload as Record<string,unknown>).ruleId !== input.finding.ruleId ||
        (payload as Record<string,unknown>).ruleVersion !== input.finding.ruleVersion ||
        review.review_key !== `mizizi:${input.finding.fingerprint}`) {
      throw new Error("MIZIZI review receipt: source rule or observation identity drift");
    }
    const immutableReviewIdentity = JSON.stringify([
      review.id.toLowerCase(), review.review_key, review.review_type,
      review.entity_type, entityId, input.finding.ruleId, input.finding.ruleVersion,
    ]);
    const fingerprint = createHash("sha256").update(immutableReviewIdentity).digest("hex");
    if (!SHA.test(fingerprint)) throw new Error("Invalid receipt digest");

    const inserted = await session.query<LinkRow>(`
      insert into mizizi_private.case_receipt_links (
        workspace_id,case_id,relation_type,authority_schema,authority_object_type,
        authority_id,authority_fingerprint,linked_by_actor_key,link_reason
      ) values ($1::uuid,$2::uuid,'review_item','public','registry_review_items',
        $3::uuid,$4,'system:mizizi','Existing bounded MIZIZI review attached; no human decision inferred.')
      on conflict (case_id,relation_type,authority_schema,authority_object_type,authority_id)
        do nothing
      returning id::text,authority_fingerprint
    `,[p.workspace_id,owned.id,review.id,fingerprint]);
    let status: ReviewReceiptResultV1["status"] = "linked";
    if (inserted.rowCount === 0 && inserted.rows.length === 0) {
      const existing = await session.query<LinkRow>(`
        select id::text,authority_fingerprint from mizizi_private.case_receipt_links
        where case_id=$1::uuid and relation_type='review_item' and
          authority_schema='public' and authority_object_type='registry_review_items'
          and authority_id=$2::uuid
      `,[owned.id,review.id]);
      if (existing.rowCount !== 1 || existing.rows.length !== 1 ||
          existing.rows[0].authority_fingerprint !== fingerprint) {
        throw new Error("MIZIZI review receipt: immutable link identity conflict");
      }
      status = "already_linked";
    } else if (inserted.rowCount !== 1 || inserted.rows.length !== 1 ||
               inserted.rows[0].authority_fingerprint !== fingerprint) {
      throw new Error("MIZIZI review receipt: inconsistent receipt insertion");
    }
    await session.query("COMMIT");
    began = false;
    return {contract: CASE_REVIEW_RECEIPT_CONTRACT,
      caseId: owned.id,reviewItemId: review.id,status};
  } catch (error) {
    if (began) {try {await session.query("ROLLBACK");} catch {/* preserve first error */}}
    throw error;
  } finally {session.release();}
}

import pg from "pg";

type PgPool = InstanceType<typeof pg.Pool>;

export type PersistedEnrichmentDecisionStatus = "draft" | "approved" | "rejected" | "needs_review" | "applied" | "superseded";

export interface PersistedEnrichmentDecisionResult {
  id: string;
  decisionStatus: PersistedEnrichmentDecisionStatus;
  registryEntityType: string;
  registryEntityId: string;
  fieldName: string;
}

const ALLOWED_STATUSES = new Set<PersistedEnrichmentDecisionStatus>([
  "draft",
  "approved",
  "rejected",
  "needs_review",
  "applied",
  "superseded",
]);

export function isPersistedEnrichmentDecisionStatus(value: unknown): value is PersistedEnrichmentDecisionStatus {
  return typeof value === "string" && ALLOWED_STATUSES.has(value as PersistedEnrichmentDecisionStatus);
}

export async function persistEnrichmentSuggestionDecision(
  pool: PgPool,
  suggestionId: string,
  decisionStatus: PersistedEnrichmentDecisionStatus,
): Promise<PersistedEnrichmentDecisionResult | null> {
  const result = await pool.query(
    `
      update public.registry_enrichment_suggestions
      set decision_status = $2
      where id::text = $1
      returning
        id::text as "id",
        decision_status as "decisionStatus",
        registry_entity_type as "registryEntityType",
        registry_entity_id as "registryEntityId",
        field_name as "fieldName"
    `,
    [suggestionId, decisionStatus],
  );

  return (result.rows[0] as PersistedEnrichmentDecisionResult | undefined) ?? null;
}

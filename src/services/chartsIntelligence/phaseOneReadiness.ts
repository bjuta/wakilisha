import type { IngestRun } from "../chartsIngestion/ingestStudioTypes";
import { assembleIngestRunIntelligence } from "./runIntelligence";
import type { IngestRunIntelligence } from "./intelligenceTypes";

export type PhaseOneReadinessCheckKey =
  | "run_has_rows"
  | "row_intelligence_generated"
  | "rich_metadata_generated"
  | "artist_credits_generated"
  | "eligibility_decisions_generated"
  | "commercial_readiness_generated"
  | "excluded_rows_tracked";

export type PhaseOneReadinessCheck = {
  key: PhaseOneReadinessCheckKey;
  passed: boolean;
  message: string;
};

export type PhaseOneReadinessReport = {
  runId: string;
  passed: boolean;
  generatedAt: string;
  checks: PhaseOneReadinessCheck[];
  intelligence: IngestRunIntelligence;
};

function countRowsWith<T>(rows: Record<string, T>, predicate: (value: T) => boolean): number {
  return Object.values(rows).filter(predicate).length;
}

export function assessPhaseOneReadiness(run: IngestRun): PhaseOneReadinessReport {
  const intelligence = assembleIngestRunIntelligence(run);
  const rowCount = run.rows.length;
  const intelligenceRows = Object.keys(intelligence.rowIntelligence).length;
  const richMetadataRows = countRowsWith(intelligence.rowIntelligence, (row) => Boolean(row.richMetadata));
  const artistCreditRows = countRowsWith(intelligence.rowIntelligence, (row) => Boolean(row.artistCredits?.length));
  const eligibilityRows = countRowsWith(intelligence.rowIntelligence, (row) => Boolean(row.eligibilityDecision));

  const checks: PhaseOneReadinessCheck[] = [
    {
      key: "run_has_rows",
      passed: rowCount > 0,
      message: rowCount > 0 ? `Run has ${rowCount} rows.` : "Run has no rows to assess.",
    },
    {
      key: "row_intelligence_generated",
      passed: rowCount === intelligenceRows,
      message: `Generated row intelligence for ${intelligenceRows}/${rowCount} rows.`,
    },
    {
      key: "rich_metadata_generated",
      passed: rowCount === richMetadataRows,
      message: `Generated rich metadata for ${richMetadataRows}/${rowCount} rows.`,
    },
    {
      key: "artist_credits_generated",
      passed: rowCount === artistCreditRows,
      message: `Generated relational artist credits for ${artistCreditRows}/${rowCount} rows.`,
    },
    {
      key: "eligibility_decisions_generated",
      passed: rowCount === eligibilityRows,
      message: `Generated default eligibility decisions for ${eligibilityRows}/${rowCount} rows.`,
    },
    {
      key: "commercial_readiness_generated",
      passed: Boolean(intelligence.commercialReadiness?.checks.length),
      message: intelligence.commercialReadiness
        ? `Generated commercial readiness score: ${intelligence.commercialReadiness.score}.`
        : "Commercial readiness report was not generated.",
    },
    {
      key: "excluded_rows_tracked",
      passed: Array.isArray(intelligence.excludedRows),
      message: `Tracked ${intelligence.excludedRows.length} excluded rows.`,
    },
  ];

  return {
    runId: run.id,
    passed: checks.every((check) => check.passed),
    generatedAt: new Date().toISOString(),
    checks,
    intelligence,
  };
}

import {
  benchmarkExternalIdentifierAutonomy,
  type ExternalIdentifierBenchmarkCase,
} from "./core";
import {
  createRegistryPool,
} from "../../phase1-db";

const FIXTURES: ExternalIdentifierBenchmarkCase[] = [
  {
    id: "apple-track-exact",
    expectedDisposition: "eligible",
    candidate: {
      subjectType: "track",
      schemeKey: "apple_music",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 0,
    },
  },
  {
    id: "spotify-artist-exact",
    expectedDisposition: "eligible",
    candidate: {
      subjectType: "artist",
      schemeKey: "spotify",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 0,
    },
  },
  {
    id: "stale-source",
    expectedDisposition: "abstain",
    candidate: {
      subjectType: "release",
      schemeKey: "apple_music",
      exactProviderIdentifier: true,
      sourceStateCurrent: false,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 0,
    },
  },
  {
    id: "source-fingerprint-drift",
    expectedDisposition: "abstain",
    candidate: {
      subjectType: "track",
      schemeKey: "spotify",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: false,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 0,
    },
  },
  {
    id: "candidate-fingerprint-drift",
    expectedDisposition: "abstain",
    candidate: {
      subjectType: "artist",
      schemeKey: "apple_music",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: false,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 0,
    },
  },
  {
    id: "conflicting-current-assertion",
    expectedDisposition: "abstain",
    candidate: {
      subjectType: "track",
      schemeKey: "apple_music",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 1,
      duplicateAssignmentCount: 0,
    },
  },
  {
    id: "duplicate-assignment",
    expectedDisposition: "abstain",
    candidate: {
      subjectType: "release",
      schemeKey: "spotify",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 1,
    },
  },
  {
    id: "unsupported-work-subject",
    expectedDisposition: "abstain",
    candidate: {
      subjectType: "work",
      schemeKey: "apple_music",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 0,
    },
  },
  {
    id: "unsupported-scheme",
    expectedDisposition: "abstain",
    candidate: {
      subjectType: "track",
      schemeKey: "musicbrainz",
      exactProviderIdentifier: true,
      sourceStateCurrent: true,
      sourceFingerprintMatches: true,
      candidateFingerprintMatches: true,
      conflictingCurrentAssertionCount: 0,
      duplicateAssignmentCount: 0,
    },
  },
];

async function main(): Promise<void> {
  const pool = createRegistryPool();

  try {
    const gold = await pool.query<{
      gold_rows: string;
    }>(`
      select count(*)::text as gold_rows
      from public.registry_external_identifier_assertions assertion
      join platform_private.registry_operation_write_events write_link
        on write_link.canonical_write_event_id = any (
          select event.id
          from public.registry_canonical_write_events event
          where event.registry_entity_id = assertion.id::text
            and event.action = 'admit_external_identifier_assertion'
            and event.status = 'succeeded'
        )
      join platform_private.registry_mutation_operations operation
        on operation.id = write_link.operation_id
      where operation.operation_key = 'registry.external_identifier_assertion.admit'
        and operation.status = 'succeeded'
        and operation.verifier_status = 'passed'
    `);

    const productionGoldRows =
      Number(gold.rows[0]?.gold_rows || 0);

    const result =
      benchmarkExternalIdentifierAutonomy(
        FIXTURES,
        productionGoldRows,
      );

    console.log(
      JSON.stringify(
        result,
        null,
        2,
      ),
    );

    console.log(
      `MIZIZI_PROVENANCE_BENCHMARK_FIXTURES=${
        result.fixtureCorrect
      }/${result.fixtureCount}`,
    );
    console.log(
      `MIZIZI_PROVENANCE_BENCHMARK_PRODUCTION_GOLD=${
        result.productionGoldRows
      }/${result.minimumGoldRows}`,
    );
    console.log(
      `MIZIZI_PROVENANCE_AUTONOMY_EARNED=${
        result.autonomyEarned
          ? "YES"
          : "NO"
      }`,
    );

    if (
      result.falsePositiveCount !== 0 ||
      result.fixtureCorrect !==
        result.fixtureCount
    ) {
      throw new Error(
        "Benchmark fixture contract failed.",
      );
    }

    if (!result.autonomyEarned) {
      console.log(
        "MIZIZI_PROVENANCE_AUTONOMY_DECISION=KEEP_HUMAN_REVIEW",
      );
    }
  } finally {
    await pool.end();
  }
}

void main();

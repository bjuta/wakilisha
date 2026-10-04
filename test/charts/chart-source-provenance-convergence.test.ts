import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  "supabase/functions/chart-ingest-api/index.ts",
  "utf8",
);

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing start marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing end marker: ${end}`).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("Chart independent source provenance", () => {
  it("uses ISRC as a strong cross-provider grouping alias", () => {
    const aliases = between(
      runtime,
      "function rawSongStrongIdentityAliases",
      "function rawSongFallbackIdentityAlias",
    );

    expect(aliases).toContain("normalizeIsrc(row.isrc)");
    expect(aliases).toContain("`isrc:${isrc}`");
    expect(aliases).toContain("providerIdentityAliasesFromJson");
  });

  it("counts distinct provider keys rather than URL count", () => {
    const normalize = between(
      runtime,
      "async function handleNormalizeRun",
      "// SOURCE_FETCH",
    );

    expect(normalize).toContain(
      'const sourceKey = normalizeProviderKey(row.provider) || "unknown";',
    );
    expect(normalize).toContain("sources: new Set([sourceKey])");
    expect(normalize).toContain("group.sources.add(sourceKey)");
    expect(normalize).toContain("const sourceCount = group.sources.size");
  });

  it("fails scoring closed when recoverable providers disagree with source_count", () => {
    const scoring = between(
      runtime,
      "async function handleRunScoring",
      "// SHORTLIST",
    );

    expect(scoring).toContain("sourceProvidersByIdentity");
    expect(scoring).toContain("candidateEvidenceIdentityAliases");
    expect(scoring).toContain("scoring_source_count_invariant_failed");
    expect(scoring).toContain("recoveredSourceCount");
  });

  it("retains provider provenance through score and immutable edition payload", () => {
    const scoring = between(
      runtime,
      "async function handleRunScoring",
      "// SHORTLIST",
    );
    const commit = between(
      runtime,
      "async function handleCommitRun",
      "async function handleRunAirplayDetection",
    );

    expect(scoring).toContain("source_providers: score.source_providers");
    expect(scoring).toContain("source_evidence_identity_key");
    expect(commit).toContain("source_payload:");
    expect(commit).toContain("score_payload_json");
    expect(commit).toContain("source_urls_seen:");
  });
});

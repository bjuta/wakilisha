import type { IngestResolvedRow, IngestRun } from "../chartsIngestion/ingestStudioTypes";
import type { CommercialReadinessCheck, CommercialReadinessReport } from "./intelligenceTypes";

function topRows(run: IngestRun, limit = 10): IngestResolvedRow[] {
  return [...run.rows].sort((a, b) => a.rank - b.rank).slice(0, limit);
}

function percentage(passed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((passed / total) * 100);
}

function checkTopArtwork(run: IngestRun): CommercialReadinessCheck {
  const rows = topRows(run);
  const missing = rows.filter((row) => !row.artworkUrl).map((row) => row.id);
  return {
    key: "top_entries_have_artwork",
    passed: missing.length === 0,
    severity: missing.length === 0 ? "info" : "warning",
    label: "Top entries have artwork",
    message: missing.length === 0 ? "Top entries include artwork." : `${missing.length} top entries are missing artwork.`,
    affectedRowIds: missing,
  };
}

function checkTopPreviews(run: IngestRun): CommercialReadinessCheck {
  const rows = topRows(run);
  const missing = rows.filter((row) => {
    const raw = row.raw as Record<string, unknown> | undefined;
    return !raw?.previewUrl;
  }).map((row) => row.id);
  return {
    key: "top_entries_have_preview",
    passed: missing.length === 0,
    severity: "warning",
    label: "Top entries have previews",
    message: missing.length === 0 ? "Top entries include preview data." : `${missing.length} top entries do not have preview data. This is a warning unless the eligibility profile requires previews.`,
    affectedRowIds: missing,
  };
}

function checkCanonicalArtists(run: IngestRun): CommercialReadinessCheck {
  const unresolved = run.rows.filter((row) => !row.canonicalArtistIds?.length).map((row) => row.id);
  return {
    key: "canonical_artists_resolved",
    passed: unresolved.length === 0,
    severity: unresolved.length === 0 ? "info" : "blocking",
    label: "Canonical artists resolved",
    message: unresolved.length === 0 ? "All rows have canonical artist IDs." : `${unresolved.length} rows do not have canonical artist IDs.`,
    affectedRowIds: unresolved,
  };
}

function checkCleanCredits(run: IngestRun): CommercialReadinessCheck {
  const risky = run.rows.filter((row) => row.artistNames.some((name) => /,| feat\.? | ft\.? | featuring | x | with | & /i.test(name))).map((row) => row.id);
  return {
    key: "clean_artist_credits",
    passed: risky.length === 0,
    severity: risky.length === 0 ? "info" : "warning",
    label: "Artist credits look clean",
    message: risky.length === 0 ? "No obvious collaboration strings found in artist names." : `${risky.length} rows may need relational artist credit review.`,
    affectedRowIds: risky,
  };
}

function checkPublicUrls(run: IngestRun): CommercialReadinessCheck {
  const missing = run.rows.filter((row) => {
    const raw = row.raw as Record<string, unknown> | undefined;
    return !raw?.externalUrl;
  }).map((row) => row.id);
  return {
    key: "public_urls_available",
    passed: missing.length === 0,
    severity: missing.length === 0 ? "info" : "warning",
    label: "Public provider URLs available",
    message: missing.length === 0 ? "All rows include provider URLs." : `${missing.length} rows are missing public provider URLs.`,
    affectedRowIds: missing,
  };
}

function checkMetadataCompleteness(run: IngestRun): CommercialReadinessCheck {
  const complete = run.rows.filter((row) => row.title && row.artistNames.length > 0 && row.artworkUrl && row.sourceProvider && row.sourceUrl).length;
  const score = percentage(complete, run.rows.length);
  return {
    key: "metadata_completeness",
    passed: score >= 85,
    severity: score >= 85 ? "info" : "warning",
    label: "Metadata completeness",
    message: `${score}% of rows have core metadata: title, artist, artwork, source provider, and source URL.`,
  };
}

function checkSponsorSafe(run: IngestRun): CommercialReadinessCheck {
  const explicitRows = run.rows.filter((row) => {
    const raw = row.raw as Record<string, unknown> | undefined;
    return raw?.explicit === true;
  }).map((row) => row.id);
  return {
    key: "sponsor_safe",
    passed: explicitRows.length === 0,
    severity: explicitRows.length === 0 ? "info" : "warning",
    label: "Sponsor-safe content flags",
    message: explicitRows.length === 0 ? "No explicit content flags found in current metadata." : `${explicitRows.length} rows are flagged explicit by provider metadata.`,
    affectedRowIds: explicitRows,
  };
}

function checkSourceCoverage(run: IngestRun): CommercialReadinessCheck {
  const providers = new Set(run.rows.map((row) => row.sourceProvider));
  return {
    key: "source_coverage_complete",
    passed: providers.size > 0 && run.rows.length >= Math.min(run.chartSize, 1),
    severity: providers.size > 0 ? "info" : "blocking",
    label: "Source coverage present",
    message: providers.size > 0 ? `Rows were sourced from ${Array.from(providers).join(", ")}.` : "No source provider coverage found.",
  };
}

function checkSnapshotReady(run: IngestRun): CommercialReadinessCheck {
  return {
    key: "snapshot_integrity_ready",
    passed: run.status === "ready_to_commit" || run.status === "dry_run_complete" || run.status === "committed",
    severity: run.status === "failed" || run.status === "cancelled" ? "blocking" : "info",
    label: "Snapshot integrity can run",
    message: run.status === "failed" || run.status === "cancelled" ? `Run status is ${run.status}; snapshot checks should not proceed.` : "Run status allows downstream snapshot/integrity checks.",
  };
}

export function evaluateCommercialReadiness(run: IngestRun): CommercialReadinessReport {
  const checks: CommercialReadinessCheck[] = [
    checkTopArtwork(run),
    checkTopPreviews(run),
    checkCanonicalArtists(run),
    checkCleanCredits(run),
    checkPublicUrls(run),
    checkMetadataCompleteness(run),
    checkSponsorSafe(run),
    checkSourceCoverage(run),
    checkSnapshotReady(run),
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  const blockingReasons = checks.filter((check) => !check.passed && check.severity === "blocking").map((check) => check.message);
  const warnings = checks.filter((check) => !check.passed && check.severity === "warning").map((check) => check.message);

  return {
    score: percentage(passedCount, checks.length),
    publishable: blockingReasons.length === 0,
    checkedAt: new Date().toISOString(),
    checks,
    blockingReasons,
    warnings,
  };
}

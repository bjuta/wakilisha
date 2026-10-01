import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

const report = read(
  "scripts/control-plane/report-creator-cohort-track-isrc-projection-readonly.sql",
);

const design = read(
  "docs/engineering/creator-cohort-track-isrc-projection-20261001.md",
);

const mutatingSql =
  /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call)\b/i;

const networkSql =
  /https?:\/\/|http_get|http_post|net\.|pg_net/i;

function executableSql(sql: string): string {
  return sql
    .split("\n")
    .map((line) =>
      line.replace(/--.*$/, ""),
    )
    .join("\n");
}

describe("Creator cohort Track ISRC projection", () => {
  it("keeps the candidate report transactionally read-only and offline", () => {
    expect(
      report.toLowerCase(),
    ).toContain(
      "begin transaction read only;",
    );
    expect(
      report.toLowerCase(),
    ).toContain("rollback;");

    const executable =
      executableSql(report);

    expect(executable).not.toMatch(
      mutatingSql,
    );
    expect(executable).not.toMatch(
      networkSql,
    );
  });

  it("requires exact retained typed Apple evidence", () => {
    expect(report).toContain(
      "l.provider_key='apple_music'",
    );
    expect(report).toContain(
      "m.match_status='matched'",
    );
    expect(report).toContain(
      "m.match_method='exact_title_artist'",
    );
    expect(report).toContain(
      "coalesce(m.match_confidence,0)>=0.93",
    );
    expect(report).toContain(
      "m.candidate_isrc<>m.payload_isrc",
    );
  });

  it("keeps collisions and fuzzy matches out of deterministic projection", () => {
    expect(report).toContain(
      "deterministic_projection_candidate",
    );
    expect(report).toContain(
      "review_duplicate_candidate_isrc",
    );
    expect(report).toContain(
      "review_existing_registry_isrc",
    );
    expect(report).toContain(
      "review_provider_match",
    );
    expect(report).toContain(
      "review_provider_payload_conflict",
    );
  });

  it("keeps the mutation contract narrow", () => {
    expect(design).toContain(
      "registry.track.isrc_projection.admit/v1",
    );
    expect(design).toContain(
      "admit_registry_track_isrc_projection",
    );
    expect(design).toContain(
      "registry_provider_link_admin",
    );

    expect(design).toContain(
      "current `registry_tracks.isrc` must be null",
    );
    expect(design).toContain(
      "no overwrite",
    );
    expect(design).toContain(
      "no reconciliation",
    );
    expect(design).toContain(
      "no Track merge",
    );
    expect(design).toContain(
      "no provider-link rewrite",
    );
  });

  it("requires assertion and hot-path projection to share evidence", () => {
    expect(design).toContain(
      "registry_external_identifier_assertions",
    );
    expect(design).toContain(
      "one `registry_tracks.isrc` projection",
    );
    expect(design).toContain(
      "canonical write-event causality for both effects",
    );
    expect(design).toContain(
      "candidate-state fingerprint",
    );
    expect(design).toContain(
      "provider-link state fingerprint",
    );
  });

  it("keeps Work and contributor identity outside this tranche", () => {
    for (const excluded of [
      "create Works",
      "create Track-to-Work links",
      "split composer strings",
      "create People",
      "acquire fresh Apple data",
    ]) {
      expect(design).toContain(excluded);
    }
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const reports = {
  provider: read(
    "scripts/control-plane/report-music-metadata-provider-identifiers.sql",
  ),
  labelComposer: read(
    "scripts/control-plane/report-music-metadata-label-composer-candidates.sql",
  ),
  media: read(
    "scripts/control-plane/report-music-metadata-media-reuse-candidates.sql",
  ),
};

const mutatingSql =
  /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call)\b/i;
const networkSql = /https?:\/\/|http_get|http_post|net\.|pg_net/i;

function executableSql(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("Music metadata Slice 3 read-only reports", () => {
  it("keeps every report transactionally read-only", () => {
    for (const sql of Object.values(reports)) {
      expect(sql.toLowerCase()).toContain("begin transaction read only;");
      expect(sql.toLowerCase()).toContain("rollback;");
      const executable = executableSql(sql);
      expect(executable).not.toMatch(mutatingSql);
      expect(executable).not.toMatch(networkSql);
    }
  });

  it("keeps provider identifiers as evidence and duplicate assignments review-only", () => {
    expect(reports.provider).toContain("WAKILISHA UUID remains canonical identity");
    expect(reports.provider).toContain("apple_music_track_id");
    expect(reports.provider).toContain("apple_music_album_id");
    expect(reports.provider).toContain("spotify_artist_id");
    expect(reports.provider).toContain("spotify_id");
    expect(reports.provider).toContain("array_agg(distinct source_key");
    expect(reports.provider).toContain("deterministic_candidate");
    expect(reports.provider).toContain("review_only_duplicate_assignment");
    expect(reports.provider).toContain("canonical_entity_count");
  });

  it("keeps label matching exact and composer evidence unresolved", () => {
    expect(reports.labelComposer).toContain("metadata->>'record_label'");
    expect(reports.labelComposer).toContain("[[:space:]]+");
    expect(reports.labelComposer).not.toContain("[^[:alnum:]]+");
    expect(reports.labelComposer).toContain("exact_label_candidate");
    expect(reports.labelComposer).toContain("review_only_unmatched");
    expect(reports.labelComposer).toContain("review_only_ambiguous");

    expect(reports.labelComposer).toContain(
      "raw_payload#>>'{data,0,attributes,composerName}'",
    );
    expect(reports.labelComposer).toContain("provider_item_id");
    expect(reports.labelComposer).toContain(
      "review_only_raw_composer_evidence",
    );
    expect(reports.labelComposer).not.toMatch(
      /insert\s+into\s+(?:public\.)?registry_(?:works|work_contributions)/i,
    );
  });

  it("requires exact URL identity for media reuse candidates", () => {
    expect(reports.media).toContain("m.url = n.source_url");
    expect(reports.media).toContain("m.status = 'active'");
    expect(reports.media).toContain("already_typed");
    expect(reports.media).toContain("exact_url_reuse_candidate");
    expect(reports.media).toContain("review_only_no_existing_asset");
    expect(reports.media).toContain("review_only_multiple_exact_assets");
    expect(reports.media).not.toMatch(/similarity\s*\(/i);
    expect(reports.media).not.toMatch(/levenshtein/i);
  });
});

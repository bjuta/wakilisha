import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

const sql = read(
  "scripts/control-plane/report-music-work-provider-resolution-readonly.sql",
);
const plannerPath = path.join(
  root,
  "scripts/control-plane/plan-music-work-provider-acquisition.mjs",
);
const manifest = JSON.parse(
  read(
    "config/music-work-provider-field-policy.v1.json",
  ),
) as {
  defaultProfile: string;
  profiles: Record<string, { categories: string[] }>;
  providers: Record<
    string,
    {
      workEvidenceStrength: string;
      policyStatus: string;
      fields: Array<{
        key: string;
        category: string;
        retention: string;
      }>;
    }
  >;
};

const mutatingSql =
  /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call)\b/i;
const networkSql =
  /https?:\/\/|http_get|http_post|net\.|pg_net/i;

function executableSql(value: string): string {
  return value
    .split("\n")
    .map((line) =>
      line.replace(/--.*$/, ""),
    )
    .join("\n");
}

function plan(
  profile: string,
  providers: string,
) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        plannerPath,
        "--profile",
        profile,
        "--providers",
        providers,
        "--json",
      ],
      {
        cwd: root,
        encoding: "utf8",
      },
    ),
  ) as {
    mutationAuthority: string;
    networkCalls: string;
    providers: Array<{
      key: string;
      selected: Array<{ key: string }>;
      optionalAvailable: Array<{
        key: string;
      }>;
      blocked: Array<{ key: string }>;
    }>;
  };
}

describe("Music Work provider evidence audit", () => {
  it("keeps the catalogue audit transactionally read-only and offline", () => {
    expect(
      sql.toLowerCase(),
    ).toContain(
      "begin transaction read only;",
    );
    expect(
      sql.toLowerCase(),
    ).toContain("rollback;");

    const executable =
      executableSql(sql);

    expect(executable).not.toMatch(
      mutatingSql,
    );
    expect(executable).not.toMatch(
      networkSql,
    );
  });

  it("classifies Tracks without inventing Work authority", () => {
    expect(sql).toContain(
      "already_work_linked",
    );
    expect(sql).toContain(
      "provider_collision_review",
    );
    expect(sql).toContain(
      "external_work_resolution_ready_isrc",
    );
    expect(sql).toContain(
      "external_work_resolution_ready_with_retained_composer",
    );
    expect(sql).toContain(
      "recording_identity_only_apple_policy_restricted",
    );
    expect(sql).toContain(
      "insufficient_provider_identity",
    );
    expect(sql).toContain(
      "musicbrainz_isrc_then_mlc_or_acrcloud",
    );
  });

  it("makes extra provider fields an explicit operator choice", () => {
    expect(
      manifest.defaultProfile,
    ).toBe("work-evidence-only");

    expect(
      Object.keys(manifest.profiles),
    ).toEqual(
      expect.arrayContaining([
        "work-evidence-only",
        "work-plus-registry-enrichment",
        "review-all-available",
      ]),
    );

    const evidencePlan = plan(
      "work-evidence-only",
      "musicbrainz,acrcloud",
    );

    expect(
      evidencePlan.mutationAuthority,
    ).toBe("none");
    expect(
      evidencePlan.networkCalls,
    ).toBe("none");

    const mb = evidencePlan.providers.find(
      (provider) =>
        provider.key === "musicbrainz",
    );
    expect(
      mb?.selected.map(
        (field) => field.key,
      ),
    ).toEqual(
      expect.arrayContaining([
        "isrc",
        "recording_mbid",
        "work_mbid",
        "iswc",
        "composer_relations",
        "lyricist_relations",
      ]),
    );
    expect(
      mb?.optionalAvailable.map(
        (field) => field.key,
      ),
    ).toEqual(
      expect.arrayContaining([
        "work_language",
        "work_type",
        "aliases",
      ]),
    );

    const enrichedPlan = plan(
      "work-plus-registry-enrichment",
      "musicbrainz",
    );
    const enrichedMusicBrainz =
      enrichedPlan.providers[0];

    expect(
      enrichedMusicBrainz.selected.map(
        (field) => field.key,
      ),
    ).toEqual(
      expect.arrayContaining([
        "work_language",
        "work_type",
      ]),
    );
  });

  it("blocks provider fields that are not approved for the Work backfill", () => {
    expect(
      manifest.providers.apple_music
        .policyStatus,
    ).toBe(
      "restricted_not_approved_for_registry_backfill",
    );
    expect(
      manifest.providers.apple_music_feed
        .policyStatus,
    ).toBe("blocked");

    expect(
      manifest.providers.apple_music.fields.every(
        (field) =>
          field.retention ===
          "policy_blocked_for_backfill",
      ),
    ).toBe(true);

    const result = spawnSync(
      process.execPath,
      [
        plannerPath,
        "--profile",
        "work-evidence-only",
        "--providers",
        "apple_music",
        "--include",
        "apple_music.composer_name",
        "--json",
      ],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "policy-blocked",
    );
  });

  it("keeps Spotify as opt-in recording corroboration rather than Work authority", () => {
    expect(
      manifest.providers.spotify
        .workEvidenceStrength,
    ).toBe("recording_only");

    expect(
      manifest.providers.spotify.fields.some(
        (field) =>
          field.category ===
            "work_identity" ||
          field.category ===
            "work_contributor",
      ),
    ).toBe(false);

    const spotifyPlan = plan(
      "work-evidence-only",
      "spotify",
    );

    expect(
      spotifyPlan.providers[0].selected,
    ).toEqual([]);
    expect(
      spotifyPlan.providers[0]
        .optionalAvailable.length,
    ).toBeGreaterThan(0);
  });

  it("exposes Work-specific sources and identifiers", () => {
    expect(
      manifest.providers.musicbrainz.fields.some(
        (field) =>
          field.key === "work_mbid",
      ),
    ).toBe(true);
    expect(
      manifest.providers.mlc.fields.some(
        (field) =>
          field.key ===
          "work_identifier",
      ),
    ).toBe(true);
    expect(
      manifest.providers.acrcloud.fields.some(
        (field) =>
          field.key === "iswc",
      ),
    ).toBe(true);
    expect(
      manifest.providers.iswc.fields.some(
        (field) =>
          field.key ===
          "ipi_name_numbers",
      ),
    ).toBe(true);
    expect(
      manifest.providers.ddex_ern.fields.some(
        (field) =>
          field.key ===
          "underlying_work_identifier",
      ),
    ).toBe(true);
  });
});

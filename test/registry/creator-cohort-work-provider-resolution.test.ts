import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

function findMigration(): string {
  const migrationDir = path.join(
    root,
    "supabase/migrations",
  );
  const match = fs
    .readdirSync(migrationDir)
    .filter((name) =>
      name.endsWith(
        "_creator_cohort_work_provider_resolution_v1.sql",
      ),
    )
    .sort()
    .at(-1);

  if (!match) {
    throw new Error(
      "Missing creator cohort Work provider resolution migration.",
    );
  }

  return read(
    path.join("supabase/migrations", match),
  );
}

const edge = read(
  "supabase/functions/music-work-resolver/index.ts",
);
const runner = read(
  "scripts/control-plane/run-music-work-resolution.mjs",
);

describe("Creator cohort Work provider resolution", () => {
  it("keeps provider acquisition separate from canonical mutation authority", () => {
    expect(edge).toContain(
      "record_registry_work_provider_observation_v1",
    );
    expect(edge).toContain(
      "admin_admit_registry_work_provider_observation_v1",
    );

    expect(edge).not.toMatch(
      /serviceClient\s*\.from\(["']registry_works["']\)/,
    );
    expect(edge).not.toMatch(
      /serviceClient\s*\.from\(["']registry_track_work_links["']\)/,
    );
    expect(edge).not.toMatch(
      /serviceClient\s*\.from\(["']registry_external_identifier_assertions["']\)/,
    );

    expect(edge).toContain(
      'required_capability: "manage_registry"',
    );
  });

  it("uses the exact MusicBrainz ISRC -> Recording -> Work chain and rate limit", () => {
    expect(edge).toContain(
      "/isrc/",
    );
    expect(edge).toContain(
      "?inc=work-rels&fmt=json",
    );
    expect(edge).toContain(
      "/work/",
    );
    expect(edge).toContain(
      "?inc=artist-rels&fmt=json",
    );
    expect(edge).toContain(
      '"User-Agent": MUSICBRAINZ_USER_AGENT',
    );
    expect(edge).toContain("await sleep(1100)");

    expect(edge).toContain(
      "musicbrainz_recording_not_found",
    );
    expect(edge).toContain(
      "musicbrainz_multiple_recordings",
    );
    expect(edge).toContain(
      "musicbrainz_work_not_found",
    );
    expect(edge).toContain(
      "musicbrainz_multiple_works",
    );
    expect(edge).toContain(
      "musicbrainz_work_relation_not_exact_embodiment",
    );
    expect(edge).toContain(
      'relationType !== "performance"',
    );
  });

  it("makes catalogue execution explicit and resumable", () => {
    expect(runner).toContain(
      "Without --apply this command performs no provider calls and no mutation.",
    );
    expect(runner).toContain(
      'value === "--apply"',
    );
    expect(runner).toContain(
      'value === "--resume-log"',
    );
    expect(runner).toContain(
      "V1 apply mode requires an explicit --limit",
    );
    expect(runner).toContain(
      "PLAN ONLY: no provider calls and no Registry mutation performed.",
    );
    expect(runner).toContain(
      "/functions/v1/music-work-resolver",
    );
    expect(runner).not.toContain(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    const output = execFileSync(
      process.execPath,
      [
        path.join(
          root,
          "scripts/control-plane/run-music-work-resolution.mjs",
        ),
        "--help",
      ],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    expect(output).toContain("--apply");
    expect(output).toContain("--resume-log");
  });

  it("adds provider observations without creating a second Work authority", () => {
    const migration = findMigration();

    expect(migration).toContain(
      "record_registry_work_provider_observation_v1",
    );
    expect(migration).toContain(
      "admin_admit_registry_work_provider_observation_v1",
    );
    expect(migration).toContain(
      "public.admin_create_registry_work_v1",
    );
    expect(migration).toContain(
      "public.admin_admit_registry_track_work_link_v1",
    );
    expect(migration).toContain(
      "public.admin_admit_registry_work_external_identifier_candidate_v1",
    );

    expect(migration).not.toContain(
      "'registry.work.provider_resolution.admit'",
    );
    expect(migration).not.toContain(
      "'registry.track_work.provider_resolution.admit'",
    );
  });

  it("deduplicates Work and Track-to-Work identity deterministically", () => {
    const migration = findMigration();

    expect(migration).toContain(
      "registry_provider_work_uuid_v1",
    );
    expect(migration).toContain(
      "registry_provider_track_work_link_uuid_v1",
    );
    expect(migration).toContain(
      "'work.provider:'",
    );
    expect(migration).toContain(
      "'track.work:'",
    );

    expect(migration).toContain(
      "musicbrainz_work_id",
    );
    expect(migration).toContain(
      "musicbrainz_recording_id",
    );
    expect(migration).toContain(
      "'musicbrainz'",
    );
    expect(migration).toContain(
      "'iswc'",
    );
  });

  it("extends external-identifier authority to Work without leaking direct writers", () => {
    const migration = findMigration();

    expect(migration).toContain(
      "registry_external_identifier_assertions_scheme_check",
    );
    expect(migration).toMatch(
      /'musicbrainz'::text/,
    );

    expect(migration).toContain(
      "registry_work_external_identifier_candidate_state_v1",
    );
    expect(migration).toContain(
      "insert into public.registry_external_identifier_assertions",
    );
    expect(migration).toContain(
      "work_id",
    );

    expect(migration).toContain(
      "revoke all on function",
    );
    expect(migration).toContain(
      "from public,anon,authenticated,service_role",
    );
  });
});

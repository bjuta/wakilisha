import {
  createHash,
} from "node:crypto";
import {
  readFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const read =
  (path: string) =>
    readFileSync(
      path,
      "utf8",
    );

function productionStatementSha(
  path: string,
) {
  const bytes =
    readFileSync(
      path,
    );

  expect(
    bytes.at(-1),
  ).toBe(
    10,
  );

  return createHash(
    "sha256",
  )
    .update(
      bytes.subarray(
        0,
        -1,
      ),
    )
    .digest(
      "hex",
    );
}

describe(
  "live migration-history control plane",
  () => {
    it(
      "uses production-recorded timestamps for the four proven historical aliases without changing SQL",
      () => {
        const canonical = [
          [
            "supabase/migrations/20260816083329_community_social_graph_m8b_authority.sql",
            "7892249b9601459aeb81b19596695c1c9db6ab46985afbdc66c6ef6fb09d92ed",
          ],
          [
            "supabase/migrations/20260816083408_community_social_graph_m8b_read_surfaces.sql",
            "7f879248759e147937fa23d188b930be130b7cb4771c52f14bb9aa478d60d09b",
          ],
          [
            "supabase/migrations/20260816185425_personal_playlist_duplicate_track_confirmation.sql",
            "a479cdd9b99682fd2f233d8ecc74ae4460ccc69fa7a5b5388e76ad5ea86c7407",
          ],
          [
            "supabase/migrations/20260816202232_correct_valle_release_featured_credit.sql",
            "63b6b8d10e73cd7217e027aa5d62f6ba1148e11ee18924c622e78dcf888fe90b",
          ],
        ] as const;

        const retired = [
          "supabase/migrations/20260816083500_community_social_graph_m8b_authority.sql",
          "supabase/migrations/20260816090000_community_social_graph_m8b_read_surfaces.sql",
          "supabase/migrations/20260816143000_personal_playlist_duplicate_track_confirmation.sql",
          "supabase/migrations/20260816200500_correct_valle_release_featured_credit.sql",
        ];

        for (
          const path
          of retired
        ) {
          expect(
            existsSync(
              path,
            ),
          ).toBe(
            false,
          );
        }

        for (
          const [
            path,
            expectedSha,
          ]
          of canonical
        ) {
          expect(
            existsSync(
              path,
            ),
          ).toBe(
            true,
          );

          expect(
            productionStatementSha(
              path,
            ),
          ).toBe(
            expectedSha,
          );
        }
      },
    );

    it(
      "keeps historical tests and the live baseline aligned with repository migration authority",
      () => {
        const expectedReferences = [
          [
            "test/community/social-graph-m8b-actions.test.ts",
            "20260816083329_community_social_graph_m8b_authority.sql",
          ],
          [
            "test/community/social-graph-m8b-authority.test.ts",
            "20260816083329_community_social_graph_m8b_authority.sql",
          ],
          [
            "test/community/social-graph-m8b-read-surfaces.test.ts",
            "20260816083408_community_social_graph_m8b_read_surfaces.sql",
          ],
          [
            "test/playlists/personal-playlists-m8c-authority.test.ts",
            "20260816185425_personal_playlist_duplicate_track_confirmation.sql",
          ],
          [
            "test/playlists/personal-playlists-m8c1-reach.test.ts",
            "20260816185425_personal_playlist_duplicate_track_confirmation.sql",
          ],
          [
            "test/registry/valle-release-credit-correction.test.ts",
            "20260816202232_correct_valle_release_featured_credit.sql",
          ],
        ] as const;

        for (
          const [
            path,
            migrationName,
          ]
          of expectedReferences
        ) {
          expect(
            read(
              path,
            ),
          ).toContain(
            migrationName,
          );
        }

        const baseline =
          JSON.parse(
            read(
              "docs/engineering/live-schema-baseline.json",
            ),
          );

        const migrationFiles =
          readdirSync(
            "supabase/migrations",
          )
            .filter(
              (name) =>
                /^\d{14}_.+\.sql$/.test(
                  name,
                ),
            )
            .sort();

        expect(
          migrationFiles.length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          baseline.migrationCount,
        ).toBe(
          migrationFiles.length,
        );

        expect(
          baseline.latestMigration,
        ).toBe(
          migrationFiles.at(
            -1,
          ),
        );
      },
    );

    it(
      "requires production migration history to be a local timestamp prefix and dry-runs the real deployment path",
      () => {
        const verifier =
          read(
            "scripts/control-plane/verify-live-migration-history.mjs",
          );

        expect(
          verifier,
        ).toContain(
          'const CLI = "supabase@2.107.0"',
        );

        expect(
          verifier,
        ).toContain(
          '"migration",\n      "list",\n      "--linked"',
        );

        expect(
          verifier,
        ).toContain(
          "Production contains migration versions missing from the repository.",
        );

        expect(
          verifier,
        ).toContain(
          "Repository contains local-only migrations interleaved inside already-applied production history.",
        );

        expect(
          verifier,
        ).toContain(
          '"db",\n      "push",\n      "--dry-run",\n      "--linked"',
        );

        expect(
          verifier,
        ).toContain(
          "dry-run pending set exactly matches forward-only local migrations.",
        );
      },
    );

    it(
      "runs migration-history verification inside the protected critical schema gate",
      () => {
        const packageJson =
          JSON.parse(
            read(
              "package.json",
            ),
          );

        const workflow =
          read(
            ".github/workflows/critical-control-plane.yml",
          );

        expect(
          packageJson
            .scripts[
              "schema:verify"
            ],
        ).toBe(
          "node scripts/control-plane/verify-live-migration-history.mjs && bash scripts/control-plane/verify-live-schema.sh",
        );

        expect(
          packageJson
            .scripts[
              "test:critical"
            ],
        ).toContain(
          "test/control-plane/live-migration-history.test.ts",
        );

        expect(
          workflow,
        ).toContain(
          "Detect live schema and migration-history drift",
        );

        expect(
          workflow,
        ).toContain(
          "run: npm run schema:verify",
        );
      },
    );
  },
);

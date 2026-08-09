import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const migrationPath =
  process.env
    .WK_COMMUNITY_EMOJI_REACTIONS_MIGRATION;

if (!migrationPath) {
  throw new Error(
    "WK_COMMUNITY_EMOJI_REACTIONS_MIGRATION is required",
  );
}

const migration =
  readFileSync(
    migrationPath,
    "utf8",
  );

const types =
  readFileSync(
    "src/services/community/types.ts",
    "utf8",
  );

const packageJson =
  readFileSync(
    "package.json",
    "utf8",
  );

describe(
  "Phase 5B Community emoji reactions",
  () => {
    it(
      "keeps the reaction command authenticated and hardened",
      () => {
        expect(migration)
          .toContain(
            "security definer",
          );

        expect(migration)
          .toContain(
            "set search_path = pg_catalog, public",
          );

        expect(migration)
          .toContain(
            "to authenticated, service_role",
          );
      },
    );

    it(
      "accepts bounded Unicode reactions instead of five values only",
      () => {
        expect(migration)
          .toContain(
            "char_length",
          );

        expect(migration)
          .toContain(
            "octet_length",
          );

        expect(migration)
          .not.toContain(
            "if v_reaction_type not in (",
          );
      },
    );

    it(
      "preserves legacy reaction compatibility",
      () => {
        for (
          const legacy
          of [
            "signal",
            "memory",
            "context",
            "fire",
            "agree",
          ]
        ) {
          expect(migration)
            .toContain(
              `'${legacy}'`,
            );
        }
      },
    );

    it(
      "generalizes the frontend reaction type",
      () => {
        expect(types)
          .toContain(
            "export type ReactionType = string;",
          );
      },
    );

    it(
      "pins the full emoji picker dependency",
      () => {
        expect(packageJson)
          .toContain(
            '"emoji-picker-react": "4.19.1"',
          );
      },
    );
  },
);
